import Product from '../models/Product.js';
import ProductOffer from '../models/ProductOffer.js';

import {
  scoreProductCompatibility,
} from './recommendationScoringService.js';

import {
  isGeminiConfigured,
  rankCatalogCandidates,
} from './geminiService.js';

import {
  getBestCustomerOffer,
} from '../utils/offerPresentation.js';

const HARD_CONFLICTS = new Set([
  'confirmed allergy conflict',
  'avoided ingredient conflict',
  'required preference conflict',
  'required preference unknown',
  'skin type incompatibility',
]);

const getCandidateLimit = () => {
  return Math.max(
    5,
    Math.min(
      Number(
        process.env.GEMINI_CANDIDATE_LIMIT ||
          25
      ),
      50
    )
  );
};

const getElapsed = (start) =>
  `${Date.now() - start}ms`;

export const runAnonymousAnalysis =
  async ({
    profile,
    consent,
  }) => {
    const requestStart = Date.now();

    console.log(
      '[ANON] Analysis START'
    );

    /*
     * ---------------------------------------------------------
     * 1. LOAD ACTIVE PRODUCTS
     * ---------------------------------------------------------
     */

    let stepStart = Date.now();

    const products =
      await Product.find({
        isActive: true,
      })
        .populate(
          'brand',
          'name'
        )
        .populate(
          'category',
          'name'
        )
        .populate(
          'ingredients',
          'name aliases'
        )
        .populate(
          'keyIngredients',
          'name aliases'
        )
        .lean();

    console.log(
      `[ANON] Products loaded: ${getElapsed(
        stepStart
      )} | count=${products.length}`
    );

    /*
     * ---------------------------------------------------------
     * 2. LOAD ACTIVE OFFERS
     * ---------------------------------------------------------
     */

    stepStart = Date.now();

    const productIds =
      products.map(
        ({ _id }) => _id
      );

    const offers =
      productIds.length
        ? await ProductOffer.find({
            product: {
              $in: productIds,
            },

            isActive: true,
          })
            .populate(
              'retailer',
              'name slug'
            )
            .lean()
        : [];

    console.log(
      `[ANON] Offers loaded: ${getElapsed(
        stepStart
      )} | count=${offers.length}`
    );

    /*
     * ---------------------------------------------------------
     * 3. GROUP OFFERS BY PRODUCT
     * ---------------------------------------------------------
     */

    stepStart = Date.now();

    const offersByProduct =
      offers.reduce(
        (map, offer) => {
          const key =
            offer.product.toString();

          const current =
            map.get(key) || [];

          current.push(offer);

          map.set(
            key,
            current
          );

          return map;
        },
        new Map()
      );

    console.log(
      `[ANON] Offers grouped: ${getElapsed(
        stepStart
      )}`
    );

    /*
     * ---------------------------------------------------------
     * 4. BUILD ALL PRODUCTS
     *
     * This is intentionally lightweight.
     * It is NOT the detailed recommendation payload.
     * ---------------------------------------------------------
     */

    stepStart = Date.now();

    const allProducts =
      products.map((product) => {
        const productOffers =
          offersByProduct.get(
            product._id.toString()
          ) || [];

        const customerOffer =
          getBestCustomerOffer(
            productOffers
          );

        return {
          _id: product._id,

          name: product.name,

          brand: product.brand,

          category:
            product.category,

          images:
            product.images || [],

          price:
            customerOffer
              ? Number(
                  customerOffer.price
                )
              : null,

          offerUrl:
            customerOffer?.url ||
            null,
        };
      });

    console.log(
      `[ANON] All products prepared: ${getElapsed(
        stepStart
      )} | count=${allProducts.length}`
    );

    /*
     * ---------------------------------------------------------
     * 5. DETERMINISTIC PRODUCT SCORING
     * ---------------------------------------------------------
     */

    stepStart = Date.now();

    const scoredProducts =
      products.map((product) => {
        const productOffers =
          offersByProduct.get(
            product._id.toString()
          ) || [];

        const customerOffer =
          getBestCustomerOffer(
            productOffers
          );

        const scored =
          scoreProductCompatibility({
            product,

            skinProfile:
              profile,

            offerPrice:
              customerOffer
                ? Number(
                    customerOffer.price
                  )
                : null,
          });

        return {
          ...scored,

          product: {
            _id:
              product._id,

            name:
              product.name,

            brand:
              product.brand,

            category:
              product.category,

            images:
              product.images || [],
          },

          price:
            customerOffer
              ? Number(
                  customerOffer.price
                )
              : null,

          offerUrl:
            customerOffer?.url ||
            null,
        };
      });

    /*
     * ---------------------------------------------------------
     * 6. REMOVE HARD CONFLICTS
     * ---------------------------------------------------------
     */

    const eligibleProducts =
      scoredProducts.filter(
        ({
          concernsNotMatched = [],
        }) =>
          !concernsNotMatched.some(
            (factor) =>
              HARD_CONFLICTS.has(
                factor
              )
          )
      );

    const candidateLimit =
      getCandidateLimit();

    const candidates =
      eligibleProducts
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(
          0,
          candidateLimit
        );

    console.log(
      `[ANON] Scoring complete: ${getElapsed(
        stepStart
      )} | total=${products.length} | eligible=${eligibleProducts.length} | candidates=${candidates.length}`
    );

    /*
     * ---------------------------------------------------------
     * 7. GEMINI FINAL RANKING
     * ---------------------------------------------------------
     */

    stepStart = Date.now();

    let rankedRecommendations =
      candidates;

    if (
      isGeminiConfigured() &&
      candidates.length > 0
    ) {
      console.log(
        `[ANON] Gemini START | candidates=${candidates.length}`
      );

      try {
        rankedRecommendations =
          await rankCatalogCandidates({
            skinProfile:
              profile,

            candidates,
          });

        console.log(
          `[ANON] Gemini COMPLETE: ${getElapsed(
            stepStart
          )}`
        );
      } catch (error) {
        console.error(
          '[ANON] Gemini ranking failed. Using deterministic ranking.',
          error.message
        );

        rankedRecommendations =
          candidates;
      }
    } else {
      console.log(
        '[ANON] Gemini skipped'
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. FINAL TOP 5
     * ---------------------------------------------------------
     */

    const recommendedProducts =
      rankedRecommendations
        .slice(0, 5)
        .map(
          (
            recommendation,
            index
          ) => ({
            ...recommendation,

            recommendationRank:
              index + 1,
          })
        );

    /*
     * ---------------------------------------------------------
     * 9. FINAL RESPONSE
     *
     * IMPORTANT:
     *
     * Nothing is saved to SkinProfile.
     * Nothing is saved permanently in MongoDB.
     * ---------------------------------------------------------
     */

    const result = {
      profile,

      recommendedProducts,

      allProducts,

      consent: {
        consentId:
          consent.consentId,

        termsVersion:
          consent.termsVersion,

        privacyVersion:
          consent.privacyVersion,

        consentedAt:
          consent.consentedAt,
      },
    };

    console.log(
      `[ANON] Analysis COMPLETE: ${getElapsed(
        requestStart
      )}`
    );

    return result;
  };

export default {
  runAnonymousAnalysis,
};