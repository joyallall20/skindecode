import express from 'express';
import { createProductImport, extractProductFromImportUrl, getProductImport, getProductImports, updateExtractedProduct, approveProductImport, rejectProductImport, publishImportedProduct, getImportIntelligenceInput } from '../controllers/productImportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect);
router.post('/', requireAdmin, createProductImport);
router.get('/', requireAdmin, getProductImports);
router.get('/:id', requireAdmin, getProductImport);
router.post('/:id/extract', requireAdmin, extractProductFromImportUrl);
router.patch('/:id/extracted-data', requireAdmin, updateExtractedProduct);
router.post('/:id/approve', requireAdmin, approveProductImport);
router.post('/:id/reject', requireAdmin, rejectProductImport);
router.post('/:id/publish', requireAdmin, publishImportedProduct);
router.get('/:id/intelligence-input', requireAdmin, getImportIntelligenceInput);

export default router;
