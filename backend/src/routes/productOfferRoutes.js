import express from 'express';
import { getProductOffers, createProductOffer, updateProductOffer, deleteProductOffer } from '../controllers/productOfferController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router({ mergeParams: true });

router.get('/', optionalAuth, getProductOffers);

router.use(protect);
router.post('/', requireAdmin, createProductOffer);
router.put('/:id', requireAdmin, updateProductOffer);
router.delete('/:id', requireAdmin, deleteProductOffer);

export default router;
