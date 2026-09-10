import Retailer from '../models/Retailer.js';
import SellerDiscoveryCandidate from '../models/SellerDiscoveryCandidate.js';
import { searchWeb, scrapeUrlToMarkdown } from './firecrawlService.js';
import { generateGroqJSON } from './groqService.js';
import { normalizeExtractedProductData } from '../schemas/productExtractionSchema.js';
import { validateSellerMatch } from './sellerMatchValidationService.js';
import { SELLER_MATCHING_PROMPT_VERSION } from '../constants/intelligenceVersions.js';

const MATCHING_SCHEMA = {
  type: 'object',
  properties: {
    sameProduct: { type: 'boolean' },
    confidence: { type: 'number' },
    variantMatch: { type: 'boolean' },
    sizeMatch: { type: 'boolean' },
    reasoning: { type: 'string' },
    extractedName: { type: 'string' },
    extractedBrand: { type: 'string' },
    variant: { type: 'string' },
    size: { type: 'string' },
    price: { type: 'number', nullable: true },
    currency: { type: 'string' },
    inStock: { type: 'boolean', nullable: true },
    sku: { type: 'string' },
    gtin: { type: 'string' },
  },
  required: ['sameProduct', 'confidence', 'reasoning'],
};

const buildSearchQuery = (canonicalProduct, retailer) => {
  const brand = canonicalProduct.brand?.name || canonicalProduct.brand || '';
  const name = canonicalProduct.name || '';
  const variant = canonicalProduct.variant || '';
  const size = canonicalProduct.size || '';
  const domain = retailer.discoveryConfig?.domain || retailer.website || '';
  const siteFilter = domain ? ` site:${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
  return `${brand} ${name} ${variant} ${size}${siteFilter}`.trim();
};

const matchSellerProduct = async (canonicalProduct, pageMarkdown, pageUrl) => {
  const prompt = JSON.stringify({
    canonicalProduct: {
      name: canonicalProduct.name,
      brand: canonicalProduct.brand?.name || canonicalProduct.brand,
      variant: canonicalProduct.variant,
      size: canonicalProduct.size,
      category: canonicalProduct.category?.name || canonicalProduct.category,
      identifiers: canonicalProduct.productIdentifiers,
    },
    candidateUrl: pageUrl,
    pageContent: (pageMarkdown || '').slice(0, 15000),
  });

  const result = await generateGroqJSON({
    systemPrompt: [
      'You classify whether a retailer page sells the SAME product as the canonical reference.',
      'Compare brand, name, variant, size, and identifiers.',
      'Do NOT assume same name means same product.',
      'Return confidence 0-1. Only set sameProduct=true if confidence >= 0.75.',
      'Extract price/currency/stock if visible. Do not invent identifiers.',
    ].join(' '),
    prompt: `Classify this candidate:\n${prompt}`,
    modelKey: 'matching',
    validate: (data) => {
      const errors = [];
      if (typeof data?.sameProduct !== 'boolean') errors.push('sameProduct required');
      if (!Number.isFinite(Number(data?.confidence))) errors.push('confidence required');
      return errors;
    },
  });

  return result;
};

/**
 * Discover seller candidates for a canonical product across configured retailers.
 */
export const discoverSellers = async ({ canonicalProduct, productId = null, productImportId = null }) => {
  const retailers = await Retailer.find({
    isActive: true,
    'discoveryConfig.enabled': { $ne: false },
  }).lean();

  if (!retailers.length) {
    console.warn('[seller-discovery] no enabled retailers configured');
    return { candidates: [], note: 'No retailers configured for discovery.' };
  }

  const allCandidates = [];

  for (const retailer of retailers) {
    const query = buildSearchQuery(canonicalProduct, retailer);
    console.info('[seller-discovery] searching', { retailer: retailer.name, query });

    const searchResult = await searchWeb(query, { limit: 3, country: retailer.discoveryConfig?.country || 'in' });

    if (!searchResult.success || !searchResult.results?.length) {
      console.warn('[seller-discovery] no results', { retailer: retailer.name });
      continue;
    }

    for (const result of searchResult.results) {
      if (!result.url) continue;

      let markdown = result.markdown;
      if (!markdown?.trim()) {
        const scrape = await scrapeUrlToMarkdown(result.url, { maxChars: 20000 });
        markdown = scrape.success ? scrape.markdown : '';
      }

      const matchResult = await matchSellerProduct(canonicalProduct, markdown, result.url);

      if (!matchResult.success) {
        console.warn('[seller-discovery] match classification failed', { url: result.url, error: matchResult.error });
        continue;
      }

      const match = matchResult.data;
      const extracted = normalizeExtractedProductData({
        name: match.extractedName || result.title,
        brand: match.extractedBrand || canonicalProduct.brand?.name || canonicalProduct.brand,
        variant: match.variant,
        size: match.size,
        quantity: match.quantity,
        price: match.price,
        currency: match.currency || 'INR',
        inStock: match.inStock,
        sku: match.sku,
        gtin: match.gtin,
        ean: match.ean,
        upc: match.upc,
      });

      const validation = validateSellerMatch({
        canonicalProduct,
        aiMatch: match,
        extracted,
      });

      if (!validation.accepted) {
        console.warn('[seller-discovery] backend rejected candidate', {
          url: result.url,
          reasons: validation.reasons,
        });
        continue;
      }

      const candidateData = {
        product: productId,
        productImport: productImportId,
        retailer: retailer._id,
        retailerName: retailer.name,
        sourceUrl: result.url,
        extractedName: extracted.name,
        extractedBrand: extracted.brand,
        variant: extracted.variant,
        size: extracted.size,
        price: extracted.price,
        currency: extracted.currency,
        inStock: extracted.inStock,
        identifiers: { sku: extracted.sku, gtin: extracted.gtin },
        matchResult: {
          sameProduct: match.sameProduct,
          confidence: match.confidence,
          variantMatch: match.variantMatch ?? false,
          sizeMatch: match.sizeMatch ?? false,
          reasoning: match.reasoning,
          backendValidated: true,
          validationReasons: validation.reasons,
        },
        status: 'discovered',
        discoverySource: 'firecrawl_search',
        aiProvider: matchResult.provider,
        aiModel: matchResult.model,
      };

      try {
        const saved = await SellerDiscoveryCandidate.findOneAndUpdate(
          {
            $or: [
              { product: productId, sourceUrl: result.url },
              { productImport: productImportId, sourceUrl: result.url },
            ],
          },
          { $set: candidateData },
          { upsert: true, returnDocument: 'after' }
        );
        allCandidates.push(saved);
      } catch (err) {
        console.error('[seller-discovery] save candidate failed', { url: result.url, error: err.message });
      }
    }
  }

  console.info('[seller-discovery] complete', { count: allCandidates.length, promptVersion: SELLER_MATCHING_PROMPT_VERSION });
  return { candidates: allCandidates, promptVersion: SELLER_MATCHING_PROMPT_VERSION };
};

export default { discoverSellers };
