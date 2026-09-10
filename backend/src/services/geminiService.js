import {
  getGeminiConfig as getAiGeminiConfig,
  isGeminiConfigured as isGeminiConfiguredFromConfig,
} from '../config/aiConfig.js';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta';

export const isGeminiConfigured = () =>
  isGeminiConfiguredFromConfig();

export const getGeminiConfig = () => {
  const config = getAiGeminiConfig();

  return {
    apiKey: config.apiKey,
    model:
      config.models?.intelligence ||
      config.model ||
      DEFAULT_MODEL,
    models: config.models,
  };
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const buildFallbackReply = ({
  prompt,
  context,
}) => {
  const safeContext =
    context ||
    'No additional context was provided.';

  return `I can help with this based on the available product and skin-profile data. Please review the provided context and ask a more specific question if needed.

Prompt: ${prompt}

Context: ${safeContext}`;
};

const sanitizeErrorMessage = (message) => {
  if (
    typeof message !== 'string' ||
    !message.trim()
  ) {
    return 'Gemini request failed.';
  }

  return message
    .replace(
      /AIza[0-9A-Za-z_-]+/g,
      '[REDACTED_API_KEY]'
    )
    .replace(
      /AQ\.[0-9A-Za-z_-]+/g,
      '[REDACTED_API_KEY]'
    )
    .replace(
      /key=[^&\s]+/gi,
      'key=[REDACTED]'
    )
    .trim();
};

const extractResponseText = (payload) => {
  const parts =
    payload?.candidates?.[0]?.content?.parts;

  if (
    !Array.isArray(parts) ||
    !parts.length
  ) {
    return '';
  }

  return parts
    .map((part) =>
      typeof part?.text === 'string'
        ? part.text
        : ''
    )
    .join('')
    .trim();
};

const buildGeminiError = (
  payload,
  fallbackMessage
) => {
  const apiMessage =
    payload?.error?.message ||
    payload?.promptFeedback?.blockReason;

  return sanitizeErrorMessage(
    apiMessage || fallbackMessage
  );
};

/* -------------------------------------------------------------------------- */
/* Core Gemini API call                                                       */
/* -------------------------------------------------------------------------- */

const callGeminiAPI = async ({
  prompt,
  context = '',
  systemPrompt = '',
  responseMimeType,
  responseSchema,
  temperature = 0.2,
  model: modelOverride,
}) => {
  const {
    apiKey,
    model: defaultModel,
  } = getGeminiConfig();

  const model =
    modelOverride || defaultModel;

  if (!apiKey) {
    return {
      ok: false,
      configured: false,
      provider: 'fallback',
      model: 'local-fallback',
      error:
        'Gemini API key is not configured.',
    };
  }

  const userParts = [];

  if (context) {
    userParts.push({
      text: `Context:\n${context}`,
    });
  }

  userParts.push({
    text: prompt,
  });

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: userParts,
      },
    ],

    generationConfig: {
      temperature,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [
        {
          text: systemPrompt,
        },
      ],
    };
  }

  if (responseMimeType) {
    requestBody.generationConfig.responseMimeType =
      responseMimeType;
  }

  if (responseSchema) {
    requestBody.generationConfig.responseSchema =
      responseSchema;
  }

  const endpoint =
    `${GEMINI_API_BASE}/models/` +
    `${encodeURIComponent(model)}` +
    `:generateContent?key=` +
    `${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(
      endpoint,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify(
          requestBody
        ),
      }
    );

    const payload =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        provider: 'gemini',
        model,
        error: buildGeminiError(
          payload,
          `Gemini API returned status ${response.status}.`
        ),
        rawResponse: payload,
      };
    }

    const finishReason =
      payload?.candidates?.[0]
        ?.finishReason;

    if (
      finishReason &&
      finishReason !== 'STOP'
    ) {
      return {
        ok: false,
        configured: true,
        provider: 'gemini',
        model,
        error: sanitizeErrorMessage(
          `Gemini response incomplete (${finishReason}).`
        ),
        rawResponse: payload,
      };
    }

    const text =
      extractResponseText(payload);

    if (!text) {
      return {
        ok: false,
        configured: true,
        provider: 'gemini',
        model,
        error:
          'Gemini returned an empty response.',
        rawResponse: payload,
      };
    }

    return {
      ok: true,
      configured: true,
      provider: 'gemini',
      model,
      text,
      rawResponse: payload,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      provider: 'gemini',
      model,
      error: sanitizeErrorMessage(
        error.message ||
          'Gemini request failed.'
      ),
    };
  }
};

/* -------------------------------------------------------------------------- */
/* JSON parsing                                                               */
/* -------------------------------------------------------------------------- */

const parseJsonSafely = (text) => {
  if (
    typeof text !== 'string' ||
    !text.trim()
  ) {
    return {
      data: null,
      parseError:
        'Empty JSON response.',
    };
  }

  try {
    return {
      data: JSON.parse(text),
      parseError: null,
    };
  } catch (initialError) {
    const fencedMatch =
      text.match(
        /```(?:json)?\s*([\s\S]*?)```/i
      );

    if (fencedMatch?.[1]) {
      try {
        return {
          data: JSON.parse(
            fencedMatch[1].trim()
          ),
          parseError: null,
        };
      } catch (nestedError) {
        return {
          data: null,
          parseError:
            nestedError.message ||
            initialError.message,
        };
      }
    }

    return {
      data: null,
      parseError:
        initialError.message ||
        'Invalid JSON response.',
    };
  }
};

/* -------------------------------------------------------------------------- */
/* Public text generation                                                     */
/* -------------------------------------------------------------------------- */

export const generateGeminiReply = async ({
  prompt,
  context = '',
  systemPrompt = '',
}) => {
  const result =
    await callGeminiAPI({
      prompt,
      context,
      systemPrompt,
      temperature: 0.4,
    });

  if (!result.ok) {
    if (!result.configured) {
      return {
        text: buildFallbackReply({
          prompt,
          context,
        }),
        provider: 'fallback',
        model: 'local-fallback',
        fallback: true,
        error: result.error,
      };
    }

    return {
      text: buildFallbackReply({
        prompt,
        context,
      }),
      provider: 'fallback',
      model: result.model,
      fallback: true,
      error: result.error,
    };
  }

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    fallback: false,
  };
};

/* -------------------------------------------------------------------------- */
/* Public JSON generation                                                     */
/* -------------------------------------------------------------------------- */

export const generateGeminiJSON = async ({
  prompt,
  context = '',
  systemPrompt = '',
  responseSchema,
  validate,
  temperature = 0.2,
  model,
}) => {
  const result =
    await callGeminiAPI({
      prompt,
      context,
      systemPrompt,
      responseMimeType:
        'application/json',
      responseSchema,
      temperature,
      model,
    });

  if (!result.ok) {
    return {
      success: false,
      data: null,
      provider: result.configured
        ? result.provider
        : 'fallback',
      model: result.model,
      rawText: null,
      rawResponse:
        result.rawResponse || null,
      error: result.error,
      validationErrors: [],
      parseError: null,
      fallback:
        !result.configured,
    };
  }

  const {
    data,
    parseError,
  } = parseJsonSafely(
    result.text
  );

  if (parseError) {
    return {
      success: false,
      data: null,
      provider: result.provider,
      model: result.model,
      rawText: result.text,
      rawResponse:
        result.rawResponse || null,
      error:
        'Gemini returned malformed JSON.',
      validationErrors: [],
      parseError,
      fallback: false,
    };
  }

  const validationErrors =
    typeof validate === 'function'
      ? validate(data)
      : [];

  if (validationErrors.length) {
    return {
      success: false,
      data: null,
      provider: result.provider,
      model: result.model,
      rawText: result.text,
      rawResponse:
        result.rawResponse || null,
      error:
        'Gemini JSON did not match the expected schema.',
      validationErrors,
      parseError: null,
      fallback: false,
    };
  }

  return {
    success: true,
    data,
    provider: result.provider,
    model: result.model,
    rawText: result.text,
    rawResponse:
      result.rawResponse || null,
    error: null,
    validationErrors: [],
    parseError: null,
    fallback: false,
  };
};

/* -------------------------------------------------------------------------- */
/* Candidate preparation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Keep Gemini input intentionally small.
 *
 * DO NOT send:
 * - full Mongo product document
 * - complete ingredient arrays
 * - offers
 * - retailer objects
 * - image URLs
 * - unnecessary database fields
 *
 * Gemini is only being asked to resolve ranking ambiguity.
 */

const buildCandidateForGemini = (
  entry
) => {
  const product =
    entry?.product || {};

  const intelligence =
    product.productIntelligence ||
    {};

  const matchResult =
    entry?.matchResult || {};

  const category =
    product.category;

  const categoryName =
    typeof category === 'string'
      ? category
      : category?.name;

  const brand =
    product.brand;

  const brandName =
    typeof brand === 'string'
      ? brand
      : brand?.name;

  return {
    productId:
      product._id?.toString(),

    name:
      product.name || '',

    brand:
      brandName || '',

    category:
      categoryName || '',

    score:
      Number(entry.score || 0),

    skinCompatibilityScore:
      Number(
        entry.skinCompatibilityScore ||
          matchResult.skinCompatibilityScore ||
          0
      ),

    confidence:
      Number(
        matchResult.confidence || 0
      ),

    dimensionScores:
      matchResult.dimensionScores ||
      {},

    matchedFactors:
      Array.isArray(
        entry.matchedFactors
      )
        ? entry.matchedFactors.slice(
            0,
            6
          )
        : [],

    concernsMatched:
      Array.isArray(
        entry.concernsMatched
      )
        ? entry.concernsMatched.slice(
            0,
            6
          )
        : [],

    concernsNotMatched:
      Array.isArray(
        entry.concernsNotMatched
      )
        ? entry.concernsNotMatched.slice(
            0,
            5
          )
        : [],

    productIntelligence: {
      explanation:
        typeof intelligence.explanation ===
        'string'
          ? intelligence.explanation.slice(
              0,
              400
            )
          : '',

      evidenceConfidence:
        Number(
          intelligence.evidenceConfidence ||
            0
        ),

      skinTypeCompatibility:
        intelligence.skinTypeCompatibility ||
        {},

      sensitivitySuitability:
        intelligence.sensitivitySuitability ||
        {},

      concernCompatibility:
        intelligence.concernCompatibility ||
        {},

      hydrationProfile:
        intelligence.hydrationProfile ||
        '',

      oilControlProfile:
        intelligence.oilControlProfile ||
        '',

      ingredientConflicts:
        Array.isArray(
          intelligence.ingredientConflicts
        )
          ? intelligence.ingredientConflicts.slice(
              0,
              4
            )
          : [],

      qualityAssessment:
        intelligence.qualityAssessment || {},
    },
  };
};

/**
 * Build a compact user profile.
 *
 * Only information relevant to recommendation
 * ranking is sent to Gemini.
 */
const buildProfileForGemini = (
  skinProfile = {}
) => ({
  skinType:
    skinProfile.skinType ||
    'unknown',

  sensitivity:
    skinProfile.sensitivity ||
    'unknown',

  morningSkinFeel:
    skinProfile.morningSkinFeel ||
    'unknown',

  responseToNewProducts:
    skinProfile.responseToNewProducts ||
    'unknown',

  concerns:
    Array.isArray(
      skinProfile.concerns
    )
      ? skinProfile.concerns
      : [],

  primaryGoal:
    skinProfile.primaryGoal ||
    'unknown',

  avoidancePreferences:
    Array.isArray(
      skinProfile.avoidancePreferences
    )
      ? skinProfile.avoidancePreferences
      : [],

  allergies:
    Array.isArray(
      skinProfile.allergies
    )
      ? skinProfile.allergies
      : [],
});

/* -------------------------------------------------------------------------- */
/* Catalog ranking                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Rank ONLY supplied catalog candidates.
 *
 * This function is deliberately designed for
 * occasional AI intervention, not normal ranking.
 */
export const rankCatalogCandidates =
  async ({
    skinProfile,
    candidates,
  }) => {
    if (
      !Array.isArray(candidates) ||
      !candidates.length
    ) {
      return candidates || [];
    }

    /**
     * Never send an unnecessarily large candidate pool.
     */
    const limitedCandidates =
      candidates.slice(0, 25);

    const candidatePayload =
      limitedCandidates.map(
        buildCandidateForGemini
      );

    const candidateIds =
      new Set(
        candidatePayload
          .map(
            (candidate) =>
              candidate.productId
          )
          .filter(Boolean)
      );

    /**
     * If IDs are missing, fail safely.
     */
    if (!candidateIds.size) {
      return candidates;
    }

    const profilePayload =
      buildProfileForGemini(
        skinProfile
      );

    const result =
      await generateGeminiJSON({
        systemPrompt: `
