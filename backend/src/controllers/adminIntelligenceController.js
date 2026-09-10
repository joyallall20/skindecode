import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateProductIntelligence, buildProductContext, getIntelligenceAuditInfo } from '../services/productIntelligenceService.js';
import { scoreProductCompatibility } from '../services/recommendationScoringService.js';
import { buildIntelligenceInputFromProduct } from '../utils/productIntelligenceInput.js';
import { getFullTestMatrix } from '../data/skinProfileTestMatrix.js';
import { runProfileMatchingHarness, buildIntelligenceTestResult } from '../services/productIntelligenceTestHarness.js';

export const getIntelligenceTestMatrix = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  res.status(200).json({ success: true, data: getFullTestMatrix() });
});

export const getIntelligenceAuditReport = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const auditInfo = getIntelligenceAuditInfo();
  const matrix = getFullTestMatrix();

  res.status(200).json({
    success: true,
    data: {
      skinProfileFields: matrix.enumDefinitions,
      productFieldsUsedInIntelligence: auditInfo.fieldsUsed,
      intelligenceInputs: auditInfo.fieldsUsed,
      skinProfileUsedInIntelligenceGeneration: false,
      skinProfileUsedInMatching: true,
      outputSchema: auditInfo.outputSchema,
      versioning: {
        intelligenceVersion: auditInfo.intelligenceVersion,
        promptVersion: auditInfo.promptVersion,
        knowledgeBaseVersion: auditInfo.knowledgeBaseVersion,
      },
      coverage: matrix.coverage,
      fieldUsageTable: [
        { field: 'skinType', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'sensitivity', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'morningSkinFeel', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'afterMoisturizerFeel', exists: true, sentToAI: false, usedInMatching: false, usedInScoring: false, tested: false },
        { field: 'responseToNewProducts', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'sunscreenHabit', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'ageRange', exists: true, sentToAI: false, usedInMatching: false, usedInScoring: false, tested: true },
        { field: 'currentProducts', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'primaryGoal', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'concerns', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'allergies', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'avoidedIngredients', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'mustHavePreferences', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: true },
        { field: 'budget', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: false },
        { field: 'preferredProductCategories', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: false, tested: false },
        { field: 'questionnaireCompleted', exists: true, sentToAI: false, usedInMatching: false, usedInScoring: false, tested: false },
        { field: 'onboardingAnswers', exists: true, sentToAI: false, usedInMatching: true, usedInScoring: true, tested: false },
      ],
    },
  });
});

export const runProfileMatchingAudit = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { profileIds, productIds } = req.body || {};
  const matrix = getFullTestMatrix();

  let profiles = matrix.profiles;
  if (Array.isArray(profileIds) && profileIds.length) {
    profiles = profiles.filter((p) => profileIds.includes(p.id));
  }

  let products = matrix.productFixtures;
  if (Array.isArray(productIds) && productIds.length) {
    products = products.filter((p) => productIds.includes(p.id));
  }

  const harnessResult = runProfileMatchingHarness({ profiles, products });

  res.status(200).json({ success: true, data: harnessResult });
});

export const testProductIntelligence = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { productId, skinProfile = {}, generateIntelligence = false } = req.body || {};

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'A valid productId is required.');
  }

  const product = await Product.findById(productId)
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .populate('ingredients', 'name aliases')
    .populate('keyIngredients', 'name aliases')
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const intelligenceInput = buildIntelligenceInputFromProduct(product);
  let intelligenceResult = null;

  if (generateIntelligence) {
    console.info('[intelligence] started', { productId: String(product._id) });
    console.info('[intelligence] ingredient count:', intelligenceInput.ingredients.length);
    if (!intelligenceInput.ingredients.length) {
      throw new ApiError(400, 'Full ingredient list is required before running Product Intelligence.');
    }
    intelligenceResult = await generateProductIntelligence(intelligenceInput);
  }

  const productForMatching = intelligenceResult?.success
    ? { ...product, productIntelligence: intelligenceResult.data }
    : product;

  const matchResult = scoreProductCompatibility({
    product: productForMatching,
    skinProfile,
  });

  const testResult = buildIntelligenceTestResult({
    testCaseId: `admin-test-${productId}`,
    profile: skinProfile,
    product: productForMatching,
    intelligenceResult,
    matchResult,
  });

  res.status(200).json({
    success: true,
    data: {
      ...testResult,
      intelligenceGenerated: generateIntelligence && intelligenceResult?.success,
      intelligenceError: intelligenceResult?.success === false ? intelligenceResult.error : null,
    },
  });
});

export const previewIntelligenceInput = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { productData } = req.body || {};
  const auditInfo = getIntelligenceAuditInfo();

  res.status(200).json({
    success: true,
    data: {
      intelligenceInput: productData,
      promptPreview: buildProductContext(productData),
      audit: auditInfo,
    },
  });
});

export default {
  getIntelligenceTestMatrix,
  getIntelligenceAuditReport,
  runProfileMatchingAudit,
  testProductIntelligence,
  previewIntelligenceInput,
};
