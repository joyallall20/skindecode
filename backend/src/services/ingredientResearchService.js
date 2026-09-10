import IngredientKnowledge from '../models/IngredientKnowledge.js';
import IngredientResearch from '../models/IngredientResearch.js';
import { generateGeminiJSON as defaultGenerateGeminiJSON } from './geminiService.js';
import { getGeminiConfig } from '../config/aiConfig.js';
import { KNOWLEDGE_BASE_VERSION } from '../constants/intelligenceVersions.js';
import { findIngredient, recordUnknownIngredients } from './ingredientKnowledgeService.js';
import {
  INGREDIENT_RESEARCH_GEMINI_SCHEMA,
  validateProposedKnowledge,
} from '../schemas/ingredientKnowledgeSchema.js';
import { normalizeIngredientToken, slugifyIngredientKey } from '../utils/ingredientNormalize.js';
import { invalidateExplanationsForKnowledgeBaseChange } from './invalidationService.js';

let generateGeminiJSON = defaultGenerateGeminiJSON;

export const setIngredientResearchGenerator = (fn) => {
  generateGeminiJSON =
    typeof fn === 'function' ? fn : defaultGenerateGeminiJSON;
};

const isAutoResearchEnabled = () =>
  String(process.env.AUTO_RESEARCH_UNKNOWN_INGREDIENTS || '').toLowerCase() ===
  'true';

export { isAutoResearchEnabled };

const RESEARCH_SYSTEM_PROMPT = [
  'You are performing scientific skincare ingredient research for a clinical knowledge base.',
  'Return structured JSON only, matching the provided schema exactly.',
  'Prioritize evidence in this order: human clinical trials, systematic reviews/meta-analyses, high-quality peer-reviewed reviews, expert consensus, mechanistic/in-vitro/animal evidence, then regulatory safety assessments.',
  'Distinguish EFFICACY evidence from SAFETY/REGULATORY evidence. A safety assessment is not proof of clinical efficacy.',
  'An in-vitro mechanism is not proof of clinical effectiveness.',
  'If evidence is insufficient, set evidenceLevel to "E" and explain the uncertainty.',
  'Never fabricate PMID, DOI, authors, journals, trials, regulatory opinions, concentrations, or study results.',
  'Only include sources you can identify. If a source cannot be verified, omit it rather than inventing a citation.',
  'Use cautious scientific language. Do not make medical claims or diagnose disease.',
  'generalFlag is an ingredient-level general assessment, not a user-specific recommendation.',
  'Allowed evidenceLevel values: A, B, C, D, E.',
  'Allowed generalFlag values: Green, Light Green, Yellow, Orange, Red.',
  'The validated research result will be synchronized automatically into the ingredient knowledge base.',
].join(' ');

export const buildIngredientResearchPrompt = ({
  ingredientName,
  productContext = null,
  existingRecord = null,
}) =>
  [
    `Research the cosmetic/skincare ingredient: ${ingredientName}.`,
    productContext ? `Product context: ${productContext}` : '',
    existingRecord
      ? 'An existing knowledge record exists. Propose an update only where new evidence is justified. Do not copy unverifiable claims.'
      : 'This ingredient is currently unknown to the verified knowledge base.',
    'Populate INCI name, synonyms, CAS if known, functions, mechanism, evidence by concern, skin-type relevance, irritation, barrier effects, interactions, special populations, marketing vs evidence, evidence level, general flag, confidence (0-1), flag reason, scientific summary, uncertainties, and traceable sources.',
  ]
    .filter(Boolean)
    .join('\n');

/**
 * Synchronize validated Gemini research into IngredientKnowledge.
 *
 * New ingredient:
 *   create a verified IngredientKnowledge record.
 *
 * Existing unverified ingredient:
 *   update that record and make it verified.
 *
 * Existing verified ingredient:
 *   only update when explicitly running research as an update.
 */
