import express from 'express';

import {
  analyzeAnonymously,
  getAnonymousAnalysisStatus,
} from '../controllers/anonymousAnalysisController.js';

import {
  recordConsent,
} from '../controllers/anonymousConsentController.js';

const router =
  express.Router();

/*
|--------------------------------------------------------------------------
| Anonymous consent
|--------------------------------------------------------------------------
|
| Creates an auditable anonymous consent record.
|
*/

router.post(
  '/consent',
  recordConsent
);

/*
|--------------------------------------------------------------------------
| Anonymous recommendation
|--------------------------------------------------------------------------
|
| POST /
|
| Validates the questionnaire and places
| the analysis into the Redis/BullMQ queue.
|
*/

router.post(
  '/',
  analyzeAnonymously
);

/*
|--------------------------------------------------------------------------
| Anonymous recommendation status
|--------------------------------------------------------------------------
|
| GET /:jobId
|
| Frontend polls this endpoint until the
| analysis is completed.
|
*/

router.get(
  '/:jobId',
  getAnonymousAnalysisStatus
);

export default router;