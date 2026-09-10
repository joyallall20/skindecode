import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInciSearchStrategies,
  parseInciSearchResults,
  parseInciProductIngredients,
  validateIngredientList,
  scoreInciCandidate,
  lookupInciIngredients,
} from '../src/services/inciDecoderService.js';
import {
  enrichProductIngredients,
  extractIngredientsFromProductPage,
} from '../src/services/ingredientEnrichmentService.js';

const SEARCH_HTML = `
  <h2>Products</h2>
  <a href="/products/loreal-glycolic-bright-5-glycolic-acid-peeling-toner" class="klavika simpletextlistitem">L'Oreal Glycolic-bright 5% Glycolic Acid Peeling Toner</a>
  <a href="/products/loreal-glycolic-bright-daily-face-wash" class="klavika simpletextlistitem">L'Oreal Glycolic Bright Daily Face Wash</a>
  <a href="/products/loreal-glycolic-bright-instant-glowing-face-serum" class="klavika simpletextlistitem">L'Oreal Glycolic Bright Instant Glowing Face Serum</a>
`;

const PRODUCT_HTML = `
  <meta name="description" content="L'Oreal Glycolic Bright Daily Face Wash ingredients explained: Aqua, Stearic Acid, Lauric Acid">
  <div id="ingredlist-short">
    <a href="/ingredients/water" class="ingred-link black">Aqua</a>
    <a href="/ingredients/stearic-acid" class="ingred-link black">Stearic Acid</a>
    <a href="/ingredients/lauric-acid" class="ingred-link black">Lauric Acid</a>
    <a href="/ingredients/glycerin" class="ingred-link black">Glycerine</a>
    <a href="/ingredients/niacinamide" class="ingred-link black">Niacinamide</a>
    <a href="/ingredients/glycolic-acid" class="ingred-link black">Glycolic Acid</a>
  </div>
  <div id="inci-warning"></div>
`;

const LONG_LIST = Array.from({ length: 42 }, (_, index) => `Ingredient ${index + 1}`);

const makeGetPage = ({ searchHtml = SEARCH_HTML, productHtml = PRODUCT_HTML, failAll = false } = {}) => async (url) => {
  if (failAll) {
    throw new Error('ECONNRESET');
  }
  if (url.includes('/search')) {
    return { url, body: searchHtml };
  }
  if (url.includes('/products/')) {
    return { url, body: productHtml };
  }
  return { url, body: '' };
};

test('buildInciSearchStrategies does not use only the raw Amazon title', () => {
  const strategies = buildInciSearchStrategies({
    brand: "L'Oreal Paris",
    name: "L'Oréal Paris Glycolic Bright Daily Foaming Face Cleanser 100ml",
  });
  assert.ok(strategies.length > 1);
  assert.ok(strategies.some((strategy) => /glycolic bright/i.test(strategy.query)));
  assert.equal(strategies.every((strategy) => !/100ml/i.test(strategy.query)), true);
});

test('scoreInciCandidate prefers matching cleanser/wash over serum or toner', () => {
  const query = {
    brand: "L'Oreal Paris",
    name: 'Glycolic Bright Daily Foaming Face Cleanser',
  };
  const wash = scoreInciCandidate(query, { title: "L'Oreal Glycolic Bright Daily Face Wash" });
  const serum = scoreInciCandidate(query, { title: "L'Oreal Glycolic Bright Instant Glowing Face Serum" });
  const toner = scoreInciCandidate(query, { title: "L'Oreal Glycolic-bright 5% Glycolic Acid Peeling Toner" });
  assert.ok(wash > serum);
  assert.ok(wash > toner);
});

test('INCI product found yields full ingredients and inci_decoder source', async () => {
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: "L'Oréal Paris Glycolic Bright Daily Foaming Face Cleanser",
      brand: "L'Oreal Paris",
      ingredients: ['Glycolic Acid', 'Niacinamide'],
      keyIngredients: ['Glycolic Acid', 'Niacinamide'],
    },
    lookup: (identity) => lookupInciIngredients(identity, { getPage: makeGetPage() }),
  });

  assert.ok(extracted.ingredients.length > 1);
  assert.equal(extracted.ingredientSource, 'inci_decoder');
  assert.equal(extracted.ingredientConfidence, 'medium');
  assert.deepEqual(extracted.keyIngredients, ['Glycolic Acid', 'Niacinamide']);
});

