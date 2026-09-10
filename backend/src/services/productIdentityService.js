import crypto from 'crypto';

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.-]/g, '');

/**
 * Build canonical identity components from product or extracted data.
 */
export const buildIdentityComponents = (data = {}) => {
  const brand = normalize(data.brand?.name || data.brand);
  const name = normalize(data.canonicalName || data.name);
  const category = normalize(data.category?.name || data.category);
  const variant = normalize(data.variant);
  const size = normalize(data.size);
  const quantity = normalize(data.quantity);

  const ids = data.productIdentifiers || data.identifiers || {};
  const gtin = normalize(ids.gtin || data.gtin);
  const ean = normalize(ids.ean || data.ean);
  const upc = normalize(ids.upc || data.upc);
  const sku = normalize(ids.sku || data.sku);
  const mpn = normalize(ids.mpn || data.mpn);

  return { brand, name, category, variant, size, quantity, gtin, ean, upc, sku, mpn };
};

const buildPurchasableKey = (components) =>
  [
    components.brand,
    components.name,
    components.category,
    components.variant,
    components.size,
    components.quantity,
  ].filter(Boolean).join('|');

/**
 * Compute a stable hash for canonical product identity.
 * Identifiers are scoped to variant/size/quantity so similar names do not merge.
 */
export const computeCanonicalIdentityHash = (data = {}) => {
  const components = buildIdentityComponents(data);
  const purchasable = buildPurchasableKey(components);

  let key;
  if (components.gtin) {
    key = `gtin:${components.gtin}|${purchasable}`;
  } else if (components.ean) {
    key = `ean:${components.ean}|${purchasable}`;
  } else if (components.upc) {
    key = `upc:${components.upc}|${purchasable}`;
  } else if (components.sku && purchasable) {
    key = `sku:${components.sku}|${purchasable}`;
  } else if (components.mpn && purchasable) {
    key = `mpn:${components.mpn}|${purchasable}`;
  } else {
    key = purchasable || components.name;
  }

  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
};

export const buildProductSlug = (data = {}) => {
  const components = buildIdentityComponents(data);
  const parts = [components.brand, components.name, components.variant, components.size]
    .filter(Boolean)
    .join(' ');
  const base = parts || components.name || 'product';
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
};

export default { buildIdentityComponents, computeCanonicalIdentityHash, buildProductSlug };
