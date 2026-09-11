import crypto from 'crypto';

import Product from '../models/Product.js';
import ProductIntelligenceJob from '../models/ProductIntelligenceJob.js';

import {
  generateProductIntelligence,
} from '../services/productIntelligenceService.js';

import {
  computeProductQualityScore,
} from '../services/productQualityScoringService.js';

import {
  invalidateExplanationsForIntelligenceChange,
} from '../services/invalidationService.js';

import {
  buildIntelligenceInputFromProduct,
} from '../utils/productIntelligenceInput.js';

import {
  isAutoResearchEnabled,
  queueUnknownsAndMaybeResearch,
} from '../services/ingredientResearchService.js';

import {
  loadPopulatedProduct,
} from '../services/productCatalogService.js';

import {
  INTELLIGENCE_VERSION,
  PROMPT_VERSION,
  KNOWLEDGE_BASE_VERSION,
} from '../constants/intelligenceVersions.js';

const markJobFailed = async (
  jobId,
  productId,
  error
) => {
  await ProductIntelligenceJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: 'failed',
        error:
          error?.message ||
          'Product intelligence generation failed.',
        completedAt: new Date(),
      },
    }
  );

  await Product.findByIdAndUpdate(
    productId,
    {
      $set: {
        intelligenceStatus: 'failed',
      },
    }
  );
};

/**
 * Normalize a product's ingredient list into a stable
 * canonical string suitable for hashing.
 *
 * This must be deterministic across runs so that the same
 * formula always produces the same hash.
 *
 * Rules:
 *   - trim each ingredient name
 *   - collapse internal whitespace
 *   - lowercase
 *   - drop empty entries
 *   - join with '|'
 *
 * Deliberately does NOT reorder ingredients, because order
 * carries a weak concentration signal.
 */
