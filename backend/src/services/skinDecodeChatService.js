// src/services/skinDecodeChatService.js

import mongoose from "mongoose";

import Product from "../models/Product.js";
import SkinProfile from "../models/SkinProfile.js";

import {
  retrieveSkinKnowledge,
} from "./skinKnowledgeRagService.js";

import {
  generateGroqText,
} from "./groqService.js";

// ============================================================
// CONFIG
// ============================================================

const MAX_HISTORY_MESSAGES = 8;

const MAX_KNOWLEDGE_CHUNKS = 5;

const MAX_PRODUCTS = 5;

const MAX_PRODUCT_DESCRIPTION = 500;

const MAX_INGREDIENT_TEXT = 1800;

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function compactText(
  value,
  maxLength = 500
) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, maxLength);
}

// ============================================================
// BEAUTY SCOPE
// ============================================================

const BEAUTY_TERMS = [
  "skin",
  "skincare",
  "face",
  "acne",
  "pimple",
  "pigmentation",
  "dark spot",
  "dark spots",
  "redness",
  "dry skin",
  "oily skin",
  "sensitive skin",
  "pores",
  "wrinkles",
  "aging",
  "anti aging",
  "fine lines",
  "texture",
  "dullness",
  "dehydration",
  "sunscreen",
  "spf",
  "moisturizer",
  "moisturiser",
  "cleanser",
  "serum",
  "toner",
  "exfoliant",
  "retinol",
  "niacinamide",
  "salicylic",
  "glycolic",
  "azelaic",
  "vitamin c",
  "vitamin e",
  "ceramide",
  "hyaluronic",
  "ingredient",
  "inci",
  "product",
  "cream",
  "lotion",
  "makeup",
  "cosmetic",
  "beauty",
  "haircare",
  "hair",
  "body care",
];

function textHasBeautyTerm(text) {
  return BEAUTY_TERMS.some(
    (term) =>
      text.includes(term)
  );
}

export function isBeautyRelated(
  question,
  history = []
) {
  const text =
    normalizeText(question);

  if (textHasBeautyTerm(text)) {
    return true;
  }

  const shortFollowUp =
    text.length < 60;

  if (
    shortFollowUp &&
    Array.isArray(history)
  ) {
    const recent =
      history
        .slice(-4)
        .map((message) =>
          normalizeText(
            message?.content
          )
        )
        .join(" ");

    if (
      textHasBeautyTerm(recent)
    ) {
      return true;
    }
  }

  return false;
}

// ============================================================
// INTENT ROUTER
// ============================================================

function containsAny(
  text,
  terms
) {
  return terms.some(
    (term) =>
      text.includes(term)
  );
}

function routeIntent(
  question,
  history = [],
  attachedProductId = null
) {
  const text =
    normalizeText(question);

  // ----------------------------------------------------------
  // PRODUCT-SPECIFIC
  // ----------------------------------------------------------

  const productIntent =
    containsAny(text, [
      "this product",
      "this one",
      "this cream",
      "this serum",
      "this moisturizer",
      "this moisturiser",
      "this cleanser",
      "this sunscreen",
      "ingredients in",
      "ingredient list",
      "what is in this",
      "what does this contain",
      "is this good",
      "is this suitable",
      "will this suit",
      "can i use this",
      "should i buy this",
      "worth buying",
    ]);

  // ----------------------------------------------------------
  // RECOMMENDATIONS
  // ----------------------------------------------------------

  const recommendationIntent =
    containsAny(text, [
      "recommend",
      "recommendation",
      "suggest a product",
      "suggest products",
      "which product",
      "best product",
      "best products",
      "what should i buy",
      "what should i use",
      "other product",
      "another product",
      "alternative",
      "alternatives",
    ]);

  // ----------------------------------------------------------
  // INGREDIENT / CLINICAL
  // ----------------------------------------------------------

  const clinicalIntent =
    containsAny(text, [
      "ingredient",
      "inci",
      "what is",
      "what does",
      "how does",
      "benefit",
      "benefits",
      "acne",
      "pimple",
      "pigmentation",
      "dark spot",
      "dryness",
      "dehydration",
      "oiliness",
      "redness",
      "texture",
      "dullness",
      "aging",
      "wrinkle",
      "wrinkles",
      "pores",
      "sensitive",
      "irritation",
      "irritated",
      "barrier",
      "comedogenic",
      "non comedogenic",
      "exfoliat",
      "brighten",
    ]);

  // ----------------------------------------------------------
  // PERSONALIZATION
  // ----------------------------------------------------------

  const personalizationIntent =
    containsAny(text, [
      "for me",
      "my skin",
      "my skin type",
      "my routine",
      "my concern",
      "my concerns",
      "my sensitivity",
      "will it suit me",
      "would it suit me",
      "is it suitable for me",
      "can i use",
    ]);

  // ----------------------------------------------------------
  // FOLLOW-UP
  // ----------------------------------------------------------

  const conversationalFollowUp =
    containsAny(text, [
      "it",
      "this",
      "that",
      "what about",
      "why",
      "how about",
      "the first one",
      "the second one",
    ]) &&
    text.length < 80;

  if (
    personalizationIntent
  ) {
    return "personalized";
  }

  if (
    recommendationIntent
  ) {
    return "recommendation";
  }

  if (productIntent) {
    return "product";
  }

  if (clinicalIntent) {
    return "clinical";
  }

  if (
    conversationalFollowUp &&
    attachedProductId
  ) {
    return "product";
  }

  if (
    conversationalFollowUp
  ) {
    return "clinical";
  }

  return "general";
}

