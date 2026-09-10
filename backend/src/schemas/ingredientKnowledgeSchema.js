import { EVIDENCE_LEVELS, GENERAL_FLAGS, RESEARCH_STATUSES, normalizeCas, normalizeIngredientToken, slugifyIngredientKey } from '../utils/ingredientNormalize.js';

const asString = (value) => (value === null || value === undefined ? '' : String(value).trim());
const asStringOrNull = (value) => {
  const text = asString(value);
  return text || null;
};
const asStringArray = (value) => (Array.isArray(value) ? value.map(asString).filter(Boolean) : []);
const asNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mapSource = (source = {}) => ({
  title: asString(source.title),
  authorsAndYear: asString(source.authorsAndYear || source.authors_and_year),
  journal: asString(source.journal),
  identifier: asString(source.identifier),
  type: asString(source.type),
  finding: asString(source.finding),
  limitations: asString(source.limitations),
  sourceUrl: asString(source.sourceUrl || source.source_url),
  rawCitation: asString(source.rawCitation || source.raw_citation),
});

export const mapJsonIngredientToDocument = (record = {}) => {
  const name = asString(record.name);
  const inciName = asString(record.inci_name || record.inciName);
  const ingredientKey = asString(record.ingredient_key || record.ingredientKey) || slugifyIngredientKey(inciName || name);
  const synonyms = asStringArray(record.synonyms);

  return {
    ingredientKey,
    name,
    inciName,
    synonyms,
    cas: asStringOrNull(record.cas),
    functions: asStringArray(record.functions),
    primaryFunction: asStringOrNull(record.primary_function || record.primaryFunction),
    mechanism: asString(record.mechanism),
    evidenceByConcern: record.evidence_by_concern || record.evidenceByConcern || {},
    skinTypeRelevance: record.skin_type_relevance || record.skinTypeRelevance || {},
    sensitiveSkinAssessment: asString(record.sensitive_skin_assessment || record.sensitiveSkinAssessment),
    irritationSensitization: asString(record.irritation_sensitization || record.irritationSensitization),
    barrierEffects: asString(record.barrier_effects || record.barrierEffects),
    interactionsFormulation: asString(record.interactions_formulation || record.interactionsFormulation),
    specialPopulations: asString(record.special_populations || record.specialPopulations),
    marketingClaimsVsScientificEvidence: asString(record.marketing_claims_vs_scientific_evidence || record.marketingClaimsVsScientificEvidence),
    evidenceLevel: asString(record.evidence_level || record.evidenceLevel).toUpperCase() || null,
    generalFlag: asString(record.general_flag || record.generalFlag) || null,
    confidence: asNumber(record.confidence, null),
    flagReason: asString(record.flag_reason || record.flagReason),
    scientificSummary: asString(record.scientific_summary || record.scientificSummary),
    uncertaintiesResearchGaps: asString(record.uncertainties_research_gaps || record.uncertaintiesResearchGaps),
    sources: Array.isArray(record.sources) ? record.sources.map(mapSource) : [],
    researchStatus: asString(record.research_status || record.researchStatus) || 'verified',
    sourcePages: Array.isArray(record.source_pages || record.sourcePages) ? (record.source_pages || record.sourcePages) : [],
    origin: record.origin || 'seed',
    version: Number(record.version || 1),
  };
};

export const applyNormalizedLookupFields = (doc = {}) => {
  const synonyms = asStringArray(doc.synonyms);
  return {
    ...doc,
    normalizedName: normalizeIngredientToken(doc.name),
    normalizedInciName: normalizeIngredientToken(doc.inciName),
    normalizedSynonyms: synonyms.map(normalizeIngredientToken).filter(Boolean),
    normalizedCas: normalizeCas(doc.cas),
  };
};

