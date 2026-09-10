import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    aliases: [
      {
        type: String,
        trim: true,
      },
    ],

    description: {
      type: String,
      default: "",
    },

    benefits: [
      {
        type: String,
        trim: true,
      },
    ],

    suitableFor: [
      {
        type: String,
        enum: [
          "oily",
          "dry",
          "combination",
          "normal",
          "sensitive",
        ],
      },
    ],

    concerns: [
      {
        type: String,
        trim: true,
      },
    ],

    potentialIrritant: {
      type: Boolean,
      default: false,
    },

    irritationLevel: {
      type: String,
      enum: [
        "none",
        "low",
        "medium",
        "high",
        "unknown",
      ],
      default: "unknown",
    },

    comedogenicRating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },

    categories: [
      {
        type: String,
        trim: true,
      },
    ],

    embedding: {
      type: [Number],
      default: undefined,
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

const Ingredient = mongoose.model(
  "Ingredient",
  ingredientSchema
);

export default Ingredient;