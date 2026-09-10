import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import ProductEditor from '../../components/admin/ProductEditor.jsx';
import PurchaseOptionsCard from '../../components/admin/PurchaseOptionsCard.jsx';
import IntelligencePanel, { PublishPanel } from '../../components/admin/IntelligencePanel.jsx';
import SellerDiscoveryPanel from '../../components/admin/SellerDiscoveryPanel.jsx';
import { panelStyle, buttonStyle, secondaryButtonStyle } from '../../components/admin/editorStyles.js';
import {
  approveProductIntelligence,
  generateProductIntelligence,
  getBrands,
  getCategories,
  getProductIntelligenceInput,
  getRetailers,
  publishProduct,
  rejectProductIntelligence,
  runIngredientResearch,
  setPrimaryProductImage,
  toggleProductStatus,
  updateProduct,
  uploadProductImage,
} from '../../api/adminApi.js';
import { getProductById, getProductOffers } from '../../api/productApi.js';
import {
  emptyProductFormData,
  formToIntelligencePreview,
  formToSavePayload,
  formatPrice,
  productToForm,
  validateProductForm,
} from '../../utils/productFormConstants.js';

const unwrapList = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
const unwrapItem = (response) => response?.data ?? response ?? null;

const TABS = [
  { id: 'product', label: 'Product' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'buy', label: 'Where to Buy' },
];

