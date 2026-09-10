import { RATING_BASIS_DISCLAIMER } from '../schemas/productIntelligenceSchema.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roundScore = (value) => Math.round(clamp(value, 0, 10) * 10) / 10;

const averageNumericValues = (values = []) => {
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!numericValues.length) return 0;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

const countTruthyAttributes = (attributes = {}) =>
  Object.values(attributes).filter((value) => value === true).length;

const scoreIngredientAnalysisDepth = (ingredientAnalysis = []) => {
  if (!Array.isArray(ingredientAnalysis) || ingredientAnalysis.length === 0) {
    return 0;
  }

  const evidenceWeights = {
    'evidence-backed': 1,
    known: 0.85,
    likely: 0.65,
    unknown: 0.35,
  };

  const perIngredientScores = ingredientAnalysis.map((entry) => {
    const evidenceWeight = evidenceWeights[entry?.evidenceLevel] ?? 0.35;
    const benefitDepth = Array.isArray(entry?.benefits) ? Math.min(entry.benefits.length, 3) / 3 : 0;
    const explanationDepth = entry?.explanation ? 1 : 0;
    return evidenceWeight * 0.5 + benefitDepth * 0.3 + explanationDepth * 0.2;
  });

  return averageNumericValues(perIngredientScores);
};

const scoreDisclosedAttributes = (productData = {}) => {
  let score = 0;

  if (productData.name) score += 0.15;
  if (productData.brand) score += 0.15;
  if (productData.category) score += 0.1;
  if (productData.description) score += 0.1;
  if (Array.isArray(productData.ingredients) && productData.ingredients.length >= 5) score += 0.25;
  else if (Array.isArray(productData.ingredients) && productData.ingredients.length > 0) score += 0.15;
  if (Array.isArray(productData.keyIngredients) && productData.keyIngredients.length > 0) score += 0.1;
  if (Array.isArray(productData.concerns) && productData.concerns.length > 0) score += 0.075;
  if (Array.isArray(productData.skinTypes) && productData.skinTypes.length > 0) score += 0.075;

  return clamp(score, 0, 1);
};

const scoreFormulationSignals = (qualityAssessment = {}) => {
  const signalCount = Array.isArray(qualityAssessment.formulationSignals)
    ? qualityAssessment.formulationSignals.length
    : 0;
  const limitationCount = Array.isArray(qualityAssessment.limitations)
    ? qualityAssessment.limitations.length
    : 0;

  const signalScore = Math.min(signalCount, 4) / 4;
  const transparencyPenalty = limitationCount > 3 ? 0.1 : 0;

  return clamp(signalScore - transparencyPenalty, 0, 1);
};

export const computeProductQualityScore = ({ productIntelligence = {}, productData = {} } = {}) => {
  const intelligence = productIntelligence || {};
  const qualityAssessment = intelligence.qualityAssessment || {};

  const evidenceConfidence = clamp(Number(intelligence.evidenceConfidence) || 0, 0, 1);
  const ingredientDepthScore = scoreIngredientAnalysisDepth(intelligence.ingredientAnalysis);
  const disclosedInfoScore = scoreDisclosedAttributes(productData);
  const formulationScore = scoreFormulationSignals(qualityAssessment);
  const mustHaveScore = Math.min(countTruthyAttributes(intelligence.mustHaveAttributes), 4) / 4;
  const conflictPenalty = Array.isArray(intelligence.ingredientConflicts)
    ? Math.min(intelligence.ingredientConflicts.length, 3) * 0.08
    : 0;

  const weightedScore =
    3.5 +
    evidenceConfidence * 2.0 +
    ingredientDepthScore * 1.5 +
    disclosedInfoScore * 1.5 +
    formulationScore * 1.0 +
    mustHaveScore * 0.5 -
    conflictPenalty;

  const score = roundScore(weightedScore);

  return {
    score,
    ratingBasis: qualityAssessment.ratingBasis || RATING_BASIS_DISCLAIMER,
    breakdown: {
      evidenceConfidence,
      ingredientDepthScore: roundScore(ingredientDepthScore * 10) / 10,
      disclosedInfoScore: roundScore(disclosedInfoScore * 10) / 10,
      formulationScore: roundScore(formulationScore * 10) / 10,
      mustHaveScore: roundScore(mustHaveScore * 10) / 10,
      conflictPenalty: roundScore(conflictPenalty * 10) / 10,
    },
  };
};

export default computeProductQualityScore;
