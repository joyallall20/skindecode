import { parseIngredientList } from './ingredientList.js';

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitizeString(entry)).filter(Boolean);
};

const resolveImageUrls = (images = []) => {
  if (!Array.isArray(images)) return [];
  return images
    .map((entry) => {
      if (typeof entry === 'string') return sanitizeString(entry);
      return sanitizeString(entry?.url || entry?.secure_url);
    })
    .filter(Boolean);
};

const resolveIngredientNames = (ingredients = []) =>
  ingredients
    .map((entry) => {
      if (typeof entry === 'string') return sanitizeString(entry);
      return sanitizeString(entry?.name);
    })
    .filter(Boolean);

export const buildIntelligenceInputFromExtractedData = (extractedData = {}) => ({
  name: sanitizeString(extractedData.name),
  brand: sanitizeString(extractedData.brand),
  category: sanitizeString(extractedData.category),
  description: sanitizeString(extractedData.description),
  images: resolveImageUrls(extractedData.images),
  ingredients: sanitizeStringArray(extractedData.ingredients),
  keyIngredients: sanitizeStringArray(extractedData.keyIngredients),
  skinTypes: sanitizeStringArray(extractedData.skinTypes),
  concerns: sanitizeStringArray(extractedData.concerns),
  fragranceFree: extractedData.fragranceFree ?? null,
  alcoholFree: extractedData.alcoholFree ?? null,
  essentialOilFree: extractedData.essentialOilFree ?? null,
  pregnancyFriendly: extractedData.pregnancyFriendly ?? null,
});

export const buildIntelligenceInputFromProduct = (product = {}) => {
  const brandName = typeof product.brand === 'object' && product.brand !== null
    ? sanitizeString(product.brand.name)
    : sanitizeString(product.brand);

  const categoryName = typeof product.category === 'object' && product.category !== null
    ? sanitizeString(product.category.name)
    : sanitizeString(product.category);

  const ingredientNames = resolveIngredientNames(product.ingredients);
  const fallbackIngredients = parseIngredientList(product.ingredientListText);

  return {
    name: sanitizeString(product.name),
    brand: brandName,
    category: categoryName,
    description: sanitizeString(product.description),
    images: resolveImageUrls(product.images),
    ingredients: ingredientNames.length ? ingredientNames : fallbackIngredients,
    keyIngredients: resolveIngredientNames(product.keyIngredients),
    skinTypes: sanitizeStringArray(product.skinTypes),
    concerns: sanitizeStringArray(product.concerns),
    fragranceFree: product.fragranceFree ?? null,
    alcoholFree: product.alcoholFree ?? null,
    essentialOilFree: product.essentialOilFree ?? null,
    pregnancyFriendly: product.pregnancyFriendly ?? null,
    productIntelligence: product.productIntelligence || undefined,
  };
};

export default {
  buildIntelligenceInputFromExtractedData,
  buildIntelligenceInputFromProduct,
};
