// src/services/skinKnowledgeRagService.js

import SkinKnowledgeChunk from "../models/SkinKnowledgeChunk.js";
import { generateQueryEmbedding } from "./embeddingService.js";

const DEFAULT_LIMIT = Number(
  process.env.SKIN_KNOWLEDGE_RAG_LIMIT || 5
);

const DEFAULT_MIN_SCORE = Number(
  process.env.SKIN_KNOWLEDGE_RAG_MIN_SCORE || 0.82
);

const MAX_LIMIT = 10;

const VECTOR_INDEX =
  process.env.SKIN_KNOWLEDGE_VECTOR_INDEX ||
  "skin_knowledge_vector_index";

const VECTOR_PATH =
  process.env.SKIN_KNOWLEDGE_VECTOR_PATH ||
  "embedding";

/**
 * Semantic search against the clinical skincare knowledge base.
 *
 * Important:
 * - Gemini is used only to create the query embedding.
 * - MongoDB Atlas performs vector retrieval.
 * - Only sufficiently relevant chunks are returned.
 */
export async function searchSkinKnowledge(
  question,
  options = {}
) {
  if (
    typeof question !== "string" ||
    !question.trim()
  ) {
    throw new Error(
      "A non-empty question is required for knowledge search."
    );
  }

  const {
    limit = DEFAULT_LIMIT,
    minScore = DEFAULT_MIN_SCORE,

    ingredientKey = null,
    concern = null,
    chunkType = null,
    evidenceLevel = null,
    skinType = null,
  } = options;

  const safeLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const safeMinScore = Number.isFinite(
    Number(minScore)
  )
    ? Number(minScore)
    : DEFAULT_MIN_SCORE;

  // ----------------------------------------------------------
  // QUERY EMBEDDING
  // ----------------------------------------------------------

  const queryEmbedding =
    await generateQueryEmbedding(question);

  // ----------------------------------------------------------
  // ATLAS FILTERS
  // ----------------------------------------------------------

  const filter = {
    isActive: true,
  };

  if (ingredientKey) {
    filter.ingredientKey = ingredientKey;
  }

  if (concern) {
    filter.concern = concern;
  }

  if (chunkType) {
    filter.chunkType = chunkType;
  }

  if (evidenceLevel) {
    filter.evidenceLevel = evidenceLevel;
  }

  if (skinType) {
    filter.skinType = skinType;
  }

  // ----------------------------------------------------------
  // VECTOR SEARCH
  // ----------------------------------------------------------

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: VECTOR_PATH,
        queryVector: queryEmbedding,

        /*
         * Keep candidate count reasonably small.
         *
         * This is intentionally not huge because chat requests
         * should stay fast and inexpensive.
         */
        numCandidates: Math.max(
          safeLimit * 10,
          50
        ),

        limit: safeLimit,

        filter,
      },
    },

    {
      $project: {
        _id: 1,

        chunkKey: 1,

        ingredientKey: 1,
        ingredientName: 1,
        inciName: 1,

        chunkType: 1,
        concern: 1,
        skinType: 1,

        text: 1,

        evidenceLevel: 1,
        confidence: 1,
        generalFlag: 1,
        researchStatus: 1,

        sourcePages: 1,
        sources: 1,

        kbVersion: 1,
        sourceType: 1,
        sourceDocument: 1,

        score: {
          $meta: "vectorSearchScore",
        },
      },
    },
  ];

  const results =
    await SkinKnowledgeChunk.aggregate(
      pipeline
    );

  // ----------------------------------------------------------
  // RELEVANCE FILTER
  // ----------------------------------------------------------

  const filteredResults =
    results.filter((result) => {
      const score = Number(
        result?.score
      );

      return (
        Number.isFinite(score) &&
        score >= safeMinScore
      );
    });

  console.log(
    "[skinKnowledgeRag] Search:",
    {
      question:
        question.slice(0, 120),
      retrieved: results.length,
      accepted:
        filteredResults.length,
      minScore: safeMinScore,
    }
  );

  return {
    question,

    count:
      filteredResults.length,

    results:
      filteredResults,
  };
}

/**
 * Safe version used by chat.
 *
 * If vector search temporarily fails,
 * the rest of the chatbot can still respond
 * using product/profile context.
 */
export async function safeSearchSkinKnowledge(
  question,
  options = {}
) {
  try {
    return await searchSkinKnowledge(
      question,
      options
    );
  } catch (error) {
    console.error(
      "[skinKnowledgeRag] Search failed:",
      error.message
    );

    return {
      question,
      count: 0,
      results: [],
      error: error.message,
    };
  }
}

/**
 * Convert retrieved chunks into compact
 * context for the LLM.
 *
 * Do NOT send the complete knowledge-base
 * document to Groq.
 */
export function buildKnowledgeContext(
  results = [],
  maxChunks = 5
) {
  if (!Array.isArray(results)) {
    return "";
  }

  return results
    .slice(0, maxChunks)
    .map((result, index) => {
      const sourcePages =
        Array.isArray(
          result.sourcePages
        )
          ? result.sourcePages.join(", ")
          : "";

      return [
        `SOURCE ${index + 1}`,
        `Ingredient: ${
          result.ingredientName || "Unknown"
        }`,
        `INCI: ${
          result.inciName || "Unknown"
        }`,
        `Topic: ${
          result.chunkType || "general"
        }`,
        result.concern
          ? `Concern: ${result.concern}`
          : null,
        result.skinType
          ? `Skin type: ${result.skinType}`
          : null,
        `Evidence level: ${
          result.evidenceLevel || "Unknown"
        }`,
        `Confidence: ${
          result.confidence ?? "Unknown"
        }`,
        result.generalFlag
          ? `Flag: ${result.generalFlag}`
          : null,
        sourcePages
          ? `Source pages: ${sourcePages}`
          : null,
        `Knowledge: ${
          result.text || ""
        }`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

/**
 * Convenience function used by chat.
 */
export async function retrieveSkinKnowledge(
  question,
  options = {}
) {
  const result =
    await safeSearchSkinKnowledge(
      question,
      options
    );

  return {
    ...result,

    context:
      buildKnowledgeContext(
        result.results || [],
        options.maxChunks || 5
      ),
  };
}

/**
 * Retrieve knowledge for one ingredient.
 */
export async function retrieveIngredientKnowledge(
  ingredientKey,
  question,
  options = {}
) {
  return retrieveSkinKnowledge(
    question,
    {
      ...options,
      ingredientKey,
    }
  );
}

export default {
  searchSkinKnowledge,
  safeSearchSkinKnowledge,
  buildKnowledgeContext,
  retrieveSkinKnowledge,
  retrieveIngredientKnowledge,
};