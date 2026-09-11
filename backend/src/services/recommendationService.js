import Product from '../models/Product.js';
import ProductOffer from '../models/ProductOffer.js';
import Recommendation from '../models/Recommendation.js';
import SkinProfile from '../models/SkinProfile.js';

import { computeProductMatch } from './matchingEngineService.js';
import { getBestCustomerOffer } from '../utils/offerPresentation.js';
import { normalizeCategory } from '../utils/normalizeCategory.js';

/**
 * Canonical skinDecode recommendation categories.
 */
const RECOMMENDATION_CATEGORIES = [
  'Cleansers',
  'Moisturizers',
  'Sunscreens',
  'Serums',
  'Exfoliants',
  'Toners & Essences',
  'Retinoids & Anti-Aging',
  'Eye Creams & Serums',
  'Face Masks',
  'Facial Oils',
];

/**
 * Historical profile snapshot.
 *
 * SkinProfile remains the source of truth.
 * This is only the profile state used when
 * the recommendation snapshot was generated.
 */
const buildProfileSnapshot = (skinProfile = {}) => ({
  skinType: skinProfile.skinType || 'unknown',

  sensitivity:
    skinProfile.sensitivity || 'unknown',

  morningSkinFeel:
    skinProfile.morningSkinFeel || 'unknown',

  responseToNewProducts:
    skinProfile.responseToNewProducts || 'unknown',

  ageRange:
    skinProfile.ageRange || 'unknown',

  currentProducts:
    skinProfile.currentProducts || [],

  primaryGoal:
    skinProfile.primaryGoal || 'unknown',

  concerns:
    skinProfile.concerns || [],

  allergies:
    skinProfile.allergies || [],

  avoidedIngredients:
    skinProfile.avoidedIngredients || [],

  avoidancePreferences:
    skinProfile.avoidancePreferences || [],

  mustHavePreferences:
    skinProfile.mustHavePreferences || [],

  sunscreenHabit:
    skinProfile.sunscreenHabit || 'unknown',

  onboardingAnswers:
    skinProfile.onboardingAnswers || {},

  budget:
    skinProfile.budget || {
      min: 0,
      max: 5000,
    },
});

/**
 * Deterministic category ranking.
 *
 * 1. Compatibility
 * 2. Matching confidence
 * 3. Product Intelligence evidence confidence
 * 4. Stable product ID
 */
const sortCategoryProducts = (products = []) => {
  return [...products].sort((a, b) => {
    const scoreDifference =
      Number(b.score || 0) -
      Number(a.score || 0);

    if (
      Math.abs(scoreDifference) >
      0.0001
    ) {
      return scoreDifference;
    }

    const confidenceDifference =
      Number(b.confidence || 0) -
      Number(a.confidence || 0);

    if (
      Math.abs(confidenceDifference) >
      0.0001
    ) {
      return confidenceDifference;
    }

    const evidenceDifference =
      Number(
        b.product
          ?.productIntelligence
          ?.evidenceConfidence || 0
      ) -
      Number(
        a.product
          ?.productIntelligence
          ?.evidenceConfidence || 0
      );

    if (
      Math.abs(evidenceDifference) >
      0.0001
    ) {
      return evidenceDifference;
    }

    return String(
      a.product?._id || ''
    ).localeCompare(
      String(
        b.product?._id || ''
      )
    );
  });
};

/**
 * Generate deterministic recommendations.
 *
 * IMPORTANT:
 *
 * There is NO AI here.
 *
 * Flow:
 *
 * SkinProfile
 *      ↓
 * Product catalog
 *      ↓
 * computeProductMatch()
 *      ↓
 * hard constraints
 *      ↓
 * deterministic compatibility
 *      ↓
 * canonical category
 *      ↓
 * independent category ranking
 *      ↓
 * Recommendation snapshot
 *
 * Product offers may be READ here only because
 * the matching engine may need price for budget
 * evaluation.
 *
 * Offer data is NOT persisted inside Recommendation.
 */
