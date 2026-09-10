import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { panelStyle, buttonStyle, secondaryButtonStyle } from '../../components/admin/ProductDataForm.jsx';
import {
  testProductIntelligence,
  getIntelligenceAuditReport,
  runProfileMatchingAudit,
} from '../../api/adminApi.js';
import { getProducts } from '../../api/productApi.js';
import {
  SKIN_TYPES, CONCERNS,
} from '../../utils/productFormConstants.js';

const SENSITIVITY = ['low', 'medium', 'high', 'unknown'];
const MORNING_SKIN_FEEL = ['dry', 'balanced', 'slightly-oily', 'very-oily', 'combination-feel', 'unknown'];
const RESPONSE = ['no-reaction', 'sometimes-irritated', 'often-irritated', 'very-easily-irritated', 'unknown'];
const SUNSCREEN = ['every-day', 'sometimes', 'rarely-never', 'unknown'];
const AGE_RANGE = ['under-18', '18-24', '25-34', '35-44', '45-plus', 'unknown'];
const PRIMARY_GOAL = ['clearer-skin', 'brighter-even', 'hydration', 'smoother-texture', 'less-oiliness', 'anti-aging', 'healthier-skin', 'unknown'];
const CURRENT_PRODUCTS = ['cleanser', 'moisturizer', 'sunscreen', 'serum', 'exfoliant', 'treatment', 'eye-cream', 'none'];
const PREFERENCES = ['cruelty-free', 'vegan', 'fragrance-free', 'reef-safe', 'no-specific-preference'];

const emptyProfile = () => ({
  skinType: 'unknown',
  sensitivity: 'unknown',
  morningSkinFeel: 'unknown',
  responseToNewProducts: 'unknown',
  sunscreenHabit: 'unknown',
  ageRange: 'unknown',
  primaryGoal: 'unknown',
  concerns: [],
  allergies: '',
  avoidedIngredients: '',
  mustHavePreferences: [],
  currentProducts: [],
});

const selectStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' };

