/**
 * Sanitize offers for customer-facing APIs.
 * Only approved affiliate offers are customer-facing.
 * Never expose originalUrl or internal seller URLs.
 */
export const isCustomerFacingOffer = (offer = {}) =>
  Boolean(
    offer.isActive
    && offer.linkType === 'affiliate'
    && offer.affiliateUrl
    && String(offer.affiliateUrl).trim()
  );

export const sanitizeOfferForCustomer = (offer = {}) => {
  if (!isCustomerFacingOffer(offer)) return null;

  return {
    _id: offer._id,
    price: offer.price,
    currency: offer.currency || 'INR',
    inStock: offer.inStock,
    linkType: 'affiliate',
    url: offer.affiliateUrl,
    retailer: offer.retailer
      ? { _id: offer.retailer._id, name: offer.retailer.name, slug: offer.retailer.slug }
      : undefined,
  };
};

export const sanitizeOffersForCustomer = (offers = []) =>
  offers
    .map(sanitizeOfferForCustomer)
    .filter(Boolean);

export const getBestCustomerOffer = (offers = []) => {
  const sanitized = sanitizeOffersForCustomer(offers);
  if (!sanitized.length) return null;
  return sanitized.reduce((best, current) =>
    (Number(current.price) < Number(best.price) ? current : best), sanitized[0]);
};

export default { sanitizeOfferForCustomer, sanitizeOffersForCustomer, getBestCustomerOffer };
