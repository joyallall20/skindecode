import express from 'express';

import {
  createConversation,
  getConversation,
  getMyConversations,
  getMyChatUsage,
  sendMessage,
  deleteConversation,
} from '../controllers/chatController.js';

import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * All chat endpoints require authentication.
 */
router.use(protect);

/**
 * Create conversation
 */
router.post(
  '/',
  createConversation
);

/**
 * Get user's conversations
 */
router.get(
  '/',
  getMyConversations
);

/**
 * Get today's AI chat usage.
 *
 * IMPORTANT:
 * Keep this BEFORE /:id.
 */
router.get(
  '/usage',
  getMyChatUsage
);

/**
 * Get one conversation
 */
router.get(
  '/:id',
  getConversation
);

/**
 * Send message
 */
router.post(
  '/:id/messages',
  sendMessage
);

/**
 * Delete conversation
 */
router.delete(
  '/:id',
  deleteConversation
);

export default router;