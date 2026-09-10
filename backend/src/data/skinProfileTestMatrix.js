/**
 * Canonical SkinProfile enum values for systematic test coverage.
 * Every valid enum value is represented; "unknown" states are included.
 */

export const SKIN_TYPE_VALUES = ['oily', 'dry', 'combination', 'normal', 'unknown'];

export const SENSITIVITY_VALUES = ['low', 'medium', 'high', 'unknown'];

export const MORNING_SKIN_FEEL_VALUES = [
  'dry', 'balanced', 'slightly-oily', 'very-oily', 'combination-feel', 'unknown',
];

export const RESPONSE_TO_NEW_PRODUCTS_VALUES = [
  'no-reaction', 'sometimes-irritated', 'often-irritated', 'very-easily-irritated', 'unknown',
];

export const SUNSCREEN_HABIT_VALUES = ['every-day', 'sometimes', 'rarely-never', 'unknown'];

export const AGE_RANGE_VALUES = ['under-18', '18-24', '25-34', '35-44', '45-plus', 'unknown'];

export const PRIMARY_GOAL_VALUES = [
  'clearer-skin', 'brighter-even', 'hydration', 'smoother-texture',
  'less-oiliness', 'anti-aging', 'healthier-skin', 'unknown',
];

export const CONCERN_VALUES = [
  'acne', 'pigmentation', 'dark-spots', 'dryness', 'excess-oil', 'aging',
  'fine-lines', 'uneven-texture', 'dullness', 'redness', 'dark-circles',
  'dehydration', 'large-pores', 'sun-damage',
];

export const CURRENT_PRODUCT_VALUES = [
  'cleanser', 'moisturizer', 'sunscreen', 'serum', 'exfoliant',
  'treatment', 'eye-cream', 'none',
];

export const MUST_HAVE_PREFERENCE_VALUES = [
  'cruelty-free', 'vegan', 'fragrance-free', 'reef-safe', 'no-specific-preference',
];

/** Single-dimension coverage: one profile per enum value */
export const buildSingleDimensionProfiles = () => {
  const profiles = [];

  SKIN_TYPE_VALUES.forEach((skinType) => {
    profiles.push({
      id: `skinType-${skinType}`,
      category: 'single-dimension',
      dimension: 'skinType',
      value: skinType,
      profile: { skinType },
    });
  });

  SENSITIVITY_VALUES.forEach((sensitivity) => {
    profiles.push({
      id: `sensitivity-${sensitivity}`,
      category: 'single-dimension',
      dimension: 'sensitivity',
      value: sensitivity,
      profile: { sensitivity },
    });
  });

  MORNING_SKIN_FEEL_VALUES.forEach((morningSkinFeel) => {
    profiles.push({
      id: `morningSkinFeel-${morningSkinFeel}`,
      category: 'single-dimension',
      dimension: 'morningSkinFeel',
      value: morningSkinFeel,
      profile: { morningSkinFeel },
    });
  });

  RESPONSE_TO_NEW_PRODUCTS_VALUES.forEach((responseToNewProducts) => {
    profiles.push({
      id: `responseToNewProducts-${responseToNewProducts}`,
      category: 'single-dimension',
      dimension: 'responseToNewProducts',
      value: responseToNewProducts,
      profile: { responseToNewProducts },
    });
  });

  SUNSCREEN_HABIT_VALUES.forEach((sunscreenHabit) => {
    profiles.push({
      id: `sunscreenHabit-${sunscreenHabit}`,
      category: 'single-dimension',
      dimension: 'sunscreenHabit',
      value: sunscreenHabit,
      profile: { sunscreenHabit },
    });
  });

  AGE_RANGE_VALUES.forEach((ageRange) => {
    profiles.push({
      id: `ageRange-${ageRange}`,
      category: 'single-dimension',
      dimension: 'ageRange',
      value: ageRange,
      profile: { ageRange },
    });
  });

  PRIMARY_GOAL_VALUES.forEach((primaryGoal) => {
    profiles.push({
      id: `primaryGoal-${primaryGoal}`,
      category: 'single-dimension',
      dimension: 'primaryGoal',
      value: primaryGoal,
      profile: { primaryGoal },
    });
  });

  CONCERN_VALUES.forEach((concern) => {
    profiles.push({
      id: `concern-${concern}`,
      category: 'single-dimension',
      dimension: 'concerns',
      value: concern,
      profile: { concerns: [concern] },
    });
  });

  CURRENT_PRODUCT_VALUES.forEach((product) => {
    profiles.push({
      id: `currentProduct-${product}`,
      category: 'single-dimension',
      dimension: 'currentProducts',
      value: product,
      profile: { currentProducts: [product] },
    });
  });

  MUST_HAVE_PREFERENCE_VALUES.forEach((pref) => {
    profiles.push({
      id: `mustHave-${pref}`,
      category: 'single-dimension',
      dimension: 'mustHavePreferences',
      value: pref,
      profile: { mustHavePreferences: [pref] },
    });
  });

  return profiles;
};

