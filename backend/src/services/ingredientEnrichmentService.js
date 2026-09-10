import {
  lookupInciIngredients,
  validateIngredientList,
} from './inciDecoderService.js';

const INGREDIENT_HEADING_RE = /(?:^|\n)#{1,6}\s*(?:active\s+)?ingredients?\s*\n+([\s\S]+?)(?=\n#{1,6}\s|\n#{1,6}|$)/i;
const INGREDIENTS_TABLE_RE = /\|\s*(?:active\s+)?ingredients?\s*\|\s*([^|\n]+)\|/i;

export const extractIngredientsFromProductPage = (markdown) => {
  const text = String(markdown || '');
  if (!text.trim()) return [];

  const headingMatch = text.match(INGREDIENT_HEADING_RE);
  const fromHeading = headingMatch?.[1]
    ? headingMatch[1]
      .replace(/^#+\s*/gm, '')
      .replace(/\n+/g, ' ')
      .trim()
    : '';

  const fromTable = text.match(INGREDIENTS_TABLE_RE)?.[1]?.trim() || '';
  const sourceText = fromHeading.length >= fromTable.length ? fromHeading : fromTable;
  if (!sourceText) return [];

  return sourceText
    .split(/,|;|\n/)
    .map((entry) => entry.replace(/^[-*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const looksLikeKeyIngredientsOnly = (ingredients) => {
  const validation = validateIngredientList(ingredients);
  return !validation.valid;
};

const uniqueStrings = (values) => [...new Set((values || []).map((entry) => String(entry || '').trim()).filter(Boolean))];

export const classifyIngredientConfidence = (source, count) => {
  if (!source || !count) return null;
  if (source === 'admin') return count >= 2 ? 'high' : 'medium';
  if (source === 'inci_decoder') return count >= 8 ? 'high' : 'medium';
  if (source === 'product_page') return count >= 8 ? 'medium' : 'low';
  if (source === 'llm') return 'low';
  return 'low';
};

export const enrichProductIngredients = async ({
  extractedData = {},
  pageMarkdown = '',
  lookup = lookupInciIngredients,
} = {}) => {
  const groqIngredients = uniqueStrings(extractedData.ingredients);
  const groqKeyIngredients = uniqueStrings(extractedData.keyIngredients);
  const keyIngredients = groqKeyIngredients.length
    ? groqKeyIngredients
    : (looksLikeKeyIngredientsOnly(groqIngredients) ? groqIngredients : []);

  const existingSource = extractedData.ingredientSource;
  if (existingSource === 'admin' && groqIngredients.length) {
    console.info('[inci] preserving admin ingredients');
    console.info('[inci] ingredient count:', groqIngredients.length);
    console.info('[inci] final source: admin');
    return {
      ...extractedData,
      keyIngredients,
      ingredients: groqIngredients,
      ingredientSource: 'admin',
      ingredientConfidence: extractedData.ingredientConfidence || classifyIngredientConfidence('admin', groqIngredients.length),
    };
  }

  const next = {
    ...extractedData,
    keyIngredients,
    ingredients: [],
    ingredientSource: null,
    ingredientConfidence: null,
  };

  try {
    const inciResult = await lookup({
      brand: extractedData.brand,
      name: extractedData.name,
    });

    if (inciResult?.success && inciResult.ingredients?.length) {
      const validation = validateIngredientList(inciResult.ingredients);
      console.info('[inci] match found:', true);
      console.info('[inci] ingredient count:', validation.ingredients?.length || inciResult.ingredients.length);
      console.info('[inci] validation:', validation.valid ? 'passed' : 'failed');
      if (validation.valid) {
        next.ingredients = validation.ingredients;
        next.ingredientSource = 'inci_decoder';
        next.ingredientConfidence = classifyIngredientConfidence('inci_decoder', validation.ingredients.length);
        if (!next.keyIngredients.length) {
          next.keyIngredients = groqKeyIngredients.length ? groqKeyIngredients : groqIngredients.slice(0, 5);
        }
        console.info('[inci] final source: inci_decoder');
        return next;
      }
    } else {
      console.info('[inci] match found:', false);
    }
  } catch (error) {
    console.error('[inci] lookup failed');
    console.error('[inci] error:', error.message);
  }

  const pageIngredients = extractIngredientsFromProductPage(pageMarkdown);
  const pageValidation = validateIngredientList(pageIngredients);
  if (pageValidation.valid) {
    console.info('[inci] using product page ingredients');
    console.info('[inci] ingredient count:', pageValidation.ingredients.length);
    console.info('[inci] validation: passed');
    next.ingredients = pageValidation.ingredients;
    next.ingredientSource = 'product_page';
    next.ingredientConfidence = classifyIngredientConfidence('product_page', pageValidation.ingredients.length);
    if (!next.keyIngredients.length) {
      next.keyIngredients = groqIngredients.slice(0, 5);
    }
    console.info('[inci] final source: product_page');
    return next;
  }

  if (existingSource === 'admin' && groqIngredients.length) {
    next.ingredients = groqIngredients;
    next.ingredientSource = 'admin';
    next.ingredientConfidence = extractedData.ingredientConfidence || classifyIngredientConfidence('admin', groqIngredients.length);
    console.info('[inci] preserving admin ingredients after INCI miss');
    console.info('[inci] final source: admin');
    return next;
  }

  console.warn('[inci] no reliable full ingredient list');
  console.warn('[inci] reason:', pageValidation.reason || 'INCI Decoder not found and page list incomplete');
  console.info('[inci] final source: none');
  next.ingredients = [];
  next.ingredientSource = null;
  next.ingredientConfidence = null;
  if (!next.keyIngredients.length && groqIngredients.length) {
    next.keyIngredients = groqIngredients;
  }
  return next;
};

export default enrichProductIngredients;
