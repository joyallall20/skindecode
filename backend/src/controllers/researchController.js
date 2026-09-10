import mongoose from 'mongoose';
import Ingredient from '../models/Ingredient.js';
import Evidence from '../models/Evidence.js';
import IngredientKnowledge from '../models/IngredientKnowledge.js';
import IngredientResearch from '../models/IngredientResearch.js';
import { verifyEvidenceCitation } from '../services/researchVerificationService.js';
import {
  findIngredient,
  getAllIngredients,
  importIngredientKnowledgeFromJson,
  loadKnowledgeSeedFile,
} from '../services/ingredientKnowledgeService.js';
import {
  approveIngredientResearch,
  rejectIngredientResearch,
  runIngredientResearch,
  updateProposedKnowledge,
} from '../services/ingredientResearchService.js';
import { KNOWLEDGE_BASE_VERSION } from '../constants/intelligenceVersions.js';
import { invalidateExplanationsForKnowledgeBaseChange } from '../services/invalidationService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const requireAdmin = (req) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }
};

export const listIngredientKnowledge = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { status, search, limit } = req.query;
  const records = await getAllIngredients({ status, search, limit });
  res.status(200).json({ success: true, data: records });
});

export const getIngredientKnowledgeById = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { id } = req.params;
  const record = mongoose.Types.ObjectId.isValid(id)
    ? await IngredientKnowledge.findById(id).lean()
    : await findIngredient(id);
  if (!record) throw new ApiError(404, 'Ingredient knowledge record not found.');
  res.status(200).json({ success: true, data: record });
});

export const matchIngredientKnowledge = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const query = req.query.q || req.body?.q || req.body?.name;
  const record = await findIngredient(query);
  res.status(200).json({ success: true, data: record, matched: Boolean(record) });
});

export const importIngredientKnowledge = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const preview = await loadKnowledgeSeedFile();
  if (!preview.valid) {
    throw new ApiError(400, `Invalid knowledge JSON: ${preview.errors.join('; ')}`);
  }
  const result = await importIngredientKnowledgeFromJson({ overwrite: Boolean(req.body?.overwrite) });
  res.status(200).json({ success: true, data: result });
});

export const createIngredientKnowledgeDraft = asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { ingredientId, ingredientName, ...payload } = req.body;
  let ingredient = null;

  if (ingredientId && mongoose.Types.ObjectId.isValid(ingredientId)) {
    ingredient = await Ingredient.findById(ingredientId);
  } else if (ingredientName) {
    ingredient = await Ingredient.findOne({ name: new RegExp(`^${String(ingredientName).trim()}$`, 'i') });
    if (!ingredient) {
      ingredient = await Ingredient.create({ name: String(ingredientName).trim() });
    }
  }

  const record = await IngredientKnowledge.create({
    ingredient: ingredient?._id || null,
    name: ingredientName || payload.name || ingredient?.name || '',
    inciName: payload.inciName || payload.inci_name || ingredientName || '',
    ...payload,
    researchStatus: payload.researchStatus || 'pending_review',
    originalResearchText: payload.originalResearchText || payload.notes || '',
    knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
  });

  res.status(201).json({ success: true, data: record });
});

export const verifyIngredientKnowledge = asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid knowledge record ID.');
  }

  const record = await IngredientKnowledge.findById(id).populate('evidenceIds');
  if (!record) {
    throw new ApiError(404, 'Ingredient knowledge record not found.');
  }

  const verificationReport = [];
  for (const evidence of record.evidenceIds || []) {
    const result = await verifyEvidenceCitation(evidence);
    verificationReport.push({
      evidenceId: evidence._id,
      ingredient: record.ingredient,
      citation: evidence.sourceTitle || evidence.source,
      pmid: evidence.pmid,
      doi: evidence.doi,
      verificationResult: result.verificationStatus,
      mismatch: result.issues,
      supportedClaims: evidence.supportedClaims || [],
      evidenceLevel: evidence.evidenceType || evidence.evidenceStrength,
      recommendedCorrection: result.issues.join('; ') || null,
    });

    evidence.verificationStatus = result.verificationStatus;
    evidence.verificationNotes = result.issues.join('; ');
    await evidence.save();
  }

  const hasFailures = verificationReport.some((entry) => entry.verificationResult !== 'verified');
  record.researchStatus = hasFailures ? 'pending_review' : 'verified';
  if (!hasFailures) {
    record.knowledgeBaseVersion = KNOWLEDGE_BASE_VERSION;
    record.reviewedBy = req.user._id;
    record.reviewedAt = new Date();
    await invalidateExplanationsForKnowledgeBaseChange();
  }
  await record.save();

  res.status(200).json({
    success: true,
    data: record,
    verificationReport,
  });
});

export const listResearchQueue = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;
  const items = await IngredientResearch.find(query).sort({ updatedAt: -1 }).lean();
  res.status(200).json({ success: true, data: items });
});

export const getResearchQueueItem = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const item = await IngredientResearch.findById(req.params.id).lean();
  if (!item) throw new ApiError(404, 'Research queue item not found.');
  res.status(200).json({ success: true, data: item });
});

export const runQueuedIngredientResearch = asyncHandler(async (req, res) => {
  requireAdmin(req);
  const name = req.body?.ingredientName || req.body?.name;
  const itemId = req.params.id;
  let ingredientName = name;
  if (!ingredientName && itemId) {
    const item = await IngredientResearch.findById(itemId);
    if (!item) throw new ApiError(404, 'Research queue item not found.');
    ingredientName = item.ingredientName;
  }
  if (!ingredientName) throw new ApiError(400, 'ingredientName is required.');

  try {
    const result = await runIngredientResearch({
      ingredientName,
      productId: req.body?.productId || null,
      productContext: req.body?.productContext || null,
      isUpdate: Boolean(req.body?.isUpdate),
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const approveQueuedResearch = asyncHandler(async (req, res) => {
  requireAdmin(req);
  try {
    const result = await approveIngredientResearch(req.params.id, {
      userId: req.user._id,
      edits: req.body?.edits || {},
      notes: req.body?.notes || '',
    });
    res.status(200).json({ success: true, data: result, message: 'Ingredient knowledge verified.' });
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const rejectQueuedResearch = asyncHandler(async (req, res) => {
  requireAdmin(req);
  try {
    const item = await rejectIngredientResearch(req.params.id, {
      userId: req.user._id,
      notes: req.body?.reason || req.body?.notes || '',
    });
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export const editQueuedResearch = asyncHandler(async (req, res) => {
  requireAdmin(req);
  try {
    const item = await updateProposedKnowledge(req.params.id, req.body?.proposedKnowledge || req.body || {});
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    throw new ApiError(400, error.message);
  }
});

export default {
  listIngredientKnowledge,
  getIngredientKnowledgeById,
  matchIngredientKnowledge,
  importIngredientKnowledge,
  createIngredientKnowledgeDraft,
  verifyIngredientKnowledge,
  listResearchQueue,
  getResearchQueueItem,
  runQueuedIngredientResearch,
  approveQueuedResearch,
  rejectQueuedResearch,
  editQueuedResearch,
};