/** Pairwise coverage across clinically relevant dimensions */
export const PAIRWISE_PROFILE_COMBINATIONS = [
  { id: 'pair-oily-low', skinType: 'oily', sensitivity: 'low' },
  { id: 'pair-oily-high', skinType: 'oily', sensitivity: 'high' },
  { id: 'pair-dry-low', skinType: 'dry', sensitivity: 'low' },
  { id: 'pair-dry-high', skinType: 'dry', sensitivity: 'high' },
  { id: 'pair-combination-medium', skinType: 'combination', sensitivity: 'medium' },
  { id: 'pair-combination-high', skinType: 'combination', sensitivity: 'high' },
  { id: 'pair-normal-low', skinType: 'normal', sensitivity: 'low' },
  { id: 'pair-normal-high', skinType: 'normal', sensitivity: 'high' },
  { id: 'pair-oily-acne', skinType: 'oily', concerns: ['acne', 'excess-oil'] },
  { id: 'pair-dry-dehydration', skinType: 'dry', concerns: ['dryness', 'dehydration'] },
  { id: 'pair-sensitive-redness', skinType: 'combination', sensitivity: 'high', concerns: ['redness'] },
  { id: 'pair-aging-dry', skinType: 'dry', concerns: ['aging', 'fine-lines'], primaryGoal: 'anti-aging' },
  { id: 'pair-pigmentation-sensitive', skinType: 'normal', sensitivity: 'high', concerns: ['pigmentation', 'dark-spots'] },
  { id: 'pair-acne-sensitive', skinType: 'oily', sensitivity: 'high', concerns: ['acne'], responseToNewProducts: 'very-easily-irritated' },
  { id: 'pair-fragrance-free-pref', mustHavePreferences: ['fragrance-free'], sensitivity: 'high' },
  { id: 'pair-vegan-pref', mustHavePreferences: ['vegan'] },
  { id: 'pair-under18-acne', ageRange: 'under-18', concerns: ['acne'], primaryGoal: 'clearer-skin' },
];

/** Safety-critical and conflict combinations */
export const SAFETY_CRITICAL_PROFILES = [
  {
    id: 'safety-oily-high-sensitivity',
    label: 'oily + high sensitivity',
    profile: { skinType: 'oily', sensitivity: 'high', responseToNewProducts: 'often-irritated' },
    expectedBehavior: 'Should flag irritation risk; penalize harsh actives',
  },
  {
    id: 'safety-dry-high-sensitivity',
    label: 'dry + high sensitivity',
    profile: { skinType: 'dry', sensitivity: 'high', concerns: ['dryness', 'redness'] },
    expectedBehavior: 'Should favor gentle hydration; flag stripping ingredients',
  },
  {
    id: 'safety-acne-redness',
    label: 'acne + redness',
    profile: { skinType: 'combination', concerns: ['acne', 'redness'], sensitivity: 'medium' },
    expectedBehavior: 'Should recognize conflicting treatment needs',
  },
  {
    id: 'safety-acne-dryness',
    label: 'acne + dryness',
    profile: { skinType: 'combination', concerns: ['acne', 'dryness'] },
    expectedBehavior: 'Should balance oil control with hydration needs',
  },
  {
    id: 'safety-excess-oil-dehydration',
    label: 'excess-oil + dehydration',
    profile: { skinType: 'oily', concerns: ['excess-oil', 'dehydration'], morningSkinFeel: 'very-oily' },
    expectedBehavior: 'Should distinguish oiliness from dehydration',
  },
  {
    id: 'safety-multiple-concerns',
    label: 'multiple concerns',
    profile: { concerns: ['acne', 'pigmentation', 'aging', 'redness', 'dryness'] },
    expectedBehavior: 'Should handle multi-concern profile without overconfidence',
  },
  {
    id: 'safety-allergy-fragrance',
    label: 'fragrance allergy',
    profile: { allergies: ['fragrance', 'parfum'], sensitivity: 'high' },
    expectedBehavior: 'Should hard-exclude products with fragrance ingredients',
  },
  {
    id: 'safety-avoided-retinol',
    label: 'avoided retinol',
    profile: { avoidedIngredients: ['retinol'], concerns: ['aging'] },
    expectedBehavior: 'Should exclude or penalize retinol-containing products',
  },
  {
    id: 'safety-fragrance-free-pref-fragranced',
    label: 'fragrance-free preference',
    profile: { mustHavePreferences: ['fragrance-free'], sensitivity: 'medium' },
    expectedBehavior: 'Should penalize non-fragrance-free products',
  },
  {
    id: 'safety-vegan-pref',
    label: 'vegan preference',
    profile: { mustHavePreferences: ['vegan'] },
    expectedBehavior: 'Should check mustHaveAttributes.vegan on product',
  },
  {
    id: 'safety-under18-active',
    label: 'under-18 profile',
    profile: { ageRange: 'under-18', concerns: ['acne'], primaryGoal: 'clearer-skin' },
    expectedBehavior: 'Age stored but not currently used in scoring — documents limitation',
  },
  {
    id: 'safety-very-easily-irritated',
    label: 'very easily irritated + actives',
    profile: { responseToNewProducts: 'very-easily-irritated', sensitivity: 'high', concerns: ['acne'] },
    expectedBehavior: 'Should bonus fragrance/alcohol/EO-free products',
  },
];

