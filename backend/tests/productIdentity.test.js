import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCanonicalIdentityHash } from '../src/services/productIdentityService.js';

test('same GTIN with different variant does not share identity hash', () => {
  const base = {
    brand: 'BrandA',
    name: 'Moisturizer',
    category: 'moisturizer',
    productIdentifiers: { gtin: '1234567890123' },
  };

  const hashA = computeCanonicalIdentityHash({ ...base, variant: 'gel', size: '50ml' });
  const hashB = computeCanonicalIdentityHash({ ...base, variant: 'cream', size: '50ml' });

  assert.notEqual(hashA, hashB);
});

test('similar names with different size remain distinct without identifiers', () => {
  const hashA = computeCanonicalIdentityHash({
    brand: 'BrandA',
    name: 'Hydrating Serum',
    category: 'serum',
    size: '30ml',
  });
  const hashB = computeCanonicalIdentityHash({
    brand: 'BrandA',
    name: 'Hydrating Serum',
    category: 'serum',
    size: '50ml',
  });

  assert.notEqual(hashA, hashB);
});
