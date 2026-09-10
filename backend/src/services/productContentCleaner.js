const DEFAULT_MAX_CHARS = 6000;

const DROP_HEADING = new RegExp([
  'adding to cart',
  'added to cart',
  'not added',
  'item is in your cart',
  'unlock \\d+% savings',
  'choose how often',
  'skip or cancel',
  'potential savings',
  'subscribe & save',
  'keyboard shortcut',
  'sorry, there was a problem',
  'return this item',
  'purchase options and add-ons',
  'one-time purchase',
  'frequently bought together',
  'similar items',
  'similar brands',
  'look for similar',
  'product videos',
  'customer reviews',
  'customers say',
  'customers also',
  'customers who',
  'reviews with images',
  'images in this review',
  'top reviews',
  'from the community',
  'customer questions',
  'questions and answers',
  'asked by',
  'see more answers',
  'sponsored',
  'compare with similar',
  'where did you see a lower price',
  'amazon-adsystem',
  'feedback',
  'shipper / seller',
  'free delivery',
  'from the manufacturer',
  'from the brand',
  'product description',
  'product videos',
  'buy with',
  'new \\(\\d+\\) from',
  'used \\(\\d+\\) from',
].join('|'), 'i');

const CADENCE_HEADING = /^#{1,6}\s*\[?\d+\s+(weeks?|months?)\b/i;
const REVIEW_STAR_HEADING = /⭐/;

const KEEP_HEADING = new RegExp([
  'about this item',
  'about this product',
  'product summary',
  'item details',
  'important information',
  'ingredients',
  'key ingredients',
  'brand',
  'product information',
].join('|'), 'i');

const KEEP_VARIANT_HEADING = /^#{1,6}\s*(size|price|pricing|variant|quantity|net quantity|package quantity|options available)\b/i;

const MUST_KEEP_LABEL = new RegExp([
  '^\\s*\\|?\\s*(active )?ingredients?',
  '^\\s*\\|?\\s*key ingredients?',
  '^\\s*\\|?\\s*special ingredients?',
  '^\\s*\\|?\\s*brand\\b',
  '^\\s*\\|?\\s*price\\b',
  '^\\s*\\|?\\s*variant\\b',
].join('|'), 'im');

const INGREDIENT_HEADING = /ingredients?/i;
const PRICE_RE = /(?:₹|Rs\.?\s*|INR\s*|\$)\s*[\d,]+(?:\.\d+)?/i;

const stripMarkdownImages = (text) => String(text || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');

const stripMarkdownLinkUrls = (text) => String(text || '')
  .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/https?:\/\/\S+/gi, '');

const headingText = (section) => {
  const match = String(section || '').match(/^#{1,6}\s+(.+)$/m);
  return match ? match[1].replace(/\[(.*?)\]\([^)]*\)/g, '$1').trim() : '';
};

const isIngredientSection = (section) => {
  const heading = headingText(section);
  return INGREDIENT_HEADING.test(heading) || MUST_KEEP_LABEL.test(section);
};

const isTitleSection = (section) => {
  const heading = headingText(section);
  return /^#{1,3}\s+.{20,}/m.test(section)
    && /\b(oz|ml|g|cream|moisturizer|moisturising|serum|cleanser|wash|toner|sunscreen|lotion|oil|mask|soap|face)\b/i.test(heading);
};

const classifySection = (section) => {
  const heading = headingText(section);
  const headingLine = String(section || '').split('\n', 1)[0] || '';

  if (CADENCE_HEADING.test(headingLine) || REVIEW_STAR_HEADING.test(headingLine)) {
    return 'drop';
  }

  if (heading && DROP_HEADING.test(heading)) {
    return isIngredientSection(section) ? 'keep' : 'drop';
  }

  if (heading && (KEEP_HEADING.test(heading) || KEEP_VARIANT_HEADING.test(headingLine))) {
    return 'keep';
  }

  if (MUST_KEEP_LABEL.test(section) || isTitleSection(section)) {
    return 'keep';
  }

  return 'drop';
};

const extractPriceSnippet = (section) => {
  const match = String(section).match(PRICE_RE);
  return match ? match[0] : null;
};

const compactNonIngredientSection = (section) => {
  if (isIngredientSection(section)) return section;
  const lines = String(section).split('\n').filter((line, index) => index === 0 || line.trim());
  if (lines.length <= 12 && section.length <= 900) return section;
  return lines.slice(0, 12).join('\n').trim();
};

const joinSections = (sections) => sections
  .map((section) => section.trim())
  .filter(Boolean)
  .join('\n\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const sectionPriority = (section) => {
  if (isIngredientSection(section)) return 0;
  if (isTitleSection(section)) return 1;
  if (KEEP_VARIANT_HEADING.test(String(section).split('\n', 1)[0] || '') || /\bbrand\b/i.test(headingText(section))) return 2;
  if (/about this (item|product)/i.test(headingText(section))) return 3;
  return 4;
};

const fitWithinBudget = (sections, maxChars) => {
  const ordered = [...sections].sort((a, b) => sectionPriority(a) - sectionPriority(b));
  const selected = [];
  let used = 0;

  for (const section of ordered) {
    const trimmed = section.trim();
    const piece = `${trimmed}\n\n`;
    if (isIngredientSection(section)) {
      selected.push(trimmed);
      used += piece.length;
      continue;
    }
    if (used + piece.length <= maxChars) {
      selected.push(trimmed);
      used += piece.length;
    }
  }

  return joinSections(selected);
};

const dedupeSections = (sections) => {
  const seen = new Set();
  return sections.filter((section) => {
    const key = headingText(section).toLowerCase() || section.slice(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Deterministic Firecrawl markdown cleaner for focused product extraction.
 * Keeps title, brand, price, category signals, variant, and ingredient text.
 */
export const cleanProductPageContent = (markdown, { maxChars = DEFAULT_MAX_CHARS } = {}) => {
  const sourceLength = String(markdown || '').length;
  const text = stripMarkdownLinkUrls(stripMarkdownImages(markdown)).replace(/[ \t]+\n/g, '\n').trim();

  if (!text) {
    return { content: '', sourceLength, filteredLength: 0, removedLength: sourceLength };
  }

  const preambleMatch = text.match(/^[\s\S]*?(?=^#{1,6} )/m);
  const sections = text.split(/(?=^#{1,6} )/m).filter((section) => section.trim());
  const kept = [];
  const prices = new Set();

  if (preambleMatch && preambleMatch[0].trim() && !preambleMatch[0].includes('#')) {
    const preamble = preambleMatch[0].trim();
    if (classifySection(preamble) !== 'drop') kept.push(preamble);
  }

  for (const section of sections) {
    const decision = classifySection(section);
    if (decision === 'drop') {
      const price = extractPriceSnippet(section);
      if (price) prices.add(price);
      continue;
    }
    kept.push(compactNonIngredientSection(section.trim()));
  }

  const hasPriceSection = kept.some((section) => /^#{1,6}\s*price\b/i.test(section) || PRICE_RE.test(section));
  if (!hasPriceSection && prices.size) {
    kept.unshift(`## Price\n${[...prices].join(', ')}`);
  }

  const uniqueKept = dedupeSections(kept);
  let content = joinSections(uniqueKept);
  if (content.length > maxChars) {
    content = fitWithinBudget(uniqueKept, maxChars);
  }
  const filteredLength = content.length;

  return {
    content,
    sourceLength,
    filteredLength,
    removedLength: Math.max(0, sourceLength - filteredLength),
  };
};

export default cleanProductPageContent;
