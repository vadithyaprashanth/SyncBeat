import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/',        icon: '⚡', label: 'Discover'      },
  { to: '/sync',    icon: '🔗', label: 'Sync Sessions'  },
  { to: '/library', icon: '📚', label: 'My Library'     },
  { to: '/profile', icon: '👤', label: 'Profile'        },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <>
      {/* Hamburger — mobile only */}
      <button className="hamburger-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
        {open ? '✕' : '☰'}
      </button>

      {/* Overlay — mobile only */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-icon">🎵</span>
          <span className="brand-name">SyncBeat</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item admin-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">🛡️</span>
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">↩</button>
        </div>
      </aside>
    </>
  );
}