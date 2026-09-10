export const PRODUCT_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    brand: { type: 'string' },
    price: { type: 'number', nullable: true },
    category: { type: 'string' },
    variant: { type: 'string' },
    keyIngredients: { type: 'array', items: { type: 'string' } },
    skinTypes: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'brand', 'category'],
};

/** @deprecated Use PRODUCT_EXTRACTION_SCHEMA — kept for Gemini fallback compatibility */
export const PRODUCT_EXTRACTION_GEMINI_SCHEMA = PRODUCT_EXTRACTION_SCHEMA;

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const sanitizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => sanitizeString(entry)).filter(Boolean);
};
const sanitizeNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const createEmptyExtractedData = () => ({
  name: '',
  brand: '',
  category: '',
  description: '',
  variant: '',
  size: '',
  quantity: '',
  claims: [],
  images: [],
  ingredients: [],
  keyIngredients: [],
  ingredientSource: null,
  ingredientConfidence: null,
  skinTypes: [],
  concerns: [],
  fragranceFree: null,
  alcoholFree: null,
  essentialOilFree: null,
  pregnancyFriendly: null,
  price: null,
  currency: 'INR',
  inStock: null,
  retailer: '',
  sku: '',
  upc: '',
  ean: '',
  gtin: '',
  mpn: '',
  retailerProductId: '',
});

export const mapExtractionAliases = (payload = {}) => ({
  ...payload,
  name: payload.name || payload.productName || payload.canonicalName || '',
});

export const normalizeExtractedProductData = (payload = {}) => {
  const mapped = mapExtractionAliases(payload);
  const keyIngredients = sanitizeStringArray(payload.keyIngredients);
  const skinTypes = sanitizeStringArray(payload.skinTypes);
  const concerns = sanitizeStringArray(payload.concerns);
  return {
    ...createEmptyExtractedData(),
    name: sanitizeString(mapped.name),
    brand: sanitizeString(payload.brand),
    category: sanitizeString(payload.category),
    variant: sanitizeString(payload.variant),
    keyIngredients,
    skinTypes,
    concerns,
    ingredients: [],
    price: sanitizeNullableNumber(payload.price),
  };
};

export const validateExtractedProductData = (payload) => {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Extracted product data must be an object.'];
  }
  const mapped = mapExtractionAliases(payload);
  if (!sanitizeString(mapped.name)) errors.push('Product name is required.');
  if (!sanitizeString(payload.brand)) errors.push('Brand is required.');
  if (!sanitizeString(payload.category)) errors.push('Category is required.');
  if (payload.keyIngredients !== undefined && payload.keyIngredients !== null && !Array.isArray(payload.keyIngredients)) {
    errors.push('keyIngredients must be an array of strings.');
  }
  if (payload.skinTypes !== undefined && payload.skinTypes !== null && !Array.isArray(payload.skinTypes)) {
    errors.push('skinTypes must be an array of strings.');
  }
  if (payload.concerns !== undefined && payload.concerns !== null && !Array.isArray(payload.concerns)) {
    errors.push('concerns must be an array of strings.');
  }
  if (payload.price !== undefined && payload.price !== null && payload.price !== '' && !Number.isFinite(Number(payload.price))) {
    errors.push('price must be a number.');
  }
  return errors;
};

export default {
  PRODUCT_EXTRACTION_SCHEMA,
  PRODUCT_EXTRACTION_GEMINI_SCHEMA,
  createEmptyExtractedData,
  mapExtractionAliases,
  normalizeExtractedProductData,
  validateExtractedProductData,
};
