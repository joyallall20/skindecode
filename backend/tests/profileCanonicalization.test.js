import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCanonicalProfileHash,
  buildCanonicalProfile,
} from '../src/services/profileCanonicalizationService.js';

const baseProfile = {
  skinType: 'oily',
  sensitivity: 'medium',
  morningSkinFeel: 'slightly-oily',
  responseToNewProducts: 'no-reaction',
  sunscreenHabit: 'sometimes',
  ageRange: '25-34',
  primaryGoal: 'clearer-skin',
  concerns: ['acne'],
  allergies: [],
  avoidedIngredients: [],
  mustHavePreferences: [],
};

test('different budgets produce different canonical hashes', () => {
  const hashA = computeCanonicalProfileHash({ ...baseProfile, budget: { min: 0, max: 500 } });
  const hashB = computeCanonicalProfileHash({ ...baseProfile, budget: { min: 0, max: 2000 } });
  assert.notEqual(hashA, hashB);
});

test('canonical profile includes normalized budget', () => {
  const canonical = buildCanonicalProfile({ ...baseProfile, budget: { min: 100, max: 1500 } });
  assert.deepEqual(canonical.budget, { min: 100, max: 1500 });
});

test('same profile produces same hash', () => {
  const profile = {
    ...baseProfile,
    budget: { min: 0, max: 1000 },
    concerns: ['acne', 'redness'],
  };
  const hashA = computeCanonicalProfileHash(profile);
  const hashB = computeCanonicalProfileHash({
    ...profile,
    concerns: ['redness', 'acne'],
  });
  assert.equal(hashA, hashB);
});
