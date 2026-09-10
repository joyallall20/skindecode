import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Brand from '../models/Brand.js';
import Category from '../models/Category.js';
import Ingredient from '../models/Ingredient.js';
import Retailer from '../models/Retailer.js';
import ProductOffer from '../models/ProductOffer.js';
import ApiError from '../utils/ApiError.js';
import { parseIngredientList } from '../utils/ingredientList.js';
import { mergeIncomingProductImages } from '../utils/productImages.js';
import { buildProductSlug, computeCanonicalIdentityHash } from './productIdentityService.js';

export const isMongoId = (value) => {
  if (!value) return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  if (typeof value === 'object' && (value._id || value.id)) {
    return isMongoId(value._id || value.id);
  }
  return /^[a-fA-F0-9]{24}$/.test(String(value));
};

export const slugifyName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'item';

const nameOf = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return String(value.name || '').trim();
  return String(value).trim();
};

const referenceIdOf = (value) => (
  value && typeof value === 'object' ? (value._id || value.id) : value
);

export const resolveBrandId = async (brand) => {
  const name = nameOf(brand);
  const referenceId = referenceIdOf(brand);
  if (isMongoId(referenceId)) {
    const existing = await Brand.findById(referenceId);
    if (existing) return existing._id;
    throw new ApiError(400, 'Brand reference was not found.');
  }
  if (!name) return null;
  const doc = await Brand.findOneAndUpdate(
    { name },
    { $set: { name, slug: slugifyName(name), isActive: true } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
  return doc._id;
};

export const resolveCategoryId = async (category) => {
  const name = nameOf(category);
  const referenceId = referenceIdOf(category);
  if (isMongoId(referenceId)) {
    const existing = await Category.findById(referenceId);
    if (existing) return existing._id;
    throw new ApiError(400, 'Category reference was not found.');
  }
  if (!name) return null;
  const doc = await Category.findOneAndUpdate(
    { name },
    { $set: { name, slug: slugifyName(name), isActive: true } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
  return doc._id;
};

const toObjectId = (id) => {
  const raw = typeof id === 'object' && id?._id ? id._id : id;
  return isMongoId(raw) ? new mongoose.Types.ObjectId(String(raw)) : null;
};

const rawRefName = (value) => {
  if (value && typeof value === 'object') return nameOf(value);
  if (typeof value === 'string' && !isMongoId(value)) return value.trim();
  return '';
};

export const repairProductCatalogRefs = async (productId) => {
  const objectId = toObjectId(productId);
  if (!objectId) return null;

  const raw = await Product.collection.findOne({ _id: objectId });
  if (!raw) return null;

  const updates = {};
  const brandName = rawRefName(raw.brand);
  const categoryName = rawRefName(raw.category);
  if (brandName) {
    updates.brand = await resolveBrandId(brandName);
  }
  if (categoryName) {
    updates.category = await resolveCategoryId(categoryName);
  }

  if (Object.keys(updates).length) {
    await Product.collection.updateOne({ _id: objectId }, { $set: updates });
    console.info('[catalog] repaired product ObjectId refs', {
      productId: String(objectId),
      brand: brandName || undefined,
      category: categoryName || undefined,
    });
  }

  return raw;
};

export const loadPopulatedProduct = async (productId, { lean = true } = {}) => {
  await repairProductCatalogRefs(productId);
  const query = Product.findById(productId)
    .populate('brand', 'name slug website')
    .populate('category', 'name slug')
    .populate('ingredients', 'name aliases')
    .populate('keyIngredients', 'name aliases');
  return lean ? query.lean() : query;
};

export const resolveRetailerId = async (retailer) => {
  const name = nameOf(retailer);
  if (isMongoId(retailer)) {
    const existing = await Retailer.findById(retailer);
    if (existing) return existing._id;
  }
  if (!name) return null;
  const doc = await Retailer.findOneAndUpdate(
    { name },
    { $set: { name, slug: slugifyName(name), isActive: true } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
  return doc._id;
};

export const resolveIngredientIds = async (value) => {
  if (Array.isArray(value) && value.length && value.every((entry) => isMongoId(entry) || isMongoId(entry?._id))) {
    return value.map((entry) => (isMongoId(entry) ? entry : entry._id));
  }
  const names = parseIngredientList(value);
  const ids = await Promise.all(
    names.map(async (ingredientName) => {
      const ingredient = await Ingredient.findOneAndUpdate(
        { name: ingredientName },
        { $set: { name: ingredientName, aliases: [ingredientName], isActive: true } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      );
      return ingredient._id;
    })
  );
  return ids.filter(Boolean);
};

const toNullableBoolean = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === 'unknown' || value === '') return null;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
};

export const uniqueProductSlug = async (desiredSlug, excludeId = null) => {
  const base = slugifyName(desiredSlug || 'product');
  let slug = base;
  let suffix = 2;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const clash = await Product.findOne(query).select('_id').lean();
    if (!clash) return slug;
    slug = `${base}-${suffix}`.slice(0, 120);
    suffix += 1;
  }
};

export const buildEditorProductFields = async (payload = {}, existingProduct = null) => {
  const name = String(payload.name || '').trim();
  const brandName = nameOf(payload.brand);
  const categoryName = nameOf(payload.category);
  const brandId = await resolveBrandId(payload.brand);
  const categoryId = await resolveCategoryId(payload.category);

  const ingredientListText = payload.ingredientListText !== undefined
    ? String(payload.ingredientListText || '')
    : (payload.ingredients !== undefined ? (Array.isArray(payload.ingredients) ? payload.ingredients.join(', ') : String(payload.ingredients || '')) : undefined);

  const fields = {};

  if (payload.name !== undefined) fields.name = name;
  if (payload.brand !== undefined) fields.brand = brandId;
  if (payload.category !== undefined) fields.category = categoryId;
  if (payload.description !== undefined) fields.description = String(payload.description || '');
  if (payload.variant !== undefined) fields.variant = String(payload.variant || '').trim();
  if (payload.size !== undefined) fields.size = String(payload.size || '').trim();
  if (payload.quantity !== undefined) fields.quantity = String(payload.quantity || '').trim();
  if (payload.canonicalName !== undefined) fields.canonicalName = String(payload.canonicalName || name).trim();
  else if (payload.name !== undefined) fields.canonicalName = name;
  if (payload.sourceUrl !== undefined) fields.sourceUrl = String(payload.sourceUrl || '').trim() || null;
  if (payload.source !== undefined) fields.source = payload.source;
  if (payload.isActive !== undefined) fields.isActive = Boolean(payload.isActive);
  if (payload.claims !== undefined) {
    fields.claims = Array.isArray(payload.claims)
      ? payload.claims.map((entry) => String(entry).trim()).filter(Boolean)
      : String(payload.claims || '').split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean);
  }
  if (payload.skinTypes !== undefined) fields.skinTypes = Array.isArray(payload.skinTypes) ? payload.skinTypes.filter(Boolean) : [];
  if (payload.concerns !== undefined) fields.concerns = Array.isArray(payload.concerns) ? payload.concerns.filter(Boolean) : [];
  if (payload.fragranceFree !== undefined) fields.fragranceFree = toNullableBoolean(payload.fragranceFree);
  if (payload.alcoholFree !== undefined) fields.alcoholFree = toNullableBoolean(payload.alcoholFree);
  if (payload.essentialOilFree !== undefined) fields.essentialOilFree = toNullableBoolean(payload.essentialOilFree);
  if (payload.pregnancyFriendly !== undefined) fields.pregnancyFriendly = toNullableBoolean(payload.pregnancyFriendly);
  if (payload.productIdentifiers !== undefined) fields.productIdentifiers = payload.productIdentifiers;

  if (payload.images !== undefined) {
    fields.images = mergeIncomingProductImages(existingProduct?.images || [], payload.images);
  }

  if (payload.ingredients !== undefined || payload.ingredientListText !== undefined) {
    fields.ingredients = await resolveIngredientIds(ingredientListText ?? payload.ingredients);
    fields.ingredientListText = String(ingredientListText || '');
    if (fields.ingredients.length) {
      fields.ingredientSource = payload.ingredientSource || 'admin';
      fields.ingredientConfidence = payload.ingredientConfidence || 'high';
    }
  }

  if (payload.keyIngredients !== undefined) {
    fields.keyIngredients = await resolveIngredientIds(payload.keyIngredients);
  }

  const slugSource = payload.slug || buildProductSlug({
    name,
    brand: brandName,
    variant: payload.variant,
    size: payload.size,
  });
  if (payload.slug !== undefined || payload.name !== undefined || payload.brand !== undefined) {
    fields.slug = await uniqueProductSlug(slugSource, existingProduct?._id);
  }

  if (name && brandName && categoryName) {
    fields.canonicalIdentityHash = computeCanonicalIdentityHash({
      name,
      brand: brandName,
      category: categoryName,
      variant: payload.variant ?? existingProduct?.variant,
      size: payload.size ?? existingProduct?.size,
      quantity: payload.quantity ?? existingProduct?.quantity,
      productIdentifiers: payload.productIdentifiers || existingProduct?.productIdentifiers,
    });
  }

  return { fields, brandId, categoryId, name, brandName, categoryName };
};

export const syncProductOffers = async (productId, options) => {
  if (!Array.isArray(options)) return [];

  const existing = await ProductOffer.find({ product: productId });
  const keepIds = [];

  for (const option of options) {
    const retailerName = nameOf(option.retailer || option.retailerName);
    const retailerRef = option.retailerId || option.retailer;
    const productUrl = String(option.productUrl || option.originalUrl || option.url || '').trim();
    const affiliateUrl = String(option.affiliateUrl || '').trim() || null;
    const price = option.price === '' || option.price === null || option.price === undefined
      ? NaN
      : Number(option.price);

    if (!retailerName && !isMongoId(retailerRef)) continue;

    if (!productUrl || !Number.isFinite(price) || price < 0) {
      throw new ApiError(400, `Purchase option${retailerName ? ` for ${retailerName}` : ''} requires a product URL and numeric price.`);
    }

    const retailerId = await resolveRetailerId(retailerRef || retailerName);
    const wantsActive = Boolean(option.isActive);
    if (wantsActive && !affiliateUrl) {
      throw new ApiError(400, `An affiliate URL is required to activate the ${retailerName || 'selected'} purchase option.`);
    }

    const payload = {
      product: productId,
      retailer: retailerId,
      url: affiliateUrl || productUrl,
      originalUrl: productUrl,
      affiliateUrl,
      linkType: affiliateUrl ? 'affiliate' : 'direct',
      price,
      currency: String(option.currency || 'INR').trim() || 'INR',
      inStock: option.inStock === undefined ? true : Boolean(option.inStock),
      lastPriceCheck: new Date(),
      isActive: wantsActive && Boolean(affiliateUrl),
    };

    let offer = null;
    if (option._id && isMongoId(option._id)) {
      offer = await ProductOffer.findOneAndUpdate(
        { _id: option._id, product: productId },
        { $set: payload },
        { returnDocument: 'after', runValidators: true }
      );
    }
    if (!offer) {
      offer = await ProductOffer.findOneAndUpdate(
        { product: productId, retailer: retailerId },
        { $set: payload },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
    }
    keepIds.push(String(offer._id));
  }

  const staleIds = existing
    .map((offer) => offer._id)
    .filter((id) => !keepIds.includes(String(id)));
  if (staleIds.length) {
    await ProductOffer.deleteMany({ _id: { $in: staleIds } });
  }

  return ProductOffer.find({ product: productId })
    .populate('retailer', 'name slug website affiliateProgram')
    .lean();
};

export default {
  isMongoId,
  slugifyName,
  resolveBrandId,
  resolveCategoryId,
  resolveRetailerId,
  resolveIngredientIds,
  uniqueProductSlug,
  buildEditorProductFields,
  syncProductOffers,
  repairProductCatalogRefs,
  loadPopulatedProduct,
};
