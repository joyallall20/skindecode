import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../src/models/Product.js';
import ProductOffer from '../src/models/ProductOffer.js';
import ProductIntelligenceJob from '../src/models/ProductIntelligenceJob.js';
import Brand from '../src/models/Brand.js';
import Category from '../src/models/Category.js';
import { createProduct, updateProduct, generateProductIntelligenceForProduct } from '../src/controllers/productController.js';
import { getProductOffers } from '../src/controllers/productOfferController.js';
import { mergeIncomingProductImages } from '../src/utils/productImages.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/testDatabase.js';
import { invokeHandler } from './helpers/invokeHandler.js';
import { createAdminUser, createBrandAndCategory } from './helpers/fixtures.js';

describe('admin product editor catalog save', () => {
  let admin;

  before(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    admin = await createAdminUser();
    await createBrandAndCategory();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('creates a product from editor fields with multiple purchase options', async () => {
    const response = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Niacinamide Serum',
        brand: 'Minimalist',
        category: 'Serum',
        description: 'A daily serum.',
        skinTypes: ['oily'],
        concerns: ['dark-spots'],
        ingredientListText: 'Aqua, Glycerin, Niacinamide, Zinc PCA',
        ingredients: 'Aqua, Glycerin, Niacinamide, Zinc PCA',
        sourceUrl: 'https://example.com/product/niacinamide',
        images: ['https://example.com/serum.jpg'],
        purchaseOptions: [
          {
            retailer: 'Amazon',
            productUrl: 'https://amazon.in/product/1',
            affiliateUrl: 'https://ekaro.in/amazon-1',
            price: 599,
            currency: 'INR',
            isActive: true,
          },
          {
            retailer: 'Nykaa',
            productUrl: 'https://nykaa.com/product/1',
            affiliateUrl: '',
            price: 549,
            currency: 'INR',
            isActive: false,
          },
        ],
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.name, 'Niacinamide Serum');
    assert.equal(response.body.data.ingredientListText.includes('Zinc PCA'), true);
    assert.equal(response.body.data.isActive, false);
    assert.deepEqual(response.body.data.skinTypes, ['oily']);
    assert.deepEqual(response.body.data.concerns, ['dark-spots']);
    assert.equal(response.body.offers.length, 2);

    const amazon = response.body.offers.find((offer) => offer.retailer.name === 'Amazon');
    const nykaa = response.body.offers.find((offer) => offer.retailer.name === 'Nykaa');
    assert.equal(amazon.price, 599);
    assert.equal(amazon.affiliateUrl, 'https://ekaro.in/amazon-1');
    assert.equal(amazon.isActive, true);
    assert.equal(nykaa.price, 549);
    assert.equal(nykaa.isActive, false);

    const stored = await Product.findById(response.body.data._id).populate('ingredients', 'name');
    assert.ok(stored.ingredients.some((ingredient) => ingredient.name === 'Niacinamide'));
  });

  it('resolves brand and category names and object references during create and update', async () => {
    const brand = await Brand.findOne({ name: 'Test Brand' });
    const category = await Category.findOne({ name: 'Serum' });
    const created = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Reference Input Serum',
        brand: brand.name,
        category: category.name,
      },
    });

    assert.equal(created.statusCode, 201);
    assert.equal(String(created.body.data.brand._id), String(brand._id));
    assert.equal(String(created.body.data.category._id), String(category._id));

    const updated = await invokeHandler(updateProduct, {
      user: admin,
      params: { id: created.body.data._id.toString() },
      body: {
        name: 'Reference Input Serum',
        brand: { _id: brand._id.toString(), name: brand.name },
        category: { _id: category._id.toString(), name: category.name },
      },
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(String(updated.body.data.brand._id), String(brand._id));
    assert.equal(String(updated.body.data.category._id), String(category._id));
  });

  it('accepts raw brand and category ObjectIds during create', async () => {
    const brand = await Brand.findOne({ name: 'Test Brand' });
    const category = await Category.findOne({ name: 'Serum' });
    const created = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'ObjectId Reference Serum',
        brand: brand._id.toString(),
        category: category._id.toString(),
      },
    });

    assert.equal(created.statusCode, 201);
    const stored = await Product.findById(created.body.data._id).lean();
    assert.equal(String(stored.brand), String(brand._id));
    assert.equal(String(stored.category), String(category._id));
  });

  it('returns a clear client error for missing referenced ids', async () => {
    const missingBrandId = new Brand()._id.toString();
    const missingCategoryId = new Category()._id.toString();
    const response = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Missing Reference Serum',
        brand: missingBrandId,
        category: missingCategoryId,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /Brand reference was not found/);
  });

  it('queues intelligence generation without waiting for the provider', async () => {
    const created = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Queued Intelligence Serum',
        brand: 'Test Brand',
        category: 'Serum',
        ingredientListText: 'Aqua, Glycerin',
        ingredients: 'Aqua, Glycerin',
      },
    });

    const response = await invokeHandler(generateProductIntelligenceForProduct, {
      user: admin,
      params: { id: created.body.data._id.toString() },
    });

    assert.equal(response.statusCode, 202);
    assert.equal(response.body.data.status, 'queued');
    const job = await ProductIntelligenceJob.findById(response.body.data.jobId).lean();
    assert.ok(job);
    assert.equal(job.product.toString(), created.body.data._id.toString());
  });

  it('lets an admin see inactive purchase options', async () => {
    const created = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Offer Visibility Serum',
        brand: 'Minimalist',
        category: 'Serum',
        isActive: true,
        purchaseOptions: [{
          retailer: 'Myntra',
          productUrl: 'https://myntra.com/p/1',
          price: 579,
          currency: 'INR',
          isActive: false,
        }],
      },
    });

    const adminView = await invokeHandler(getProductOffers, {
      user: admin,
      params: { productId: created.body.data._id.toString() },
    });
    const customerView = await invokeHandler(getProductOffers, {
      user: null,
      params: { productId: created.body.data._id.toString() },
    });

    assert.equal(adminView.body.data.length, 1);
    assert.equal(customerView.body.data.length, 0);
  });

  it('updates purchase option prices without inventing affiliate URLs', async () => {
    const created = await invokeHandler(createProduct, {
      user: admin,
      body: {
        name: 'Price Edit Serum',
        brand: 'Minimalist',
        category: 'Serum',
        purchaseOptions: [{
          retailer: 'Amazon',
          productUrl: 'https://amazon.in/p/2',
          price: 599,
          currency: 'INR',
          isActive: false,
        }],
      },
    });

    const offerId = created.body.offers[0]._id;
    const updated = await invokeHandler(updateProduct, {
      user: admin,
      params: { id: created.body.data._id.toString() },
      body: {
        name: 'Price Edit Serum',
        brand: 'Minimalist',
        category: 'Serum',
        purchaseOptions: [{
          _id: offerId,
          retailer: 'Amazon',
          productUrl: 'https://amazon.in/p/2',
          affiliateUrl: 'https://ekaro.in/amazon-2',
          price: 579,
          currency: 'INR',
          isActive: true,
        }],
      },
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.offers[0].price, 579);
    assert.equal(updated.body.offers[0].affiliateUrl, 'https://ekaro.in/amazon-2');
    const count = await ProductOffer.countDocuments({ product: created.body.data._id });
    assert.equal(count, 1);
  });

  it('respects an incoming primary image flag when merging', () => {
    const merged = mergeIncomingProductImages(
      [
        { url: 'https://cdn.example/a.jpg', publicId: 'a', isPrimary: true },
        { url: 'https://cdn.example/b.jpg', publicId: 'b', isPrimary: false },
      ],
      [
        { url: 'https://cdn.example/a.jpg', isPrimary: false },
        { url: 'https://cdn.example/b.jpg', isPrimary: true },
      ]
    );
    assert.equal(merged.find((image) => image.url.endsWith('b.jpg')).isPrimary, true);
    assert.equal(merged.find((image) => image.url.endsWith('a.jpg')).isPrimary, false);
    assert.equal(merged.find((image) => image.url.endsWith('a.jpg')).publicId, 'a');
  });
});
