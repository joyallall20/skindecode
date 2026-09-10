import ChatUsage from '../models/ChatUsage.js';

const DEFAULT_DAILY_LIMIT = 20;

/**
 * Get configured daily chat limit.
 *
 * .env:
 * CHAT_DAILY_MESSAGE_LIMIT=20
 */
function getDailyLimit() {
  const value = Number(
    process.env.CHAT_DAILY_MESSAGE_LIMIT || DEFAULT_DAILY_LIMIT
  );

  if (!Number.isFinite(value) || value < 1) {
    return DEFAULT_DAILY_LIMIT;
  }

  return Math.floor(value);
}

/**
 * Get today's date key.
 *
 * Example:
 * 2026-09-09
 *
 * UTC is intentional so every backend server uses
 * the same reset boundary.
 */
function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 * Consume one AI chat message.
 *
 * IMPORTANT:
 * Call this ONLY for messages that actually need
 * AI/RAG/Groq processing.
 *
 * Instant messages such as:
 * - hi
 * - hello
 * - kese ho
 * - kaise ho
 * - thanks
 * - shukriya
 * - bye
 *
 * should NOT call this function.
 */
export async function consumeChatMessage(userId) {
  if (!userId) {
    throw new Error(
      'userId is required to consume chat usage.'
    );
  }

  const limit = getDailyLimit();
  const dateKey = getDateKey();

  /**
   * FAST PATH
   *
   * Atomically increment only when the user
   * is still below the limit.
   *
   * This is important for concurrent requests.
   */
  const updated = await ChatUsage.findOneAndUpdate(
    {
      user: userId,
      dateKey,

      // Do not increment if already at the limit.
      count: { $lt: limit },
    },
    {
      $inc: {
        count: 1,
      },
    },
    {
      returnDocument: 'after',
    }
  ).lean();

  if (updated) {
    return {
      allowed: true,
      count: updated.count,
      limit,
      remaining: Math.max(
        limit - updated.count,
        0
      ),
      dateKey,
    };
  }

  /**
   * No document exists for today.
   *
   * Create the first usage record.
   */
  try {
    const created = await ChatUsage.create({
      user: userId,
      dateKey,
      count: 1,
    });

    return {
      allowed: true,
      count: created.count,
      limit,
      remaining: Math.max(
        limit - created.count,
        0
      ),
      dateKey,
    };
  } catch (error) {
    /**
     * Another request may have created the document
     * between our update and create.
     *
     * MongoDB will return duplicate key error 11000.
     *
     * Retry the atomic update.
     */
    if (error?.code !== 11000) {
      throw error;
    }

    const retried = await ChatUsage.findOneAndUpdate(
      {
        user: userId,
        dateKey,
        count: { $lt: limit },
      },
      {
        $inc: {
          count: 1,
        },
      },
      {
        returnDocument: 'after',
      }
    ).lean();

    if (retried) {
      return {
        allowed: true,
        count: retried.count,
        limit,
        remaining: Math.max(
          limit - retried.count,
          0
        ),
        dateKey,
      };
    }

    /**
     * User is already at the limit.
     */
    return {
      allowed: false,
      count: limit,
      limit,
      remaining: 0,
      dateKey,
    };
  }
}

/**
 * Get current user's chat usage.
 *
 * Does NOT consume anything.
 */
export async function getChatUsage(userId) {
  if (!userId) {
    throw new Error(
      'userId is required to get chat usage.'
    );
  }

  const limit = getDailyLimit();
  const dateKey = getDateKey();

  const usage = await ChatUsage.findOne({
    user: userId,
    dateKey,
  }).lean();

  const count = usage?.count || 0;

  return {
    count,
    limit,
    remaining: Math.max(
      limit - count,
      0
    ),
    dateKey,
  };
}

/**
 * Reset today's usage for a user.
 *
 * Useful for:
 * - admin testing
 * - development
 * - customer support
 *
 * Normally you do NOT need to call this.
 */
export async function resetUserChatUsage(userId) {
  if (!userId) {
    throw new Error(
      'userId is required to reset chat usage.'
    );
  }

  const dateKey = getDateKey();

  await ChatUsage.deleteOne({
    user: userId,
    dateKey,
  });

  return {
    success: true,
    dateKey,
  };
}

/**
 * Export the configured limit if another service
 * needs to display it.
 */
export { getDailyLimit };