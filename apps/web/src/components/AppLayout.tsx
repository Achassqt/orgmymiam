import { useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useNewMemberToast } from '../hooks/useNewMemberToast';
import { BurgerDrawer } from './BurgerDrawer';
import { OnboardingOverlay } from './OnboardingOverlay';
import { PwaInstallBanner } from './PwaInstallBanner';

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden fill="none">
      <path
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRecipes() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden fill="none">
      <path
        d="M3 17h18M5 17a7 7 0 0 1 14 0M12 10V8M10 8h4M2 20.5h20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" className="nav-svg" aria-hidden fill="none">
      <circle cx="9" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="20" r="1.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBurger() {
  return (
    <svg viewBox="0 0 24 24" className="burger-icon-svg" aria-hidden fill="none">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  useNewMemberToast();

  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="brand">OrgMyMiam</p>
        <button
          ref={burgerRef}
          type="button"
          className="icon-btn burger-trigger"
          aria-label="Ouvrir le menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
        >
          <IconBurger />
        </button>
      </header>

      <BurgerDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={burgerRef}
      />

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
