import { describe, it, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Product from '../src/models/Product.js';
import { uploadProductImage, deleteProductImage } from '../src/controllers/productImageController.js';
import { uploadProductImage as uploadToCloudinary } from '../src/services/cloudinaryService.js';
import { isAllowedImageBuffer, isAllowedImageMimeType } from '../src/utils/productImageValidation.js';
import { normalizeProductImages, mergeIncomingProductImages } from '../src/utils/productImages.js';
import { presentProduct } from '../src/utils/productPresentation.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from './helpers/testDatabase.js';
import { invokeHandler } from './helpers/invokeHandler.js';
import { createAdminUser, createBrandAndCategory, createDraftProduct } from './helpers/fixtures.js';

const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const pdfBuffer = Buffer.from('%PDF-1.4 test file content');

const jpegFile = {
  mimetype: 'image/jpeg',
  originalname: 'product.jpg',
  buffer: jpegBuffer,
};

describe('product image Cloudinary upload', () => {
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

  it('uploads a JPEG for an authenticated admin and saves Cloudinary metadata', async () => {
    const product = await createDraftProduct({ brand, category, overrides: { images: [] } });
    const response = await invokeHandler(uploadProductImage, {
      params: { id: product._id.toString() },
      user: admin,
      file: jpegFile,
      services: {
        uploadProductImage: async () => ({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/skindecode/products/abc.jpg',
          public_id: 'skindecode/products/abc',
        }),
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.data.image.url, 'https://res.cloudinary.com/demo/image/upload/v1/skindecode/products/abc.jpg');
    assert.equal(response.body.data.image.publicId, 'skindecode/products/abc');
    assert.equal(response.body.data.image.isPrimary, true);

    const stored = await Product.findById(product._id).lean();
    assert.equal(stored.images.length, 1);
    assert.equal(stored.images[0].publicId, 'skindecode/products/abc');
    assert.equal(stored.images[0].url, response.body.data.image.url);
  });

  it('rejects non-image files such as PDF content', async () => {
    const product = await createDraftProduct({ brand, category });
    const response = await invokeHandler(uploadProductImage, {
      params: { id: product._id.toString() },
      user: admin,
      file: {
        mimetype: 'application/pdf',
        originalname: 'file.pdf',
        buffer: pdfBuffer,
      },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /allowed image type/i);
  });

  it('rejects disallowed mime types', () => {
    assert.equal(isAllowedImageMimeType('image/jpeg'), true);
    assert.equal(isAllowedImageMimeType('image/png'), true);
    assert.equal(isAllowedImageMimeType('image/webp'), true);
    assert.equal(isAllowedImageMimeType('application/pdf'), false);
    assert.equal(isAllowedImageMimeType('image/svg+xml'), false);
    assert.equal(isAllowedImageMimeType('application/x-msdownload'), false);
    assert.equal(isAllowedImageBuffer(pdfBuffer, 'application/pdf'), false);
    assert.equal(isAllowedImageBuffer(jpegBuffer, 'image/jpeg'), true);
  });

  it('returns a clear error when Cloudinary credentials are missing', async () => {
    const previous = {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    };
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    await assert.rejects(
      () => uploadToCloudinary(jpegFile),
      (error) => {
        assert.equal(error.statusCode, 503);
        assert.match(error.message, /Cloudinary is not configured/i);
        return true;
      }
    );

    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  });

  it('deletes the Cloudinary asset and removes the MongoDB image reference', async () => {
    const product = await createDraftProduct({
      brand,
      category,
      overrides: {
        images: [{
          url: 'https://res.cloudinary.com/demo/image/upload/v1/skindecode/products/abc.jpg',
          publicId: 'skindecode/products/abc',
          isPrimary: true,
        }],
      },
    });
    const stored = await Product.findById(product._id).lean();
    const imageId = String(stored.images[0]._id || stored.images[0].publicId);
    let destroyedPublicId = null;

    const response = await invokeHandler(deleteProductImage, {
      params: { id: product._id.toString(), imageId },
      user: admin,
      services: {
        deleteProductImage: async (publicId) => {
          destroyedPublicId = publicId;
          return { deleted: true, result: 'ok' };
        },
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(destroyedPublicId, 'skindecode/products/abc');
    assert.equal(response.body.data.images.length, 0);

    const remaining = await Product.findById(product._id).lean();
    assert.equal(remaining.images.length, 0);
  });

  it('loads existing empty and legacy string image arrays', async () => {
    const emptyProduct = await createDraftProduct({ brand, category, overrides: { slug: `empty-images-${Date.now()}`, images: [] } });
    const legacyProduct = await Product.create({
      name: 'Legacy Serum',
      slug: `legacy-serum-${Date.now()}`,
      brand: brand._id,
      category: category._id,
      images: ['https://example.com/old.jpg'],
      isActive: false,
    });

    const emptyLoaded = await Product.findById(emptyProduct._id).lean();
    const legacyLoaded = await Product.findById(legacyProduct._id).lean();
    const presented = presentProduct(legacyLoaded, { user: { role: 'user' } });

    assert.deepEqual(emptyLoaded.images, []);
    assert.equal(legacyLoaded.images[0], 'https://example.com/old.jpg');
    assert.equal(presented.images[0].url, 'https://example.com/old.jpg');
    assert.equal(presented.images[0].publicId, '');
    assert.equal(presented.images[0].isPrimary, true);
  });

  it('preserves Cloudinary publicId when admin saves existing image URLs', () => {
    const merged = mergeIncomingProductImages(
      [{ url: 'https://res.cloudinary.com/demo/a.jpg', publicId: 'skindecode/products/a', isPrimary: true }],
      ['https://res.cloudinary.com/demo/a.jpg']
    );
    assert.equal(merged[0].publicId, 'skindecode/products/a');
    assert.equal(normalizeProductImages(['https://example.com/x.jpg'])[0].url, 'https://example.com/x.jpg');
  });
});
