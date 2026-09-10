import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSellerMatch } from '../src/services/sellerMatchValidationService.js';

const canonical = {
  name: 'Hydrating Serum',
  brand: { name: 'BrandA' },
  variant: 'unscented',
  size: '30ml',
  quantity: '1',
  productIdentifiers: { gtin: '1234567890123', sku: 'SKU-1' },
};

describe('seller match deterministic boundaries', () => {
  it('accepts exact same product/variant/size/quantity', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: true, sizeMatch: true },
      extracted: {
        variant: 'unscented',
        size: '30ml',
        quantity: '1',
        gtin: '1234567890123',
        sku: 'SKU-1',
      },
    });
    assert.equal(result.accepted, true);
  });

  it('rejects different variant', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: false, sizeMatch: true },
      extracted: { variant: 'fragranced', size: '30ml', quantity: '1', gtin: '1234567890123' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /variant/i.test(reason)));
  });

  it('rejects different size', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: true, sizeMatch: false },
      extracted: { variant: 'unscented', size: '50ml', quantity: '1', gtin: '1234567890123' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /size/i.test(reason)));
  });

  it('rejects different quantity', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: true, sizeMatch: true },
      extracted: { variant: 'unscented', size: '30ml', quantity: '2', gtin: '1234567890123' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /quantity/i.test(reason)));
  });

  it('rejects conflicting identifiers', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: true, sizeMatch: true },
      extracted: { variant: 'unscented', size: '30ml', quantity: '1', gtin: '9999999999999' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /GTIN/i.test(reason)));
  });

  it('accepts matching identifiers with compatible metadata', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.9, variantMatch: true, sizeMatch: true },
      extracted: { variant: 'unscented', size: '30 ml', quantity: '1', gtin: '1234567890123' },
    });
    assert.equal(result.accepted, true);
  });

  it('rejects low AI confidence', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.4, variantMatch: true, sizeMatch: true },
      extracted: { variant: 'unscented', size: '30ml', quantity: '1', gtin: '1234567890123' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /confidence/i.test(reason)));
  });

  it('rejects missing required identifier on candidate', () => {
    const result = validateSellerMatch({
      canonicalProduct: canonical,
      aiMatch: { sameProduct: true, confidence: 0.95, variantMatch: true, sizeMatch: true },
      extracted: { variant: 'unscented', size: '30ml', quantity: '1' },
    });
    assert.equal(result.accepted, false);
    assert.ok(result.reasons.some((reason) => /identifier/i.test(reason)));
  });
});
