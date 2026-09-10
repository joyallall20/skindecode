import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSellerMatch } from '../src/services/sellerMatchValidationService.js';

const canonicalProduct = {
  name: 'Hydrating Serum',
  brand: { name: 'BrandA' },
  variant: 'unscented',
  size: '30ml',
  productIdentifiers: { gtin: '1234567890123' },
};

test('rejects low-confidence AI match', () => {
  const result = validateSellerMatch({
    canonicalProduct,
    aiMatch: { sameProduct: true, confidence: 0.5, variantMatch: true, sizeMatch: true },
    extracted: { variant: 'unscented', size: '30ml', gtin: '1234567890123' },
  });
  assert.equal(result.accepted, false);
});

test('rejects GTIN mismatch', () => {
  const result = validateSellerMatch({
    canonicalProduct,
    aiMatch: { sameProduct: true, confidence: 0.9, variantMatch: true, sizeMatch: true },
    extracted: { variant: 'unscented', size: '30ml', gtin: '9999999999999' },
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.some((reason) => reason.includes('GTIN')));
});

test('rejects variant mismatch', () => {
  const result = validateSellerMatch({
    canonicalProduct,
    aiMatch: { sameProduct: true, confidence: 0.9, variantMatch: false, sizeMatch: true },
    extracted: { variant: 'fragranced', size: '30ml', gtin: '1234567890123' },
  });
  assert.equal(result.accepted, false);
});

test('accepts validated exact match', () => {
  const result = validateSellerMatch({
    canonicalProduct,
    aiMatch: { sameProduct: true, confidence: 0.92, variantMatch: true, sizeMatch: true },
    extracted: { variant: 'unscented', size: '30ml', gtin: '1234567890123' },
  });
  assert.equal(result.accepted, true);
});
