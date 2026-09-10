import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  firebaseAuth,
  isFirebaseConfigured,
} from '../config/firebase.js';
import { syncUserFromFirebase } from '../services/userSyncService.js';

export const ensureActiveUser = (user) => {
  if (!user?.isActive) {
    throw new ApiError(403, 'This account is inactive. Please contact support.');
  }
};

export const protect = asyncHandler(async (req, res, next) => {
  const decodedToken = await verifyTokenFromRequest(req);

  req.user = await syncUserFromFirebase(decodedToken);

  ensureActiveUser(req.user);

  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : null;

  if (!token || !isFirebaseConfigured()) {
    return next();
  }

  try {
    const decodedToken = await firebaseAuth().verifyIdToken(token);
    req.user = await syncUserFromFirebase(decodedToken);
  } catch {
    req.user = undefined;
  }

  next();
});

export const verifyFirebaseToken = asyncHandler(async (req, res, next) => {
  req.firebaseUser = await verifyTokenFromRequest(req);

  next();
});

const verifyTokenFromRequest = async (req) => {
  const authHeader = req.headers.authorization;

  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '').trim()
      : null;

  if (!token) {
    throw new ApiError(401, 'Authentication token is required.');
  }

  if (!isFirebaseConfigured()) {
    throw new ApiError(
      401,
      'Firebase authentication is not configured for this environment.'
    );
  }

  try {
    return await firebaseAuth().verifyIdToken(token);
  } catch (error) {
    console.error('🔥 Firebase token verification failed');
    console.error('code:', error.code);
    console.error('message:', error.message);

    throw new ApiError(
      401,
      'Invalid or expired authentication token.'
    );
  }
};

export default protect;