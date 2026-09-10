import { scoreProductCompatibility } from './recommendationScoringService.js';
import { MATCHING_ENGINE_VERSION } from '../constants/intelligenceVersions.js';

const HARD_CONFLICT_FACTORS = new Set([
  'confirmed allergy conflict',
  'avoided ingredient conflict',
  'required preference conflict',
]);

/**
 * Deterministic matching engine v2.
 * Separates eligibility, skin compatibility, and budget constraints.
 */
export const computeProductMatch = ({
  product,
  skinProfile,
  offerPrice = null,
  currentCategory = null,
}) => {
  // Score WITHOUT budget influence on skin compatibility
  const baseResult = scoreProductCompatibility({
    product,
    skinProfile,
    offerPrice: null,
    currentCategory,
  });

  const hardConflicts = (baseResult.concernsNotMatched || []).filter((f) =>
    HARD_CONFLICT_FACTORS.has(f)
  );

  const eligible = hardConflicts.length === 0;

  // Budget is a separate constraint — not part of skin compatibility
  const budget = skinProfile?.budget || { min: 0, max: 5000 };
  const priceCap = Number(budget.max) || 5000;
  const price = offerPrice !== null ? Number(offerPrice) : null;
  const withinBudget = price === null || price <= priceCap;

  const warnings = [];
  if (!withinBudget && price !== null) {
    warnings.push({
      factor: 'budget',
      reason: `Price (${price}) is outside your stated budget (max ${priceCap}).`,
    });
  }

  // Extract soft warnings from concernsNotMatched (non-hard)
  (baseResult.concernsNotMatched || [])
    .filter((f) => !HARD_CONFLICT_FACTORS.has(f))
    .forEach((factor) => {
      warnings.push({ factor, reason: `Potential concern: ${factor}` });
    });

  const positiveReasons = (baseResult.matchedFactors || []).map((reason) => {
    const skinTypeMatch = reason.match(/(\w+) skin/i);
    return {
      factor: skinTypeMatch ? 'skinType' : 'general',
      value: skinTypeMatch?.[1] || '',
      reason,
    };
  });

  // Dimension scores derived from intelligence where available
  const intelligence = product?.productIntelligence || {};
  const profile = skinProfile || {};

  const dimensionScores = {
    skinType: Math.round((intelligence.skinTypeCompatibility?.[profile.skinType] ?? 0.5) * 100),
    sensitivity: Math.round((intelligence.sensitivitySuitability?.[profile.sensitivity] ?? 0.5) * 100),
    concerns: Math.round(
      (baseResult.concernsMatched?.length
        ? baseResult.concernsMatched.length / Math.max((profile.concerns || []).length, 1)
        : 0.5) * 100
    ),
    primaryGoal: computePrimaryGoalScore(profile, intelligence),
    preferences: computePreferencesScore(profile, product, intelligence),
  };

  const overallScore = eligible ? baseResult.score : 0;

  const confidence = Math.min(
    1,
    Math.max(0, (intelligence.evidenceConfidence ?? 0.5) * (eligible ? 1 : 0.3))
  );

  return {
    eligible,
    overallScore,
    skinCompatibilityScore: baseResult.score,
    dimensionScores,
    positiveReasons,
    warnings,
    hardConflicts: hardConflicts.map((f) => ({ factor: f, reason: f })),
    confidence,
    withinBudget,
    budgetConstraint: withinBudget ? null : { max: priceCap, actual: price },
    matchedFactors: baseResult.matchedFactors,
    concernsMatched: baseResult.concernsMatched,
    concernsNotMatched: baseResult.concernsNotMatched,
    explanation: baseResult.explanation,
    matchingEngineVersion: MATCHING_ENGINE_VERSION,
  };
};

const computePrimaryGoalScore = (profile, intelligence) => {
  const goalConcerns = {
    'clearer-skin': ['acne'],
    'brighter-even': ['pigmentation', 'dark-spots'],
    hydration: ['dryness', 'dehydration'],
    'anti-aging': ['aging', 'fine-lines'],
  };
  const keys = goalConcerns[profile.primaryGoal] || [];
  if (!keys.length) return 50;
  const compat = intelligence.concernCompatibility || {};
  const scores = keys.map((k) => compat[k] ?? 0.5);
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
};

const computePreferencesScore = (profile, product, intelligence) => {
  const prefs = (profile.mustHavePreferences || []).filter((p) => p !== 'no-specific-preference');
  if (!prefs.length) return 100;
  const attrs = intelligence.mustHaveAttributes || {};
  const checks = {
    'fragrance-free': product.fragranceFree ?? attrs['fragrance-free'],
    vegan: attrs.vegan,
    'cruelty-free': attrs['cruelty-free'] ?? attrs.crueltyFree,
    'reef-safe': attrs['reef-safe'] ?? attrs.reefSafe,
  };
  const met = prefs.filter((p) => checks[p] === true).length;
  return Math.round((met / prefs.length) * 100);
};

export default computeProductMatch;
