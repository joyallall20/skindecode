import express from "express";
import {
  createFeedback,
  getFeedback,
  toggleFeedbackLike,
  getCurrentChallenge,
} from "../controllers/feedbackController.js";
import { requireAuth } from "../middleware/authMiddleware.js"; // Adjust path based on your project

const router = express.Router();

// Public routes
router.get("/", getFeedback);
router.get("/challenge", getCurrentChallenge);

// Protected routes
router.post("/", requireAuth, createFeedback);
router.post("/:feedbackId/like", requireAuth, toggleFeedbackLike);

export default router;