// ============================================================
// HISTORY
// ============================================================

function compactHistory(
  history = []
) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message?.role,
      content: compactText(
        message?.content,
        600
      ),
    }))
    .filter(
      (message) =>
        message.role &&
        message.content
    );
}

// ============================================================
// PROFILE
// ============================================================

async function getUserSkinProfile(
  userId
) {
  if (!userId) {
    return null;
  }

  try {
    return await SkinProfile.findOne({
      userId,
    }).lean();
  } catch (error) {
    console.error(
      "[skinDecodeChat] SkinProfile lookup failed:",
      error.message
    );

    return null;
  }
}

function compactSkinProfile(
  profile
) {
  if (!profile) {
    return null;
  }

  return {
    skinType:
      profile.skinType,

    sensitivity:
      profile.sensitivity,

    morningSkinFeel:
      profile.morningSkinFeel,

    responseToNewProducts:
      profile.responseToNewProducts,

    sunscreenHabit:
      profile.sunscreenHabit,

    ageRange:
      profile.ageRange,

    currentProducts:
      profile.currentProducts,

    primaryGoal:
      profile.primaryGoal,

    concerns:
      Array.isArray(profile.concerns)
        ? profile.concerns.slice(0, 8)
        : [],

    allergies:
      Array.isArray(profile.allergies)
        ? profile.allergies.slice(0, 10)
        : [],

    mustHavePreferences:
      profile.mustHavePreferences,

    budget:
      profile.budget
        ? {
            min:
              profile.budget.min,
            max:
              profile.budget.max,
          }
        : null,

    questionnaireCompleted:
      profile.questionnaireCompleted,
  };
}

// ============================================================
// PRODUCT COMPACTION
// ============================================================

function compactProduct(
  product
) {
  if (!product) {
    return null;
  }

  return {
    id: product._id,

    name: product.name,

    canonicalName:
      product.canonicalName,

    slug: product.slug,

    brand:
      product.brand?.name ||
      product.brand?.canonicalName ||
      product.brand ||
      null,

    category:
      product.category?.name ||
      product.category?.canonicalName ||
      product.category ||
      null,

    description:
      compactText(
        product.description,
        MAX_PRODUCT_DESCRIPTION
      ),

    ingredientListText:
      compactText(
        product.ingredientListText,
        MAX_INGREDIENT_TEXT
      ),

    keyIngredients:
      Array.isArray(
        product.keyIngredients
      )
        ? product.keyIngredients
            .slice(0, 15)
            .map(
              (ingredient) => ({
                name:
                  ingredient?.name,
                INCI:
                  ingredient?.INCI ||
                  ingredient?.inci,
                ingredient_key:
                  ingredient?.ingredient_key,
              })
            )
        : [],

    skinTypes:
      product.skinTypes,

    concerns:
      product.concerns,

    fragranceFree:
      product.fragranceFree,

    alcoholFree:
      product.alcoholFree,

    essentialOilFree:
      product.essentialOilFree,

    pregnancyFriendly:
      product.pregnancyFriendly,

    claims:
      Array.isArray(
        product.claims
      )
        ? product.claims.slice(0, 10)
        : product.claims,

    intelligenceStatus:
      product.intelligenceStatus,

    productIntelligence:
      product.productIntelligence
        ? {
            ingredientAnalysis:
              product
                .productIntelligence
                .ingredientAnalysis,

            conflicts:
              product
                .productIntelligence
                .conflicts,

            evidenceConfidence:
              product
                .productIntelligence
                .evidenceConfidence,
          }
        : null,
  };
}

