import mongoose from "mongoose";

const skinKnowledgeChunkSchema = new mongoose.Schema(
  {
    // ============================================================
    // IDENTIFICATION
    // ============================================================

    // Stable unique ID for this exact chunk.
    // Example:
    // aloe_barbadensis_leaf_juice:concern:acne
    chunkKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // Stable ingredient identifier from the knowledge base.
    ingredientKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    ingredientName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    inciName: {
      type: String,
      default: null,
      trim: true,
    },

    // Knowledge domain/category.
    // Examples: sunscreen, moisturizer, toner, general.
    category: {
      type: String,
      default: 'general',
      trim: true,
      lowercase: true,
      index: true,
    },

    // ============================================================
    // CHUNK CLASSIFICATION
    // ============================================================

    // overview
    // concern
    // skin_type
    // safety
    // formulation
    // evidence
    chunkType: {
      type: String,
      required: true,
      enum: [
        "overview",
        "concern",
        "skin_type",
        "safety",
        "formulation",
        "evidence",
      ],
      index: true,
    },

    // Used primarily for concern chunks.
    // Examples:
    // acne, pigmentation, dryness, redness, aging
    concern: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },

    // Used primarily for skin_type chunks.
    // Examples:
    // oily, dry, combination, normal, sensitive
    skinType: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },

    // ============================================================
    // SEARCHABLE CONTENT
    // ============================================================

    // This is the actual text that gets embedded.
    text: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional normalized searchable text.
    // Useful for exact/keyword fallback retrieval.
    searchText: {
      type: String,
      default: "",
      index: true,
    },

    // ============================================================
    // VECTOR
    // ============================================================

    // Embedding generated from `text`.
    //
    // Do NOT hard-code the number of dimensions here.
    // The Atlas Vector Search index will enforce the dimension
    // corresponding to the embedding model we choose.
    embedding: {
      type: [Number],
      default: undefined,
    },

    embeddingModel: {
      type: String,
      default: null,
      trim: true,
    },

    embeddingDimensions: {
      type: Number,
      default: null,
    },

    // ============================================================
    // EVIDENCE / CLINICAL METADATA
    // ============================================================

    evidenceLevel: {
      type: String,
      enum: ["A", "B", "C", "D", "E", null],
      default: null,
      index: true,
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    generalFlag: {
      type: String,
      enum: [
        "Green",
        "Light Green",
        "Yellow",
        "Orange",
        "Red",
        null,
      ],
      default: null,
      index: true,
    },

    researchStatus: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },

    // ============================================================
    // SOURCE TRACEABILITY
    // ============================================================

    sourcePages: {
      type: [Number],
      default: [],
    },

    // Keep the source information available so the AI can explain
    // where evidence came from when required.
    sources: {
      type: [
        {
          title: {
            type: String,
            default: null,
          },

          authorsAndYear: {
            type: String,
            default: null,
          },

          journal: {
            type: String,
            default: null,
          },

          identifier: {
            type: String,
            default: null,
          },

          type: {
            type: String,
            default: null,
          },

          finding: {
            type: String,
            default: null,
          },

          limitations: {
            type: String,
            default: null,
          },

          rawCitation: {
            type: String,
            default: null,
          },
        },
      ],
      default: [],
    },

    // ============================================================
    // KNOWLEDGE BASE VERSIONING
    // ============================================================

    kbVersion: {
      type: String,
      required: true,
      default: "1.0.0",
      index: true,
    },

    sourceType: {
      type: String,
      required: true,
      default: "clinical_skincare_ingredient_knowledge",
      index: true,
    },

    // Allows us to distinguish chunks generated from different
    // knowledge sources later.
    sourceDocument: {
      type: String,
      default: "Clinical Skincare Ingredients Reference Guide",
      trim: true,
    },

    // ============================================================
    // STATUS
    // ============================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ================================================================
// COMPOUND INDEXES
// ================================================================

// Quickly retrieve all chunks belonging to an ingredient.
skinKnowledgeChunkSchema.index({
  ingredientKey: 1,
  isActive: 1,
});

// Retrieve category-scoped knowledge for a specific ingredient.
// Example: sunscreen + specific ingredient + active only.
skinKnowledgeChunkSchema.index({
  category: 1,
  isActive: 1,
  ingredientKey: 1,
});

// Useful for exact/filtered retrieval.
skinKnowledgeChunkSchema.index({
  chunkType: 1,
  concern: 1,
  isActive: 1,
});

// Useful for skin-type retrieval.
skinKnowledgeChunkSchema.index({
  chunkType: 1,
  skinType: 1,
  isActive: 1,
});

// Useful when rebuilding/reindexing a knowledge-base version.
skinKnowledgeChunkSchema.index({
  kbVersion: 1,
  sourceType: 1,
  isActive: 1,
});

// ================================================================
// MODEL
// ================================================================

const SkinKnowledgeChunk =
  mongoose.models.SkinKnowledgeChunk ||
  mongoose.model(
    "SkinKnowledgeChunk",
    skinKnowledgeChunkSchema
  );

export default SkinKnowledgeChunk;