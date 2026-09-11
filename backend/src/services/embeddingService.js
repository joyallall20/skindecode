// src/services/embeddingService.js

/**
 * skinDecode local embedding service
 *
 * Uses:
 *   BAAI/bge-small-en-v1.5
 *
 * Local Python service:
 *   http://127.0.0.1:8001
 *
 * Embedding dimensions:
 *   384
 *
 * IMPORTANT:
 * Document and query embeddings MUST use the same model.
 */

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL ||
  "http://127.0.0.1:8001";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ||
  "BAAI/bge-small-en-v1.5";

const EMBEDDING_DIMENSIONS = Number(
  process.env.EMBEDDING_DIMENSIONS || 384
);

const REQUEST_TIMEOUT_MS = Number(
  process.env.EMBEDDING_REQUEST_TIMEOUT_MS || 30000
);


// ============================================================
// CONFIG VALIDATION
// ============================================================

function validateConfig() {
  if (!EMBEDDING_SERVICE_URL) {
    throw new Error(
      "EMBEDDING_SERVICE_URL is not configured."
    );
  }

  if (!EMBEDDING_MODEL) {
    throw new Error(
      "EMBEDDING_MODEL is not configured."
    );
  }

  if (
    !Number.isInteger(EMBEDDING_DIMENSIONS) ||
    EMBEDDING_DIMENSIONS <= 0
  ) {
    throw new Error(
      `Invalid EMBEDDING_DIMENSIONS: ${EMBEDDING_DIMENSIONS}`
    );
  }
}


// ============================================================
// VECTOR NORMALIZATION
// ============================================================

function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error(
      "Embedding service returned an invalid embedding vector."
    );
  }

  let magnitude = 0;

  for (const value of vector) {
    if (!Number.isFinite(Number(value))) {
      throw new Error(
        "Embedding service returned a non-numeric embedding value."
      );
    }

    magnitude += Number(value) * Number(value);
  }

  magnitude = Math.sqrt(magnitude);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new Error(
      "Embedding service returned a zero-magnitude embedding."
    );
  }

  return vector.map(
    (value) => Number(value) / magnitude
  );
}


// ============================================================
// REQUEST HELPER
// ============================================================

async function requestEmbedding(endpoint, body) {
  validateConfig();

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EMBEDDING_SERVICE_URL}${endpoint}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),

        signal: controller.signal,
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Embedding service returned invalid JSON. HTTP ${response.status}.`
      );
    }

    if (!response.ok) {
      const message =
        data?.detail ||
        data?.error ||
        `Embedding service failed with HTTP ${response.status}.`;

      const error = new Error(message);

      error.status = response.status;
      error.provider = "local";
      error.model = EMBEDDING_MODEL;

      throw error;
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Embedding service request timed out after ${REQUEST_TIMEOUT_MS}ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


// ============================================================
// SINGLE EMBEDDING
// ============================================================

async function generateEmbedding(text) {
  if (
    typeof text !== "string" ||
    !text.trim()
  ) {
    throw new Error(
      "Embedding text must be a non-empty string."
    );
  }

  const data = await requestEmbedding(
    "/embed",
    {
      text: text.trim(),
    }
  );

  const values = data?.embedding;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(
      "Embedding service response did not contain embedding."
    );
  }

  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Unexpected embedding dimensions. Expected ${EMBEDDING_DIMENSIONS}, received ${values.length}.`
    );
  }

  return normalizeVector(values);
}


// ============================================================
// DOCUMENT EMBEDDING
// ============================================================

/**
 * Generate embedding for a knowledge-base document.
 *
 * BGE-small does not require Gemini-style taskType values.
 */
export async function generateDocumentEmbedding(text) {
  return generateEmbedding(text);
}


// ============================================================
// QUERY EMBEDDING
// ============================================================

/**
 * Generate embedding for a search/query.
 *
 * IMPORTANT:
 * The exact same BGE-small model is used as for documents.
 */
export async function generateQueryEmbedding(text) {
  return generateEmbedding(text);
}


// ============================================================
// BATCH DOCUMENT EMBEDDINGS
// ============================================================

export async function generateDocumentEmbeddings(texts) {
  if (!Array.isArray(texts)) {
    throw new Error(
      "texts must be an array."
    );
  }

  if (texts.length === 0) {
    return [];
  }

  const cleanTexts = texts.map(
    (text, index) => {
      if (
        typeof text !== "string" ||
        !text.trim()
      ) {
        throw new Error(
          `Embedding text at index ${index} must be a non-empty string.`
        );
      }

      return text.trim();
    }
  );

  const data = await requestEmbedding(
    "/embed/batch",
    {
      texts: cleanTexts,
    }
  );

  const embeddings = data?.embeddings;

  if (
    !Array.isArray(embeddings) ||
    embeddings.length !== cleanTexts.length
  ) {
    throw new Error(
      `Embedding batch returned an unexpected number of embeddings. Expected ${cleanTexts.length}, received ${embeddings?.length || 0}.`
    );
  }

  return embeddings.map(
    (embedding, index) => {
      if (
        !Array.isArray(embedding) ||
        embedding.length !== EMBEDDING_DIMENSIONS
      ) {
        throw new Error(
          `Unexpected embedding dimensions at index ${index}. Expected ${EMBEDDING_DIMENSIONS}, received ${embedding?.length || 0}.`
        );
      }

      return normalizeVector(embedding);
    }
  );
}


// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkEmbeddingService() {
  validateConfig();

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EMBEDDING_SERVICE_URL}/health`,
      {
        method: "GET",
        signal: controller.signal,
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Embedding service health endpoint returned invalid JSON. HTTP ${response.status}.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Embedding service health check failed with HTTP ${response.status}.`
      );
    }

    if (
      data?.model &&
      data.model !== EMBEDDING_MODEL
    ) {
      throw new Error(
        `Embedding model mismatch. Backend expects ${EMBEDDING_MODEL}, service reports ${data.model}.`
      );
    }

    if (
      data?.dimensions &&
      Number(data.dimensions) !== EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Embedding dimension mismatch. Backend expects ${EMBEDDING_DIMENSIONS}, service reports ${data.dimensions}.`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        `Embedding service health check timed out after ${REQUEST_TIMEOUT_MS}ms.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


// ============================================================
// CONFIG
// ============================================================

export function getEmbeddingConfig() {
  return {
    provider: "local",
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    normalized: true,
    serviceUrl: EMBEDDING_SERVICE_URL,
  };
}


export default {
  generateDocumentEmbedding,
  generateQueryEmbedding,
  generateDocumentEmbeddings,
  checkEmbeddingService,
  getEmbeddingConfig,
};