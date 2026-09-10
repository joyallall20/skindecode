import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Brand from '../src/models/Brand.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import {
  isMongoId,
  loadPopulatedProduct,
  resolveBrandId,
} from '../src/services/productCatalogService.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/testDatabase.js';

describe('brand ObjectId references', () => {
  before(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('does not treat a brand name as an ObjectId', () => {
    assert.equal(isMongoId('Raymond'), false);
  });

  it('resolves a brand name like Raymond to a Brand document id', async () => {
    const id = await resolveBrandId('Raymond');
    assert.equal(isMongoId(id), true);
    const brand = await Brand.findById(id).lean();
    assert.equal(brand.name, 'Raymond');
  });

  it('repairs a product whose brand was stored as a name string', async () => {
    const category = await Category.create({ name: 'Serum', slug: 'serum' });
    const productId = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({
      _id: productId,
      name: 'Test Serum',
      slug: `test-serum-${productId.toString().slice(-6)}`,
      brand: 'Raymond',
      category: category._id,
      description: '',
      images: [],
      ingredients: [],
      keyIngredients: [],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loaded = await loadPopulatedProduct(productId);
    assert.ok(loaded);
    assert.equal(loaded.brand.name, 'Raymond');
    assert.equal(isMongoId(loaded.brand._id), true);
  });
});
