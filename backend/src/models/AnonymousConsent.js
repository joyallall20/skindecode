import mongoose from 'mongoose';

const anonymousConsentSchema = new mongoose.Schema(
  {
    consentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    sessionHash: {
      type: String,
      required: true,
      index: true,
    },

    consentType: {
      type: String,
      required: true,
      enum: ['personalized_recommendation'],
      default: 'personalized_recommendation',
    },

    termsVersion: {
      type: String,
      required: true,
    },

    privacyVersion: {
      type: String,
      required: true,
    },

    consented: {
      type: Boolean,
      required: true,
      default: true,
    },

    consentedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    ipHash: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
      maxlength: 1000,
    },

    purpose: {
      type: String,
      required: true,
      default:
        'Generate personalized skincare product recommendations from questionnaire responses.',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

anonymousConsentSchema.index({
  sessionHash: 1,
  consentedAt: -1,
});

export default mongoose.model(
  'AnonymousConsent',
  anonymousConsentSchema
);