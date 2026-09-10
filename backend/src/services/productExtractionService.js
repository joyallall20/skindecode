import { scrapeUrlToMarkdown } from './firecrawlService.js';
import { generateGroqJSON } from './groqService.js';
import { generateGeminiJSON, isGeminiConfigured } from './geminiService.js';
import { isFirecrawlConfigured, isGroqConfigured, getGeminiConfig } from '../config/aiConfig.js';
import { assertSafeUrl, safeHttpGet, UrlSafetyError } from '../utils/urlSafety.js';
import { cleanProductPageContent } from './productContentCleaner.js';
import {
  PRODUCT_EXTRACTION_SCHEMA,
  createEmptyExtractedData,
  normalizeExtractedProductData,
  validateExtractedProductData,
} from '../schemas/productExtractionSchema.js';
import { EXTRACTION_PROMPT_VERSION } from '../constants/intelligenceVersions.js';
import { enrichProductIngredients } from './ingredientEnrichmentService.js';

const MAX_FETCH_BYTES = 500_000;
const MAX_CONTENT_CHARS = 250000;
const GROQ_MAX_CONTENT_CHARS = 4500;
const GROQ_MAX_OUTPUT_TOKENS = 1800;
const FETCH_TIMEOUT_MS = 20000;
const CHARS_PER_TOKEN = 3.5;

const estimateTokens = (chars) => Math.ceil(Number(chars || 0) / CHARS_PER_TOKEN);

const logGroqTokenBudget = ({
  systemPrompt,
  userPrompt,
  schema,
  productContentChars,
  maxOutputTokens,
}) => {
  const systemPromptChars = String(systemPrompt || '').length;
  const userPromptChars = String(userPrompt || '').length;
  const schemaChars = schema ? JSON.stringify(schema).length : 0;
  const estimatedPromptTokens = estimateTokens(systemPromptChars + userPromptChars + schemaChars);
  const estimatedTotalTokens = estimatedPromptTokens + maxOutputTokens;

  console.info('[extraction] groq token budget', {
    systemPromptChars,
    userPromptChars,
    schemaChars,
    productContentChars,
    estimatedPromptTokens,
    maxOutputTokens,
    estimatedTotalTokens,
  });

  return { estimatedPromptTokens, estimatedTotalTokens };
};

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const collectImageUrls = (pageContent = {}) => {
  const urls = [];
  const metadata = pageContent.metadata || {};
  const metadataCandidates = [
    metadata.ogImage,
    metadata.og_image,
    metadata['og:image'],
    metadata.image,
    metadata.ogImageUrl,
  ];
  if (Array.isArray(metadata.images)) metadataCandidates.push(...metadata.images);
  metadataCandidates.forEach((entry) => {
    if (typeof entry === 'string') urls.push(entry);
    else if (entry && typeof entry === 'object') urls.push(entry.url || entry.src || '');
  });

  const markdown = String(pageContent.content || '');
  const markdownMatches = markdown.matchAll(/!\[[^\]]*]\((https?:[^)\s]+)\)/g);
  for (const match of markdownMatches) {
    urls.push(match[1]);
  }

  return [...new Set(urls.map((url) => String(url || '').trim()).filter((url) => /^https?:\/\//i.test(url)))].slice(0, 12);
};

const inferRetailerFromUrl = (url) => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '');
    const retailer = hostname.split('.')[0];
    return retailer ? retailer.charAt(0).toUpperCase() + retailer.slice(1) : '';
  } catch {
    return '';
  }
};

/** Legacy fallback: raw fetch + HTML strip */
const stripHtmlToText = (html) => {
  if (typeof html !== 'string' || !html.trim()) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const fetchUrlContentLegacy = async (url) => {
  const safeUrl = await assertSafeUrl(url);
  const response = await safeHttpGet(safeUrl, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: MAX_FETCH_BYTES,
  });
  const pageText = stripHtmlToText(response.body);
  return {
    content: pageText.slice(0, MAX_CONTENT_CHARS),
    contentType: response.contentType || 'text/html',
    truncated: response.body.length >= MAX_FETCH_BYTES,
    fetchMethod: 'legacy',
  };
};

