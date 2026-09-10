import express from 'express';
import { generateRecommendations, getLatestRecommendations, getRecommendationById, getProductRecommendationDetails } from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.post('/generate', generateRecommendations);
router.get('/latest', getLatestRecommendations);
router.get('/:id', getRecommendationById);
router.get('/:id/products', getProductRecommendationDetails);

export default router;