// ============================================================
// PRODUCT SEARCH
// ============================================================

function buildProductTokens(
  question
) {
  const stopWords =
    new Set([
      "what",
      "which",
      "where",
      "when",
      "does",
      "this",
      "that",
      "with",
      "from",
      "have",
      "has",
      "will",
      "would",
      "could",
      "should",
      "about",
      "other",
      "another",
      "product",
      "products",
      "please",
      "tell",
      "give",
      "recommend",
      "recommendation",
      "best",
      "good",
      "suitable",
      "for",
      "me",
      "my",
      "skin",
      "your",
      "the",
      "and",
      "or",
      "but",
      "is",
      "are",
      "can",
      "i",
      "it",
      "to",
      "of",
      "in",
      "on",
      "a",
      "an",
    ]);

  return normalizeText(question)
    .replace(
      /[^a-z0-9\s-]/g,
      " "
    )
    .split(/\s+/)
    .map((token) =>
      token.trim()
    )
    .filter(
      (token) =>
        token.length >= 4 &&
        !stopWords.has(token)
    )
    .slice(0, 8);
}

async function retrieveProducts(
  question,
  attachedProductId = null,
  history = []
) {
  try {
    const products = [];

    // --------------------------------------------------------
    // ATTACHED PRODUCT
    // --------------------------------------------------------

    if (
      attachedProductId &&
      mongoose.Types.ObjectId.isValid(
        attachedProductId
      )
    ) {
      const attached =
        await Product.findById(
          attachedProductId
        )
          .populate("brand")
          .populate("category")
          .populate("ingredients")
          .lean();

      if (attached) {
        products.push(attached);
      }
    }

    // --------------------------------------------------------
    // SEARCH TERMS
    // --------------------------------------------------------

    const tokens =
      buildProductTokens(
        question
      );

    if (tokens.length === 0) {
      return products.slice(
        0,
        MAX_PRODUCTS
      );
    }

    const regex =
      tokens.map(
        (token) =>
          new RegExp(
            token.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            ),
            "i"
          )
      );

    const or = [];

    for (const expression of regex) {
      or.push(
        {
          name: expression,
        },
        {
          canonicalName:
            expression,
        },
        {
          ingredientListText:
            expression,
        },
        {
          description:
            expression,
        },
        {
          "keyIngredients.name":
            expression,
        }
      );
    }

    const query =
      or.length
        ? { $or: or }
        : {};

    const found =
      await Product.find(query)
        .limit(MAX_PRODUCTS * 2)
        .populate("brand")
        .populate("category")
        .populate("ingredients")
        .lean();

    for (const product of found) {
      const alreadyIncluded =
        products.some(
          (existing) =>
            String(
              existing._id
            ) ===
            String(product._id)
        );

      if (!alreadyIncluded) {
        products.push(product);
      }

      if (
        products.length >=
        MAX_PRODUCTS
      ) {
        break;
      }
    }

    return products.slice(
      0,
      MAX_PRODUCTS
    );
  } catch (error) {
    console.error(
      "[skinDecodeChat] Product retrieval failed:",
      error.message
    );

    return [];
  }
}

// ============================================================
// KNOWLEDGE SUMMARY
// ============================================================

