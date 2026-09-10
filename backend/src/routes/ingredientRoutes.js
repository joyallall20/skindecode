import express from 'express';
import { getIngredients, getIngredientById, searchIngredients, createIngredient, updateIngredient, deleteIngredient, toggleIngredientStatus } from '../controllers/ingredientController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/search', searchIngredients);
router.get('/', getIngredients);
router.get('/:id', getIngredientById);

router.use(protect);
router.post('/', requireAdmin, createIngredient);
router.put('/:id', requireAdmin, updateIngredient);
router.delete('/:id', requireAdmin, deleteIngredient);
router.patch('/:id/toggle-status', requireAdmin, toggleIngredientStatus);

export default router;
