import crypto from 'crypto';

const PROFILE_FIELDS = [
  'skinType',
  'sensitivity',
  'morningSkinFeel',
  'responseToNewProducts',
  'sunscreenHabit',
  'ageRange',
  'primaryGoal',
];

const SORTED_ARRAY_FIELDS = ['concerns', 'currentProducts', 'mustHavePreferences'];

const normalizeEnum = (value) => {
  const v = String(value || 'unknown').toLowerCase().trim();
  return v || 'unknown';
};

const normalizeStringArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean))].sort();
};

const normalizeAllergies = (profile = {}) => {
  const terms = [];
  (profile.allergies || []).forEach((a) => {
    const n = String(a).toLowerCase().trim();
    if (n) terms.push(n);
  });
  return [...new Set(terms)].sort();
};

const normalizeAvoidedIngredients = (profile = {}) => {
  const terms = [];
  (profile.avoidedIngredients || []).forEach((entry) => {
    if (typeof entry === 'string') {
      const n = entry.toLowerCase().trim();
      if (n) terms.push(n);
    } else if (entry?.name) {
      terms.push(entry.name.toLowerCase().trim());
      (entry.aliases || []).forEach((a) => terms.push(String(a).toLowerCase().trim()));
    }
  });
  const raw = profile.onboardingAnswers?.avoidedIngredients || [];
  raw.forEach((a) => {
    const n = String(a).toLowerCase().trim();
    if (n) terms.push(n);
  });
  const other = String(profile.onboardingAnswers?.avoidedIngredientsOther || '').toLowerCase().trim();
  if (other) terms.push(other);
  return [...new Set(terms.filter(Boolean))].sort();
};

const normalizeBudget = (profile = {}) => {
  const budget = profile.budget || {};
  const min = Number.isFinite(Number(budget.min)) ? Number(budget.min) : 0;
  const max = Number.isFinite(Number(budget.max)) ? Number(budget.max) : 5000;
  return { min, max };
};

/**
 * Build a canonical profile object containing only fields that affect matching/explanation.
 * Excludes: userId, timestamps, preferredProductCategories, questionnaireCompleted.
 */
export const buildCanonicalProfile = (skinProfile = {}) => {
  const canonical = {};

  PROFILE_FIELDS.forEach((field) => {
    canonical[field] = normalizeEnum(skinProfile[field]);
  });

  SORTED_ARRAY_FIELDS.forEach((field) => {
    canonical[field] = normalizeStringArray(skinProfile[field]);
  });

  canonical.allergies = normalizeAllergies(skinProfile);
  canonical.avoidedIngredients = normalizeAvoidedIngredients(skinProfile);
  canonical.budget = normalizeBudget(skinProfile);

  return canonical;
};

/** Explicit list of explanation-relevant profile fields (for cache invalidation docs/tests). */
export const EXPLANATION_RELEVANT_PROFILE_FIELDS = [
  ...PROFILE_FIELDS,
  ...SORTED_ARRAY_FIELDS,
  'allergies',
  'avoidedIngredients',
  'budget',
];

export const computeCanonicalProfileHash = (skinProfile = {}) => {
  const canonical = buildCanonicalProfile(skinProfile);
  const serialized = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 32);
};

export default { buildCanonicalProfile, computeCanonicalProfileHash };
