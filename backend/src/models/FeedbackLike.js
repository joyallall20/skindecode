import mongoose from "mongoose";

const feedbackLikeSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index to prevent duplicate likes
feedbackLikeSchema.index({ feedbackId: 1, userId: 1 }, { unique: true });

const FeedbackLike = mongoose.model("FeedbackLike", feedbackLikeSchema);

export default FeedbackLike;