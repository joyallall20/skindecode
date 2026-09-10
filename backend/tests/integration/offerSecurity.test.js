import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../../src/models/Product.js';
import ProductOffer from '../../src/models/ProductOffer.js';
import Retailer from '../../src/models/Retailer.js';
import {
  createProductOffer,
  updateProductOffer,
  getProductOffers,
} from '../../src/controllers/productOfferController.js';
import { trackProductClick } from '../../src/controllers/productClickController.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { invokeHandler } from '../helpers/invokeHandler.js';
import {
  createAdminUser,
  createBrandAndCategory,
  createDraftProduct,
  withGeneratedIntelligence,
} from '../helpers/fixtures.js';

describe('offer security controller integration', () => {
  let admin;
  let product;
  let retailer;

  before(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    admin = await createAdminUser();
    const { brand, category } = await createBrandAndCategory();
    product = await createDraftProduct({ brand, category, overrides: { isActive: true } });
    await withGeneratedIntelligence(product, { approved: true });
    retailer = await Retailer.create({
      name: 'Test Retailer',
      slug: `retailer-${Date.now()}`,
      website: 'https://retailer.example',
    });
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('rejects activating offer without affiliateUrl', async () => {
    const created = await invokeHandler(createProductOffer, {
      body: {
        product: product._id.toString(),
        retailer: retailer._id.toString(),
        originalUrl: 'https://retailer.example/p/1',
        price: 999,
        linkType: 'direct',
      },
      user: admin,
    });
    assert.equal(created.statusCode, 201);
    const offerId = created.body.data._id;

    const activation = await invokeHandler(updateProductOffer, {
      params: { id: offerId },
      body: { isActive: true, linkType: 'affiliate' },
      user: admin,
    });

    assert.equal(activation.statusCode, 400);
    assert.match(activation.body.message, /affiliate URL/i);
  });

  it('rejects direct linkType activation even with isActive true', async () => {
    const created = await ProductOffer.create({
      product: product._id,
      retailer: retailer._id,
      url: 'https://retailer.internal/p/1',
      originalUrl: 'https://retailer.internal/p/1',
      affiliateUrl: null,
      linkType: 'direct',
      price: 999,
      isActive: false,
    });

    const activation = await invokeHandler(updateProductOffer, {
      params: { id: created._id.toString() },
      body: { isActive: true },
      user: admin,
    });

    assert.equal(activation.statusCode, 400);
  });

  it('customer offer API never exposes originalUrl', async () => {
    const offer = await ProductOffer.create({
      product: product._id,
      retailer: retailer._id,
      url: 'https://affiliate.example/p/1',
      originalUrl: 'https://retailer.internal/p/1',
      affiliateUrl: 'https://affiliate.example/p/1',
      linkType: 'affiliate',
      price: 999,
      isActive: true,
    });

    const response = await invokeHandler(getProductOffers, {
      params: { productId: product._id.toString() },
      user: null,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].url, 'https://affiliate.example/p/1');
    assert.equal(response.body.data[0].originalUrl, undefined);
    assert.notEqual(response.body.data[0].url, offer.originalUrl);
  });

  it('click tracking rejects inactive and direct offers', async () => {
    const directRetailer = await Retailer.create({
      name: 'Direct Retailer',
      slug: `direct-retailer-${Date.now()}`,
      website: 'https://direct.example',
    });

    const directOffer = await ProductOffer.create({
      product: product._id,
      retailer: directRetailer._id,
      url: 'https://retailer.internal/p/2',
      originalUrl: 'https://retailer.internal/p/2',
      linkType: 'direct',
      price: 999,
      isActive: true,
    });

    const directClick = await invokeHandler(trackProductClick, {
      body: {
        product: product._id.toString(),
        productOffer: directOffer._id.toString(),
      },
    });
    assert.equal(directClick.statusCode, 400);

    const affiliateRetailer = await Retailer.create({
      name: 'Affiliate Retailer',
      slug: `affiliate-retailer-${Date.now()}`,
      website: 'https://affiliate-retailer.example',
    });

    const affiliateOffer = await ProductOffer.create({
      product: product._id,
      retailer: affiliateRetailer._id,
      url: 'https://affiliate.example/p/3',
      originalUrl: 'https://retailer.internal/p/3',
      affiliateUrl: 'https://affiliate.example/p/3',
      linkType: 'affiliate',
      price: 1099,
      isActive: false,
    });

    const inactiveClick = await invokeHandler(trackProductClick, {
      body: {
        product: product._id.toString(),
        productOffer: affiliateOffer._id.toString(),
      },
    });
    assert.equal(inactiveClick.statusCode, 400);
  });

  it('offer price update does not invalidate product intelligence', async () => {
    const offer = await ProductOffer.create({
      product: product._id,
      retailer: retailer._id,
      url: 'https://affiliate.example/p/4',
      originalUrl: 'https://retailer.internal/p/4',
      affiliateUrl: 'https://affiliate.example/p/4',
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
