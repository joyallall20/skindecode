import mongoose from 'mongoose';

const recommendationProductSchema =
  new mongoose.Schema(
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },

      /*
       * Legacy rank field.
       *
       * Kept for backwards compatibility.
       * It now represents category-local rank.
       */
      rank: {
        type: Number,
        required: true,
        min: 1,
      },

      /*
       * Category-local ranking.
       *
       * Example:
       *
       * Sunscreens:
       *   #1
       *   #2
       *   #3
       *
       * Moisturizers:
       *   #1
       *   #2
       *   #3
       */
      categoryRank: {
        type: Number,
        required: true,
        min: 1,
      },

      /*
       * Canonical category used for the recommendation.
       */
      recommendationCategory: {
        type: String,
        required: true,
        enum: [
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
        ],
      },

      /*
       * Deterministic compatibility score produced
       * by the matching engine.
       */
      compatibilityScore: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
      },

      matchedFactors: [
        {
          type: String,
        },
      ],

      concernsMatched: [
        {
          type: String,
        },
      ],

      concernsNotMatched: [
        {
          type: String,
        },
      ],

      explanation: {
        type: String,
        default: '',
      },
    },
    {
      _id: false,
    }
  );

const recommendationSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
      },

      profileSnapshot: {
        skinType: {
          type: String,
          default: 'unknown',
        },

        sensitivity: {
          type: String,
          default: 'unknown',
        },

        morningSkinFeel: {
          type: String,
          default: 'unknown',
        },

        responseToNewProducts: {
          type: String,
          default: 'unknown',
        },

        primaryGoal: {
          type: String,
          default: 'unknown',
        },

        concerns: {
          type: [String],
          default: [],
        },

        /*
         * Onboarding avoidance preferences.
         *
         * Examples:
         * fragrance
         * essential-oils
         * alcohol
         * harsh-exfoliants
         * irritating-ingredients
         * known-allergies
         * nothing-to-avoid
         */
        avoidancePreferences: {
          type: [String],
          default: [],
        },

        allergies: {
          type: [String],
          default: [],
        },

        avoidedIngredients: {
          type: [mongoose.Schema.Types.ObjectId],
          ref: 'Ingredient',
          default: [],
        },

        mustHavePreferences: {
          type: [String],
          default: [],
        },

        /*
         * Legacy fields retained so older
         * recommendation snapshots remain valid.
         */
        ageRange: {
          type: String,
          default: 'unknown',
        },

        currentProducts: {
          type: [String],
          default: [],
        },

        sunscreenHabit: {
          type: String,
          default: 'unknown',
        },

        onboardingAnswers: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },

        budget: {
          min: {
            type: Number,
            default: 0,
          },

          max: {
            type: Number,
            default: 5000,
          },
        },
      },

      /*
       * Recommendation contains ONLY recommendation data.
       *
       * Product pricing / retailer information is NOT stored here.
       * Those values come from ProductOffer separately.
       */
      products: {
        type: [recommendationProductSchema],
        default: [],
      },

      generatedBy: {
        type: String,

        enum: [
          'rule_engine',
          'hybrid',
        ],

        default: 'rule_engine',
      },
    },
    {
      timestamps: true,
    }
  );

const Recommendation =
  mongoose.model(
    'Recommendation',
    recommendationSchema
  );

export default Recommendation;