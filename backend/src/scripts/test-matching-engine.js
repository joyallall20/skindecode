/**
 * Tests matching engine hard conflict overrides.
 * Run: node scripts/test-matching-engine.js
 */
import { computeProductMatch } from '../src/services/matchingEngineService.js';

let passed = 0;
let failed = 0;

const assert = (label, condition) => {
  if (condition) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.error(`  ✗ ${label}`); }
};

const fragrancedProduct = {
  name: 'Fragranced Moisturizer',
  brand: { name: 'TestBrand' },
  category: { name: 'Moisturizer' },
  ingredients: [{ name: 'Fragrance' }, { name: 'Water' }],
  fragranceFree: false,
  productIntelligence: {
    skinTypeCompatibility: { oily: 0.95, dry: 0.9, combination: 0.9, normal: 0.9, sensitive: 0.85 },
    sensitivitySuitability: { low: 0.9, medium: 0.85, high: 0.8 },
    concernCompatibility: { acne: 0.9 },
    ingredientAnalysis: [{ ingredient: 'Fragrance', benefits: [], explanation: 'Fragrance', evidenceLevel: 'known' }],
    evidenceConfidence: 0.8,
    explanation: 'High compatibility product',
    qualityAssessment: { formulationSignals: [], limitations: [], ratingBasis: 'test' },
    mustHaveAttributes: {},
  },
};

const allergyProfile = {
  skinType: 'oily',
  sensitivity: 'low',
  concerns: ['acne'],
  allergies: ['fragrance'],
};

const result = computeProductMatch({ product: fragrancedProduct, skinProfile: allergyProfile });

assert('Allergy conflict makes product ineligible', result.eligible === false);
assert('Hard conflicts present', result.hardConflicts.length > 0);
assert('High intelligence does not override allergy', result.overallScore === 0);

const budgetProfile = { skinType: 'oily', sensitivity: 'low', concerns: [], budget: { max: 500 } };
const expensiveResult = computeProductMatch({
  product: fragrancedProduct,
  skinProfile: budgetProfile,
  offerPrice: 2500,
});

assert('Budget does not reduce skin compatibility score', expensiveResult.skinCompatibilityScore > 50);
assert('Budget warning present when over budget', expensiveResult.withinBudget === false);
assert('Budget warning in warnings array', expensiveResult.warnings.some((w) => w.factor === 'budget'));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
