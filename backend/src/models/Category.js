import mongoose from "mongoose";

const CATEGORY_CODES = [
  "CLEANSERS",
  "MOISTURIZERS",
  "SUNSCREENS",
  "SERUMS",
  "EXFOLIANTS",
  "TONERS_ESSENCES",
  "RETINOIDS_ANTI_AGING",
  "EYE_CREAMS_SERUMS",
  "FACE_MASKS",
  "FACIAL_OILS",
];

const categorySchema = new mongoose.Schema(
  {
    /*
     * Stable internal identifier.
     *
     * This is what backend logic, scraping, recommendation
     * ranking, and category matching should use.
     *
     * Example:
     *   code: "SUNSCREENS"
     *
     * The display name can change without breaking application logic.
     */
    code: {
      type: String,
      enum: CATEGORY_CODES,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },

    /*
     * Human-readable category name shown in the application.
     */
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    /*
     * URL / API friendly identifier.
     */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    /*
     * Optional description for admin/catalog usage.
     */
    description: {
      type: String,
      default: "",
      trim: true,
    },

    /*
     * Alternate names that may appear during scraping/import.
     *
     * Example for SUNSCREENS:
     * [
     *   "sunscreen",
     *   "sun screen",
     *   "sun protection",
     *   "spf"
     * ]
     *
     * These are NOT separate categories.
     */
    aliases: {
      type: [String],
      default: [],
      set: (values) =>
        Array.isArray(values)
          ? values
              .map((value) => String(value).trim().toLowerCase())
              .filter(Boolean)
          : [],
    },

    /*
     * Optional hierarchical category support.
     *
     * Currently the canonical categories can all exist at the
     * top level, but this keeps the schema extensible.
     */
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    /*
     * Controls the display/order of categories.
     */
    sortOrder: {
      type: Number,
      default: 0,
    },

    /*
     * Allows a category to be disabled without deleting it.
     */
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Canonical category definitions.
 *
 * These are the ONLY category concepts the application should use.
 */
export const CATEGORY_DEFINITIONS = [
  {
    code: "CLEANSERS",
    name: "Cleansers",
    slug: "cleansers",
    sortOrder: 1,
    aliases: [
      "cleanser",
      "face cleanser",
      "facial cleanser",
      "face wash",
      "facial wash",
      "cleansing foam",
      "cleansing gel",
      "cleansing oil",
      "cleansing balm",
    ],
  },

  {
    code: "MOISTURIZERS",
    name: "Moisturizers",
    slug: "moisturizers",
    sortOrder: 2,
    aliases: [
      "moisturizer",
      "moisturiser",
      "face moisturizer",
      "face moisturiser",
      "facial moisturizer",
      "facial moisturiser",
      "cream",
      "hydrating cream",
      "moisturizing cream",
    ],
  },

  {
    code: "SUNSCREENS",
    name: "Sunscreens",
    slug: "sunscreens",
    sortOrder: 3,
    aliases: [
      "sunscreen",
      "sun screen",
      "sun protection",
      "spf",
      "spf sunscreen",
      "sunblock",
      "sun block",
      "uv protection",
    ],
  },

  {
    code: "SERUMS",
    name: "Serums",
    slug: "serums",
    sortOrder: 4,
    aliases: [
      "serum",
      "face serum",
      "facial serum",
      "treatment serum",
      "active serum",
    ],
  },

  {
    code: "EXFOLIANTS",
    name: "Exfoliants",
    slug: "exfoliants",
    sortOrder: 5,
    aliases: [
      "exfoliant",
      "exfoliator",
      "exfoliation",
      "face scrub",
      "facial scrub",
      "scrub",
      "chemical exfoliant",
      "physical exfoliant",
      "aha",
      "bha",
      "pha",
    ],
  },

  {
    code: "TONERS_ESSENCES",
    name: "Toners & Essences",
    slug: "toners-essences",
    sortOrder: 6,
    aliases: [
      "toner",
      "face toner",
      "facial toner",
      "essence",
      "face essence",
      "facial essence",
      "toning lotion",
    ],
  },

  {
    code: "RETINOIDS_ANTI_AGING",
    name: "Retinoids & Anti-Aging",
    slug: "retinoids-anti-aging",
    sortOrder: 7,
    aliases: [
      "retinoid",
      "retinoids",
      "retinol",
      "retinal",
      "retinaldehyde",
      "anti aging",
      "anti-aging",
      "anti ageing",
      "anti-ageing",
      "age defense",
      "wrinkle treatment",
      "fine line treatment",
    ],
  },

  {
    code: "EYE_CREAMS_SERUMS",
    name: "Eye Creams & Serums",
    slug: "eye-creams-serums",
    sortOrder: 8,
    aliases: [
      "eye cream",
      "eye creams",
      "eye serum",
      "eye serums",
      "under eye cream",
      "under eye serum",
      "eye treatment",
    ],
  },

  {
    code: "FACE_MASKS",
    name: "Face Masks",
    slug: "face-masks",
    sortOrder: 9,
    aliases: [
      "face mask",
      "face masks",
      "facial mask",
      "facial masks",
      "sheet mask",
      "clay mask",
      "wash off mask",
      "overnight mask",
      "sleeping mask",
    ],
  },

  {
    code: "FACIAL_OILS",
    name: "Facial Oils",
    slug: "facial-oils",
    sortOrder: 10,
    aliases: [
      "facial oil",
      "face oil",
      "face oils",
      "facial oils",
      "facial treatment oil",
    ],
  },
];

const Category = mongoose.model("Category", categorySchema);

export { CATEGORY_CODES };

export default Category;