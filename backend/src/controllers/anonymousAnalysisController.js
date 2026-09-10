import crypto from 'crypto';

import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

import {
  verifyAnonymousConsent,
} from '../services/anonymousConsentService.js';

import {
  enqueueAnonymousAnalysis,
} from '../queues/anonymousAnalysisQueue.js';

import {
  anonymousAnalysisQueue,
} from '../queues/anonymousAnalysisQueue.js';

import {
  getAnonymousAnalysisResult,
} from '../services/anonymousAnalysisResultStore.js';

const REQUIRED = [
  'skinType',
  'sensitivity',
  'morningSkinFeel',
  'responseToNewProducts',
  'concerns',
  'primaryGoal',
];

const SKIN_FEEL_MAP = {
  'tight-dry': 'dry',
};

const PROFILE_ENUMS = {
  skinType: [
    'oily',
    'dry',
    'combination',
    'normal',
  ],

  sensitivity: [
    'low',
    'medium',
    'high',
  ],

  morningSkinFeel: [
    'dry',
    'balanced',
    'slightly-oily',
    'very-oily',
    'combination-feel',
  ],

  responseToNewProducts: [
    'no-reaction',
    'sometimes-irritated',
    'often-irritated',
    'very-easily-irritated',
  ],

  primaryGoal: [
    'clearer-skin',
    'brighter-even',
    'hydration',
    'smoother-texture',
    'less-oiliness',
    'anti-aging',
    'healthier-skin',
  ],
};

const ALLOWED_CONCERNS = [
  'acne',
  'pigmentation',
  'dark-spots',
  'dryness',
  'excess-oil',
  'aging',
  'fine-lines',
  'uneven-texture',
  'dullness',
  'redness',
  'dark-circles',
  'dehydration',
  'large-pores',
  'sun-damage',
];

const ALLOWED_AVOIDANCE_PREFERENCES = [
  'fragrance',
  'essential-oils',
  'alcohol',
  'harsh-exfoliants',
  'irritating-ingredients',
  'known-allergies',
  'nothing-to-avoid',
];

/*
|--------------------------------------------------------------------------
| Session hashing
|--------------------------------------------------------------------------
|
| The raw anonymous session ID is NEVER put into Redis jobs.
|
*/

const hashSessionId = (
  sessionId
) =>
  crypto
    .createHash('sha256')
    .update(
      String(sessionId)
    )
    .digest('hex');

/*
|--------------------------------------------------------------------------
| Validate anonymous questionnaire
|--------------------------------------------------------------------------
*/

const validateProfile = (
  profile = {}
) => {
  const normalized = {
    ...profile,

    morningSkinFeel:
      SKIN_FEEL_MAP[
        profile.morningSkinFeel
      ] ||
      profile.morningSkinFeel,

    allergies:
      Array.isArray(
        profile.allergies
      )
        ? profile.allergies
        : [],

    avoidedIngredients:
      Array.isArray(
        profile.avoidedIngredients
      )
        ? profile.avoidedIngredients
        : [],

    mustHavePreferences:
      Array.isArray(
        profile.mustHavePreferences
      )
        ? profile.mustHavePreferences
        : [],

    currentProducts:
      Array.isArray(
        profile.currentProducts
      )
        ? profile.currentProducts
        : [],

    avoidancePreferences:
      Array.isArray(
        profile.avoidancePreferences
      )
        ? profile.avoidancePreferences
        : [],
  };

  const missing = REQUIRED.filter((field) => {
    const value = normalized[field];

    return (
      !value ||
      (
        Array.isArray(value) &&
        value.length === 0
      )
    );
  });

  if (missing.length) {
    throw new ApiError(
      400,
      `Complete the required skin questions: ${missing.join(
        ', '
      )}.`
    );
  }

  // Validate enums
  for (
    const [
      field,
      allowed,
    ] of Object.entries(
      PROFILE_ENUMS
    )
  ) {
    if (
      !allowed.includes(
        normalized[field]
      )
    ) {
      throw new ApiError(
        400,
        `Invalid ${field} value.`
      );
    }
  }

  // Validate concerns
  if (
    !Array.isArray(normalized.concerns) ||
    normalized.concerns.length === 0
  ) {
    throw new ApiError(
      400,
      'At least one skin concern is required.'
    );
  }

  const invalidConcerns = normalized.concerns.filter(
    (concern) => !ALLOWED_CONCERNS.includes(concern)
  );

  if (invalidConcerns.length) {
    throw new ApiError(
      400,
      `Invalid concerns: ${invalidConcerns.join(', ')}.`
    );
  }

  // Validate avoidancePreferences
  if (normalized.avoidancePreferences.length > 0) {
    const invalidPreferences = normalized.avoidancePreferences.filter(
      (pref) => !ALLOWED_AVOIDANCE_PREFERENCES.includes(pref)
    );

    if (invalidPreferences.length) {
      throw new ApiError(
        400,
        `Invalid avoidance preferences: ${invalidPreferences.join(', ')}.`
      );
    }

    // Enforce "nothing-to-avoid" exclusivity
    if (
      normalized.avoidancePreferences.includes('nothing-to-avoid') &&
      normalized.avoidancePreferences.length > 1
    ) {
      throw new ApiError(
        400,
        'nothing-to-avoid must be the only avoidance preference when selected.'
      );
    }
  }

  return normalized;
};

