import {
  generateProductIntelligenceJSON,
} from "./productIntelligenceAiRouter.js";

import {
  formatVerifiedKnowledgeContext,
  getKnowledgeForIngredients,
  recordUnknownIngredients,
} from "./ingredientKnowledgeService.js";

import {
  safeSearchSkinKnowledge,
} from "./skinKnowledgeRagService.js";

import {
  PRODUCT_INTELLIGENCE_GEMINI_SCHEMA,
  normalizeProductIntelligence,
  validateProductIntelligence,
  RATING_BASIS_DISCLAIMER,
} from "../schemas/productIntelligenceSchema.js";

import {
  INTELLIGENCE_VERSION,
  PROMPT_VERSION,
  KNOWLEDGE_BASE_VERSION,
  INTELLIGENCE_FIELDS_USED,
} from "../constants/intelligenceVersions.js";


const sanitizeString = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";


const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => sanitizeString(entry))
    .filter(Boolean);
};


const normalizeCategory = (value) =>
  String(value || "general")
    .trim()
    .toLowerCase() || "general";


/**
 * Knowledge context budgets.
 *
 * Exact verified knowledge is authoritative and gets the largest
 * budget. Vector-retrieved knowledge is supporting evidence only
 * and gets a smaller budget. The total is capped so the prompt
 * never balloons past a safe size regardless of how many
 * ingredients are unresolved.
 */
const MAX_EXACT_RECORD_CHARS = 1200;
const MAX_EXACT_KNOWLEDGE_CHARS = 12000;

const MAX_VECTOR_RECORD_CHARS = 600;
const MAX_VECTOR_KNOWLEDGE_CHARS = 4000;

const MAX_TOTAL_KNOWLEDGE_CHARS = 16000;


/**
 * Category-specific analysis frameworks.
 *
 * These tell the model which concepts matter for a given
 * product category so that, for example, "film formation"
 * is only raised for sunscreens and not for moisturizers.
 *
 * Only the relevant framework is injected into the prompt.
 * The generic `general` framework is the fallback for any
 * category that is not explicitly modeled.
 */
const CATEGORY_FRAMEWORKS = {
  sunscreen: [
    "UV filter coverage and combination",
    "UVA/UVB protection signals",
    "photostability signals",
    "film formation and uniform coverage",
    "water/sweat resistance signals when supported",
    "cosmetic elegance and application signals",
    "sensitivity and irritation considerations",
    "supporting skincare ingredients",
  ],

  moisturizer: [
    "humectant hydration",
    "emollient support",
    "occlusive support",
    "skin-barrier support",
    "lipid balance",
    "dryness/dehydration suitability",
    "sensitivity considerations",
    "texture and layering signals",
  ],

  toner: [
    "hydration",
    "soothing",
    "exfoliation",
    "astringency",
    "alcohol/fragrance considerations",
    "pH-related formulation signals when supported",
    "layering compatibility",
    "sensitivity considerations",
  ],

  general: [
    "hydration",
    "barrier support",
    "skin-type compatibility",
    "sensitivity considerations",
    "ingredient interactions",
    "formulation signals",
  ],
};

const getCategoryFramework = (category) => {
  const normalized = normalizeCategory(category);

  return (
    CATEGORY_FRAMEWORKS[normalized] ||
    CATEGORY_FRAMEWORKS.general
  );
};


/**
 * Build the product context sent to the AI.
 */
