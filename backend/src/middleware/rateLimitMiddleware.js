import ApiError from '../utils/ApiError.js';

const buckets = new Map();

const getClientKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * Simple in-memory sliding-window rate limiter (no Redis dependency).
 */
export const createRateLimiter = ({
  windowMs = 60_000,
  max = 30,
  keyPrefix = 'rl',
  message = 'Too many requests. Please try again later.',
} = {}) => (req, res, next) => {
  const now = Date.now();
  const key = `${keyPrefix}:${getClientKey(req)}`;
  const entry = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  buckets.set(key, entry);

  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > max) {
    return next(new ApiError(429, message));
  }

  return next();
};

export const clickTrackingRateLimit = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.CLICK_TRACKING_RATE_LIMIT || 20),
  keyPrefix: 'click',
  message: 'Too many click tracking requests.',
});

export default { createRateLimiter, clickTrackingRateLimit };
