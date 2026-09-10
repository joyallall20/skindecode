import mongoose from 'mongoose';
import SkinProfile from '../models/SkinProfile.js';
import User from '../models/User.js';
import Ingredient from '../models/Ingredient.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const allowedFields = [
  'skinType',
  'sensitivity',
  'morningSkinFeel',
  'responseToNewProducts',
  'sunscreenHabit',
  'ageRange',
  'currentProducts',
  'primaryGoal',
  'concerns',
  'allergies',
  'avoidedIngredients',
  'mustHavePreferences',
  'avoidancePreferences',
  'onboardingAnswers',
  'budget',
  'preferredProductCategories',
  'questionnaireCompleted',
];

const requiredCompletedFields = [
  'skinType',
  'sensitivity',
  'morningSkinFeel',
  'responseToNewProducts',
  'primaryGoal',
];

const allowedAvoidancePreferences = [
  'fragrance',
  'essential-oils',
  'alcohol',
  'harsh-exfoliants',
  'irritating-ingredients',
  'known-allergies',
  'nothing-to-avoid',
];

const assertCompletedProfile = (payload) => {
  const missing = requiredCompletedFields.filter((field) => !payload[field] || payload[field] === 'unknown');
  if (!Array.isArray(payload.concerns) || payload.concerns.length === 0) missing.push('concerns');
  if (missing.length) {
    throw new ApiError(400, `Completed questionnaire is missing: ${missing.join(', ')}.`);
  }
};

const normalizeSkinProfilePayload = async (payload = {}) => {
  const nextPayload = { ...payload };

  if (nextPayload.morningSkinFeel === 'tight-dry') {
    nextPayload.morningSkinFeel = 'dry';
  }

  if (nextPayload.userId && nextPayload.userId !== undefined) {
    delete nextPayload.userId;
  }

  if (nextPayload.budget && typeof nextPayload.budget === 'object') {
    nextPayload.budget = {
      min: Number(nextPayload.budget.min ?? 0),
      max: Number(nextPayload.budget.max ?? 5000),
    };
  }

  if (nextPayload.concerns) {
    nextPayload.concerns = Array.isArray(nextPayload.concerns) ? nextPayload.concerns : [nextPayload.concerns];
  }

  if (nextPayload.allergies) {
    nextPayload.allergies = Array.isArray(nextPayload.allergies) ? nextPayload.allergies : [nextPayload.allergies];
  }

  if (nextPayload.preferredProductCategories && !Array.isArray(nextPayload.preferredProductCategories)) {
    nextPayload.preferredProductCategories = [nextPayload.preferredProductCategories];
  }

  if (nextPayload.avoidedIngredients && !Array.isArray(nextPayload.avoidedIngredients)) {
    nextPayload.avoidedIngredients = [nextPayload.avoidedIngredients];
  }

  if (nextPayload.currentProducts && !Array.isArray(nextPayload.currentProducts)) {
    nextPayload.currentProducts = [nextPayload.currentProducts];
  }

  if (nextPayload.mustHavePreferences && !Array.isArray(nextPayload.mustHavePreferences)) {
    nextPayload.mustHavePreferences = [nextPayload.mustHavePreferences];
  }

  // Normalize avoidancePreferences
  if (nextPayload.avoidancePreferences && !Array.isArray(nextPayload.avoidancePreferences)) {
    nextPayload.avoidancePreferences = [nextPayload.avoidancePreferences];
  }

  if (Array.isArray(nextPayload.avoidancePreferences)) {
    const preferences = nextPayload.avoidancePreferences.filter(Boolean);
    
    // Validate allowed values
    const invalidPreferences = preferences.filter(
      (pref) => !allowedAvoidancePreferences.includes(pref)
    );
    
    if (invalidPreferences.length) {
      throw new ApiError(400, `Invalid avoidance preferences: ${invalidPreferences.join(', ')}.`);
    }
    
    // If "nothing-to-avoid" is selected, normalize to only that value
    if (preferences.includes('nothing-to-avoid')) {
      nextPayload.avoidancePreferences = ['nothing-to-avoid'];
    } else {
      nextPayload.avoidancePreferences = preferences;
    }
  }

  if (Array.isArray(nextPayload.avoidedIngredients)) {
    const ingredientValues = nextPayload.avoidedIngredients.filter(Boolean);
    const objectIds = ingredientValues.filter((value) => mongoose.Types.ObjectId.isValid(value));
    const names = ingredientValues.filter((value) => !mongoose.Types.ObjectId.isValid(value));
    const resolved = names.length
      ? await Ingredient.find({ $or: [{ name: { $in: names } }, { aliases: { $in: names } }] }).select('_id').lean()
      : [];
    nextPayload.avoidedIngredients = [...objectIds, ...resolved.map((ingredient) => ingredient._id)];
  }

  return Object.fromEntries(
    Object.entries(nextPayload).filter(([key, value]) => allowedFields.includes(key) && value !== undefined)
  );
};

