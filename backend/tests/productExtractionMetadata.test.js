import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExtractedProductData, PRODUCT_EXTRACTION_SCHEMA } from '../src/schemas/productExtractionSchema.js';

describe('product extraction metadata', () => {
  it('preserves explicit skin types and concerns during normalization', () => {
    const normalized = normalizeExtractedProductData({
      name: 'Lacto Calamine Moisturizer',
      brand: 'Lacto Calamine',
      category: 'Moisturizer',
      skinTypes: ['oily'],
      concerns: ['dark-spots'],
    });

    assert.deepEqual(normalized.skinTypes, ['oily']);
    assert.deepEqual(normalized.concerns, ['dark-spots']);
  });

  it('declares skinTypes and concerns in the provider schema', () => {
    assert.deepEqual(PRODUCT_EXTRACTION_SCHEMA.properties.skinTypes, {
      type: 'array',
      items: { type: 'string' },
    });
    assert.deepEqual(PRODUCT_EXTRACTION_SCHEMA.properties.concerns, {
      type: 'array',
      items: { type: 'string' },
    });
  });
});
