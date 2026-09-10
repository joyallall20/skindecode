import mongoose from "mongoose";
import {
  INTELLIGENCE_VERSION,
  KNOWLEDGE_BASE_VERSION,
  MATCHING_ENGINE_VERSION,
  EXPLANATION_PROMPT_VERSION,
} from "../constants/intelligenceVersions.js";

const productExplanationCacheSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    canonicalProfileHash: {
      type: String,
      required: true,
      index: true,
    },

    canonicalProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    explanation: {
      type: String,
      default: "",
    },

    positiveReasons: [{
      factor: String,
      value: String,
      reason: String,
    }],

    warnings: [{
      factor: String,
      reason: String,
    }],

    compatibilitySummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    matchResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    model: { type: String, default: "" },
    modelVersion: { type: String, default: "" },
    explanationPromptVersion: { type: String, default: EXPLANATION_PROMPT_VERSION },
    productIntelligenceVersion: { type: String, default: INTELLIGENCE_VERSION },
    researchKnowledgeVersion: { type: String, default: KNOWLEDGE_BASE_VERSION },
    matchingEngineVersion: { type: String, default: MATCHING_ENGINE_VERSION },

    generatedAt: { type: Date, default: null },
    lastValidatedAt: { type: Date, default: null },

    validationStatus: {
      type: String,
      enum: ["pending", "pass", "flag", "reject", "generating"],
      default: "pending",
      index: true,
    },

    validationNotes: { type: String, default: "" },

    status: {
      type: String,
      enum: ["valid", "stale", "invalid"],
      default: "valid",
      index: true,
    },

    generationLock: {
      lockedAt: { type: Date, default: null },
      lockedBy: { type: String, default: null },
    },
  },
  { timestamps: true }
);

productExplanationCacheSchema.index(
  {
    product: 1,
    canonicalProfileHash: 1,
    productIntelligenceVersion: 1,
    matchingEngineVersion: 1,
    explanationPromptVersion: 1,
    researchKnowledgeVersion: 1,
  },
  { unique: true }
);

const ProductExplanationCache = mongoose.model("ProductExplanationCache", productExplanationCacheSchema);
export default ProductExplanationCache;
