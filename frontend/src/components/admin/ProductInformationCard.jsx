import { errorTextStyle, helpTextStyle, inputStyle, labelStyle, panelStyle } from './editorStyles.js';
import ProductImagesCard from './ProductImagesCard.jsx';

export default function ProductInformationCard({
  form,
  onChange,
  errors = {},
  disabled = false,
  uploadingImages = false,
  onUploadFiles,
}) {
  const set = (field, value) => onChange({ ...form, [field]: value });

  return (
    <div className="product-info-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: 24, alignItems: 'start' }}>
      <section style={panelStyle}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Product Information</h2>
        <p style={{ ...helpTextStyle, marginTop: 0 }}>Basic catalog fields. Extracted values are editable.</p>
        <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <label style={labelStyle}>
            Brand
            <input style={inputStyle} list="product-brand-suggestions" value={form.brand} disabled={disabled} placeholder="e.g. Minimalist" onChange={(event) => set('brand', event.target.value)} />
            {errors.brand ? <span style={errorTextStyle}>{errors.brand}</span> : null}
          </label>
          <label style={labelStyle}>
            Product Name
            <input style={inputStyle} value={form.name} disabled={disabled} placeholder="e.g. Niacinamide 10% Serum" onChange={(event) => set('name', event.target.value)} />
            {errors.name ? <span style={errorTextStyle}>{errors.name}</span> : null}
          </label>
          <label style={labelStyle}>
            Product URL
            <input style={inputStyle} value={form.sourceUrl} disabled={disabled} placeholder="https://example.com/product/..." onChange={(event) => set('sourceUrl', event.target.value)} />
          </label>
          <label style={labelStyle}>
            Product Description
            <textarea
              style={{ ...inputStyle, minHeight: 160, resize: 'vertical', lineHeight: 1.5 }}
              value={form.description}
              disabled={disabled}
              placeholder="Describe the product, usage, and who it is for."
              onChange={(event) => set('description', event.target.value)}
            />
          </label>
        </div>
      </section>
      <ProductImagesCard
        images={form.images || []}
        disabled={disabled}
        uploading={uploadingImages}
        onChange={(images) => set('images', images)}
        onUploadFiles={onUploadFiles}
      />
    </div>
  );
}