const syncResearchToKnowledge = async ({
  queue,
  data,
  existingRecord = null,
  notes = '',
} = {}) => {
  let knowledge = null;

  const knowledgeData = {
    ...data,
    researchStatus: 'verified',
    researchProvider: queue.provider || null,
    researchedAt: queue.completedAt || new Date(),
    reviewedBy: null,
    reviewedAt: new Date(),
    origin: queue.isUpdate ? 'research_update' : 'gemini_research',
    knowledgeBaseVersion: KNOWLEDGE_BASE_VERSION,
    isActive: true,
  };

  /*
   * Existing verified record being updated.
   */
  if (queue.isUpdate && queue.targetKnowledgeId) {
    knowledge = await IngredientKnowledge.findById(queue.targetKnowledgeId);

    if (!knowledge) {
      throw new Error(
        'Target verified knowledge record was not found.'
      );
    }

    const previous = knowledge.toObject();

    const changedFields = changedFieldsBetween(
      previous,
      knowledgeData
    );

    const nextVersion = (knowledge.version || 1) + 1;

    knowledge.changeHistory = [
      ...(knowledge.changeHistory || []),
      {
        version: nextVersion,
        previousVersion: knowledge.version || 1,
        changedFields,
        reason:
          notes ||
          'Automatically updated from validated Gemini ingredient research.',
        researchSources: knowledgeData.sources,
        provider: queue.provider || null,
        model: queue.model || null,
        reviewedBy: null,
        reviewedAt: new Date(),
        timestamp: new Date(),
      },
    ];

    knowledge.previousVersion = knowledge.version || 1;
    knowledge.version = nextVersion;

    Object.assign(knowledge, knowledgeData);

    await knowledge.save();

    console.info('[knowledge] verified ingredient updated', {
      ingredientKey: knowledge.ingredientKey,
      version: nextVersion,
    });
  } else {
    /*
     * Look for an existing record by ingredient key.
     */
    const existingKey = await IngredientKnowledge.findOne({
      ingredientKey: knowledgeData.ingredientKey,
    });

    /*
     * Do not silently overwrite another verified record.
     *
     * This should normally only happen if a duplicate ingredient key
     * is returned by Gemini.
     */
    if (
      existingKey &&
      existingKey.researchStatus === 'verified'
    ) {
      knowledge = existingKey;

      console.info(
        '[knowledge] verified ingredient already exists; using existing record',
        {
          ingredientKey: knowledge.ingredientKey,
        }
      );
    } else if (existingKey) {
      /*
       * Existing draft/unverified record.
       */
      knowledge = Object.assign(
        existingKey,
        knowledgeData,
        {
          version: existingKey.version || 1,
        }
      );

      await knowledge.save();

      console.info(
        '[knowledge] existing ingredient promoted to verified',
        {
          ingredientKey: knowledge.ingredientKey,
        }
      );
    } else {
      /*
       * Completely new ingredient.
       */
      knowledge = await IngredientKnowledge.create({
        ...knowledgeData,
        version: 1,
      });

      console.info(
        '[knowledge] new ingredient automatically added',
        {
          ingredientKey: knowledge.ingredientKey,
          name: knowledge.name,
        }
      );
    }
  }

  /*
   * Link the research queue to the resulting knowledge record.
   */
  queue.status = 'approved';
  queue.reviewedBy = null;
  queue.reviewedAt = new Date();
  queue.reviewNotes =
    notes ||
    'Automatically synchronized from validated Gemini research.';
  queue.approvedKnowledgeId = knowledge._id;

  await queue.save();

  /*
   * Existing explanations may contain ingredient knowledge.
   * Invalidate them because the knowledge base changed.
   */
  await invalidateExplanationsForKnowledgeBaseChange();

  return knowledge;
};

