import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { HouseholdResponse } from '@orgmymiam/shared';
import { useAuth } from '../auth/AuthProvider';
import {
  createHousehold,
  joinHousehold,
  leaveHousehold,
  refreshHouseholdCache,
  rotateHouseholdCode,
} from '../data/household';
import { db, META_KEYS } from '../db/database';

export function useHousehold() {
  const { session } = useAuth();
  const cached = useLiveQuery(async () => {
    const row = await db.meta.get(META_KEYS.household);
    return (row?.value as HouseholdResponse | null | undefined) ?? null;
  }, [session?.user._id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    void refreshHouseholdCache().catch(() => undefined);
  }, [session?.accessToken]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await refreshHouseholdCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger le foyer');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      return await createHousehold(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Création impossible';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const join = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      return await joinHousehold(code);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rejoindre impossible';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const leave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await leaveHousehold();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de quitter';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const rotate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      return await rotateHouseholdCode();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Renouvellement impossible';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    household: cached?.household ?? null,
    members: cached?.members ?? [],
    joinPath: cached?.joinPath ?? null,
    data: cached ?? null,
    loading,
    error,
    refresh,
    create,
    join,
    leave,
    rotate,
    isMember: Boolean(cached?.household),
  };
}
