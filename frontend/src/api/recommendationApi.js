import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';

const unwrap = (response) => response.data;

/**
 * qualityScore (0–10) and compatibilityScore (0–100) are distinct fields
 * returned by the backend and must not be conflated.
 */
export const generateRecommendations = (body = {}) =>
  apiClient.post(API_PATHS.recommendations.generate, body).then(unwrap);

export const getLatestRecommendations = () =>
  apiClient.get(API_PATHS.recommendations.latest).then(unwrap);

export const getRecommendationById = (id) =>
  apiClient.get(API_PATHS.recommendations.byId(id)).then(unwrap);

export const getProductRecommendationDetails = (id) =>
  apiClient.get(API_PATHS.recommendations.products(id)).then(unwrap);
