import { scoreProductCompatibility } from './recommendationScoringService.js';
import { MATCHING_ENGINE_VERSION } from '../constants/intelligenceVersions.js';

const HARD_CONFLICT_FACTORS = new Set([
  'confirmed allergy conflict',
  'avoided ingredient conflict',
  'required preference conflict',
]);

/**
 * Evidence is a separate ranking-quality signal.
 *
 * IMPORTANT:
 * evidenceConfidence must NEVER be added to the compatibility
 * score. A product with stronger evidence is not automatically
 * more compatible with a particular user.
 *
 * It is only exposed so the recommendation layer can use it
 * as a deterministic tie-breaker when compatibility is very close.
 */
const normalizeEvidenceConfidence = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(
    1,
    Math.max(0, numeric)
  );
};

/**
 * Convert evidence confidence into a human-readable level.
 *
 * null = evidence is unknown / unavailable.
 */
const getEvidenceLevel = (
  evidenceConfidence
) => {
  if (evidenceConfidence === null) {
    return 'unknown';
  }

  if (evidenceConfidence >= 0.85) {
    return 'high';
  }

  if (evidenceConfidence >= 0.65) {
    return 'medium';
  }

  if (evidenceConfidence >= 0.4) {
    return 'limited';
  }

  return 'low';
};

/**
 * Safely convert a 0-1 intelligence signal to 0-100.
 *
 * UNKNOWN remains null.
 *
 * We deliberately do NOT use 0.5 as a fallback because
 * UNKNOWN is not the same thing as neutral compatibility.
 */
const intelligenceScore = (
  value
) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.round(
    Math.min(
      1,
      Math.max(0, numeric)
    ) * 100
  );
};

/**
 * Deterministic matching engine.
 *
 * Flow:
 *
 * SkinProfile
 *      ↓
 * Hard constraints
 *      ↓
 * Existing deterministic compatibility scorer
 *      ↓
 * Product Intelligence dimensions
 *      ↓
 * Evidence quality
 *      ↓
 * Match result
 *
 * There are NO AI calls here.
 */
export const computeProductMatch = ({
  product,
  skinProfile,
  offerPrice = null,
  currentCategory = null,
}) => {
  /*
   * ---------------------------------------------------------
   * 1. BASE DETERMINISTIC COMPATIBILITY
   * ---------------------------------------------------------
   *
   * Keep the existing scorer for compatibility calculation.
   *
   * Evidence confidence is intentionally NOT passed into
   * this calculation.
   */
  const baseResult =
    scoreProductCompatibility({
      product,
      skinProfile,
      offerPrice: null,
      currentCategory,
    });

  /*
   * ---------------------------------------------------------
   * 2. HARD CONSTRAINTS
   * ---------------------------------------------------------
   */

  const hardConflicts =
    (
      baseResult.concernsNotMatched ||
      []
    ).filter((factor) =>
      HARD_CONFLICT_FACTORS.has(
        factor
      )
    );

  const eligible =
    hardConflicts.length === 0;

  /*
   * ---------------------------------------------------------
   * 3. BUDGET
   *
   * Budget is separate from skin compatibility.
   * ---------------------------------------------------------
   */

  const budget =
    skinProfile?.budget || {
      min: 0,
      max: 5000,
    };

  const priceCap =
    Number(budget.max) || 5000;

  const price =
    offerPrice !== null
      ? Number(offerPrice)
      : null;

  const withinBudget =
    price === null ||
    price <= priceCap;

  const warnings = [];

  if (
    !withinBudget &&
    price !== null
  ) {
    warnings.push({
      factor: 'budget',
      reason:
        `Price (${price}) is outside your stated budget (max ${priceCap}).`,
    });
  }

  /*
   * ---------------------------------------------------------
   * 4. SOFT WARNINGS
   * ---------------------------------------------------------
   */

  (
    baseResult.concernsNotMatched ||
    []
  )
    .filter(
      (factor) =>
        !HARD_CONFLICT_FACTORS.has(
          factor
        )
    )
    .forEach((factor) => {
      warnings.push({
        factor,
        reason:
          `Potential concern: ${factor}`,
      });
    });

  /*
   * ---------------------------------------------------------
   * 5. POSITIVE REASONS
   * ---------------------------------------------------------
   */

  const positiveReasons =
    (
      baseResult.matchedFactors ||
      []
    ).map((reason) => {
      const skinTypeMatch =
        reason.match(
          /(\w+) skin/i
        );

      return {
        factor:
          skinTypeMatch
            ? 'skinType'
            : 'general',

        value:
          skinTypeMatch?.[1] ||
          '',

        reason,
      };
    });

  /*
   * ---------------------------------------------------------
   * 6. PRODUCT INTELLIGENCE
   * ---------------------------------------------------------
   */

  const intelligence =
    product?.productIntelligence ||
    {};

  const profile =
    skinProfile || {};

  /*
   * Evidence confidence is deliberately independent from
   * compatibility.
   */
  const evidenceConfidence =
    normalizeEvidenceConfidence(
      intelligence.evidenceConfidence
    );

  const evidenceLevel =
    getEvidenceLevel(
      evidenceConfidence
    );

  /*
   * ---------------------------------------------------------
   * 7. DIMENSION SCORES
   *
   * Missing intelligence = null.
   *
   * NEVER turn UNKNOWN into 50.
   * ---------------------------------------------------------
   */

  const skinTypeScore =
    intelligenceScore(
      intelligence
        .skinTypeCompatibility
        ?.[
          profile.skinType
        ]
    );

  const sensitivityScore =
    intelligenceScore(
      intelligence
        .sensitivitySuitability
        ?.[
          profile.sensitivity
        ]
    );

  const concernScores =
    Array.isArray(
      profile.concerns
    )
      ? profile.concerns
          .map(
            (concern) =>
              intelligenceScore(
                intelligence
                  .concernCompatibility
                  ?.[
                    concern
                  ]
              )
          )
          .filter(
            (score) =>
              score !== null
          )
      : [];

  const concernScore =
    concernScores.length
      ? Math.round(
          concernScores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) /
            concernScores.length
        )
      : null;

  const dimensionScores = {
    skinType:
      skinTypeScore,

    sensitivity:
      sensitivityScore,

    concerns:
      concernScore,

    primaryGoal:
      computePrimaryGoalScore(
        profile,
        intelligence
      ),

    preferences:
      computePreferencesScore(
        profile,
        product,
        intelligence
      ),
  };

  /*
   * ---------------------------------------------------------
   * 8. OVERALL COMPATIBILITY
   *
   * Evidence does NOT modify this score.
   * ---------------------------------------------------------
   */

  const overallScore =
    eligible
      ? Number(
          baseResult.score
        ) || 0
      : 0;

  /*
   * ---------------------------------------------------------
   * 9. CONFIDENCE
   *
   * IMPORTANT:
   *
   * Do not manufacture 0.5 confidence when evidence is
   * unavailable.
   *
   * UNKNOWN = null.
   *
   * This allows ranking to distinguish:
   *   0.90 = strong evidence
   *   0.50 = medium evidence
   *   null = unknown
   * ---------------------------------------------------------
   */

  const confidence =
    evidenceConfidence;

  /*
   * ---------------------------------------------------------
   * 10. RETURN MATCH RESULT
   * ---------------------------------------------------------
   */

  return {
    eligible,

    overallScore,

    skinCompatibilityScore:
      overallScore,

    dimensionScores,

    positiveReasons,

    warnings,

    hardConflicts:
      hardConflicts.map(
        (factor) => ({
          factor,
          reason: factor,
        })
      ),

    /*
     * Evidence is exposed explicitly.
     *
     * The recommendation layer uses this only for
     * close-score ranking.
     */
    evidenceConfidence,

    evidenceLevel,

    confidence,

    withinBudget,

    budgetConstraint:
      withinBudget
        ? null
        : {
            max: priceCap,
            actual: price,
          },

    matchedFactors:
      baseResult.matchedFactors ||
      [],

    concernsMatched:
      baseResult.concernsMatched ||
      [],

    concernsNotMatched:
      baseResult.concernsNotMatched ||
      [],

    explanation:
      baseResult.explanation,

    matchingEngineVersion:
      MATCHING_ENGINE_VERSION,
  };
};

