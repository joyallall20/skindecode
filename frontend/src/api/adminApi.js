import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';

const unwrap = (response) => response.data;

// Dashboard statistics
export const getDashboardStats = () =>
  apiClient.get(API_PATHS.admin.dashboard).then(unwrap);

export const getRecentImports = () =>
  apiClient.get(API_PATHS.admin.recentImports).then(unwrap);

export const getProductStats = () =>
  apiClient.get(API_PATHS.admin.productStats).then(unwrap);

export const getClickStats = () =>
  apiClient.get(API_PATHS.admin.clickStats).then(unwrap);

export const getUserStats = () =>
  apiClient.get(API_PATHS.admin.userStats).then(unwrap);

// Product management (admin-only, via /api/products)
export const createProduct = (data) =>
  apiClient.post(API_PATHS.products.create, data).then(unwrap);

export const updateProduct = (id, data) =>
  apiClient.put(API_PATHS.products.update(id), data).then(unwrap);

export const uploadProductImage = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post(API_PATHS.products.uploadImage(id), formData).then(unwrap);
};

export const deleteProductImage = (id, imageId) =>
  apiClient.delete(API_PATHS.products.deleteImage(id, imageId)).then(unwrap);

export const setPrimaryProductImage = (id, imageId) =>
  apiClient.patch(API_PATHS.products.setPrimaryImage(id, imageId)).then(unwrap);

export const getBrands = (params = {}) =>
  apiClient.get(API_PATHS.brands.list, { params: { limit: 100, ...params } }).then(unwrap);

export const getCategories = (params = {}) =>
  apiClient.get(API_PATHS.categories.list, { params: { limit: 100, ...params } }).then(unwrap);

export const getRetailers = (params = {}) =>
  apiClient.get(API_PATHS.retailers.list, { params: { limit: 100, ...params } }).then(unwrap);

export const deleteProduct = (id) =>
  apiClient.delete(API_PATHS.products.delete(id)).then(unwrap);

export const publishProduct = (id) =>
  apiClient.patch(API_PATHS.products.publish(id)).then(unwrap);

export const toggleProductStatus = (id) =>
  apiClient.patch(API_PATHS.products.toggleStatus(id)).then(unwrap);

// Product offers (admin-only mutations)
export const createProductOffer = (productId, data) =>
  apiClient.post(API_PATHS.products.offers(productId), data).then(unwrap);

export const updateProductOffer = (productId, offerId, data) =>
  apiClient.put(API_PATHS.products.offerById(productId, offerId), data).then(unwrap);

export const deleteProductOffer = (productId, offerId) =>
  apiClient.delete(API_PATHS.products.offerById(productId, offerId)).then(unwrap);

// Product imports
export const createProductImport = (data) =>
  apiClient.post(API_PATHS.productImports.create, data).then(unwrap);

export const getProductImports = (params = {}) =>
  apiClient.get(API_PATHS.productImports.list, { params }).then(unwrap);

export const getProductImport = (id) =>
  apiClient.get(API_PATHS.productImports.byId(id)).then(unwrap);

export const extractProductFromImport = (id) =>
  apiClient.post(API_PATHS.productImports.extract(id), {}, { timeout: 180000 }).then(unwrap);

export const updateExtractedProduct = (id, data) =>
  apiClient.patch(API_PATHS.productImports.extractedData(id), data).then(unwrap);

export const approveProductImport = (id) =>
  apiClient.post(API_PATHS.productImports.approve(id)).then(unwrap);

export const rejectProductImport = (id, data = {}) =>
  apiClient.post(API_PATHS.productImports.reject(id), data).then(unwrap);

export const publishImportedProduct = (id) =>
  apiClient.post(API_PATHS.productImports.publish(id)).then(unwrap);

export const getImportIntelligenceInput = (id) =>
  apiClient.get(API_PATHS.productImports.intelligenceInput(id)).then(unwrap);

export const getProductIntelligenceInput = (id) =>
  apiClient.get(API_PATHS.products.intelligenceInput(id)).then(unwrap);

export const generateProductIntelligence = (id) =>
  apiClient.post(API_PATHS.products.generateIntelligence(id), {}, { timeout: 180000 }).then(unwrap);

export const approveProductIntelligence = (id, data = {}) =>
  apiClient.post(API_PATHS.products.approveIntelligence(id), data).then(unwrap);

export const rejectProductIntelligence = (id, data = {}) =>
  apiClient.post(API_PATHS.products.rejectIntelligence(id), data).then(unwrap);

export const runSellerDiscovery = (data) =>
  apiClient.post(API_PATHS.sellerDiscovery.discover, data).then(unwrap);

export const getSellerCandidates = (params = {}) =>
  apiClient.get(API_PATHS.sellerDiscovery.candidates, { params }).then(unwrap);

export const updateSellerCandidate = (id, data) =>
  apiClient.patch(API_PATHS.sellerDiscovery.updateCandidate(id), data).then(unwrap);

export const deleteSellerCandidate = (id) =>
  apiClient.delete(API_PATHS.sellerDiscovery.deleteCandidate(id)).then(unwrap);

export const getIntelligenceAuditReport = () =>
  apiClient.get(API_PATHS.adminIntelligence.audit).then(unwrap);

export const getIntelligenceTestMatrix = () =>
  apiClient.get(API_PATHS.adminIntelligence.testMatrix).then(unwrap);

export const runProfileMatchingAudit = (data = {}) =>
  apiClient.post(API_PATHS.adminIntelligence.runMatchingAudit, data).then(unwrap);

export const testProductIntelligence = (data) =>
  apiClient.post(API_PATHS.adminIntelligence.test, data).then(unwrap);

export const previewIntelligenceInput = (data) =>
  apiClient.post(API_PATHS.adminIntelligence.previewInput, data).then(unwrap);

export const getIngredientKnowledge = (params = {}) =>
  apiClient.get(API_PATHS.research.knowledge, { params }).then(unwrap);

export const getIngredientKnowledgeById = (id) =>
  apiClient.get(API_PATHS.research.knowledgeById(id)).then(unwrap);

export const importIngredientKnowledge = (data = {}) =>
  apiClient.post(API_PATHS.research.knowledgeImport, data).then(unwrap);

export const matchIngredientKnowledge = (q) =>
  apiClient.get(API_PATHS.research.knowledgeMatch, { params: { q } }).then(unwrap);

export const getResearchQueue = (params = {}) =>
  apiClient.get(API_PATHS.research.queue, { params }).then(unwrap);

export const getResearchQueueItem = (id) =>
  apiClient.get(API_PATHS.research.queueById(id)).then(unwrap);

export const runIngredientResearch = (id, data = {}) =>
  apiClient.post(id ? API_PATHS.research.queueRun(id) : API_PATHS.research.research, data, { timeout: 180000 }).then(unwrap);

export const approveIngredientResearch = (id, data = {}) =>
  apiClient.post(API_PATHS.research.queueApprove(id), data).then(unwrap);

export const rejectIngredientResearch = (id, data = {}) =>
  apiClient.post(API_PATHS.research.queueReject(id), data).then(unwrap);

export const editIngredientResearch = (id, data = {}) =>
  apiClient.patch(API_PATHS.research.queueById(id), data).then(unwrap);

// Product click tracking
export const trackProductClick = (data) =>
  apiClient.post(API_PATHS.productClicks.track, data).then(unwrap);
