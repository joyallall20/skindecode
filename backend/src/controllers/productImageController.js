import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isAllowedImageBuffer } from '../utils/productImageValidation.js';
import {
  uploadProductImage as uploadToCloudinary,
  deleteProductImage as deleteFromCloudinary,
} from '../services/cloudinaryService.js';
import {
  createStoredProductImage,
  findProductImage,
  normalizeProductImages,
} from '../utils/productImages.js';

export const uploadProductImage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  if (!req.file) {
    throw new ApiError(400, 'An image file is required. Use multipart field name "file".');
  }

  if (!isAllowedImageBuffer(req.file.buffer, req.file.mimetype)) {
    throw new ApiError(400, 'File content does not match an allowed image type.');
  }

  const uploaded = await (req.services?.uploadProductImage || uploadToCloudinary)(req.file);
  const images = normalizeProductImages(product.images);
  const image = createStoredProductImage({
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
    isPrimary: images.length === 0,
  });

  images.push(image);
  product.images = images;
  await product.save();

  res.status(201).json({
    success: true,
    data: {
      image,
      images: normalizeProductImages(product.images),
    },
  });
});

export const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }
  if (!imageId) {
    throw new ApiError(400, 'Image ID is required.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const images = normalizeProductImages(product.images);
  const image = findProductImage(images, imageId);
  if (!image) {
    throw new ApiError(404, 'Product image not found.');
  }

  if (image.publicId) {
    const deletion = await (req.services?.deleteProductImage || deleteFromCloudinary)(image.publicId);
    if (!deletion.deleted) {
      console.error('[cloudinary] image was removed from MongoDB after a Cloudinary delete warning', {
        productId: id,
        publicId: image.publicId,
        reason: deletion.reason,
      });
    }
  }

  const remaining = images.filter((entry) => {
    if (image._id && entry._id) return String(entry._id) !== String(image._id);
    if (image.publicId) return entry.publicId !== image.publicId;
    return entry.url !== image.url;
  });

  if (remaining.length && !remaining.some((entry) => entry.isPrimary)) {
    remaining[0].isPrimary = true;
  }

  product.images = remaining;
  await product.save();

  res.status(200).json({
    success: true,
    data: {
      images: normalizeProductImages(product.images),
    },
  });
});

export const setPrimaryProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }
  if (!imageId) {
    throw new ApiError(400, 'Image ID is required.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const images = normalizeProductImages(product.images);
  const target = findProductImage(images, imageId);
  if (!target) {
    throw new ApiError(404, 'Product image not found.');
  }

  product.images = images.map((image) => ({
    ...image,
    isPrimary: (image._id && target._id && String(image._id) === String(target._id))
      || (target.publicId && image.publicId === target.publicId)
      || (!target._id && !target.publicId && image.url === target.url),
  }));
  await product.save();

  res.status(200).json({
    success: true,
    data: {
      images: normalizeProductImages(product.images),
    },
  });
});

export default {
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
};