/** Boundary cases */
export const BOUNDARY_PROFILES = [
  { id: 'boundary-empty', label: 'empty profile', profile: {} },
  { id: 'boundary-all-unknown', label: 'all unknown', profile: { skinType: 'unknown', sensitivity: 'unknown', primaryGoal: 'unknown', ageRange: 'unknown' } },
  { id: 'boundary-all-concerns', label: 'all concerns selected', profile: { concerns: [...CONCERN_VALUES] } },
  { id: 'boundary-all-current-products', label: 'full routine', profile: { currentProducts: CURRENT_PRODUCT_VALUES.filter((p) => p !== 'none') } },
  { id: 'boundary-empty-arrays', label: 'explicit empty arrays', profile: { concerns: [], allergies: [], avoidedIngredients: [], mustHavePreferences: [], currentProducts: [] } },
];

/** Representative product fixtures for cross-profile testing */
export const REPRESENTATIVE_PRODUCT_FIXTURES = [
  {
    id: 'product-single-ingredient-niacinamide',
    label: 'Niacinamide serum',
    product: {
      name: 'Niacinamide 10% Serum',
      brand: { name: 'TestBrand' },
      category: { name: 'Serum' },
      ingredients: [{ name: 'Niacinamide' }, { name: 'Hyaluronic Acid' }, { name: 'Water' }],
      keyIngredients: [{ name: 'Niacinamide' }],
      skinTypes: ['oily', 'combination'],
      concerns: ['acne', 'large-pores'],
      fragranceFree: true,
      alcoholFree: true,
      essentialOilFree: true,
      productIntelligence: {
        skinTypeCompatibility: { oily: 0.85, dry: 0.5, combination: 0.8, normal: 0.7, sensitive: 0.6 },
        sensitivitySuitability: { low: 0.8, medium: 0.7, high: 0.55 },
        concernCompatibility: { acne: 0.85, 'large-pores': 0.75 },
        ingredientAnalysis: [{ ingredient: 'Niacinamide', benefits: ['oil control'], relevantConcerns: ['acne'], explanation: 'Known active', evidenceLevel: 'known' }],
        evidenceConfidence: 0.75,
        explanation: 'Niacinamide-focused serum',
        qualityAssessment: { formulationSignals: ['simple'], limitations: ['no concentration verified'], ratingBasis: 'Based on disclosed ingredients' },
        mustHaveAttributes: { 'fragrance-free': true },
      },
    },
  },
  {
    id: 'product-fragranced-alcohol',
    label: 'Fragranced toner with alcohol',
    product: {
      name: 'Refreshing Toner',
      brand: { name: 'TestBrand' },
      category: { name: 'Toner' },
      ingredients: [{ name: 'Alcohol Denat' }, { name: 'Fragrance' }, { name: 'Witch Hazel' }],
      skinTypes: ['oily'],
      concerns: ['excess-oil'],
      fragranceFree: false,
      alcoholFree: false,
      essentialOilFree: false,
      productIntelligence: {
        skinTypeCompatibility: { oily: 0.7, dry: 0.2, combination: 0.5, normal: 0.4, sensitive: 0.15 },
        sensitivitySuitability: { low: 0.6, medium: 0.35, high: 0.1 },
        concernCompatibility: { 'excess-oil': 0.7 },
        ingredientAnalysis: [{ ingredient: 'Alcohol Denat', benefits: [], relevantConcerns: ['excess-oil'], potentialSensitivityConcern: 'May cause dryness', explanation: 'Astringent', evidenceLevel: 'known' }],
        evidenceConfidence: 0.6,
        explanation: 'Astringent toner',
        qualityAssessment: { formulationSignals: ['alcohol-based'], limitations: ['fragrance present'], ratingBasis: 'Based on disclosed ingredients' },
        mustHaveAttributes: {},
      },
    },
  },
  {
    id: 'product-incomplete-ingredients',
    label: 'Incomplete ingredient list',
    product: {
      name: 'Mystery Cream',
      brand: { name: 'Unknown' },
      category: { name: 'Moisturizer' },
      ingredients: [],
      skinTypes: [],
      concerns: [],
      fragranceFree: null,
      alcoholFree: null,
      productIntelligence: {
        skinTypeCompatibility: { oily: 0.3, dry: 0.3, combination: 0.3, normal: 0.3, sensitive: 0.2 },
        sensitivitySuitability: { low: 0.3, medium: 0.25, high: 0.15 },
        concernCompatibility: {},
        ingredientAnalysis: [],
        evidenceConfidence: 0.1,
        explanation: 'Insufficient data',
        qualityAssessment: { formulationSignals: [], limitations: ['no ingredients'], ratingBasis: 'Based on disclosed ingredients' },
        mustHaveAttributes: {},
      },
    },
  },
  {
    id: 'product-retinol-night',
    label: 'Retinol night cream',
    product: {
      name: 'Retinol Night Cream',
      brand: { name: 'TestBrand' },
      category: { name: 'Moisturizer' },
      ingredients: [{ name: 'Retinol' }, { name: 'Squalane' }, { name: 'Ceramide NP' }],
      keyIngredients: [{ name: 'Retinol' }],
      skinTypes: ['normal', 'dry'],
      concerns: ['aging', 'fine-lines'],
      fragranceFree: true,
      alcoholFree: true,
      pregnancyFriendly: false,
      productIntelligence: {
        skinTypeCompatibility: { oily: 0.5, dry: 0.75, combination: 0.6, normal: 0.8, sensitive: 0.3 },
        sensitivitySuitability: { low: 0.75, medium: 0.5, high: 0.2 },
        concernCompatibility: { aging: 0.85, 'fine-lines': 0.8 },
        ingredientAnalysis: [{ ingredient: 'Retinol', benefits: ['cell turnover'], relevantConcerns: ['aging'], potentialSensitivityConcern: 'Irritation risk', explanation: 'Active retinoid', evidenceLevel: 'evidence-backed' }],
        evidenceConfidence: 0.8,
        explanation: 'Retinol anti-aging cream',
        qualityAssessment: { formulationSignals: ['active retinoid'], limitations: ['not for sensitive skin'], ratingBasis: 'Based on disclosed ingredients' },
        mustHaveAttributes: { 'fragrance-free': true },
      },
    },
  },
];

