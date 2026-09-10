import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import IngredientKnowledge from '../models/IngredientKnowledge.js';
import IngredientResearch from '../models/IngredientResearch.js';
import { KNOWLEDGE_BASE_VERSION } from '../constants/intelligenceVersions.js';
import {
  formatKnowledgeForPrompt,
  validateKnowledgeSeedFile,
} from '../schemas/ingredientKnowledgeSchema.js';
import {
  normalizeCas,
  normalizeIngredientToken,
} from '../utils/ingredientNormalize.js';

// Only verified + active records are considered production knowledge.
// Unknown or unverified ingredients must never be passed as verified knowledge.
// Normalization is used only for matching; stored ingredient names are not changed.

export const PRODUCTION_RESEARCH_STATUSES = new Set(['verified']);

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_KNOWLEDGE_JSON_PATH = path.resolve(
  serviceDir,
  '../IntelReport/kincare-ingredient-knowledge-base.json'
);

export const isProductionEligibleKnowledge = (record) =>
  Boolean(record && PRODUCTION_RESEARCH_STATUSES.has(record.researchStatus) && record.isActive !== false);

export const getVerifiedKnowledgeForIngredients = async (ingredientIds = []) => {
  if (!ingredientIds.length) return [];

  const records = await IngredientKnowledge.find({
    ingredient: { $in: ingredientIds },
    researchStatus: 'verified',
    isActive: { $ne: false },
  }).lean();

  return records.filter(isProductionEligibleKnowledge);
};