export default function AdminProductDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === searchParams.get('tab')) ? searchParams.get('tab') : 'product';

  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(emptyProductFormData);
  const [errors, setErrors] = useState({});
  const [offers, setOffers] = useState([]);
  const [intelligenceInput, setIntelligenceInput] = useState(null);
  const [knowledgeCoverage, setKnowledgeCoverage] = useState(null);
  const [generationJob, setGenerationJob] = useState(null);
  const [hasPersistedIntelligence, setHasPersistedIntelligence] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [productRes, offersRes, inputRes, brandRes, categoryRes, retailerRes] = await Promise.all([
        getProductById(id),
        getProductOffers(id),
        getProductIntelligenceInput(id),
        getBrands(),
        getCategories(),
        getRetailers(),
      ]);
      const p = unwrapItem(productRes);
      const offerList = unwrapList(offersRes);
      setProduct(p);
      setOffers(offerList);
      setForm(productToForm(p, offerList));
      const inputData = unwrapItem(inputRes);
      setIntelligenceInput(inputData?.intelligenceInput || formToIntelligencePreview(productToForm(p, offerList)));
      setKnowledgeCoverage(inputData?.knowledgeCoverage || null);
      setGenerationJob(inputData?.generationJob || null);
      setHasPersistedIntelligence(Boolean(inputData?.hasIntelligence));
      setBrands(unwrapList(brandRes));
      setCategories(unwrapList(categoryRes));
      setRetailers(unwrapList(retailerRes));
    } catch (error) {
      setMessage(error?.message || 'Unable to load product.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  useEffect(() => {
    if (!product || !['queued', 'generating'].includes(product.intelligenceStatus)) return undefined;
    const intervalId = window.setInterval(() => {
      loadAll();
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [id, product?.intelligenceStatus]);

  const persistPendingImages = async (images) => {
    const pending = (images || []).filter((image) => image.file);
    if (!pending.length) return;
    setUploadingImages(true);
    try {
      for (const image of pending) {
        const uploaded = await uploadProductImage(id, image.file);
        if (image.isPrimary) {
          const imageId = uploaded?.data?.image?._id || uploaded?.image?._id;
          if (imageId) await setPrimaryProductImage(id, imageId);
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
      setMessage('Please fix the highlighted fields before saving.');
      return;
    }
    setIsSaving(true);
    try {
      await persistPendingImages(form.images || []);
      await updateProduct(id, formToSavePayload(form));
      setMessage('Product saved successfully.');
      await loadAll();
    } catch (error) {
      setMessage(error?.message || 'Unable to save the product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateProductIntelligence(id);
      setMessage(result?.message || 'Product intelligence generation queued.');
      await loadAll();
    } catch (error) {
      setMessage(error?.message || 'Intelligence generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResearch = async (ingredientName) => {
    try {
      setMessage(`Researching ${ingredientName}...`);
      await runIngredientResearch(null, { ingredientName, productId: id, productContext: product?.name });
      setMessage(`Research submitted for ${ingredientName}. Review it in Knowledge Base.`);
      await loadAll();
    } catch (error) {
      setMessage(error?.message || 'Research failed.');
    }
  };

  const previewInput = intelligenceInput || formToIntelligencePreview(form);
  const referencePrice = useMemo(() => {
    if (!offers.length) return null;
    return [...offers].sort((a, b) => Number(a.price) - Number(b.price))[0];
  }, [offers]);

  if (loading) return <AdminLayout><div style={{ maxWidth: 1120, margin: '0 auto' }}><p>Loading product workspace…</p></div></AdminLayout>;
  if (!product) return <AdminLayout><div style={{ maxWidth: 1120, margin: '0 auto' }}><p>{message || 'Product not found.'}</p></div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Product workspace</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 34 }}>{product.name}</h1>
            <div style={{ marginTop: 6, color: '#6b7280' }}>{product?.brand?.name} · {product?.category?.name} · {product.isActive ? 'Published' : 'Draft'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={secondaryButtonStyle} onClick={() => toggleProductStatus(id).then(loadAll)}>Activate / deactivate</button>
            <Link to="/admin/products" style={{ ...secondaryButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Back</Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSearchParams({ tab: item.id })}
              style={{
                ...secondaryButtonStyle,
                background: tab === item.id ? '#111827' : '#fff',
                color: tab === item.id ? '#fff' : '#111827',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {message ? <p role="status" style={{ margin: '0 0 16px', padding: '10px 14px', background: '#f3f4f6', borderRadius: 8 }}>{message}</p> : null}

        {tab === 'product' ? (
          <ProductEditor
            form={form}
            onChange={setForm}
            errors={errors}
            disabled={isSaving}
            uploadingImages={uploadingImages}
            onUploadFiles={(files) => persistPendingImages(files.map((file) => ({ file })))}
            retailers={retailers}
            brands={brands}
            categories={categories}
            showPurchaseOptions={false}
            onCancel={() => loadAll()}
            onSave={handleSave}
            saving={isSaving}
            saveLabel="Save Changes"
          />
        ) : null}

        {tab === 'intelligence' ? (
          <>
            <IntelligencePanel
              productId={id}
              intelligenceInput={previewInput}
              productIntelligence={product.productIntelligence}
              intelligenceMetadata={product.intelligenceMetadata}
              intelligenceStatus={product.intelligenceStatus}
              qualityScore={product.qualityScore}
              knowledgeCoverage={knowledgeCoverage}
              generationJob={generationJob}
              hasPersistedIntelligence={hasPersistedIntelligence}
              onResearchIngredient={handleResearch}
              onGenerate={handleGenerate}
              onApprove={async () => { setIsApproving(true); try { await approveProductIntelligence(id); await loadAll(); } finally { setIsApproving(false); } }}
              onReject={async () => { await rejectProductIntelligence(id, { reason: 'Rejected by admin.' }); await loadAll(); }}
              isGenerating={isGenerating || ['queued', 'generating'].includes(product.intelligenceStatus)}
              isApproving={isApproving}
              disabled={!previewInput.ingredients.length}
              disabledReason={!previewInput.ingredients.length ? 'Please add the full ingredient list in the Product tab before running Product Intelligence.' : null}
            />
            <PublishPanel product={product} onPublish={async () => { setIsPublishing(true); try { await publishProduct(id); await loadAll(); } finally { setIsPublishing(false); } }} isPublishing={isPublishing} />
          </>
        ) : null}

        {tab === 'buy' ? (
          <>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0 }}>Where to Buy</h2>
              <p style={{ color: '#6b7280' }}>Affiliate links and retailer prices are managed here, separately from Product Intelligence. Enter current prices manually. Do not invent affiliate URLs.</p>
              <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                <div><strong>Product:</strong> {product.name}</div>
                <div><strong>Size:</strong> {product.size || '—'}</div>
                <div><strong>Reference price:</strong> {referencePrice ? formatPrice(referencePrice.price, referencePrice.currency) : 'Not set'}</div>
              </div>
            </section>
            <PurchaseOptionsCard
              options={form.purchaseOptions || []}
              onChange={(purchaseOptions) => setForm({ ...form, purchaseOptions })}
              errors={errors}
              retailers={retailers}
              editingId={editingOptionId}
              onEditingIdChange={setEditingOptionId}
            />
            <div style={{ marginBottom: 24 }}>
              <button type="button" style={buttonStyle} disabled={isSaving} onClick={handleSave}>
                {isSaving ? 'Saving Product...' : 'Save Purchase Options'}
              </button>
            </div>
            <SellerDiscoveryPanel productId={id} />
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
