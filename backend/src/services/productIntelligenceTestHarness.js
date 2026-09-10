import { scoreProductCompatibility } from '../services/recommendationScoringService.js';
import { buildIntelligenceInputFromProduct } from '../utils/productIntelligenceInput.js';
import { buildProductContext, getIntelligenceAuditInfo } from '../services/productIntelligenceService.js';
import { getFullTestMatrix, REPRESENTATIVE_PRODUCT_FIXTURES } from '../data/skinProfileTestMatrix.js';

/**
 * Runs deterministic profile × product matching tests (no LLM calls).
 * Product intelligence generation tests require GEMINI_API_KEY and are run separately.
 */
export const runProfileMatchingHarness = ({ profiles = [], products = [] } = {}) => {
  const matrix = getFullTestMatrix();
  const testProfiles = profiles.length ? profiles : matrix.profiles;
  const testProducts = products.length ? products : REPRESENTATIVE_PRODUCT_FIXTURES;
  const auditInfo = getIntelligenceAuditInfo();
  const results = [];
  const warnings = [];

  testProfiles.forEach((profileEntry) => {
    testProducts.forEach((productEntry) => {
      const product = productEntry.product || productEntry;
      const profile = profileEntry.profile || profileEntry;
      const testCaseId = `${profileEntry.id || 'custom'}__${productEntry.id || product.name || 'product'}`;

      try {
        const matchResult = scoreProductCompatibility({ product, skinProfile: profile });
        const intelligenceInput = buildIntelligenceInputFromProduct(product);

        const missingData = [];
        if (!intelligenceInput.ingredients?.length) missingData.push('ingredients');
        if (!intelligenceInput.name) missingData.push('name');
        if (!product.productIntelligence?.explanation) missingData.push('productIntelligence');

        const pass = matchResult.score !== undefined && matchResult.explanation;

        results.push({
          testCaseId,
          profileCategory: profileEntry.category || 'custom',
          profile,
          productId: productEntry.id || product.name,
          productName: product.name,
          intelligenceInput,
          promptPreview: buildProductContext(intelligenceInput),
          expectedBehavior: profileEntry.expectedBehavior || null,
          matchResult: {
            score: matchResult.score,
            matchedFactors: matchResult.matchedFactors,
            concernsMatched: matchResult.concernsMatched,
            concernsNotMatched: matchResult.concernsNotMatched,
            explanation: matchResult.explanation,
          },
          pass,
          warnings: missingData.length ? [`Missing: ${missingData.join(', ')}`] : [],
          missingData,
          intelligenceVersion: auditInfo.intelligenceVersion,
          promptVersion: auditInfo.promptVersion,
          knowledgeBaseVersion: auditInfo.knowledgeBaseVersion,
        });
      } catch (error) {
        warnings.push(`${testCaseId}: ${error.message}`);
        results.push({
          testCaseId,
          pass: false,
          error: error.message,
        });
      }
    });
  });

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  return {
    summary: {
      total: results.length,
      passed,
      failed,
      warnings: warnings.length,
      coverage: matrix.coverage,
    },
    results,
    warnings,
    audit: auditInfo,
  };
};

export const buildIntelligenceTestResult = ({
  testCaseId,
  profile,
  product,
  intelligenceResult,
  matchResult,
}) => {
  const auditInfo = getIntelligenceAuditInfo();
  const intelligenceInput = buildIntelligenceInputFromProduct(product);

  const missingData = [];
  if (!intelligenceInput.ingredients?.length) missingData.push('ingredients');
  if (!intelligenceInput.keyIngredients?.length) missingData.push('keyIngredients');
  if (intelligenceInput.fragranceFree === null) missingData.push('fragranceFree');
  if (intelligenceInput.alcoholFree === null) missingData.push('alcoholFree');
  if (intelligenceInput.essentialOilFree === null) missingData.push('essentialOilFree');

  return {
    testCaseId,
    profile,
    product: {
      name: product.name,
      brand: product.brand?.name || product.brand,
      category: product.category?.name || product.category,
      attributes: {
        skinTypes: product.skinTypes,
        concerns: product.concerns,
        fragranceFree: product.fragranceFree,
        alcoholFree: product.alcoholFree,
        essentialOilFree: product.essentialOilFree,
        pregnancyFriendly: product.pregnancyFriendly,
      },
    },
    intelligenceInput,
    promptPreview: buildProductContext(intelligenceInput),
    productIntelligence: intelligenceResult?.data || product.productIntelligence || null,
    profileMatch: matchResult || null,
    pass: intelligenceResult?.success ?? Boolean(product.productIntelligence?.explanation),
    warnings: intelligenceResult?.success === false ? [intelligenceResult.error] : [],
    missingData,
    audit: {
      promptVersion: auditInfo.promptVersion,
      knowledgeVersion: auditInfo.knowledgeBaseVersion,
      intelligenceVersion: auditInfo.intelligenceVersion,
      fieldsUsed: auditInfo.fieldsUsed,
      skinProfileUsedInProductIntelligence: false,
      skinProfileUsedInMatching: true,
    },
    metadata: intelligenceResult?.metadata || null,
    provider: intelligenceResult?.provider || null,
    model: intelligenceResult?.model || null,
  };
};

export default {
  runProfileMatchingHarness,
  buildIntelligenceTestResult,
};
