import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loginRequest, logoutLocal, registerRequest } from '../api/client';
import { db, META_KEYS, setMeta, type AuthSession } from '../db/database';
import { bindOnlineSync, runSync } from '../sync/engine';

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [booting, setBooting] = useState(true);
  // `null` = chargé sans session ; `undefined` = encore en chargement Dexie
  const metaAuth = useLiveQuery(async () => {
    const row = await db.meta.get(META_KEYS.auth);
    return row ?? null;
  }, []);
  const session =
    metaAuth && metaAuth.value
      ? (metaAuth.value as AuthSession)
      : null;

  useEffect(() => {
    bindOnlineSync();
    setBooting(false);
  }, []);

  useEffect(() => {
    if (session?.user._id) {
      // Migre les sessions déjà présentes sans lastUserId (évite purge mono-compte).
      void setMeta(META_KEYS.lastUserId, session.user._id);
    }
  }, [session?.user._id]);

  useEffect(() => {
    if (session?.accessToken) {
      void runSync('auth');
    }
  }, [session?.accessToken]);

  const login = useCallback(async (email: string, password: string) => {
    await loginRequest({ email, password });
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      await registerRequest(input);
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutLocal();
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading: booting || metaAuth === undefined,
      login,
      register,
      logout,
    }),
    [session, booting, metaAuth, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return ctx;
}
