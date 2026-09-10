import express from 'express';
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory, toggleCategoryStatus } from '../controllers/categoryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:id', getCategoryById);

router.use(protect);
router.post('/', requireAdmin, createCategory);
router.put('/:id', requireAdmin, updateCategory);
router.delete('/:id', requireAdmin, deleteCategory);
router.patch('/:id/toggle-status', requireAdmin, toggleCategoryStatus);

export default router;
