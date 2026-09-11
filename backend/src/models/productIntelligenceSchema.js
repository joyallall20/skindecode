// backend/src/schemas/productIntelligenceSchema.js

/**
 * Product Intelligence Schema
 *
 * IMPORTANT:
 * - Product-level intelligence only.
 * - Ingredient scores are NOT allowed.
 * - UNKNOWN is different from 0.
 * - Sunscreen protection values are formulation-intelligence signals,
 *   NOT laboratory SPF/UVA-PF measurements.
 */

const SKIN_TYPES = ["oily", "dry", "combination", "normal", "sensitive"];

const SENSITIVITY_LEVELS = ["low", "medium", "high"];

const EVIDENCE_LEVELS = ["known", "likely", "evidence-backed", "unknown"];

export const RATING_BASIS_DISCLAIMER =
  "Rating is based on the ingredients and product information provided by the brand.";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const clamp01 = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
};

const sanitizeScoreMap = (value, allowedKeys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result = {};

  for (const key of allowedKeys) {
    if (typeof value[key] === "number") {
      result[key] = clamp01(value[key]);
    }
  }

  return result;
};

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const sanitizeSunscreenProtection = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return {
    uvbProtection: clamp01(value.uvbProtection),
    uvaProtection: clamp01(value.uvaProtection),
    photostability: clamp01(value.photostability),
    filmIntegrity: clamp01(value.filmIntegrity),
  };
};

/* -------------------------------------------------------------------------- */
/* JSON Schema                                                                */
/* -------------------------------------------------------------------------- */

