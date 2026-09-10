import { getInciDecoderConfig } from '../config/aiConfig.js';
import { assertSafeUrl, safeHttpGet, UrlSafetyError } from '../utils/urlSafety.js';

const MAX_SEARCH_ATTEMPTS = 5;
const MIN_MATCH_SCORE = 0.32;
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SkincarePlatformBot/1.0; +product-import)',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
};

const FORM_GROUPS = [
  ['cleanser', 'cleansing', 'wash', 'facewash', 'foam', 'foaming', 'face wash'],
  ['toner', 'peel', 'peeling', 'exfoliant'],
  ['serum'],
  ['cream', 'moisturizer', 'moisturiser', 'lotion', 'creme', 'day cream', 'night cream'],
  ['sunscreen', 'spf', 'uv fluid', 'uv'],
  ['eye', 'eye serum', 'dark circle'],
  ['mask', 'masque'],
];

const SIZE_RE = /\b\d+(?:[.,]\d+)?\s*(?:ml|g|gm|kg|l|oz|fl\.?\s*oz)\b/gi;
const PACK_RE = /\b(?:pack of \d+|\d+\s*pack|value pack)\b/gi;
const MARK_RE = /[®™©]/g;
const PUNCT_RE = /[^\p{L}\p{N}\s+\-%]/gu;
const BASE_INGREDIENTS = new Set(['aqua', 'water', 'eau', 'glycerin', 'glycerine', 'alcohol denat', 'alcohol denatured']);
const MARKETING_RE = /\b(helps|reduces|brightens?|clinically|dermatologist|proven|for your|makes skin|visible results|anti[- ]dark)\b/i;

const unique = (values) => [...new Set(values.filter(Boolean))];

export const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

