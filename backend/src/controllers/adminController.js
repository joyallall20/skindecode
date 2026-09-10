import Product from "../models/Product.js";
import ProductImport from "../models/ProductImport.js";
import ProductClick from "../models/ProductClick.js";
import Recommendation from "../models/Recommendation.js";
import User from "../models/User.js";
import Ingredient from "../models/Ingredient.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const [
    totalUsers,
    totalActiveProducts,
    totalIngredients,
    pendingImports,
    totalRecommendations,
    totalClicks,
  ] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Ingredient.countDocuments({ isActive: true }),
    ProductImport.countDocuments({ status: "pending" }),
    Recommendation.countDocuments(),
    ProductClick.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalActiveProducts,
      totalIngredients,
      pendingImports,
      totalRecommendations,
      totalClicks,
    },
  });
});

export const getRecentImports = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const imports = await ProductImport.find()
    .populate("submittedBy", "name email")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.status(200).json({ success: true, data: imports });
});

export const getProductStats = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const stats = await Product.aggregate([
    {
      $group: {
        _id: "$isActive",
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({ success: true, data: stats });
});

export const getClickStats = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const clicks = await ProductClick.aggregate([
    {
      $lookup: {
        from: "productoffers",
        localField: "productOffer",
        foreignField: "_id",
        as: "offer",
      },
    },
    { $unwind: { path: "$offer", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "retailers",
        localField: "offer.retailer",
        foreignField: "_id",
        as: "retailer",
      },
    },
    { $unwind: { path: "$retailer", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$retailer.name",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({ success: true, data: clicks });
});

export const getUserStats = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin access required.");
  }

  const [totalUsers, activeUsers, adminUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: "admin" }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      adminUsers,
    },
  });
});

export default {
  getDashboardStats,
  getRecentImports,
  getProductStats,
  getClickStats,
  getUserStats,
};
