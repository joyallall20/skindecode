import mongoose from 'mongoose';

const chatUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // One record per user per calendar day.
    // UTC keeps the reset deterministic across servers.
    dateKey: {
      type: String,
      required: true,
    },

    // Number of AI-consuming messages used today.
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Very important:
// prevents two usage documents for the same user/day.
chatUsageSchema.index(
  { user: 1, dateKey: 1 },
  { unique: true }
);

export default mongoose.model('ChatUsage', chatUsageSchema);