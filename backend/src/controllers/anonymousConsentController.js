import crypto from 'crypto';

import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

import {
  recordAnonymousConsent,
} from '../services/anonymousConsentService.js';

const SESSION_COOKIE = 'skindecode_anon_session';

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return String(forwarded)
      .split(',')[0]
      .trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
};

const getOrCreateSessionId = (req, res) => {
  let sessionId =
    req.cookies?.[SESSION_COOKIE];

  if (!sessionId) {
    sessionId = crypto.randomUUID();

    res.cookie(
      SESSION_COOKIE,
      sessionId,
      {
        httpOnly: true,

        // Cross-site frontend (Vercel) -> backend (Render)
        secure: true,
        sameSite: 'none',

        maxAge:
          1000 *
          60 *
          60 *
          24 *
          30,

        path: '/',
      }
    );
  }

  return sessionId;
};

export const recordConsent =
  asyncHandler(
    async (req, res) => {
      const {
        agreedToTerms,
        agreedToPrivacy,
      } = req.body || {};

      if (
        agreedToTerms !== true ||
        agreedToPrivacy !== true
      ) {
        throw new ApiError(
          400,
          'You must agree to the Terms of Use and Privacy Notice before receiving personalized recommendations.'
        );
      }

      const sessionId =
        getOrCreateSessionId(
          req,
          res
        );

      const consent =
        await recordAnonymousConsent({
          sessionId,
          ip: getClientIp(req),
          userAgent:
            req.get('user-agent'),
        });

      res.status(201).json({
        success: true,
        data: consent,
      });
    }
  );