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

  let label = 'Enregistré';
  let tone: 'ok' | 'warn' | 'bad' | 'muted' = 'ok';
  let title = 'Tout est enregistré — cliquer pour vérifier';

  if (!online || status === 'offline') {
    label =
      outboxCount > 0 ? 'Hors ligne — sera sauvegardé plus tard' : 'Hors ligne';
    tone = 'warn';
    title =
      outboxCount > 0
        ? 'Pas de réseau — tes changements seront enregistrés au retour'
        : 'Pas de réseau';
  } else if (status === 'syncing') {
    label = 'Sauvegarde…';
    tone = 'muted';
    title = 'Enregistrement en cours…';
  } else if (status === 'error') {
    label = 'Erreur — réessayer';
    tone = 'bad';
    title = lastError ?? 'Erreur d’enregistrement — cliquer pour réessayer';
  } else if (deadLetterCount > 0) {
    label = 'Erreur — réessayer';
    tone = 'bad';
    title = 'Certains changements n’ont pas pu être enregistrés — cliquer pour réessayer';
  } else if (outboxCount > 0) {
    label = 'Sauvegarde…';
    tone = 'warn';
    title = 'Enregistrement en attente — cliquer pour pousser maintenant';
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
