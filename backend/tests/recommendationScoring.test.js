import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreProductCompatibility } from '../src/services/recommendationScoringService.js';

const product = {
  name: 'Test Moisturizer',
  brand: { name: 'BrandA' },
  category: { name: 'Moisturizer' },
  ingredients: [],
  fragranceFree: true,
  productIntelligence: {
    skinTypeCompatibility: { oily: 0.8 },
    sensitivitySuitability: { low: 0.8 },
    concernCompatibility: {},
    ingredientAnalysis: [],
    mustHaveAttributes: {
      vegan: false,
      crueltyFree: false,
      reefSafe: true,
    },
  },
};

test('must-have preference conflicts apply outside high-sensitivity branch', () => {
  const result = scoreProductCompatibility({
    product,
    skinProfile: {
      skinType: 'oily',
      sensitivity: 'low',
      concerns: [],
      mustHavePreferences: ['vegan'],
    },
  });

  assert.ok(result.concernsNotMatched.includes('required preference conflict'));
});
