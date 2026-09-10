import { SKIN_TYPES, CONCERNS, TRI_STATE_OPTIONS } from '../../utils/productFormConstants.js';
import { helpTextStyle, inputStyle, labelStyle, panelStyle } from './editorStyles.js';

function CheckboxGroup({ label, options, values, onChange, disabled }) {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#374151' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label
              key={option}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '8px 12px',
                borderRadius: 999,
                border: `1px solid ${checked ? '#111827' : '#e5e7eb'}`,
                background: checked ? '#111827' : '#fff',
                color: checked ? '#fff' : '#374151',
                textTransform: 'capitalize',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.checked) onChange([...values, option]);
                  else onChange(values.filter((value) => value !== option));
                }}
                style={{ display: 'none' }}
              />
              {option.replace(/-/g, ' ')}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductDetailsCard({ form, onChange, errors = {}, disabled = false }) {
  const set = (field, value) => onChange({ ...form, [field]: value });

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Product Details</h2>
      <p style={{ ...helpTextStyle, marginTop: 0 }}>
        Skincare attributes used for filtering and Product Intelligence. Leave unknown values empty rather than guessing.
      </p>
      <div
        className="product-details-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginTop: 18 }}
      >
        <label style={labelStyle}>
          Category
          <input
            style={inputStyle}
            list="product-category-suggestions"
            value={form.category}
            disabled={disabled}
            placeholder="Serum, Cleanser, Moisturizer…"
            onChange={(event) => set('category', event.target.value)}
          />
          {errors.category ? <span style={{ color: '#b42318' }}>{errors.category}</span> : null}
        </label>
        <label style={labelStyle}>
          Variant
          <input style={inputStyle} value={form.variant || ''} disabled={disabled} placeholder="e.g. 10% Niacinamide" onChange={(event) => set('variant', event.target.value)} />
        </label>
        <label style={labelStyle}>
          Size
          <input style={inputStyle} value={form.size || ''} disabled={disabled} placeholder="e.g. 30 ml" onChange={(event) => set('size', event.target.value)} />
        </label>
        <label style={labelStyle}>
          Quantity
          <input style={inputStyle} value={form.quantity || ''} disabled={disabled} placeholder="e.g. Pack of 1" onChange={(event) => set('quantity', event.target.value)} />
        </label>
      </div>
      <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
        <CheckboxGroup label="Skin Type" options={SKIN_TYPES} values={form.skinTypes || []} disabled={disabled} onChange={(value) => set('skinTypes', value)} />
        <CheckboxGroup label="Concerns" options={CONCERNS} values={form.concerns || []} disabled={disabled} onChange={(value) => set('concerns', value)} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {['fragranceFree', 'alcoholFree', 'essentialOilFree', 'pregnancyFriendly'].map((field) => (
            <label key={field} style={labelStyle}>
              {field.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}
              <select style={inputStyle} value={form[field]} disabled={disabled} onChange={(event) => set(field, event.target.value)}>
                {TRI_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label style={labelStyle}>
          Claims
          <input style={inputStyle} value={form.claims || ''} disabled={disabled} placeholder="Oil-free, Non-comedogenic, Dermatologically tested" onChange={(event) => set('claims', event.target.value)} />
        </label>
      </div>
    </section>
  );
}
