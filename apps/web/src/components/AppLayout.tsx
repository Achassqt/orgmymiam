import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { SyncIndicator } from './SyncIndicator';

const NAV: Array<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/produits', label: 'Produits' },
  { to: '/recettes', label: 'Recettes' },
  { to: '/plans', label: 'Planning' },
  { to: '/liste', label: 'Courses' },
];

export function AppLayout() {
  const { session, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">OrgMyMiam</p>
          <p className="user-line">{session?.user.displayName}</p>
        </div>
        <div className="topbar-actions">
          <SyncIndicator />
          <button type="button" className="ghost-btn" onClick={() => void logout()}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
