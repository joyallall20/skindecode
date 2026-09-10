import mongoose from 'mongoose';

import ChatConversation from '../models/ChatConversation.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

import { answerSkinDecodeQuestion } from '../services/skinDecodeChatService.js';
import { getInstantChatResult } from '../services/chatIntentService.js';

import {
  consumeChatMessage,
  getChatUsage,
} from '../services/chatUsageService.js';

const safeMessage = (text) =>
  String(text || '').trim();

/**
 * Normalize whatever the chat service returns.
 *
 * Supports:
 * result.answer
 * result.text
 */
const getAnswer = (result) =>
  String(
    result?.answer ??
      result?.text ??
      ''
  ).trim();

/**
 * Prevent empty assistant messages from reaching
 * the ChatConversation mongoose schema.
 */
const throwIfEmptyAnswer = (answer) => {
  if (!answer) {
    throw new ApiError(
      502,
      'Unable to generate a chat response. Please try again.'
    );
  }
};

/**
 * ============================================================
 * CREATE CONVERSATION
 * ============================================================
 */
export const createConversation = asyncHandler(
  async (req, res) => {
    const userId = req.user?._id;

    const {
      product,
      recommendation,
      message,
    } = req.body;

    if (!userId) {
      throw new ApiError(
        401,
        'Authentication required.'
      );
    }

    const cleanMessage = safeMessage(message);

    /**
     * Check instant-response intents FIRST.
     *
     * Examples:
     * hi
     * hello
     * kese ho
     * kaise ho
     * thanks
     * shukriya
     * bye
     *
     * These do not use Groq and therefore
     * do not consume the daily AI quota.
     */
    const instantResult = cleanMessage
      ? getInstantChatResult(cleanMessage)
      : null;

    const isInstant = Boolean(
      instantResult?.handled
    );

    /**
     * Only consume quota for messages that
     * actually require AI processing.
     */
    let usage = null;

    if (cleanMessage && !isInstant) {
      usage = await consumeChatMessage(userId);

      if (!usage.allowed) {
        throw new ApiError(
          429,
          `You've reached today's chat limit of ${usage.limit} AI messages. Please come back tomorrow.`
        );
      }
    }

    /**
     * Create conversation.
     */
    const conversation =
      await ChatConversation.create({
        user: userId,
        product: product || null,
        recommendation:
          recommendation || null,
        messages: [],
      });

    /**
     * Optional first message.
     */
    if (cleanMessage) {
      const result =
        await answerSkinDecodeQuestion({
          question: cleanMessage,

          history:
            conversation.messages,

          attachedProductId:
            conversation.product,

          userId,
        });

      const aiReply =
        getAnswer(result);

      throwIfEmptyAnswer(aiReply);

      conversation.messages.push(
        {
          role: 'user',
          content: cleanMessage,
          createdAt: new Date(),
        },
        {
          role: 'assistant',
          content: aiReply,
          createdAt: new Date(),
        }
      );

      await conversation.save();
    }

    res.status(201).json({
      success: true,
      data: conversation,

      /**
       * Only include usage when this message
       * actually consumed quota.
       */
      ...(usage ? { usage } : {}),
    });
  }
);

/**
 * ============================================================
 * GET SINGLE CONVERSATION
 * ============================================================
 */
export const getConversation = asyncHandler(
  async (req, res) => {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      throw new ApiError(
        400,
        'Invalid conversation ID.'
      );
    }

    const conversation =
      await ChatConversation.findById(id)
        .lean();

    if (!conversation) {
      throw new ApiError(
        404,
        'Conversation not found.'
      );
    }

    if (
      conversation.user.toString() !==
      req.user?._id?.toString()
    ) {
      throw new ApiError(
        403,
        'You do not have access to this conversation.'
      );
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  }
);

/**
 * ============================================================
 * GET MY CONVERSATIONS
 * ============================================================
 */
export const getMyConversations =
  asyncHandler(
    async (req, res) => {
      const conversations =
        await ChatConversation.find({
          user: req.user?._id,
        })
          .sort({
            updatedAt: -1,
          })
          .lean();

      res.status(200).json({
        success: true,
        data: conversations,
      });
    }
  );

