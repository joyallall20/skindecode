import mongoose from 'mongoose';
import Ingredient from '../models/Ingredient.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const buildIngredientQuery = (req) => {
  const { search, isActive, limit = 12, page = 1 } = req.query;
  const query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { aliases: { $in: [new RegExp(search, 'i')] } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  return { query, limit: Number(limit), page: Number(page) };
};

export const getIngredients = asyncHandler(async (req, res) => {
  const { query, limit, page } = buildIngredientQuery(req);
  const [ingredients, total] = await Promise.all([
    Ingredient.find(query).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ingredient.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: ingredients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getIngredientById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ingredient ID.');
  }

  const ingredient = await Ingredient.findById(id).lean();
  if (!ingredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  res.status(200).json({ success: true, data: ingredient });
});

export const searchIngredients = asyncHandler(async (req, res) => {
  const { q = '', limit = 10 } = req.query;
  const term = String(q).trim();
  if (!term) {
    return res.status(200).json({ success: true, data: [] });
  }

  const ingredients = await Ingredient.find({
    $or: [
      { name: { $regex: term, $options: 'i' } },
      { aliases: { $in: [new RegExp(term, 'i')] } },
    ],
    isActive: true,
  }).limit(Number(limit)).lean();

  res.status(200).json({ success: true, data: ingredients });
});

export const createIngredient = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { name, aliases, description, benefits, suitableFor, concerns, potentialIrritant, irritationLevel, comedogenicRating, categories } = req.body;
  if (!name) {
    throw new ApiError(400, 'Ingredient name is required.');
  }

  const ingredient = await Ingredient.create({
    name,
    aliases: aliases || [],
    description: description || '',
    benefits: benefits || [],
    suitableFor: suitableFor || [],
    concerns: concerns || [],
    potentialIrritant: Boolean(potentialIrritant),
    irritationLevel: irritationLevel || 'unknown',
    comedogenicRating: comedogenicRating ?? null,
    categories: categories || [],
  });

  res.status(201).json({ success: true, data: ingredient });
});

export const updateIngredient = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ingredient ID.');
  }

  const ingredient = await Ingredient.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
  if (!ingredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  res.status(200).json({ success: true, data: ingredient });
});

export const deleteIngredient = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ingredient ID.');
  }

  const ingredient = await Ingredient.findByIdAndDelete(id);
  if (!ingredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  res.status(200).json({ success: true, message: 'Ingredient deleted successfully.' });
});

export const toggleIngredientStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ingredient ID.');
  }

  const ingredient = await Ingredient.findById(id);
  if (!ingredient) {
    throw new ApiError(404, 'Ingredient not found.');
  }

  ingredient.isActive = !ingredient.isActive;
  await ingredient.save();

  res.status(200).json({ success: true, data: ingredient });
});

export default {
  getIngredients,
  getIngredientById,
  searchIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  toggleIngredientStatus,
};
