import mongoose from 'mongoose';
import Retailer from '../models/Retailer.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getRetailers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const query = {};

  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  const [retailers, total] = await Promise.all([
    Retailer.find(query).sort({ name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).lean(),
    Retailer.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: retailers,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
});

export const getRetailerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid retailer ID.');
  }

  const retailer = await Retailer.findById(id).lean();
  if (!retailer) {
    throw new ApiError(404, 'Retailer not found.');
  }

  res.status(200).json({ success: true, data: retailer });
});

export const createRetailer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { name, slug, logo, website, affiliateProgram } = req.body;
  if (!name || !slug) {
    throw new ApiError(400, 'Retailer name and slug are required.');
  }

  const existing = await Retailer.findOne({ $or: [{ name }, { slug: String(slug).toLowerCase() }] });
  if (existing) {
    throw new ApiError(409, 'Retailer already exists.');
  }

  const retailer = await Retailer.create({
    name,
    slug: String(slug).toLowerCase(),
    logo: logo || null,
    website: website || null,
    affiliateProgram: Boolean(affiliateProgram),
  });

  res.status(201).json({ success: true, data: retailer });
});

export const updateRetailer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid retailer ID.');
  }

  const retailer = await Retailer.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true });
  if (!retailer) {
    throw new ApiError(404, 'Retailer not found.');
  }

  res.status(200).json({ success: true, data: retailer });
});

export const deleteRetailer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid retailer ID.');
  }

  const retailer = await Retailer.findByIdAndDelete(id);
  if (!retailer) {
    throw new ApiError(404, 'Retailer not found.');
  }

  res.status(200).json({ success: true, message: 'Retailer deleted successfully.' });
});

export const toggleRetailerStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid retailer ID.');
  }

  const retailer = await Retailer.findById(id);
  if (!retailer) {
    throw new ApiError(404, 'Retailer not found.');
  }

  retailer.isActive = !retailer.isActive;
  await retailer.save();

  res.status(200).json({ success: true, data: retailer });
});

export default {
  getRetailers,
  getRetailerById,
  createRetailer,
  updateRetailer,
  deleteRetailer,
  toggleRetailerStatus,
};
