import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeOfferForCustomer,
  sanitizeOffersForCustomer,
  isCustomerFacingOffer,
} from '../src/utils/offerPresentation.js';

const affiliateOffer = {
  _id: '1',
  price: 999,
  currency: 'INR',
  inStock: true,
  isActive: true,
  linkType: 'affiliate',
  affiliateUrl: 'https://affiliate.example/p/1',
  originalUrl: 'https://retailer.internal/p/1',
  url: 'https://retailer.internal/p/1',
  retailer: { _id: 'r1', name: 'Retailer', slug: 'retailer' },
};

test('direct offers are never customer-facing', () => {
  const directOffer = {
    ...affiliateOffer,
    linkType: 'direct',
    affiliateUrl: null,
    isActive: true,
  };

  assert.equal(isCustomerFacingOffer(directOffer), false);
  assert.equal(sanitizeOfferForCustomer(directOffer), null);
});

test('inactive affiliate offers are filtered out', () => {
  const inactive = { ...affiliateOffer, isActive: false };
  assert.deepEqual(sanitizeOffersForCustomer([inactive]), []);
});

test('sanitized offer never exposes originalUrl', () => {
  const sanitized = sanitizeOfferForCustomer(affiliateOffer);
  assert.equal(sanitized.url, affiliateOffer.affiliateUrl);
  assert.equal(sanitized.originalUrl, undefined);
});
