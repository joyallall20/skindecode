import express from 'express';
import { getDashboardStats, getRecentImports, getProductStats, getClickStats, getUserStats } from '../controllers/adminController.js';
import { getIntelligenceTestMatrix, getIntelligenceAuditReport, runProfileMatchingAudit, testProductIntelligence, previewIntelligenceInput } from '../controllers/adminIntelligenceController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect, requireAdmin);
router.get('/dashboard', getDashboardStats);
router.get('/recent-imports', getRecentImports);
router.get('/product-stats', getProductStats);
router.get('/click-stats', getClickStats);
router.get('/user-stats', getUserStats);

router.get('/intelligence/audit', getIntelligenceAuditReport);
router.get('/intelligence/test-matrix', getIntelligenceTestMatrix);
router.post('/intelligence/run-matching-audit', runProfileMatchingAudit);
router.post('/intelligence/test', testProductIntelligence);
router.post('/intelligence/preview-input', previewIntelligenceInput);

export default router;
