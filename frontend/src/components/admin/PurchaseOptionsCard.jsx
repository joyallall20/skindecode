import { CURRENCY_OPTIONS, SUGGESTED_RETAILERS, emptyPurchaseOption, formatPrice } from '../../utils/productFormConstants.js';
import { buttonStyle, errorTextStyle, helpTextStyle, inputStyle, labelStyle, panelStyle, secondaryButtonStyle } from './editorStyles.js';

export default function PurchaseOptionsCard({
  options = [],
  onChange,
  errors = {},
  disabled = false,
  retailers = [],
  editingId,
  onEditingIdChange,
}) {
  const retailerNames = [...new Set([...SUGGESTED_RETAILERS, ...retailers.map((item) => item.name).filter(Boolean)])];

  const updateOption = (localId, patch) => {
    onChange(options.map((option) => (option.localId === localId ? { ...option, ...patch } : option)));
  };

  const removeOption = (localId) => {
    onChange(options.filter((option) => option.localId !== localId));
    if (editingId === localId) onEditingIdChange(null);
  };

  const addOption = () => {
    const next = emptyPurchaseOption();
    onChange([...options, next]);
    onEditingIdChange(next.localId);
  };

  return (
    <section style={panelStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Purchase Options</h2>
      <p style={{ ...helpTextStyle, marginTop: 0 }}>
        The same product can be sold on multiple websites at different prices. Affiliate URLs are entered by the admin and are not generated automatically.
      </p>

      {options.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No purchase options yet. Add Amazon, Nykaa, or any other retailer.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          {options.map((option, index) => {
            const isEditing = editingId === option.localId;
            return (
              <div key={option.localId} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 16, background: '#fafafa' }}>
                {!isEditing ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{option.retailer || 'Untitled retailer'}</div>
                      <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                        {formatPrice(option.price, option.currency)} · {option.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={secondaryButtonStyle} disabled={disabled} onClick={() => onEditingIdChange(option.localId)}>Edit</button>
                      <button type="button" style={{ ...secondaryButtonStyle, color: '#991b1b' }} disabled={disabled} onClick={() => removeOption(option.localId)}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                      <label style={labelStyle}>
                        Retailer / Website
                        <input
                          style={inputStyle}
                          list="retailer-suggestions"
                          value={option.retailer}
                          disabled={disabled}
                          placeholder="Amazon"
                          onChange={(event) => updateOption(option.localId, { retailer: event.target.value })}
                        />
                        {errors[`purchaseOptions.${index}.retailer`] ? <span style={errorTextStyle}>{errors[`purchaseOptions.${index}.retailer`]}</span> : null}
                      </label>
                      <label style={labelStyle}>
                        Price
                        <input
                          style={inputStyle}
                          type="number"
                          min="0"
                          step="0.01"
                          value={option.price}
                          disabled={disabled}
                          placeholder="599"
                          onChange={(event) => updateOption(option.localId, { price: event.target.value })}
                        />
                        {errors[`purchaseOptions.${index}.price`] ? <span style={errorTextStyle}>{errors[`purchaseOptions.${index}.price`]}</span> : null}
                      </label>
                      <label style={labelStyle}>
                        Currency
                        <select style={inputStyle} value={option.currency} disabled={disabled} onChange={(event) => updateOption(option.localId, { currency: event.target.value })}>
                          {CURRENCY_OPTIONS.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ ...labelStyle, alignSelf: 'end' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(option.isActive)}
                            disabled={disabled}
                            onChange={(event) => updateOption(option.localId, { isActive: event.target.checked })}
                          />
                          Active (customer-facing)
                        </span>
                      </label>
                    </div>
                    <label style={labelStyle}>
                      Product URL
                      <input
                        style={inputStyle}
                        value={option.productUrl}
                        disabled={disabled}
                        placeholder="https://amazon.in/product/..."
                        onChange={(event) => updateOption(option.localId, { productUrl: event.target.value })}
                      />
                      {errors[`purchaseOptions.${index}.productUrl`] ? <span style={errorTextStyle}>{errors[`purchaseOptions.${index}.productUrl`]}</span> : null}
                    </label>
                    <label style={labelStyle}>
                      Affiliate Link
                      <input
                        style={inputStyle}
                        value={option.affiliateUrl}
                        disabled={disabled}
                        placeholder="Paste the affiliate URL. Leave empty if you do not have one yet."
                        onChange={(event) => updateOption(option.localId, { affiliateUrl: event.target.value })}
                      />
                      {errors[`purchaseOptions.${index}.affiliateUrl`] ? <span style={errorTextStyle}>{errors[`purchaseOptions.${index}.affiliateUrl`]}</span> : null}
                    </label>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" style={secondaryButtonStyle} onClick={() => onEditingIdChange(null)}>Done</button>
                      <button type="button" style={{ ...buttonStyle, background: '#991b1b' }} onClick={() => removeOption(option.localId)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <datalist id="retailer-suggestions">
        {retailerNames.map((name) => <option key={name} value={name} />)}
      </datalist>

      <button type="button" style={{ ...secondaryButtonStyle, marginTop: 16 }} disabled={disabled} onClick={addOption}>
        + Add Purchase Option
      </button>
    </section>
  );
}