export const buildProductContext = (
  productData = {}
) => {
  const ingredientNames =
    sanitizeStringArray(
      productData.ingredients
    );

  const keyIngredientNames =
    sanitizeStringArray(
      productData.keyIngredients
    );

  return [
    `Product name: ${
      sanitizeString(productData.name) ||
      "Unknown"
    }`,

    `Brand: ${
      sanitizeString(productData.brand) ||
      "Unknown"
    }`,

    `Category: ${
      sanitizeString(productData.category) ||
      "Unknown"
    }`,

    `Description: ${
      sanitizeString(productData.description) ||
      "Not provided"
    }`,

    `Ingredients (${ingredientNames.length}): ${
      ingredientNames.join(", ") ||
      "Not provided"
    }`,

    `Key ingredients: ${
      keyIngredientNames.join(", ") ||
      "Not provided"
    }`,

    `Skin types listed by brand: ${
      sanitizeStringArray(
        productData.skinTypes
      ).join(", ") ||
      "Not provided"
    }`,

    `Concerns listed by brand: ${
      sanitizeStringArray(
        productData.concerns
      ).join(", ") ||
      "Not provided"
    }`,

    `Fragrance free: ${
      productData.fragranceFree === null ||
      productData.fragranceFree === undefined
        ? "unknown"
        : productData.fragranceFree
    }`,

    `Alcohol free: ${
      productData.alcoholFree === null ||
      productData.alcoholFree === undefined
        ? "unknown"
        : productData.alcoholFree
    }`,

    `Essential oil free: ${
      productData.essentialOilFree === null ||
      productData.essentialOilFree === undefined
        ? "unknown"
        : productData.essentialOilFree
    }`,

    `Verified product attributes: ${
      JSON.stringify(
        productData.productIntelligence
          ?.mustHaveAttributes || {}
      )
    }`,
  ].join("\n");
};