export const runIngredientResearch = async ({
  ingredientName,
  productId = null,
  productContext = null,
  isUpdate = false,
} = {}) => {
  const name = String(ingredientName || '').trim();

  if (!name) {
    throw new Error('Ingredient name is required for research.');
  }

  const normalizedName = normalizeIngredientToken(name);

  let queue = await IngredientResearch.findOne({
    normalizedName,
    status: {
      $in: [
        'research_needed',
        'researching',
        'pending_review',
        'failed',
      ],
    },
  });

  if (!queue) {
    const created = await recordUnknownIngredients(
      [name],
      productId
    );

    queue = created?.[0];

    if (!queue) {
      throw new Error(
        `Unable to create research queue for ingredient: ${name}`
      );
    }
  }

  /*
   * Check the current knowledge base.
   */
  const existingRecord = await findIngredient(name);

  /*
   * If already verified and this is not an explicit update,
   * there is nothing to research.
   */
  if (
    existingRecord?.researchStatus === 'verified' &&
    !isUpdate
  ) {
    console.info(
      '[knowledge] research skipped; verified record already exists',
      { name }
    );

    return {
      queue,
      existingRecord,
      skipped: true,
      reason: 'verified_exists',
    };
  }

  /*
   * Mark research as running.
   */
  queue.status = 'researching';
  queue.startedAt = new Date();
  queue.researchAttempts =
    (queue.researchAttempts || 0) + 1;

  queue.isUpdate =
    Boolean(
      existingRecord?.researchStatus === 'verified'
    );

  queue.targetKnowledgeId =
    existingRecord?._id || null;

  await queue.save();

  console.info(
    '[knowledge] Gemini research started',
    {
      name,
      attempt: queue.researchAttempts,
    }
  );

  /*
   * Call Gemini.
   */
  const geminiResult = await generateGeminiJSON({
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
    prompt: buildIngredientResearchPrompt({
      ingredientName: name,
      productContext,
      existingRecord,
    }),
    responseSchema: INGREDIENT_RESEARCH_GEMINI_SCHEMA,
    temperature: 0.1,
    model: getGeminiConfig().models.research,
  });

  /*
   * Gemini failure.
   */
  if (!geminiResult.success) {
    queue.status = 'failed';

    queue.error =
      geminiResult.error ||
      'Ingredient research failed.';

    queue.rawResponse = {
      rawText: geminiResult.rawText,
      validationErrors:
        geminiResult.validationErrors,
      parseError: geminiResult.parseError,
    };

    queue.provider = geminiResult.provider;
    queue.model = geminiResult.model;
    queue.completedAt = new Date();

    await queue.save();

    console.info(
      '[knowledge] Gemini research failed',
      {
        name,
        error: queue.error,
        validationErrors:
          geminiResult.validationErrors,
      }
    );

    return {
      queue,
      success: false,
      error: queue.error,
      geminiResult,
    };
  }

  /*
   * Build normalized proposed knowledge.
   */
  const proposedInput = {
    ...geminiResult.data,

    ingredientKey:
      geminiResult.data.ingredientKey ||
      existingRecord?.ingredientKey ||
      slugifyIngredientKey(
        geminiResult.data.inciName || name
      ),

    name:
      geminiResult.data.name || name,
  };

  /*
   * Validate Gemini's output before it touches
   * IngredientKnowledge.
   */
  const validation =
    validateProposedKnowledge(proposedInput);

  if (!validation.valid) {
    queue.status = 'failed';

    queue.error =
      `Research validation failed: ${validation.errors.join('; ')}`;

    queue.rawResponse = {
      data: geminiResult.data,
      validationErrors: validation.errors,
      rawText: geminiResult.rawText,
    };

    queue.provider = geminiResult.provider;
    queue.model = geminiResult.model;
    queue.completedAt = new Date();

    await queue.save();

    console.info(
      '[knowledge] research validation failed',
      {
        name,
        errors: validation.errors,
      }
    );

    return {
      queue,
      success: false,
      error: queue.error,
      validationErrors: validation.errors,
    };
  }

  /*
   * Store the research result first.
   */
  queue.status = 'pending_review';
  queue.proposedKnowledge = validation.data;
  queue.researchResult = geminiResult.data;
  queue.rawResponse = {
    rawText: geminiResult.rawText,
  };
  queue.provider = geminiResult.provider;
  queue.model = geminiResult.model;
  queue.error = '';
  queue.completedAt = new Date();

  await queue.save();

  console.info(
    '[knowledge] Gemini research validated',
    {
      name,
      provider: queue.provider,
      model: queue.model,
    }
  );

  /*
   * Automatically synchronize the validated result
   * into IngredientKnowledge.
   */
  try {
    const knowledge = await syncResearchToKnowledge({
      queue,
      data: validation.data,
      existingRecord,
      notes:
        'Automatically synchronized from validated Gemini research.',
    });

    console.info(
      '[knowledge] research synchronized successfully',
      {
        name,
        ingredientKey: knowledge.ingredientKey,
        knowledgeId: String(knowledge._id),
      }
    );

    return {
      queue,
      success: true,
      synchronized: true,
      knowledge,
      proposedKnowledge: validation.data,
    };
  } catch (syncError) {
    /*
     * Research itself succeeded, but knowledge synchronization
     * failed. Keep the research result available for retry.
     */
    queue.status = 'failed';
    queue.error =
      `Knowledge synchronization failed: ${syncError.message}`;

    await queue.save();

    console.error(
      '[knowledge] research synchronization failed',
      {
        name,
        error: syncError.message,
      }
    );

    return {
      queue,
      success: false,
      synchronized: false,
      error: queue.error,
      proposedKnowledge: validation.data,
    };
  }
};