const fetchPageContent = async (url) => {
  if (isFirecrawlConfigured()) {
    console.info('[extraction] using Firecrawl', { url });
    const firecrawlResult = await scrapeUrlToMarkdown(url, { maxChars: MAX_CONTENT_CHARS });
    if (firecrawlResult.success) {
      return {
        content: firecrawlResult.markdown,
        contentType: 'markdown',
        truncated: firecrawlResult.markdown.length >= MAX_CONTENT_CHARS,
        fetchMethod: 'firecrawl',
        metadata: firecrawlResult.metadata,
      };
    }
    console.warn('[extraction] Firecrawl failed, falling back to legacy fetch', { url, error: firecrawlResult.error });
  }

  console.info('[extraction] using legacy fetch', { url });
  return fetchUrlContentLegacy(url);
};

const EXTRACTION_SYSTEM_PROMPT = [
  'Return ONLY valid JSON.',
  'Extract these keys only: name, brand, price, category, variant, keyIngredients, skinTypes, concerns.',
  'keyIngredients is a short array of prominent actives from the page, or [].',
  'skinTypes is an array containing only explicit skin types supported by the page, using oily, dry, combination, normal, or sensitive. Do not infer from ingredients.',
  'concerns is an array containing only concerns explicitly supported by product claims or positioning. Do not infer concerns from ingredients.',
  'price is a number or null. Do not invent values.',
].join(' ');

const buildExtractionPrompt = ({ url, content }) => [
  'Extract name, brand, price, category, variant, keyIngredients, skinTypes, and concerns from this product page.',
  'For skinTypes, capture explicit wording such as "for oily skin" or "suitable for dry and sensitive skin"; otherwise return [].',
  'For concerns, capture only explicit supported claims such as reducing dark spots, redness, dryness, or acne; otherwise return []. Do not infer from ingredients.',
  `URL: ${url}`,
  '',
  content || '[No readable content]',
].join('\n');

const runStructuredExtraction = async ({ url, content }) => {
  const cleaned = cleanProductPageContent(content, { maxChars: GROQ_MAX_CONTENT_CHARS });
  console.info(`[extraction] Firecrawl content length: ${cleaned.sourceLength}`);
  console.info(`[extraction] filtered product content length: ${cleaned.filteredLength}`);
  console.info(`[extraction] removed content: ${cleaned.removedLength}`);

  const groqPrompt = buildExtractionPrompt({
    url,
    content: cleaned.content,
  });
  const prompt = groqPrompt;
  const tokenBudget = logGroqTokenBudget({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userPrompt: groqPrompt,
    schema: null,
    productContentChars: cleaned.filteredLength,
    maxOutputTokens: GROQ_MAX_OUTPUT_TOKENS,
  });

  if (isGroqConfigured()) {
    console.info('[extraction] using Groq for structured extraction');
    const groqResult = await generateGroqJSON({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      prompt: groqPrompt,
      modelKey: 'extraction',
      temperature: 0,
      maxTokens: GROQ_MAX_OUTPUT_TOKENS,
      validate: validateExtractedProductData,
    });
    if (groqResult.success) {
      return { ...groqResult, extractionProvider: 'groq' };
    }
    console.warn('[extraction] Groq failed, trying Gemini fallback', {
      model: groqResult.model,
      error: groqResult.error,
      validationErrors: groqResult.validationErrors,
      parseError: groqResult.parseError,
      inputChars: groqPrompt.length,
      estimatedTotalTokens: tokenBudget.estimatedTotalTokens,
      promptVersion: EXTRACTION_PROMPT_VERSION,
    });
  }

  if (isGeminiConfigured()) {
    console.info('[extraction] using Gemini fallback for structured extraction');
    logGroqTokenBudget({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: prompt,
      schema: PRODUCT_EXTRACTION_SCHEMA,
      productContentChars: cleaned.filteredLength,
      maxOutputTokens: GROQ_MAX_OUTPUT_TOKENS,
    });
    const geminiResult = await generateGeminiJSON({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      prompt,
      responseSchema: PRODUCT_EXTRACTION_SCHEMA,
      validate: validateExtractedProductData,
      model: getGeminiConfig().models.extraction,
    });
    return { ...geminiResult, extractionProvider: 'gemini' };
  }

  return {
    success: false,
    error: 'No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY.',
    provider: 'fallback',
    model: 'none',
    extractionProvider: 'none',
  };
};

