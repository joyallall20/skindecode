import express from 'express';
import { getProducts, getProductById, searchProducts, getProductsByCategory, getProductsByBrand, createProduct, updateProduct, deleteProduct, publishProduct, getProductIntelligenceInput, generateProductIntelligenceForProduct, approveProductIntelligence, rejectProductIntelligence, toggleProductStatus } from '../controllers/productController.js';
import { getProductOffersBatch } from '../controllers/productOfferController.js';
import { uploadProductImage, deleteProductImage, setPrimaryProductImage } from '../controllers/productImageController.js';
import { productImageUpload } from '../middleware/productImageUpload.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/search', optionalAuth, searchProducts);
router.get('/category/:categoryId', optionalAuth, getProductsByCategory);
router.get('/brand/:brandId', optionalAuth, getProductsByBrand);
// Must stay above '/:id' - otherwise a request for '/offers' would be
// captured by the :id route with id === 'offers' instead of reaching
// this handler.
router.get('/offers', optionalAuth, getProductOffersBatch);
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProductById);

router.use(protect);
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);
router.post('/:id/images', requireAdmin, productImageUpload, uploadProductImage);
router.patch('/:id/images/:imageId/primary', requireAdmin, setPrimaryProductImage);
router.delete('/:id/images/:imageId', requireAdmin, deleteProductImage);
router.get('/:id/intelligence-input', requireAdmin, getProductIntelligenceInput);
router.post('/:id/generate-intelligence', requireAdmin, generateProductIntelligenceForProduct);
router.post('/:id/approve-intelligence', requireAdmin, approveProductIntelligence);
router.post('/:id/reject-intelligence', requireAdmin, rejectProductIntelligence);
router.patch('/:id/publish', requireAdmin, publishProduct);
router.patch('/:id/toggle-status', requireAdmin, toggleProductStatus);

export default router;