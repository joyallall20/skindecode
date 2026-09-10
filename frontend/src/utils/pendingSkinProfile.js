/**
 * Temporary storage for a completed skin assessment while the user logs in.
 * MongoDB remains the source of truth after a successful save.
 */

const PENDING_SKIN_PROFILE_KEY = 'skinly-pending-skin-profile';

export function storePendingSkinProfile(profile) {
  if (!profile || typeof profile !== 'object') return;
  try {
    sessionStorage.setItem(PENDING_SKIN_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // sessionStorage may be unavailable (private mode / quota).
  }
}

export function readPendingSkinProfile() {
  try {
    const raw = sessionStorage.getItem(PENDING_SKIN_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingSkinProfile() {
  try {
    sessionStorage.removeItem(PENDING_SKIN_PROFILE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Build the SkinProfile payload from onboarding answers.
 * Keeps the full assessment, including onboardingAnswers.
 */
export function buildSkinProfilePayload(answers = {}) {
  const allergies = Array.isArray(answers.allergies)
    ? answers.allergies.filter((item) => item && item !== 'none')
    : [];

  const avoidedIngredients = Array.isArray(answers.avoidedIngredients)
    ? answers.avoidedIngredients.filter((item) => item && item !== 'none')
    : [];

  const mustHavePreferences = Array.isArray(answers.mustHavePreferences)
    ? answers.mustHavePreferences
    : [];

  const currentProducts = Array.isArray(answers.currentProducts)
    ? answers.currentProducts
    : [];

  const concerns = Array.isArray(answers.concerns) ? answers.concerns : [];

  return {
    skinType: answers.skinType,
    sensitivity: answers.sensitivity,
    morningSkinFeel: answers.morningSkinFeel,
    responseToNewProducts: answers.responseToNewProducts,
    sunscreenHabit: answers.sunscreenHabit,
    ageRange: answers.ageRange,
    currentProducts,
    primaryGoal: answers.primaryGoal,
    concerns,
    allergies,
    avoidedIngredients,
    mustHavePreferences,
    onboardingAnswers: { ...answers },
    questionnaireCompleted: true,
  };
}
