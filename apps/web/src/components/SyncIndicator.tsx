import { useEffect, useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

interface SyncIndicatorProps {
  /** Compact row for the burger drawer */
  compact?: boolean;
}

function SyncIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`sync-icon-svg${spinning ? ' is-spinning' : ''}`}
      aria-hidden
      fill="none"
    >
      <path
        d="M20 12a8 8 0 0 1-13.66 5.66M4 12A8 8 0 0 1 17.66 6.34"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 17.5 4 20v-5.2M17.5 6.5 20 4v5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SyncIndicator({ compact = false }: SyncIndicatorProps) {
  const { online, status, outboxCount, deadLetterCount, lastError, notice, refresh } =
    useSyncStatus();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (!notice) {
      setShowNotice(false);
      return;
    }
    setShowNotice(true);
    const t = window.setTimeout(() => setShowNotice(false), 4500);
    return () => window.clearTimeout(t);
  }, [notice]);

  let label = 'Synchronisé';
  let tone: 'ok' | 'warn' | 'bad' | 'muted' = 'ok';
  let title = 'Tout est synchronisé. Toucher pour forcer une sync';
  let spinning = false;

  if (!online || status === 'offline') {
    label =
      outboxCount > 0 ? 'Hors ligne, sera sauvegardé plus tard' : 'Hors ligne';
    tone = 'warn';
    title =
      outboxCount > 0
        ? 'Pas de réseau : tes changements seront enregistrés au retour'
        : 'Pas de réseau';
  } else if (status === 'syncing') {
    label = 'Synchronisation…';
    tone = 'muted';
    title = 'Synchronisation en cours…';
    spinning = true;
  } else if (status === 'error') {
    label = 'Erreur, réessayer';
    tone = 'bad';
    title = lastError ?? 'Erreur de sync. Toucher pour réessayer';
  } else if (deadLetterCount > 0) {
    label = 'Erreur, réessayer';
    tone = 'bad';
    title = 'Certains changements n’ont pas pu être synchronisés. Toucher pour réessayer';
  } else if (outboxCount > 0) {
    label = 'Synchronisation…';
    tone = 'warn';
    title = 'Sync en attente. Toucher pour pousser maintenant';
    spinning = true;
  }

  return (
    <div className={compact ? 'sync-wrap sync-wrap-compact' : 'sync-wrap'}>
      <button
        type="button"
        className={`sync-indicator tone-${tone}${compact ? ' sync-indicator-compact' : ''}`}
        onClick={() => void refresh()}
        title={title}
        aria-live="polite"
      >
        <SyncIcon spinning={spinning} />
        <span className="sync-label">{label}</span>
      </button>
      {showNotice && notice ? <p className="sync-toast">{notice}</p> : null}
    </div>
  );
}
