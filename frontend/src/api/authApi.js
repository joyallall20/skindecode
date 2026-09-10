import apiClient from './axios.js';
import { API_PATHS } from '../utils/constants.js';
import { getCurrentUser } from './userApi.js';

/**
 * Authentication is handled by Firebase on the client.
 * The backend verifies Firebase ID tokens via the Authorization header on
 * protected endpoints and exposes /api/auth/me for the current user profile.
 *
 * Admin status is determined server-side (User.role === 'admin').
 * The legacy admin probe remains available for callers that still use it;
 * the auth context now uses the current-user profile directly.
 */
export const checkAdminAccess = async () => {
  try {
    await apiClient.get(API_PATHS.admin.dashboard);
    return { isAdmin: true };
  } catch (error) {
    if (error.isForbidden) {
      return { isAdmin: false };
    }
    throw error;
  }
};

export { getCurrentUser };

/**
 * Verifies the Firebase user exists in the backend database by calling
 * a protected endpoint. Returns true if the backend recognizes the user.
 */
export const verifyBackendSession = async () => {
  try {
    await apiClient.get(API_PATHS.skinProfile.base);
    return { registered: true, hasSkinProfile: true };
  } catch (error) {
    if (error.isNotFound) {
      return { registered: true, hasSkinProfile: false };
    }
    if (error.isAuthError) {
      return { registered: false, hasSkinProfile: false };
    }
    throw error;
  }
};
