/**
 * skinDecode — Sunscreen Knowledge Vector Importer
 *
 * Purpose:
 *   Index the verified sunscreen ingredient knowledge base into
 *   SkinKnowledgeChunk for Atlas Vector Search.
 *
 * IMPORTANT:
 *   One vector document is created per ingredient.
 *   This keeps Gemini embedding usage low.
 *
 * Run from backend root:
 *   node scripts/indexSunscreenKnowledge.js
 *
 * Optional env:
 *
 *   SUNSCREEN_KB_PATH=/absolute/path/to/file.json
 *   SUNSCREEN_INDEX_ONLY_VERIFIED=true
 *   SUNSCREEN_EMBED_DELAY_MS=250
 *   SUNSCREEN_MAX_NEW_EMBEDDINGS=90
 *
 * Gemini is used ONLY for document embeddings.
 * Cerebras is NOT called here.
 */

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import connectDB from "../config/db.js";
import SkinKnowledgeChunk from "../models/SkinKnowledgeChunk.js";

import {
  generateDocumentEmbedding,
  getEmbeddingConfig,
} from "../services/embeddingService.js";

// ============================================================
// CONFIG
// ============================================================

const CATEGORY = "sunscreen";

const SOURCE_TYPE = "sunscreen_ingredient_knowledge";

const SOURCE_DOCUMENT =
  "sunscreen_ingredients_master_database.json";

const KB_PATH =
  process.env.SUNSCREEN_KB_PATH ||
  path.resolve(
    process.cwd(),
    "src",
    "IntelReport",
    SOURCE_DOCUMENT
  );

const INDEX_ONLY_VERIFIED =
  String(
    process.env.SUNSCREEN_INDEX_ONLY_VERIFIED ?? "true"
  ).toLowerCase() !== "false";

const EMBED_DELAY_MS = Math.max(
  Number(process.env.SUNSCREEN_EMBED_DELAY_MS || 250),
  0
);

/**
 * Safety guard.
 *
 * Gemini free embedding quota previously caused the importer
 * to continue making requests after quota exhaustion.
 *
 * We deliberately stop before making more than this many
 * NEW embedding requests during one run.
 */
const MAX_NEW_EMBEDDINGS = Math.max(
  Number(process.env.SUNSCREEN_MAX_NEW_EMBEDDINGS || 90),
  1
);

// ============================================================
// HELPERS
// ============================================================

const log = (...args) =>
  console.log("[sunscreen-vector]", ...args);

const sleep = (ms) =>
  ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();

const clean = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";

const cleanArray = (value) =>
  Array.isArray(value)
    ? value
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : item
        )
        .filter(Boolean)
    : [];

const normalizeKey = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const safeJson = (value) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

// ============================================================
// SOURCE NORMALIZATION
// ============================================================

/**
 * SkinKnowledgeChunk.sources expects:
 *
 * [
 *   {
 *     title,
 *     authorsAndYear,
 *     journal,
 *     identifier,
 *     type,
 *     finding,
 *     limitations,
 *     rawCitation
 *   }
 * ]
 *
 * The master KB may contain strings OR objects.
 *
 * This function guarantees that MongoDB only receives
 * objects matching the schema.
 */
const normalizeSources = (record) => {
  if (!Array.isArray(record?.sources)) {
    return [];
  }

  return record.sources
    .map((source) => {
      // --------------------------------------------------------
      // String source
      // --------------------------------------------------------

      if (typeof source === "string") {
        const value = clean(source);

        if (!value) {
          return null;
        }

        return {
          title: null,
          authorsAndYear: null,
          journal: null,
          identifier: null,
          type: "reference",
          finding: null,
          limitations: null,
          rawCitation: value,
        };
      }

      // --------------------------------------------------------
      // Object source
      // --------------------------------------------------------

      if (
        source &&
        typeof source === "object" &&
        !Array.isArray(source)
      ) {
        return {
          title: clean(source.title) || null,

          authorsAndYear:
            clean(source.authorsAndYear) || null,

          journal:
            clean(source.journal) || null,

          identifier:
            clean(source.identifier) || null,

          type:
            clean(source.type) || null,

          finding:
            clean(source.finding) || null,

          limitations:
            clean(source.limitations) || null,

          rawCitation:
            clean(source.rawCitation) || null,
        };
      }

      return null;
    })
    .filter(Boolean);
};

