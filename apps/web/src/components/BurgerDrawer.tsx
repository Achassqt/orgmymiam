import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useHousehold } from '../hooks/useHousehold';
import { usePwaInstall } from '../hooks/usePwaInstall';
import {
  requestOnboardingReplay,
  resetOnboardingDone,
} from './OnboardingOverlay';
import { SyncIndicator } from './SyncIndicator';

interface BurgerDrawerProps {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

export function BurgerDrawer({ open, onClose, triggerRef }: BurgerDrawerProps) {
  const { session, logout } = useAuth();
  const { isMember, household } = useHousehold();
  const pwa = usePwaInstall();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        triggerRef.current?.focus();
      }
      return;
    }
    wasOpenRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const foyerLabel = isMember && household ? household.name : 'Foyer';
  const foyerMeta = isMember && household ? 'Gérer le foyer' : 'Créer ou rejoindre';

  return (
    <div className="burger-root" role="presentation">
      <button
        type="button"
        className="burger-overlay"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="burger-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="burger-panel-head">
          <h2 id={titleId} className="burger-title">
            Menu
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="icon-btn burger-close"
            aria-label="Fermer"
            onClick={onClose}
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="burger-profile">
          <p className="burger-profile-name">{session?.user.displayName ?? 'Profil'}</p>
          {session?.user.email ? (
            <p className="burger-profile-email">{session.user.email}</p>
          ) : null}
        </div>

        <nav className="burger-nav" aria-label="Compte et foyer">
          <DrawerLink to="/produits" onNavigate={onClose} meta="Catalogue & personnalisés">
            Produits
          </DrawerLink>

          <DrawerLink to="/foyer" onNavigate={onClose} meta={foyerMeta}>
            {foyerLabel}
          </DrawerLink>

          <button
            type="button"
            className="burger-link"
            onClick={() => {
              const uid = session?.user._id;
              onClose();
              if (!uid) return;
              void (async () => {
                await resetOnboardingDone(uid);
                requestOnboardingReplay();
              })();
            }}
          >
            <span className="burger-link-label">Guide de démarrage</span>
            <span className="burger-link-meta">Relancer la visite</span>
          </button>

          {pwa.canPrompt ? (
            <button
              type="button"
              className="burger-link"
              disabled={pwa.busy}
              onClick={() => void pwa.install()}
            >
              <span className="burger-link-label">Installer l’app</span>
              <span className="burger-link-meta">Écran d’accueil</span>
            </button>
          ) : pwa.iosTip ? (
            <div className="burger-hint">
              <strong>Installer l’app</strong>
              <span className="meta">Safari → Partager → Sur l’écran d’accueil</span>
            </div>
          ) : null}
        </nav>

        {/* Placement choisi : bas du menu, au-dessus de Déconnexion (statut discret, tap = force sync). */}
        <div className="burger-sync burger-sync-footer">
          <SyncIndicator compact />
        </div>

        <button
          type="button"
          className="burger-logout"
          onClick={() => {
            onClose();
            void logout();
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}

function DrawerLink({
  to,
  onNavigate,
  children,
  meta,
}: {
  to: string;
  onNavigate: () => void;
  children: ReactNode;
  meta?: string;
}) {
  return (
    <Link to={to} className="burger-link" onClick={onNavigate}>
      <span className="burger-link-label">{children}</span>
      {meta ? <span className="burger-link-meta">{meta}</span> : null}
    </Link>
  );
}