export const PRODUCT_INTELLIGENCE_GEMINI_SCHEMA = {
  type: "object",

  properties: {
    /* ---------------------------------------------------------------------- */
    /* Skin type compatibility                                                */
    /* ---------------------------------------------------------------------- */

    skinTypeCompatibility: {
      type: "object",

      properties: {
        oily: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        dry: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        combination: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        normal: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        sensitive: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },

      required: SKIN_TYPES,
    },

    /* ---------------------------------------------------------------------- */
    /* Sensitivity suitability                                                */
    /* ---------------------------------------------------------------------- */

    sensitivitySuitability: {
      type: "object",

      properties: {
        low: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        medium: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },

        high: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },

      required: SENSITIVITY_LEVELS,
    },

    /* ---------------------------------------------------------------------- */
    /* Concern compatibility                                                  */
    /* ---------------------------------------------------------------------- */

    concernCompatibility: {
      type: "object",

      additionalProperties: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
    },

    /* ---------------------------------------------------------------------- */
    /* Ingredient analysis                                                    */
    /* ---------------------------------------------------------------------- */

    ingredientAnalysis: {
      type: "array",

      items: {
        type: "object",

        properties: {
          ingredient: {
            type: "string",
          },

          benefits: {
            type: "array",
            items: {
              type: "string",
            },
          },

          relevantConcerns: {
            type: "array",
            items: {
              type: "string",
            },
          },

          potentialSensitivityConcern: {
            type: "string",
          },

          explanation: {
            type: "string",
          },

          evidenceLevel: {
            type: "string",
            enum: EVIDENCE_LEVELS,
          },
        },

        required: ["ingredient", "benefits", "explanation", "evidenceLevel"],
      },
    },

    /* ---------------------------------------------------------------------- */
    /* Ingredient conflicts                                                    */
    /* ---------------------------------------------------------------------- */

    ingredientConflicts: {
      type: "array",

      items: {
        type: "string",
      },
    },

    /* ---------------------------------------------------------------------- */
    /* Avoidance signals                                                       */
    /* ---------------------------------------------------------------------- */

    avoidanceSignals: {
      type: "object",

      additionalProperties: true,
    },

    /* ---------------------------------------------------------------------- */
    /* Must-have attributes                                                    */
    /* ---------------------------------------------------------------------- */

    mustHaveAttributes: {
      type: "object",

      additionalProperties: true,
    },

    /* ---------------------------------------------------------------------- */
    /* Hydration                                                               */
    /* ---------------------------------------------------------------------- */

    hydrationProfile: {
      type: "string",
    },

    /* ---------------------------------------------------------------------- */
    /* Oil control                                                             */
    /* ---------------------------------------------------------------------- */

    oilControlProfile: {
      type: "string",
    },

    /* ---------------------------------------------------------------------- */
    /* SUNSCREEN-SPECIFIC FORMULATION SIGNALS                                 */
    /* ---------------------------------------------------------------------- */

    sunscreenProtection: {
      anyOf: [
        {
          type: "object",

          properties: {
            /**
             * Formulation-level UVB protection signal.
             *
             * This is NOT SPF.
             */
            uvbProtection: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },

            /**
             * Formulation-level UVA protection signal.
             *
             * This is NOT UVA-PF or PA rating.
             */
            uvaProtection: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },

            /**
             * Expected stability of the UV filter system
             * based on known formulation/filter interactions.
             */
            photostability: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },

            /**
             * Expected ability of the formulation to form and
             * maintain a reasonably uniform protective film.
             */
            filmIntegrity: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
          },

          required: [
            "uvbProtection",
            "uvaProtection",
            "photostability",
            "filmIntegrity",
          ],
        },

        {
          type: "null",
        },
      ],
    },

    /* ---------------------------------------------------------------------- */
    /* Quality assessment                                                      */
    /* ---------------------------------------------------------------------- */

    qualityAssessment: {
      type: "object",

      properties: {
        formulationSignals: {
          type: "array",

          items: {
            type: "string",
          },
        },

        transparencyNotes: {
          type: "string",
        },

        limitations: {
          type: "array",

          items: {
            type: "string",
          },
        },

        ratingBasis: {
          type: "string",
        },
      },

      required: [
        "formulationSignals",
        "transparencyNotes",
        "limitations",
        "ratingBasis",
      ],
    },

    /* ---------------------------------------------------------------------- */
    /* Evidence confidence                                                     */
    /* ---------------------------------------------------------------------- */

    evidenceConfidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },

    /* ---------------------------------------------------------------------- */
    /* Overall explanation                                                     */
    /* ---------------------------------------------------------------------- */

    explanation: {
      type: "string",
    },
  },

  /* ------------------------------------------------------------------------ */
  /* Required top-level fields                                                */
  /* ------------------------------------------------------------------------ */

  required: [
    "skinTypeCompatibility",
    "sensitivitySuitability",
    "concernCompatibility",
    "ingredientAnalysis",
    "ingredientConflicts",
    "avoidanceSignals",
    "mustHaveAttributes",
    "hydrationProfile",
    "oilControlProfile",
    "sunscreenProtection",
    "qualityAssessment",
    "evidenceConfidence",
    "explanation",
  ],
};

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

