import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import ProductEditor from '../../components/admin/ProductEditor.jsx';
import { buttonStyle, panelStyle, secondaryButtonStyle } from '../../components/admin/editorStyles.js';
import {
  createProduct,
  createProductImport,
  extractProductFromImport,
  getBrands,
  getCategories,
  getRetailers,
  uploadProductImage,
  setPrimaryProductImage,
} from '../../api/adminApi.js';
import {
  emptyProductFormData,
  formToSavePayload,
  mergeExtractedIntoForm,
  validateProductForm,
} from '../../utils/productFormConstants.js';

const unwrapList = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);

export default function AdminAddProductPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [form, setForm] = useState(emptyProductFormData);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('info');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [replaceIngredients, setReplaceIngredients] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [retailers, setRetailers] = useState([]);

  useEffect(() => {
    Promise.all([getBrands(), getCategories(), getRetailers()])
      .then(([brandRes, categoryRes, retailerRes]) => {
        setBrands(unwrapList(brandRes));
        setCategories(unwrapList(categoryRes));
        setRetailers(unwrapList(retailerRes));
      })
      .catch(() => {});
  }, []);

  const appendLocalFiles = (files) => {
    setForm((current) => {
      const nextImages = [...(current.images || [])];
      files.forEach((file) => {
        const duplicate = nextImages.some((image) => image.file && image.file.name === file.name && image.file.size === file.size);
        if (duplicate) return;
        nextImages.push({
          key: `file-${file.name}-${file.size}-${Date.now()}`,
          url: URL.createObjectURL(file),
          publicId: '',
          isPrimary: nextImages.length === 0,
          _id: null,
          file,
        });
      });
      return { ...current, images: nextImages };
    });
  };

  const handleExtract = async (event) => {
    event.preventDefault();
    if (!url.trim()) {
      setMessageTone('error');
      setMessage('Please paste a product URL before extracting.');
      return;
    }
    if (isExtracting) return;

    setIsExtracting(true);
    setMessageTone('info');
    setMessage('Extracting product...');

    try {
      const createdImport = await createProductImport({ sourceUrl: url.trim() });
      const importId = createdImport?._id || createdImport?.data?._id;
      if (!importId) throw new Error('The product import was created but no ID was returned.');

      const extracted = await extractProductFromImport(importId);
      const importRecord = extracted?.data || extracted;
      const extractedData = importRecord?.extractedData || {};
      setForm((current) => mergeExtractedIntoForm(current, extractedData, {
        sourceUrl: url.trim(),
        replaceIngredients,
      }));
      setMessageTone(extracted?.success === false ? 'error' : 'success');
      setMessage(extracted?.message || 'Product details fetched. Review and edit before saving.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error?.message || error?.data?.message || 'Unable to extract product details.');
    } finally {
      setIsExtracting(false);
    }
  };

  const persistPendingImages = async (productId, images) => {
    const pending = images.filter((image) => image.file);
    if (!pending.length) return;
    setUploadingImages(true);
    try {
      for (const image of pending) {
        const uploaded = await uploadProductImage(productId, image.file);
        if (image.isPrimary) {
          const imageId = uploaded?.data?.image?._id || uploaded?.image?._id;
          if (imageId) await setPrimaryProductImage(productId, imageId);
        }
      }
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSave = async () => {
    const nextErrors = validateProductForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessageTone('error');
      setMessage('Please fix the highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setMessageTone('info');
    setMessage('Saving Product...');
    try {
      const payload = formToSavePayload(form);
      payload.source = form.sourceUrl ? 'ai_import' : 'manual';
      payload.isActive = false;
      const result = await createProduct(payload);
      const product = result?.data || result;
      const productId = product?._id;
      if (!productId) throw new Error('Product was saved but no ID was returned.');
      await persistPendingImages(productId, form.images || []);
      setMessageTone('success');
      setMessage('Product saved successfully.');
      navigate(`/admin/products/${productId}`);
    } catch (error) {
      setMessageTone('error');
      setMessage(error?.message || 'Unable to save the product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>Operations</div>
            <h1 style={{ margin: '8px 0 8px', fontSize: 36 }}>Add Product</h1>
            <p style={{ margin: 0, color: '#6b7280', maxWidth: 640, lineHeight: 1.6 }}>
              Import a product, review the extracted information, edit anything you need, add ingredients and purchase options, then save the product.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/admin/products" style={{ ...secondaryButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cancel</Link>
            <button type="button" style={{ ...buttonStyle, minWidth: 160 }} disabled={isSaving || isExtracting} onClick={handleSave}>
              {isSaving ? 'Saving Product...' : 'Save Product'}
            </button>
          </div>
        </div>

        {message ? (
          <p role="status" style={{
            margin: '0 0 20px',
            padding: '12px 16px',
            borderRadius: 12,
            background: messageTone === 'error' ? '#fef2f2' : messageTone === 'success' ? '#ecfdf3' : '#f3f4f6',
            color: messageTone === 'error' ? '#991b1b' : '#111827',
          }}
          >
            {message}
          </p>
        ) : null}

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Import Product</h2>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
            Enter a product page URL to automatically retrieve available product information, images and other details.
          </p>
          <form onSubmit={handleExtract}>
            <label htmlFor="product-url" style={{ display: 'grid', gap: 8, fontWeight: 600, fontSize: 13, color: '#374151' }}>
              Product URL
              <input
                id="product-url"
                type="url"
                value={url}
                disabled={isExtracting}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/product/..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 16 }}
              />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13, color: '#4b5563' }}>
              <input type="checkbox" checked={replaceIngredients} onChange={(event) => setReplaceIngredients(event.target.checked)} />
              Replace the current ingredient list if extraction finds ingredients
            </label>
            <button type="submit" disabled={isExtracting} style={{ ...buttonStyle, marginTop: 16 }}>
              {isExtracting ? 'Extracting product...' : 'Extract Product'}
            </button>
          </form>
        </section>

        <ProductEditor
          form={form}
          onChange={setForm}
          errors={errors}
          disabled={isExtracting || isSaving}
          uploadingImages={uploadingImages}
          onUploadFiles={appendLocalFiles}
          retailers={retailers}
          brands={brands}
          categories={categories}
          editingOptionId={editingOptionId}
          onEditingOptionIdChange={setEditingOptionId}
          onCancel={() => navigate('/admin/products')}
          onSave={handleSave}
          saving={isSaving}
          saveLabel="Save Product"
        />
      </div>
    </AdminLayout>
  );
}
