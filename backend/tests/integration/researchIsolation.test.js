import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Ingredient from '../../src/models/Ingredient.js';
import IngredientKnowledge from '../../src/models/IngredientKnowledge.js';
import {
  getVerifiedKnowledgeForIngredients,
  isProductionEligibleKnowledge,
} from '../../src/services/ingredientKnowledgeService.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';

describe('research knowledge production isolation', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('excludes non-verified researchStatus from production knowledge queries', async () => {
    const ingredient = await Ingredient.create({ name: 'Niacinamide' });

    await IngredientKnowledge.create({
      ingredient: ingredient._id,
      researchStatus: 'pending_review',
      generalFlag: 'green',
      evidenceLevel: 'moderate',
      originalResearchText: 'Draft research text',
    });

    await IngredientKnowledge.create({
      ingredient: ingredient._id,
      researchStatus: 'verified',
      generalFlag: 'light_green',
      evidenceLevel: 'moderate',
      originalResearchText: 'Verified research text',
    });

    const verifiedOnly = await getVerifiedKnowledgeForIngredients([ingredient._id]);
    assert.equal(verifiedOnly.length, 1);
    assert.equal(verifiedOnly[0].researchStatus, 'verified');
    assert.equal(isProductionEligibleKnowledge(verifiedOnly[0]), true);

    const pending = await IngredientKnowledge.findOne({ researchStatus: 'pending_review' }).lean();
    assert.equal(isProductionEligibleKnowledge(pending), false);
  });
});
