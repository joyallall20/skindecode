const SKIN_TYPES = ['oily', 'dry', 'combination', 'normal', 'sensitive'];
const SENSITIVITY_LEVELS = ['low', 'medium', 'high'];
const EVIDENCE_LEVELS = ['known', 'likely', 'evidence-backed', 'unknown'];
const RATING_BASIS_DISCLAIMER =
  'Rating is based on the ingredients and product information provided by the brand.';

export const PRODUCT_INTELLIGENCE_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    skinTypeCompatibility: {
      type: 'object',
      properties: {
        oily: { type: 'number' },
        dry: { type: 'number' },
        combination: { type: 'number' },
        normal: { type: 'number' },
        sensitive: { type: 'number' },
      },
    },
    sensitivitySuitability: {
      type: 'object',
      properties: {
        low: { type: 'number' },
        medium: { type: 'number' },
        high: { type: 'number' },
      },
    },
    concernCompatibility: {
      type: 'object',
    },
    ingredientAnalysis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ingredient: { type: 'string' },
          benefits: {
            type: 'array',
            items: { type: 'string' },
          },
          relevantConcerns: {
            type: 'array',
            items: { type: 'string' },
          },
          potentialSensitivityConcern: { type: 'string' },
          explanation: { type: 'string' },
          evidenceLevel: { type: 'string' },
        },
        required: ['ingredient', 'benefits', 'explanation', 'evidenceLevel'],
      },
    },
    ingredientConflicts: {
      type: 'array',
      items: { type: 'string' },
    },
    avoidanceSignals: {
      type: 'object',
    },
    mustHaveAttributes: {
      type: 'object',
    },
    hydrationProfile: { type: 'string' },
    oilControlProfile: { type: 'string' },
    qualityAssessment: {
      type: 'object',
      properties: {
        formulationSignals: {
          type: 'array',
          items: { type: 'string' },
        },
        transparencyNotes: { type: 'string' },
        limitations: {
          type: 'array',
          items: { type: 'string' },
        },
        ratingBasis: { type: 'string' },
      },
      required: ['formulationSignals', 'transparencyNotes', 'limitations', 'ratingBasis'],
    },
    evidenceConfidence: { type: 'number' },
    explanation: { type: 'string' },
  },
  required: [
    'skinTypeCompatibility',
    'sensitivitySuitability',
    'concernCompatibility',
    'ingredientAnalysis',
    'ingredientConflicts',
    'avoidanceSignals',
    'mustHaveAttributes',
    'hydrationProfile',
    'oilControlProfile',
    'qualityAssessment',
    'evidenceConfidence',
    'explanation',
  ],
};

const clampScore = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(1, numericValue));
};

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitizeString(entry)).filter(Boolean);
};

const sanitizeScoreMap = (value, allowedKeys) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return allowedKeys.reduce((accumulator, key) => {
    accumulator[key] = clampScore(source[key]);
    return accumulator;
  }, {});
};

const sanitizeConcernCompatibility = (value) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.entries(source).reduce((accumulator, [key, score]) => {
    const safeKey = sanitizeString(key);
    if (!safeKey) return accumulator;
    accumulator[safeKey] = clampScore(score);
    return accumulator;
  }, {});
};

const sanitizeIngredientAnalysis = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const ingredient = sanitizeString(entry?.ingredient);
      if (!ingredient) return null;

      const evidenceLevel = sanitizeString(entry?.evidenceLevel).toLowerCase();
      const safeEvidenceLevel = EVIDENCE_LEVELS.includes(evidenceLevel) ? evidenceLevel : 'unknown';

      return {
        ingredient,
        benefits: sanitizeStringArray(entry?.benefits),
        relevantConcerns: sanitizeStringArray(entry?.relevantConcerns),
        potentialSensitivityConcern: sanitizeString(entry?.potentialSensitivityConcern),
        explanation: sanitizeString(entry?.explanation),
        evidenceLevel: safeEvidenceLevel,
      };
    })
    .filter(Boolean);
};

export const normalizeProductIntelligence = (payload = {}) => {
  const qualityAssessment = payload.qualityAssessment && typeof payload.qualityAssessment === 'object'
    ? payload.qualityAssessment
    : {};

  return {
    skinTypeCompatibility: sanitizeScoreMap(payload.skinTypeCompatibility, SKIN_TYPES),
    sensitivitySuitability: sanitizeScoreMap(payload.sensitivitySuitability, SENSITIVITY_LEVELS),
    concernCompatibility: sanitizeConcernCompatibility(payload.concernCompatibility),
    ingredientAnalysis: sanitizeIngredientAnalysis(payload.ingredientAnalysis),
    ingredientConflicts: sanitizeStringArray(payload.ingredientConflicts),
    avoidanceSignals: Object.entries(payload.avoidanceSignals || {}).reduce((accumulator, [key, value]) => {
      const safeKey = sanitizeString(key);
      if (!safeKey) return accumulator;
      accumulator[safeKey] = sanitizeString(value);
      return accumulator;
    }, {}),
    mustHaveAttributes: Object.entries(payload.mustHaveAttributes || {}).reduce((accumulator, [key, value]) => {
      const safeKey = sanitizeString(key);
      if (!safeKey) return accumulator;
      accumulator[safeKey] = Boolean(value);
      return accumulator;
    }, {}),
    hydrationProfile: sanitizeString(payload.hydrationProfile) || null,
    oilControlProfile: sanitizeString(payload.oilControlProfile) || null,
    qualityAssessment: {
      formulationSignals: sanitizeStringArray(qualityAssessment.formulationSignals),
      transparencyNotes: sanitizeString(qualityAssessment.transparencyNotes),
      limitations: sanitizeStringArray(qualityAssessment.limitations),
      ratingBasis: sanitizeString(qualityAssessment.ratingBasis) || RATING_BASIS_DISCLAIMER,
    },
    evidenceConfidence: clampScore(payload.evidenceConfidence),
    explanation: sanitizeString(payload.explanation),
  };
};

export const validateProductIntelligence = (payload) => {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Product intelligence must be an object.'];
  }

  if (!Array.isArray(payload.ingredientAnalysis) || payload.ingredientAnalysis.length === 0) {
    errors.push('At least one ingredient analysis entry is required.');
  }

  if (!payload.qualityAssessment || typeof payload.qualityAssessment !== 'object') {
    errors.push('qualityAssessment is required.');
  } else if (!sanitizeString(payload.qualityAssessment.ratingBasis)) {
    errors.push('qualityAssessment.ratingBasis is required.');
  }

  if (!sanitizeString(payload.explanation)) {
    errors.push('An overall explanation is required.');
  }

  if (!Number.isFinite(Number(payload.evidenceConfidence))) {
    errors.push('evidenceConfidence must be a number between 0 and 1.');
  }

  return errors;
};

export { RATING_BASIS_DISCLAIMER };

export default {
  PRODUCT_INTELLIGENCE_GEMINI_SCHEMA,
  normalizeProductIntelligence,
  validateProductIntelligence,
  RATING_BASIS_DISCLAIMER,
};
