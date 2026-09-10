import ProductEditor from './ProductEditor.jsx';

export { panelStyle, buttonStyle, secondaryButtonStyle } from './editorStyles.js';

export default function ProductDataForm({ form, onChange, disabled = false, errors = {}, retailers = [], brands = [], categories = [], editingOptionId, onEditingOptionIdChange, uploadingImages, onUploadFiles }) {
  return (
    <ProductEditor
      form={form}
      onChange={onChange}
      disabled={disabled}
      errors={errors}
      retailers={retailers}
      brands={brands}
      categories={categories}
      editingOptionId={editingOptionId}
      onEditingOptionIdChange={onEditingOptionIdChange}
      uploadingImages={uploadingImages}
      onUploadFiles={onUploadFiles}
      showActions={false}
    />
  );
}
