import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import ProductDataForm, { panelStyle, buttonStyle, secondaryButtonStyle } from '../../components/admin/ProductDataForm.jsx';
import IntelligencePanel, { PublishPanel } from '../../components/admin/IntelligencePanel.jsx';
import SellerDiscoveryPanel from '../../components/admin/SellerDiscoveryPanel.jsx';
import OfferManagementPanel from '../../components/admin/OfferManagementPanel.jsx';
import {
  extractProductFromImport,
  getProductImport,
  updateExtractedProduct,
  publishImportedProduct,
  getImportIntelligenceInput,
  generateProductIntelligence,
  getProductIntelligenceInput,
  publishProduct,
  approveProductIntelligence,
  rejectProductIntelligence,
  updateProduct,
} from '../../api/adminApi.js';
import { getProductById } from '../../api/productApi.js';
import { extractedDataToForm, formToExtractedData, formToIntelligencePreview, formToSavePayload, parseFormIngredientList } from '../../utils/productFormConstants.js';

// Helper function to ensure image URLs are valid
const ensureValidImageUrl = (url) => {
  if (!url) return null;
  // Handle different URL formats
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image/')) return url;
  // If it's a relative path, construct full URL
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return url;
};

const unwrapRecord = (response) => {
  if (!response) return null;
  if (response.extractedData || response.publishedProduct || response.publishedProductId || response.sourceUrl) {
    return response;
  }
  return response.data ?? response;
};

const extractCatalogProduct = (result) => {
  if (!result) return null;
  if (result._id && (result.name !== undefined || result.slug || result.brand)) return result;
  return result.data?.product || result.product || result.data || null;
};

const asCatalogId = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text !== 'undefined' && text !== 'null' ? text : '';
  }
  if (typeof value === 'object') {
    if (value._id) return asCatalogId(value._id);
    if (typeof value.toHexString === 'function') return value.toHexString();
  }
  const text = String(value);
  return /^[a-fA-F0-9]{24}$/.test(text) ? text : '';
};

