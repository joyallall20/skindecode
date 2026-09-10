import express from 'express';
import { getRetailers, getRetailerById, createRetailer, updateRetailer, deleteRetailer, toggleRetailerStatus } from '../controllers/retailerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/', getRetailers);
router.get('/:id', getRetailerById);

router.use(protect);
router.post('/', requireAdmin, createRetailer);
router.put('/:id', requireAdmin, updateRetailer);
router.delete('/:id', requireAdmin, deleteRetailer);
router.patch('/:id/toggle-status', requireAdmin, toggleRetailerStatus);

export default router;
