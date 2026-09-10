import { generateGeminiJSON, isGeminiConfigured } from './geminiService.js';
import { formatVerifiedKnowledgeContext } from './ingredientKnowledgeService.js';
import {
  PRODUCT_INTELLIGENCE_GEMINI_SCHEMA,
  normalizeProductIntelligence,
  validateProductIntelligence,
  RATING_BASIS_DISCLAIMER,
} from '../schemas/productIntelligenceSchema.js';
import {
  INTELLIGENCE_VERSION,
  PROMPT_VERSION,
  KNOWLEDGE_BASE_VERSION,
  INTELLIGENCE_FIELDS_USED,
} from '../constants/intelligenceVersions.js';

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitizeString(entry)).filter(Boolean);
};

export const buildProductContext = (productData = {}) => {
  const ingredientNames = sanitizeStringArray(productData.ingredients);
  const keyIngredientNames = sanitizeStringArray(productData.keyIngredients);

  return [
    `Product name: ${sanitizeString(productData.name) || 'Unknown'}`,
    `Brand: ${sanitizeString(productData.brand) || 'Unknown'}`,
    `Category: ${sanitizeString(productData.category) || 'Unknown'}`,
    `Description: ${sanitizeString(productData.description) || 'Not provided'}`,
    `Ingredients (${ingredientNames.length}): ${ingredientNames.join(', ') || 'Not provided'}`,
    `Key ingredients: ${keyIngredientNames.join(', ') || 'Not provided'}`,
    `Skin types listed by brand: ${sanitizeStringArray(productData.skinTypes).join(', ') || 'Not provided'}`,
    `Concerns listed by brand: ${sanitizeStringArray(productData.concerns).join(', ') || 'Not provided'}`,
    `Fragrance free: ${productData.fragranceFree === null || productData.fragranceFree === undefined ? 'unknown' : productData.fragranceFree}`,
    `Alcohol free: ${productData.alcoholFree === null || productData.alcoholFree === undefined ? 'unknown' : productData.alcoholFree}`,
    `Essential oil free: ${productData.essentialOilFree === null || productData.essentialOilFree === undefined ? 'unknown' : productData.essentialOilFree}`,
    `Verified product attributes: ${JSON.stringify(productData.productIntelligence?.mustHaveAttributes || {})}`,
  ].join('\n');
};

const INTELLIGENCE_SYSTEM_PROMPT = [
  'You analyze skincare products using the product information and the verified ingredient knowledge provided.',
  'Return structured intelligence signals, not a final product rating score.',
  'Never invent exact ingredient concentrations. Ingredient list order is only a weak signal.',
  'Use verified knowledge records when provided. Do not invent scientific evidence, citations, safety flags, or evidence levels for unknown ingredients.',
  'If an ingredient is listed as unknown, mark it unknown in ingredientAnalysis and do not fabricate sources.',
  'generalFlag in the knowledge base is a general ingredient assessment. It is NOT the final user-specific recommendation.',
  'Explain why notable ingredients matter: what they do, evidence strength, relevant concerns, skin-type relevance, cautions, and formulation interactions.',
  'Do not make medical claims, diagnose skin diseases, guarantee results, or claim universal safety.',
  'If information is incomplete, lower evidenceConfidence instead of inventing details.',
  `qualityAssessment.ratingBasis must state: "${RATING_BASIS_DISCLAIMER}"`,
  'Do not claim laboratory testing or clinical validation unless explicitly provided in the input.',
].join(' ');

export const buildIntelligencePrompt = (productData, knowledgeContext = '') => [
  'Analyze this skincare product and return structured product intelligence.',
  'Provide suitability signals from 0 to 1 for skin types and sensitivity levels.',
  'Provide concern compatibility scores from 0 to 1 where applicable.',
  'Include ingredientAnalysis entries for notable ingredients only, with why they matter.',
  'Use qualityAssessment to describe formulation signals and disclosed limitations only.',
  '',
  buildProductContext(productData),
  '',
  knowledgeContext
    ? `Verified ingredient knowledge for THIS product only (do not assume other ingredients):\n${knowledgeContext}`
    : 'No verified ingredient knowledge records were available for this product.',
  productData.unknownIngredients?.length
    ? `Unknown ingredients with no verified knowledge (do not invent science): ${productData.unknownIngredients.join(', ')}`
    : '',
].filter(Boolean).join('\n');

export const generateProductIntelligence = async (productData = {}) => {
  const ingredientNames = sanitizeStringArray(productData.ingredients);
  console.info('[intelligence] started');
  console.info('[intelligence] ingredient count:', ingredientNames.length);

  if (!ingredientNames.length) {
    return {
      success: false,
      data: null,
      error: 'Full ingredient list is required before running Product Intelligence.',
      provider: 'none',
      model: 'none',
      validationErrors: ['ingredients'],
      parseError: null,
      rawResponse: null,
    };
  }

  if (!isGeminiConfigured()) {
    return {
      success: false,
      data: null,
      error: 'Gemini API is not configured. Set GEMINI_API_KEY to enable product intelligence.',
      provider: 'fallback',
      model: 'local-fallback',
      validationErrors: [],
      parseError: null,
      rawResponse: null,
    };
  }

  const verifiedRecords = Array.isArray(productData.verifiedKnowledge)
    ? productData.verifiedKnowledge
    : [];
  const knowledgeContext = formatVerifiedKnowledgeContext(verifiedRecords);

  const geminiResult = await generateGeminiJSON({
    systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
    prompt: buildIntelligencePrompt(productData, knowledgeContext),
    responseSchema: PRODUCT_INTELLIGENCE_GEMINI_SCHEMA,
    validate: validateProductIntelligence,
    temperature: 0.2,
  });

  if (!geminiResult.success) {
    return {
      success: false,
      data: null,
      error: geminiResult.error || 'Product intelligence generation failed.',
      provider: geminiResult.provider,
      model: geminiResult.model,
      validationErrors: geminiResult.validationErrors,
      parseError: geminiResult.parseError,
      rawResponse: {
        rawText: geminiResult.rawText,
        rawResponse: geminiResult.rawResponse,
      },
    };
  }

  return {
    success: true,
    data: normalizeProductIntelligence(geminiResult.data),
    error: null,
    provider: geminiResult.provider,
    model: geminiResult.model,
    validationErrors: [],
    parseError: null,
    metadata: {
      intelligenceVersion: INTELLIGENCE_VERSION,
      promptVersion: PROMPT_VERSION,
      knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
      generatedAt: new Date().toISOString(),
      fieldsUsed: INTELLIGENCE_FIELDS_USED,
    },
    rawResponse: {
      rawText: geminiResult.rawText,
      rawResponse: geminiResult.rawResponse,
    },
  };
};

export const getIntelligenceAuditInfo = () => ({
  intelligenceVersion: INTELLIGENCE_VERSION,
  promptVersion: PROMPT_VERSION,
  knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
  fieldsUsed: INTELLIGENCE_FIELDS_USED,
  systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
  outputSchema: Object.keys(PRODUCT_INTELLIGENCE_GEMINI_SCHEMA.properties || {}),
  skinProfileUsedInGeneration: false,
});

export default generateProductIntelligence;
