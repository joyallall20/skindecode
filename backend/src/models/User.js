import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },

    skinProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkinProfile",
      default: null,
    },

    preferences: {
      preferredBrands: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Brand",
        },
      ],

      preferredRetailers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Retailer",
        },
      ],

      currency: {
        type: String,
        default: "INR",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;