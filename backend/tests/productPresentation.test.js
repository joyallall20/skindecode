import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProductForCustomer } from '../src/utils/productPresentation.js';

test('removes sourceUrl from public product payload', () => {
  const sanitized = sanitizeProductForCustomer({
    _id: 'p1',
    name: 'Serum',
    sourceUrl: 'https://internal/import/123',
    canonicalIdentityHash: 'abc123',
  });

  assert.equal(sanitized.name, 'Serum');
  assert.equal(sanitized.sourceUrl, undefined);
  assert.equal(sanitized.canonicalIdentityHash, undefined);
});
