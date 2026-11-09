import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold } from '../hooks/useHousehold';
import { useNewMemberToast } from '../hooks/useNewMemberToast';
import { OnboardingOverlay } from './OnboardingOverlay';
import { PwaInstallBanner } from './PwaInstallBanner';
import { SyncIndicator } from './SyncIndicator';

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden>
      <path
        d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconRecipes() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden>
      <path
        d="M7 3h7a3 3 0 0 1 3 3v15l-6.5-3L4 21V6a3 3 0 0 1 3-3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" fill="currentColor" />
      <path d="M8 3v4M16 3v4M3 10h18" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden>
      <path
        d="M3 5h2l2.2 10h10.3L20 8H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="19" r="1.7" fill="currentColor" />
      <circle cx="17" cy="19" r="1.7" fill="currentColor" />
    </svg>
  );
}

const NAV: Array<{
  to: string;
  label: string;
  Icon: () => ReactNode;
  end?: boolean;
}> = [
  { to: '/', label: 'Accueil', Icon: IconHome, end: true },
  { to: '/recettes', label: 'Recettes', Icon: IconRecipes },
  { to: '/plans', label: 'Planning', Icon: IconPlan },
  { to: '/liste', label: 'Courses', Icon: IconCart },
];

export function AppLayout() {
  const { session, logout } = useAuth();
  const { isMember, household } = useHousehold();
  useNewMemberToast();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="brand">OrgMyMiam</p>
          <p className="user-line">
            {session?.user.displayName}
            {isMember && household ? (
              <>
                {' · '}
                <Link to="/foyer" className="foyer-link">
                  {household.name}
                </Link>
              </>
            ) : (
              <>
                {' · '}
                <Link to="/foyer" className="foyer-link">
                  Foyer
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="topbar-actions">
          <SyncIndicator />
          <button type="button" className="ghost-btn" onClick={() => void logout()}>
            Déconnexion
          </button>
        </div>
      </header>

      <PwaInstallBanner />

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <span className="nav-icon-wrap">
              <Icon />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <OnboardingOverlay />
    </div>
  );
}
