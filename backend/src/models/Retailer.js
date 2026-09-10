import mongoose from "mongoose";

const retailerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    logo: {
      type: String,
      default: null,
    },

    website: {
      type: String,
      default: null,
    },

    affiliateProgram: {
      type: Boolean,
      default: false,
    },

    discoveryConfig: {
      enabled: { type: Boolean, default: true },
      domain: { type: String, default: "" },
      searchUrlTemplate: { type: String, default: "" },
      country: { type: String, default: "in" },
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

const Retailer = mongoose.model(
  "Retailer",
  retailerSchema
);

export default Retailer;