// ============================================================
// SOURCE TEXT
// ============================================================

const sourceText = (sources) => {
  if (!Array.isArray(sources) || !sources.length) {
    return "";
  }

  return sources
    .map((source, index) => {
      return [
        `Source ${index + 1}`,

        source.title
          ? `Title: ${source.title}`
          : null,

        source.authorsAndYear
          ? `Authors/year: ${source.authorsAndYear}`
          : null,

        source.journal
          ? `Journal: ${source.journal}`
          : null,

        source.identifier
          ? `Identifier: ${source.identifier}`
          : null,

        source.type
          ? `Type: ${source.type}`
          : null,

        source.finding
          ? `Finding: ${source.finding}`
          : null,

        source.limitations
          ? `Limitations: ${source.limitations}`
          : null,

        source.rawCitation
          ? `Citation: ${source.rawCitation}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
};

// ============================================================
// EVIDENCE TEXT
// ============================================================

const evidenceText = (record) => {
  const evidence = record?.evidenceByConcern;

  if (
    !evidence ||
    typeof evidence !== "object" ||
    Array.isArray(evidence)
  ) {
    return "";
  }

  return Object.entries(evidence)
    .map(([concern, value]) => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        return [
          `Concern: ${concern}`,
          `Assessment: ${safeJson(value)}`,
        ].join("\n");
      }

      return [
        `Concern: ${concern}`,

        value.evidence_level
          ? `Evidence level: ${value.evidence_level}`
          : null,

        value.assessment
          ? `Assessment: ${value.assessment}`
          : null,

        value.confidence != null
          ? `Confidence: ${safeJson(value.confidence)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
};

// ============================================================
// SKIN TYPE TEXT
// ============================================================

const skinTypeText = (record) => {
  const relevance = record?.skinTypeRelevance;

  if (
    !relevance ||
    typeof relevance !== "object" ||
    Array.isArray(relevance)
  ) {
    return "";
  }

  return Object.entries(relevance)
    .map(
      ([skinType, assessment]) =>
        `${skinType}: ${safeJson(assessment)}`
    )
    .join("\n");
};

// ============================================================
// COMPLETE VECTOR TEXT
// ============================================================

/**
 * Build ONE comprehensive searchable document per ingredient.
 *
 * This is intentionally much richer than a small "overview"
 * chunk because the goal is ingredient-level retrieval for
 * Product Intelligence.
 */
const buildVectorText = (record, sources) => {
  const ingredientKey =
    clean(record?.ingredientKey) ||
    normalizeKey(
      record?.inciName ||
        record?.name
    );

  const normalizedSources =
    sourceText(sources);

  const evidence =
    evidenceText(record);

  const skinTypes =
    skinTypeText(record);

  const sections = [
    // ----------------------------------------------------------
    // IDENTITY
    // ----------------------------------------------------------

    "=== INGREDIENT IDENTITY ===",

    `Ingredient: ${
      clean(record?.name) || "Unknown"
    }`,

    `INCI: ${
      clean(record?.inciName) || "Unknown"
    }`,

    `Ingredient key: ${
      ingredientKey || "Unknown"
    }`,

    cleanArray(record?.synonyms).length
      ? `Synonyms: ${cleanArray(
          record.synonyms
        ).join(", ")}`
      : null,

    `Knowledge category: ${CATEGORY}`,

    // ----------------------------------------------------------
    // FUNCTIONS
    // ----------------------------------------------------------

    "=== FUNCTIONS ===",

    record?.primaryFunction
      ? `Primary function: ${record.primaryFunction}`
      : null,

    record?.functions?.length
      ? `Functions: ${record.functions.join(", ")}`
      : null,

    // ----------------------------------------------------------
    // MECHANISM / SCIENCE
    // ----------------------------------------------------------

    "=== MECHANISM AND SCIENTIFIC SUMMARY ===",

    record?.mechanism
      ? `Mechanism: ${record.mechanism}`
      : null,

    record?.scientificSummary
      ? `Scientific summary: ${record.scientificSummary}`
      : null,

    // ----------------------------------------------------------
    // EVIDENCE
    // ----------------------------------------------------------

    "=== EVIDENCE BY CONCERN ===",

    evidence || null,

    // ----------------------------------------------------------
    // SKIN TYPE
    // ----------------------------------------------------------

    "=== SKIN TYPE RELEVANCE ===",

    skinTypes || null,

    record?.sensitiveSkinAssessment
      ? `Sensitive-skin assessment: ${record.sensitiveSkinAssessment}`
      : null,

    // ----------------------------------------------------------
    // SAFETY
    // ----------------------------------------------------------

    "=== SAFETY AND SENSITIZATION ===",

    record?.irritationSensitization
      ? `Irritation/sensitization: ${record.irritationSensitization}`
      : null,

    record?.specialPopulations
      ? `Special populations: ${record.specialPopulations}`
      : null,

    record?.safety
      ? `Safety: ${safeJson(record.safety)}`
      : null,

    // ----------------------------------------------------------
    // FORMULATION
    // ----------------------------------------------------------

    "=== FORMULATION INTERACTIONS ===",

    record?.interactionsFormulation
      ? `Formulation interactions: ${record.interactionsFormulation}`
      : null,

    record?.barrierEffects
      ? `Barrier effects: ${record.barrierEffects}`
      : null,

    record?.concentration
      ? `Concentration information: ${safeJson(
          record.concentration
        )}`
      : null,

    // ----------------------------------------------------------
    // UV FILTER INFORMATION
    // ----------------------------------------------------------

    "=== UV FILTER INFORMATION ===",

    record?.uvFilter
      ? `UV-filter information: ${safeJson(
          record.uvFilter
        )}`
      : null,

    // ----------------------------------------------------------
    // PRODUCT ANALYSIS SIGNALS
    // ----------------------------------------------------------

    "=== PRODUCT ANALYSIS SIGNALS ===",

    record?.productAnalysisSignals
      ? `Product-analysis signals: ${safeJson(
          record.productAnalysisSignals
        )}`
      : null,

    // ----------------------------------------------------------
    // EVIDENCE METADATA
    // ----------------------------------------------------------

    "=== EVIDENCE METADATA ===",

    record?.evidenceLevel
      ? `Evidence level: ${record.evidenceLevel}`
      : null,

    record?.evidenceLevelNormalized
      ? `Normalized evidence level: ${record.evidenceLevelNormalized}`
      : null,

    typeof record?.confidence === "number"
      ? `Confidence: ${record.confidence}`
      : null,

    record?.generalFlag
      ? `General flag: ${record.generalFlag}`
      : null,

    // ----------------------------------------------------------
    // SOURCES
    // ----------------------------------------------------------

    "=== SOURCES ===",

    normalizedSources || null,
  ];

  return sections
    .filter(Boolean)
    .join("\n");
};

// ============================================================
// BUILD ONE CHUNK PER INGREDIENT
// ============================================================

const buildChunk = (record, kbVersion) => {
  const ingredientKey =
    clean(record?.ingredientKey) ||
    normalizeKey(
      record?.inciName ||
        record?.name
    );

  if (!ingredientKey) {
    throw new Error(
      "Ingredient is missing ingredientKey/name/inciName."
    );
  }

  const ingredientName =
    clean(record?.name) ||
    clean(record?.inciName);

  if (!ingredientName) {
    throw new Error(
      `Ingredient ${ingredientKey} is missing name/inciName.`
    );
  }

  const sources =
    normalizeSources(record);

  const text =
    buildVectorText(
      record,
      sources
    );

  if (!text) {
    throw new Error(
      `No searchable knowledge text generated for ${ingredientKey}.`
    );
  }

  return {
    /**
     * ONE stable vector document per ingredient.
     */
    chunkKey:
      `${CATEGORY}:${ingredientKey}:knowledge`,

    ingredientKey,

    ingredientName,

    inciName:
      clean(record?.inciName) || null,

    category: CATEGORY,

    /**
     * We use overview because this document represents the
     * complete ingredient knowledge record.
     */
    chunkType: "overview",

    concern: null,

    skinType: null,

    text,

    searchText: text,

    evidenceLevel:
      clean(record?.evidenceLevel) ||
      clean(record?.evidenceLevelNormalized) ||
      null,

    confidence:
      typeof record?.confidence === "number"
        ? record.confidence
        : null,

    generalFlag:
      clean(record?.generalFlag) ||
      null,

    /**
     * Only verified KB records are normally indexed.
     */
    researchStatus: "verified",

    sourcePages: [],

    /**
     * IMPORTANT:
     * Always normalized to the embedded object structure
     * required by SkinKnowledgeChunk.
     */
    sources,

    kbVersion,

    sourceType:
      SOURCE_TYPE,

    sourceDocument:
      SOURCE_DOCUMENT,

    isActive:
      record?.isActive !== false,
  };
};

// ============================================================
// LOAD KNOWLEDGE BASE
// ============================================================

const loadKnowledgeBase = async () => {
  const raw =
    await fs.readFile(
      KB_PATH,
      "utf8"
    );

  const parsed =
    JSON.parse(raw);

  const records =
    Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
        ? parsed.records
        : null;

  if (!records) {
    throw new Error(
      "Invalid sunscreen knowledge base: expected an array or { records: [] }."
    );
  }

  const kbVersion =
    clean(
      parsed?.knowledgeBaseVersion
    ) ||
    clean(
      records[0]?.knowledgeBaseVersion
    ) ||
    "1.0.0";

  return {
    records,
    kbVersion,

    schemaVersion:
      clean(parsed?.schemaVersion) ||
      null,
  };
};

// ============================================================
// EXISTING EMBEDDINGS
// ============================================================

const existingByChunkKey = async (
  chunkKeys
) => {
  if (!chunkKeys.length) {
    return new Map();
  }

  const docs =
    await SkinKnowledgeChunk.find({
      chunkKey: {
        $in: chunkKeys,
      },
    })
      .select(
        [
          "chunkKey",
          "text",
          "embedding",
          "embeddingModel",
          "embeddingDimensions",
          "kbVersion",
        ].join(" ")
      )
      .lean();

  return new Map(
    docs.map((doc) => [
      doc.chunkKey,
      doc,
    ])
  );
};

// ============================================================
// UPSERT
// ============================================================

const upsertChunk = async (
  chunk,
  embedding,
  embeddingConfig
) => {
  const now =
    new Date();

  await SkinKnowledgeChunk.updateOne(
    {
      chunkKey:
        chunk.chunkKey,
    },

    {
      $set: {
        ...chunk,

        embedding,

        embeddingModel:
          embeddingConfig.model,

        embeddingDimensions:
          embeddingConfig.dimensions,

        updatedAt:
          now,
      },

      $setOnInsert: {
        createdAt:
          now,
      },
    },

    {
      upsert: true,
    }
  );
};

// ============================================================
// QUOTA ERROR DETECTION
// ============================================================

const isQuotaOrRateLimitError = (
  error
) => {
  const message =
    String(
      error?.message || error || ""
    ).toLowerCase();

  return (
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("429") ||
    message.includes("free_tier")
  );
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  log("Starting...");
  log(
    "========================================"
  );

  log(
    "Knowledge base:",
    KB_PATH
  );

  log(
    "Category:",
    CATEGORY
  );

  log(
    "Index only verified:",
    INDEX_ONLY_VERIFIED
  );

  log(
    "Embedding delay:",
    `${EMBED_DELAY_MS}ms`
  );

  log(
    "Maximum NEW embeddings:",
    MAX_NEW_EMBEDDINGS
  );

  // ----------------------------------------------------------
  // LOAD KB
  // ----------------------------------------------------------

  const {
    records,
    kbVersion,
    schemaVersion,
  } =
    await loadKnowledgeBase();

  const embeddingConfig =
    getEmbeddingConfig();

  log(
    "KB schema:",
    schemaVersion ||
      "legacy"
  );

  log(
    "KB version:",
    kbVersion
  );

  log(
    "Records in source:",
    records.length
  );

  log(
    "Embedding:",
    `${embeddingConfig.provider}/${embeddingConfig.model} (${embeddingConfig.dimensions} dimensions)`
  );

  // ----------------------------------------------------------
  // DATABASE
  // ----------------------------------------------------------

  await connectDB();

  // ----------------------------------------------------------
  // BUILD ONE CHUNK PER INGREDIENT
  // ----------------------------------------------------------

  const allChunks = [];

  const skipped = [];

  const invalid = [];

  const seenChunkKeys =
    new Set();

  records.forEach(
    (record, index) => {
      try {
        const status =
          clean(
            record?.researchStatus
          ).toLowerCase();

        // ----------------------------------------------
        // VERIFIED FILTER
        // ----------------------------------------------

        if (
          INDEX_ONLY_VERIFIED &&
          status !== "verified"
        ) {
          skipped.push({
            index,

            ingredientKey:
              record?.ingredientKey ||
              null,

            reason:
              `researchStatus=${
                status || "missing"
              }`,
          });

          return;
        }

        // ----------------------------------------------
        // BUILD ONE DOCUMENT
        // ----------------------------------------------

        const chunk =
          buildChunk(
            record,
            kbVersion
          );

        // ----------------------------------------------
        // DUPLICATE GUARD
        // ----------------------------------------------

        if (
          seenChunkKeys.has(
            chunk.chunkKey
          )
        ) {
          return;
        }

        seenChunkKeys.add(
          chunk.chunkKey
        );

        allChunks.push(
          chunk
        );
      } catch (error) {
        invalid.push({
          index,

          ingredientKey:
            record?.ingredientKey ||
            null,

          error:
            error.message,
        });
      }
    }
  );

  log(
    "========================================"
  );

  log(
    "Prepared vector documents:",
    allChunks.length
  );

  log(
    "Records skipped:",
    skipped.length
  );

  log(
    "Records invalid:",
    invalid.length
  );

  if (invalid.length) {
    console.warn(
      "[sunscreen-vector] Invalid records:",
      JSON.stringify(
        invalid.slice(0, 20),
        null,
        2
      )
    );
  }

  // ----------------------------------------------------------
  // EXISTING DOCUMENTS
  // ----------------------------------------------------------

  const existing =
    await existingByChunkKey(
      allChunks.map(
        (chunk) =>
          chunk.chunkKey
      )
    );

  // ----------------------------------------------------------
  // COUNTERS
  // ----------------------------------------------------------

  let embedded = 0;

  let reused = 0;

  let upserted = 0;

  let failed = 0;

  let stoppedByQuota =
    false;

  // ----------------------------------------------------------
  // EMBED + UPSERT
  // ----------------------------------------------------------

  for (
    let index = 0;
    index < allChunks.length;
    index += 1
  ) {
    const chunk =
      allChunks[index];

    const existingDoc =
      existing.get(
        chunk.chunkKey
      );

    // --------------------------------------------------------
    // CHECK WHETHER EMBEDDING CAN BE REUSED
    // --------------------------------------------------------

    const reusable =
      Array.isArray(
        existingDoc?.embedding
      ) &&
      existingDoc.embedding.length ===
        embeddingConfig.dimensions &&
      existingDoc.embeddingModel ===
        embeddingConfig.model &&
      existingDoc.embeddingDimensions ===
        embeddingConfig.dimensions &&
      existingDoc.kbVersion ===
        kbVersion &&
      existingDoc.text ===
        chunk.text;

    try {
      let embedding;

      // ------------------------------------------------------
      // REUSE
      // ------------------------------------------------------

      if (reusable) {
        embedding =
          existingDoc.embedding;

        reused += 1;
      }

      // ------------------------------------------------------
      // NEW EMBEDDING
      // ------------------------------------------------------

      else {
        // ----------------------------------------------------
        // HARD FREE-QUOTA SAFETY LIMIT
        // ----------------------------------------------------

        if (
          embedded >=
          MAX_NEW_EMBEDDINGS
        ) {
          stoppedByQuota =
            true;

          console.warn(
            "[sunscreen-vector] Stopping before exceeding the configured new-embedding safety limit."
          );

          break;
        }

        await sleep(
          EMBED_DELAY_MS
        );

        log(
          `Embedding ${embedded + 1}/${MAX_NEW_EMBEDDINGS}: ${chunk.ingredientName}`
        );

        embedding =
          await generateDocumentEmbedding(
            chunk.text
          );

        embedded += 1;
      }

      // ------------------------------------------------------
      // UPSERT
      // ------------------------------------------------------

      await upsertChunk(
        chunk,
        embedding,
        embeddingConfig
      );

      upserted += 1;

      // ------------------------------------------------------
      // PROGRESS
      // ------------------------------------------------------

      if (
        (index + 1) % 5 === 0 ||
        index ===
          allChunks.length - 1
      ) {
        log(
          `Progress ${index + 1}/${allChunks.length} | ` +
          `embedded=${embedded} ` +
          `reused=${reused} ` +
          `upserted=${upserted} ` +
          `failed=${failed}`
        );
      }
    } catch (error) {
      failed += 1;

      // ------------------------------------------------------
      // STOP IMMEDIATELY ON QUOTA/RATE LIMIT
      // ------------------------------------------------------

      if (
        isQuotaOrRateLimitError(
          error
        )
      ) {
        stoppedByQuota =
          true;

        console.error(
          "[sunscreen-vector] Gemini embedding quota/rate limit reached."
        );

        console.error(
          "[sunscreen-vector] Stopping immediately to avoid additional requests."
        );

        console.error(
          "[sunscreen-vector]",
          error.message
        );

        break;
      }

      // ------------------------------------------------------
      // NORMAL FAILURE
      // ------------------------------------------------------

      console.error(
        `[sunscreen-vector] Failed ingredient ${chunk.chunkKey}:`,
        error.message
      );
    }
  }

  // ----------------------------------------------------------
  // FINAL COUNTS
  // ----------------------------------------------------------

  const filter = {
    category:
      CATEGORY,

    kbVersion,

    sourceType:
      SOURCE_TYPE,

    isActive: true,
  };

  const activeCount =
    await SkinKnowledgeChunk.countDocuments(
      filter
    );

  const embeddedCount =
    await SkinKnowledgeChunk.countDocuments(
      {
        ...filter,

        embedding: {
          $exists: true,
          $ne: [],
        },
      }
    );

  // ----------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------

  log(
    "========================================"
  );

  log(
    "DONE"
  );

  log(
    "========================================"
  );

  log(
    "Source records:",
    records.length
  );

  log(
    "Prepared vector documents:",
    allChunks.length
  );

  log(
    "Embeddings generated:",
    embedded
  );

  log(
    "Embeddings reused:",
    reused
  );

  log(
    "Documents upserted:",
    upserted
  );

  log(
    "Failures:",
    failed
  );

  log(
    "Stopped by quota/safety limit:",
    stoppedByQuota
  );

  log(
    "Active sunscreen documents in DB:",
    activeCount
  );

  log(
    "Documents with embeddings:",
    embeddedCount
  );

  log(
    "Vector index:",
    process.env.SKIN_KNOWLEDGE_VECTOR_INDEX ||
      "skin_knowledge_vector_index"
  );

  log(
    "========================================"
  );

  // ----------------------------------------------------------
  // EXIT STATUS
  // ----------------------------------------------------------

  if (
    failed > 0 ||
    stoppedByQuota
  ) {
    process.exitCode = 1;
  }
};

// ============================================================
// START
// ============================================================

main().catch(
  (error) => {
    console.error(
      "[sunscreen-vector] Import failed:",
      error
    );

    process.exitCode = 1;
  }
);