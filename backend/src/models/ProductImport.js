import mongoose from "mongoose";

const productImportSchema = new mongoose.Schema(
  {
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "review",
        "approved",
        "rejected",
        "failed",
      ],
      default: "pending",
      index: true,
    },

    extractedData: {
      name: {
        type: String,
        default: "",
      },

      brand: {
        type: String,
        default: "",
      },

      category: {
        type: String,
        default: "",
      },

      description: {
        type: String,
        default: "",
      },

      images: [
        {
          type: String,
        },
      ],

      ingredients: [
        {
          type: String,
        },
      ],

      keyIngredients: [
        {
          type: String,
        },
      ],

      ingredientSource: {
        type: String,
        default: null,
      },

      ingredientConfidence: {
        type: String,
        default: null,
      },

      skinTypes: [
        {
          type: String,
        },
      ],

      concerns: [
        {
          type: String,
        },
      ],

      fragranceFree: {
        type: Boolean,
        default: null,
      },

      alcoholFree: {
        type: Boolean,
        default: null,
      },

      essentialOilFree: {
        type: Boolean,
        default: null,
      },

      pregnancyFriendly: {
        type: Boolean,
        default: null,
      },

      variant: {
        type: String,
        default: "",
      },

      size: {
        type: String,
        default: "",
      },

      quantity: {
        type: String,
        default: "",
      },

      claims: [
        {
          type: String,
        },
      ],

      currency: {
        type: String,
        default: "INR",
      },

      inStock: {
        type: Boolean,
        default: null,
      },

      sku: {
        type: String,
        default: "",
      },

      upc: {
        type: String,
        default: "",
      },

      ean: {
        type: String,
        default: "",
      },

      gtin: {
        type: String,
        default: "",
      },

      mpn: {
        type: String,
        default: "",
      },

      retailerProductId: {
        type: String,
        default: "",
      },

      price: {
        type: Number,
        default: null,
      },

      retailer: {
        type: String,
        default: "",
      },
    },

    aiProvider: {
      type: String,
      default: "gemini",
    },

    aiModel: {
      type: String,
      default: "",
    },

    aiRawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
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

    publishedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ProductImport = mongoose.model(
  "ProductImport",
  productImportSchema
);

export default ProductImport;