import { buildIdentityComponents } from './productIdentityService.js';

const MIN_CONFIDENCE = Number(process.env.SELLER_MATCH_MIN_CONFIDENCE || 0.75);

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const tokensMatch = (left, right) => {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.replace(/\s+/g, '') === b.replace(/\s+/g, '')) return true;
  return a.includes(b) || b.includes(a);
};

const identifierConflict = (canonicalValue, candidateValue) => {
  const canonical = normalize(canonicalValue);
  const candidate = normalize(candidateValue);
  if (!canonical || !candidate) return false;
  return canonical !== candidate;
};

/**
 * Deterministic backend validation for seller discovery matches.
 * AI suggestions are advisory; backend rules decide acceptance.
 */
export const validateSellerMatch = ({
  canonicalProduct = {},
  aiMatch = {},
  extracted = {},
}) => {
  const reasons = [];

  if (!aiMatch.sameProduct) {
    reasons.push('AI classified as different product');
  }

  const confidence = Number(aiMatch.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) {
    reasons.push(`Confidence below threshold (${MIN_CONFIDENCE})`);
  }

  const components = buildIdentityComponents(canonicalProduct);
  const candidateIds = extracted.identifiers || {
    sku: extracted.sku,
    gtin: extracted.gtin,
    ean: extracted.ean,
    upc: extracted.upc,
    mpn: extracted.mpn,
  };

  if (identifierConflict(components.gtin, candidateIds.gtin || extracted.gtin)) {
    reasons.push('GTIN mismatch');
  }
  if (identifierConflict(components.ean, candidateIds.ean || extracted.ean)) {
    reasons.push('EAN mismatch');
  }
  if (identifierConflict(components.upc, candidateIds.upc || extracted.upc)) {
    reasons.push('UPC mismatch');
  }
  if (identifierConflict(components.sku, candidateIds.sku || extracted.sku)) {
    reasons.push('SKU mismatch');
  }

  const canonicalHasIdentifier = Boolean(
    components.gtin || components.ean || components.upc || components.sku || components.mpn
  );
  const candidateHasIdentifier = Boolean(
    candidateIds.gtin || candidateIds.ean || candidateIds.upc || candidateIds.sku || candidateIds.mpn
    || extracted.gtin || extracted.ean || extracted.upc || extracted.sku || extracted.mpn
  );
  if (canonicalHasIdentifier && !candidateHasIdentifier && aiMatch.sameProduct) {
    reasons.push('Missing required product identifier on candidate');
  }

  const canonicalVariant = canonicalProduct.variant || components.variant;
  const candidateVariant = extracted.variant || aiMatch.variant;
  if (canonicalVariant && candidateVariant && !tokensMatch(canonicalVariant, candidateVariant)) {
    reasons.push('Variant mismatch');
  } else if (canonicalVariant && !candidateVariant && aiMatch.variantMatch === false) {
    reasons.push('Variant mismatch');
  }

  const canonicalSize = canonicalProduct.size || components.size;
  const candidateSize = extracted.size || aiMatch.size;
  if (canonicalSize && candidateSize && !tokensMatch(canonicalSize, candidateSize)) {
    reasons.push('Size mismatch');
  } else if (canonicalSize && !candidateSize && aiMatch.sizeMatch === false) {
    reasons.push('Size mismatch');
  }

  const canonicalQuantity = canonicalProduct.quantity || components.quantity;
  const candidateQuantity = extracted.quantity || aiMatch.quantity;
  if (canonicalQuantity && candidateQuantity && !tokensMatch(canonicalQuantity, candidateQuantity)) {
    reasons.push('Quantity mismatch');
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    minConfidence: MIN_CONFIDENCE,
  };
};

export default { validateSellerMatch };
