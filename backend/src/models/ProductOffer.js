import mongoose from "mongoose";

const productOfferSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Retailer",
      required: true,
      index: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    originalUrl: {
      type: String,
      default: null,
      trim: true,
    },

    affiliateUrl: {
      type: String,
      default: null,
      trim: true,
    },

    linkType: {
      type: String,
      enum: ["direct", "affiliate"],
      default: "direct",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    inStock: {
      type: Boolean,
      default: true,
    },

    lastPriceCheck: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productOfferSchema.index(
  { product: 1, retailer: 1 },
  { unique: true }
);

const ProductOffer = mongoose.model(
  "ProductOffer",
  productOfferSchema
);

export default ProductOffer;