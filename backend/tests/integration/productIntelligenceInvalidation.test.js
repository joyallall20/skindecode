import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../../src/models/Product.js';
import ProductOffer from '../../src/models/ProductOffer.js';
import ProductExplanationCache from '../../src/models/ProductExplanationCache.js';
import Retailer from '../../src/models/Retailer.js';
import {
  hasIntelligenceRelevantProductChanges,
  invalidateProductIntelligenceState,
} from '../../src/services/productIntelligenceInvalidationService.js';
import { updateProduct } from '../../src/controllers/productController.js';
import { updateProductOffer } from '../../src/controllers/productOfferController.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { invokeHandler } from '../helpers/invokeHandler.js';
import {
  createAdminUser,
  createBrandAndCategory,
  createDraftProduct,
  withGeneratedIntelligence,
} from '../helpers/fixtures.js';

describe('product intelligence invalidation', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('detects ingredient changes as intelligence-relevant', () => {
    const changed = hasIntelligenceRelevantProductChanges(
      { ingredients: ['a'] },
      { ingredients: ['a', 'b'] }
    );
    assert.equal(changed, true);
  });

  it('does not treat qualityScore changes as intelligence-relevant', () => {
    const changed = hasIntelligenceRelevantProductChanges(
      { qualityScore: 7 },
      { qualityScore: 9 }
    );
    assert.equal(changed, false);
  });

  it('clears intelligence, revokes approval, and stales explanation caches', async () => {
    const admin = await createAdminUser();
    const { brand, category } = await createBrandAndCategory();
    const product = await createDraftProduct({ brand, category });
    await withGeneratedIntelligence(product, { approved: true });

    await ProductExplanationCache.create({
      product: product._id,
      canonicalProfileHash: 'hash-1',
      explanation: 'cached',
      validationStatus: 'pass',
      status: 'valid',
    });

    await invalidateProductIntelligenceState(product._id, 'test');

    const refreshed = await Product.findById(product._id).lean();
    assert.equal(refreshed.intelligenceStatus, 'none');
    assert.equal(refreshed.productIntelligence, undefined);
    assert.equal(refreshed.intelligenceMetadata, undefined);

    const cache = await ProductExplanationCache.findOne({ product: product._id }).lean();
    assert.equal(cache.status, 'stale');

    const response = await invokeHandler(updateProduct, {
      params: { id: product._id.toString() },
      body: { concerns: ['acne', 'redness'] },
      user: admin,
    });

    assert.equal(response.statusCode, 200);
    const updated = await Product.findById(product._id).lean();
    assert.equal(updated.intelligenceStatus, 'none');
    assert.equal(updated.productIntelligence, undefined);
  });

  it('offer price updates do not invalidate product intelligence', async () => {
    const admin = await createAdminUser();
    const { brand, category } = await createBrandAndCategory();
    const product = await createDraftProduct({ brand, category });
    await withGeneratedIntelligence(product, { approved: true });

    const retailer = await Retailer.create({
      name: 'Price Retailer',
      slug: `price-retailer-${Date.now()}`,
      website: 'https://retailer.example',
    });

    const offer = await ProductOffer.create({
      product: product._id,
      retailer: retailer._id,
      url: 'https://affiliate.example/p/price',
      originalUrl: 'https://retailer.internal/p/price',
      affiliateUrl: 'https://affiliate.example/p/price',
      linkType: 'affiliate',
      price: 999,
      isActive: true,
    });

    const priceUpdate = await invokeHandler(updateProductOffer, {
      params: { id: offer._id.toString() },
      body: { price: 1499 },
      user: admin,
    });
    assert.equal(priceUpdate.statusCode, 200);

    const refreshed = await Product.findById(product._id).lean();
    assert.equal(refreshed.intelligenceStatus, 'approved');
    assert.ok(refreshed.productIntelligence?.explanation);
  });
});
