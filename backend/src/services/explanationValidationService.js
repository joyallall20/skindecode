import { generateGroqJSON } from './groqService.js';
import { EXPLANATION_PROMPT_VERSION } from '../constants/intelligenceVersions.js';

const VALIDATION_SYSTEM_PROMPT = [
  'You validate personalized skincare product explanations.',
  'Check that the explanation agrees with the deterministic match result.',
  'Flag unsupported claims, missing warnings, or contradictions.',
  'NEVER override hard safety conflicts — if hardConflicts exist, explanation must not recommend the product.',
  'Return JSON: { "status": "pass"|"flag"|"reject", "issues": [], "notes": "" }',
].join(' ');

export const validateExplanation = async ({ skinProfile, productIntelligence, matchResult, explanation }) => {
  const hardConflicts = matchResult?.hardConflicts || [];
  if (hardConflicts.length > 0) {
    const recommendsProduct = !/not recommend|avoid|not suitable|not eligible|do not use/i.test(explanation || '');
    if (recommendsProduct) {
      return {
        status: 'reject',
        issues: ['Explanation recommends product despite hard safety conflicts.'],
        notes: 'Hard conflict override — validator rejected without LLM.',
        validatedBy: 'deterministic',
      };
    }
  }

  const prompt = JSON.stringify({
    skinProfile: {
      skinType: skinProfile?.skinType,
      sensitivity: skinProfile?.sensitivity,
      concerns: skinProfile?.concerns,
      allergies: skinProfile?.allergies,
      primaryGoal: skinProfile?.primaryGoal,
    },
    matchResult: {
      eligible: matchResult?.eligible,
      overallScore: matchResult?.overallScore,
      hardConflicts: matchResult?.hardConflicts,
      warnings: matchResult?.warnings,
      positiveReasons: matchResult?.positiveReasons,
    },
    productSummary: {
      name: productIntelligence?.explanation?.slice(0, 200),
      evidenceConfidence: productIntelligence?.evidenceConfidence,
    },
    explanation,
  });

  const result = await generateGroqJSON({
    systemPrompt: VALIDATION_SYSTEM_PROMPT,
    prompt: `Validate this explanation:\n${prompt}`,
    modelKey: 'validation',
    validate: (data) => {
      const errors = [];
      if (!['pass', 'flag', 'reject'].includes(data?.status)) errors.push('status must be pass, flag, or reject');
      return errors;
    },
  });

  if (!result.success) {
    console.warn('[validation] Groq validation failed, defaulting to flag', { error: result.error });
    return {
      status: 'flag',
      issues: ['Automated validation unavailable.'],
      notes: result.error,
      validatedBy: 'fallback',
      promptVersion: EXPLANATION_PROMPT_VERSION,
    };
  }

  console.info('[validation] explanation validated', { status: result.data.status });
  return {
    ...result.data,
    validatedBy: 'groq',
    model: result.model,
    promptVersion: EXPLANATION_PROMPT_VERSION,
  };
};

export default validateExplanation;
