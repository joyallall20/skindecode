import express from 'express';
import { getCurrentUser, authenticateFirebaseUser } from '../controllers/authController.js';
import { protect, verifyFirebaseToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, getCurrentUser);
router.post('/firebase', verifyFirebaseToken, authenticateFirebaseUser);

export default router;
