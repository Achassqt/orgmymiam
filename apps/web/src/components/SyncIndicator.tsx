import { useEffect, useState } from 'react';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function SyncIndicator() {
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

  let label = 'À jour';
  let tone: 'ok' | 'warn' | 'bad' | 'muted' = 'ok';
  let title = 'Synchronisation à jour — cliquer pour forcer';

  if (!online || status === 'offline') {
    label = outboxCount > 0 ? `Hors ligne · ${outboxCount} en attente` : 'Hors ligne';
    tone = 'warn';
    title = 'Pas de réseau — les changements restent en local';
  } else if (status === 'syncing') {
    label = outboxCount > 0 ? `Sync en cours · ${outboxCount}` : 'Sync en cours…';
    tone = 'muted';
    title = 'Synchronisation avec le serveur…';
  } else if (status === 'error') {
    label = lastError ? `Erreur · ${truncate(lastError, 28)}` : 'Erreur de sync';
    tone = 'bad';
    title = lastError ?? 'Erreur de synchronisation — cliquer pour réessayer';
  } else if (deadLetterCount > 0) {
    label = `${deadLetterCount} échec(s) sync`;
    tone = 'bad';
    title = 'Certaines mutations ont dépassé le nombre de tentatives';
  } else if (outboxCount > 0) {
    label = `${outboxCount} à synchroniser`;
    tone = 'warn';
    title = 'Mutations en file — cliquer pour pousser maintenant';
  }

  return (
    <div className="sync-wrap">
      <button
        type="button"
        className={`sync-indicator tone-${tone}`}
        onClick={() => void refresh()}
        title={title}
        aria-live="polite"
      >
        <span className={`sync-dot${status === 'syncing' ? ' pulse' : ''}`} aria-hidden />
        <span className="sync-label">{label}</span>
      </button>
      {showNotice && notice ? <p className="sync-toast">{notice}</p> : null}
    </div>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
