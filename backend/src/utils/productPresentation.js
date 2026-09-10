import { normalizeProductImages } from './productImages.js';

const INTERNAL_PRODUCT_FIELDS = new Set([
  'sourceUrl',
  'canonicalIdentityHash',
  'intelligenceReviewedBy',
  'intelligenceReviewedAt',
  'intelligenceReviewNotes',
  'intelligenceMetadata',
  'aiRawResponse',
]);

const withNormalizedImages = (product = {}) => {
  if (!product || typeof product !== 'object') return product;
  if (!Array.isArray(product.images)) return product;
  return {
    ...product,
    images: normalizeProductImages(product.images),
  };
};

export const sanitizeProductForCustomer = (product = {}) => {
  if (!product || typeof product !== 'object') return product;

  const sanitized = withNormalizedImages({ ...product });
  INTERNAL_PRODUCT_FIELDS.forEach((field) => {
    delete sanitized[field];
  });

  return sanitized;
};

export const sanitizeProductsForCustomer = (products = []) =>
  products.map((product) => sanitizeProductForCustomer(product));

export const isAdminRequest = (req) => Boolean(req?.user && req.user.role === 'admin');

export const presentProduct = (product, req) =>
  isAdminRequest(req) ? withNormalizedImages(product) : sanitizeProductForCustomer(product);

export const presentProducts = (products, req) =>
  isAdminRequest(req)
    ? products.map((product) => withNormalizedImages(product))
    : sanitizeProductsForCustomer(products);

export default {
  sanitizeProductForCustomer,
  sanitizeProductsForCustomer,
  presentProduct,
  presentProducts,
  isAdminRequest,
};
