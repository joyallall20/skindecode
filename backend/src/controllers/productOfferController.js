import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductOffer from '../models/ProductOffer.js';
import Retailer from '../models/Retailer.js';
import { sanitizeOffersForCustomer, getBestCustomerOffer } from '../utils/offerPresentation.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getProductOffers = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const query = {};
  const isAdmin = req.user && req.user.role === 'admin';

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(400, 'Invalid product ID.');
    }
    query.product = productId;
  }

  const product = productId ? await Product.findById(productId).lean() : null;
  if (productId && !product) {
    throw new ApiError(404, 'Product not found.');
  }

  if (productId && !product.isActive && !isAdmin) {
    throw new ApiError(404, 'Product not found.');
  }

  if (!isAdmin) {
    query.isActive = true;
  }

  const offers = await ProductOffer.find(query)
    .populate('product', 'name slug isActive')
    .populate('retailer', 'name slug website affiliateProgram')
    .lean();

  const responseOffers = isAdmin ? offers : sanitizeOffersForCustomer(offers);

  res.status(200).json({ success: true, data: responseOffers });
});

// Batched retailer offers for a set of products in one request, so a
// product listing page doesn't issue one getProductOffers() call per
// card. Reuses the same ProductOffer query + sanitizeOffersForCustomer
// shaping as the single-product endpoint above - no second pricing
// model, no ranking/discount logic.
export const getProductOffersBatch = asyncHandler(async (req, res) => {
  const isAdmin = req.user && req.user.role === 'admin';

  const rawIds = String(req.query.productIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const productIds = [...new Set(rawIds)].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (productIds.length === 0) {
    return res.status(200).json({ success: true, data: {} });
  }

  const query = { product: { $in: productIds } };
  if (!isAdmin) {
    query.isActive = true;
  }

  const offers = await ProductOffer.find(query)
    .populate('product', 'name slug isActive')
    .populate('retailer', 'name slug website affiliateProgram')
    .lean();

  const responseOffers = isAdmin ? offers : sanitizeOffersForCustomer(offers);

  const groupedByProductId = {};
  responseOffers.forEach((offer) => {
    const key = String(offer.product?._id ?? offer.product ?? '');
    if (!key) return;
    if (!groupedByProductId[key]) groupedByProductId[key] = [];
    groupedByProductId[key].push(offer);
  });

  res.status(200).json({ success: true, data: groupedByProductId });
});

export const createProductOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to create product offers.');
  }

  const { product, retailer, url, originalUrl, affiliateUrl, price, currency, inStock, lastPriceCheck, isActive, linkType } = req.body;
  const productId = req.params.productId || product;

  const originalProductUrl = originalUrl || url;
  if (!productId || !retailer || !originalProductUrl || price === undefined) {
    throw new ApiError(400, 'Product, retailer, original URL, and price are required.');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  if (!mongoose.Types.ObjectId.isValid(retailer)) {
    throw new ApiError(400, 'Invalid retailer ID.');
  }

  const existingProduct = await Product.findById(productId);
  if (!existingProduct) {
    throw new ApiError(404, 'Product not found.');
  }

  const existingRetailer = await Retailer.findById(retailer);
  if (!existingRetailer) {
    throw new ApiError(404, 'Retailer not found.');
  }

  const duplicateOffer = await ProductOffer.findOne({ product: productId, retailer });
  if (duplicateOffer) {
    throw new ApiError(409, 'An active offer for this product and retailer already exists.');
  }

  const offer = await ProductOffer.create({
    product: productId,
    retailer,
    url: affiliateUrl || originalProductUrl,
    originalUrl: originalProductUrl,
    affiliateUrl: affiliateUrl || null,
    linkType: linkType || (affiliateUrl ? 'affiliate' : 'direct'),
    price: Number(price),
    currency: currency || 'INR',
    inStock: inStock !== undefined ? Boolean(inStock) : true,
    lastPriceCheck: lastPriceCheck || new Date(),
    isActive: affiliateUrl ? Boolean(isActive !== false) : false,
  });

  res.status(201).json({ success: true, data: offer });
});

export const updateProductOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to update product offers.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid offer ID.');
  }

  const offer = await ProductOffer.findById(id);
  if (!offer) {
    throw new ApiError(404, 'Product offer not found.');
  }

  const allowed = ['product', 'retailer', 'url', 'originalUrl', 'affiliateUrl', 'linkType', 'price', 'currency', 'inStock', 'lastPriceCheck', 'isActive'];
  const invalidFields = Object.keys(req.body).filter((key) => !allowed.includes(key));
  if (invalidFields.length) {
    throw new ApiError(400, `Invalid offer fields: ${invalidFields.join(', ')}`);
  }

  const nextAffiliateUrl = req.body.affiliateUrl !== undefined ? req.body.affiliateUrl : offer.affiliateUrl;
  const nextLinkType = req.body.linkType !== undefined ? req.body.linkType : offer.linkType;
  const nextIsActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : offer.isActive;

  if (nextIsActive) {
    if (!nextAffiliateUrl || !String(nextAffiliateUrl).trim()) {
      throw new ApiError(400, 'An approved affiliate URL is required to activate an offer.');
    }
    if (nextLinkType !== 'affiliate') {
      throw new ApiError(400, 'Only affiliate offers can be activated for customers.');
    }
  }

  if (req.body.linkType === 'affiliate' && !nextAffiliateUrl) {
    throw new ApiError(400, 'Affiliate link type requires an affiliate URL.');
  }

  Object.assign(offer, req.body);
  if (nextIsActive) {
    offer.linkType = 'affiliate';
    offer.url = nextAffiliateUrl;
    offer.isActive = true;
  } else if (req.body.isActive === false) {
    offer.isActive = false;
  }

  await offer.save();

  res.status(200).json({ success: true, data: offer });
});

export const deleteProductOffer = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to delete product offers.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid offer ID.');
  }

  const offer = await ProductOffer.findByIdAndDelete(id);
  if (!offer) {
    throw new ApiError(404, 'Product offer not found.');
  }

  res.status(200).json({ success: true, message: 'Product offer deleted successfully.' });
});

export default {
  getProductOffers,
  getProductOffersBatch,
  createProductOffer,
  updateProductOffer,
  deleteProductOffer,
};