export const normalizeQueryText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .replace(MARK_RE, '')
  .replace(/[''`´’]/g, '')
  .replace(PUNCT_RE, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const tokenize = (value) => normalizeQueryText(value)
  .toLowerCase()
  .split(/\s+/)
  .filter((token) => token.length > 1);

const stripSizeAndPack = (value) => String(value || '')
  .replace(SIZE_RE, ' ')
  .replace(PACK_RE, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const stripDuplicateBrand = (name, brand) => {
  const product = String(name || '').trim();
  const brandName = String(brand || '').trim();
  if (!product || !brandName) return product;
  const productNorm = normalizeQueryText(product).toLowerCase();
  const brandNorm = normalizeQueryText(brandName).toLowerCase();
  if (productNorm.startsWith(brandNorm)) {
    return product.slice(brandName.length).replace(/^[\s,:\-–]+/, '').trim() || product;
  }
  const brandTokens = tokenize(brandName).join(' ');
  const productTokens = tokenize(product).join(' ');
  if (productTokens.startsWith(brandTokens)) {
    return productTokens.slice(brandTokens.length).trim();
  }
  return product;
};

const formGroupIndex = (text) => {
  const haystack = ` ${tokenize(text).join(' ')} `;
  return FORM_GROUPS.findIndex((group) => group.some((term) => haystack.includes(` ${term} `) || haystack.includes(term.replace(/\s+/g, ''))));
};

export const scoreInciCandidate = ({ brand, name }, candidate) => {
  const queryTokens = unique([...tokenize(brand), ...tokenize(name)]);
  const candidateTokens = unique(tokenize(`${candidate.brand || ''} ${candidate.title || ''}`));
  if (!queryTokens.length || !candidateTokens.length) return 0;

  const overlap = queryTokens.filter((token) => candidateTokens.includes(token));
  let score = overlap.length / queryTokens.length;

  const brandTokens = tokenize(brand).filter((token) => token !== 'paris');
  const brandMatched = brandTokens.length
    ? brandTokens.every((token) => candidateTokens.includes(token))
    : true;
  if (brandMatched) score += 0.12;
  else score -= 0.25;

  const queryForm = formGroupIndex(name);
  const candidateForm = formGroupIndex(candidate.title);
  if (queryForm >= 0 && candidateForm >= 0) {
    score += queryForm === candidateForm ? 0.28 : -0.4;
  }

  const strongMismatch = ['toner', 'serum', 'spf', 'sunscreen', 'night', 'eye', 'mask']
    .filter((token) => candidateTokens.includes(token) && !queryTokens.includes(token));
  score -= strongMismatch.length * 0.08;

  return score;
};

export const buildInciSearchStrategies = ({ brand, name }) => {
  const productCore = stripSizeAndPack(stripDuplicateBrand(name, brand));
  const normalizedBrand = normalizeQueryText(brand);
  const normalizedProduct = normalizeQueryText(productCore);
  const identifying = tokenize(normalizedProduct).filter((token) => !['with', 'and', 'the', 'for'].includes(token));
  const withoutWeakForm = identifying.filter((token) => !['foaming', 'glowing', 'instant'].includes(token));
  const lineAndForm = unique([
    ...identifying.slice(0, 3),
    ...identifying.filter((token) => ['face', 'wash', 'cleanser', 'cream', 'serum', 'toner'].includes(token)).slice(0, 2),
  ]).join(' ');

  const strategies = [
    { id: 'brand + product name', query: `${brand} ${productCore}`.trim() },
    { id: 'normalized brand + product name', query: `${normalizedBrand} ${normalizedProduct}`.trim() },
    { id: 'product name without variant/size', query: `${normalizedBrand} ${stripSizeAndPack(normalizedProduct)}`.trim() },
    { id: 'identifying product terms', query: identifying.join(' ') },
    {
      id: 'form synonym query',
      query: `${normalizedBrand.split(' ')[0] || ''} ${identifying.join(' ')}`
        .replace(/\bfoaming\b/gi, ' ')
        .replace(/\bcleanser\b/gi, 'wash')
        .replace(/\s+/g, ' ')
        .trim(),
    },
    { id: 'product line + form', query: `${normalizeQueryText(brand).split(' ')[0] || ''} ${lineAndForm}`.trim() },
    { id: 'short product line', query: withoutWeakForm.slice(0, 4).join(' ') },
  ];

  const seen = new Set();
  return strategies.filter((strategy) => {
    const key = normalizeQueryText(strategy.query).toLowerCase();
    if (!key || key.length < 6 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const parseInciSearchResults = (html) => {
  const source = String(html || '');
  const results = [];
  const linkRe = /<a[^>]+href=["']([^"']*\/products\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = linkRe.exec(source);
  while (match) {
    const href = match[1];
    const title = decodeHtmlEntities(String(match[2] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    const slug = String(path || '').split('/products/')[1] || '';
    if (
      href
      && title
      && slug
      && !/upload|clicking here/i.test(`${title} ${slug}`)
    ) {
      results.push({
        title,
        path,
        url: path,
      });
    }
    match = linkRe.exec(source);
  }

  const deduped = [];
  const seen = new Set();
  for (const result of results) {
    if (seen.has(result.path)) continue;
    seen.add(result.path);
    deduped.push(result);
  }
  return deduped;
};

export const parseInciProductIngredients = (html) => {
  const source = String(html || '');
  const start = source.search(/id=["']ingredlist-short["']/i);
  const slice = start >= 0 ? source.slice(start, start + 25000) : source;
  const endMarker = slice.search(/id=["'](?:inci-warning|ingredlist-highlights-section|ingredlist-table-section)["']/i);
  const shortSection = endMarker > 0 ? slice.slice(0, endMarker) : slice;

  const fromLinks = [];
  const linkRe = /<a[^>]+class=["'][^"']*ingred-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = linkRe.exec(shortSection);
  while (match) {
    const name = decodeHtmlEntities(String(match[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    if (name) fromLinks.push(name);
    match = linkRe.exec(shortSection);
  }

  if (fromLinks.length) return unique(fromLinks);

  const meta = source.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || source.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const explained = meta?.[1]?.match(/ingredients explained:\s*([^"]+)/i)?.[1];
  if (explained) {
    return unique(explained.split(',').map((entry) => decodeHtmlEntities(entry.trim())).filter(Boolean));
  }

  return [];
};

const CLAIM_LIKE_RE = /^(for |helps |reduces |brightens |clinically |dermatologist )/i;

export const validateIngredientList = (ingredients) => {
  if (!Array.isArray(ingredients) || ingredients.length <= 1) {
    return { valid: false, reason: 'ingredient list missing or too short' };
  }

  const cleaned = unique(ingredients.map((entry) => String(entry || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
  if (cleaned.length <= 1) {
    return { valid: false, reason: 'ingredient list missing or too short' };
  }
  if (cleaned.some((entry) => typeof entry !== 'string')) {
    return { valid: false, reason: 'ingredients are not strings' };
  }
  if (cleaned.some((entry) => MARKETING_RE.test(entry) || CLAIM_LIKE_RE.test(entry) || entry.length > 90)) {
    return { valid: false, reason: 'result appears to contain marketing claims' };
  }

  const normalized = cleaned.map((entry) => entry.toLowerCase());
  const hasBase = normalized.some((entry) => BASE_INGREDIENTS.has(entry.split('(')[0].trim()) || entry === 'aqua' || entry.startsWith('water'));
  if (cleaned.length < 5 && !hasBase) {
    return { valid: false, reason: 'result appears incomplete (likely key ingredients only)' };
  }

  return { valid: true, ingredients: cleaned, reason: null };
};

const resolveProductUrl = (baseUrl, pathOrUrl) => {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${baseUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

export const fetchInciPage = async (url, { timeoutMs, getPage } = {}) => {
  if (typeof getPage === 'function') {
    return getPage(url);
  }

  const safeUrl = await assertSafeUrl(url);
  const response = await safeHttpGet(safeUrl, {
    timeoutMs,
    headers: REQUEST_HEADERS,
  });
  return {
    url: response.url,
    body: response.body,
  };
};

export const lookupInciIngredients = async ({ brand, name }, options = {}) => {
  const { baseUrl, timeoutMs } = { ...getInciDecoderConfig(), ...options };
  const getPage = options.getPage;
  const strategies = buildInciSearchStrategies({ brand, name });

  console.info('[inci] lookup started');
  console.info('[inci] brand:', brand || '(empty)');
  console.info('[inci] product:', name || '(empty)');

  if (!brand && !name) {
    console.warn('[inci] lookup failed');
    console.warn('[inci] reason: missing brand and product name');
    return {
      success: false,
      reason: 'missing brand and product name',
      ingredients: [],
      candidate: null,
      strategy: null,
    };
  }

  try {
    for (const strategy of strategies.slice(0, MAX_SEARCH_ATTEMPTS)) {
      const searchUrl = `${baseUrl}/search?query=${encodeURIComponent(strategy.query)}`;
      console.info('[inci] lookup strategy:', strategy.id);
      console.info('[inci] query:', strategy.query);
      console.info('[inci] search started');

      let page;
      try {
        page = await fetchInciPage(searchUrl, { timeoutMs, getPage });
      } catch (error) {
        const message = error instanceof UrlSafetyError ? error.message : error.message;
        console.error('[inci] request failed');
        console.error('[inci] error:', message);
        return {
          success: false,
          reason: 'network_error',
          error: message,
          ingredients: [],
          candidate: null,
          strategy: strategy.id,
        };
      }

      console.info('[inci] search completed');
      const candidates = parseInciSearchResults(page.body);
      if (!candidates.length) {
        console.info('[inci] no candidates for strategy', { strategy: strategy.id });
        continue;
      }

      const ranked = candidates
        .map((candidate) => ({
          ...candidate,
          score: scoreInciCandidate({ brand, name }, candidate),
        }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (!best || best.score < MIN_MATCH_SCORE) {
        console.info('[inci] candidates found but none passed matching threshold', {
          strategy: strategy.id,
          topScore: best?.score || 0,
          topTitle: best?.title,
        });
        continue;
      }

      const productUrl = resolveProductUrl(baseUrl, best.path || best.url);
      console.info('[inci] candidate found');
      console.info('[inci] candidate URL:', productUrl);
      console.info('[inci] lookup strategy:', strategy.id);
      console.info('[inci] match found:', true);

      let productPage;
      try {
        productPage = await fetchInciPage(productUrl, { timeoutMs, getPage });
      } catch (error) {
        const message = error instanceof UrlSafetyError ? error.message : error.message;
        console.error('[inci] request failed');
        console.error('[inci] error:', message);
        return {
          success: false,
          reason: 'network_error',
          error: message,
          ingredients: [],
          candidate: best,
          strategy: strategy.id,
        };
      }

      console.info('[inci] parsing ingredient list');
      const parsed = parseInciProductIngredients(productPage.body);
      const validation = validateIngredientList(parsed);
      console.info('[inci] ingredient count:', parsed.length);
      console.info('[inci] validation:', validation.valid ? 'passed' : 'failed');

      if (!validation.valid) {
        console.warn('[inci] reason:', validation.reason);
        continue;
      }

      console.info('[inci] final source: inci_decoder');

      return {
        success: true,
        reason: null,
        ingredients: validation.ingredients,
        candidate: { ...best, url: productPage.url || productUrl },
        strategy: strategy.id,
        source: 'inci_decoder',
      };
    }

    console.warn('[inci] lookup failed');
    console.warn('[inci] match found:', false);
    console.warn('[inci] reason: no matching product');
    return {
      success: false,
      reason: 'no matching product',
      ingredients: [],
      candidate: null,
      strategy: null,
    };
  } catch (error) {
    console.error('[inci] request failed');
    console.error('[inci] error:', error.message);
    return {
      success: false,
      reason: 'network_error',
      error: error.message,
      ingredients: [],
      candidate: null,
      strategy: null,
    };
  }
};

export default {
  lookupInciIngredients,
  buildInciSearchStrategies,
  parseInciSearchResults,
  parseInciProductIngredients,
  validateIngredientList,
  scoreInciCandidate,
  normalizeQueryText,
  stripDuplicateBrand,
  decodeHtmlEntities,
};
