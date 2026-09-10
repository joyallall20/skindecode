import express from 'express';
import { getBrands, getBrandById, createBrand, updateBrand, deleteBrand, toggleBrandStatus } from '../controllers/brandController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/', getBrands);
router.get('/:id', getBrandById);

router.use(protect);
router.post('/', requireAdmin, createBrand);
router.put('/:id', requireAdmin, updateBrand);
router.delete('/:id', requireAdmin, deleteBrand);
router.patch('/:id/toggle-status', requireAdmin, toggleBrandStatus);

export default router;
