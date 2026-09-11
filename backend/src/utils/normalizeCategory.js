/**
 * skinDecode
 * ---------------------------------------------------------
 * Canonical product category normalization.
 *
 * Converts category values coming from:
 * - MongoDB ObjectIds
 * - populated Category documents
 * - category codes
 * - category names
 * - slugs
 * - scraper/import aliases
 *
 * into ONE canonical recommendation category name.
 *
 * Example:
 *   "SUNSCREENS"          -> "Sunscreens"
 *   "sunscreen"           -> "Sunscreens"
 *   "sun protection"      -> "Sunscreens"
 *   { code: "SUNSCREENS" } -> "Sunscreens"
 *   { name: "Sunscreens" } -> "Sunscreens"
 *
 * IMPORTANT:
 * Product.category remains a MongoDB ObjectId.
 * This utility only normalizes values for application logic.
 * ---------------------------------------------------------
 */

const RECOMMENDATION_CATEGORIES = [
  'Cleansers',
  'Moisturizers',
  'Sunscreens',
  'Serums',
  'Exfoliants',
  'Toners & Essences',
  'Retinoids & Anti-Aging',
  'Eye Creams & Serums',
  'Face Masks',
  'Facial Oils',
];

const CATEGORY_CODE_MAP = {
  CLEANSERS: 'Cleansers',
  MOISTURIZERS: 'Moisturizers',
  SUNSCREENS: 'Sunscreens',
  SERUMS: 'Serums',
  EXFOLIANTS: 'Exfoliants',
  TONERS_ESSENCES: 'Toners & Essences',
  RETINOIDS_ANTI_AGING: 'Retinoids & Anti-Aging',
  EYE_CREAMS_SERUMS: 'Eye Creams & Serums',
  FACE_MASKS: 'Face Masks',
  FACIAL_OILS: 'Facial Oils',
};

const CATEGORY_ALIASES = {
  Cleansers: [
    'cleanser',
    'cleansers',
    'face cleanser',
    'facial cleanser',
    'face wash',
    'facial wash',
    'cleansing foam',
    'cleansing gel',
    'cleansing oil',
    'cleansing balm',
  ],

  Moisturizers: [
    'moisturizer',
    'moisturizers',
    'moisturiser',
    'moisturisers',
    'face moisturizer',
    'face moisturiser',
    'facial moisturizer',
    'facial moisturiser',
    'cream',
    'hydrating cream',
    'moisturizing cream',
    'moisturising cream',
  ],

  Sunscreens: [
    'sunscreen',
    'sunscreens',
    'sun screen',
    'sun protection',
    'spf',
    'spf sunscreen',
    'sunblock',
    'sun block',
    'uv protection',
  ],

  Serums: [
    'serum',
    'serums',
    'face serum',
    'facial serum',
    'treatment serum',
    'active serum',
  ],

  Exfoliants: [
    'exfoliant',
    'exfoliants',
    'exfoliator',
    'exfoliators',
    'exfoliation',
    'face scrub',
    'facial scrub',
    'scrub',
    'chemical exfoliant',
    'physical exfoliant',
    'aha',
    'bha',
    'pha',
  ],

  'Toners & Essences': [
    'toner',
    'toners',
    'face toner',
    'facial toner',
    'essence',
    'essences',
    'face essence',
    'facial essence',
    'toning lotion',
  ],

  'Retinoids & Anti-Aging': [
    'retinoid',
    'retinoids',
    'retinol',
    'retinal',
    'retinaldehyde',
    'anti aging',
    'anti-aging',
    'anti ageing',
    'anti-ageing',
    'age defense',
    'wrinkle treatment',
    'fine line treatment',
  ],

  'Eye Creams & Serums': [
    'eye cream',
    'eye creams',
    'eye serum',
    'eye serums',
    'under eye cream',
    'under eye serum',
    'eye treatment',
  ],

  'Face Masks': [
    'face mask',
    'face masks',
    'facial mask',
    'facial masks',
    'sheet mask',
    'clay mask',
    'wash off mask',
    'overnight mask',
    'sleeping mask',
  ],

  'Facial Oils': [
    'facial oil',
    'facial oils',
    'face oil',
    'face oils',
    'facial treatment oil',
  ],
};

/**
 * Normalize a value for comparison.
 */
const normalizeCategoryValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
};

/**
 * Normalize any supported category representation.
 *
 * Returns:
 *   Canonical category name
 *   OR null when the category cannot be resolved.
 */
export const normalizeCategory = (category) => {
  if (!category) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * 1. Populated Category document
   * -------------------------------------------------------
   *
   * Preferred source:
   *
   *   category.code
   *
   * Example:
   *
   * {
   *   _id: "...",
   *   code: "SUNSCREENS",
   *   name: "Sunscreens",
   *   slug: "sunscreens"
   * }
   */
  if (
    typeof category === 'object' &&
    category.code
  ) {
    const code =
      String(category.code)
        .trim()
        .toUpperCase();

    const canonical =
      CATEGORY_CODE_MAP[code];

    if (canonical) {
      return canonical;
    }
  }

  /*
   * -------------------------------------------------------
   * 2. Populated Category name
   * -------------------------------------------------------
   */
  const categoryName =
    typeof category === 'object'
      ? category.name
      : category;

  const normalizedName =
    normalizeCategoryValue(categoryName);

  if (normalizedName) {
    const directMatch =
      RECOMMENDATION_CATEGORIES.find(
        (allowedCategory) =>
          normalizeCategoryValue(
            allowedCategory
          ) === normalizedName
      );

    if (directMatch) {
      return directMatch;
    }
  }

  /*
   * -------------------------------------------------------
   * 3. Populated Category slug
   * -------------------------------------------------------
   */
  if (
    typeof category === 'object' &&
    category.slug
  ) {
    const normalizedSlug =
      normalizeCategoryValue(
        category.slug
      );

    const slugMatch =
      RECOMMENDATION_CATEGORIES.find(
        (allowedCategory) =>
          normalizeCategoryValue(
            allowedCategory
          ) === normalizedSlug
      );

    if (slugMatch) {
      return slugMatch;
    }
  }

  /*
   * -------------------------------------------------------
   * 4. Category aliases
   * -------------------------------------------------------
   */
  if (normalizedName) {
    for (
      const [
        canonicalCategory,
        aliases,
      ] of Object.entries(
        CATEGORY_ALIASES
      )
    ) {
      const aliasMatch =
        aliases.some(
          (alias) =>
            normalizeCategoryValue(
              alias
            ) === normalizedName
        );

      if (aliasMatch) {
        return canonicalCategory;
      }
    }
  }

  /*
   * -------------------------------------------------------
   * 5. Unknown category
   * -------------------------------------------------------
   *
   * IMPORTANT:
   * Never invent a category.
   */
  return null;
};

export {
  RECOMMENDATION_CATEGORIES,
  CATEGORY_CODE_MAP,
  CATEGORY_ALIASES,
};

export default normalizeCategory;