function buildKnowledgeSummary(
  results = []
) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .slice(0, MAX_KNOWLEDGE_CHUNKS)
    .map((result) => ({
      ingredientKey:
        result.ingredientKey,

      ingredientName:
        result.ingredientName,

      inciName:
        result.inciName,

      chunkType:
        result.chunkType,

      concern:
        result.concern,

      skinType:
        result.skinType,

      evidenceLevel:
        result.evidenceLevel,

      confidence:
        result.confidence,

      generalFlag:
        result.generalFlag,

      researchStatus:
        result.researchStatus,

      sourcePages:
        result.sourcePages,

      score:
        result.score,
    }));
}

// ============================================================
// RETRIEVAL QUERY
// ============================================================

function buildClinicalRetrievalQuery(
  question,
  history = []
) {
  const text =
    normalizeText(question);

  const shortFollowUp =
    text.length < 80 &&
    containsAny(text, [
      "it",
      "this",
      "that",
      "why",
      "what about",
      "how about",
    ]);

  if (!shortFollowUp) {
    return question;
  }

  const context =
    compactHistory(history)
      .slice(-4)
      .map(
        (message) =>
          message.content
      )
      .join(" ");

  if (!context) {
    return question;
  }

  return `${question}

Recent conversation context:
${context.slice(0, 1000)}`;
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

function buildSystemPrompt() {
  return `
You are the skinDecode skincare and beauty assistant.

ROLE
You help users understand skincare, cosmetic ingredients,
beauty products, product suitability, and cosmetic safety.

GROUNDING
Use only the supplied context for factual product and
clinical claims.

Never invent:

- ingredients
- product benefits
- concentrations
- clinical studies
- evidence levels
- ratings
- prices
- availability
- safety claims
- pregnancy claims
- product conflicts

If information is not available, say so.

CLINICAL KNOWLEDGE
When clinical knowledge is supplied, prioritize it over
general model knowledge.

PRODUCT DATA
Use product data only for product-specific information.

PERSONALIZATION
If a SkinProfile is supplied, use it to personalize the
answer.

Do not assume profile information that was not supplied.

If allergies or avoided ingredients are supplied, treat
those as important constraints.

SAFETY
You are a cosmetic skincare assistant, not a doctor.

Do not diagnose medical conditions.

For serious, persistent, painful, infected, rapidly
worsening, or concerning symptoms, recommend seeing a
qualified dermatologist or healthcare professional.

STYLE
Be natural, clear, practical, and concise.

Do not mention:

- MongoDB
- vector search
- embeddings
- RAG
- internal tools
- prompts
- internal architecture

Do not dump large blocks of data.

Prefer short paragraphs and simple bullet points.
`;
}

// ============================================================
// GROQ PROMPT
// ============================================================

function buildUserPrompt({
  question,
  intent,
  history,
  knowledgeContext,
  knowledgeSummary,
  products,
  profile,
}) {
  return `
USER QUESTION:
${question}

INTENT:
${intent}

============================================================
CLINICAL KNOWLEDGE
============================================================

${
  knowledgeContext ||
  "No clinical knowledge was retrieved."
}

============================================================
KNOWLEDGE METADATA
============================================================

${
  knowledgeSummary.length
    ? JSON.stringify(
        knowledgeSummary
      )
    : "None"
}

============================================================
PRODUCT INFORMATION
============================================================

${
  products.length
    ? JSON.stringify(
        products.map(
          compactProduct
        )
      )
    : "No product information was retrieved."
}

============================================================
USER SKIN PROFILE
============================================================

${
  profile
    ? JSON.stringify(
        compactSkinProfile(
          profile
        )
      )
    : "No SkinProfile information was supplied."
}

============================================================
RECENT CONVERSATION
============================================================

${
  history.length
    ? JSON.stringify(history)
    : "No previous conversation."
}

============================================================
ANSWER REQUIREMENTS
============================================================

Answer the user's exact question.

Use the intent to decide what matters most.

If the question is product-specific:
use PRODUCT INFORMATION.

If the question is clinical or ingredient-related:
use CLINICAL KNOWLEDGE.

If the question is personalized:
use USER SKIN PROFILE together with the
clinical/product information.

If there is insufficient evidence:
say that clearly instead of guessing.

Do not mention internal systems.

Answer naturally as skinDecode.
`;
}

// ============================================================
// MAIN CHAT FUNCTION
// ============================================================

export async function answerSkinDecodeQuestion({
  question,
  history = [],
  attachedProductId = null,
  userId = null,
}) {
  if (
    !question ||
    !String(question).trim()
  ) {
    throw new Error(
      "Question is required."
    );
  }

  const cleanQuestion =
    String(question).trim();

  const conversationHistory =
    compactHistory(history);

  // ----------------------------------------------------------
  // SCOPE
  // ----------------------------------------------------------

  const inScope =
    isBeautyRelated(
      cleanQuestion,
      conversationHistory
    ) ||
    Boolean(attachedProductId);

  if (!inScope) {
    return {
      success: true,

      answer:
        "I’m the skinDecode skincare and beauty assistant, so I can help with skincare, ingredients, cosmetics, beauty products, makeup, and cosmetic safety—but not that topic.",

      outOfScope: true,

      provider:
        "skinDecode",
    };
  }

  // ----------------------------------------------------------
  // INTENT
  // ----------------------------------------------------------

  const intent =
    routeIntent(
      cleanQuestion,
      conversationHistory,
      attachedProductId
    );

  console.log(
    "[skinDecodeChat] Intent:",
    intent
  );

  // ----------------------------------------------------------
  // RETRIEVAL PLAN
  // ----------------------------------------------------------

  let knowledge = {
    count: 0,
    results: [],
    context: "",
  };

  let products = [];

  let profile = null;

  const needsKnowledge =
    intent === "clinical" ||
    intent === "personalized" ||
    intent === "recommendation";

  const needsProducts =
    intent === "product" ||
    intent === "personalized" ||
    intent === "recommendation";

  const needsProfile =
    intent === "personalized" ||
    intent === "recommendation";

  // ----------------------------------------------------------
  // RUN ONLY WHAT WE NEED
  // ----------------------------------------------------------

  const tasks = [];

  if (needsKnowledge) {
    const retrievalQuery =
      buildClinicalRetrievalQuery(
        cleanQuestion,
        conversationHistory
      );

    tasks.push(
      retrieveSkinKnowledge(
        retrievalQuery,
        {
          limit:
            MAX_KNOWLEDGE_CHUNKS,
          maxChunks:
            MAX_KNOWLEDGE_CHUNKS,
        }
      ).then(
        (result) => {
          knowledge =
            result || knowledge;
        }
      )
    );
  }

  if (needsProducts) {
    tasks.push(
      retrieveProducts(
        cleanQuestion,
        attachedProductId,
        conversationHistory
      ).then(
        (result) => {
          products =
            result || [];
        }
      )
    );
  }

  if (needsProfile) {
    tasks.push(
      getUserSkinProfile(
        userId
      ).then(
        (result) => {
          profile = result;
        }
      )
    );
  }

  await Promise.all(
    tasks
  );

  // ----------------------------------------------------------
  // KNOWLEDGE SUMMARY
  // ----------------------------------------------------------

  const knowledgeSummary =
    buildKnowledgeSummary(
      knowledge.results || []
    );

  // ----------------------------------------------------------
  // GROQ
  // ----------------------------------------------------------

  const result =
    await generateGroqText({
      modelKey: "chat",

      temperature: 0.25,

      systemPrompt:
        buildSystemPrompt(),

      prompt:
        buildUserPrompt({
          question:
            cleanQuestion,

          intent,

          history:
            conversationHistory,

          knowledgeContext:
            knowledge.context || "",

          knowledgeSummary,

          products,

          profile,
        }),
    });

  if (!result?.success) {
    throw new Error(
      result?.error ||
        "Groq failed to generate a response."
    );
  }

  const answer =
    String(
      result.text || ""
    ).trim();

  if (!answer) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  // ----------------------------------------------------------
  // RESPONSE
  // ----------------------------------------------------------

  return {
    success: true,

    answer,

    outOfScope: false,

    intent,

    provider:
      "groq",

    retrieved: {
      knowledge: {
        count:
          knowledge.count || 0,

        results:
          knowledgeSummary,

        error:
          knowledge.error ||
          null,
      },

      products:
        products.map(
          (product) => ({
            id:
              product._id,

            name:
              product.name,
          })
        ),

      profile:
        Boolean(profile),
    },
  };
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  answerSkinDecodeQuestion,
  isBeautyRelated,
};