export const formatVerifiedKnowledgeContext = (records = []) => {
  if (!records.length) return '';
  // Deduplicate by ingredientKey so duplicate aliases don't inflate the Gemini prompt.
  const seen = new Set();
  const unique = records.filter((record) => {
    const key = record.ingredientKey || String(record._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.map((record) => formatKnowledgeForPrompt(record)).join('\n\n');
};

export const loadKnowledgeSeedFile = async (filePath = DEFAULT_KNOWLEDGE_JSON_PATH) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const payload = JSON.parse(raw);
  const validated = validateKnowledgeSeedFile(payload);
  console.info('[knowledge] loaded seed JSON', {
    path: filePath,
    count: validated.ingredients.length,
    valid: validated.valid,
  });
  return validated;
};

export const importIngredientKnowledgeFromJson = async ({
  filePath = DEFAULT_KNOWLEDGE_JSON_PATH,
  overwrite = false,
} = {}) => {
  const validated = await loadKnowledgeSeedFile(filePath);
  if (!validated.valid) {
    const error = new Error(`Knowledge base JSON is invalid: ${validated.errors.join('; ')}`);
    error.details = validated.errors;
    throw error;
  }

  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const ingredient of validated.ingredients) {
    const existing = await IngredientKnowledge.findOne({ ingredientKey: ingredient.ingredientKey });
    if (existing && !overwrite) {
      skipped += 1;
      continue;
    }

    const payload = {
      ...ingredient,
      origin: 'seed',
      researchStatus: ingredient.researchStatus || 'verified',
      knowledgeBaseVersion: validated.meta.schemaVersion || KNOWLEDGE_BASE_VERSION,
      isActive: true,
    };

    if (existing && overwrite) {
      Object.assign(existing, payload);
      await existing.save();
      updated += 1;
    } else {
      await IngredientKnowledge.create(payload);
      inserted += 1;
    }
  }

  console.info('[knowledge] import completed', { inserted, skipped, updated, total: validated.ingredients.length });
  return {
    inserted,
    skipped,
    updated,
    total: validated.ingredients.length,
    errors: validated.errors,
    meta: validated.meta,
  };
};

export const seedIngredientKnowledgeIfEmpty = async () => {
  const count = await IngredientKnowledge.countDocuments({ ingredientKey: { $exists: true, $ne: '' } });
  if (count > 0) {
    console.info('[knowledge] seed skipped; MongoDB already has records', { count });
    return { seeded: false, count };
  }
  const result = await importIngredientKnowledgeFromJson();
  return { seeded: true, ...result };
};

export const getAllIngredients = async ({ status, search, limit = 100 } = {}) => {
  const query = {};
  if (status) query.researchStatus = status;
  if (search) {
    const token = normalizeIngredientToken(search);
    query.$or = [
      { ingredientKey: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { inciName: { $regex: search, $options: 'i' } },
      { synonyms: { $regex: search, $options: 'i' } },
      { normalizedName: token },
      { normalizedInciName: token },
      { normalizedSynonyms: token },
    ];
  }
  return IngredientKnowledge.find(query).sort({ name: 1 }).limit(Number(limit)).lean();
};

export const getIngredientByKey = (ingredientKey) =>
  IngredientKnowledge.findOne({ ingredientKey }).lean();

export const getIngredientByINCI = (inciName) =>
  IngredientKnowledge.findOne({ normalizedInciName: normalizeIngredientToken(inciName) }).lean();

export const getIngredientByCAS = (cas) =>
  IngredientKnowledge.findOne({ normalizedCas: normalizeCas(cas) }).lean();

export const findIngredient = async (query) => {
  const raw = String(query || '').trim();
  if (!raw) return null;

  const token = normalizeIngredientToken(raw);
  const cas = normalizeCas(raw);

  const buildOrConditions = () => {
    const conditions = [
      { ingredientKey: raw },
      { ingredientKey: token.replace(/\s+/g, '_') },
      { normalizedName: token },
      { normalizedInciName: token },
      { normalizedSynonyms: token },
    ];
    if (cas && /\d+-\d+-\d+/.test(cas)) {
      conditions.push({ normalizedCas: cas });
    }
    return conditions;
  };

  // Prefer production-eligible records (verified + active).
  const verified = await IngredientKnowledge.findOne({
    $or: buildOrConditions(),
    researchStatus: 'verified',
    isActive: { $ne: false },
  }).lean();

  if (verified) return verified;

  // Fall back to any matching record so callers can classify it as unknown/unverified.
  return IngredientKnowledge.findOne({
    $or: buildOrConditions(),
  }).lean();
};

export const findIngredients = async (queries = []) => {
  const unique = [...new Set((queries || []).map((entry) => String(entry || '').trim()).filter(Boolean))];
  const results = [];
  for (const query of unique) {
    results.push({ query, record: await findIngredient(query) });
  }
  return results;
};

export const getKnowledgeForIngredients = async (names = []) => {
  const lookups = await findIngredients(names);
  const known = [];
  const unknown = [];

  lookups.forEach(({ query, record }) => {
    if (record && isProductionEligibleKnowledge(record)) {
      known.push({ query, record });
    } else if (record) {
      unknown.push({
        query,
        normalizedName: normalizeIngredientToken(query),
        reason: `Knowledge exists but status is ${record.researchStatus}, not verified.`,
        record,
      });
    } else {
      unknown.push({
        query,
        normalizedName: normalizeIngredientToken(query),
        reason: 'No verified knowledge match.',
        record: null,
      });
    }
  });

  return {
    known,
    unknown,
    total: lookups.length,
    matched: known.length,
    unmatched: unknown.length,
  };
};

export const recordUnknownIngredients = async (names = [], productId = null) => {
  const created = [];
  for (const name of names) {
    const normalizedName = normalizeIngredientToken(name);
    if (!normalizedName) continue;
    const existing = await IngredientResearch.findOne({
      normalizedName,
      status: { $in: ['research_needed', 'researching', 'pending_review', 'failed'] },
    });
    if (existing) {
      existing.lastDetectedAt = new Date();
      if (productId && !existing.productIds.some((id) => String(id) === String(productId))) {
        existing.productIds.push(productId);
      }
      await existing.save();
      created.push(existing);
      continue;
    }

    const queued = await IngredientResearch.create({
      ingredientName: String(name).trim(),
      normalizedName,
      status: 'research_needed',
      productIds: productId ? [productId] : [],
      firstDetectedAt: new Date(),
      lastDetectedAt: new Date(),
    });
    console.info('[knowledge] unknown ingredient queued', { name, normalizedName, productId });
    created.push(queued);
  }
  return created;
};

export const buildIngredientCoverage = async (
  ingredientNames = [],
  productId = null,
  { recordUnknown = false } = {}
) => {
  const coverage = await getKnowledgeForIngredients(ingredientNames);
  if (recordUnknown && coverage.unknown.length && productId) {
    await recordUnknownIngredients(coverage.unknown.map((entry) => entry.query), productId);
  }
  return {
    total: coverage.total,
    matched: coverage.matched,
    unmatched: coverage.unmatched,
    known: coverage.known.map(({ query, record }) => ({
      query,
      ingredientKey: record.ingredientKey,
      name: record.name,
      inciName: record.inciName,
      researchStatus: record.researchStatus,
      evidenceLevel: record.evidenceLevel,
      generalFlag: record.generalFlag,
      matched: true,
    })),
    unknown: coverage.unknown.map((entry) => ({
      query: entry.query,
      normalizedName: entry.normalizedName,
      researchStatus: entry.record?.researchStatus || 'research_needed',
      evidenceLevel: null,
      generalFlag: null,
      matched: false,
      reason: entry.reason,
    })),
  };
};

export default {
  PRODUCTION_RESEARCH_STATUSES,
  isProductionEligibleKnowledge,
  getVerifiedKnowledgeForIngredients,
  formatVerifiedKnowledgeContext,
  loadKnowledgeSeedFile,
  importIngredientKnowledgeFromJson,
  seedIngredientKnowledgeIfEmpty,
  getAllIngredients,
  getIngredientByKey,
  getIngredientByINCI,
  getIngredientByCAS,
  findIngredient,
  findIngredients,
  getKnowledgeForIngredients,
  recordUnknownIngredients,
  buildIngredientCoverage,
  DEFAULT_KNOWLEDGE_JSON_PATH,
};