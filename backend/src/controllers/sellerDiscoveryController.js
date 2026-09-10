import mongoose from 'mongoose';
import ProductImport from '../models/ProductImport.js';
import ProductOffer from '../models/ProductOffer.js';
import Retailer from '../models/Retailer.js';
import SellerDiscoveryCandidate from '../models/SellerDiscoveryCandidate.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { discoverSellers } from '../services/sellerDiscoveryService.js';
import { isMongoId, loadPopulatedProduct } from '../services/productCatalogService.js';

export const runSellerDiscovery = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { productId, importId } = req.body || {};

  let canonicalProduct = null;
  let resolvedProductId = productId;
  let resolvedImportId = importId;

  if (productId && isMongoId(productId)) {
    canonicalProduct = await loadPopulatedProduct(productId);
    if (!canonicalProduct) throw new ApiError(404, 'Product not found.');
  } else if (importId && mongoose.Types.ObjectId.isValid(importId)) {
    const importDoc = await ProductImport.findById(importId).lean();
    if (!importDoc) throw new ApiError(404, 'Product import not found.');
    canonicalProduct = importDoc.extractedData;
    resolvedImportId = importId;
    resolvedProductId = importDoc.publishedProduct || null;
  } else {
    throw new ApiError(400, 'productId or importId is required.');
  }

  console.info('[seller-discovery] admin triggered', { productId: resolvedProductId, importId: resolvedImportId });

  const result = await discoverSellers({
    canonicalProduct,
    productId: resolvedProductId,
    productImportId: resolvedImportId,
  });

  res.status(200).json({ success: true, data: result });
});

export const getSellerCandidates = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { productId, importId, status } = req.query;
  const query = {};
  if (productId) {
    if (!isMongoId(productId)) throw new ApiError(400, 'Invalid product ID.');
    query.product = productId;
  }
  if (importId) query.productImport = importId;
  if (status) query.status = status;

  const candidates = await SellerDiscoveryCandidate.find(query)
    .populate('retailer', 'name slug website')
    .sort({ 'matchResult.confidence': -1 })
    .lean();

  res.status(200).json({ success: true, data: candidates });
});

export const updateSellerCandidate = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid candidate ID.');
  }

  const candidate = await SellerDiscoveryCandidate.findById(id);
  if (!candidate) throw new ApiError(404, 'Candidate not found.');

  const { status, price, currency, inStock, variant, size, affiliateUrl } = req.body || {};

  if (status) candidate.status = status;
  if (price !== undefined) candidate.price = price;
  if (currency) candidate.currency = currency;
  if (inStock !== undefined) candidate.inStock = inStock;
  if (variant) candidate.variant = variant;
  if (size) candidate.size = size;

  if (status === 'accepted' || status === 'rejected') {
    candidate.reviewedBy = req.user._id;
    candidate.reviewedAt = new Date();
  }

  await candidate.save();

  // If accepted with affiliate URL, create draft offer (not customer-facing until affiliate set)
  if (status === 'accepted' && candidate.product) {
    const retailerId = candidate.retailer;
    if (retailerId && candidate.price !== null) {
      const offer = await ProductOffer.findOneAndUpdate(
        { product: candidate.product, retailer: retailerId },
        {
          $set: {
            product: candidate.product,
            retailer: retailerId,
            url: affiliateUrl || candidate.sourceUrl,
            originalUrl: candidate.sourceUrl,
            affiliateUrl: affiliateUrl || null,
            linkType: affiliateUrl ? 'affiliate' : 'direct',
            price: candidate.price,
            currency: candidate.currency || 'INR',
            inStock: candidate.inStock ?? true,
            lastPriceCheck: new Date(),
            isActive: Boolean(affiliateUrl),
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      candidate.linkedOffer = offer._id;
      candidate.status = 'offer_created';
      await candidate.save();
    }
  }

  res.status(200).json({ success: true, data: candidate });
});

export const deleteSellerCandidate = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  const candidate = await SellerDiscoveryCandidate.findByIdAndDelete(id);
  if (!candidate) throw new ApiError(404, 'Candidate not found.');
  res.status(200).json({ success: true, message: 'Candidate removed.' });
});

export default { runSellerDiscovery, getSellerCandidates, updateSellerCandidate, deleteSellerCandidate };
