import asyncHandler from '../utils/asyncHandler.js';
import { syncUserFromFirebase } from '../services/userSyncService.js';

export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

export const authenticateFirebaseUser = asyncHandler(async (req, res) => {
  const user = await syncUserFromFirebase(req.firebaseUser);

  res.status(200).json({
    success: true,
    data: user,
  });
});

export default { getCurrentUser, authenticateFirebaseUser };