export const validateKnowledgeSeedFile = (payload) => {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Knowledge base JSON must be an object.'], ingredients: [] };
  }
  if (!Array.isArray(payload.ingredients)) {
    return { valid: false, errors: ['Knowledge base JSON must contain an ingredients array.'], ingredients: [] };
  }

  const keys = new Set();
  const ingredients = [];
  payload.ingredients.forEach((record, index) => {
    const mapped = mapJsonIngredientToDocument(record);
    if (!mapped.ingredientKey) errors.push(`Record ${index} is missing ingredient_key.`);
    if (!mapped.name) errors.push(`Record ${index} (${mapped.ingredientKey || 'unknown'}) is missing name.`);
    if (!mapped.inciName) errors.push(`Record ${index} (${mapped.ingredientKey || mapped.name || 'unknown'}) is missing inci_name.`);
    if (keys.has(mapped.ingredientKey)) errors.push(`Duplicate ingredient_key: ${mapped.ingredientKey}`);
    keys.add(mapped.ingredientKey);
    ingredients.push(applyNormalizedLookupFields(mapped));
  });

  const expectedCount = Number(payload.ingredient_count);
  if (Number.isFinite(expectedCount) && expectedCount !== ingredients.length) {
    errors.push(`ingredient_count is ${expectedCount} but ingredients array has ${ingredients.length} records.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    ingredients,
    meta: {
      schemaVersion: payload.schema_version || null,
      ingredientCount: ingredients.length,
      sourceDocument: payload.source_document || null,
    },
  };
};

export const validateProposedKnowledge = (payload = {}) => {
  const errors = [];
  const mapped = applyNormalizedLookupFields(mapJsonIngredientToDocument(payload));
  if (!mapped.name) errors.push('name is required.');
  if (!mapped.inciName) errors.push('inciName is required.');
  if (!mapped.ingredientKey) errors.push('ingredientKey is required.');
  if (mapped.evidenceLevel && !EVIDENCE_LEVELS.includes(mapped.evidenceLevel)) {
    errors.push(`evidenceLevel must be one of ${EVIDENCE_LEVELS.join(', ')}.`);
  }
  if (mapped.generalFlag && !GENERAL_FLAGS.includes(mapped.generalFlag)) {
    errors.push(`generalFlag must be one of ${GENERAL_FLAGS.join(', ')}.`);
  }
  if (mapped.confidence !== null && (mapped.confidence < 0 || mapped.confidence > 1)) {
    errors.push('confidence must be between 0 and 1.');
  }
  if (!Array.isArray(mapped.sources)) {
    errors.push('sources must be an array.');
  } else {
    mapped.sources.forEach((source, index) => {
      if (!source.title && !source.identifier && !source.rawCitation) {
        errors.push(`sources[${index}] must include a title, identifier, or raw citation.`);
      }
    });
  }
  if (mapped.researchStatus && !['pending_review', 'verified', 'draft'].includes(mapped.researchStatus)) {
    errors.push('researchStatus for proposed knowledge must be pending_review until admin approval.');
  }
  mapped.researchStatus = 'pending_review';
  return { valid: errors.length === 0, errors, data: mapped };
};

export const INGREDIENT_RESEARCH_GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    ingredientKey: { type: 'string' },
    name: { type: 'string' },
    inciName: { type: 'string' },
    synonyms: { type: 'array', items: { type: 'string' } },
    cas: { type: 'string', nullable: true },
    functions: { type: 'array', items: { type: 'string' } },
    primaryFunction: { type: 'string', nullable: true },
    mechanism: { type: 'string' },
    evidenceByConcern: { type: 'object' },
    skinTypeRelevance: { type: 'object' },
    sensitiveSkinAssessment: { type: 'string' },
    irritationSensitization: { type: 'string' },
    barrierEffects: { type: 'string' },
    interactionsFormulation: { type: 'string' },
    specialPopulations: { type: 'string' },
    marketingClaimsVsScientificEvidence: { type: 'string' },
    evidenceLevel: { type: 'string' },
    generalFlag: { type: 'string' },
    confidence: { type: 'number' },
    flagReason: { type: 'string' },
    scientificSummary: { type: 'string' },
    uncertaintiesResearchGaps: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          authorsAndYear: { type: 'string' },
          journal: { type: 'string' },
          identifier: { type: 'string' },
          type: { type: 'string' },
          finding: { type: 'string' },
          limitations: { type: 'string' },
          sourceUrl: { type: 'string' },
        },
      },
    },
  },
  required: ['name', 'inciName', 'scientificSummary', 'evidenceLevel', 'generalFlag'],
};

export const formatKnowledgeForPrompt = (record = {}) => JSON.stringify({
  ingredientKey: record.ingredientKey,
  name: record.name,
  inciName: record.inciName,
  synonyms: record.synonyms,
  cas: record.cas,
  functions: record.functions,
  primaryFunction: record.primaryFunction,
  mechanism: record.mechanism,
  evidenceByConcern: record.evidenceByConcern,
  skinTypeRelevance: record.skinTypeRelevance,
  sensitiveSkinAssessment: record.sensitiveSkinAssessment,
  irritationSensitization: record.irritationSensitization,
  barrierEffects: record.barrierEffects,
  interactionsFormulation: record.interactionsFormulation,
  specialPopulations: record.specialPopulations,
  marketingClaimsVsScientificEvidence: record.marketingClaimsVsScientificEvidence,
  evidenceLevel: record.evidenceLevel,
  generalFlag: record.generalFlag,
  confidence: record.confidence,
  flagReason: record.flagReason,
  scientificSummary: record.scientificSummary,
  uncertaintiesResearchGaps: record.uncertaintiesResearchGaps,
  sources: record.sources,
}, null, 2);

export default {
  mapJsonIngredientToDocument,
  applyNormalizedLookupFields,
  validateKnowledgeSeedFile,
  validateProposedKnowledge,
  INGREDIENT_RESEARCH_GEMINI_SCHEMA,
  formatKnowledgeForPrompt,
  RESEARCH_STATUSES,
};