export const queueUnknownsAndMaybeResearch = async (
  unknownNames = [],
  {
    productId = null,
    productContext = null,
  } = {}
) => {
  const queued = await recordUnknownIngredients(
    unknownNames,
    productId
  );

  if (!isAutoResearchEnabled()) {
    return {
      queued,
      researched: [],
    };
  }

  const researched = [];

  for (const item of queued) {
    if (
      item.status === 'research_needed' ||
      item.status === 'failed'
    ) {
      researched.push(
        await runIngredientResearch({
          ingredientName: item.ingredientName,
          productId,
          productContext,
        })
      );
    }
  }

  return {
    queued,
    researched,
  };
};

const changedFieldsBetween = (
  current = {},
  next = {}
) => {
  const keys = [
    'name',
    'inciName',
    'synonyms',
    'cas',
    'functions',
    'primaryFunction',
    'mechanism',
    'evidenceByConcern',
    'skinTypeRelevance',
    'sensitiveSkinAssessment',
    'irritationSensitization',
    'barrierEffects',
    'interactionsFormulation',
    'specialPopulations',
    'marketingClaimsVsScientificEvidence',
    'evidenceLevel',
    'generalFlag',
    'confidence',
    'flagReason',
    'scientificSummary',
    'uncertaintiesResearchGaps',
    'sources',
  ];

  return keys.filter(
    (key) =>
      JSON.stringify(current[key] ?? null) !==
      JSON.stringify(next[key] ?? null)
  );
};

/*
 * Manual approval is retained as a fallback/admin tool.
 * Automatic research synchronization does not remove this
 * functionality from the API.
 */
