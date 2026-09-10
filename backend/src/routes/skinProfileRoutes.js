import express from 'express';
import { createSkinProfile, getMySkinProfile, updateSkinProfile, deleteSkinProfile, completeQuestionnaire, saveAnonymousAnalysis } from '../controllers/skinProfileController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.route('/').get(getMySkinProfile).post(createSkinProfile).put(updateSkinProfile).delete(deleteSkinProfile);
router.post('/complete-questionnaire', completeQuestionnaire);
router.post('/save-anonymous', saveAnonymousAnalysis);

export default router;
