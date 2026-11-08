import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, META_KEYS, type SyncStatus } from '../db/database';
import { runSync, subscribeSyncStatus } from '../sync/engine';

export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

export function useSyncStatus() {
  const online = useOnline();
  const [status, setStatus] = useState<SyncStatus>(online ? 'idle' : 'offline');
  const metaStatus = useLiveQuery(() => db.meta.get(META_KEYS.lastSyncStatus), []);
  const lastError = useLiveQuery(() => db.meta.get(META_KEYS.lastSyncError), []);
  const outboxCount = useLiveQuery(() => db.outbox.count(), []) ?? 0;
  const lastSyncAt = useLiveQuery(() => db.meta.get(META_KEYS.lastSyncAt), []);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  useEffect(() => {
    if (typeof metaStatus?.value === 'string') {
      setStatus(metaStatus.value as SyncStatus);
    }
  }, [metaStatus?.value]);

  useEffect(() => {
    if (!online) setStatus('offline');
  }, [online]);

  return {
    online,
    status: online ? status : 'offline',
    outboxCount,
    lastError: (lastError?.value as string | null | undefined) ?? null,
    lastSyncAt: (lastSyncAt?.value as string | undefined) ?? null,
    refresh: () => runSync('manual'),
  };
}
