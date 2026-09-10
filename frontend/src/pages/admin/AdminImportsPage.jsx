import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { approveProductImport, extractProductFromImport, getProductImports, rejectProductImport } from '../../api/adminApi.js';

const statusStyles = {
  pending: { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' },
  processing: { background: '#dbeafe', color: '#1d4ed8', border: '1px solid #3b82f6' },
  review: { background: '#e0e7ff', color: '#4338ca', border: '1px solid #6366f1' },
  approved: { background: '#dcfce7', color: '#166534', border: '1px solid #22c55e' },
  rejected: { background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444' },
  failed: { background: '#f3f4f6', color: '#374151', border: '1px solid #9ca3af' },
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export default function AdminImportsPage() {
  const [imports, setImports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [fetchingId, setFetchingId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadImports = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      else setRefreshing(true);
      
      const response = await getProductImports({ page: 1, limit: 50 });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setImports(rows);
      if (showLoading) setMessage('');
    } catch (error) {
      setMessage(error?.message || 'Unable to load product imports.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadImports();
  }, []);

  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
    // Auto-dismiss success/info messages after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        setMessage('');
      }, 5000);
    }
  };

  const handleExtract = async (id) => {
    setFetchingId(id);
    try {
      const response = await extractProductFromImport(id);
      showMessage(response?.message || 'Product details fetched successfully.', 'success');
      await loadImports(false);
    } catch (error) {
      showMessage(error?.message || error?.data?.message || 'Unable to fetch product details.', 'error');
      await loadImports(false);
    } finally {
      setFetchingId('');
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveProductImport(id);
      showMessage('Import approved successfully.', 'success');
      await loadImports(false);
    } catch (error) {
      showMessage(error?.message || 'Unable to approve import.', 'error');
    }
  };

  const handleReject = async (id) => {
    const confirmed = window.confirm('Are you sure you want to reject this product import?');
    if (!confirmed) return;

    try {
      await rejectProductImport(id, { reason: 'Rejected from admin dashboard.' });
      showMessage('Import rejected.', 'success');
      await loadImports(false);
    } catch (error) {
      showMessage(error?.message || 'Unable to reject import.', 'error');
    }
  };

  const stats = {
    total: imports.length,
    pending: imports.filter(i => i.status === 'pending' || i.status === 'processing').length,
    review: imports.filter(i => i.status === 'review').length,
    approved: imports.filter(i => i.status === 'approved').length,
    rejected: imports.filter(i => i.status === 'rejected' || i.status === 'failed').length,
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={breadcrumbStyle}>Catalog Ingestion</div>
            <h1 style={titleStyle}>Product Imports</h1>
            <p style={subtitleStyle}>Manage and review product imports from external sources</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => loadImports(false)}
              disabled={refreshing}
              style={refreshButtonStyle}
            >
              {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
            </button>
            <Link to="/admin" style={backLinkStyle}>← Back to Dashboard</Link>
          </div>
        </div>

        {/* Stats Cards */}
        {!isLoading && imports.length > 0 && (
          <div style={statsGridStyle}>
            <div style={{ ...statCardStyle, borderTop: '3px solid #3b82f6' }}>
              <div style={statValueStyle}>{stats.total}</div>
              <div style={statLabelStyle}>Total Imports</div>
            </div>
            <div style={{ ...statCardStyle, borderTop: '3px solid #f59e0b' }}>
              <div style={statValueStyle}>{stats.pending}</div>
              <div style={statLabelStyle}>Pending</div>
            </div>
            <div style={{ ...statCardStyle, borderTop: '3px solid #6366f1' }}>
              <div style={statValueStyle}>{stats.review}</div>
              <div style={statLabelStyle}>In Review</div>
            </div>
            <div style={{ ...statCardStyle, borderTop: '3px solid #22c55e' }}>
              <div style={statValueStyle}>{stats.approved}</div>
              <div style={statLabelStyle}>Approved</div>
            </div>
            <div style={{ ...statCardStyle, borderTop: '3px solid #ef4444' }}>
              <div style={statValueStyle}>{stats.rejected}</div>
              <div style={statLabelStyle}>Rejected/Failed</div>
            </div>
          </div>
        )}

        {/* Message Banner */}
        {message && (
          <div style={{ ...messageBannerStyle, ...(messageType === 'error' ? errorBannerStyle : messageType === 'success' ? successBannerStyle : infoBannerStyle) }}>
            <span>{messageType === 'error' ? '⚠' : messageType === 'success' ? '✓' : 'ℹ'}</span>
            <span>{message}</span>
            <button onClick={() => setMessage('')} style={closeButtonStyle}>×</button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div style={loadingContainerStyle}>
            <div style={spinnerStyle}></div>
            <p style={{ marginTop: 12, color: '#6b7280' }}>Loading imports...</p>
          </div>
        ) : (
          <div style={tableContainerStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderRowStyle}>
                  <th style={{ ...tableHeaderCellStyle, width: '30%' }}>Source URL</th>
                  <th style={{ ...tableHeaderCellStyle, width: '12%' }}>Status</th>
                  <th style={{ ...tableHeaderCellStyle, width: '15%' }}>Submitted By</th>
                  <th style={{ ...tableHeaderCellStyle, width: '12%' }}>AI Model</th>
                  <th style={{ ...tableHeaderCellStyle, width: '13%' }}>Created</th>
                  <th style={{ ...tableHeaderCellStyle, width: '18%', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {imports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={emptyStateStyle}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>No Product Imports Found</div>
                      <div style={{ color: '#6b7280', marginTop: 4 }}>Imports will appear here when they are submitted</div>
                    </td>
                  </tr>
                ) : (
                  imports.map((item, index) => (
                    <tr 
                      key={item._id} 
                      style={{
                        ...tableRowStyle,
                        background: index % 2 === 0 ? '#fff' : '#f9fafb',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#f9fafb'}
                    >
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ color: '#9ca3af', marginTop: 2 }}>🔗</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: '#111827', wordBreak: 'break-all', fontSize: 13 }}>
                              {item.sourceUrl}
                            </div>
                            {item.errorMessage && (
                              <div style={{ 
                                marginTop: 6, 
                                color: '#991b1b', 
                                fontSize: 12, 
                                background: '#fef2f2', 
                                padding: '6px 8px', 
                                borderRadius: 4,
                                border: '1px solid #fecaca'
                              }}>
                                ⚠ {item.errorMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          ...(statusStyles[item.status] || statusStyles.pending),
                        }}>
                          {item.status || 'pending'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={avatarStyle}>
                            {(item?.submittedBy?.name || 'A').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13 }}>{item?.submittedBy?.name || 'Admin'}</span>
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 8px',
                          background: '#f3f4f6',
                          borderRadius: 4,
                          fontSize: 12,
                          color: '#374151',
                          fontWeight: 500
                        }}>
                          {item.aiModel || 'gemini'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(item.createdAt)}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{formatTime(item.createdAt)}</div>
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <Link 
                            to={`/admin/product-imports/${item._id}`} 
                            style={{ ...actionButtonStyle, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                            title="Review and edit import details"
                          >
                            Review
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleExtract(item._id)}
                            disabled={Boolean(fetchingId)}
                            style={{
                              ...actionButtonStyle,
                              background: fetchingId === item._id ? '#e5e7eb' : '#f0fdf4',
                              color: fetchingId === item._id ? '#9ca3af' : '#166534',
                              border: '1px solid #bbf7d0',
                              cursor: fetchingId ? 'not-allowed' : 'pointer',
                              opacity: fetchingId ? 0.6 : 1,
                            }}
                            title="Fetch product details from source"
                          >
                            {fetchingId === item._id ? '⌛ Fetching...' : '⬇ Fetch'}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleApprove(item._id)} 
                            style={{ ...actionButtonStyle, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
                            title="Approve this import"
                          >
                            ✓ Approve
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleReject(item._id)} 
                            style={{ ...actionButtonStyle, background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
                            title="Reject this import"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

// Styles
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 24,
  gap: 16,
  flexWrap: 'wrap',
  padding: '24px 0 0',
};

const breadcrumbStyle = {
  fontSize: 12,
  color: '#6b7280',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  fontWeight: 600,
  marginBottom: 8,
};

const titleStyle = {
  margin: 0,
  fontSize: 32,
  fontWeight: 700,
  color: '#111827',
};

const subtitleStyle = {
  margin: '8px 0 0',
  color: '#6b7280',
  fontSize: 14,
};

const backLinkStyle = {
  color: '#2563eb',
  textDecoration: 'none',
  fontWeight: 600,
  padding: '10px 16px',
  background: '#eff6ff',
  borderRadius: 8,
  border: '1px solid #bfdbfe',
  transition: 'all 0.2s',
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 14,
};

const refreshButtonStyle = {
  background: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '10px 16px',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
  transition: 'all 0.2s',
  display: 'inline-flex',
  alignItems: 'center',
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  marginBottom: 24,
};

const statCardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '16px 20px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};

const statValueStyle = {
  fontSize: 28,
  fontWeight: 700,
  color: '#111827',
  marginBottom: 4,
};

const statLabelStyle = {
  fontSize: 12,
  color: '#6b7280',
  fontWeight: 500,
};

const messageBannerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 8,
  marginBottom: 20,
  fontSize: 14,
  fontWeight: 500,
};

const infoBannerStyle = {
  background: '#eff6ff',
  color: '#1e40af',
  border: '1px solid #bfdbfe',
};

const successBannerStyle = {
  background: '#f0fdf4',
  color: '#166534',
  border: '1px solid #bbf7d0',
};

const errorBannerStyle = {
  background: '#fef2f2',
  color: '#991b1b',
  border: '1px solid #fecaca',
};

const closeButtonStyle = {
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  color: 'inherit',
  padding: '0 4px',
};

const loadingContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 0',
};

const spinnerStyle = {
  width: 40,
  height: 40,
  border: '3px solid #e5e7eb',
  borderTop: '3px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const tableContainerStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
};

const tableHeaderRowStyle = {
  background: '#f9fafb',
  borderBottom: '2px solid #e5e7eb',
};

const tableHeaderCellStyle = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tableRowStyle = {
  borderBottom: '1px solid #e5e7eb',
};

const tableCellStyle = {
  padding: '16px',
  fontSize: 13,
  color: '#374151',
  verticalAlign: 'top',
};

const avatarStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: '#e0e7ff',
  color: '#4338ca',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 14,
  flexShrink: 0,
};

const emptyStateStyle = {
  padding: '60px 20px',
  textAlign: 'center',
  color: '#6b7280',
};

const actionButtonStyle = {
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  whiteSpace: 'nowrap',
  border: '1px solid',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

// Add keyframe animation for spinner
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);