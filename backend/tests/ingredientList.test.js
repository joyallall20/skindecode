import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredientList } from '../src/utils/ingredientList.js';
import { generateProductIntelligence } from '../src/services/productIntelligenceService.js';
import { buildIntelligenceInputFromProduct } from '../src/utils/productIntelligenceInput.js';

test('parseIngredientList splits comma-separated paste into unique names', () => {
  const parsed = parseIngredientList(
    'Ingredients: Aqua, Glycerin, Niacinamide, Sodium Hyaluronate, Phenoxyethanol'
  );
  assert.deepEqual(parsed, [
    'Aqua',
    'Glycerin',
    'Niacinamide',
    'Sodium Hyaluronate',
    'Phenoxyethanol',
  ]);
});

test('parseIngredientList accepts one-per-line and bullet lists', () => {
  const parsed = parseIngredientList('- Aqua\n• Glycerin\nNiacinamide');
  assert.deepEqual(parsed, ['Aqua', 'Glycerin', 'Niacinamide']);
});

test('Product Intelligence refuses to run on keyIngredients only', async () => {
  const result = await generateProductIntelligence({
    name: 'Test cleanser',
    brand: 'Test Brand',
    category: 'Cleanser',
    ingredients: [],
    keyIngredients: ['Niacinamide', 'Glycolic Acid'],
  });

  assert.equal(result.success, false);
  assert.match(result.error, /Full ingredient list is required/i);
});

test('intelligence input uses full ingredient names, not only keyIngredients', () => {
  const input = buildIntelligenceInputFromProduct({
    name: 'Test',
    brand: { name: 'Brand' },
    category: { name: 'Cleanser' },
    ingredients: [{ name: 'Aqua' }, { name: 'Glycerin' }, { name: 'Niacinamide' }],
    keyIngredients: [{ name: 'Niacinamide' }],
  });

  assert.deepEqual(input.ingredients, ['Aqua', 'Glycerin', 'Niacinamide']);
  assert.deepEqual(input.keyIngredients, ['Niacinamide']);
});
