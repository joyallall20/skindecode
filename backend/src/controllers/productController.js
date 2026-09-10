import mongoose from 'mongoose';
import Product from '../models/Product.js';
import ProductIntelligenceJob from '../models/ProductIntelligenceJob.js';
import Brand from '../models/Brand.js';
import Category from '../models/Category.js';
import Ingredient from '../models/Ingredient.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { buildProductContext, getIntelligenceAuditInfo } from '../services/productIntelligenceService.js';
import { buildIntelligenceInputFromProduct } from '../utils/productIntelligenceInput.js';
import { presentProduct, presentProducts } from '../utils/productPresentation.js';
import { mergeIncomingProductImages, normalizeProductImages } from '../utils/productImages.js';
import { deleteProductImage as deleteFromCloudinary } from '../services/cloudinaryService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import {
  hasIntelligenceRelevantProductChanges,
  invalidateProductIntelligenceState,
} from '../services/productIntelligenceInvalidationService.js';
import { buildEditorProductFields, isMongoId, loadPopulatedProduct, repairProductCatalogRefs, syncProductOffers } from '../services/productCatalogService.js';
import { buildIngredientCoverage } from '../services/ingredientKnowledgeService.js';
import { startProductIntelligenceJob } from '../workers/productIntelligenceWorker.js';

const EDITOR_META_FIELDS = new Set(['purchaseOptions', 'ingredientListText']);

const buildProductQuery = async (req) => {
  const { search, brand, category, isActive, skinType, concern, minPrice, maxPrice, page = 1, limit = 12 } = req.query;
  const query = {};

  if (isActive === 'all' && req.user?.role === 'admin') {
    // Admin can request all products regardless of active status
  } else if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  } else {
    query.isActive = true;
  }

  if (brand) {
    if (isMongoId(brand)) {
      query.brand = brand;
    } else {
      const brandDoc = await Brand.findOne({ name: String(brand).trim() }).select('_id').lean();
      query.brand = brandDoc?._id || new mongoose.Types.ObjectId();
    }
  }
  if (category) {
    if (isMongoId(category)) {
      query.category = category;
    } else {
      const categoryDoc = await Category.findOne({ name: String(category).trim() }).select('_id').lean();
      query.category = categoryDoc?._id || new mongoose.Types.ObjectId();
    }
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { slug: { $regex: search, $options: 'i' } },
    ];
  }

  if (skinType) {
    query.skinTypes = skinType;
  }

  if (concern) {
    query.concerns = { $in: [concern] };
  }

  return { query, page: Number(page), limit: Number(limit) };
};

export const getProducts = asyncHandler(async (req, res) => {
  const { query, page, limit } = await buildProductQuery(req);

  const productIds = await Product.collection
    .find(query, { projection: { _id: 1 } })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  await Promise.all(productIds.map(({ _id }) => repairProductCatalogRefs(_id)));

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('brand', 'name slug')
      .populate('category', 'name slug')
      .populate('ingredients', 'name')
      .populate('keyIngredients', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: presentProducts(products, req),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await loadPopulatedProduct(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  if (!product.isActive && !(req.user && req.user.role === 'admin')) {
    throw new ApiError(404, 'Product not found.');
  }

  res.status(200).json({
    success: true,
    data: presentProduct(product, req),
  });
});

export const searchProducts = asyncHandler(async (req, res) => {
  const { q = '', limit = 10 } = req.query;
  const searchTerm = String(q).trim();

  if (!searchTerm) {
    return res.status(200).json({ success: true, data: [], pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 } });
  }

  const products = await Product.find({
    isActive: true,
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } },
      { slug: { $regex: searchTerm, $options: 'i' } },
    ],
  })
    .populate('brand', 'name slug')
    .populate('category', 'name slug')
    .limit(Number(limit))
    .lean();

  res.status(200).json({
    success: true,
    data: presentProducts(products, req),
  });
});

export const getProductsByCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  let categoryObjectId = categoryId;
  if (!isMongoId(categoryId)) {
    const categoryDoc = await Category.findOne({ name: String(categoryId || '').trim() }).select('_id').lean();
    if (!categoryDoc) throw new ApiError(404, 'Category not found.');
    categoryObjectId = categoryDoc._id;
  }

  const products = await Product.find({ category: categoryObjectId, isActive: true })
    .populate('brand', 'name')
    .populate('category', 'name')
    .lean();

  res.status(200).json({ success: true, data: presentProducts(products, req) });
});

