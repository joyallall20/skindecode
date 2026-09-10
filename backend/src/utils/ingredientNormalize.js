export const EVIDENCE_LEVELS = ['A', 'B', 'C', 'D', 'E'];
export const GENERAL_FLAGS = ['Green', 'Light Green', 'Yellow', 'Orange', 'Red'];
export const RESEARCH_STATUSES = [
  'research_needed',
  'researching',
  'draft',
  'pending_review',
  'verified',
  'rejected',
  'failed',
];

export const normalizeIngredientToken = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const normalizeCas = (value) =>
  String(value || '')
    .replace(/cas\s*no\.?:?/i, '')
    .replace(/[^0-9-]/g, '')
    .trim();

export const slugifyIngredientKey = (value) =>
  normalizeIngredientToken(value).replace(/\s+/g, '_') || `ingredient_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const collectLookupTokens = (record = {}) => {
  const tokens = [
    record.ingredientKey,
    record.name,
    record.inciName,
    record.normalizedName,
    record.normalizedInciName,
    ...(record.synonyms || []),
    ...(record.normalizedSynonyms || []),
  ]
    .map(normalizeIngredientToken)
    .filter(Boolean);
  return [...new Set(tokens)];
};

export default {
  EVIDENCE_LEVELS,
  GENERAL_FLAGS,
  RESEARCH_STATUSES,
  normalizeIngredientToken,
  normalizeCas,
  slugifyIngredientKey,
  collectLookupTokens,
};