const INTELLIGENCE_SYSTEM_PROMPT = [
  "You are the Product Intelligence engine for a skincare product analysis system.",

  "Analyze the COMPLETE product information and COMPLETE ingredient formula as a whole.",

  "Return exactly ONE valid JSON object and nothing else.",
  "Do not return markdown, commentary, explanations outside JSON, or code fences.",

  "The output must conform to the Product Intelligence schema expected by the application.",

  "",

  "============================================================",
  "CORE FORMULATION REASONING",
  "============================================================",

  "Analyze the complete formula rather than independently judging every ingredient.",

  "Consider ingredient combinations, formulation architecture, product category, ingredient interactions, skin compatibility, and relevant performance signals.",

  "Ingredient list order is only a weak concentration signal.",

  "Never invent exact ingredient concentrations.",

  "Never invent laboratory measurements.",

  "Never claim clinical validation unless explicitly provided in the supplied product information.",

  "Do not assign numerical scores to individual ingredients.",

  "Product-level values may be generated when supported by the complete formula and verified knowledge.",

  "",

  "============================================================",
  "KNOWLEDGE RULES",
  "============================================================",

  "Exact verified ingredient knowledge is authoritative ingredient evidence.",

  "Vector-retrieved knowledge is supporting evidence only.",

  "Vector similarity does NOT establish ingredient identity.",

  "Never assume that an unknown ingredient is the same ingredient as a vector-retrieved candidate.",

  "Unknown ingredients must remain unknown unless their identity is explicitly verified.",

  "Do not invent scientific evidence, citations, safety claims, evidence levels, or ingredient functions for unknown ingredients.",

  "",

  "============================================================",
  "SUNSCREEN RULES",
  "============================================================",

  "When the product category is sunscreen, populate sunscreenProtection.",

  "sunscreenProtection contains FOUR WHOLE-FORMULA signals:",

  "uvbProtection",
  "uvaProtection",
  "photostability",
  "filmIntegrity",

  "Every sunscreenProtection value must be a NUMBER between 0 and 1.",

  "These values are INTERNAL FORMULATION SIGNALS, not measured SPF, PA, UVA-PF, or laboratory test results.",

  "uvbProtection represents how strongly the available formula and verified knowledge support UVB protection capability.",

  "uvaProtection represents how strongly the available formula and verified knowledge support UVA protection capability.",

  "photostability represents how strongly the available formula and verified knowledge support stability of the UV-filter system under light exposure.",

  "filmIntegrity represents how strongly the available formula and verified knowledge support formation and maintenance of a reasonably consistent protective film during normal use.",

  "Do not convert these values into SPF numbers.",

  "Do not claim that uvbProtection 0.9 means SPF 90.",

  "Do not claim that uvaProtection 0.9 means PA++++.",

  "Do not claim water resistance merely because film-forming ingredients are present.",

  "Water or sweat resistance should only be described when supported by the supplied product information or verified knowledge.",

  "If evidence for a sunscreen criterion is incomplete, use a conservative value and lower the overall evidenceConfidence.",

  "Do not invent performance testing.",

  "For non-sunscreen products, sunscreenProtection MUST be null.",

  "",

  "============================================================",
  "REQUIRED TOP-LEVEL OUTPUT",
  "============================================================",

  "The JSON MUST contain ALL of these top-level fields:",

  "skinTypeCompatibility",
  "sensitivitySuitability",
  "concernCompatibility",
  "sunscreenProtection",
  "ingredientAnalysis",
  "ingredientConflicts",
  "avoidanceSignals",
  "mustHaveAttributes",
  "hydrationProfile",
  "oilControlProfile",
  "qualityAssessment",
  "evidenceConfidence",
  "explanation",

  "Never omit a required top-level field.",

  "",

  "============================================================",
  "SKIN TYPE COMPATIBILITY",
  "============================================================",

  "skinTypeCompatibility must contain:",

  "oily",
  "dry",
  "combination",
  "normal",
  "sensitive",

  "Each value must be a number between 0 and 1.",

  "These are product-level compatibility signals, not ingredient scores.",

  "",

  "============================================================",
  "SENSITIVITY SUITABILITY",
  "============================================================",

  "sensitivitySuitability must contain:",

  "low",
  "medium",
  "high",

  "Each value must be a number between 0 and 1.",

  "Consider fragrance, essential oils, potentially irritating ingredients, formula complexity, and relevant verified evidence when supported.",

  "",

  "============================================================",
  "INGREDIENT ANALYSIS",
  "============================================================",

  "ingredientAnalysis is REQUIRED.",

  "It must contain at least one entry.",

  "Do NOT analyze every ingredient individually.",

  "Select only the most decision-relevant ingredients.",

  "Prioritize ingredients that materially affect product function, category performance, skin compatibility, sensitivity, hydration/barrier support, formulation architecture, meaningful conflicts, or important unknowns.",

  "Each ingredientAnalysis entry must contain:",

  "ingredient",
  "benefits",
  "explanation",
  "evidenceLevel",

  "relevantConcerns may be included when relevant.",

  "potentialSensitivityConcern may be included when relevant.",

  "evidenceLevel must be one of:",

  "known",
  "likely",
  "evidence-backed",
  "unknown",

  "Do not place numerical evidenceConfidence values inside ingredientAnalysis.",

  "",

  "============================================================",
  "OVERALL EVIDENCE CONFIDENCE",
  "============================================================",

  "evidenceConfidence is a TOP-LEVEL field.",

  "It must contain ONLY one numeric value between 0 and 1.",

  "Examples:",

  "0.95",
  "0.85",
  "0.70",
  "0.50",
  "0.25",

  "Never output High, Medium, Low, Strong, Moderate, Weak, or descriptive text as evidenceConfidence.",

  "The confidence value should reflect the reliability and completeness of the evidence available for the COMPLETE product assessment.",

  "",

  "============================================================",
  "QUALITY ASSESSMENT",
  "============================================================",

  "qualityAssessment is REQUIRED.",

  "It must contain:",

  "formulationSignals",
  "transparencyNotes",
  "limitations",
  "ratingBasis",

  `ratingBasis MUST exactly equal: "${RATING_BASIS_DISCLAIMER}"`,

  "Do not omit qualityAssessment even if the formula contains incomplete information.",

  "",

  "============================================================",
  "OVERALL EXPLANATION",
  "============================================================",

  "explanation is REQUIRED.",

  "explanation must be a non-empty string.",

  "It should summarize the overall formulation, important strengths, limitations, compatibility considerations, and evidence limitations.",

  "Do not create a long essay.",

  "",

  "============================================================",
  "UNKNOWN INGREDIENTS",
  "============================================================",

  "Unknown ingredients must remain unknown.",

  "Do not silently replace an unknown ingredient with a vector candidate.",

  "Do not give an unknown ingredient a confirmed identity.",

  "You may mention that an unknown ingredient limits confidence in the overall assessment.",

  "",

  "============================================================",
  "MEDICAL AND SAFETY BOUNDARIES",
  "============================================================",

  "Do not diagnose diseases.",

  "Do not make medical claims.",

  "Do not guarantee results.",

  "Do not claim universal safety.",

  "Do not claim laboratory testing unless explicitly provided.",

  "Do not claim clinical validation unless explicitly provided.",

  "",

  "============================================================",
  "OUTPUT EFFICIENCY",
  "============================================================",

  "The complete ingredient formula must be considered during reasoning.",

  "However, the final JSON must remain concise.",

  "Do not spend the entire output generating ingredientAnalysis.",

  "Always reserve enough output space for qualityAssessment and explanation.",

  "ingredientAnalysis should contain only notable decision-relevant ingredients.",

  "",

  "============================================================",
  "FINAL VALIDATION",
  "============================================================",

  "Before returning the JSON, verify all of the following:",

  "1. All required top-level fields exist.",

  "2. sunscreenProtection exists.",

  "3. sunscreenProtection is an object for sunscreen products.",

  "4. sunscreenProtection is null for non-sunscreen products.",

  "5. All sunscreenProtection values are numeric between 0 and 1.",

  "6. ingredientAnalysis exists and contains at least one entry.",

  "7. ingredientAnalysis contains only notable ingredients.",

  "8. qualityAssessment exists.",

  "9. qualityAssessment.ratingBasis exactly matches the required disclaimer.",

  "10. evidenceConfidence exists at the TOP LEVEL.",

  "11. evidenceConfidence is numeric between 0 and 1.",

  "12. explanation exists and is non-empty.",

  "13. Unknown ingredients remain unknown.",

  "14. No exact concentrations were invented.",

  "15. No laboratory testing was invented.",

  "16. No medical claims were made.",

  "17. The final response is valid JSON only.",

].join(" ");


