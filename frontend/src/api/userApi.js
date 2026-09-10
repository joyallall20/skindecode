import apiClient from './axios.js';
import { getIdToken } from '../services/authService.js';
import { API_PATHS } from '../utils/constants.js';

export const getCurrentUser = () => apiClient.get(API_PATHS.auth.me).then((response) => response.data);

let syncPromise = null;

export const authenticateFirebaseUser = async () => {
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    const token = await getIdToken();
    if (!token) {
      throw new Error('Firebase authentication did not provide an ID token.');
    }

    return apiClient
      .post(API_PATHS.auth.firebase, {}, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.data);
  })();

  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
};
