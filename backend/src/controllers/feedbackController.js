import mongoose from "mongoose";
import Feedback from "../models/Feedback.js";
import FeedbackLike from "../models/FeedbackLike.js";

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to get current challenge month
const getCurrentChallengeMonth = () => {
  return new Date().toISOString().slice(0, 7);
};

/**
 * @desc    Create new feedback
 * @route   POST /api/feedback
 * @access  Private
 */
export const createFeedback = async (req, res) => {
  try {
    const { text, productId } = req.body;
    const userId = req.user.uid; // Get authenticated user from middleware

    // Validate text
    if (!text || typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Feedback text is required",
      });
    }

    const trimmedText = text.trim();

    // Validate minimum length
    if (trimmedText.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Feedback must be at least 5 characters long",
      });
    }

    // Validate maximum length
    if (trimmedText.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Feedback cannot exceed 2000 characters",
      });
    }

    // Basic sanitization - remove HTML tags
    const sanitizedText = trimmedText.replace(/<[^>]*>/g, "");

    // Validate productId if provided
    if (productId && !isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    // Calculate challenge month on the server
    const challengeMonth = getCurrentChallengeMonth();

    // Create feedback with server-controlled fields
    const feedback = await Feedback.create({
      userId,
      productId: productId || null,
      text: sanitizedText,
      likesCount: 0,
      status: "published",
      challengeMonth,
    });

    res.status(201).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error("Error creating feedback:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating feedback",
    });
  }
};

/**
 * @desc    Get published feedback with pagination
 * @route   GET /api/feedback
 * @access  Public
 */
export const getFeedback = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "helpful",
      productId,
    } = req.query;

    // Parse and validate pagination
    const pageNum = parseInt(page) || 1;
    let limitNum = parseInt(limit) || 20;

    // Cap limit to prevent excessive queries
    limitNum = Math.min(limitNum, 50);

    // Build query
    const query = {
      status: "published",
    };

    // Add productId filter if provided
    if (productId) {
      if (!isValidObjectId(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }
      query.productId = productId;
    }

    // Determine sort order
    let sortOptions = {};
    if (sort === "newest") {
      sortOptions = { createdAt: -1 };
    } else {
      // Default: helpful
      sortOptions = { likesCount: -1, createdAt: -1 };
    }

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Feedback.countDocuments(query);

    // Get feedback with pagination
    const feedbackList = await Feedback.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .select("-__v");

    // Check if user is authenticated for like state
    const userId = req.user?.uid;

    let feedbackWithLikeState = feedbackList;

    if (userId) {
      // Efficiently get like state for all feedback items
      const feedbackIds = feedbackList.map((f) => f._id);
      const userLikes = await FeedbackLike.find({
        userId,
        feedbackId: { $in: feedbackIds },
      }).select("feedbackId");

      // Build Set of liked feedback IDs
      const likedFeedbackIds = new Set(
        userLikes.map((like) => like.feedbackId.toString())
      );

      // Add likedByCurrentUser to each feedback
      feedbackWithLikeState = feedbackList.map((feedback) => ({
        ...feedback.toObject(),
        likedByCurrentUser: likedFeedbackIds.has(feedback._id.toString()),
      }));
    } else {
      // For unauthenticated users
      feedbackWithLikeState = feedbackList.map((feedback) => ({
        ...feedback.toObject(),
        likedByCurrentUser: false,
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        feedback: feedbackWithLikeState,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching feedback",
    });
  }
};

/**
 * @desc    Toggle like/unlike on feedback
 * @route   POST /api/feedback/:feedbackId/like
 * @access  Private
 */
export const toggleFeedbackLike = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const userId = req.user.uid;

    // Validate feedbackId
    if (!isValidObjectId(feedbackId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback ID format",
      });
    }

    // Check if feedback exists and is published
    const feedback = await Feedback.findOne({
      _id: feedbackId,
      status: "published",
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found or not available",
      });
    }

    // Check if user has already liked this feedback
    const existingLike = await FeedbackLike.findOne({
      feedbackId,
      userId,
    });

    let liked = false;
    let likesCount = feedback.likesCount;

    if (existingLike) {
      // User has already liked - remove like (unlike)
      await FeedbackLike.deleteOne({ _id: existingLike._id });

      // Decrement likesCount atomically, ensuring it doesn't go below 0
      const updatedFeedback = await Feedback.findOneAndUpdate(
        { _id: feedbackId, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } },
        { new: true }
      );

      likesCount = updatedFeedback ? updatedFeedback.likesCount : 0;
      liked = false;
    } else {
      // User hasn't liked - add like
      try {
        await FeedbackLike.create({
          feedbackId,
          userId,
        });

        // Increment likesCount atomically
        const updatedFeedback = await Feedback.findOneAndUpdate(
          { _id: feedbackId },
          { $inc: { likesCount: 1 } },
          { new: true }
        );

        likesCount = updatedFeedback.likesCount;
        liked = true;
      } catch (error) {
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
          // Like already exists due to race condition
          const currentFeedback = await Feedback.findById(feedbackId);
          return res.status(200).json({
            success: true,
            data: {
              liked: true,
              likesCount: currentFeedback.likesCount,
            },
          });
        }
        throw error;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        liked,
        likesCount,
      },
    });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling like",
    });
  }
};

/**
 * @desc    Get current challenge information
 * @route   GET /api/feedback/challenge
 * @access  Public
 */
export const getCurrentChallenge = async (req, res) => {
  try {
    const challengeMonth = getCurrentChallengeMonth();

    // Count published feedback for current month
    const feedbackCount = await Feedback.countDocuments({
      challengeMonth,
      status: "published",
    });

    res.status(200).json({
      success: true,
      data: {
        title: "Help us build skinDecode & win ₹500 in skincare",
        reward: {
          amount: 500,
          currency: "INR",
          description: "Skincare reward",
        },
        challengeMonth,
        feedbackCount,
        status: "active",
      },
    });
  } catch (error) {
    console.error("Error fetching challenge info:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching challenge information",
    });
  }
};

// Default export for backward compatibility
export default {
  createFeedback,
  getFeedback,
  toggleFeedbackLike,
  getCurrentChallenge,
};