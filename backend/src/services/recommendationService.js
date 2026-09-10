import Product from '../models/Product.js';
import ProductOffer from '../models/ProductOffer.js';
import Recommendation from '../models/Recommendation.js';
import SkinProfile from '../models/SkinProfile.js';

import { buildProfileSnapshot } from './recommendationScoringService.js';
import { computeProductMatch } from './matchingEngineService.js';
import { getBestCustomerOffer } from '../utils/offerPresentation.js';
import {
  isGeminiConfigured,
  rankCatalogCandidates,
} from './geminiService.js';

/**
 * Recommendation generation strategy
 *
 * Normal path:
 *   Catalog → deterministic matching → ranking → recommendations
 *
 * AI path:
 *   Only used when the deterministic engine detects ambiguity,
 *   low confidence, or insufficient strong candidates.
 *
 * Important:
 *   We do NOT generate an AI explanation for every product.
 *   Product intelligence + deterministic match result provide
 *   the explanation by default.
 */

const DEFAULT_LIMIT = 5;
const MAX_CANDIDATES = 25;

/**
 * Decide whether Gemini intervention is actually useful.
 *
 * AI should NOT be used simply because it is configured.
 */
const shouldUseGemini = ({
  scoredEntries = [],
  requestedLimit = DEFAULT_LIMIT,
}) => {
  if (!isGeminiConfigured()) {
    return false;
  }

  if (!scoredEntries.length) {
    return false;
  }

  // If we don't have enough candidates, Gemini cannot invent
  // products, so there is no benefit in calling it.
  if (scoredEntries.length < requestedLimit) {
    return false;
  }

  const top = scoredEntries.slice(0, requestedLimit);

  // Low-confidence recommendations are a good reason
  // to ask Gemini to help distinguish candidates.
  const averageConfidence =
    top.reduce(
      (sum, entry) =>
        sum + Number(entry.matchResult?.confidence || 0),
      0
    ) / Math.max(top.length, 1);

  if (averageConfidence < 0.55) {
    return true;
  }

  // If the scores are extremely close, the rule engine
  // may not have enough signal to confidently rank them.
  if (top.length >= 2) {
    const firstScore = Number(top[0]?.score || 0);
    const secondScore = Number(top[1]?.score || 0);

    if (Math.abs(firstScore - secondScore) <= 2) {
      return true;
    }
  }

  // If the overall best score is weak, AI can help interpret
  // the available structured product intelligence.
  if (Number(top[0]?.score || 0) < 55) {
    return true;
  }

  return false;
};

/**
 * Build the explanation shown to the user without an AI call.
 *
 * Priority:
 * 1. Product intelligence explanation
 * 2. Deterministic matching explanation
 * 3. Generic fallback
 */
const buildRecommendationExplanation = ({
  product,
  matchResult,
}) => {
  const intelligenceExplanation =
    product?.productIntelligence?.explanation;

  if (
    typeof intelligenceExplanation === 'string' &&
    intelligenceExplanation.trim()
  ) {
    return intelligenceExplanation.trim();
  }

  if (
    typeof matchResult?.explanation === 'string' &&
    matchResult.explanation.trim()
  ) {
    return matchResult.explanation.trim();
  }

  const matchedFactors = Array.isArray(
    matchResult?.matchedFactors
  )
    ? matchResult.matchedFactors
    : [];

  if (matchedFactors.length) {
    return matchedFactors
      .slice(0, 3)
      .join('. ');
  }

  return 'This product was evaluated against your skin profile and available product information.';
};

/**
 * Generate recommendations for a user.
 */