You are a skincare recommendation ranking assistant.

Your job is ONLY to rank the supplied catalog products.

Rules:
1. Never invent a product.
2. Never create a product ID.
3. Only return product IDs from the supplied candidates.
4. Do not override allergy conflicts.
5. Do not override hard ingredient exclusions.
6. Do not recommend a product that the matching engine marked eligible=false.
7. Treat the deterministic compatibility score as the primary signal.
8. Use product intelligence only to resolve close or ambiguous rankings.
9. Consider skin type, sensitivity, concerns, primary goal, morning skin feel, reaction to new products, and avoidance preferences.
10. Do not make medical claims.
11. Keep reasons concise and specific.
12. Return at most the supplied number of candidates.
`.trim(),

        prompt: `
Rank the supplied skincare candidates for this user.

Prefer candidates that:
- fit the user's skin type
- fit their sensitivity level
- address their concerns
- support their primary goal
- fit their morning skin feel
- respect their avoidance preferences
- have stronger evidence/confidence
- have fewer warnings

The deterministic score is already calculated. Use your reasoning primarily when candidates are close in score or when structured product intelligence provides useful differentiation.

Return the best candidates first.
`.trim(),

        context: JSON.stringify(
          {
            userProfile:
              profilePayload,

            candidates:
              candidatePayload,
          }
        ),

        responseSchema: {
          type: 'OBJECT',

          properties: {
            ranked: {
              type: 'ARRAY',

              items: {
                type: 'OBJECT',

                properties: {
                  productId: {
                    type: 'STRING',
                  },

                  reason: {
                    type: 'STRING',
                  },
                },

                required: [
                  'productId',
                  'reason',
                ],
              },
            },
          },

          required: [
            'ranked',
          ],
        },

        validate: (data) => {
          const errors = [];

          if (
            !Array.isArray(
              data?.ranked
            )
          ) {
            errors.push(
              'ranked must be an array'
            );

            return errors;
          }

          const seenIds =
            new Set();

          for (
            const entry of data.ranked
          ) {
            if (
              !candidateIds.has(
                entry?.productId
              )
            ) {
              errors.push(
                'Gemini returned a product outside the candidate set'
              );
              continue;
            }

            if (
              seenIds.has(
                entry.productId
              )
            ) {
              errors.push(
                'Gemini returned duplicate product IDs'
              );
            }

            seenIds.add(
              entry.productId
            );

            if (
              typeof entry.reason !==
                'string' ||
              !entry.reason.trim()
            ) {
              errors.push(
                'Each ranked product must have a reason'
              );
            }
          }

          return errors;
        },

        temperature: 0.1,
      });

    /**
     * If Gemini fails for ANY reason,
     * preserve deterministic ranking.
     */
    if (
      !result.success ||
      !Array.isArray(
        result.data?.ranked
      )
    ) {
      console.warn(
        '[gemini-ranking] Falling back to deterministic ranking',
        {
          error: result.error,
          validationErrors:
            result.validationErrors,
          parseError:
            result.parseError,
        }
      );

      return candidates;
    }

    const byId =
      new Map(
        limitedCandidates.map(
          (candidate) => [
            candidate.product._id.toString(),
            candidate,
          ]
        )
      );

    const ranked = [];

    for (
      const entry of
        result.data.ranked
    ) {
      const candidate =
        byId.get(
          entry.productId
        );

      if (!candidate) {
        continue;
      }

      ranked.push({
        ...candidate,

        /**
         * Gemini's reason is allowed to
         * improve presentation, but never
         * changes the deterministic score.
         */
        explanation:
          entry.reason?.trim() ||
          candidate.explanation,
      });
    }

    /**
     * Keep candidates Gemini didn't mention
     * at the end in their deterministic order.
     */
    const rankedIds =
      new Set(
        ranked.map(
          (candidate) =>
            candidate.product._id.toString()
        )
      );

    return [
      ...ranked,

      ...limitedCandidates.filter(
        (candidate) =>
          !rankedIds.has(
            candidate.product._id.toString()
          )
      ),

      /**
       * If the original candidates contained
       * anything beyond our AI candidate pool,
       * preserve them too.
       */
      ...candidates.slice(
        limitedCandidates.length
      ),
    ];
  };

export default generateGeminiReply;