import express from 'express';
import protect from '../middleware/authMiddleware.js';
import {
  listIngredientKnowledge,
  getIngredientKnowledgeById,
  matchIngredientKnowledge,
  importIngredientKnowledge,
  createIngredientKnowledgeDraft,
  verifyIngredientKnowledge,
  listResearchQueue,
  getResearchQueueItem,
  runQueuedIngredientResearch,
  approveQueuedResearch,
  rejectQueuedResearch,
  editQueuedResearch,
} from '../controllers/researchController.js';

const router = express.Router();

router.use(protect);

router.get('/ingredient-knowledge', listIngredientKnowledge);
router.post('/ingredient-knowledge', createIngredientKnowledgeDraft);
router.post('/ingredient-knowledge/import', importIngredientKnowledge);
router.get('/ingredient-knowledge/match', matchIngredientKnowledge);
router.get('/ingredient-knowledge/:id', getIngredientKnowledgeById);
router.post('/ingredient-knowledge/:id/verify', verifyIngredientKnowledge);

router.get('/queue', listResearchQueue);
router.get('/queue/:id', getResearchQueueItem);
router.post('/queue/:id/run', runQueuedIngredientResearch);
router.post('/research', runQueuedIngredientResearch);
router.post('/queue/:id/approve', approveQueuedResearch);
router.post('/queue/:id/reject', rejectQueuedResearch);
router.patch('/queue/:id', editQueuedResearch);

export default router;
