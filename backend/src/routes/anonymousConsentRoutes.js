import express from 'express';

import {
  recordConsent,
} from '../controllers/anonymousConsentController.js';

const router =
  express.Router();

router.post(
  '/',
  recordConsent
);

export default router;