export const normalizeProductIntelligence = (data) => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const normalized = {
    ...data,

    skinTypeCompatibility: sanitizeScoreMap(
      data.skinTypeCompatibility,
      SKIN_TYPES,
    ),

    sensitivitySuitability: sanitizeScoreMap(
      data.sensitivitySuitability,
      SENSITIVITY_LEVELS,
    ),

    concernCompatibility:
      data.concernCompatibility &&
      typeof data.concernCompatibility === "object" &&
      !Array.isArray(data.concernCompatibility)
        ? Object.fromEntries(
            Object.entries(data.concernCompatibility)
              .filter(
                ([, value]) =>
                  typeof value === "number" && Number.isFinite(value),
              )
              .map(([key, value]) => [key, clamp01(value)]),
          )
        : {},

    ingredientAnalysis: Array.isArray(data.ingredientAnalysis)
      ? data.ingredientAnalysis.map((item) => ({
          ...item,

          ingredient:
            typeof item?.ingredient === "string" ? item.ingredient.trim() : "",

          benefits: sanitizeStringArray(item?.benefits),

          relevantConcerns: sanitizeStringArray(item?.relevantConcerns),

          potentialSensitivityConcern:
            typeof item?.potentialSensitivityConcern === "string"
              ? item.potentialSensitivityConcern.trim()
              : "",

          explanation:
            typeof item?.explanation === "string"
              ? item.explanation.trim()
              : "",

          evidenceLevel: EVIDENCE_LEVELS.includes(item?.evidenceLevel)
            ? item.evidenceLevel
            : "unknown",
        }))
      : [],

    ingredientConflicts: sanitizeStringArray(data.ingredientConflicts),

    hydrationProfile:
      typeof data.hydrationProfile === "string"
        ? data.hydrationProfile.trim()
        : "",

    oilControlProfile:
      typeof data.oilControlProfile === "string"
        ? data.oilControlProfile.trim()
        : "",

    sunscreenProtection: sanitizeSunscreenProtection(data.sunscreenProtection),

    evidenceConfidence: clamp01(data.evidenceConfidence),

    explanation:
      typeof data.explanation === "string" ? data.explanation.trim() : "",
  };

  return normalized;
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export const validateProductIntelligence = (data) => {
  const errors = [];

  if (!data || typeof data !== "object") {
    errors.push("Product intelligence must be an object.");
    return errors;
  }

  /* ------------------------------------------------------------------------ */
  /* Ingredient analysis                                                      */
  /* ------------------------------------------------------------------------ */

  if (
    !Array.isArray(data.ingredientAnalysis) ||
    data.ingredientAnalysis.length === 0
  ) {
    errors.push("ingredientAnalysis must contain at least one ingredient.");
  }

  /* ------------------------------------------------------------------------ */
  /* Quality assessment                                                       */
  /* ------------------------------------------------------------------------ */

  if (!data.qualityAssessment || typeof data.qualityAssessment !== "object") {
    errors.push("qualityAssessment is required.");
  } else {
    if (
      typeof data.qualityAssessment.ratingBasis !== "string" ||
      !data.qualityAssessment.ratingBasis.trim()
    ) {
      errors.push("qualityAssessment.ratingBasis is required.");
    }

    if (!Array.isArray(data.qualityAssessment.formulationSignals)) {
      errors.push("qualityAssessment.formulationSignals must be an array.");
    }

    if (typeof data.qualityAssessment.transparencyNotes !== "string") {
      errors.push("qualityAssessment.transparencyNotes must be a string.");
    }

    if (!Array.isArray(data.qualityAssessment.limitations)) {
      errors.push("qualityAssessment.limitations must be an array.");
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Overall explanation                                                      */
  /* ------------------------------------------------------------------------ */

  if (typeof data.explanation !== "string" || !data.explanation.trim()) {
    errors.push("An explanation is required.");
  }

  /* ------------------------------------------------------------------------ */
  /* Evidence confidence                                                      */
  /* ------------------------------------------------------------------------ */

  if (
    typeof data.evidenceConfidence !== "number" ||
    !Number.isFinite(data.evidenceConfidence) ||
    data.evidenceConfidence < 0 ||
    data.evidenceConfidence > 1
  ) {
    errors.push("evidenceConfidence must be a number between 0 and 1.");
  }

  /* ------------------------------------------------------------------------ */
  /* Sunscreen protection                                                     */
  /* ------------------------------------------------------------------------ */

  if (data.sunscreenProtection !== null) {
    if (
      !data.sunscreenProtection ||
      typeof data.sunscreenProtection !== "object" ||
      Array.isArray(data.sunscreenProtection)
    ) {
      errors.push("sunscreenProtection must be an object or null.");
    } else {
      const fields = [
        "uvbProtection",
        "uvaProtection",
        "photostability",
        "filmIntegrity",
      ];

      for (const field of fields) {
        const value = data.sunscreenProtection[field];

        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1
        ) {
          errors.push(
            `sunscreenProtection.${field} must be a number between 0 and 1.`,
          );
        }
      }
    }
  }

  return errors;
};

/* -------------------------------------------------------------------------- */
/* Default export                                                             */
/* -------------------------------------------------------------------------- */

export default {
  PRODUCT_INTELLIGENCE_GEMINI_SCHEMA,
  normalizeProductIntelligence,
  validateProductIntelligence,
  RATING_BASIS_DISCLAIMER,
};