/* ============================================================
 * KNOWLEDGE COMPACTION HELPERS
 * ============================================================ */

/**
 * Normalize knowledge text without changing its meaning.
 *
 * This is intentionally deterministic. We do NOT use another
 * AI call to summarize knowledge before Product Intelligence.
 */
const normalizeKnowledgeText = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Remove metadata-style lines that are useful internally but
 * add little value to Product Intelligence reasoning.
 */
const removeLowValueKnowledgeLines = (text) => {
  if (!text) return "";

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();

    return ![
      /^_?id\s*:/i,
      /^chunk\s*key\s*:/i,
      /^embedding\s*:/i,
      /^similarity\s*:/i,
      /^score\s*:/i,
      /^source\s*page/i,
      /^source\s*pages/i,
      /^source\s*document/i,
      /^kb\s*version/i,
      /^research\s*status/i,
      /^general\s*flag/i,
      /^created\s*at/i,
      /^updated\s*at/i,
    ].some((pattern) => pattern.test(line)) &&
      !lower.startsWith("vector:");
  });

  return filtered.join("\n");
};

/**
 * Prefer decision-relevant knowledge sections when a record
 * is larger than its allowed budget.
 *
 * We do not rewrite the scientific content. We select useful
 * existing sections/sentences from the retrieved record.
 */
const compactKnowledgeText = (
  value,
  maxChars
) => {
  const normalized = normalizeKnowledgeText(value);

  if (!normalized) {
    return "";
  }

  const cleaned =
    removeLowValueKnowledgeLines(normalized);

  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const priorityTerms = [
    "function",
    "functions",
    "benefit",
    "benefits",
    "mechanism",
    "evidence",
    "safety",
    "caution",
    "cautions",
    "irritation",
    "sensitivity",
    "skin type",
    "skin-type",
    "barrier",
    "hydration",
    "uv",
    "uva",
    "uvb",
    "photostability",
    "interaction",
    "compatibility",
    "formulation",
    "concern",
  ];

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const prioritized = [];
  const remaining = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      priorityTerms.some((term) =>
        lower.includes(term)
      )
    ) {
      prioritized.push(line);
    } else {
      remaining.push(line);
    }
  }

  const ordered = [
    ...prioritized,
    ...remaining,
  ];

  const selected = [];
  let currentLength = 0;

  for (const line of ordered) {
    const separatorLength =
      selected.length ? 1 : 0;

    if (
      currentLength +
        separatorLength +
        line.length >
      maxChars
    ) {
      continue;
    }

    selected.push(line);
    currentLength +=
      separatorLength + line.length;
  }

  if (selected.length) {
    return selected.join("\n");
  }

  return cleaned.slice(0, maxChars).trim();
};

/**
 * Compact exact verified knowledge.
 *
 * Exact knowledge is authoritative, so it receives the largest
 * per-record and overall budgets.
 */
