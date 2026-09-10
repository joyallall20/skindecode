import ProductExplanationCache from '../models/ProductExplanationCache.js';
import {
  INTELLIGENCE_VERSION,
  KNOWLEDGE_BASE_VERSION,
  MATCHING_ENGINE_VERSION,
  EXPLANATION_PROMPT_VERSION,
} from '../constants/intelligenceVersions.js';
import { buildCanonicalProfile, computeCanonicalProfileHash } from './profileCanonicalizationService.js';
import { computeProductMatch } from './matchingEngineService.js';
import { generateGroqText } from './groqService.js';
import { validateExplanation } from './explanationValidationService.js';

const VERSION_SET = {
  productIntelligenceVersion: INTELLIGENCE_VERSION,
  researchKnowledgeVersion: KNOWLEDGE_BASE_VERSION,
  matchingEngineVersion: MATCHING_ENGINE_VERSION,
  explanationPromptVersion: EXPLANATION_PROMPT_VERSION,
};

const EXPLANATION_SYSTEM_PROMPT = [
  'You write personalized skincare product explanations for users.',
  'Base your explanation ONLY on the provided match result, product intelligence, and skin profile.',
  'Do not invent product benefits or medical claims.',
  'If the product is not eligible, explain why clearly.',
  'If there are warnings, include them.',
  'Keep the explanation concise (2-4 sentences).',
].join(' ');

const buildExplanationPrompt = ({ matchResult, product, skinProfile }) =>
  JSON.stringify({
    profile: {
      skinType: skinProfile.skinType,
      sensitivity: skinProfile.sensitivity,
      concerns: skinProfile.concerns,
      primaryGoal: skinProfile.primaryGoal,
      allergies: skinProfile.allergies,
    },
    product: { name: product.name, brand: product.brand?.name },
    matchResult: {
      eligible: matchResult.eligible,
      overallScore: matchResult.overallScore,
      skinCompatibilityScore: matchResult.skinCompatibilityScore,
      positiveReasons: matchResult.positiveReasons,
      warnings: matchResult.warnings,
      hardConflicts: matchResult.hardConflicts,
      withinBudget: matchResult.withinBudget,
    },
    intelligenceSummary: product.productIntelligence?.explanation?.slice(0, 300),
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get or generate a cached personalized explanation for Product × Canonical Profile.
 * Handles concurrent requests via generation lock.
 */
export const getOrGenerateExplanation = async ({ product, skinProfile, offerPrice = null }) => {
  const canonicalProfile = buildCanonicalProfile(skinProfile);
  const canonicalProfileHash = computeCanonicalProfileHash(skinProfile);
  const productId = product._id;

  const cacheQuery = { product: productId, canonicalProfileHash, ...VERSION_SET, status: 'valid' };

  const existing = await ProductExplanationCache.findOne(cacheQuery).lean();
  if (existing?.explanation && existing.validationStatus !== 'generating') {
    console.info('[explanation-cache] HIT', { productId, hash: canonicalProfileHash });
    return { cacheHit: true, explanation: existing, matchResult: existing.matchResult };
  }

  // Attempt to acquire generation lock
  const lockId = `lock-${Date.now()}`;
  const lockResult = await ProductExplanationCache.findOneAndUpdate(
    {
      product: productId,
      canonicalProfileHash,
      ...VERSION_SET,
      $or: [
        { validationStatus: { $ne: 'generating' } },
        { 'generationLock.lockedAt': { $lt: new Date(Date.now() - 60000) } },
      ],
    },
    {
      $set: {
        validationStatus: 'generating',
        generationLock: { lockedAt: new Date(), lockedBy: lockId },
        canonicalProfile,
        status: 'valid',
      },
      $setOnInsert: { product: productId, canonicalProfileHash, ...VERSION_SET },
    },
    { upsert: true, returnDocument: 'after' }
  );

  if (lockResult?.generationLock?.lockedBy !== lockId) {
    // Another process is generating — wait and recheck
    console.info('[explanation-cache] WAIT for in-progress generation', { productId, hash: canonicalProfileHash });
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      const recheck = await ProductExplanationCache.findOne({
        product: productId,
        canonicalProfileHash,
        ...VERSION_SET,
        validationStatus: { $in: ['pass', 'flag'] },
        status: 'valid',
      }).lean();
      if (recheck?.explanation) {
        return { cacheHit: true, explanation: recheck, matchResult: recheck.matchResult };
      }
    }

    // Lock may have expired — recheck cache before generating
    const postWaitCache = await ProductExplanationCache.findOne(cacheQuery).lean();
    if (postWaitCache?.explanation && postWaitCache.validationStatus !== 'generating') {
      return { cacheHit: true, explanation: postWaitCache, matchResult: postWaitCache.matchResult };
    }
  } else {
    // We hold the lock — another request may have finished just before lock acquisition
    const preGenerateCache = await ProductExplanationCache.findOne({
      product: productId,
      canonicalProfileHash,
      ...VERSION_SET,
      validationStatus: { $in: ['pass', 'flag'] },
      status: 'valid',
    }).lean();
    if (preGenerateCache?.explanation) {
      await ProductExplanationCache.updateOne(
        { _id: preGenerateCache._id },
        { $set: { generationLock: { lockedAt: null, lockedBy: null } } }
      );
      return { cacheHit: true, explanation: preGenerateCache, matchResult: preGenerateCache.matchResult };
    }
  }

  console.info('[explanation-cache] MISS — generating', { productId, hash: canonicalProfileHash });

  const matchResult = computeProductMatch({ product, skinProfile, offerPrice });

  const groqResult = await generateGroqText({
    systemPrompt: EXPLANATION_SYSTEM_PROMPT,
    prompt: `Write a personalized explanation:\n${buildExplanationPrompt({ matchResult, product, skinProfile })}`,
    modelKey: 'explanation',
    temperature: 0.3,
  });

  const explanationText = groqResult.success
    ? groqResult.text
    : matchResult.explanation;

  const validation = await validateExplanation({
    skinProfile,
    productIntelligence: product.productIntelligence,
    matchResult,
    explanation: explanationText,
  });

  const cacheDoc = {
    explanation: explanationText,
    positiveReasons: matchResult.positiveReasons,
    warnings: matchResult.warnings,
    compatibilitySummary: {
      eligible: matchResult.eligible,
      overallScore: matchResult.overallScore,
      skinCompatibilityScore: matchResult.skinCompatibilityScore,
      withinBudget: matchResult.withinBudget,
    },
    matchResult,
    model: groqResult.model || 'fallback',
    modelVersion: groqResult.model || '',
    generatedAt: new Date(),
    lastValidatedAt: new Date(),
    validationStatus: validation.status === 'reject' ? 'flag' : validation.status,
    validationNotes: (validation.issues || []).join('; '),
    status: 'valid',
    generationLock: { lockedAt: null, lockedBy: null },
  };

  const saved = await ProductExplanationCache.findOneAndUpdate(
    { product: productId, canonicalProfileHash, ...VERSION_SET },
    { $set: cacheDoc, canonicalProfile },
    { returnDocument: 'after', upsert: true }
  );

  console.info('[explanation-cache] SAVED', { productId, hash: canonicalProfileHash, validation: validation.status });
  return { cacheHit: false, explanation: saved, matchResult, validation };
};

export default { getOrGenerateExplanation };
