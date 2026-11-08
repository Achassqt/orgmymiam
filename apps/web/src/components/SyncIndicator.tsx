import { useSyncStatus } from '../hooks/useSyncStatus';

export function SyncIndicator() {
  const { online, status, outboxCount, lastError, refresh } = useSyncStatus();

  let label = 'À jour';
  let tone: 'ok' | 'warn' | 'bad' | 'muted' = 'ok';

  if (!online || status === 'offline') {
    label = outboxCount > 0 ? `Hors ligne · ${outboxCount} en attente` : 'Hors ligne';
    tone = 'warn';
  } else if (status === 'syncing') {
    label = 'Sync…';
    tone = 'muted';
  } else if (status === 'error') {
    label = lastError ? `Sync : ${lastError}` : 'Erreur de sync';
    tone = 'bad';
  } else if (outboxCount > 0) {
    label = `${outboxCount} à synchroniser`;
    tone = 'warn';
  }

  return (
    <button
      type="button"
      className={`sync-indicator tone-${tone}`}
      onClick={() => void refresh()}
      title="Lancer une synchronisation"
    >
      <span className="sync-dot" aria-hidden />
      {label}
    </button>
  );
}
