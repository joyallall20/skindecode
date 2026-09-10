import mongoose from "mongoose";

const skinProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    skinType: {
      type: String,
      enum: [
        "oily",
        "dry",
        "combination",
        "normal",
        // Retained for profiles created before questionnaire validation.
        "unknown",
      ],
      default: "unknown",
    },

    sensitivity: {
      type: String,
      enum: [
        "low",
        "medium",
        "high",
        // Retained for profiles created before questionnaire validation.
        "unknown",
      ],
      default: "unknown",
    },

    morningSkinFeel: {
      type: String,
      enum: [
        "dry",
        "balanced",
        "slightly-oily",
        "very-oily",
        "combination-feel",
        "unknown",
      ],
      default: "unknown",
    },

    afterMoisturizerFeel: {
      type: String,
      default: "unknown",
    },

    responseToNewProducts: {
      type: String,
      enum: [
        "no-reaction",
        "sometimes-irritated",
        "often-irritated",
        "very-easily-irritated",
        "unknown",
      ],
      default: "unknown",
    },

    sunscreenHabit: {
      type: String,
      enum: [
        "every-day",
        "sometimes",
        "rarely-never",
        "unknown",
      ],
      default: "unknown",
    },

    ageRange: {
      type: String,
      enum: [
        "under-18",
        "18-24",
        "25-34",
        "35-44",
        "45-plus",
        "unknown",
      ],
      default: "unknown",
    },

    currentProducts: [
      {
        type: String,
        enum: [
          "cleanser",
          "moisturizer",
          "sunscreen",
          "serum",
          "exfoliant",
          "treatment",
          "eye-cream",
          "none",
        ],
      },
    ],

    primaryGoal: {
      type: String,
      enum: [
        "clearer-skin",
        "brighter-even",
        "hydration",
        "smoother-texture",
        "less-oiliness",
        "anti-aging",
        "healthier-skin",
        "unknown",
      ],
      default: "unknown",
    },

    concerns: [
      {
        type: String,
        enum: [
          "acne",
          "pigmentation",
          "dark-spots",
          "dryness",
          "excess-oil",
          "aging",
          "fine-lines",
          "uneven-texture",
          "dullness",
          "redness",
          "dark-circles",
          "dehydration",
          "large-pores",
          "sun-damage",
        ],
      },
    ],

    // User-selected things to avoid during onboarding.
    // Multiple options can be selected.
    avoidancePreferences: [
      {
        type: String,
        enum: [
          "fragrance",
          "essential-oils",
          "alcohol",
          "harsh-exfoliants",
          "irritating-ingredients",
          "known-allergies",
          "nothing-to-avoid",
        ],
      },
    ],

    allergies: [
      {
        type: String,
        trim: true,
      },
    ],

    avoidedIngredients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ingredient",
      },
    ],

    mustHavePreferences: [
      {
        type: String,
        enum: [
          "cruelty-free",
          "vegan",
          "fragrance-free",
          "reef-safe",
          "no-specific-preference",
        ],
      },
    ],

    budget: {
      min: {
        type: Number,
        min: 0,
        default: 0,
      },

      max: {
        type: Number,
        min: 0,
        default: 5000,
      },
    },

    preferredProductCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    questionnaireCompleted: {
      type: Boolean,
      default: false,
    },

    onboardingAnswers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const SkinProfile = mongoose.model(
  "SkinProfile",
  skinProfileSchema
);

export default SkinProfile;