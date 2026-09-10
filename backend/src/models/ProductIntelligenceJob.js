import mongoose from 'mongoose';

const productIntelligenceJobSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'generating', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    error: {
      type: String,
      default: null,
    },
    createdAt: {
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
  },
  { timestamps: true }
);

productIntelligenceJobSchema.index(
  { product: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['queued', 'generating'] } },
  }
);

export default mongoose.models.ProductIntelligenceJob
  || mongoose.model('ProductIntelligenceJob', productIntelligenceJobSchema);
