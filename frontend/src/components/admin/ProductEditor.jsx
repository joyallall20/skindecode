import ProductInformationCard from './ProductInformationCard.jsx';
import ProductDetailsCard from './ProductDetailsCard.jsx';
import IngredientsCard from './IngredientsCard.jsx';
import PurchaseOptionsCard from './PurchaseOptionsCard.jsx';
import { buttonStyle, secondaryButtonStyle } from './editorStyles.js';

export default function ProductEditor({
  form,
  onChange,
  errors = {},
  disabled = false,
  uploadingImages = false,
  onUploadFiles,
  retailers = [],
  brands = [],
  categories = [],
  editingOptionId,
  onEditingOptionIdChange,
  onCancel,
  onSave,
  saveLabel = 'Save Product',
  saving = false,
  showActions = true,
  showPurchaseOptions = true,
}) {
  return (
    <div>
      <style>{`
        @media (max-width: 900px) {
          .product-info-layout, .product-details-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <datalist id="product-brand-suggestions">
        {brands.map((brand) => <option key={brand._id || brand.name} value={brand.name} />)}
      </datalist>
      <datalist id="product-category-suggestions">
        {categories.map((category) => <option key={category._id || category.name} value={category.name} />)}
      </datalist>

      <ProductInformationCard
        form={form}
        onChange={onChange}
        errors={errors}
        disabled={disabled}
        uploadingImages={uploadingImages}
        onUploadFiles={onUploadFiles}
      />
      <ProductDetailsCard form={form} onChange={onChange} errors={errors} disabled={disabled} />
      <IngredientsCard form={form} onChange={onChange} disabled={disabled} />
      {showPurchaseOptions ? (
        <PurchaseOptionsCard
          options={form.purchaseOptions || []}
          onChange={(purchaseOptions) => onChange({ ...form, purchaseOptions })}
          errors={errors}
          disabled={disabled}
          retailers={retailers}
          editingId={editingOptionId}
          onEditingIdChange={onEditingOptionIdChange}
        />
      ) : null}

      {showActions ? (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '8px 0 24px',
      }}
      >
        <button type="button" style={secondaryButtonStyle} disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="button" style={{ ...buttonStyle, minWidth: 180 }} disabled={saving || disabled} onClick={onSave}>
          {saving ? 'Saving Product...' : saveLabel}
        </button>
      </div>
      ) : null}
    </div>
  );
}

export { panelStyle, buttonStyle, secondaryButtonStyle } from './editorStyles.js';
