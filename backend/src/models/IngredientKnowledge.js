import mongoose from 'mongoose';
import { KNOWLEDGE_BASE_VERSION } from '../constants/intelligenceVersions.js';
import { applyNormalizedLookupFields } from '../schemas/ingredientKnowledgeSchema.js';
import { slugifyIngredientKey } from '../utils/ingredientNormalize.js';

const sourceSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  authorsAndYear: { type: String, default: '' },
  journal: { type: String, default: '' },
  identifier: { type: String, default: '' },
  type: { type: String, default: '' },
  finding: { type: String, default: '' },
  limitations: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  rawCitation: { type: String, default: '' },
}, { _id: false });

const changeHistorySchema = new mongoose.Schema({
  version: { type: Number, required: true },
  previousVersion: { type: Number, default: null },
  changedFields: [{ type: String }],
  reason: { type: String, default: '' },
  researchSources: { type: mongoose.Schema.Types.Mixed, default: [] },
  provider: { type: String, default: null },
  model: { type: String, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const ingredientKnowledgeSchema = new mongoose.Schema(
  {
    ingredient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingredient',
      default: null,
      index: true,
    },

    ingredientKey: {
      type: String,
      trim: true,
    },
    name: { type: String, default: '', trim: true },
    inciName: { type: String, default: '', trim: true },
    synonyms: [{ type: String, trim: true }],
    cas: { type: String, default: null, trim: true },

    normalizedName: { type: String, default: '', index: true },
    normalizedInciName: { type: String, default: '', index: true },
    normalizedSynonyms: [{ type: String, trim: true }],
    normalizedCas: { type: String, default: '', index: true },

    functions: [{ type: String, trim: true }],
    primaryFunction: { type: String, default: null, trim: true },
    mechanism: { type: String, default: '' },
    evidenceByConcern: { type: mongoose.Schema.Types.Mixed, default: {} },
    skinTypeRelevance: { type: mongoose.Schema.Types.Mixed, default: {} },
    sensitiveSkinAssessment: { type: String, default: '' },
    irritationSensitization: { type: String, default: '' },
    barrierEffects: { type: String, default: '' },
    interactionsFormulation: { type: String, default: '' },
    specialPopulations: { type: String, default: '' },
    marketingClaimsVsScientificEvidence: { type: String, default: '' },

    evidenceLevel: { type: String, default: null, trim: true },
    generalFlag: { type: String, default: null, trim: true },
    confidence: { type: Number, min: 0, max: 1, default: null },
    flagReason: { type: String, default: '' },
    scientificSummary: { type: String, default: '' },
    uncertaintiesResearchGaps: { type: String, default: '' },
    sources: { type: [sourceSchema], default: [] },
    sourcePages: { type: [mongoose.Schema.Types.Mixed], default: [] },

    researchStatus: {
      type: String,
      enum: ['research_needed', 'researching', 'draft', 'pending_review', 'verified', 'rejected', 'failed'],
      default: 'research_needed',
      index: true,
    },
    researchProvider: { type: String, default: null },
    researchedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },

    origin: { type: String, default: 'manual', trim: true },
    version: { type: Number, default: 1 },
    previousVersion: { type: Number, default: null },
    changeHistory: { type: [changeHistorySchema], default: [] },

    originalResearchText: { type: String, default: '' },
    knowledgeBaseVersion: { type: String, default: KNOWLEDGE_BASE_VERSION },
    evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ingredientKnowledgeSchema.index({ ingredientKey: 1 }, { unique: true, sparse: true });
ingredientKnowledgeSchema.index({ ingredient: 1, researchStatus: 1 });
ingredientKnowledgeSchema.index({ normalizedSynonyms: 1 });

ingredientKnowledgeSchema.pre('validate', function applyLookupFields() {
  if (!this.ingredientKey && (this.inciName || this.name)) {
    this.ingredientKey = slugifyIngredientKey(this.inciName || this.name);
  }
  const normalized = applyNormalizedLookupFields({
    name: this.name,
    inciName: this.inciName,
    synonyms: this.synonyms,
    cas: this.cas,
  });
  this.normalizedName = normalized.normalizedName;
  this.normalizedInciName = normalized.normalizedInciName;
  this.normalizedSynonyms = normalized.normalizedSynonyms;
  this.normalizedCas = normalized.normalizedCas;
});

const IngredientKnowledge = mongoose.model('IngredientKnowledge', ingredientKnowledgeSchema);
export default IngredientKnowledge;
