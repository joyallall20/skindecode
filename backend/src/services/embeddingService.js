// src/services/embeddingService.js

const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const EMBEDDING_DIMENSIONS = Number(
  process.env.GEMINI_EMBEDDING_DIMENSIONS || 768
);

/**
 * Validate Gemini configuration.
 */
function validateConfig() {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured in environment variables."
    );
  }

  if (!Number.isInteger(EMBEDDING_DIMENSIONS) || EMBEDDING_DIMENSIONS <= 0) {
    throw new Error(
      `Invalid GEMINI_EMBEDDING_DIMENSIONS: ${EMBEDDING_DIMENSIONS}`
    );
  }
}

/**
 * Normalize a vector to unit length.
 *
 * This makes cosine similarity behave consistently
 * when comparing stored document embeddings with query embeddings.
 */
function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Invalid embedding vector returned by Gemini.");
  }

  let magnitude = 0;

  for (const value of vector) {
    magnitude += value * value;
  }

  magnitude = Math.sqrt(magnitude);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error("Gemini returned an invalid zero-magnitude embedding.");
  }

  return vector.map((value) => value / magnitude);
}

/**
 * Call Gemini embedding API.
 *
 * taskType:
 *   RETRIEVAL_DOCUMENT -> when embedding knowledge-base chunks
 *   RETRIEVAL_QUERY    -> when embedding a user's question
 */
async function generateEmbedding(text, taskType) {
  validateConfig();

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Embedding text must be a non-empty string.");
  }

  if (
    taskType !== "RETRIEVAL_DOCUMENT" &&
    taskType !== "RETRIEVAL_QUERY"
  ) {
    throw new Error(
      `Unsupported embedding task type: ${taskType}`
    );
  }

  const url =
    `${GEMINI_API_BASE}/${GEMINI_EMBEDDING_MODEL}:embedContent` +
    `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: {
        parts: [
          {
            text: text.trim(),
          },
        ],
      },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    }),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Gemini embedding API returned an invalid JSON response. HTTP ${response.status}.`
    );
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini embedding request failed with HTTP ${response.status}.`;

    const error = new Error(message);

    error.status = response.status;
    error.provider = "gemini";
    error.model = GEMINI_EMBEDDING_MODEL;

    throw error;
  }

  const values = data?.embedding?.values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(
      "Gemini embedding response did not contain embedding.values."
    );
  }

  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding dimensions. Expected ${EMBEDDING_DIMENSIONS}, received ${values.length}.`
    );
  }

  return normalizeVector(values);
}

/**
 * Generate an embedding for a knowledge-base document/chunk.
 *
 * Use this during indexing:
 *
 * const embedding = await generateDocumentEmbedding(chunk.text);
 */
export async function generateDocumentEmbedding(text) {
  return generateEmbedding(text, "RETRIEVAL_DOCUMENT");
}

/**
 * Generate an embedding for a user's search/query.
 *
 * Use this during RAG retrieval:
 *
 * const embedding = await generateQueryEmbedding(question);
 */
export async function generateQueryEmbedding(text) {
  return generateEmbedding(text, "RETRIEVAL_QUERY");
}

/**
 * Generate embeddings for multiple documents sequentially.
 *
 * Sequential processing is intentional here so that indexing
 * does not accidentally create a large burst of Gemini requests.
 */
export async function generateDocumentEmbeddings(texts) {
  if (!Array.isArray(texts)) {
    throw new Error("texts must be an array.");
  }

  const embeddings = [];

  for (const text of texts) {
    const embedding = await generateDocumentEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

/**
 * Get embedding configuration.
 */
export function getEmbeddingConfig() {
  return {
    provider: "gemini",
    model: GEMINI_EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    normalized: true,
  };
}

export default {
  generateDocumentEmbedding,
  generateQueryEmbedding,
  generateDocumentEmbeddings,
  getEmbeddingConfig,
};