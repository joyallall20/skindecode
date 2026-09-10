import { useEffect, useState } from 'react';
import { panelStyle, buttonStyle, secondaryButtonStyle } from './ProductDataForm.jsx';
import {
  runSellerDiscovery,
  getSellerCandidates,
  updateSellerCandidate,
  deleteSellerCandidate,
} from '../../api/adminApi.js';

export default function SellerDiscoveryPanel({ productId, importId, onOfferCreated }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [affiliateInputs, setAffiliateInputs] = useState({});

  const loadCandidates = async () => {
    const params = {};
    if (productId) params.productId = productId;
    if (importId) params.importId = importId;
    try {
      const res = await getSellerCandidates(params);
      setCandidates(res?.data ?? res ?? []);
    } catch {
      setCandidates([]);
    }
  };

  useEffect(() => { loadCandidates(); }, [productId, importId]);

  const handleDiscover = async () => {
    setLoading(true);
    setMessage('Searching retailers…');
    try {
      await runSellerDiscovery({ productId, importId });
      setMessage('Seller discovery complete. Review candidates below.');
      await loadCandidates();
    } catch (error) {
      setMessage(error?.message || 'Seller discovery failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (candidate) => {
    const affiliateUrl = affiliateInputs[candidate._id]?.trim();
    try {
      await updateSellerCandidate(candidate._id, {
        status: 'accepted',
        affiliateUrl: affiliateUrl || undefined,
      });
      setMessage(affiliateUrl ? 'Offer saved and activated.' : 'Seller accepted. Paste affiliate URL to activate offer.');
      await loadCandidates();
      onOfferCreated?.();
    } catch (error) {
      setMessage(error?.message || 'Failed to accept seller.');
    }
  };

  const handleReject = async (candidateId) => {
    try {
      await updateSellerCandidate(candidateId, { status: 'rejected' });
      await loadCandidates();
    } catch (error) {
      setMessage(error?.message || 'Failed to reject seller.');
    }
  };

  const handleRemove = async (candidateId) => {
    try {
      await deleteSellerCandidate(candidateId);
      await loadCandidates();
    } catch (error) {
      setMessage(error?.message || 'Failed to remove seller.');
    }
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 20 }}>Seller Discovery</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
        Search configured retailers for the same product. Review matches before creating offers.
      </p>

      <button type="button" style={buttonStyle} disabled={loading || (!productId && !importId)} onClick={handleDiscover}>
        {loading ? 'Discovering…' : 'Discover Sellers'}
      </button>

      {message ? <p style={{ marginTop: 12, fontSize: 13, color: '#374151' }}>{message}</p> : null}

      {candidates.length === 0 ? (
        <p style={{ marginTop: 16, color: '#6b7280', fontSize: 13 }}>No discovered sellers yet.</p>
      ) : (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {candidates.map((c) => (
            <div key={c._id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <strong>{c.retailerName || c.retailer?.name}</strong>
                <span style={{
                  padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                  background: c.status === 'accepted' || c.status === 'offer_created' ? '#dcfce7' : c.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                }}>
                  {c.status}
                </span>
              </div>
              <div style={{ marginTop: 6, color: '#6b7280' }}>{c.extractedName}</div>
              <div>Price: {c.price ?? '—'} {c.currency} · Match: {Math.round((c.matchResult?.confidence || 0) * 100)}%</div>
              <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
                <a href={c.sourceUrl} target="_blank" rel="noreferrer">{c.sourceUrl}</a>
              </div>
              {c.matchResult?.reasoning ? (
                <div style={{ marginTop: 6, fontStyle: 'italic', color: '#6b7280' }}>{c.matchResult.reasoning}</div>
              ) : null}

              {c.status === 'discovered' ? (
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600 }}>
                    Affiliate URL (paste EarnKaro link)
                    <input
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
                      value={affiliateInputs[c._id] || ''}
                      onChange={(e) => setAffiliateInputs({ ...affiliateInputs, [c._id]: e.target.value })}
                      placeholder="https://ekaro.in/..."
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" style={{ ...buttonStyle, fontSize: 12, padding: '6px 12px' }} onClick={() => handleAccept(c)}>Accept</button>
                    <button type="button" style={{ ...secondaryButtonStyle, fontSize: 12, padding: '6px 12px' }} onClick={() => handleReject(c._id)}>Reject</button>
                    <button type="button" style={{ ...secondaryButtonStyle, fontSize: 12, padding: '6px 12px', color: '#991b1b' }} onClick={() => handleRemove(c._id)}>Remove</button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
