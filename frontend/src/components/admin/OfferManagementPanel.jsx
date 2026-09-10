import { useEffect, useState } from 'react';
import { panelStyle, buttonStyle, secondaryButtonStyle } from './ProductDataForm.jsx';
import { getProductOffers } from '../../api/productApi.js';
import { createProductOffer, updateProductOffer, deleteProductOffer } from '../../api/adminApi.js';

export default function OfferManagementPanel({ productId }) {
  const [offers, setOffers] = useState([]);
  const [affiliateEdits, setAffiliateEdits] = useState({});
  const [message, setMessage] = useState('');

  const loadOffers = async () => {
    if (!productId) return;
    try {
      const res = await getProductOffers(productId);
      const list = res?.data ?? res ?? [];
      setOffers(Array.isArray(list) ? list : []);
    } catch {
      setOffers([]);
    }
  };

  useEffect(() => { loadOffers(); }, [productId]);

  const handleSaveAffiliate = async (offer) => {
    const affiliateUrl = affiliateEdits[offer._id]?.trim();
    if (!affiliateUrl) {
      setMessage('Paste an affiliate URL first.');
      return;
    }
    try {
      await updateProductOffer(productId, offer._id, {
        affiliateUrl,
        linkType: 'affiliate',
        url: affiliateUrl,
        isActive: true,
      });
      setMessage('Affiliate URL saved. Offer is now customer-facing.');
      await loadOffers();
    } catch (error) {
      setMessage(error?.message || 'Failed to save affiliate URL.');
    }
  };

  const handleToggleOffer = async (offer) => {
    try {
      await updateProductOffer(productId, offer._id, { isActive: !offer.isActive });
      await loadOffers();
    } catch (error) {
      setMessage(error?.message || 'Failed to update offer.');
    }
  };

  const handleDelete = async (offerId) => {
    if (!window.confirm('Delete this offer?')) return;
    try {
      await deleteProductOffer(productId, offerId);
      await loadOffers();
    } catch (error) {
      setMessage(error?.message || 'Failed to delete offer.');
    }
  };

  if (!productId) {
    return (
      <section style={panelStyle}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Product Offers</h2>
        <p style={{ color: '#b45309', fontSize: 14 }}>Save product to catalog before managing offers.</p>
      </section>
    );
  }

  const sorted = [...offers].sort((a, b) => Number(a.price) - Number(b.price));
  const bestPrice = sorted[0]?.price;

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>Product Offers</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
        Offers require an affiliate URL before becoming customer-facing. Original URLs are admin-only.
      </p>

      {message ? <p style={{ fontSize: 13, marginBottom: 12 }}>{message}</p> : null}

      {sorted.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>No offers yet. Use seller discovery or add manually.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {sorted.map((offer) => (
            <div key={offer._id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{offer.retailer?.name || 'Unknown retailer'}</strong>
                {offer.price === bestPrice ? <span style={{ color: '#166534', fontWeight: 700 }}>Best Price</span> : null}
              </div>
              <div>Price: {offer.price} {offer.currency} · {offer.inStock ? 'In stock' : 'Out of stock'}</div>
              <div>Status: {offer.isActive ? 'Active (customer-facing)' : 'Draft (admin only)'}</div>
              <div style={{ marginTop: 4, color: '#6b7280', wordBreak: 'break-all' }}>
                Original: {offer.originalUrl || offer.url}
              </div>
              {offer.affiliateUrl ? (
                <div style={{ color: '#166534', wordBreak: 'break-all' }}>Affiliate: {offer.affiliateUrl}</div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                    Paste EarnKaro affiliate URL
                    <input
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                      value={affiliateEdits[offer._id] || ''}
                      onChange={(e) => setAffiliateEdits({ ...affiliateEdits, [offer._id]: e.target.value })}
                      placeholder="https://ekaro.in/..."
                    />
                  </label>
                  <button type="button" style={{ ...buttonStyle, marginTop: 6, fontSize: 12 }} onClick={() => handleSaveAffiliate(offer)}>
                    Save Affiliate URL
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" style={secondaryButtonStyle} onClick={() => handleToggleOffer(offer)}>
                  {offer.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" style={{ ...secondaryButtonStyle, color: '#991b1b' }} onClick={() => handleDelete(offer._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
