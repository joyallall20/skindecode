import mongoose from 'mongoose';
import Brand from '../models/Brand.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getBrands = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, search } = req.query;
  const query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  const [brands, total] = await Promise.all([
    Brand.find(query).sort({ name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean(),
    Brand.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: brands,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getBrandById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let brand = null;
  if (/^[a-fA-F0-9]{24}$/.test(String(id))) {
    brand = await Brand.findById(id).lean();
  } else {
    brand = await Brand.findOne({ name: String(id || '').trim() }).lean();
  }
  if (!brand) {
    throw new ApiError(404, 'Brand not found.');
  }

  res.status(200).json({ success: true, data: brand });
});

export const createBrand = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { name, slug, logo, website, description } = req.body;
  if (!name || !slug) {
    throw new ApiError(400, 'Brand name and slug are required.');
  }

  const existing = await Brand.findOne({ $or: [{ name }, { slug: String(slug).toLowerCase() }] });
  if (existing) {
    throw new ApiError(409, 'Brand already exists.');
  }

  const brand = await Brand.create({
    name,
    slug: String(slug).toLowerCase(),
    logo: logo || null,
    website: website || null,
    description: description || '',
  });

  res.status(201).json({ success: true, data: brand });
});

export const updateBrand = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid brand ID.');
  }

  const brand = await Brand.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
  if (!brand) {
    throw new ApiError(404, 'Brand not found.');
  }

  res.status(200).json({ success: true, data: brand });
});

export const deleteBrand = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid brand ID.');
  }

  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) {
    throw new ApiError(404, 'Brand not found.');
  }

  res.status(200).json({ success: true, message: 'Brand deleted successfully.' });
});

export const toggleBrandStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid brand ID.');
  }

  const brand = await Brand.findById(id);
  if (!brand) {
    throw new ApiError(404, 'Brand not found.');
  }

  brand.isActive = !brand.isActive;
  await brand.save();

  res.status(200).json({ success: true, data: brand });
});

export default {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  toggleBrandStatus,
};