export const generateRecommendationsForUser = async (
  userId,
  options = {}
) => {
  const safeLimit = Math.max(
    1,
    Math.min(
      Number(options.limit) || 5,
      50
    )
  );

  const {
    currentCategory,
  } = options;

  /**
   * 1. LOAD PROFILE
   */
  const profile =
    await SkinProfile.findOne({
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
   * 2. BUILD PRODUCT QUERY
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
      $in:
        profile.preferredProductCategories,
    };
  }

  /**
   * 3. LOAD PRODUCTS
   */
  const products =
    await Product.find(query)
      .populate('brand')
      .populate('category')
      .populate('ingredients')
      .populate('keyIngredients')
      .lean();

  if (!products.length) {
    return Recommendation.create({
      user: userId,

      profileSnapshot:
        buildProfileSnapshot(profile),

      products: [],

      generatedBy:
        'rule_engine',
    });
  }

  /**
   * 4. LOAD ACTIVE OFFERS
   *
   * Offers are used only as input to
   * budget evaluation.
   *
   * They are NOT saved into Recommendation.
   */
  const productIds =
    products.map(
      (product) => product._id
    );

  const offers =
    await ProductOffer.find({
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
   * 5. GROUP OFFERS BY PRODUCT
   */
  const offersByProduct =
    offers.reduce(
      (accumulator, offer) => {
        const productId =
          String(offer.product);

        if (
          !accumulator[productId]
        ) {
          accumulator[productId] = [];
        }

        accumulator[productId].push(
          offer
        );

        return accumulator;
      },
      {}
    );

  /**
   * 6. DETERMINISTIC MATCHING
   */
  const eligibleProducts = [];

  for (const product of products) {
    const productOffers =
      offersByProduct[
        String(product._id)
      ] || [];

    const bestOffer =
      getBestCustomerOffer(
        productOffers
      );

    const offerPrice =
      bestOffer
        ? Number(bestOffer.price)
        : null;

    /**
     * Canonical category comes from
     * Product.category.
     */
    const recommendationCategory =
      normalizeCategory(
        product.category
      );

    /**
     * Products without a canonical category
     * cannot participate in category-local
     * recommendations.
     */
    if (
      !recommendationCategory
    ) {
      continue;
    }

    const matchResult =
      computeProductMatch({
        product,

        skinProfile:
          profile,

        offerPrice,

        currentCategory:
          currentCategory ||
          product.category,
      });

    /**
     * HARD CONSTRAINT FAILURE
     */
    if (
      !matchResult.eligible
    ) {
      continue;
    }

    /**
     * UNKNOWN compatibility
     *
     * UNKNOWN is not a recommendation score.
     */
    if (
      matchResult.overallScore ===
      null ||
      matchResult.overallScore ===
      undefined
    ) {
      continue;
    }

    eligibleProducts.push({
      score:
        Number(
          matchResult.overallScore
        ),

      skinCompatibilityScore:
        matchResult.skinCompatibilityScore,

      matchedFactors:
        matchResult.matchedFactors ||
        [],

      concernsMatched:
        matchResult.concernsMatched ||
        [],

      concernsNotMatched:
        matchResult.concernsNotMatched ||
        [],

      explanation:
        matchResult.explanation ||
        '',

      confidence:
        matchResult.confidence,

      matchResult,

      withinBudget:
        matchResult.withinBudget,

      product,

      recommendationCategory,
    });
  }

  /**
   * 7. GROUP BY CATEGORY
   */
  const productsByCategory =
    new Map(
      RECOMMENDATION_CATEGORIES.map(
        (category) => [
          category,
          [],
        ]
      )
    );

  eligibleProducts.forEach(
    (entry) => {
      const category =
        entry.recommendationCategory;

      const categoryProducts =
        productsByCategory.get(
          category
        );

      if (
        categoryProducts
      ) {
        categoryProducts.push(
          entry
        );
      }
    }
  );

  /**
   * 8. RANK EACH CATEGORY INDEPENDENTLY
   */
  const categoryRecommendations =
    [];

  RECOMMENDATION_CATEGORIES.forEach(
    (category) => {
      const categoryProducts =
        productsByCategory.get(
          category
        ) || [];

      const rankedProducts =
        sortCategoryProducts(
          categoryProducts
        );

      rankedProducts
        .slice(
          0,
          safeLimit
        )
        .forEach(
          (
            entry,
            index
          ) => {
            categoryRecommendations.push({
              product:
                entry.product._id,

              /**
               * Legacy rank.
               *
               * It now means category-local
               * rank as well.
               */
              rank:
                index + 1,

              /**
               * Canonical category-local rank.
               */
              categoryRank:
                index + 1,

              /**
               * Canonical category name.
               */
              recommendationCategory:
                category,

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
            });
          }
        );
    }
  );

  /**
   * 9. SAVE SNAPSHOT
   *
   * IMPORTANT:
   *
   * NO price
   * NO retailer
   * NO offerUrl
   *
   * Recommendation only stores recommendation
   * intelligence.
   */
  const recommendation =
    await Recommendation.create({
      user: userId,

      profileSnapshot:
        buildProfileSnapshot(
          profile
        ),

      products:
        categoryRecommendations,

      generatedBy:
        'rule_engine',
    });

  return recommendation;
};

/**
 * Get latest VALID recommendation.
 *
 * We require:
 * - at least one product
 * - categoryRank
 * - recommendationCategory
 *
 * This prevents an old legacy snapshot from
 * replacing the new recommendation data.
 */
export const getLatestRecommendationsForUser = async (userId) => {
  return Recommendation.find({
    user: userId,

    // Must contain at least one recommendation product
    products: {
      $elemMatch: {
        // categoryRank must actually be a number, not null
        categoryRank: {
          $type: 'number',
        },

        // recommendationCategory must actually exist as a string
        recommendationCategory: {
          $type: 'string',
        },
      },
    },
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


export default
  generateRecommendationsForUser;