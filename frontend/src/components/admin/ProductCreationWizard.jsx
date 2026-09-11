import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from './AdminLayout.jsx';
import ProductEditor from './ProductEditor.jsx';
import PurchaseOptionsCard from './PurchaseOptionsCard.jsx';
import IntelligencePanel, { PublishPanel } from './IntelligencePanel.jsx';
import SellerDiscoveryPanel from './SellerDiscoveryPanel.jsx';
import { panelStyle, buttonStyle, secondaryButtonStyle, inputStyle, labelStyle, helpTextStyle } from './editorStyles.js';
import {
  approveProductIntelligence,
  createProduct,
  createProductImport,
  extractProductFromImport,
  generateProductIntelligence,
  getBrands,
  getCategories,
  getProductIntelligenceInput,
  getRetailers,
  publishProduct,
  rejectProductIntelligence,
  setPrimaryProductImage,
  updateProduct,
  uploadProductImage,
} from '../../api/adminApi.js';
import { getProductById } from '../../api/productApi.js';
import {
  emptyProductFormData,
  formatPrice,
  formToIntelligencePreview,
  formToSavePayload,
  mergeExtractedIntoForm,
  parseFormIngredientList,
  productToForm,
  toEditorImages,
  validateProductForm,
} from '../../utils/productFormConstants.js';

const unwrapItem = (response) => response?.data ?? response ?? null;
const unwrapList = (response) => (Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);

const STEPS = [
  { id: 1, label: 'Source' },
  { id: 2, label: 'Product Data' },
  { id: 3, label: 'Pricing' },
  { id: 4, label: 'Intelligence' },
];