export const approveIngredientResearch = async (
  queueId,
  {
    userId,
    edits = {},
    notes = '',
  } = {}
) => {
  const queue =
    await IngredientResearch.findById(queueId);

  if (!queue) {
    throw new Error(
      'Research queue item not found.'
    );
  }

  if (queue.status !== 'pending_review') {
    throw new Error(
      'Only pending_review research can be approved.'
    );
  }

  const proposed = {
    ...(queue.proposedKnowledge || {}),
    ...edits,
  };

  const validation =
    validateProposedKnowledge(proposed);

  if (!validation.valid) {
    throw new Error(
      `Cannot approve invalid knowledge: ${validation.errors.join('; ')}`
    );
  }

  const data = {
    ...validation.data,
    researchStatus: 'verified',
    researchProvider: queue.provider,
    researchedAt:
      queue.completedAt || new Date(),
    reviewedBy: userId || null,
    reviewedAt: new Date(),
    origin: queue.isUpdate
      ? 'research_update'
      : 'gemini_research',
    knowledgeBaseVersion:
      KNOWLEDGE_BASE_VERSION,
    isActive: true,
  };

  let knowledge;

  if (
    queue.isUpdate &&
    queue.targetKnowledgeId
  ) {
    knowledge =
      await IngredientKnowledge.findById(
        queue.targetKnowledgeId
      );

    if (!knowledge) {
      throw new Error(
        'Target verified knowledge record was not found.'
      );
    }

    const previous =
      knowledge.toObject();

    const changedFields =
      changedFieldsBetween(
        previous,
        data
      );

    const nextVersion =
      (knowledge.version || 1) + 1;

    knowledge.changeHistory = [
      ...(knowledge.changeHistory || []),
      {
        version: nextVersion,
        previousVersion:
          knowledge.version || 1,
        changedFields,
        reason:
          notes ||
          'Admin approved Gemini proposed update.',
        researchSources: data.sources,
        provider: queue.provider,
        model: queue.model,
        reviewedBy: userId || null,
        reviewedAt: new Date(),
        timestamp: new Date(),
      },
    ];

    knowledge.previousVersion =
      knowledge.version || 1;

    knowledge.version =
      nextVersion;

    Object.assign(
      knowledge,
      data
    );

    await knowledge.save();
  } else {
    const existingKey =
      await IngredientKnowledge.findOne({
        ingredientKey:
          data.ingredientKey,
      });

    if (
      existingKey &&
      existingKey.researchStatus ===
        'verified'
    ) {
      throw new Error(
        'A verified record with this ingredientKey already exists. Use an update review instead of overwriting.'
      );
    }

    knowledge = existingKey
      ? Object.assign(
          existingKey,
          data,
          {
            version: 1,
          }
        )
      : await IngredientKnowledge.create({
          ...data,
          version: 1,
        });

    if (existingKey) {
      await knowledge.save();
    }
  }

  queue.status = 'approved';
  queue.reviewedBy = userId || null;
  queue.reviewedAt = new Date();
  queue.reviewNotes = notes;
  queue.approvedKnowledgeId =
    knowledge._id;

  await queue.save();

  await invalidateExplanationsForKnowledgeBaseChange();

  return {
    queue,
    knowledge,
  };
};

export const rejectIngredientResearch = async (
  queueId,
  {
    userId,
    notes = '',
  } = {}
) => {
  const queue =
    await IngredientResearch.findById(queueId);

  if (!queue) {
    throw new Error(
      'Research queue item not found.'
    );
  }

  queue.status = 'rejected';
  queue.reviewedBy = userId || null;
  queue.reviewedAt = new Date();
  queue.reviewNotes =
    notes || 'Rejected by admin.';

  await queue.save();

  console.info(
    '[knowledge] research rejected',
    {
      id: String(queue._id),
      name: queue.ingredientName,
    }
  );

  return queue;
};

export const updateProposedKnowledge = async (
  queueId,
  edits = {}
) => {
  const queue =
    await IngredientResearch.findById(queueId);

  if (!queue) {
    throw new Error(
      'Research queue item not found.'
    );
  }

  const validation =
    validateProposedKnowledge({
      ...(queue.proposedKnowledge || {}),
      ...edits,
    });

  if (!validation.valid) {
    throw new Error(
      `Invalid proposed knowledge: ${validation.errors.join('; ')}`
    );
  }

  queue.proposedKnowledge =
    validation.data;

  if (queue.status === 'failed') {
    queue.status = 'pending_review';
  }

  await queue.save();

  return queue;
};

export default {
  runIngredientResearch,
  queueUnknownsAndMaybeResearch,
  approveIngredientResearch,
  rejectIngredientResearch,
  updateProposedKnowledge,
  buildIngredientResearchPrompt,
  isAutoResearchEnabled,
};