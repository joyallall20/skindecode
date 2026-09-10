import mongoose from "mongoose";
import { KNOWLEDGE_BASE_VERSION } from "../constants/intelligenceVersions.js";

const evidenceSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
      index: true,
    },

    sourceTitle: {
      type: String,
      default: "",
      trim: true,
    },

    authors: [{ type: String, trim: true }],

    journal: {
      type: String,
      default: "",
      trim: true,
    },

    organization: {
      type: String,
      default: "",
      trim: true,
    },

    year: {
      type: Number,
      default: null,
    },

    doi: {
      type: String,
      default: "",
      trim: true,
    },

    pmid: {
      type: String,
      default: "",
      trim: true,
    },

    url: {
      type: String,
      default: "",
      trim: true,
    },

    evidenceType: {
      type: String,
      enum: ["clinical", "observational", "mechanistic", "in_vitro", "regulatory", "review", "expert_opinion", "unknown"],
      default: "unknown",
    },

    studyPopulation: {
      type: String,
      default: "",
      trim: true,
    },

    studyDesign: {
      type: String,
      default: "",
      trim: true,
    },

    finding: {
      type: String,
      required: true,
      trim: true,
    },

    limitations: {
      type: String,
      default: "",
      trim: true,
    },

    supportedClaims: [{ type: String, trim: true }],

    verificationStatus: {
      type: String,
      enum: ["unverified", "pending_review", "verified", "rejected"],
      default: "unverified",
      index: true,
    },

    verificationNotes: {
      type: String,
      default: "",
    },

    effect: {
      type: String,
      default: "",
      trim: true,
    },

    benefitType: {
      type: String,
      enum: ["benefit", "concern", "irritation", "comedogenic", "skin_type", "sensitivity", "other"],
      default: "benefit",
    },

    relevantConcerns: [{ type: String, trim: true }],
    relevantSkinTypes: [{ type: String, trim: true }],

    evidenceStrength: {
      type: String,
      enum: ["strong", "moderate", "weak", "unknown"],
      default: "unknown",
    },

    source: {
      type: String,
      default: "",
      trim: true,
    },

    reference: {
      type: String,
      default: "",
      trim: true,
    },

    publicationDate: {
      type: Date,
      default: null,
    },

    evidenceDate: {
      type: Date,
      default: null,
    },

    knowledgeBaseVersion: {
      type: String,
      default: KNOWLEDGE_BASE_VERSION,
    },

    notes: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

evidenceSchema.index({ ingredient: 1, effect: 1, source: 1 });
evidenceSchema.index({ pmid: 1 }, { sparse: true });
evidenceSchema.index({ doi: 1 }, { sparse: true });

const Evidence = mongoose.model("Evidence", evidenceSchema);
export default Evidence;
