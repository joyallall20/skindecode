import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
    },

    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    ingredientListText: {
      type: String,
      default: "",
    },

    ingredients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ingredient",
      },
    ],

    keyIngredients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ingredient",
      },
    ],

    ingredientSource: {
      type: String,
      default: null,
    },

    ingredientConfidence: {
      type: String,
      default: null,
    },

    skinTypes: [
      {
        type: String,
        enum: [
          "oily",
          "dry",
          "combination",
          "normal",
          "sensitive",
        ],
      },
    ],

    concerns: [
      {
        type: String,
        trim: true,
      },
    ],

    fragranceFree: {
      type: Boolean,
      default: null,
    },

    alcoholFree: {
      type: Boolean,
      default: null,
    },

    essentialOilFree: {
      type: Boolean,
      default: null,
    },

    pregnancyFriendly: {
      type: Boolean,
      default: null,
    },

    canonicalName: {
      type: String,
      default: "",
      trim: true,
    },

    variant: {
      type: String,
      default: "",
      trim: true,
    },

    size: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: String,
      default: "",
      trim: true,
    },

    claims: [{
      type: String,
      trim: true,
    }],

    productIdentifiers: {
      sku: { type: String, default: "" },
      upc: { type: String, default: "" },
      ean: { type: String, default: "" },
      gtin: { type: String, default: "" },
      mpn: { type: String, default: "" },
      retailerProductId: { type: String, default: "" },
    },

    canonicalIdentityHash: {
      type: String,
      default: null,
      index: true,
    },

    sourceUrl: {
      type: String,
      default: null,
      trim: true,
    },

    intelligenceStatus: {
      type: String,
      enum: [
        "none",
        "queued",
        "generating",
        "generated",
        "approved",
        "rejected",
        "failed",
      ],
      default: "none",
      index: true,
    },

    intelligenceReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    intelligenceReviewedAt: {
      type: Date,
      default: null,
    },

    intelligenceReviewNotes: {
      type: String,
      default: "",
    },

    qualityScore: {
      type: Number,
      min: 0,
      max: 10,
      default: null,
    },

    productIntelligence: {
      skinTypeCompatibility: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      sensitivitySuitability: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      concernCompatibility: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      ingredientAnalysis: {
        type: [
          {
            ingredient: String,
            benefits: [String],
            relevantConcerns: [String],
            potentialSensitivityConcern: String,
            explanation: String,

            evidenceLevel: {
              type: String,
              enum: [
                "known",
                "likely",
                "evidence-backed",
                "unknown",
              ],
              default: "unknown",
            },
          },
        ],
        default: [],
      },

      ingredientConflicts: {
        type: [String],
        default: [],
      },

      avoidanceSignals: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      mustHaveAttributes: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      hydrationProfile: {
        type: String,
        default: null,
      },

      oilControlProfile: {
        type: String,
        default: null,
      },

      qualityAssessment: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },

      evidenceConfidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },

      explanation: {
        type: String,
        default: "",
      },
    },

    intelligenceMetadata: {
      generatedAt: {
        type: Date,
        default: null,
      },

      intelligenceVersion: {
        type: String,
        default: null,
      },

      promptVersion: {
        type: String,
        default: null,
      },

      knowledgeBaseVersion: {
        type: String,
        default: null,
      },

      provider: {
        type: String,
        default: null,
      },

      model: {
        type: String,
        default: null,
      },
    },

    /*
     * SHA-256 hash of the normalized complete ingredient formula.
     *
     * Used to determine whether existing Product Intelligence
     * can safely be reused instead of calling Cerebras again.
     */
    intelligenceFormulaHash: {
      type: String,
      default: null,
      index: true,
    },

    embedding: {
      type: [Number],
      default: undefined,
    },

    source: {
      type: String,
      enum: [
        "manual",
        "ai_import",
        "api",
      ],
      default: "manual",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;