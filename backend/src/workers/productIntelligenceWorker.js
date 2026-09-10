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
  buildIngredientCoverage,
  getKnowledgeForIngredients,
} from '../services/ingredientKnowledgeService.js';

import {
  isAutoResearchEnabled,
  queueUnknownsAndMaybeResearch,
} from '../services/ingredientResearchService.js';

import {
  loadPopulatedProduct,
} from '../services/productCatalogService.js';

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
     * Get current knowledge coverage.
     */
    const knowledge =
      await getKnowledgeForIngredients(
        intelligenceInput.ingredients
      );

    const coverage =
      await buildIngredientCoverage(
        intelligenceInput.ingredients,
        product._id
      );

    /*
     * Find ingredients that are not currently
     * production-eligible.
     */
    const unknownNames =
      knowledge.unknown.map(
        (entry) => entry.query
      );

    /*
     * Research unknown ingredients in the
     * background.
     *
     * This does NOT block Product Intelligence.
     *
     * Successful research will automatically
     * synchronize into IngredientKnowledge.
     */
    if (
      isAutoResearchEnabled() &&
      unknownNames.length
    ) {
      queueUnknownsAndMaybeResearch(
        unknownNames,
        {
          productId: product._id,
          productContext:
            `${intelligenceInput.name} by ${intelligenceInput.brand}`,
        }
      ).catch((error) => {
        console.error(
          '[intelligence] background ingredient research failed',
          error.message
        );
      });
    }

    /*
     * Generate product intelligence using the
     * knowledge that exists RIGHT NOW.
     *
     * Newly researched ingredients will become
     * available to future intelligence runs.
     */
    const intelligenceResult =
      await generateProductIntelligence({
        ...intelligenceInput,

        verifiedKnowledge:
          knowledge.known.map(
            (entry) => entry.record
          ),

        unknownIngredients:
          knowledge.unknown.map(
            (entry) => entry.query
          ),
      });

    if (!intelligenceResult.success) {
      throw new Error(
        intelligenceResult.error ||
          'Product intelligence generation failed.'
      );
    }

    const qualityResult =
      computeProductQualityScore({
        productIntelligence:
          intelligenceResult.data,

        productData:
          intelligenceInput,
      });

    product.productIntelligence =
      intelligenceResult.data;

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

    await invalidateExplanationsForIntelligenceChange(
      product._id
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
      coverage,
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