export const generateRecommendationsForUser = async (
  userId,
  options = {}
) => {
  const requestedLimit = Math.max(
    1,
    Math.min(
      Number(options.limit || DEFAULT_LIMIT),
      20
    )
  );

  const {
    currentCategory,
  } = options;

  /**
   * 1. Load profile
   */
  const profile = await SkinProfile.findOne({
    userId,
  })
    .populate(
      'avoidedIngredients',
      'name aliases'
    )
    .lean();

  if (!profile) {
    throw new Error(
      'Skin profile is required before generating recommendations.'
    );
  }

  /**
   * 2. Build catalog query
   */
  const query = {
    isActive: true,
  };

  if (currentCategory) {
    query.category = currentCategory;
  } else if (
    Array.isArray(
      profile.preferredProductCategories
    ) &&
    profile.preferredProductCategories.length
  ) {
    query.category = {
      $in: profile.preferredProductCategories,
    };
  }

  /**
   * 3. Load products with all structured intelligence
   */
  const products = await Product.find(query)
    .populate('brand')
    .populate('category')
    .populate('ingredients')
    .populate('keyIngredients')
    .lean();

  if (!products.length) {
    const emptyRecommendation =
      await Recommendation.create({
        user: userId,
        profileSnapshot:
          buildProfileSnapshot(profile),
        products: [],
        generatedBy: 'rule_engine',
      });

    return emptyRecommendation;
  }

  /**
   * 4. Load active offers
   */
  const productIds = products.map(
    (product) => product._id
  );

  const offers = await ProductOffer.find({
    product: {
      $in: productIds,
    },
    isActive: true,
  })
    .populate(
      'retailer',
      'name slug'
    )
    .lean();

  /**
   * 5. Group offers by product
   */
  const offersByProduct = offers.reduce(
    (accumulator, offer) => {
      const productId =
        offer.product.toString();

      if (!accumulator[productId]) {
        accumulator[productId] = [];
      }

      accumulator[productId].push(offer);

      return accumulator;
    },
    {}
  );

  /**
   * 6. Deterministic scoring
   *
   * IMPORTANT:
   * No AI calls happen inside this loop.
   */
  const scoredEntries = [];

  for (const product of products) {
    const productOffers =
      offersByProduct[
        product._id.toString()
      ] || [];

    const bestOffer =
      getBestCustomerOffer(
        productOffers
      );

    const offerPrice = bestOffer
      ? Number(bestOffer.price)
      : null;

    const matchResult =
      computeProductMatch({
        product,
        skinProfile: profile,
        offerPrice,
        currentCategory:
          currentCategory ||
          product.category,
      });

    /**
     * Hard conflicts are already converted
     * into eligible=false by the matching engine.
     */
    if (!matchResult.eligible) {
      continue;
    }

    scoredEntries.push({
      score:
        Number(matchResult.overallScore) || 0,

      skinCompatibilityScore:
        Number(
          matchResult.skinCompatibilityScore
        ) || 0,

      matchedFactors:
        matchResult.matchedFactors || [],

      concernsMatched:
        matchResult.concernsMatched || [],

      concernsNotMatched:
        matchResult.concernsNotMatched || [],

      explanation:
        buildRecommendationExplanation({
          product,
          matchResult,
        }),

      matchResult,

      withinBudget:
        matchResult.withinBudget,

      product,

      offerPrice,

      offerUrl:
        bestOffer?.url || null,

      retailer:
        bestOffer?.retailer || null,
    });
  }

  /**
   * 7. Deterministic ranking
   */
  scoredEntries.sort(
    (a, b) => b.score - a.score
  );

  /**
   * 8. Candidate pool
   *
   * We only ever expose a limited number of
   * candidates to Gemini.
   */
  const candidateLimit = Math.min(
    Math.max(
      requestedLimit * 3,
      Number(
        process.env.GEMINI_CANDIDATE_LIMIT || 15
      )
    ),
    MAX_CANDIDATES
  );

  const topEntries =
    scoredEntries.slice(
      0,
      candidateLimit
    );

  /**
   * 9. Optional AI intervention
   *
   * This is the key optimization.
   *
   * Most recommendation requests:
   *     0 AI calls
   *
   * Ambiguous/weak requests:
   *     1 Gemini call
   */
  const useGemini = shouldUseGemini({
    scoredEntries,
    requestedLimit,
  });

  let rankedEntries = topEntries;

  if (useGemini) {
    rankedEntries =
      await rankCatalogCandidates({
        skinProfile: profile,
        candidates: topEntries,
      });

    /**
     * Gemini may provide better concise reasons.
     * Keep deterministic explanation if Gemini
     * fails or doesn't return a usable reason.
     */
    rankedEntries =
      rankedEntries.map((entry) => ({
        ...entry,

        explanation:
          typeof entry.explanation ===
            'string' &&
          entry.explanation.trim()
            ? entry.explanation
            : buildRecommendationExplanation({
                product: entry.product,
                matchResult:
                  entry.matchResult,
              }),
      }));
  }

  /**
   * 10. Select final recommendations
   */
  const scoredProducts =
    rankedEntries
      .slice(0, requestedLimit)
      .map((entry, index) => ({
        product:
          entry.product._id,

        rank: index + 1,

        compatibilityScore:
          entry.score,

        matchedFactors:
          entry.matchedFactors,

        concernsMatched:
          entry.concernsMatched,

        concernsNotMatched:
          entry.concernsNotMatched,

        explanation:
          entry.explanation,

        price:
          entry.offerPrice,

        retailer:
          entry.retailer,

        offerUrl:
          entry.offerUrl,
      }));

  /**
   * 11. Save recommendation snapshot
   */
  const recommendation =
    await Recommendation.create({
      user: userId,

      profileSnapshot:
        buildProfileSnapshot(profile),

      products:
        scoredProducts,

      generatedBy:
        useGemini
          ? 'hybrid'
          : 'rule_engine',
    });

  return recommendation;
};

/**
 * Get latest recommendations.
 */
export const getLatestRecommendationsForUser =
  async (userId) => {
    return Recommendation.find({
      user: userId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(1)
      .populate({
        path: 'products.product',
        populate: [
          {
            path: 'brand',
          },
          {
            path: 'category',
          },
          {
            path: 'ingredients',
          },
          {
            path: 'keyIngredients',
          },
        ],
      })
      .lean();
  };

export default generateRecommendationsForUser;