export default function AdminImportDetailPage() {
  const { id } = useParams();
  const [importData, setImportData] = useState(null);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(null);
  const [intelligenceInput, setIntelligenceInput] = useState(null);
  const [generationJob, setGenerationJob] = useState(null);
  const [hasPersistedIntelligence, setHasPersistedIntelligence] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isCatalogSaving, setIsCatalogSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [activeStep, setActiveStep] = useState(1);

  const productId = asCatalogId(product?._id || importData?.publishedProduct || importData?.publishedProductId);

  // Helper to set messages with types
  const setSuccessMessage = (text) => setMessage({ type: 'success', text });
  const setErrorMessage = (text) => setMessage({ type: 'error', text });
  const setInfoMessage = (text) => setMessage({ type: 'info', text });

  const loadAll = async ({ showPageLoader = true } = {}) => {
    try {
      if (showPageLoader) setLoading(true);
      const response = await getProductImport(id);
      const data = unwrapRecord(response);
      setImportData(data);
      
      // Process form data and ensure image URLs are valid
      const formData = extractedDataToForm(data?.extractedData || {}, data?.sourceUrl);
      
      // Ensure images array exists and URLs are valid
      if (formData.images && Array.isArray(formData.images)) {
        formData.images = formData.images.map(img => ({
          ...img,
          url: ensureValidImageUrl(img.url) || img.url
        }));
      }
      
      setForm(formData);

      const inputResponse = await getImportIntelligenceInput(id);
      const inputData = inputResponse?.data ?? inputResponse;
      setIntelligenceInput(inputData?.intelligenceInput || formToIntelligencePreview(formData));

      const pid = asCatalogId(data?.publishedProduct || data?.publishedProductId);
      if (pid) {
        try {
          const productResponse = await getProductById(pid);
          const productData = unwrapRecord(productResponse);

          if (productData?.images && Array.isArray(productData.images)) {
            productData.images = productData.images.map((img) => ({
              ...img,
              url: ensureValidImageUrl(img.url) || img.url,
            }));
          }

          setProduct(productData);

          const productInputResponse = await getProductIntelligenceInput(pid);
          const productInputData = productInputResponse?.data ?? productInputResponse;
          setIntelligenceInput(productInputData?.intelligenceInput || formToIntelligencePreview(formData));
          setGenerationJob(productInputData?.generationJob || null);
          setHasPersistedIntelligence(Boolean(productInputData?.hasIntelligence));
        } catch (productError) {
          setProduct({ _id: pid });
          setHasPersistedIntelligence(false);
          setErrorMessage(productError?.message || 'Catalog product is linked but could not be fully loaded. Intelligence can still run.');
        }
      } else {
        setProduct(null);
        setGenerationJob(null);
        setHasPersistedIntelligence(false);
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to load product import details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [id]);

  useEffect(() => {
    if (!product || !['queued', 'generating'].includes(product.intelligenceStatus)) return undefined;
    const intervalId = window.setInterval(() => {
      loadAll({ showPageLoader: false });
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [id, product?.intelligenceStatus]);

  const handleExtract = async () => {
    setIsFetching(true);
    try {
      setInfoMessage('Fetching product details…');
      const response = await extractProductFromImport(id);
      setSuccessMessage(response?.message || 'Product details fetched. Review and correct the product data below.');
      await loadAll();
    } catch (error) {
      setErrorMessage(error?.message || error?.data?.message || 'Unable to fetch product details.');
      await loadAll();
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveProductData = async () => {
    setIsSaving(true);
    try {
      await updateExtractedProduct(id, { extractedData: formToExtractedData(form) });
      setIntelligenceInput(formToIntelligencePreview(form));
      setSuccessMessage('Product data saved successfully.');
      await loadAll();
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save product data.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToCatalog = async () => {
    setIsCatalogSaving(true);
    try {
      await updateExtractedProduct(id, { extractedData: formToExtractedData(form) });
      const result = await publishImportedProduct(id);
      const createdProduct = extractCatalogProduct(result);
      const createdId = asCatalogId(
        createdProduct?._id
        || result?.publishedProductId
        || result?.publishedProductImport?.publishedProduct
        || result?.data?._id
      );
      if (createdId) {
        try {
          await updateProduct(createdId, formToSavePayload({ ...form, isActive: false }));
        } catch (updateError) {
          setErrorMessage(updateError?.message || 'Catalog product was created, but updating extra fields failed.');
        }
        setProduct(createdProduct?._id ? createdProduct : { _id: createdId });
        setImportData((current) => ({
          ...(current || {}),
          publishedProduct: createdId,
          publishedProductId: createdId,
        }));
      }
      setSuccessMessage('Product saved to catalog as draft. You can now generate intelligence.');
      await loadAll();
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to save product to catalog.');
    } finally {
      setIsCatalogSaving(false);
    }
  };

  const handleGenerateIntelligence = async () => {
    const catalogId = asCatalogId(product?._id || importData?.publishedProduct || importData?.publishedProductId);
    if (!catalogId) {
      setErrorMessage('Save the product to catalog first before generating intelligence.');
      return;
    }
    const ingredients = formToIntelligencePreview(form || {}).ingredients;
    const hasIngredients = ingredients.length > 0 || Boolean(String(form?.ingredients || '').trim());
    if (!hasIngredients) {
      setErrorMessage('Please add the full ingredient list before running Product Intelligence.');
      return;
    }
    setIsGenerating(true);
    setInfoMessage('Generating product intelligence…');
    try {
      const result = await generateProductIntelligence(catalogId);
      setSuccessMessage(result?.message || 'Product intelligence generation queued.');
      await loadAll({ showPageLoader: false });
    } catch (error) {
      setErrorMessage(error?.message || error?.data?.error || 'Intelligence generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveIntelligence = async () => {
    if (!productId) return;
    setIsApproving(true);
    try {
      await approveProductIntelligence(productId);
      setSuccessMessage('Product intelligence approved.');
      await loadAll();
    } catch (error) {
      setErrorMessage(error?.message || 'Failed to approve intelligence.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectIntelligence = async () => {
    if (!productId) return;
    try {
      await rejectProductIntelligence(productId, { reason: 'Rejected during import review.' });
      setInfoMessage('Product intelligence rejected. Regenerate after correcting product data.');
      await loadAll();
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
      await loadAll();
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to publish product.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Loading state with skeleton
  if (loading) {
    return (
      <AdminLayout>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '400px',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading product details...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!importData || !form) {
    return (
      <AdminLayout>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#991b1b', margin: '0 0 8px', fontSize: '20px' }}>Import Not Found</h2>
            <p style={{ color: '#6b7280', margin: '0 0 16px' }}>{message.text || 'The requested import could not be found.'}</p>
            <Link 
              to="/admin/product-imports" 
              style={{ ...buttonStyle, textDecoration: 'none', display: 'inline-block' }}
            >
              Back to Imports
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const previewInput = formToIntelligencePreview(form);
  const extractedIngredientCount = Array.isArray(importData?.extractedData?.ingredients)
    ? importData.extractedData.ingredients.filter(Boolean).length
    : parseFormIngredientList(importData?.extractedData?.ingredients).length;
  const hasFullIngredients = previewInput.ingredients.length > 0
    || Boolean(String(form.ingredients || '').trim())
    || extractedIngredientCount > 0;

  // Determine workflow status
  const workflowStatus = {
    step1: 'complete',
    step2: product?.intelligenceStatus === 'approved' ? 'complete' : productId ? 'active' : 'pending',
    step3: product?.isActive ? 'complete' : productId ? 'active' : 'pending'
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          gap: '16px', 
          flexWrap: 'wrap', 
          marginBottom: '24px',
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280', 
              letterSpacing: '1px', 
              textTransform: 'uppercase',
              fontWeight: '600'
            }}>
              Product workflow
            </div>
            <h1 style={{ 
              margin: '8px 0 4px', 
              fontSize: '28px',
              color: '#111827',
              fontWeight: '600'
            }}>
              {form.name || 'Import Review'}
            </h1>
            <p style={{ 
              margin: 0, 
              color: '#6b7280', 
              fontSize: '14px',
              wordBreak: 'break-all'
            }}>
              {importData.sourceUrl}
            </p>
            <div style={{ 
              marginTop: '12px', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                ...getStatusStyle(importData.status)
              }}>
                {importData.status.toUpperCase()}
              </span>
              {productId ? (
                <span style={{ color: '#6b7280' }}>
                  Product ID: <Link to={`/admin/products/${productId}`} style={{ color: '#3b82f6', fontWeight: '500' }}>{productId}</Link>
                </span>
              ) : null}
            </div>
            {importData.errorMessage ? (
              <p style={{ 
                margin: '12px 0 0', 
                color: '#991b1b', 
                fontSize: '13px',
                background: '#fef2f2',
                padding: '8px 12px',
                borderRadius: '6px',
                borderLeft: '3px solid #ef4444'
              }}>
                {importData.errorMessage}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={handleExtract} 
              disabled={isFetching} 
              style={{ ...secondaryButtonStyle, minWidth: '120px' }}
            >
              {isFetching ? '⏳ Fetching…' : importData.status === 'pending' || importData.status === 'failed' ? '🔍 Fetch Details' : '🔄 Re-fetch Details'}
            </button>
            <Link 
              to="/admin/product-imports" 
              style={{ 
                ...secondaryButtonStyle, 
                textDecoration: 'none', 
                display: 'inline-flex', 
                alignItems: 'center',
                minWidth: '100px',
                justifyContent: 'center'
              }}
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Message Display */}
        {message.text ? (
          <div style={{
            margin: '0 0 20px',
            padding: '12px 16px',
            borderRadius: '8px',
            ...getMessageStyle(message.type)
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{getMessageIcon(message.type)}</span>
              <span>{message.text}</span>
            </div>
          </div>
        ) : null}

        {/* Workflow Steps */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '24px',
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflowX: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '400px' }}>
            {[
              { number: 1, label: 'Product Data', status: workflowStatus.step1 },
              { number: 2, label: 'Intelligence', status: workflowStatus.step2 },
              { number: 3, label: 'Publish', status: workflowStatus.step3 }
            ].map((step, index) => (
              <div key={step.number} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: getStepBackground(step.status),
                  color: getStepColor(step.status),
                  fontSize: '13px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: getStepBackground(step.status),
                    border: `2px solid ${getStepColor(step.status)}`
                  }}>
                    {step.status === 'complete' ? '✓' : step.number}
                  </span>
                  {step.label}
                </div>
                {index < 2 && (
                  <div style={{ 
                    flex: 1, 
                    height: '2px', 
                    background: '#e5e7eb',
                    margin: '0 8px'
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Product Data Section */}
        <section style={{ 
          ...panelStyle, 
          marginBottom: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ 
            borderBottom: '1px solid #e5e7eb',
            paddingBottom: '16px',
            marginBottom: '20px'
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '20px',
              color: '#111827',
              fontWeight: '600'
            }}>
              1. Product Data
            </h2>
            <p style={{ 
              color: '#6b7280', 
              fontSize: '14px', 
              marginTop: '4px'
            }}>
              Review and correct all extracted fields before generating intelligence.
            </p>
          </div>
          <ProductDataForm 
            form={form} 
            onChange={setForm} 
            editingOptionId={editingOptionId} 
            onEditingOptionIdChange={setEditingOptionId} 
          />
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            marginTop: '24px', 
            flexWrap: 'wrap',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button 
              type="button" 
              style={{ ...buttonStyle, minWidth: '100px' }} 
              disabled={isSaving} 
              onClick={handleSaveProductData}
            >
              {isSaving ? 'Saving…' : '💾 Save'}
            </button>
            <button 
              type="button" 
              style={{ ...secondaryButtonStyle, minWidth: '140px' }} 
              disabled={isCatalogSaving} 
              onClick={handleSaveToCatalog}
            >
              {isCatalogSaving ? 'Saving…' : productId ? '📦 Update Catalog Draft' : '📦 Save to Catalog'}
            </button>
          </div>
        </section>

        <SellerDiscoveryPanel productId={productId} importId={id} onOfferCreated={loadAll} />

        <OfferManagementPanel productId={productId} />

        <IntelligencePanel
          productId={productId}
          intelligenceInput={previewInput}
          productIntelligence={product?.productIntelligence}
          intelligenceMetadata={product?.intelligenceMetadata}
          intelligenceStatus={product?.intelligenceStatus}
          qualityScore={product?.qualityScore}
          generationJob={generationJob}
          hasPersistedIntelligence={hasPersistedIntelligence}
          onGenerate={handleGenerateIntelligence}
          onApprove={handleApproveIntelligence}
          onReject={handleRejectIntelligence}
          isGenerating={isGenerating || ['queued', 'generating'].includes(product?.intelligenceStatus)}
          isApproving={isApproving}
          disabled={!productId || !hasFullIngredients}
          disabledReason={
            !productId
              ? 'Save the product to catalog first before generating intelligence.'
              : !hasFullIngredients
                ? 'Please add the full ingredient list before running Product Intelligence.'
                : null
          }
        />

        <PublishPanel
          product={product}
          onPublish={handlePublish}
          isPublishing={isPublishing}
          disabled={!productId}
        />
      </div>
    </AdminLayout>
  );
}

// Helper functions for styling
function getStatusStyle(status) {
  const styles = {
    pending: { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' },
    processing: { background: '#dbeafe', color: '#1e40af', border: '1px solid #60a5fa' },
    completed: { background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' },
    failed: { background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' },
    published: { background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' }
  };
  return styles[status] || styles.pending;
}

function getMessageStyle(type) {
  const styles = {
    success: { background: '#d1fae5', color: '#065f46', border: '1px solid #34d399' },
    error: { background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171' },
    info: { background: '#dbeafe', color: '#1e40af', border: '1px solid #60a5fa' }
  };
  return styles[type] || styles.info;
}

function getMessageIcon(type) {
  const icons = {
    success: '✓',
    error: '✗',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

function getStepBackground(status) {
  const backgrounds = {
    complete: '#d1fae5',
    active: '#dbeafe',
    pending: '#f3f4f6'
  };
  return backgrounds[status] || backgrounds.pending;
}

function getStepColor(status) {
  const colors = {
    complete: '#065f46',
    active: '#1e40af',
    pending: '#6b7280'
  };
  return colors[status] || colors.pending;
}