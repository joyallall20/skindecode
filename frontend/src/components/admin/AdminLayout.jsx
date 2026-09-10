import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products', end: true },
  { to: '/admin/products/add', label: 'Add Product', end: true },
  { to: '/admin/product-imports', label: 'Product Imports' },
  { to: '/admin/intelligence-test', label: 'Intelligence Test', end: true },
  { to: '/admin/knowledge', label: 'Knowledge Base', end: true },
];

function AdminLayout({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      setLogoutError('Unable to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f7' }}>
      <aside
        style={{
          width: 240,
          background: '#111827',
          color: '#f9fafb',
          padding: '24px 18px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>SkinConsisus</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end || item.to === '/admin'}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 12px',
                borderRadius: 8,
                color: isActive ? '#fff' : '#d1d5db',
                background: isActive ? '#1f2937' : 'transparent',
                textDecoration: 'none',
                fontWeight: 600,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          style={{
            marginTop: 28,
            width: '100%',
            border: 'none',
            background: '#374151',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 12px',
            cursor: isLoggingOut ? 'not-allowed' : 'pointer',
            opacity: isLoggingOut ? 0.7 : 1,
          }}
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
        {logoutError ? <p role="alert" style={{ color: '#fecaca', fontSize: 13 }}>{logoutError}</p> : null}
      </aside>

      <main style={{ flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}

export default AdminLayout;
