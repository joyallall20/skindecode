import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import test from 'node:test';
import assert from 'node:assert/strict';

test('product extraction does not import or call Product Intelligence', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const extraction = readFileSync(path.resolve(dir, '../src/services/productExtractionService.js'), 'utf8');
  const importController = readFileSync(path.resolve(dir, '../src/controllers/productImportController.js'), 'utf8');
  assert.equal(extraction.includes('generateProductIntelligence'), false);
  assert.equal(extraction.includes('productIntelligenceService'), false);
  assert.equal(importController.includes('generateProductIntelligence('), false);
});