/**
 * ============================================================
 * GET MY CHAT USAGE
 * ============================================================
 *
 * GET /api/chat/usage
 */
export const getMyChatUsage =
  asyncHandler(
    async (req, res) => {
      const usage =
        await getChatUsage(
          req.user?._id
        );

      res.status(200).json({
        success: true,
        data: usage,
      });
    }
  );

/**
 * ============================================================
 * SEND MESSAGE
 * ============================================================
 */
export const sendMessage =
  asyncHandler(
    async (req, res) => {
      const { id } = req.params;

      const message =
        safeMessage(
          req.body?.message
        );

      if (!message) {
        throw new ApiError(
          400,
          'Message content is required.'
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        throw new ApiError(
          400,
          'Invalid conversation ID.'
        );
      }

      /**
       * Find conversation.
       */
      const conversation =
        await ChatConversation.findById(
          id
        );

      if (!conversation) {
        throw new ApiError(
          404,
          'Conversation not found.'
        );
      }

      /**
       * Ownership check.
       */
      if (
        conversation.user.toString() !==
        req.user?._id?.toString()
      ) {
        throw new ApiError(
          403,
          'You do not have access to this conversation.'
        );
      }

      /**
       * Check instant intent FIRST.
       *
       * This means:
       *
       * "Hi"
       * "Kese ho?"
       * "Thanks"
       *
       * won't consume an AI message.
       */
      const instantResult =
        getInstantChatResult(
          message
        );

      const isInstant =
        Boolean(
          instantResult?.handled
        );

      /**
       * Only consume quota for
       * actual AI requests.
       */
      if (!isInstant) {
        const usage =
          await consumeChatMessage(
            req.user._id
          );

        if (!usage.allowed) {
          throw new ApiError(
            429,
            `You've reached today's chat limit of ${usage.limit} AI messages. Please come back tomorrow.`,
            {
              code:
                'CHAT_DAILY_LIMIT_REACHED',

              usage,
            }
          );
        }
      }

      /**
       * Keep history separate from
       * the current user question.
       *
       * This is important because the AI service
       * receives the current question separately.
       */
      const history =
        conversation.messages.slice(
          -12
        );

      /**
       * Store user message.
       */
      conversation.messages.push({
        role: 'user',
        content: message,
        createdAt: new Date(),
      });

      /**
       * Generate response.
       */
      const result =
        await answerSkinDecodeQuestion({
          question: message,

          history,

          attachedProductId:
            conversation.product,

          userId:
            req.user._id,
        });

      const aiReply =
        getAnswer(result);

      throwIfEmptyAnswer(
        aiReply
      );

      /**
       * Store assistant response.
       */
      conversation.messages.push({
        role: 'assistant',
        content: aiReply,
        createdAt: new Date(),
      });

      await conversation.save();

      res.status(201).json({
        success: true,
        data: conversation,
      });
    }
  );

/**
 * ============================================================
 * DELETE CONVERSATION
 * ============================================================
 */
export const deleteConversation =
  asyncHandler(
    async (req, res) => {
      const { id } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        throw new ApiError(
          400,
          'Invalid conversation ID.'
        );
      }

      const conversation =
        await ChatConversation.findById(
          id
        );

      if (!conversation) {
        throw new ApiError(
          404,
          'Conversation not found.'
        );
      }

      if (
        conversation.user.toString() !==
        req.user?._id?.toString()
      ) {
        throw new ApiError(
          403,
          'You do not have access to this conversation.'
        );
      }

      await ChatConversation.findByIdAndDelete(
        id
      );

      res.status(200).json({
        success: true,
        message:
          'Conversation deleted successfully.',
      });
    }
  );

/**
 * ============================================================
 * DEFAULT EXPORT
 * ============================================================
 */
export default {
  createConversation,
  getConversation,
  getMyConversations,
  getMyChatUsage,
  sendMessage,
  deleteConversation,
};