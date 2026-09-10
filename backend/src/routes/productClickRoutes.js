import express from 'express';
import { trackProductClick } from '../controllers/productClickController.js';
import { clickTrackingRateLimit } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/', clickTrackingRateLimit, trackProductClick);

export default router;
