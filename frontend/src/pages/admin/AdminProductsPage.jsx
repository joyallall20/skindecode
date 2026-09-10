import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { deleteProduct, publishProduct, toggleProductStatus } from '../../api/adminApi.js';
import { getProducts } from '../../api/productApi.js';

const statusStyles = {
  active: { background: '#dcfce7', color: '#166534' },
  inactive: { background: '#f3f4f6', color: '#374151' },
  intelligence: { background: '#e0e7ff', color: '#4338ca' },
  missing: { background: '#fef3c7', color: '#92400e' },
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product?.brand?.name ?? ''} ${product?.category?.name ?? ''}`.toLowerCase().includes(term));
  }, [products, search]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const response = await getProducts({ page: 1, limit: 100, isActive: 'all' });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setProducts(rows);
      setMessage('');
    } catch (error) {
      setMessage(error?.message || 'Unable to load products.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handlePublish = async (productId) => {
    try {
      await publishProduct(productId);
      setMessage('Product published successfully.');
      await loadProducts();
    } catch (error) {
      setMessage(error?.message || 'Unable to publish product.');
    }
  };

  const handleToggle = async (productId) => {
    try {
      await toggleProductStatus(productId);
      setMessage('Product status updated.');
      await loadProducts();
    } catch (error) {
      setMessage(error?.message || 'Unable to update product status.');
    }
  };

  const handleDelete = async (productId) => {
    const confirmed = window.confirm('Delete this product? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await deleteProduct(productId);
      setMessage('Product deleted.');
      await loadProducts();
    } catch (error) {
      setMessage(error?.message || 'Unable to delete product.');
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>Catalog</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 34 }}>Products</h1>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/admin/products/add" style={{ ...actionStyle, background: '#111827', color: '#fff', borderColor: '#111827' }}>Add Product</Link>
            <Link to="/admin" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 700 }}>Back to dashboard</Link>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products by name, brand, category"
            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8 }}
          />
        </div>

        {message ? <p style={{ margin: '0 0 16px', color: '#1f2937' }}>{message}</p> : null}

        {isLoading ? (
          <p>Loading products…</p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={cellStyle}>Product</th>
                  <th style={cellStyle}>Brand</th>
                  <th style={cellStyle}>Category</th>
                  <th style={cellStyle}>Status</th>
                  <th style={cellStyle}>AI Intelligence</th>
                  <th style={cellStyle}>Created</th>
                  <th style={cellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: '#6b7280', padding: '18px' }}>No products matched the current filters.</td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const intelligence = product.productIntelligence ? 'Generated' : 'Missing';

                    return (
                      <tr key={product._id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={cellStyle}>
                          <div style={{ fontWeight: 700, color: '#111827' }}>{product.name}</div>
                        </td>
                        <td style={cellStyle}>{product?.brand?.name || 'Unknown'}</td>
                        <td style={cellStyle}>{product?.category?.name || 'Unknown'}</td>
                        <td style={cellStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '6px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              ...(product.isActive ? statusStyles.active : statusStyles.inactive),
                            }}
                          >
                            {product.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '6px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              ...(intelligence === 'Generated' ? statusStyles.intelligence : statusStyles.missing),
                            }}
                          >
                            {intelligence}
                          </span>
                        </td>
                        <td style={cellStyle}>{formatDate(product.createdAt)}</td>
                        <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Link to={`/admin/products/${product._id}`} style={actionStyle}>View</Link>
                            <Link to={`/admin/products/${product._id}/edit`} style={actionStyle}>Edit</Link>
                            <button type="button" onClick={() => handlePublish(product._id)} style={actionStyle}>Publish</button>
                            <button type="button" onClick={() => handleToggle(product._id)} style={actionStyle}>Toggle</button>
                            <button type="button" onClick={() => handleDelete(product._id)} style={{ ...actionStyle, color: '#991b1b' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

const cellStyle = {
  padding: '14px 16px',
  textAlign: 'left',
  color: '#374151',
  fontSize: 14,
};

const actionStyle = {
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 700,
};
