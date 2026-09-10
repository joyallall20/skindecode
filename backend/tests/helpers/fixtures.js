import Product from '../../src/models/Product.js';
import Brand from '../../src/models/Brand.js';
import Category from '../../src/models/Category.js';
import User from '../../src/models/User.js';

const sampleIntelligence = () => ({
  explanation: 'Test intelligence explanation for product.',
  skinTypeCompatibility: { oily: 0.8, dry: 0.7, combination: 0.75, normal: 0.8, sensitive: 0.6 },
  sensitivitySuitability: { low: 0.8, medium: 0.7, high: 0.5 },
  concernCompatibility: { acne: 0.8 },
  ingredientAnalysis: [
    {
      ingredient: 'Niacinamide',
      benefits: ['barrier support'],
      relevantConcerns: ['acne'],
      explanation: 'Commonly used active.',
      evidenceLevel: 'known',
    },
  ],
  evidenceConfidence: 0.75,
  qualityAssessment: {
    formulationSignals: ['simple'],
    limitations: ['limited concentration data'],
    ratingBasis: 'Based on disclosed ingredients',
  },
  mustHaveAttributes: {},
});

export const createAdminUser = async () =>
  User.create({
    firebaseUid: 'admin-test-uid',
    email: 'admin@test.local',
    name: 'Admin Tester',
    role: 'admin',
    isActive: true,
  });

export const createInactiveUser = async () =>
  User.create({
    firebaseUid: 'inactive-test-uid',
    email: 'inactive@test.local',
    name: 'Inactive Tester',
    role: 'user',
    isActive: false,
  });

export const createBrandAndCategory = async () => {
  const brand = await Brand.create({ name: 'Test Brand', slug: 'test-brand' });
  const category = await Category.create({ name: 'Serum', slug: 'serum' });
  return { brand, category };
};

export const createDraftProduct = async ({ brand, category, overrides = {} } = {}) => {
  const { brand: resolvedBrand, category: resolvedCategory } = brand && category
    ? { brand, category }
    : await createBrandAndCategory();

  return Product.create({
    name: 'Test Serum',
    slug: `test-serum-${Date.now()}`,
    brand: resolvedBrand._id,
    category: resolvedCategory._id,
    description: 'A test serum',
    ingredients: [],
    keyIngredients: [],
    skinTypes: ['oily'],
    concerns: ['acne'],
    isActive: false,
    intelligenceStatus: 'none',
    ...overrides,
  });
};

export const withGeneratedIntelligence = async (product, { approved = false } = {}) => {
  product.productIntelligence = sampleIntelligence();
  product.intelligenceStatus = approved ? 'approved' : 'generated';
  product.intelligenceMetadata = {
    generatedAt: new Date(),
    intelligenceVersion: '1.0.0',
    promptVersion: '1.0.0',
    knowledgeBaseVersion: '0.0.0',
    provider: 'test',
    model: 'test-model',
  };
  if (approved) {
    product.intelligenceReviewedAt = new Date();
  }
  await product.save();
  return product;
};

export { sampleIntelligence };

export default {
  createAdminUser,
  createInactiveUser,
  createBrandAndCategory,
  createDraftProduct,
  withGeneratedIntelligence,
  sampleIntelligence,
};
