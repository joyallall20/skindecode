import mongoose from 'mongoose';

const ingredientResearchSchema = new mongoose.Schema(
  {
    ingredientName: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    ingredientKey: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    // Product category that caused this ingredient to be discovered.
    // Examples: sunscreen, moisturizer, toner.
    category: {
      type: String,
      default: 'general',
      trim: true,
      lowercase: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        'research_needed',
        'researching',
        'pending_review',
        'approved',
        'rejected',
        'failed',
      ],
      default: 'research_needed',
      index: true,
    },

    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    firstDetectedAt: {
      type: Date,
      default: Date.now,
    },

    lastDetectedAt: {
      type: Date,
      default: Date.now,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    researchAttempts: {
      type: Number,
      default: 0,
    },

    provider: {
      type: String,
      default: null,
    },

    model: {
      type: String,
      default: null,
    },

    researchResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    proposedKnowledge: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    error: {
      type: String,
      default: '',
    },

    targetKnowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IngredientKnowledge',
      default: null,
    },

    isUpdate: {
      type: Boolean,
      default: false,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNotes: {
      type: String,
      default: '',
    },

    approvedKnowledgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IngredientKnowledge',
      default: null,
    },
  },
  { timestamps: true }
);

ingredientResearchSchema.index({
  normalizedName: 1,
  category: 1,
  status: 1,
});

const IngredientResearch =
  mongoose.models.IngredientResearch ||
  mongoose.model('IngredientResearch', ingredientResearchSchema);

export default IngredientResearch;