function WizardStepper({ current, maxReached, onStepClick }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: '18px 20px',
      marginBottom: 24,
      overflowX: 'auto',
    }}
    >
      {STEPS.map((step, index) => {
        const status = step.id < current ? 'complete' : step.id === current ? 'current' : 'upcoming';
        const clickable = step.id <= maxReached && step.id !== current;
        const circleColors = {
          complete: { background: '#111827', color: '#fff', border: '#111827' },
          current: { background: '#eff6ff', color: '#1d4ed8', border: '#1d4ed8' },
          upcoming: { background: '#f3f4f6', color: '#9ca3af', border: '#e5e7eb' },
        }[status];
        const labelColor = status === 'upcoming' ? '#9ca3af' : '#111827';

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: index < STEPS.length - 1 ? 1 : 'none' }}>
            <button
              type="button"
              onClick={() => clickable && onStepClick(step.id)}
              disabled={!clickable}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: clickable ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: circleColors.background,
                  color: circleColors.color,
                  border: `2px solid ${circleColors.border}`,
                }}
              >
                {status === 'complete' ? '✓' : step.id}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: labelColor }}>{step.label}</span>
            </button>
            {index < STEPS.length - 1 ? (
              <div style={{ flex: 1, height: 2, background: '#e5e7eb', margin: '0 14px', minWidth: 24 }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ReadinessChecklist({ form, productId }) {
  const ingredientCount = parseFormIngredientList(form.ingredients).length;
  const hasPrice = (form.purchaseOptions || []).some((option) => option.price !== '' && option.price !== null && !Number.isNaN(Number(option.price)));
  const items = [
    { label: 'Product information', done: Boolean(form.name?.trim() && form.brand?.trim() && form.category?.trim()) },
    { label: 'Complete ingredient list', done: ingredientCount > 0 },
    { label: 'Size & price', done: Boolean(form.size?.trim()) && hasPrice },
    { label: 'Purchase information', done: (form.purchaseOptions || []).length > 0 },
    { label: 'Product images', done: (form.images || []).length > 0 },
  ];

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>Product Ready</h2>
      <p style={{ ...helpTextStyle, marginTop: 0 }}>
        {productId ? 'Everything below reflects what is currently saved to the catalog.' : 'Save the product before generating intelligence.'}
      </p>
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              background: item.done ? '#dcfce7' : '#f3f4f6',
              color: item.done ? '#166534' : '#9ca3af',
            }}
            >
              {item.done ? '✓' : '○'}
            </span>
            <span style={{ color: item.done ? '#111827' : '#6b7280' }}>{item.label}{item.label === 'Product images' && !item.done ? ' (optional)' : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProductCreationWizard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [step, setStep] = useState(() => {
    const initial = Number(searchParams.get('step'));
    return initial >= 1 && initial <= 4 ? initial : 1;
  });
  const [maxStepReached, setMaxStepReached] = useState(step);

  const [sourceUrl, setSourceUrl] = useState('');
  const [replaceIngredients, setReplaceIngredients] = useState(false);
  const [importId, setImportId] = useState(searchParams.get('import') || null);
  const [productId, setProductId] = useState(searchParams.get('product') || null);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(emptyProductFormData);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { type: 'success' | 'error' | 'info', text }

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [editingOptionId, setEditingOptionId] = useState(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isResuming, setIsResuming] = useState(Boolean(searchParams.get('product')));

  const [intelligenceInput, setIntelligenceInput] = useState(null);
  const [knowledgeCoverage, setKnowledgeCoverage] = useState(null);
  const [generationJob, setGenerationJob] = useState(null);
  const [hasPersistedIntelligence, setHasPersistedIntelligence] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const setSuccessMessage = (text) => setMessage({ type: 'success', text });
  const setErrorMessage = (text) => setMessage({ type: 'error', text });
  const setInfoMessage = (text) => setMessage({ type: 'info', text });

  useEffect(() => {
    Promise.all([getBrands(), getCategories(), getRetailers()])
      .then(([brandRes, categoryRes, retailerRes]) => {
        setBrands(unwrapList(brandRes));
        setCategories(unwrapList(categoryRes));
        setRetailers(unwrapList(retailerRes));
      })
      .catch(() => {});
  }, []);

  // Resume support: if we land on this page with an existing product id (refresh, back button),
  // reload the persisted product and unlock the whole wizard rather than restarting from scratch.
  useEffect(() => {
    const resumeId = searchParams.get('product');
    if (!resumeId) return;
    (async () => {
      try {
        const productRes = await getProductById(resumeId);
        const loaded = unwrapItem(productRes);
        setForm(productToForm(loaded, []));
        setProductId(resumeId);
        setProduct(loaded);
        setMaxStepReached(4);
        setStep((current) => (current === 1 ? 4 : current));
      } catch (error) {
        setErrorMessage(error?.message || 'Unable to resume the saved product. Starting a new one.');
      } finally {
        setIsResuming(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToStep = (targetStep, { markReached = false } = {}) => {
    setStep(targetStep);
    if (markReached) setMaxStepReached((current) => Math.max(current, targetStep));
    const next = new URLSearchParams(searchParams);
    next.set('step', String(targetStep));
    if (importId) next.set('import', importId);
    if (productId) next.set('product', productId);
    setSearchParams(next, { replace: true });
  };

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

  const persistPendingImages = async (id, images) => {
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

  const refreshProductImages = async (id) => {
    try {
      const res = await getProductById(id);
      const loaded = unwrapItem(res);
      if (loaded?.images) {
        setForm((current) => ({ ...current, images: toEditorImages(loaded.images) }));
      }
    } catch {
      // Non-fatal — local previews stay visible even if the refresh fails.
    }
  };

  // ---------------- STEP 1: SOURCE ----------------

  const handleExtract = async (event) => {
    event.preventDefault();
    if (!sourceUrl.trim()) {
      setErrorMessage('Please paste a product URL before extracting.');
      return;
    }
    if (isExtracting) return;

    setIsExtracting(true);
    setInfoMessage('Extracting product…');
    try {
      const createdImport = await createProductImport({ sourceUrl: sourceUrl.trim() });
      const newImportId = unwrapItem(createdImport)?._id;
      if (!newImportId) throw new Error('The product import was created but no ID was returned.');
      setImportId(newImportId);

      const extracted = await extractProductFromImport(newImportId);
      const importRecord = unwrapItem(extracted);
      const extractedData = importRecord?.extractedData || {};

      setForm((current) => {
        const merged = mergeExtractedIntoForm(current, extractedData, {
          sourceUrl: sourceUrl.trim(),
          replaceIngredients,
        });
        // Images are intentionally never auto-collected from the scraper — keep
        // whatever the admin had already added manually, drop anything extracted.
        return { ...merged, images: current.images || [] };
      });

      setMessage({
        type: extracted?.success === false ? 'error' : 'success',
        text: extracted?.message || 'Product details fetched. Review and edit before continuing.',
      });
      goToStep(2, { markReached: true });
    } catch (error) {
      setErrorMessage(error?.message || error?.data?.message || 'Unable to extract product details.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSkipExtraction = () => {
    setMessage(null);
    goToStep(2, { markReached: true });
  };

  // ---------------- STEP 2: PRODUCT DATA ----------------

  const handleSaveStep2 = async () => {
    const allErrors = validateProductForm(form);
    // Purchase-option fields aren't editable on this step (they live in Step 3),
    // so don't block "Save & Continue" here on errors the admin can't see or fix yet.
    const blockingErrors = Object.fromEntries(Object.entries(allErrors).filter(([key]) => !key.startsWith('purchaseOptions.')));
    setErrors(blockingErrors);
    if (Object.keys(blockingErrors).length) {
      setErrorMessage('Please fix the highlighted fields before continuing.');
      return;
    }

    setIsSaving(true);
    setInfoMessage('Saving product data…');
    try {
      const payload = formToSavePayload(form);
      payload.isActive = false;

      if (!productId) {
        payload.source = form.sourceUrl ? 'ai_import' : 'manual';
        const result = await createProduct(payload);
        const created = unwrapItem(result);
        const newId = created?._id;
        if (!newId) throw new Error('Product was saved but no ID was returned.');
        setProductId(newId);
        setProduct(created);
        await persistPendingImages(newId, form.images || []);
        await refreshProductImages(newId);
      } else {
        const result = await updateProduct(productId, payload);
        setProduct(unwrapItem(result) || product);
        await persistPendingImages(productId, form.images || []);
        await refreshProductImages(productId);
      }

      setSuccessMessage('Product data saved.');
      goToStep(3, { markReached: true });
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save product data.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- STEP 3: PRICING & SELLERS ----------------

  const handleSaveStep3 = async () => {
    const allErrors = validateProductForm(form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length) {
      setErrorMessage('Please fix the highlighted fields before continuing.');
      return;
    }
    if (!productId) {
      setErrorMessage('Save the product in Step 2 first.');
      return;
    }

    setIsSaving(true);
    setInfoMessage('Saving pricing…');
    try {
      const payload = formToSavePayload(form);
      payload.isActive = false;
      const result = await updateProduct(productId, payload);
      setProduct(unwrapItem(result) || product);
      setSuccessMessage('Pricing saved.');
      await loadIntelligenceStage(productId);
      goToStep(4, { markReached: true });
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save pricing.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------- STEP 4: INTELLIGENCE & PUBLISH ----------------

  const loadIntelligenceStage = async (targetId) => {
    const pid = targetId || productId;
    if (!pid) return;
    try {
      const [productRes, inputRes] = await Promise.all([
        getProductById(pid),
        getProductIntelligenceInput(pid),
      ]);
      const loaded = unwrapItem(productRes);
      setProduct(loaded);
      const inputData = unwrapItem(inputRes);
      setIntelligenceInput(inputData?.intelligenceInput || formToIntelligencePreview(form));
      setKnowledgeCoverage(inputData?.knowledgeCoverage || null);
      setGenerationJob(inputData?.generationJob || null);
      setHasPersistedIntelligence(Boolean(inputData?.hasIntelligence));
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to load intelligence data.');
    }
  };

  useEffect(() => {
    if (step === 4 && productId) {
      loadIntelligenceStage(productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 4 || !product || !['queued', 'generating'].includes(product.intelligenceStatus)) return undefined;
    const intervalId = window.setInterval(() => {
      loadIntelligenceStage(productId);
    }, 2000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, product?.intelligenceStatus]);

  const handleGenerate = async () => {
    if (!productId) return;
    setIsGenerating(true);
    try {
      const result = await generateProductIntelligence(productId);
      setSuccessMessage(result?.message || 'Product intelligence generation queued.');
      await loadIntelligenceStage(productId);
    } catch (error) {
      setErrorMessage(error?.message || 'Intelligence generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!productId) return;
    setIsApproving(true);
    try {
      await approveProductIntelligence(productId);
      setSuccessMessage('Product intelligence approved.');
      await loadIntelligenceStage(productId);
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to approve intelligence.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!productId) return;
    try {
      await rejectProductIntelligence(productId, { reason: 'Rejected during product creation.' });
      setInfoMessage('Product intelligence rejected. Regenerate after correcting product data.');
      await loadIntelligenceStage(productId);
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to reject intelligence.');
    }
  };

  const handlePublish = async () => {
    if (!productId) return;
    setIsPublishing(true);
    try {
      await publishProduct(productId);
      setSuccessMessage('Product published successfully.');
      await loadIntelligenceStage(productId);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to publish product.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleStartAnother = () => {
    setStep(1);
    setMaxStepReached(1);
    setSourceUrl('');
    setImportId(null);
    setProductId(null);
    setProduct(null);
    setForm(emptyProductFormData());
    setErrors({});
    setMessage(null);
    setIntelligenceInput(null);
    setKnowledgeCoverage(null);
    setGenerationJob(null);
    setHasPersistedIntelligence(false);
    navigate('/admin/products/add', { replace: true });
  };

  const previewInput = intelligenceInput || formToIntelligencePreview(form);
  const hasPersistedIngredients = Boolean(intelligenceInput?.ingredients?.length);
  const referencePrice = (form.purchaseOptions || [])
    .filter((option) => option.price !== '' && option.price !== null && !Number.isNaN(Number(option.price)))
    .sort((a, b) => Number(a.price) - Number(b.price))[0];

  if (isResuming) {
    return (
      <AdminLayout>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <p>Loading saved product…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700 }}>Operations</div>
          <h1 style={{ margin: '8px 0 8px', fontSize: 36 }}>Add Product</h1>
          <p style={{ margin: 0, color: '#6b7280', maxWidth: 640, lineHeight: 1.6 }}>
            Bring in a product, review it, price it, and publish it — all in one guided flow.
          </p>
        </div>

        <WizardStepper current={step} maxReached={maxStepReached} onStepClick={(target) => goToStep(target)} />

        {message ? (
          <p role="status" style={{
            margin: '0 0 20px',
            padding: '12px 16px',
            borderRadius: 12,
            background: message.type === 'error' ? '#fef2f2' : message.type === 'success' ? '#ecfdf3' : '#f3f4f6',
            color: message.type === 'error' ? '#991b1b' : '#111827',
          }}
          >
            {message.text}
          </p>
        ) : null}

        {step === 1 ? (
          <section style={panelStyle}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Import Product</h2>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 14 }}>
              Paste a product page URL to automatically retrieve:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginBottom: 20, color: '#374151', fontSize: 14 }}>
              {['Product name', 'Brand', 'Category', 'Variant', 'Size', 'Price', 'Ingredients', 'Key ingredients', 'Skin types', 'Concerns'].map((item) => (
                <span key={item}>✓ {item}</span>
              ))}
            </div>
            <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 13, fontStyle: 'italic' }}>
              Images are not collected automatically — you can add them manually in the next step.
            </p>
            <form onSubmit={handleExtract}>
              <label htmlFor="product-url" style={labelStyle}>
                Product URL
                <input
                  id="product-url"
                  type="url"
                  value={sourceUrl}
                  disabled={isExtracting}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/product/..."
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 13, color: '#4b5563' }}>
                <input type="checkbox" checked={replaceIngredients} onChange={(event) => setReplaceIngredients(event.target.checked)} />
                Replace the current ingredient list if extraction finds ingredients
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                <button type="submit" disabled={isExtracting} style={buttonStyle}>
                  {isExtracting ? 'Extracting product…' : 'Extract Product'}
                </button>
                <button type="button" onClick={handleSkipExtraction} disabled={isExtracting} style={{ ...secondaryButtonStyle, border: 'none', color: '#6b7280', textDecoration: 'underline' }}>
                  Skip and enter product details manually
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {step === 2 ? (
          <div>
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
              showActions={false}
              showPurchaseOptions={false}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0 24px' }}>
              <button type="button" style={secondaryButtonStyle} disabled={isSaving} onClick={() => goToStep(1)}>← Back</button>
              <button type="button" style={{ ...buttonStyle, minWidth: 180 }} disabled={isSaving} onClick={handleSaveStep2}>
                {isSaving ? 'Saving…' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <section style={panelStyle}>
              <h2 style={{ marginTop: 0, fontSize: 18 }}>Product</h2>
              <div style={{ display: 'grid', gap: 6, fontSize: 14 }}>
                <div><strong>Product:</strong> {form.name || '—'}</div>
                <div><strong>Size:</strong> {form.size || '—'}</div>
                <div><strong>Reference price:</strong> {referencePrice ? formatPrice(referencePrice.price, referencePrice.currency) : 'Not set'}</div>
              </div>
            </section>

            <PurchaseOptionsCard
              options={form.purchaseOptions || []}
              onChange={(purchaseOptions) => setForm({ ...form, purchaseOptions })}
              errors={errors}
              disabled={isSaving}
              retailers={retailers}
              editingId={editingOptionId}
              onEditingIdChange={setEditingOptionId}
            />

            {productId ? <SellerDiscoveryPanel productId={productId} /> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0 24px' }}>
              <button type="button" style={secondaryButtonStyle} disabled={isSaving} onClick={() => goToStep(2)}>← Back</button>
              <button type="button" style={{ ...buttonStyle, minWidth: 180 }} disabled={isSaving} onClick={handleSaveStep3}>
                {isSaving ? 'Saving…' : 'Save & Continue →'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div>
            <ReadinessChecklist form={form} productId={productId} />

            <IntelligencePanel
              productId={productId}
              intelligenceInput={previewInput}
              productIntelligence={product?.productIntelligence}
              intelligenceMetadata={product?.intelligenceMetadata}
              intelligenceStatus={product?.intelligenceStatus}
              qualityScore={product?.qualityScore}
              knowledgeCoverage={knowledgeCoverage}
              generationJob={generationJob}
              hasPersistedIntelligence={hasPersistedIntelligence}
              onGenerate={handleGenerate}
              onApprove={handleApprove}
              onReject={handleReject}
              isGenerating={isGenerating || ['queued', 'generating'].includes(product?.intelligenceStatus)}
              isApproving={isApproving}
              disabled={!productId || !hasPersistedIngredients}
              disabledReason={
                !productId
                  ? 'Save the product first before generating intelligence.'
                  : !hasPersistedIngredients
                    ? 'Please add the full ingredient list in Step 2 before running Product Intelligence.'
                    : null
              }
            />

            <PublishPanel product={product} onPublish={handlePublish} isPublishing={isPublishing} />

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '8px 0 24px' }}>
              <button type="button" style={secondaryButtonStyle} onClick={() => goToStep(3)}>← Back</button>
              {product?.isActive ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link to={`/admin/products/${productId}`} style={{ ...secondaryButtonStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View Product</Link>
                  <button type="button" style={buttonStyle} onClick={handleStartAnother}>Add Another Product</button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}