export default function AdminIntelligenceTestPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [profile, setProfile] = useState(emptyProfile());
  const [generateIntelligence, setGenerateIntelligence] = useState(false);
  const [result, setResult] = useState(null);
  const [auditReport, setAuditReport] = useState(null);
  const [matchingAudit, setMatchingAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getProducts({ limit: 100, isActive: 'all' }).then((res) => {
      const list = res?.data ?? res ?? [];
      setProducts(Array.isArray(list) ? list : []);
    }).catch(() => {});
    getIntelligenceAuditReport().then((res) => {
      setAuditReport(res?.data ?? res);
    }).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === productId);

  const handleTest = async () => {
    if (!productId) {
      setMessage('Select a product first.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const skinProfile = {
        ...profile,
        allergies: profile.allergies.split(',').map((s) => s.trim()).filter(Boolean),
        avoidedIngredients: profile.avoidedIngredients.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const response = await testProductIntelligence({ productId, skinProfile, generateIntelligence });
      setResult(response?.data ?? response);
      setMessage('Test completed.');
    } catch (error) {
      setMessage(error?.message || 'Test failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunMatchingAudit = async () => {
    setLoading(true);
    try {
      const response = await runProfileMatchingAudit({});
      setMatchingAudit(response?.data ?? response);
      setMessage(`Matching audit: ${response?.data?.summary?.passed ?? response?.summary?.passed} passed of ${response?.data?.summary?.total ?? response?.summary?.total}`);
    } catch (error) {
      setMessage(error?.message || 'Audit failed.');
    } finally {
      setLoading(false);
    }
  };

  const setProfileField = (field, value) => setProfile({ ...profile, [field]: value });

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Development</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32 }}>Intelligence Testing</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Test product intelligence generation and profile-based matching separately.
          </p>
        </div>

        {message ? <p style={{ marginBottom: 16, padding: 10, background: '#f3f4f6', borderRadius: 8 }}>{message}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Test Profile</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['skinType', SKIN_TYPES.concat(['unknown'])],
                ['sensitivity', SENSITIVITY],
                ['morningSkinFeel', MORNING_SKIN_FEEL],
                ['responseToNewProducts', RESPONSE],
                ['sunscreenHabit', SUNSCREEN],
                ['ageRange', AGE_RANGE],
                ['primaryGoal', PRIMARY_GOAL],
              ].map(([field, options]) => (
                <label key={field} style={{ fontSize: 13, fontWeight: 600 }}>
                  {field}
                  <select style={selectStyle} value={profile[field]} onChange={(e) => setProfileField(field, e.target.value)}>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>
              ))}
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Allergies (comma-separated)
                <input style={selectStyle} value={profile.allergies} onChange={(e) => setProfileField('allergies', e.target.value)} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Avoided Ingredients (comma-separated)
                <input style={selectStyle} value={profile.avoidedIngredients} onChange={(e) => setProfileField('avoidedIngredients', e.target.value)} />
              </label>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Concerns</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CONCERNS.map((c) => (
                    <label key={c} style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={profile.concerns.includes(c)} onChange={(e) => {
                        if (e.target.checked) setProfileField('concerns', [...profile.concerns, c]);
                        else setProfileField('concerns', profile.concerns.filter((x) => x !== c));
                      }} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Preferences</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PREFERENCES.map((p) => (
                    <label key={p} style={{ fontSize: 12 }}>
                      <input type="checkbox" checked={profile.mustHavePreferences.includes(p)} onChange={(e) => {
                        if (e.target.checked) setProfileField('mustHavePreferences', [...profile.mustHavePreferences, p]);
                        else setProfileField('mustHavePreferences', profile.mustHavePreferences.filter((x) => x !== p));
                      }} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Product</h2>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'grid', gap: 6 }}>
              Select Product
              <select style={selectStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— Select —</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name} ({p.brand?.name || 'no brand'})</option>
                ))}
              </select>
            </label>
            {selectedProduct ? (
              <div style={{ marginTop: 16, fontSize: 13, display: 'grid', gap: 6 }}>
                <div><strong>Name:</strong> {selectedProduct.name}</div>
                <div><strong>Intelligence:</strong> {selectedProduct.productIntelligence?.explanation ? 'Generated' : 'Missing'}</div>
                <div><strong>Skin types:</strong> {(selectedProduct.skinTypes || []).join(', ') || '—'}</div>
                <div><strong>Concerns:</strong> {(selectedProduct.concerns || []).join(', ') || '—'}</div>
              </div>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13 }}>
              <input type="checkbox" checked={generateIntelligence} onChange={(e) => setGenerateIntelligence(e.target.checked)} />
              Call AI to generate fresh intelligence (uses GEMINI_API_KEY)
            </label>
            <button type="button" style={{ ...buttonStyle, marginTop: 16 }} disabled={loading} onClick={handleTest}>
              {loading ? 'Testing…' : 'Test Product Intelligence'}
            </button>
            <button type="button" style={{ ...secondaryButtonStyle, marginTop: 10 }} disabled={loading} onClick={handleRunMatchingAudit}>
              Run Profile Matching Audit
            </button>
          </section>
        </div>

        {result ? (
          <section style={{ ...panelStyle, marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>Result</h2>
            <h3 style={{ fontSize: 15 }}>Intelligence Input</h3>
            <pre style={{ background: '#f9fafb', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
              {JSON.stringify(result.intelligenceInput, null, 2)}
            </pre>
            {result.profileMatch ? (
              <>
                <h3 style={{ fontSize: 15 }}>Profile Match (User-Product Layer)</h3>
                <div style={{ fontSize: 13, display: 'grid', gap: 6 }}>
                  <div><strong>Score:</strong> {result.profileMatch.score}</div>
                  <div><strong>Matched factors:</strong> {(result.profileMatch.matchedFactors || []).join('; ') || '—'}</div>
                  <div><strong>Explanation:</strong> {result.profileMatch.explanation}</div>
                </div>
              </>
            ) : null}
            {result.productIntelligence ? (
              <>
                <h3 style={{ fontSize: 15 }}>Product Intelligence</h3>
                <pre style={{ background: '#f9fafb', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
                  {JSON.stringify(result.productIntelligence, null, 2)}
                </pre>
              </>
            ) : null}
            {result.audit ? (
              <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 12 }}>
                <strong>Audit</strong>
                <div>Prompt version: {result.audit.promptVersion}</div>
                <div>Knowledge version: {result.audit.knowledgeVersion}</div>
                <div>Fields used (intelligence): {result.audit.fieldsUsed?.join(', ')}</div>
                <div>Skin profile in intelligence: {result.audit.skinProfileUsedInProductIntelligence ? 'Yes' : 'No'}</div>
                <div>Skin profile in matching: {result.audit.skinProfileUsedInMatching ? 'Yes' : 'No'}</div>
                <div>Warnings: {(result.warnings || []).join('; ') || 'None'}</div>
                <div>Missing data: {(result.missingData || []).join(', ') || 'None'}</div>
              </div>
            ) : null}
          </section>
        ) : null}

        {matchingAudit?.summary ? (
          <section style={{ ...panelStyle, marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>Matching Audit Summary</h2>
            <div style={{ fontSize: 14 }}>
              Total: {matchingAudit.summary.total} · Passed: {matchingAudit.summary.passed} · Failed: {matchingAudit.summary.failed}
            </div>
            <pre style={{ marginTop: 12, fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f9fafb', padding: 12, borderRadius: 8 }}>
              {JSON.stringify(matchingAudit.summary.coverage, null, 2)}
            </pre>
          </section>
        ) : null}

        {auditReport ? (
          <section style={{ ...panelStyle, marginTop: 24 }}>
            <h2 style={{ marginTop: 0 }}>System Audit</h2>
            <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#f9fafb', padding: 12, borderRadius: 8 }}>
              {JSON.stringify(auditReport, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  );
}
