import mongoose from "mongoose";

const sellerDiscoveryCandidateSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },

    productImport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductImport",
      default: null,
      index: true,
    },

    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Retailer",
      default: null,
    },

    retailerName: {
      type: String,
      default: "",
      trim: true,
    },

    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },

    extractedName: {
      type: String,
      default: "",
    },

    extractedBrand: {
      type: String,
      default: "",
    },

    variant: {
      type: String,
      default: "",
    },

    size: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      default: null,
    },

    currency: {
      type: String,
      default: "INR",
    },

    inStock: {
      type: Boolean,
      default: null,
    },

    identifiers: {
      sku: String,
      upc: String,
      ean: String,
      gtin: String,
      mpn: String,
      retailerProductId: String,
    },

    matchResult: {
      sameProduct: { type: Boolean, default: false },
      confidence: { type: Number, min: 0, max: 1, default: 0 },
      variantMatch: { type: Boolean, default: false },
      sizeMatch: { type: Boolean, default: false },
      reasoning: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: ["discovered", "accepted", "rejected", "offer_created"],
      default: "discovered",
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    linkedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductOffer",
      default: null,
    },

    discoverySource: {
      type: String,
      default: "firecrawl_search",
    },

    aiProvider: {
      type: String,
      default: "",
    },

    aiModel: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

sellerDiscoveryCandidateSchema.index({ product: 1, sourceUrl: 1 }, { unique: true, sparse: true });
sellerDiscoveryCandidateSchema.index({ productImport: 1, sourceUrl: 1 }, { unique: true, sparse: true });

const SellerDiscoveryCandidate = mongoose.model("SellerDiscoveryCandidate", sellerDiscoveryCandidateSchema);
export default SellerDiscoveryCandidate;
