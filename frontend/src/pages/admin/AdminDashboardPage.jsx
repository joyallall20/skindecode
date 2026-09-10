import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { getDashboardStats, getRecentImports } from '../../api/adminApi.js';
import { getProducts } from '../../api/productApi.js';

const statusTone = {
  pending: { background: '#fef3c7', color: '#92400e' },
  processing: { background: '#dbeafe', color: '#1d4ed8' },
  review: { background: '#e0e7ff', color: '#4338ca' },
  approved: { background: '#dcfce7', color: '#166534' },
  rejected: { background: '#fee2e2', color: '#991b1b' },
  failed: { background: '#f3f4f6', color: '#374151' },
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentImports, setRecentImports] = useState([]);
  const [recentProducts, setRecentProducts] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const metrics = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total products', value: stats.totalProducts ?? 0 },
      { label: 'Active products', value: stats.activeProducts ?? 0 },
      { label: 'Draft / review', value: stats.draftProducts ?? 0 },
      { label: 'Failed imports', value: stats.failedImports ?? 0 },
      { label: 'Missing intelligence', value: stats.missingIntelligence ?? 0 },
      { label: 'Missing offers', value: stats.missingOffers ?? 0 },
      { label: 'Total brands', value: stats.totalBrands ?? 0 },
      { label: 'Total ingredients', value: stats.totalIngredients ?? 0 },
      { label: 'Total clicks', value: stats.totalClicks ?? 0 },
    ];
  }, [stats]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        const [dashboardData, importsData, productsData] = await Promise.all([
          getDashboardStats(),
          getRecentImports(),
          getProducts({ limit: 5, page: 1 }),
        ]);

        const dashboard = dashboardData?.data ?? dashboardData ?? {};
        const importRows = Array.isArray(importsData?.data) ? importsData.data : Array.isArray(importsData) ? importsData : [];
        const productRows = Array.isArray(productsData?.data) ? productsData.data : Array.isArray(productsData) ? productsData : [];

        setStats({
          totalProducts: dashboard.totalProducts ?? productRows.length,
          activeProducts: dashboard.totalActiveProducts ?? productRows.filter((product) => product.isActive).length,
          draftProducts: dashboard.pendingImports ?? 0,
          failedImports: dashboard.failedImports ?? 0,
          missingIntelligence: dashboard.missingIntelligence ?? 0,
          missingOffers: dashboard.missingOffers ?? 0,
          totalBrands: dashboard.totalBrands ?? 0,
          totalIngredients: dashboard.totalIngredients ?? 0,
          totalClicks: dashboard.totalClicks ?? 0,
        });

        setRecentImports(importRows.slice(0, 5));
        setRecentProducts(productRows.slice(0, 5));
      } catch (error) {
        setMessage(error?.message || 'Unable to load admin dashboard data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>Operations</div>
            <h1 style={{ margin: '6px 0 0', fontSize: 36 }}>Admin Dashboard</h1>
          </div>
        </div>

        {message ? <p role="alert" style={{ margin: '0 0 16px', color: '#b42318' }}>{message}</p> : null}

        {isLoading ? (
          <p>Loading dashboard metrics…</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 24 }}>
              {metrics.map((metric) => (
                <div key={metric.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                  <div style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{metric.label}</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: '#111827' }}>{metric.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
              <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Recent imports</h2>
                  <Link to="/admin/product-imports" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>View all</Link>
                </div>
                {recentImports.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>No recent product imports.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recentImports.map((item) => (
                      <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{item.sourceUrl}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(item.createdAt)}</div>
                        </div>
                        <span
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            ...statusTone[item.status] || { background: '#f3f4f6', color: '#374151' },
                          }}
                        >
                          {item.status || 'pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 22 }}>Recent products</h2>
                  <Link to="/admin/products" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>View all</Link>
                </div>
                {recentProducts.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280' }}>No products available.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recentProducts.map((product) => (
                      <div key={product._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{product.name}</div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{product?.brand?.name || product?.brand || 'Unknown brand'}</div>
                        </div>
                        <Link to={`/admin/products/${product._id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Open</Link>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
