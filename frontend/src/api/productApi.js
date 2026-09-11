import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';

const unwrap = (response) => response.data;

export const getProducts = (params = {}) =>
  apiClient.get(API_PATHS.products.list, { params }).then(unwrap);

export const searchProducts = (q, params = {}) =>
  apiClient.get(API_PATHS.products.search, { params: { q, ...params } }).then(unwrap);

export const getProductById = (id) =>
  apiClient.get(API_PATHS.products.byId(id)).then(unwrap);

export const getProductsByCategory = (categoryId) =>
  apiClient.get(API_PATHS.products.byCategory(categoryId)).then(unwrap);

export const getProductsByBrand = (brandId) =>
  apiClient.get(API_PATHS.products.byBrand(brandId)).then(unwrap);

export const getProductOffers = (productId) =>
  apiClient.get(API_PATHS.products.offers(productId)).then(unwrap);

// Batched retailer offers for a product listing page, so a grid of
// N products issues one request instead of N individual
// getProductOffers() calls. Requires an API_PATHS.products.offersBatch
// entry — see the note left for the constants.js / backend changes.
export const getProductOffersBatch = (productIds = []) =>
  apiClient
    .get(API_PATHS.products.offersBatch, {
      params: { productIds: productIds.join(',') },
    })
    .then(unwrap);