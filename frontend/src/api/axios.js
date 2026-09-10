import axios from 'axios';
import { getIdToken } from '../services/authService.js';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const message =
      payload?.message || payload?.error || error.message || 'Request failed';

    return Promise.reject({
      status,
      message,
      data: error.response?.data ?? null,
      isAuthError: status === 401,
      isForbidden: status === 403,
      isNotFound: status === 404,
      original: error,
    });
  },
);

export default apiClient;