const compactExactKnowledgeContext = (
  context,
  maxChars = MAX_EXACT_KNOWLEDGE_CHARS
) => {
  if (!context) return "";

  const normalized =
    normalizeKnowledgeText(context);

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const records = normalized
    .split(/\n\s*(?:---+|\n)\s*/g)
    .map((record) => record.trim())
    .filter(Boolean);

  const output = [];
  let totalChars = 0;

  for (const record of records) {
    const compacted =
      compactKnowledgeText(
        record,
        MAX_EXACT_RECORD_CHARS
      );

    if (!compacted) continue;

    const separator =
      output.length ? "\n\n---\n\n" : "";

    if (
      totalChars +
        separator.length +
        compacted.length >
      maxChars
    ) {
      break;
    }

    output.push(compacted);

    totalChars +=
      separator.length +
      compacted.length;
  }

  return output.join("\n\n---\n\n");
};

/**
 * Compact vector knowledge.
 *
 * Vector knowledge is supporting evidence only, so it gets a
 * smaller budget than exact canonical knowledge.
 */
const compactVectorKnowledgeContext = (
  context,
  maxChars = MAX_VECTOR_KNOWLEDGE_CHARS
) => {
  if (!context) return "";

  const normalized =
    normalizeKnowledgeText(context);

  if (normalized.length <= maxChars) {
    return normalized;
  }

  const groups = normalized
    .split(/\n\s*---+\s*\n/g)
    .map((group) => group.trim())
    .filter(Boolean);

  const output = [];
  let totalChars = 0;

  for (const group of groups) {
    const compacted =
      compactKnowledgeText(
        group,
        MAX_VECTOR_RECORD_CHARS
      );

    if (!compacted) continue;

    const separator =
      output.length
        ? "\n\n---\n\n"
        : "";

    if (
      totalChars +
        separator.length +
        compacted.length >
      maxChars
    ) {
      break;
    }

    output.push(compacted);

    totalChars +=
      separator.length +
      compacted.length;
  }

  return output.join("\n\n---\n\n");
};

/**
 * Final safety budget.
 *
 * Exact knowledge always gets priority. Vector knowledge is
 * reduced further if the combined context exceeds the total
 * knowledge budget.
 */
const compactKnowledgeContext = (
  exactContext = "",
  vectorContext = ""
) => {
  const exact =
    compactExactKnowledgeContext(
      exactContext,
      MAX_EXACT_KNOWLEDGE_CHARS
    );

  let vector =
    compactVectorKnowledgeContext(
      vectorContext,
      MAX_VECTOR_KNOWLEDGE_CHARS
    );

  const exactLength = exact.length;

  const remainingBudget = Math.max(
    0,
    MAX_TOTAL_KNOWLEDGE_CHARS -
      exactLength
  );

  if (
    vector.length >
    remainingBudget
  ) {
    vector =
      compactVectorKnowledgeContext(
        vector,
        remainingBudget
      );
  }

  return {
    exact,
    vector,
    originalExactChars:
      exactContext?.length || 0,
    originalVectorChars:
      vectorContext?.length || 0,
    compactedExactChars:
      exact.length,
    compactedVectorChars:
      vector.length,
    totalChars:
      exact.length + vector.length,
  };
};


/* ============================================================
 * PROMPT BUILDER
 * ============================================================ */

/**
 * Build the complete AI prompt.
 *
 * Exact verified knowledge and vector-retrieved knowledge are
 * passed as two separate channels so the model can weigh them
 * differently. Vector-retrieved chunks are supporting evidence,
 * not a substitute for exact canonical knowledge.
 *
 * Both channels are compacted to bounded budgets before being
 * injected so prompt size cannot balloon with unresolved
 * ingredients or oversized knowledge records.
 */
