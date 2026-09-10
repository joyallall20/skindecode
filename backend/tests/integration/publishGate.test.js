import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../../src/models/Product.js';
import {
  publishProduct,
  approveProductIntelligence,
  updateProduct,
} from '../../src/controllers/productController.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { invokeHandler } from '../helpers/invokeHandler.js';
import {
  createAdminUser,
  createBrandAndCategory,
  createDraftProduct,
  withGeneratedIntelligence,
} from '../helpers/fixtures.js';

describe('publish gate controller integration', () => {
  let admin;
  let brand;
  let category;

  before(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    admin = await createAdminUser();
    ({ brand, category } = await createBrandAndCategory());
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  after(async () => {
    await disconnectTestDatabase();
  });

  it('rejects publishing draft product without intelligence', async () => {
    const product = await createDraftProduct({ brand, category, overrides: { isActive: false } });
    const response = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /not been generated/i);
  });

  it('rejects publishing when intelligence is generated but unapproved', async () => {
    const product = await createDraftProduct({ brand, category });
    await withGeneratedIntelligence(product, { approved: false });

    const response = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /not been approved/i);
  });

  it('allows publishing when intelligence is approved', async () => {
    const product = await createDraftProduct({ brand, category });
    await withGeneratedIntelligence(product, { approved: true });

    const response = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.isActive, true);
  });

  it('invalidates approved intelligence after formulation edit and blocks republish', async () => {
    const product = await createDraftProduct({ brand, category });
    await withGeneratedIntelligence(product, { approved: true });

    const publishOk = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });
    assert.equal(publishOk.statusCode, 200);

    const editResponse = await invokeHandler(updateProduct, {
      params: { id: product._id.toString() },
      body: { concerns: ['acne', 'redness'] },
      user: admin,
    });
    assert.equal(editResponse.statusCode, 200);

    const refreshed = await Product.findById(product._id).lean();
    assert.equal(refreshed.intelligenceStatus, 'none');
    assert.equal(refreshed.productIntelligence, undefined);

    const publishBlocked = await invokeHandler(publishProduct, {
      params: { id: product._id.toString() },
      user: admin,
    });
    assert.equal(publishBlocked.statusCode, 400);
    assert.match(publishBlocked.body.message, /not been generated/i);
  });

  it('requires generated intelligence before approval', async () => {
    const product = await createDraftProduct({ brand, category });
    const response = await invokeHandler(approveProductIntelligence, {
      params: { id: product._id.toString() },
      user: admin,
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /Generate intelligence first/i);
  });
});