export const extractProductFromUrl = async (url) => {
  const safeUrl = sanitizeString(url);

  if (!safeUrl || !/^https?:\/\//i.test(safeUrl)) {
    throw new Error('Product URL must begin with http:// or https://');
  }

  try {
    await assertSafeUrl(safeUrl);
  } catch (error) {
    const message = error instanceof UrlSafetyError ? error.message : 'URL is not allowed.';
    return {
      status: 'failed',
      extractedData: createEmptyExtractedData(),
      note: message,
    };
  }

  if (!isGroqConfigured() && !isGeminiConfigured()) {
    return {
      status: 'not_configured',
      extractedData: createEmptyExtractedData(),
      note: 'Set GROQ_API_KEY or GEMINI_API_KEY to enable product extraction.',
    };
  }

  let pageContent;
  try {
    pageContent = await fetchPageContent(safeUrl);
  } catch (error) {
    console.error('[extraction] page fetch failed', { url: safeUrl, error: error.message });
    return {
      status: 'failed',
      extractedData: createEmptyExtractedData(),
      note: error.message || 'Failed to fetch product page content.',
    };
  }

  const extractionResult = await runStructuredExtraction({
    url: safeUrl,
    content: pageContent.content,
  });

  if (!extractionResult.success) {
    return {
      status: extractionResult.fallback ? 'not_configured' : 'invalid_response',
      extractedData: createEmptyExtractedData(),
      note: extractionResult.error || 'Product extraction failed.',
      aiProvider: extractionResult.extractionProvider || extractionResult.provider,
      aiModel: extractionResult.model,
      validationErrors: extractionResult.validationErrors,
      parseError: extractionResult.parseError,
      rawResponse: {
        rawText: extractionResult.rawText,
        fetchMethod: pageContent.fetchMethod,
        promptVersion: EXTRACTION_PROMPT_VERSION,
      },
    };
  }

  let extractedData = normalizeExtractedProductData(extractionResult.data);
  if (!extractedData.retailer) {
    extractedData.retailer = inferRetailerFromUrl(safeUrl);
  }
  if (!extractedData.description && pageContent.metadata?.description) {
    extractedData.description = String(pageContent.metadata.description).trim();
  }
  extractedData.images = collectImageUrls(pageContent);

  try {
    extractedData = await enrichProductIngredients({
      extractedData,
      pageMarkdown: pageContent.content,
    });
  } catch (error) {
    console.error('[inci] ingredient enrichment failed without blocking extraction', { error: error.message });
    extractedData = {
      ...extractedData,
      ingredients: Array.isArray(extractedData.ingredients) ? extractedData.ingredients : [],
      keyIngredients: Array.isArray(extractedData.keyIngredients) ? extractedData.keyIngredients : [],
      ingredientSource: extractedData.ingredientSource || null,
      ingredientConfidence: extractedData.ingredientConfidence || null,
    };
  }

  console.info('[extraction] success', {
    url: safeUrl,
    provider: extractionResult.extractionProvider,
    model: extractionResult.model,
    fetchMethod: pageContent.fetchMethod,
    ingredientSource: extractedData.ingredientSource,
    ingredientConfidence: extractedData.ingredientConfidence,
    ingredientCount: extractedData.ingredients?.length || 0,
  });

  return {
    status: 'review',
    extractedData,
    note: 'Product data extracted successfully and requires admin review before publishing.',
    aiProvider: extractionResult.extractionProvider || extractionResult.provider,
    aiModel: extractionResult.model,
    rawResponse: {
      rawText: extractionResult.rawText,
      fetchMethod: pageContent.fetchMethod,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      pageContentMeta: {
        contentType: pageContent.contentType,
        truncated: pageContent.truncated,
        contentLength: pageContent.content?.length || 0,
      },
    },
  };
};

export default extractProductFromUrl;
