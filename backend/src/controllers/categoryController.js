import mongoose from 'mongoose';
import Category from '../models/Category.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  const [categories, total] = await Promise.all([
    Category.find(query).populate('parentCategory', 'name').sort({ name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean(),
    Category.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: categories,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let category = null;
  if (/^[a-fA-F0-9]{24}$/.test(String(id))) {
    category = await Category.findById(id).populate('parentCategory', 'name').lean();
  } else {
    category = await Category.findOne({ name: String(id || '').trim() }).populate('parentCategory', 'name').lean();
  }
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  res.status(200).json({ success: true, data: category });
});

export const createCategory = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { name, slug, description, parentCategory } = req.body;
  if (!name || !slug) {
    throw new ApiError(400, 'Category name and slug are required.');
  }

  const existing = await Category.findOne({ $or: [{ name }, { slug: String(slug).toLowerCase() }] });
  if (existing) {
    throw new ApiError(409, 'Category already exists.');
  }

  const category = await Category.create({
    name,
    slug: String(slug).toLowerCase(),
    description: description || '',
    parentCategory: parentCategory || null,
  });

  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid category ID.');
  }

  const category = await Category.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  res.status(200).json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid category ID.');
  }

  const category = await Category.findByIdAndDelete(id);
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  res.status(200).json({ success: true, message: 'Category deleted successfully.' });
});

export const toggleCategoryStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid category ID.');
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found.');
  }

  category.isActive = !category.isActive;
  await category.save();

  res.status(200).json({ success: true, data: category });
});

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
};