const normalizeFormulaForHash = (
  ingredients = []
) =>
  ingredients
    .map((ingredient) =>
      String(ingredient || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
    )
    .filter(Boolean)
    .join('|');

const computeIntelligenceFormulaHash = (
  ingredients = []
) =>
  crypto
    .createHash('sha256')
    .update(normalizeFormulaForHash(ingredients))
    .digest('hex');

/**
 * Decide whether a product's stored intelligence can be
 * reused as-is.
 *
 * All of the following must be true:
 *   - product has a generated intelligence explanation
 *   - product has a non-empty ingredientAnalysis array
 *   - stored formula hash matches the current formula
 *   - stored intelligenceVersion matches the current constant
 *   - stored promptVersion matches the current constant
 *   - stored knowledgeBaseVersion matches the current constant
 *
 * Any mismatch forces a fresh generation.
 */
const isValidIntelligenceCache = ({
  product,
  formulaHash,
}) => {
  const metadata = product.intelligenceMetadata;

  if (!product.productIntelligence?.explanation) {
    return false;
  }

  if (
    !Array.isArray(
      product.productIntelligence?.ingredientAnalysis
    ) ||
    product.productIntelligence.ingredientAnalysis.length === 0
  ) {
    return false;
  }

  if (
    product.intelligenceFormulaHash !== formulaHash
  ) {
    return false;
  }

  if (
    metadata?.intelligenceVersion !==
    INTELLIGENCE_VERSION
  ) {
    return false;
  }

  if (
    metadata?.promptVersion !==
    PROMPT_VERSION
  ) {
    return false;
  }

  if (
    metadata?.knowledgeBaseVersion !==
    KNOWLEDGE_BASE_VERSION
  ) {
    return false;
  }

  return true;
};

export const processProductIntelligenceJob = async (
  jobId
) => {
  const job =
    await ProductIntelligenceJob.findOneAndUpdate(
      {
        _id: jobId,
        status: 'queued',
      },
      {
        $set: {
          status: 'generating',
          startedAt: new Date(),
        },
      },
      {
        returnDocument: 'after',
      }
    ).lean();

  if (!job) return null;

  try {
    const product =
      await loadPopulatedProduct(
        job.product,
        {
          lean: false,
        }
      );

    if (!product) {
      throw new Error(
        'Product not found.'
      );
    }

    const intelligenceInput =
      buildIntelligenceInputFromProduct(
        product
      );

    if (
      !intelligenceInput.ingredients.length
    ) {
      throw new Error(
        'Full ingredient list is required before running Product Intelligence.'
      );
    }

    /*
     * ----------------------------------------------------------
     * FORMULA HASH + CACHE CHECK
     * ----------------------------------------------------------
     *
     * If the formula is unchanged AND the stored intelligence
     * was generated with the same intelligence / prompt / KB
     * versions, skip the expensive generation path entirely.
     */
    const formulaHash =
      computeIntelligenceFormulaHash(
        intelligenceInput.ingredients
      );

    if (
      isValidIntelligenceCache({
        product,
        formulaHash,
      })
    ) {
      console.info(
        '[intelligence] cache hit',
        {
          productId: String(product._id),
          formulaHash,
        }
      );

      await ProductIntelligenceJob.findByIdAndUpdate(
        jobId,
        {
          $set: {
            status: 'completed',
            completedAt: new Date(),
            error: null,
          },
        }
      );

      return {
        jobId,
        status: 'completed',
        cached: true,
        coverage: null,
      };
    }

    /*
     * ----------------------------------------------------------
     * GENERATE PRODUCT INTELLIGENCE
     * ----------------------------------------------------------
     *
     * The service performs its own knowledge resolution:
     *
     *   COMPLETE INCI
     *     ↓
     *   EXACT KB  (canonical)
     *     ↓
     *   VECTOR FALLBACK  (unmatched ingredients only)
     *     ↓
     *   UNKNOWN → research queue
     *     ↓
     *   CEREBRAS
     *
     * The worker must NOT duplicate that lookup. Doing so was
     * wasteful and could cause divergent decisions between the
     * worker and the service.
     */
    const intelligenceResult =
      await generateProductIntelligence({
        ...intelligenceInput,
      });

    if (!intelligenceResult.success) {
      throw new Error(
        intelligenceResult.error ||
          'Product intelligence generation failed.'
      );
    }

    /*
     * ----------------------------------------------------------
     * QUALITY SCORE
     * ----------------------------------------------------------
     */
    const qualityResult =
      computeProductQualityScore({
        productIntelligence:
          intelligenceResult.data,

        productData:
          intelligenceInput,
      });

    /*
     * ----------------------------------------------------------
     * PERSIST
     * ----------------------------------------------------------
     */
    product.productIntelligence =
      intelligenceResult.data;

    product.intelligenceFormulaHash =
      formulaHash;

    product.qualityScore =
      qualityResult.score;

    product.intelligenceMetadata = {
      generatedAt: new Date(
        intelligenceResult.metadata
          ?.generatedAt ||
          Date.now()
      ),

      intelligenceVersion:
        intelligenceResult.metadata
          ?.intelligenceVersion ||
        null,

      promptVersion:
        intelligenceResult.metadata
          ?.promptVersion ||
        null,

      knowledgeBaseVersion:
        intelligenceResult.metadata
          ?.knowledgeBaseVersion ||
        null,

      provider:
        intelligenceResult.provider ||
        null,

      model:
        intelligenceResult.model ||
        null,
    };

    product.intelligenceStatus =
      'generated';

    product.intelligenceReviewedBy =
      null;

    product.intelligenceReviewedAt =
      null;

    await product.save();

    /*
     * ----------------------------------------------------------
     * INVALIDATE DEPENDENT EXPLANATIONS
     * ----------------------------------------------------------
     */
    await invalidateExplanationsForIntelligenceChange(
      product._id
    );

    /*
     * ----------------------------------------------------------
     * BACKGROUND INGREDIENT RESEARCH
     * ----------------------------------------------------------
     *
     * The service already queued unresolved ingredients during
     * its knowledge resolution step (via
     * recordUnknownIngredients). This call adds the actual
     * research trigger if auto-research is enabled.
     *
     * Failures are non-fatal: intelligence has already been
     * persisted above.
     */
    if (isAutoResearchEnabled()) {
      const unknownIngredients =
        Array.isArray(
          intelligenceResult.metadata
            ?.unknownIngredients
        )
          ? intelligenceResult.metadata
              .unknownIngredients
          : [];

      if (unknownIngredients.length) {
        queueUnknownsAndMaybeResearch(
          unknownIngredients,
          {
            productId: product._id,

            productContext:
              `${intelligenceInput.name} by ${intelligenceInput.brand}`,

            category:
              String(
                intelligenceInput.category ||
                'general'
              )
                .trim()
                .toLowerCase() ||
              'general',
          }
        ).catch((error) => {
          console.error(
            '[intelligence] background ingredient research failed',
            error.message
          );
        });
      }
    }

    await ProductIntelligenceJob.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          error: null,
        },
      }
    );

    return {
      jobId,
      status: 'completed',
      cached: false,
      coverage: null,
    };
  } catch (error) {
    await markJobFailed(
      jobId,
      job.product,
      error
    );

    console.error(
      '[intelligence] job failed',
      {
        jobId: String(jobId),
        productId: String(job.product),
        error: error.message,
      }
    );

    return {
      jobId,
      status: 'failed',
      error: error.message,
    };
  }
};

export const startProductIntelligenceJob = (
  jobId
) => {
  setImmediate(() => {
    processProductIntelligenceJob(
      jobId
    ).catch((error) => {
      console.error(
        '[intelligence] worker crashed',
        {
          jobId: String(jobId),
          error: error.message,
        }
      );
    });
  });
};

let workerStarted = false;
let workerBusy = false;

export const startProductIntelligenceWorker =
  () => {
    if (workerStarted) return;

    workerStarted = true;

    setInterval(async () => {
      if (workerBusy) return;

      workerBusy = true;

      try {
        const queuedJob =
          await ProductIntelligenceJob.findOne({
            status: 'queued',
          })
            .select('_id')
            .lean();

        if (queuedJob) {
          await processProductIntelligenceJob(
            queuedJob._id
          );
        }
      } catch (error) {
        console.error(
          '[intelligence] worker poll failed',
          error.message
        );
      } finally {
        workerBusy = false;
      }
    }, 1000);
  };