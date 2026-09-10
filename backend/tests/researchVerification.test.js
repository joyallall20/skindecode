import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPubMedId } from '../src/services/researchVerificationService.js';

test('invalid PMID is rejected without network lookup', async () => {
  const result = await verifyPubMedId('');
  assert.equal(result.valid, false);
});

test('non-numeric PMID is rejected', async () => {
  const result = await verifyPubMedId('not-a-pmid');
  assert.equal(result.valid, false);
});
