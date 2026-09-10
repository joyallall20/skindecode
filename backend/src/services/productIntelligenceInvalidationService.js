import Product from '../models/Product.js';
import { INTELLIGENCE_RELEVANT_PRODUCT_FIELDS } from '../constants/productIntelligenceFields.js';
import { invalidateExplanationsForProduct } from './invalidationService.js';

const normalizeForComparison = (value) => {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return JSON.stringify([...value].map(String).sort());
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const hasIntelligenceRelevantProductChanges = (existing = {}, updates = {}) =>
  INTELLIGENCE_RELEVANT_PRODUCT_FIELDS.some((field) => {
    if (updates[field] === undefined) return false;
    return normalizeForComparison(existing[field]) !== normalizeForComparison(updates[field]);
  });

/**
 * Invalidate stored Product Intelligence, revoke approval, and stale explanation caches.
 */
export const invalidateProductIntelligenceState = async (productId, reason = 'product_intelligence_relevant_fields_changed') => {
  await Product.findByIdAndUpdate(productId, {
    $set: {
      intelligenceStatus: 'none',
      intelligenceReviewedBy: null,
      intelligenceReviewedAt: null,
      intelligenceReviewNotes: '',
    },
    $unset: {
      productIntelligence: 1,
      intelligenceMetadata: 1,
    },
  });

  await invalidateExplanationsForProduct(productId, reason);

  return { invalidated: true, reason };
};

export default {
  hasIntelligenceRelevantProductChanges,
  invalidateProductIntelligenceState,
};
