import ProductExplanationCache from '../models/ProductExplanationCache.js';
import {
  INTELLIGENCE_VERSION,
  KNOWLEDGE_BASE_VERSION,
  MATCHING_ENGINE_VERSION,
  EXPLANATION_PROMPT_VERSION,
} from '../constants/intelligenceVersions.js';

/**
 * Targeted cache invalidation — does not blindly delete everything.
 */
export const invalidateExplanationsForProduct = async (productId, reason = 'product_changed') => {
  const result = await ProductExplanationCache.updateMany(
    { product: productId, status: 'valid' },
    { $set: { status: 'stale', validationNotes: reason } }
  );
  console.info('[invalidation] product explanations stale', { productId, count: result.modifiedCount, reason });
  return result.modifiedCount;
};

export const invalidateExplanationsForMatchingEngineChange = async () => {
  const result = await ProductExplanationCache.updateMany(
    { matchingEngineVersion: { $ne: MATCHING_ENGINE_VERSION }, status: 'valid' },
    { $set: { status: 'stale', validationNotes: 'matching_engine_version_changed' } }
  );
  console.info('[invalidation] matching engine change', { count: result.modifiedCount });
  return result.modifiedCount;
};

export const invalidateExplanationsForPromptChange = async () => {
  const result = await ProductExplanationCache.updateMany(
    { explanationPromptVersion: { $ne: EXPLANATION_PROMPT_VERSION }, status: 'valid' },
    { $set: { status: 'stale', validationNotes: 'explanation_prompt_version_changed' } }
  );
  return result.modifiedCount;
};

export const invalidateExplanationsForIntelligenceChange = async (productId) => {
  const result = await ProductExplanationCache.updateMany(
    {
      product: productId,
      productIntelligenceVersion: { $ne: INTELLIGENCE_VERSION },
    },
    { $set: { status: 'stale', validationNotes: 'intelligence_version_changed' } }
  );
  // Also invalidate all for this product when intelligence content changes
  await invalidateExplanationsForProduct(productId, 'product_intelligence_regenerated');
  return result.modifiedCount;
};

export const invalidateExplanationsForKnowledgeBaseChange = async () => {
  const result = await ProductExplanationCache.updateMany(
    { researchKnowledgeVersion: { $ne: KNOWLEDGE_BASE_VERSION }, status: 'valid' },
    { $set: { status: 'stale', validationNotes: 'knowledge_base_version_changed' } }
  );
  return result.modifiedCount;
};

export default {
  invalidateExplanationsForProduct,
  invalidateExplanationsForMatchingEngineChange,
  invalidateExplanationsForPromptChange,
  invalidateExplanationsForIntelligenceChange,
  invalidateExplanationsForKnowledgeBaseChange,
};