export const getFullTestMatrix = () => {
  const singleDimension = buildSingleDimensionProfiles();
  const pairwise = PAIRWISE_PROFILE_COMBINATIONS.map((entry) => ({
    id: entry.id,
    category: 'pairwise',
    profile: entry,
  }));

  const safety = SAFETY_CRITICAL_PROFILES.map((entry) => ({
    id: entry.id,
    category: 'safety-critical',
    label: entry.label,
    profile: entry.profile,
    expectedBehavior: entry.expectedBehavior,
  }));

  const boundary = BOUNDARY_PROFILES.map((entry) => ({
    id: entry.id,
    category: 'boundary',
    label: entry.label,
    profile: entry.profile,
  }));

  return {
    coverage: {
      singleDimensionCount: singleDimension.length,
      pairwiseCount: pairwise.length,
      safetyCriticalCount: safety.length,
      boundaryCount: boundary.length,
      productFixtureCount: REPRESENTATIVE_PRODUCT_FIXTURES.length,
      enumCoverage: {
        skinType: '100%',
        sensitivity: '100%',
        morningSkinFeel: '100%',
        responseToNewProducts: '100%',
        sunscreenHabit: '100%',
        ageRange: '100%',
        primaryGoal: '100%',
        concerns: '100% individual values',
        currentProducts: '100% individual values',
        mustHavePreferences: '100% individual values',
      },
    },
    profiles: [...singleDimension, ...pairwise, ...safety, ...boundary],
    productFixtures: REPRESENTATIVE_PRODUCT_FIXTURES,
    enumDefinitions: {
      skinType: SKIN_TYPE_VALUES,
      sensitivity: SENSITIVITY_VALUES,
      morningSkinFeel: MORNING_SKIN_FEEL_VALUES,
      responseToNewProducts: RESPONSE_TO_NEW_PRODUCTS_VALUES,
      sunscreenHabit: SUNSCREEN_HABIT_VALUES,
      ageRange: AGE_RANGE_VALUES,
      primaryGoal: PRIMARY_GOAL_VALUES,
      concerns: CONCERN_VALUES,
      currentProducts: CURRENT_PRODUCT_VALUES,
      mustHavePreferences: MUST_HAVE_PREFERENCE_VALUES,
    },
  };
};

export default getFullTestMatrix;