export const getProductsByBrand = asyncHandler(async (req, res) => {
  const { brandId } = req.params;
  let brandObjectId = brandId;
  if (!isMongoId(brandId)) {
    const brandDoc = await Brand.findOne({ name: String(brandId || '').trim() }).select('_id').lean();
    if (!brandDoc) throw new ApiError(404, 'Brand not found.');
    brandObjectId = brandDoc._id;
  }

  const products = await Product.find({ brand: brandObjectId, isActive: true })
    .populate('brand', 'name')
    .populate('category', 'name')
    .lean();

  res.status(200).json({ success: true, data: presentProducts(products, req) });
});

export const createProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to create products.');
  }

  const { fields, name, brandId, categoryId } = await buildEditorProductFields(req.body);
  if (!name || !brandId || !categoryId) {
    throw new ApiError(400, 'Name, brand, and category are required.');
  }

  const createdProduct = await Product.create({
    ...fields,
    name,
    brand: brandId,
    category: categoryId,
    slug: fields.slug,
    description: fields.description || '',
    images: fields.images || mergeIncomingProductImages([], req.body.images || []),
    ingredients: fields.ingredients || [],
    keyIngredients: fields.keyIngredients || [],
    source: fields.source || (req.body.sourceUrl ? 'ai_import' : 'manual'),
    isActive: req.body.isActive === undefined ? false : Boolean(req.body.isActive),
  });

  let offers = [];
  if (Array.isArray(req.body.purchaseOptions)) {
    offers = await syncProductOffers(createdProduct._id, req.body.purchaseOptions);
  }

  const populated = await Product.findById(createdProduct._id)
    .populate('brand', 'name slug website')
    .populate('category', 'name slug')
    .populate('ingredients', 'name aliases')
    .populate('keyIngredients', 'name aliases')
    .lean();

  res.status(201).json({
    success: true,
    data: presentProduct(populated, req),
    offers,
    message: 'Product saved successfully.',
  });
});

export const updateProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to update products.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const existingProduct = await Product.findById(id).lean();
  if (!existingProduct) {
    throw new ApiError(404, 'Product not found.');
  }

  const allowedUpdates = [
    'name', 'slug', 'brand', 'category', 'description', 'images', 'ingredients', 'keyIngredients',
    'ingredientListText', 'ingredientSource', 'ingredientConfidence',
    'skinTypes', 'concerns', 'fragranceFree', 'alcoholFree', 'essentialOilFree', 'pregnancyFriendly',
    'qualityScore', 'isActive', 'source', 'sourceUrl', 'canonicalName', 'variant', 'size', 'quantity',
    'claims', 'productIdentifiers', 'purchaseOptions',
  ];
  const invalidKeys = Object.keys(req.body).filter((key) => !allowedUpdates.includes(key) && !EDITOR_META_FIELDS.has(key));

  if (invalidKeys.length) {
    throw new ApiError(400, `Invalid product update fields: ${invalidKeys.join(', ')}`);
  }

  const { fields } = await buildEditorProductFields(req.body, existingProduct);
  const intelligenceChanged = hasIntelligenceRelevantProductChanges(existingProduct, {
    ...req.body,
    ...fields,
  });

  const product = await Product.findByIdAndUpdate(
    id,
    { $set: fields },
    { returnDocument: 'after', runValidators: true }
  );

  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  let offers;
  if (Array.isArray(req.body.purchaseOptions)) {
    offers = await syncProductOffers(id, req.body.purchaseOptions);
  }

  if (intelligenceChanged) {
    await invalidateProductIntelligenceState(id, 'product_intelligence_relevant_fields_changed');
  }

  const populated = await Product.findById(id)
    .populate('brand', 'name slug website')
    .populate('category', 'name slug')
    .populate('ingredients', 'name aliases')
    .populate('keyIngredients', 'name aliases')
    .lean();

  res.status(200).json({
    success: true,
    data: presentProduct(populated, req),
    offers,
    message: 'Product saved successfully.',
  });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to delete products.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const publicIds = normalizeProductImages(product.images)
    .map((image) => image.publicId)
    .filter(Boolean);
  await Product.findByIdAndDelete(id);

  if (isCloudinaryConfigured()) {
    await Promise.all(publicIds.map(async (publicId) => {
      const deletion = await deleteFromCloudinary(publicId);
      if (!deletion.deleted) {
        console.error('[cloudinary] leftover asset after product delete', {
          publicId,
          reason: deletion.reason,
        });
      }
    }));
  }

  res.status(200).json({ success: true, message: 'Product deleted successfully.' });
});

