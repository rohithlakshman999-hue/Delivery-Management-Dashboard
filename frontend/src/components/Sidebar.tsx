import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
  badge?: number;
}

function NavItem({ to, icon, label, badge }: NavItemProps) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      {label}
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </NavLink>
  );
}

export default function Sidebar({ badgeCounts }: { badgeCounts?: Record<string, number> }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLight, setIsLight] = useState(() => localStorage.getItem('theme') === 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  }, [isLight]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isAgent   = user?.role === 'agent';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">🚚</div>
          <div>
            <div className="logo-text">RouteMind AI</div>
            <div className="logo-sub">Delivery Intelligence</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {isManager && (
          <>
            <p className="nav-section-label">Operations</p>
            <NavItem to="/dashboard" icon="📊" label="Dashboard" />
            <NavItem to="/orders" icon="📦" label="Orders" badge={badgeCounts?.pending} />
            <NavItem to="/agents" icon="🛵" label="Agents" />
            <NavItem to="/dispatch" icon="⚡" label="Smart Dispatch" />

            <p className="nav-section-label" style={{ marginTop: 8 }}>Intelligence</p>
            <NavItem to="/ai-ops" icon="🤖" label="AI Operations" badge={badgeCounts?.at_risk} />
            <NavItem to="/tracking" icon="📍" label="Live Tracking" />
            <NavItem to="/analytics" icon="📈" label="Analytics" />
            <NavItem to="/exceptions" icon="⚠️" label="Exceptions" />
          </>
        )}

        {isAgent && (
          <>
            <p className="nav-section-label">My Work</p>
            <NavItem to="/agent-dashboard" icon="📋" label="My Deliveries" />
            <NavItem to="/agent-map" icon="🗺️" label="Route Map" />
          </>
        )}

        <p className="nav-section-label" style={{ marginTop: 8 }}>Account</p>
        <NavItem to="/notifications" icon="🔔" label="Notifications" badge={badgeCounts?.unread_notifs} />
        <NavItem to="/profile" icon="👤" label="Profile" />
      </nav>

      {/* User */}
      <div className="sidebar-user">
        <div className="user-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name}
          </div>
          <div className="user-role">{user?.role}</div>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setIsLight(value => !value)}
          title={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
          aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {isLight ? '☾' : '☀'}
        </button>
        <button className="logout-btn" onClick={handleLogout} title="Logout">↩</button>
      </div>
    </aside>
  );
}
