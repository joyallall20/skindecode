import express from 'express';
import { runSellerDiscovery, getSellerCandidates, updateSellerCandidate, deleteSellerCandidate } from '../controllers/sellerDiscoveryController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(protect, requireAdmin);
router.post('/discover', runSellerDiscovery);
router.get('/candidates', getSellerCandidates);
router.patch('/candidates/:id', updateSellerCandidate);
router.delete('/candidates/:id', deleteSellerCandidate);

export default router;
