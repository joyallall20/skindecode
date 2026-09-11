// scripts/index-skin-knowledge.js

import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import SkinKnowledgeChunk from "../src/models/SkinKnowledgeChunk.js";
import {
  generateDocumentEmbedding,
  getEmbeddingConfig,
} from "../src/services/embeddingService.js";

const KB_PATH =
  process.env.SKINCARE_KB_PATH ||
  path.join(
    process.cwd(),
    "src",
    "IntelReport",
    "kincare-ingredient-knowledge-base.json"
  );

const BATCH_SIZE = Number(
  process.env.SKIN_KNOWLEDGE_EMBEDDING_BATCH_SIZE || 5
);

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL;

function log(message, data = null) {
  if (data) {
    console.log(`[skinKnowledgeIndex] ${message}`, data);
  } else {
    console.log(`[skinKnowledgeIndex] ${message}`);
  }
}

function warn(message, data = null) {
  if (data) {
    console.warn(`[skinKnowledgeIndex] ${message}`, data);
  } else {
    console.warn(`[skinKnowledgeIndex] ${message}`);
  }
}

/**
 * Safely convert any value into readable text.
 */
function clean(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

/**
 * Convert arrays into readable comma-separated text.
 */
function arrayText(value) {
  if (!Array.isArray(value)) {
    return clean(value);
  }

  return value
    .map((item) => clean(item))
    .filter(Boolean)
    .join(", ");
}

/**
 * Convert an object into readable lines.
 */
function objectText(value) {
  if (!value || typeof value !== "object") {
    return clean(value);
  }

  return Object.entries(value)
    .map(([key, val]) => {
      const formattedKey = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      return `${formattedKey}: ${clean(val)}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Create a normalized search string.
 */
function buildSearchText(ingredient, extraText = "") {
  return [
    ingredient.ingredient_key,
    ingredient.name,
    ingredient.inci_name,
    arrayText(ingredient.synonyms),
    arrayText(ingredient.functions),
    ingredient.primary_function,
    ingredient.mechanism,
    ingredient.scientific_summary,
    extraText,
  ]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Convert source objects from the KB into the model format.
 *
 * The source JSON uses authors_and_year while the model
 * uses authorsAndYear.
 */
function normalizeSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }

  return sources.map((source) => ({
    title: source?.title || null,
    authorsAndYear: source?.authors_and_year || null,
    journal: source?.journal || null,
    identifier: source?.identifier || null,
    type: source?.type || null,
    finding: source?.finding || null,
    limitations: source?.limitations || null,
    rawCitation: source?.raw_citation || null,
  }));
}

/**
 * Create a stable chunk key.
 *
 * Example:
 *
 * niacinamide__overview
 * niacinamide__concern__acne
 * niacinamide__skin_type
 * niacinamide__safety
 */
function createChunkKey(ingredientKey, chunkType, extra = "") {
  const parts = [
    ingredientKey,
    chunkType,
    extra,
  ].filter(Boolean);

  return parts
    .join("__")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_");
}

/**
 * Common metadata copied onto every chunk.
 */
function baseChunk(ingredient, chunkType, text, options = {}) {
  const {
    concern = null,
    skinType = null,
    evidenceLevel = null,
  } = options;

  const sourcePages = Array.isArray(ingredient.source_pages)
    ? ingredient.source_pages
    : [];

  return {
    chunkKey: createChunkKey(
      ingredient.ingredient_key,
      chunkType,
      concern || skinType || ""
    ),

    ingredientKey: ingredient.ingredient_key,
    ingredientName: ingredient.name,
    inciName: ingredient.inci_name || null,

    chunkType,
    concern,
    skinType,

    text: text.trim(),

    searchText: buildSearchText(ingredient, text),

    embedding: undefined,
    embeddingModel: null,
    embeddingDimensions: null,

    evidenceLevel,
    confidence:
      typeof ingredient.confidence === "number"
        ? ingredient.confidence
        : null,

    generalFlag: ingredient.general_flag || null,
    researchStatus: ingredient.research_status || null,

    sourcePages,

    sources: normalizeSources(ingredient.sources),

    kbVersion:
      process.env.SKIN_KNOWLEDGE_VERSION ||
      "1.0.0",

    sourceType:
      "clinical_skincare_ingredient_knowledge",

    sourceDocument:
      "Clinical Skincare Ingredients Reference Guide",

    isActive: true,
  };
}

/**
 * Build all chunks for one ingredient.
 */
function createIngredientChunks(ingredient) {
  const chunks = [];

  const ingredientKey = ingredient.ingredient_key;

  if (!ingredientKey || !ingredient.name) {
    warn("Skipping malformed ingredient.", ingredient);
    return chunks;
  }

  /*
   * ---------------------------------------------------------
   * 1. OVERVIEW
   * ---------------------------------------------------------
   */

  const overviewParts = [
    `Ingredient: ${ingredient.name}`,
    `INCI name: ${ingredient.inci_name || "Not specified"}`,

    ingredient.cas
      ? `CAS: ${ingredient.cas}`
      : "",

    Array.isArray(ingredient.synonyms) &&
    ingredient.synonyms.length
      ? `Synonyms: ${ingredient.synonyms.join(", ")}`
      : "",

    Array.isArray(ingredient.functions) &&
    ingredient.functions.length
      ? `Functions: ${ingredient.functions.join(", ")}`
      : "",

    ingredient.primary_function
      ? `Primary function: ${ingredient.primary_function}`
      : "",

    ingredient.mechanism
      ? `Mechanism: ${ingredient.mechanism}`
      : "",

    ingredient.scientific_summary
      ? `Scientific summary: ${ingredient.scientific_summary}`
      : "",

    ingredient.evidence_level
      ? `Overall evidence level: ${ingredient.evidence_level}`
      : "",

    ingredient.general_flag
      ? `General flag: ${ingredient.general_flag}`
      : "",

    typeof ingredient.confidence === "number"
      ? `Confidence: ${ingredient.confidence}`
      : "",

    ingredient.flag_reason
      ? `Flag reason: ${ingredient.flag_reason}`
      : "",

    ingredient.uncertainties_research_gaps
      ? `Research gaps: ${ingredient.uncertainties_research_gaps}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (overviewParts) {
    chunks.push(
      baseChunk(
        ingredient,
        "overview",
        overviewParts,
        {
          evidenceLevel:
            ingredient.evidence_level || null,
        }
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * 2. CONCERN CHUNKS
   *
   * One vector per concern gives us much more precise retrieval.
   *
   * Example:
   *
   * niacinamide + acne
   * niacinamide + pigmentation
   * niacinamide + redness
   * ---------------------------------------------------------
   */

  const evidenceByConcern =
    ingredient.evidence_by_concern || {};

  for (const [concern, data] of Object.entries(
    evidenceByConcern
  )) {
    if (!data || typeof data !== "object") {
      continue;
    }

    const evidenceLevel =
      data.evidence_level || null;

    const assessment =
      data.assessment || "";

    const text = [
      `Ingredient: ${ingredient.name}`,
      `Concern: ${concern}`,
      `Evidence level: ${evidenceLevel || "Not specified"}`,
      `Assessment: ${assessment}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!text.trim()) {
      continue;
    }

    chunks.push(
      baseChunk(
        ingredient,
        "concern",
        text,
        {
          concern,
          evidenceLevel,
        }
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * 3. SKIN TYPE
   * ---------------------------------------------------------
   */

  if (ingredient.skin_type_relevance) {
    const text = [
      `Ingredient: ${ingredient.name}`,
      "Skin type relevance:",
      objectText(ingredient.skin_type_relevance),
    ]
      .filter(Boolean)
      .join("\n");

    chunks.push(
      baseChunk(
        ingredient,
        "skin_type",
        text
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * 4. SAFETY
   * ---------------------------------------------------------
   */

  const safetyParts = [
    `Ingredient: ${ingredient.name}`,

    ingredient.sensitive_skin_assessment
      ? `Sensitive skin assessment: ${objectText(
          ingredient.sensitive_skin_assessment
        )}`
      : "",

    ingredient.irritation_sensitization
      ? `Irritation and sensitization: ${objectText(
          ingredient.irritation_sensitization
        )}`
      : "",

    ingredient.special_populations
      ? `Special populations: ${objectText(
          ingredient.special_populations
        )}`
      : "",

    ingredient.general_flag
      ? `General safety flag: ${ingredient.general_flag}`
      : "",

    ingredient.flag_reason
      ? `Flag reason: ${ingredient.flag_reason}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (safetyParts) {
    chunks.push(
      baseChunk(
        ingredient,
        "safety",
        safetyParts,
        {
          evidenceLevel:
            ingredient.evidence_level || null,
        }
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * 5. BARRIER / FORMULATION
   * ---------------------------------------------------------
   */

  const formulationParts = [
    `Ingredient: ${ingredient.name}`,

    ingredient.barrier_effects
      ? `Barrier effects: ${objectText(
          ingredient.barrier_effects
        )}`
      : "",

    ingredient.interactions_formulation
      ? `Formulation interactions: ${objectText(
          ingredient.interactions_formulation
        )}`
      : "",

    ingredient.marketing_claims_vs_scientific_evidence
      ? `Marketing claims vs scientific evidence: ${objectText(
          ingredient.marketing_claims_vs_scientific_evidence
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (formulationParts) {
    chunks.push(
      baseChunk(
        ingredient,
        "formulation",
        formulationParts
      )
    );
  }

  /*
   * ---------------------------------------------------------
   * 6. EVIDENCE
   * ---------------------------------------------------------
   */

  const evidenceParts = [
    `Ingredient: ${ingredient.name}`,

    ingredient.evidence_level
      ? `Overall evidence level: ${ingredient.evidence_level}`
      : "",

    typeof ingredient.confidence === "number"
      ? `Confidence: ${ingredient.confidence}`
      : "",

    ingredient.research_status
      ? `Research status: ${ingredient.research_status}`
      : "",

    ingredient.scientific_summary
      ? `Scientific summary: ${ingredient.scientific_summary}`
      : "",

    ingredient.uncertainties_research_gaps
      ? `Research gaps: ${ingredient.uncertainties_research_gaps}`
      : "",

    Array.isArray(ingredient.source_pages) &&
    ingredient.source_pages.length
      ? `Source pages: ${ingredient.source_pages.join(", ")}`
      : "",

    Array.isArray(ingredient.sources) &&
    ingredient.sources.length
      ? `Sources:\n${ingredient.sources
          .map((source) =>
            source?.raw_citation ||
            [
              source?.title,
              source?.authors_and_year,
              source?.journal,
              source?.identifier,
              source?.finding,
              source?.limitations,
            ]
              .filter(Boolean)
              .join(". ")
          )
          .filter(Boolean)
          .join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (evidenceParts) {
    chunks.push(
      baseChunk(
        ingredient,
        "evidence",
        evidenceParts,
        {
          evidenceLevel:
            ingredient.evidence_level || null,
        }
      )
    );
  }

  return chunks;
}

/**
 * Read and validate the knowledge base.
 */
function loadKnowledgeBase() {
  if (!fs.existsSync(KB_PATH)) {
    throw new Error(
      `Knowledge base file not found:\n${KB_PATH}`
    );
  }

  const raw = fs.readFileSync(KB_PATH, "utf8");

  let knowledgeBase;

  try {
    knowledgeBase = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Knowledge base contains invalid JSON: ${error.message}`
    );
  }

  const ingredients = Array.isArray(
    knowledgeBase?.ingredients
  )
    ? knowledgeBase.ingredients
    : Array.isArray(knowledgeBase)
      ? knowledgeBase
      : Array.isArray(knowledgeBase?.data)
        ? knowledgeBase.data
        : Array.isArray(knowledgeBase?.records)
          ? knowledgeBase.records
          : [];

  if (!ingredients.length) {
    throw new Error(
      "No ingredients were found in the knowledge base."
    );
  }

  return {
    knowledgeBase,
    ingredients,
  };
}

/**
 * Generate an embedding for each chunk and save it.
 *
 * We intentionally process sequentially in small batches
 * to avoid hammering the Gemini API.
 */
async function indexChunks(chunks) {
  let indexed = 0;
  let failed = 0;

  const embeddingConfig = getEmbeddingConfig();

  log("Embedding configuration:", embeddingConfig);

  for (
    let start = 0;
    start < chunks.length;
    start += BATCH_SIZE
  ) {
    const batch = chunks.slice(
      start,
      start + BATCH_SIZE
    );

    log(
      `Processing chunks ${start + 1}-${Math.min(
        start + batch.length,
        chunks.length
      )} of ${chunks.length}`
    );

    for (const chunk of batch) {
      try {
        const embedding =
          await generateDocumentEmbedding(
            chunk.text
          );

        chunk.embedding = embedding;
        chunk.embeddingModel =
          embeddingConfig.model;

        chunk.embeddingDimensions =
          embedding.length;

        await SkinKnowledgeChunk.findOneAndUpdate(
          {
            chunkKey: chunk.chunkKey,
          },
          {
            $set: chunk,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        indexed++;

        log(
          `Indexed: ${chunk.chunkKey}`
        );
      } catch (error) {
        failed++;

        warn(
          `Failed to index ${chunk.chunkKey}`,
          {
            message: error.message,
          }
        );
      }
    }

    /*
     * Small delay between batches.
     *
     * This helps avoid sending a burst of requests.
     */
    if (start + BATCH_SIZE < chunks.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );
    }
  }

  return {
    indexed,
    failed,
  };
}

/**
 * Deactivate old chunks that no longer exist in the
 * current knowledge-base version.
 *
 * We do NOT delete them immediately.
 *
 * This gives us a safer way to update the KB.
 */
async function deactivateMissingChunks(
  activeChunkKeys
) {
  const version =
    process.env.SKIN_KNOWLEDGE_VERSION ||
    "1.0.0";

  const result =
    await SkinKnowledgeChunk.updateMany(
      {
        kbVersion: version,
        chunkKey: {
          $nin: activeChunkKeys,
        },
        isActive: true,
      },
      {
        $set: {
          isActive: false,
        },
      }
    );

  return result.modifiedCount || 0;
}

/**
 * Main indexing process.
 */
async function main() {
  try {
    log("Starting skinDecode knowledge indexing...");

    log(`Knowledge base: ${KB_PATH}`);

    if (!MONGODB_URI) {
      throw new Error(
        "MONGODB_URI / MONGO_URI / DATABASE_URL is not configured."
      );
    }

    /*
     * -------------------------------------------------------
     * Load KB
     * -------------------------------------------------------
     */

    const {
      knowledgeBase,
      ingredients,
    } = loadKnowledgeBase();

    log(
      `Loaded ${ingredients.length} ingredients from knowledge base.`
    );

    /*
     * -------------------------------------------------------
     * Connect MongoDB
     * -------------------------------------------------------
     */

    await mongoose.connect(MONGODB_URI);

    log("Connected to MongoDB.");

    /*
     * -------------------------------------------------------
     * Build chunks
     * -------------------------------------------------------
     */

    const allChunks = [];

    for (const ingredient of ingredients) {
      const chunks =
        createIngredientChunks(
          ingredient
        );

      allChunks.push(...chunks);
    }

    log(
      `Created ${allChunks.length} searchable chunks.`
    );

    /*
     * Print chunk distribution.
     */

    const distribution = {};

    for (const chunk of allChunks) {
      distribution[chunk.chunkType] =
        (distribution[chunk.chunkType] || 0) + 1;
    }

    log(
      "Chunk distribution:",
      distribution
    );

    /*
     * -------------------------------------------------------
     * Index chunks
     * -------------------------------------------------------
     */

    const result =
      await indexChunks(allChunks);

    /*
     * -------------------------------------------------------
     * Deactivate stale chunks
     * -------------------------------------------------------
     */

    const activeChunkKeys =
      allChunks.map(
        (chunk) => chunk.chunkKey
      );

    const deactivated =
      await deactivateMissingChunks(
        activeChunkKeys
      );

    /*
     * -------------------------------------------------------
     * Final statistics
     * -------------------------------------------------------
     */

    const activeCount =
      await SkinKnowledgeChunk.countDocuments({
        isActive: true,
      });

    const indexedCount =
      await SkinKnowledgeChunk.countDocuments({
        isActive: true,
        embedding: {
          $exists: true,
          $ne: [],
        },
      });

    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      " skinDecode Knowledge Index Complete"
    );
    console.log(
      "========================================"
    );
    console.log(
      `Ingredients:        ${ingredients.length}`
    );
    console.log(
      `Chunks generated:   ${allChunks.length}`
    );
    console.log(
      `Chunks indexed:     ${result.indexed}`
    );
    console.log(
      `Chunks failed:      ${result.failed}`
    );
    console.log(
      `Chunks deactivated: ${deactivated}`
    );
    console.log(
      `Active chunks:      ${activeCount}`
    );
    console.log(
      `With embeddings:    ${indexedCount}`
    );
    console.log(
      `KB version:         ${
        knowledgeBase?.schema_version ||
        process.env.SKIN_KNOWLEDGE_VERSION ||
        "1.0.0"
      }`
    );
    console.log(
      "========================================"
    );

    if (result.failed > 0) {
      console.warn(
        "\n⚠️ Some chunks failed to index. Check the logs above."
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("");
    console.error(
      "❌ Knowledge indexing failed:"
    );
    console.error(error.message);

    if (error.stack) {
      console.error(error.stack);
    }

    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      log("MongoDB connection closed.");
    }
  }
}

main();