/*
|--------------------------------------------------------------------------
| Consent verification
|--------------------------------------------------------------------------
*/

const requireAnonymousConsent =
  async (req) => {
    const consentId =
      String(
        req.body?.consentId ||
          ''
      ).trim();

    if (!consentId) {
      throw new ApiError(
        400,
        'Consent is required before generating personalized recommendations.'
      );
    }

    const sessionId =
      req.cookies
        ?.skindecode_anon_session;

    if (!sessionId) {
      throw new ApiError(
        400,
        'Anonymous consent session is missing. Please accept the privacy notice again.'
      );
    }

    const consent =
      await verifyAnonymousConsent({
        consentId,
        sessionId,
      });

    if (!consent) {
      throw new ApiError(
        400,
        'Valid consent could not be verified. Please accept the privacy notice again.'
      );
    }

    return {
      consent,
      sessionId,
    };
  };

/*
|--------------------------------------------------------------------------
| POST /
|
| Validate + enqueue.
|
| IMPORTANT:
| This endpoint does NOT perform MongoDB product queries.
| It returns immediately with a jobId.
|--------------------------------------------------------------------------
*/

export const analyzeAnonymously =
  asyncHandler(
    async (req, res) => {
      /*
       * 1. Verify consent.
       */

      const {
        consent,
        sessionId,
      } =
        await requireAnonymousConsent(
          req
        );

      /*
       * 2. Validate questionnaire.
       */

      const profile =
        validateProfile(
          req.body?.profile ||
            {}
        );

      /*
       * 3. Hash session ID.
       *
       * Never put raw session ID into Redis.
       */

      const sessionHash =
        hashSessionId(
          sessionId
        );

      /*
       * 4. Only send the minimum consent
       * information needed by the worker.
       */

      const consentForJob = {
        consentId:
          consent.consentId,

        termsVersion:
          consent.termsVersion,

        privacyVersion:
          consent.privacyVersion,

        consentedAt:
          consent.consentedAt,
      };

      /*
       * 5. Queue analysis.
       */

      const job =
        await enqueueAnonymousAnalysis({
          profile,

          consent:
            consentForJob,

          sessionHash,
        });

      console.log(
        `[ANON API] Queued analysis job ${job.id}`
      );

      /*
       * 6. Return immediately.
       */

      return res.status(202).json({
        success: true,

        data: {
          jobId:
            job.id,

          status:
            'queued',

          message:
            'Your skin analysis is being prepared.',
        },
      });
    }
  );

/*
|--------------------------------------------------------------------------
| GET /:jobId
|
| Frontend polls this endpoint.
|--------------------------------------------------------------------------
*/

export const getAnonymousAnalysisStatus =
  asyncHandler(
    async (req, res) => {
      const jobId =
        String(
          req.params.jobId ||
            ''
        ).trim();

      if (!jobId) {
        throw new ApiError(
          400,
          'Analysis job ID is required.'
        );
      }

      const sessionId =
        req.cookies
          ?.skindecode_anon_session;

      if (!sessionId) {
        throw new ApiError(
          400,
          'Anonymous analysis session is missing.'
        );
      }

      const sessionHash =
        hashSessionId(
          sessionId
        );

      /*
       * First check whether the worker
       * has already produced a result.
       */

      const storedResult =
        await getAnonymousAnalysisResult(
          jobId
        );

      if (storedResult) {
        /*
         * Make sure another anonymous
         * session cannot retrieve the result.
         */

        if (
          storedResult.sessionHash !==
          sessionHash
        ) {
          throw new ApiError(
            403,
            'You are not authorized to access this analysis.'
          );
        }

        if (
          storedResult.status ===
          'failed'
        ) {
          return res.status(200).json({
            success: false,

            data: {
              jobId,

              status:
                'failed',

              message:
                storedResult.message ||
                'Analysis failed.',
            },
          });
        }

        return res.status(200).json({
          success: true,

          data: {
            jobId,

            status:
              'completed',

            result:
              storedResult.result,
          },
        });
      }

      /*
       * No completed result yet.
       *
       * Check BullMQ job state.
       */

      const job =
        await anonymousAnalysisQueue.getJob(
          jobId
        );

      if (!job) {
        return res.status(404).json({
          success: false,

          data: {
            jobId,

            status:
              'not_found',

            message:
              'Analysis job was not found or has expired.',
          },
        });
      }

      /*
       * BullMQ states:
       *
       * waiting
       * active
       * delayed
       * prioritized
       */

      let state =
        await job.getState();

      if (
        state === 'waiting' ||
        state === 'prioritized'
      ) {
        state = 'queued';
      } else if (
        state === 'active'
      ) {
        state = 'processing';
      } else if (
        state === 'delayed'
      ) {
        state = 'queued';
      }

      return res.status(200).json({
        success: true,

        data: {
          jobId,

          status:
            state || 'processing',
        },
      });
    }
  );

export default {
  analyzeAnonymously,
  getAnonymousAnalysisStatus,
};