export const createSkinProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User authentication is required.');
  }

  const sanitizedPayload = await normalizeSkinProfilePayload(req.body);
  if (sanitizedPayload.questionnaireCompleted) {
    assertCompletedProfile(sanitizedPayload);
  }

  const existingProfile = await SkinProfile.findOne({ userId }).select('_id').lean();

  // Upsert so retaking the assessment does not create duplicates.
  const profile = await SkinProfile.findOneAndUpdate(
    { userId },
    { $set: { ...sanitizedPayload, userId } },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  await User.findByIdAndUpdate(userId, { skinProfile: profile._id });

  res.status(existingProfile ? 200 : 201).json({
    success: true,
    data: profile,
  });
});

export const getMySkinProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const profile = await SkinProfile.findOne({ userId })
    .populate('preferredProductCategories', 'name')
    .populate('avoidedIngredients', 'name');

  if (!profile) {
    throw new ApiError(404, 'Skin profile not found.');
  }

  res.status(200).json({
    success: true,
    data: profile,
  });
});

export const updateSkinProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User authentication is required.');
  }

  const sanitizedPayload = await normalizeSkinProfilePayload(req.body);
  if (!Object.keys(sanitizedPayload).length) {
    throw new ApiError(400, 'No valid skin profile fields were provided.');
  }

  const existing = await SkinProfile.findOne({ userId }).lean();
  if (sanitizedPayload.questionnaireCompleted) {
    assertCompletedProfile({ ...(existing || {}), ...sanitizedPayload });
  }

  // Upsert: one SkinProfile per authenticated user.
  const updatedProfile = await SkinProfile.findOneAndUpdate(
    { userId },
    { $set: { ...sanitizedPayload, userId } },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate('preferredProductCategories', 'name')
    .populate('avoidedIngredients', 'name');

  await User.findByIdAndUpdate(userId, { skinProfile: updatedProfile._id });

  res.status(200).json({
    success: true,
    data: updatedProfile,
  });
});

export const deleteSkinProfile = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const profile = await SkinProfile.findOne({ userId });
  if (!profile) {
    throw new ApiError(404, 'Skin profile not found.');
  }

  await SkinProfile.findByIdAndDelete(profile._id);
  await User.findByIdAndUpdate(userId, { skinProfile: null });

  res.status(200).json({
    success: true,
    message: 'Skin profile deleted successfully.',
  });
});

export const completeQuestionnaire = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const profile = await SkinProfile.findOne({ userId });
  if (!profile) {
    throw new ApiError(404, 'Skin profile not found.');
  }

  assertCompletedProfile(profile.toObject());
  profile.questionnaireCompleted = true;
  await profile.save();

  res.status(200).json({
    success: true,
    message: 'Questionnaire marked as complete.',
    data: profile,
  });

});

export const saveAnonymousAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'User authentication is required.');
  }

  const source = req.body?.profile || req.body;
  const sanitizedPayload = await normalizeSkinProfilePayload({
    ...source,
    questionnaireCompleted: true,
  });
  assertCompletedProfile(sanitizedPayload);

  const profile = await SkinProfile.findOneAndUpdate(
    { userId },
    { $set: { ...sanitizedPayload, userId } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await User.findByIdAndUpdate(userId, { skinProfile: profile._id });

  res.status(200).json({
    success: true,
    data: profile,
  });
});

export default {
  createSkinProfile,
  getMySkinProfile,
  updateSkinProfile,
  deleteSkinProfile,
  completeQuestionnaire,
  saveAnonymousAnalysis,
};