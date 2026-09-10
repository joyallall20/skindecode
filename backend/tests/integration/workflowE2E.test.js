import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../../src/models/Product.js';
import ProductOffer from '../../src/models/ProductOffer.js';
import ProductExplanationCache from '../../src/models/ProductExplanationCache.js';
import Retailer from '../../src/models/Retailer.js';
import {
  publishProduct,
  approveProductIntelligence,
  updateProduct,
} from '../../src/controllers/productController.js';
import { createProductOffer } from '../../src/controllers/productOfferController.js';
import { getOrGenerateExplanation } from '../../src/services/explanationCacheService.js';
import { computeCanonicalProfileHash } from '../../src/services/profileCanonicalizationService.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { invokeHandler } from '../helpers/invokeHandler.js';
import {
  createAdminUser,
  createBrandAndCategory,
  createDraftProduct,
  withGeneratedIntelligence,
} from '../helpers/fixtures.js';

const skinProfile = {
  skinType: 'oily',
  sensitivity: 'medium',
  morningSkinFeel: 'slightly-oily',
  responseToNewProducts: 'no-reaction',
  sunscreenHabit: 'sometimes',
  ageRange: '25-34',
  primaryGoal: 'clearer-skin',
  concerns: ['acne'],
  allergies: [],
  avoidedIngredients: [],
  mustHavePreferences: [],
  budget: { min: 0, max: 1500 },
};

describe('workflow integration: publish → offer → explanation cache', () => {
  let admin;

  before(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    admin = await createAdminUser();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('runs end-to-end workflow and reuses explanation cache', async () => {
    const { brand, category } = await createBrandAndCategory();
    let product = await createDraftProduct({ brand, category });
    product = await withGeneratedIntelligence(product, { approved: false });

    const approve = await invokeHandler(approveProductIntelligence, {
      params: { id: product._id.toString() },
      user: admin,
    });
    assert.equal(approve.statusCode, 200);

    const publish = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });
    assert.equal(publish.statusCode, 200);

    const retailer = await Retailer.create({
      name: 'Workflow Retailer',
      slug: `workflow-retailer-${Date.now()}`,
      website: 'https://retailer.example',
    });

    const offerCreate = await invokeHandler(createProductOffer, {
      body: {
        product: product._id.toString(),
        retailer: retailer._id.toString(),
        originalUrl: 'https://retailer.internal/workflow',
        affiliateUrl: 'https://affiliate.example/workflow',
        price: 999,
        linkType: 'affiliate',
        isActive: true,
      },
      user: admin,
    });
    assert.equal(offerCreate.statusCode, 201);

    const populatedProduct = await Product.findById(product._id)
      .populate('brand', 'name')
      .populate('category', 'name')
      .lean();

    const first = await getOrGenerateExplanation({
      product: populatedProduct,
      skinProfile,
      offerPrice: 999,
    });
    assert.equal(first.cacheHit, false);
    assert.ok(first.explanation?.explanation);

    const second = await getOrGenerateExplanation({
      product: populatedProduct,
      skinProfile,
      offerPrice: 999,
    });
    assert.equal(second.cacheHit, true);
    assert.equal(first.explanation.explanation, second.explanation.explanation);

    const offer = await ProductOffer.findOne({ product: product._id });
    offer.price = 1299;
    await offer.save();

    const afterPriceChange = await Product.findById(product._id).lean();
    assert.equal(afterPriceChange.intelligenceStatus, 'approved');
    assert.ok(afterPriceChange.productIntelligence?.explanation);

    const ingredientEdit = await invokeHandler(updateProduct, {
      params: { id: product._id.toString() },
      body: { concerns: ['acne', 'redness'] },
      user: admin,
    });
    assert.equal(ingredientEdit.statusCode, 200);

    const afterIngredientChange = await Product.findById(product._id).lean();
    assert.equal(afterIngredientChange.intelligenceStatus, 'none');
    assert.equal(afterIngredientChange.productIntelligence, undefined);

    const budgetProfile = { ...skinProfile, budget: { min: 0, max: 500 } };
    const budgetHash = computeCanonicalProfileHash(budgetProfile);
    const baseHash = computeCanonicalProfileHash(skinProfile);
    assert.notEqual(budgetHash, baseHash);

    const cacheForBudget = await ProductExplanationCache.findOne({
      product: product._id,
      canonicalProfileHash: budgetHash,
    }).lean();
    assert.equal(cacheForBudget, null);
  });
});