export const publishProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to publish products.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const hasIntelligence = Boolean(
    product.productIntelligence?.explanation?.trim()
    && Array.isArray(product.productIntelligence?.ingredientAnalysis)
    && product.productIntelligence.ingredientAnalysis.length > 0
  );

  if (!hasIntelligence) {
    throw new ApiError(
      400,
      'Product intelligence has not been generated. Generate intelligence before publishing.'
    );
  }

  if (product.intelligenceStatus !== 'approved') {
    throw new ApiError(
      400,
      'Product intelligence has not been approved. Approve intelligence before publishing.'
    );
  }

  product.isActive = true;
  await product.save();

  res.status(200).json({ success: true, data: product, message: 'Product published successfully.' });
});

export const getProductIntelligenceInput = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await loadPopulatedProduct(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const intelligenceInput = buildIntelligenceInputFromProduct(product);
  const coverage = await buildIngredientCoverage(intelligenceInput.ingredients, product._id);
  const auditInfo = getIntelligenceAuditInfo();
  const generationJob = await ProductIntelligenceJob.findOne({ product: product._id })
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: {
      intelligenceInput,
      promptPreview: buildProductContext({
        ...intelligenceInput,
        unknownIngredients: coverage.unknown.map((entry) => entry.query),
      }),
      knowledgeCoverage: coverage,
      generationJob,
      metadata: product.intelligenceMetadata || null,
      hasIntelligence: Boolean(product.productIntelligence?.explanation),
      audit: auditInfo,
    },
  });
});

export const generateProductIntelligenceForProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to generate product intelligence.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id).select('_id ingredientListText ingredients');
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  const ingredientCount = Array.isArray(product.ingredients) && product.ingredients.length
    ? product.ingredients.length
    : String(product.ingredientListText || '').split(/[,;\n]+/).map((entry) => entry.trim()).filter(Boolean).length;
  if (!ingredientCount) {
    throw new ApiError(400, 'Full ingredient list is required before running Product Intelligence.');
  }

  let job = await ProductIntelligenceJob.findOne({
    product: product._id,
    status: { $in: ['queued', 'generating'] },
  });
  if (!job) {
    try {
      job = await ProductIntelligenceJob.create({ product: product._id, status: 'queued' });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      job = await ProductIntelligenceJob.findOne({
        product: product._id,
        status: { $in: ['queued', 'generating'] },
      });
      if (!job) throw error;
    }
  }

  await Product.findByIdAndUpdate(product._id, { $set: { intelligenceStatus: job.status } });
  if (job.status === 'queued') startProductIntelligenceJob(job._id);

  res.status(202).json({
    success: true,
    data: {
      productId: product._id,
      jobId: job._id,
      status: job.status,
    },
    message: 'Product intelligence generation queued.',
  });
});

export const approveProductIntelligence = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');

  const hasIntelligence = product.productIntelligence?.explanation
    && product.productIntelligence?.ingredientAnalysis?.length > 0;

  if (!hasIntelligence) {
    throw new ApiError(400, 'No intelligence to approve. Generate intelligence first.');
  }

  product.intelligenceStatus = 'approved';
  product.intelligenceReviewedBy = req.user._id;
  product.intelligenceReviewedAt = new Date();
  product.intelligenceReviewNotes = req.body?.notes || '';
  await product.save();

  console.info('[intelligence] approved', { productId: id, by: req.user._id });
  res.status(200).json({ success: true, data: product, message: 'Product intelligence approved.' });
});

export const rejectProductIntelligence = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required.');
  }

  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');

  product.intelligenceStatus = 'rejected';
  product.intelligenceReviewedBy = req.user._id;
  product.intelligenceReviewedAt = new Date();
  product.intelligenceReviewNotes = req.body?.reason || 'Rejected by admin.';
  await product.save();

  console.info('[intelligence] rejected', { productId: id, by: req.user._id });
  res.status(200).json({ success: true, data: product, message: 'Product intelligence rejected.' });
});

export const toggleProductStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Admin access required to toggle product status.');
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid product ID.');
  }

  const product = await Product.findById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  product.isActive = !product.isActive;
  await product.save();

  res.status(200).json({ success: true, data: product });
});

export default {
  getProducts,
  getProductById,
  searchProducts,
  getProductsByCategory,
  getProductsByBrand,
  createProduct,
  updateProduct,
  deleteProduct,
  publishProduct,
  getProductIntelligenceInput,
  generateProductIntelligenceForProduct,
  approveProductIntelligence,
  rejectProductIntelligence,
  toggleProductStatus,
};
