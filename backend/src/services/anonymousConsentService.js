import crypto from 'crypto';

import AnonymousConsent from '../models/AnonymousConsent.js';

const TERMS_VERSION =
  process.env.TERMS_VERSION || '1.0';

const PRIVACY_VERSION =
  process.env.PRIVACY_VERSION || '1.0';

const CONSENT_SECRET =
  process.env.CONSENT_HASH_SECRET ||
  process.env.JWT_SECRET ||
  'development-consent-secret';

const hashValue = (value) =>
  crypto
    .createHmac('sha256', CONSENT_SECRET)
    .update(String(value || ''))
    .digest('hex');

const createConsentId = () =>
  `consent_${crypto.randomUUID()}`;

export const recordAnonymousConsent = async ({
  sessionId,
  ip,
  userAgent,
}) => {
  if (!sessionId) {
    throw new Error(
      'Anonymous session ID is required.'
    );
  }

  const consentId = createConsentId();

  const consent = await AnonymousConsent.create({
    consentId,

    sessionHash: hashValue(sessionId),

    consentType:
      'personalized_recommendation',

    termsVersion: TERMS_VERSION,

    privacyVersion: PRIVACY_VERSION,

    consented: true,

    consentedAt: new Date(),

    ipHash: ip
      ? hashValue(ip)
      : null,

    userAgent:
      String(userAgent || '').slice(0, 1000) ||
      null,

    purpose:
      'Generate personalized skincare product recommendations from questionnaire responses.',
  });

  return {
    consentId: consent.consentId,
    termsVersion: consent.termsVersion,
    privacyVersion: consent.privacyVersion,
    consentedAt: consent.consentedAt,
  };
};

export const verifyAnonymousConsent =
  async ({
    consentId,
    sessionId,
  }) => {
    if (!consentId || !sessionId) {
      return null;
    }

    const consent =
      await AnonymousConsent.findOne({
        consentId,
        sessionHash: hashValue(sessionId),
        consented: true,
      }).lean();

    return consent;
  };