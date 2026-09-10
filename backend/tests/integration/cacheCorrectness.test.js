import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import ProductExplanationCache from '../../src/models/ProductExplanationCache.js';
import {
  computeCanonicalProfileHash,
} from '../../src/services/profileCanonicalizationService.js';
import {
  invalidateExplanationsForProduct,
  invalidateExplanationsForIntelligenceChange,
  invalidateExplanationsForMatchingEngineChange,
  invalidateExplanationsForPromptChange,
} from '../../src/services/invalidationService.js';
import {
  INTELLIGENCE_VERSION,
  MATCHING_ENGINE_VERSION,
  EXPLANATION_PROMPT_VERSION,
} from '../../src/constants/intelligenceVersions.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';

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
  budget: { min: 0, max: 1000 },
};

describe('explanation cache correctness', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('same product + same profile yields same canonical hash', () => {
    const hashA = computeCanonicalProfileHash(baseProfile);
    const hashB = computeCanonicalProfileHash({
      ...baseProfile,
      concerns: ['acne'],
      userId: 'should-not-affect-hash',
    });
    assert.equal(hashA, hashB);
  });

  it('different budgets produce different hashes', () => {
    const hashA = computeCanonicalProfileHash({ ...baseProfile, budget: { min: 0, max: 500 } });
    const hashB = computeCanonicalProfileHash({ ...baseProfile, budget: { min: 0, max: 2000 } });
    assert.notEqual(hashA, hashB);
  });

  it('array ordering does not change canonical hash', () => {
    const hashA = computeCanonicalProfileHash({ ...baseProfile, concerns: ['acne', 'redness'] });
    const hashB = computeCanonicalProfileHash({ ...baseProfile, concerns: ['redness', 'acne'] });
    assert.equal(hashA, hashB);
  });

  it('invalidates caches on intelligence, matching, and prompt version changes', async () => {
    const productId = '64f1c2a8b1c2d3e4f5a6b7c8';
    await ProductExplanationCache.create({
      product: productId,
      canonicalProfileHash: 'hash-a',
      explanation: 'cached explanation',
      validationStatus: 'pass',
      status: 'valid',
      productIntelligenceVersion: '0.9.0',
      matchingEngineVersion: '1.0.0',
      explanationPromptVersion: '0.9.0',
    });

    await invalidateExplanationsForProduct(productId, 'product_changed');
    let cache = await ProductExplanationCache.findOne({ product: productId }).lean();
    assert.equal(cache.status, 'stale');

    await ProductExplanationCache.updateOne({ product: productId }, { $set: { status: 'valid', productIntelligenceVersion: '0.9.0' } });
    await invalidateExplanationsForIntelligenceChange(productId);
    cache = await ProductExplanationCache.findOne({ product: productId }).lean();
    assert.equal(cache.status, 'stale');

    await ProductExplanationCache.updateOne({ product: productId }, {
      $set: {
        status: 'valid',
        productIntelligenceVersion: INTELLIGENCE_VERSION,
        matchingEngineVersion: '1.0.0',
      },
    });
    await invalidateExplanationsForMatchingEngineChange();
    cache = await ProductExplanationCache.findOne({ product: productId }).lean();
    assert.equal(cache.status, 'stale');

    await ProductExplanationCache.updateOne({ product: productId }, {
      $set: {
        status: 'valid',
        matchingEngineVersion: MATCHING_ENGINE_VERSION,
        explanationPromptVersion: '0.9.0',
      },
    });
    await invalidateExplanationsForPromptChange();
    cache = await ProductExplanationCache.findOne({ product: productId }).lean();
    assert.equal(cache.status, 'stale');
    assert.notEqual(cache.explanationPromptVersion, EXPLANATION_PROMPT_VERSION);
  });
});
