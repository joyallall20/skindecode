import mongoose from "mongoose";

const productClickSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    productOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductOffer",
      required: true,
    },

    recommendation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recommendation",
      default: null,
    },

    clickedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  }
);

const ProductClick = mongoose.model(
  "ProductClick",
  productClickSchema
);

export default ProductClick;