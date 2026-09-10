import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import IngredientKnowledge from '../src/models/IngredientKnowledge.js';
import IngredientResearch from '../src/models/IngredientResearch.js';
import {
  DEFAULT_KNOWLEDGE_JSON_PATH,
  findIngredient,
  getKnowledgeForIngredients,
  importIngredientKnowledgeFromJson,
  loadKnowledgeSeedFile,
  recordUnknownIngredients,
} from '../src/services/ingredientKnowledgeService.js';
import {
  approveIngredientResearch,
  runIngredientResearch,
  setIngredientResearchGenerator,
} from '../src/services/ingredientResearchService.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/testDatabase.js';

const jsonPath = DEFAULT_KNOWLEDGE_JSON_PATH;

describe('ingredient knowledge base', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    setIngredientResearchGenerator(null);
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('loads 35 valid records from the seed JSON without modifying the file', async () => {
    const loaded = await loadKnowledgeSeedFile(jsonPath);
    assert.equal(loaded.valid, true);
    assert.equal(loaded.ingredients.length, 35);
    assert.ok(jsonPath.includes('kincare-ingredient-knowledge-base.json'));
    assert.ok(jsonPath.includes(`${path.sep}IntelReport${path.sep}`) || jsonPath.includes('/IntelReport/'));
  });

  it('imports the JSON into MongoDB idempotently', async () => {
    const first = await importIngredientKnowledgeFromJson();
    const second = await importIngredientKnowledgeFromJson();
    const count = await IngredientKnowledge.countDocuments({ ingredientKey: { $exists: true, $ne: '' } });
    assert.equal(first.inserted, 35);
    assert.equal(second.inserted, 0);
    assert.equal(second.skipped, 35);
    assert.equal(count, 35);
  });

  it('matches Salicylic Acid and the BHA synonym', async () => {
    await importIngredientKnowledgeFromJson();
    const byName = await findIngredient('Salicylic Acid');
    const bySynonym = await findIngredient('BHA');
    const byCase = await findIngredient('SALICYLIC ACID');
    assert.equal(byName?.ingredientKey, 'salicylic_acid');
    assert.equal(bySynonym?.ingredientKey, 'salicylic_acid');
    assert.equal(byCase?.ingredientKey, 'salicylic_acid');
  });

  it('queues unknown ingredients as research_needed without inventing knowledge', async () => {
    await importIngredientKnowledgeFromJson();
    const coverage = await getKnowledgeForIngredients(['Completely Fake Ingredientium Xyzzy']);
    assert.equal(coverage.unknown.length, 1);
    assert.equal(coverage.known.length, 0);
    const queued = await recordUnknownIngredients(['Completely Fake Ingredientium Xyzzy']);
    assert.equal(queued[0].status, 'research_needed');
    const invented = await IngredientKnowledge.findOne({ name: /Fake Ingredientium/i });
    assert.equal(invented, null);
  });

  it('stores Gemini research as pending_review and verifies only after approval', async () => {
    setIngredientResearchGenerator(async () => ({
      success: true,
      data: {
        ingredientKey: 'fake_ingredientium_xyzzy',
        name: 'Fake Ingredientium Xyzzy',
        inciName: 'Ingredientium Xyzzy',
        synonyms: [],
        cas: null,
        functions: ['Humectant'],
        primaryFunction: 'Humectant',
        mechanism: 'Unknown mechanism; insufficient evidence.',
        evidenceByConcern: {},
        skinTypeRelevance: {},
        sensitiveSkinAssessment: 'Unknown',
        irritationSensitization: 'Insufficient data',
        barrierEffects: 'Unknown',
        interactionsFormulation: 'Unknown',
        specialPopulations: 'Unknown',
        marketingClaimsVsScientificEvidence: 'No verified claims.',
        evidenceLevel: 'E',
        generalFlag: 'Yellow',
        confidence: 0.2,
        flagReason: 'Insufficient human clinical evidence.',
        scientificSummary: 'No reliable clinical evidence was identified.',
        uncertaintiesResearchGaps: 'No indexed clinical trials were found.',
        sources: [{ title: 'No high-quality source identified', identifier: '', type: 'none', finding: 'Insufficient evidence', limitations: 'No verified citation' }],
      },
      provider: 'gemini',
      model: 'test-model',
      rawText: '{}',
    }));

    const researched = await runIngredientResearch({ ingredientName: 'Fake Ingredientium Xyzzy' });
    assert.equal(researched.success, true);
    assert.equal(researched.queue.status, 'pending_review');
    const before = await findIngredient('Fake Ingredientium Xyzzy');
    assert.equal(before?.researchStatus === 'verified' ? true : Boolean(before && before.researchStatus === 'verified'), false);

    const approved = await approveIngredientResearch(researched.queue._id, { notes: 'Test approval' });
    assert.equal(approved.knowledge.researchStatus, 'verified');
    const after = await findIngredient('Fake Ingredientium Xyzzy');
    assert.equal(after?.researchStatus, 'verified');
  });
});