export const buildIntelligencePrompt = (
  productData,
  knowledgeContext = "",
  vectorKnowledgeContext = ""
) => {
  const category = normalizeCategory(
    productData?.category
  );

  const framework =
    getCategoryFramework(category);

  const compactedKnowledge =
    compactKnowledgeContext(
      knowledgeContext,
      vectorKnowledgeContext
    );

  console.info(
    "[intelligence] knowledge context compacted:",
    {
      exactBefore:
        compactedKnowledge.originalExactChars,
      exactAfter:
        compactedKnowledge.compactedExactChars,
      vectorBefore:
        compactedKnowledge.originalVectorChars,
      vectorAfter:
        compactedKnowledge.compactedVectorChars,
      totalAfter:
        compactedKnowledge.totalChars,
    }
  );

  return [
    "Analyze this skincare product using the COMPLETE ingredient formula.",
    "",
    `Product category: ${category}`,
    "",
    "Category-specific analysis framework:",
    ...framework.map((item) => `- ${item}`),
    "",
    "Important reasoning rules:",
    "- Analyze the formula as a whole, not ingredients independently.",
    "- Ingredient list order is only a weak concentration signal.",
    "- Never invent exact concentrations.",
    "- Consider ingredient combinations and formulation architecture.",
    "- Use only verified knowledge supplied below.",
    "- Vector-retrieved knowledge is supporting evidence, not permission to invent facts.",
    "- Vector similarity does NOT establish ingredient identity.",
    "- Never assume an unknown ingredient is the same as a vector-retrieved ingredient unless identity is explicitly verified.",
    "- Unknown ingredients must remain unknown.",
    "- Do not assign numerical scores to individual ingredients.",
    "- Product-level suitability scores may be generated from the complete formula.",
    "- Do not make medical claims or diagnose conditions.",
    "",
    buildProductContext(productData),
    "",
    compactedKnowledge.exact
      ? `Exact verified ingredient knowledge:\n${compactedKnowledge.exact}`
      : "No exact verified ingredient knowledge was found.",

    "",

    compactedKnowledge.vector
      ? `Vector-retrieved verified knowledge (supporting evidence only, NOT identity confirmation):\n${compactedKnowledge.vector}`
      : "No vector-retrieved knowledge was available.",

    "",
    productData.unknownIngredients?.length
      ? `Unknown ingredients: ${productData.unknownIngredients.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
};


/* ============================================================
 * KNOWLEDGE RESOLUTION
 * ============================================================ */

/**
 * Retrieve exact verified knowledge and vector fallback knowledge
 * for a product's ingredients.
 *
 * Order of operations is deliberately:
 *
 *   1. Exact canonical lookup   (getKnowledgeForIngredients)
 *   2. Vector fallback          (safeSearchSkinKnowledge)
 *   3. UNKNOWN                  (queued for research)
 *
 * Vector search NEVER overrides an exact match.
 * Vector matches are never automatically treated as trusted.
 * They are supporting evidence only.
 *
 * Vector matches are grouped by the unknown ingredient they were
 * retrieved for so that the prompt cannot accidentally present
 * a retrieved chunk as if it were the unknown ingredient itself.
 *
 * This function never throws for retrieval-related failures:
 * Product Intelligence must still run with whatever knowledge
 * could be resolved.
 */
const resolveKnowledge = async (
  productData = {}
) => {
  const ingredientNames =
    sanitizeStringArray(
      productData.ingredients
    );

  const category = normalizeCategory(
    productData.category
  );

  /*
   * ----------------------------------------------------------
   * 1. EXACT CANONICAL LOOKUP
   * ----------------------------------------------------------
   *
   * Category is passed through so the knowledge service can
   * scope its lookup the same way the vector index does.
   */
  let knowledgeResult = {
    known: [],
    unknown: [],
  };

  try {
    knowledgeResult =
      await getKnowledgeForIngredients(
        ingredientNames,
        {
          category,
        }
      );
  } catch (error) {
    console.warn(
      "[intelligence] exact knowledge lookup failed:",
      error.message
    );
  }

  const exactVerifiedRecords =
    knowledgeResult.known.map(
      ({ record }) => record
    );

  const exactKnowledgeContext =
    formatVerifiedKnowledgeContext(
      exactVerifiedRecords
    );

  const unmatchedNames =
    knowledgeResult.unknown.map(
      (entry) => entry.query
    );

  /*
   * ----------------------------------------------------------
   * 2. VECTOR FALLBACK FOR UNMATCHED INGREDIENTS ONLY
   * ----------------------------------------------------------
   *
   * Only ingredients that have no exact verified match are
   * queried against the vector index. This prevents vector
   * results from ever being stacked on top of canonical ones.
   *
   * Results are grouped by the unknown ingredient that produced
   * them so the prompt can clearly label each group as
   * "related knowledge, not identity confirmation".
   */
  const vectorKnowledgeByIngredient = [];
  const vectorRecords = [];

  for (const ingredientName of unmatchedNames) {
    try {
      const ragResult =
        await safeSearchSkinKnowledge(
          `${ingredientName} skincare ingredient`,
          {
            category,
            limit: 1,
            minScore: 0.86,
          }
        );

      const matches = Array.isArray(
        ragResult?.results
      )
        ? ragResult.results
        : [];

      if (matches.length) {
        vectorKnowledgeByIngredient.push({
          ingredientName,
          matches,
        });

        vectorRecords.push(...matches);
      }
    } catch (error) {
      console.warn(
        "[intelligence] vector lookup failed for:",
        ingredientName,
        error.message
      );
    }
  }

  /*
   * Deduplicate vector records by chunkKey so the same chunk
   * retrieved for multiple ingredients does not inflate the
   * prompt or the token budget.
   *
   * Deduplication happens at the flat-record level for the
   * returned metadata, while the per-ingredient grouping is
   * preserved for the prompt so the model sees the
   * "which unknown ingredient triggered this" relationship.
   */
  const dedupedVectorRecords = [];
  const seenChunkKeys = new Set();

  for (const record of vectorRecords) {
    const key =
      record.chunkKey ||
      record._id?.toString?.() ||
      null;

    if (!key || seenChunkKeys.has(key)) {
      continue;
    }

    seenChunkKeys.add(key);
    dedupedVectorRecords.push(record);
  }

  /*
   * Build the vector context.
   *
   * Each group is explicitly labeled:
   *   - which unknown ingredient triggered the retrieval
   *   - that the retrieved knowledge is RELATED, not the same
   *   - the candidate ingredient name for the chunk itself
   *
   * This structure is what prevents the model from silently
   * assuming "Unknown A == Ingredient X from vector search".
   */
  const vectorKnowledgeContext =
    vectorKnowledgeByIngredient.length
      ? vectorKnowledgeByIngredient
          .map(({ ingredientName, matches }) => {
            const knowledge = matches
              .map(
                (chunk) =>
                  `Candidate ingredient knowledge: ${
                    chunk.ingredientName || "Unknown"
                  }\n` +
                  `Category: ${
                    chunk.category || "general"
                  }\n` +
                  `Topic: ${
                    chunk.chunkType || "general"
                  }\n` +
                  `Similarity: ${
                    typeof chunk.score === "number"
                      ? chunk.score.toFixed(3)
                      : "unknown"
                  }\n` +
                  `Knowledge: ${
                    chunk.text || ""
                  }`
              )
              .join("\n\n");

            return [
              `Unknown ingredient: ${ingredientName}`,
              "RELATED VERIFIED KNOWLEDGE — NOT IDENTITY CONFIRMATION",
              knowledge,
            ].join("\n");
          })
          .join("\n\n---\n\n")
      : "";

  /*
   * ----------------------------------------------------------
   * 3. QUEUE UNRESOLVED INGREDIENTS FOR RESEARCH
   * ----------------------------------------------------------
   *
   * Anything that had no exact verified match is queued
   * (category-scoped) so background research can run later.
   *
   * Note: we queue ALL unmatched ingredients here, not only
   * those that failed vector lookup, because vector chunks are
   * supporting evidence and do not promote an ingredient to
   * "verified knowledge base" status.
   *
   * Failures here are non-fatal.
   */
  if (unmatchedNames.length) {
    try {
      await recordUnknownIngredients(
        unmatchedNames,
        productData.productId || null,
        category
      );
    } catch (error) {
      console.warn(
        "[intelligence] failed to queue unresolved ingredients:",
        error.message
      );
    }
  }

  return {
    exactKnowledgeContext,
    vectorKnowledgeContext,

    exactCount: exactVerifiedRecords.length,
    vectorCount: dedupedVectorRecords.length,

    exactRecords: exactVerifiedRecords,
    vectorRecords: dedupedVectorRecords,

    unmatchedNames,
  };
};


/* ============================================================
 * MAIN GENERATOR
 * ============================================================ */

/**
 * Generate product intelligence.
 *
 * Pipeline:
 *
 *   CACHE (handled by caller)
 *     ↓ miss
 *   EXACT KB   (ingredientKnowledgeService)
 *     ↓ miss
 *   VECTOR KB  (skinKnowledgeRagService)
 *     ↓ miss
 *   AI ROUTER  (productIntelligenceAiRouter)
 *     ↓
 *   CACHE (handled by caller)
 */
export const generateProductIntelligence = async (
  productData = {}
) => {
  const ingredientNames =
    sanitizeStringArray(
      productData.ingredients
    );

  console.info(
    "[intelligence] started"
  );

  console.info(
    "[intelligence] ingredient count:",
    ingredientNames.length
  );

  if (!ingredientNames.length) {
    return {
      success: false,
      data: null,
      error:
        "Full ingredient list is required before running Product Intelligence.",
      provider: "none",
      model: "none",
      validationErrors: ["ingredients"],
      parseError: null,
      rawResponse: null,
    };
  }

  /*
   * ----------------------------------------------------------
   * KNOWLEDGE RESOLUTION
   * ----------------------------------------------------------
   *
   * exact -> vector -> unknown (queued)
   */
  const knowledge =
    await resolveKnowledge(productData);

  console.info(
    "[intelligence] knowledge resolved:",
    {
      exact: knowledge.exactCount,
      vector: knowledge.vectorCount,
      unresolved:
        knowledge.unmatchedNames.length,
    }
  );

  /*
   * ----------------------------------------------------------
   * AI PROVIDER ROUTING
   * ----------------------------------------------------------
   *
   * Provider selection and fallback live in
   * productIntelligenceAiRouter.js.
   */
  console.info(
    "[intelligence] trying Product Intelligence providers"
  );

  const result =
    await generateProductIntelligenceJSON({
      systemPrompt:
        INTELLIGENCE_SYSTEM_PROMPT,

      prompt:
        buildIntelligencePrompt(
          productData,
          knowledge.exactKnowledgeContext,
          knowledge.vectorKnowledgeContext
        ),

      modelKey:
        "intelligence",

      validate:
        validateProductIntelligence,

      temperature: 0.2,

      maxTokens: 4000,
    });

  if (!result.success) {
    console.warn(
      "[intelligence] Product Intelligence providers failed:",
      result.error
    );

    return {
      success: false,
      data: null,

      error:
        result.error ||
        "Product Intelligence generation failed.",

      provider:
        result.provider,

      model:
        result.model,

      validationErrors:
        result.validationErrors || [],

      parseError:
        result.parseError || null,

      rawResponse: {
        rawText:
          result.rawText,

        rawResponse:
          result.rawResponse,
      },
    };
  }

  console.info(
    "[intelligence] Product Intelligence succeeded:",
    {
      provider:
        result.provider,

      model:
        result.model,
    }
  );

  return {
    success: true,

    data:
      normalizeProductIntelligence(
        result.data
      ),

    error: null,

    provider:
      result.provider,

    model:
      result.model,

    validationErrors: [],

    parseError: null,

    metadata: {
      intelligenceVersion:
        INTELLIGENCE_VERSION,

      promptVersion:
        PROMPT_VERSION,

      knowledgeBaseVersion:
        KNOWLEDGE_BASE_VERSION,

      category:
        String(
          productData.category ||
            "general"
        )
          .trim()
          .toLowerCase() ||
        "general",

      knowledgeExactChunks:
        knowledge.exactCount,

      knowledgeVectorChunks:
        knowledge.vectorCount,

      knowledgeUnresolved:
        knowledge.unmatchedNames
          .length,

      generatedAt:
        new Date().toISOString(),

      fieldsUsed:
        INTELLIGENCE_FIELDS_USED,
    },

    rawResponse: {
      rawText:
        result.rawText,

      rawResponse:
        result.rawResponse,
    },
  };
};


export const getIntelligenceAuditInfo = () => ({
  intelligenceVersion:
    INTELLIGENCE_VERSION,

  promptVersion:
    PROMPT_VERSION,

  knowledgeBaseVersion:
    KNOWLEDGE_BASE_VERSION,

  fieldsUsed:
    INTELLIGENCE_FIELDS_USED,

  systemPrompt:
    INTELLIGENCE_SYSTEM_PROMPT,

  categoryFrameworks:
    CATEGORY_FRAMEWORKS,

  outputSchema:
    Object.keys(
      PRODUCT_INTELLIGENCE_GEMINI_SCHEMA
        .properties || {}
    ),

  skinProfileUsedInGeneration:
    false,

  providerRouting: [
    "openrouter",
    "groq",
  ],
});


export default generateProductIntelligence;