test('INCI product not found still succeeds and does not claim keyIngredients as full list', async () => {
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: 'Unknown Glow Potion',
      brand: 'NoSuchBrand',
      ingredients: ['Glycolic Acid', 'Niacinamide'],
      keyIngredients: ['Glycolic Acid'],
    },
    pageMarkdown: '# About this item\nBrightening cleanser',
    lookup: async () => ({ success: false, reason: 'no matching product', ingredients: [] }),
  });

  assert.deepEqual(extracted.ingredients, []);
  assert.equal(extracted.ingredientSource, null);
  assert.deepEqual(extracted.keyIngredients, ['Glycolic Acid']);
});

test('INCI network error does not crash enrichment', async () => {
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: 'Cleanser',
      brand: 'Brand',
      ingredients: ['Glycolic Acid', 'Niacinamide'],
      keyIngredients: ['Glycolic Acid', 'Niacinamide'],
    },
    lookup: async () => lookupInciIngredients(
      { brand: 'Brand', name: 'Cleanser' },
      { getPage: makeGetPage({ failAll: true }) }
    ),
  });

  assert.equal(extracted.name, 'Cleanser');
  assert.deepEqual(extracted.ingredients, []);
  assert.deepEqual(extracted.keyIngredients, ['Glycolic Acid', 'Niacinamide']);
});

test('malformed or empty INCI response is rejected by validation', () => {
  assert.equal(validateIngredientList([]).valid, false);
  assert.equal(validateIngredientList(['Glycolic Acid']).valid, false);
  assert.equal(validateIngredientList(['Glycolic Acid', 'Niacinamide']).valid, false);
  assert.equal(validateIngredientList(['Helps brighten skin', 'Reduces dark spots', 'Aqua', 'Glycerin', 'Niacinamide']).valid, false);
  assert.equal(validateIngredientList(parseInciProductIngredients('<html>no ingredients here</html>')).valid, false);
});

test('long ingredient lists are preserved without truncation', async () => {
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: 'Long List Cream',
      brand: 'Brand',
      ingredients: ['A', 'B'],
      keyIngredients: ['A'],
    },
    lookup: async () => ({
      success: true,
      ingredients: LONG_LIST,
      source: 'inci_decoder',
    }),
  });

  assert.equal(extracted.ingredients.length, 42);
  assert.equal(extracted.ingredients[41], 'Ingredient 42');
  assert.equal(extracted.ingredientSource, 'inci_decoder');
  assert.equal(extracted.ingredientConfidence, 'high');
});

test('product page fallback is used when INCI has no match', async () => {
  const markdown = `
## Important information
#### Ingredients
Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Petrolatum, Ceramide NP, Niacinamide
#### Directions
Apply evenly.
`;
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: 'Moisturizer',
      brand: 'CeraVe',
      ingredients: ['Ceramides', 'Hyaluronic Acid'],
      keyIngredients: ['Ceramides'],
    },
    pageMarkdown: markdown,
    lookup: async () => ({ success: false, reason: 'no matching product', ingredients: [] }),
  });

  assert.ok(extracted.ingredients.length > 1);
  assert.equal(extracted.ingredientSource, 'product_page');
  assert.deepEqual(extracted.keyIngredients, ['Ceramides']);
});

test('parseInciSearchResults extracts product candidates', () => {
  const results = parseInciSearchResults(SEARCH_HTML);
  assert.equal(results.length, 3);
  assert.ok(results.some((result) => result.path.includes('daily-face-wash')));
});

test('extractIngredientsFromProductPage reads a genuine ingredient section', () => {
  const ingredients = extractIngredientsFromProductPage(`
#### Ingredients
Water, Glycerin, Cetearyl Alcohol, Cetyl Alcohol, Petrolatum, Ceramide NP
#### Directions
Use daily.
`);
  assert.equal(ingredients.length, 6);
});

test('admin ingredients are preserved when INCI match fails', async () => {
  let lookupCalled = false;
  const extracted = await enrichProductIngredients({
    extractedData: {
      name: 'Mung Bean Pore Cleansing Foam Scrub',
      brand: 'Mamaearth',
      ingredients: ['Aqua', 'Glycerin', 'Niacinamide'],
      keyIngredients: ['Niacinamide'],
      ingredientSource: 'admin',
    },
    lookup: async () => {
      lookupCalled = true;
      return { success: false, matchFound: false, ingredients: [] };
    },
  });

  assert.equal(lookupCalled, false);
  assert.deepEqual(extracted.ingredients, ['Aqua', 'Glycerin', 'Niacinamide']);
  assert.equal(extracted.ingredientSource, 'admin');
});
