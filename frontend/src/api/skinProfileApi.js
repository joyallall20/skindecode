import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';

const unwrap = (response) => response.data;

export const getSkinProfile = () =>
  apiClient.get(API_PATHS.skinProfile.base).then(unwrap);

export const createSkinProfile = (data) =>
  apiClient.post(API_PATHS.skinProfile.base, data).then(unwrap);

export const updateSkinProfile = (data) =>
  apiClient.put(API_PATHS.skinProfile.base, data).then(unwrap);

export const deleteSkinProfile = () =>
  apiClient.delete(API_PATHS.skinProfile.base).then(unwrap);

export const completeQuestionnaire = () =>
  apiClient.post(API_PATHS.skinProfile.completeQuestionnaire).then(unwrap);

/**
 * Upsert the authenticated user's completed SkinProfile.
 * Uses the existing authenticated save-anonymous endpoint
 * (one profile per user).
 */
export const saveSkinProfile = (profile) =>
  apiClient
    .post(API_PATHS.skinProfile.saveAnonymous, { profile })
    .then(unwrap);

/** @deprecated Prefer saveSkinProfile — kept for compatibility. */
export const saveAnonymousAnalysis = (profile) => saveSkinProfile(profile);