/**
 * Primary goal → Product Intelligence concern mapping.
 */
const computePrimaryGoalScore = (
  profile,
  intelligence
) => {
  const goalConcerns = {
    'clearer-skin': [
      'acne',
    ],

    'brighter-even': [
      'pigmentation',
      'dark-spots',
    ],

    hydration: [
      'dryness',
      'dehydration',
    ],

    'anti-aging': [
      'aging',
      'fine-lines',
    ],
  };

  const keys =
    goalConcerns[
      profile.primaryGoal
    ] || [];

  if (!keys.length) {
    return null;
  }

  const scores =
    keys
      .map(
        (key) =>
          intelligenceScore(
            intelligence
              .concernCompatibility
              ?.[
                key
              ]
          )
      )
      .filter(
        (score) =>
          score !== null
      );

  if (!scores.length) {
    return null;
  }

  return Math.round(
    scores.reduce(
      (sum, score) =>
        sum + score,
      0
    ) / scores.length
  );
};

/**
 * Must-have preferences.
 *
 * This remains a dimension signal.
 *
 * Actual hard eligibility is handled by the matching
 * engine's hard-conflict logic.
 */
const computePreferencesScore = (
  profile,
  product,
  intelligence
) => {
  const prefs =
    (
      profile.mustHavePreferences ||
      []
    ).filter(
      (preference) =>
        preference !==
        'no-specific-preference'
    );

  if (!prefs.length) {
    return 100;
  }

  const attrs =
    intelligence.mustHaveAttributes ||
    {};

  const checks = {
    'fragrance-free':
      product.fragranceFree ??
      attrs['fragrance-free'] ??
      null,

    vegan:
      attrs.vegan ??
      null,

    'cruelty-free':
      attrs['cruelty-free'] ??
      attrs.crueltyFree ??
      null,

    'reef-safe':
      attrs['reef-safe'] ??
      attrs.reefSafe ??
      null,
  };

  const knownChecks =
    prefs
      .map(
        (preference) =>
          checks[
            preference
          ]
      )
      .filter(
        (value) =>
          value !== null &&
          value !== undefined
      );

  if (!knownChecks.length) {
    return null;
  }

  const met =
    knownChecks.filter(
      (value) =>
        value === true
    ).length;

  return Math.round(
    (met /
      knownChecks.length) *
      100
  );
};

export default
  computeProductMatch;