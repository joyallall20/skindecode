import mongoose from 'mongoose';
import Recommendation from '../models/Recommendation.js';
import { generateRecommendationsForUser, getLatestRecommendationsForUser } from '../services/recommendationService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const generateRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required.');
  }

  const recommendation = await generateRecommendationsForUser(userId, { limit: Number(req.body?.limit || 5) });

  res.status(201).json({
    success: true,
    data: recommendation,
  });
});

export const getLatestRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const latest = await getLatestRecommendationsForUser(userId);

  res.status(200).json({
    success: true,
    data: latest,
  });
});

export const getRecommendationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid recommendation ID.');
  }

  const recommendation = await Recommendation.findById(id)
    .populate({
      path: 'products.product',
      populate: [{ path: 'brand' }, { path: 'category' }, { path: 'ingredients' }, { path: 'keyIngredients' }],
    })
    .lean();

  if (!recommendation) {
    throw new ApiError(404, 'Recommendation not found.');
  }

  if (recommendation.user?.toString() !== req.user?._id?.toString()) {
    throw new ApiError(403, 'You do not have access to this recommendation.');
  }

  res.status(200).json({
    success: true,
    data: recommendation,
  });
});

export const getProductRecommendationDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid recommendation ID.');
  }

  const recommendation = await Recommendation.findById(id)
    .populate({
      path: 'products.product',
      populate: [{ path: 'brand' }, { path: 'category' }, { path: 'ingredients' }, { path: 'keyIngredients' }],
    })
    .lean();

  if (!recommendation) {
    throw new ApiError(404, 'Recommendation not found.');
  }

  if (recommendation.user?.toString() !== req.user?._id?.toString()) {
    throw new ApiError(403, 'You do not have access to this recommendation.');
  }

  res.status(200).json({
    success: true,
    data: recommendation.products,
  });
});

export default {
  generateRecommendations,
  getLatestRecommendations,
  getRecommendationById,
  getProductRecommendationDetails,
};
