import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductClick from '../models/ProductClick.js';
import ProductOffer from '../models/ProductOffer.js';
import { isCustomerFacingOffer } from '../utils/offerPresentation.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const trackProductClick = asyncHandler(async (req, res) => {
  const { product, productOffer, recommendation } = req.body;

  if (!product || !productOffer) {
    throw new ApiError(400, 'Product and offer are required.');
  }

  if (!mongoose.Types.ObjectId.isValid(product)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  if (!mongoose.Types.ObjectId.isValid(productOffer)) {
    throw new ApiError(400, 'Invalid product offer ID.');
  }

  if (recommendation && !mongoose.Types.ObjectId.isValid(recommendation)) {
    throw new ApiError(400, 'Invalid recommendation ID.');
  }

  const existingProduct = await Product.findById(product).lean();
  if (!existingProduct) {
    throw new ApiError(404, 'Product not found.');
  }

  if (!existingProduct.isActive) {
    throw new ApiError(400, 'This product is inactive and cannot be clicked.');
  }

  const offer = await ProductOffer.findById(productOffer).lean();
  if (!offer) {
    throw new ApiError(404, 'Product offer not found.');
  }

  if (offer.product.toString() !== product) {
    throw new ApiError(400, 'The selected offer does not belong to this product.');
  }

  if (!isCustomerFacingOffer(offer)) {
    throw new ApiError(400, 'Only approved affiliate offers can be tracked.');
  }

  await ProductClick.create({
    user: req.user?._id || null,
    product,
    productOffer,
    recommendation: recommendation || null,
    clickedAt: new Date(),
  });

  res.status(201).json({
    success: true,
    data: {
      tracked: true,
      product,
      productOffer,
    },
  });
});

export default {
  trackProductClick,
};
