import type {
  AuthResponse,
  AuthTokens,
  CatalogResponse,
  HouseholdResponse,
  SyncPullResponse,
  SyncPushResponse,
  SyncPushMutation,
} from '@orgmymiam/shared';
import {
  clearUserScopedLocalData,
  getMeta,
  hasForeignUserScopedData,
  hasLocalUserScopedData,
  META_KEYS,
  setMeta,
  type AuthSession,
} from '../db/database';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function rawRequest(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
}

async function refreshSession(session: AuthSession): Promise<AuthSession> {
  const response = await rawRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const body = await parseJson(response);
  if (!response.ok) {
    await setMeta(META_KEYS.auth, null);
    throw new ApiError('Session expirée', response.status, body);
  }

  const data = body as AuthResponse;
  const next = toSession(data.user, data.tokens);
  await setMeta(META_KEYS.auth, next);
  return next;
}

function toSession(user: AuthResponse['user'], tokens: AuthTokens): AuthSession {
  return {
    user,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: Date.now() + tokens.expiresIn * 1000 - 5_000,
  };
}

async function getValidSession(): Promise<AuthSession> {
  const session = await getMeta<AuthSession | null>(META_KEYS.auth);
  if (!session?.accessToken) {
    throw new ApiError('Non authentifié', 401);
  }
  if (Date.now() < session.accessExpiresAt) {
    return session;
  }
  return refreshSession(session);
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  let token: string | undefined;
  if (options.auth !== false) {
    const session = await getValidSession();
    token = session.accessToken;
  }

  let response = await rawRequest(path, init, token);
  if (response.status === 401 && options.auth !== false) {
    const session = await getMeta<AuthSession | null>(META_KEYS.auth);
    if (session?.refreshToken) {
      const refreshed = await refreshSession(session);
      response = await rawRequest(path, init, refreshed.accessToken);
    }
  }

  const body = await parseJson(response);
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Erreur API ${response.status}`;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

async function withLocalDataBarrier(fn: () => Promise<void>): Promise<void> {
  // Import dynamique pour éviter un cycle ESM client ↔ engine.
  const sync = await import('../sync/engine');
  sync.bumpLocalDataEpoch();
  await sync.waitForSyncIdle();
  await fn();
}

/**
 * Avant d’écrire une nouvelle session : purge si changement de compte
 * ou s’il reste des données locales d’un autre user.
 * `lastUserId` permet de reconnecter le même compte après expiry token
 * sans perdre l’outbox offline.
 */
async function adoptAuthenticatedSession(session: AuthSession): Promise<AuthSession> {
  const previous = await getMeta<AuthSession | null>(META_KEYS.auth);
  const rememberedUserId = await getMeta<string | null>(META_KEYS.lastUserId);
  const previousUserId = previous?.user._id ?? rememberedUserId ?? null;
  const nextUserId = session.user._id;

  const switchedUser = previousUserId != null && previousUserId !== nextUserId;
  // Logout a déjà purgé ; si auth+lastUserId absents mais tables pleines → base orpheline.
  const orphanLocalData =
    previousUserId == null && (await hasLocalUserScopedData());
  const foreignRows = await hasForeignUserScopedData(nextUserId);

  if (switchedUser || orphanLocalData || foreignRows) {
    await withLocalDataBarrier(async () => {
      await clearUserScopedLocalData();
    });
  }

  await setMeta(META_KEYS.auth, session);
  await setMeta(META_KEYS.lastUserId, nextUserId);
  return session;
}

export async function registerRequest(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthSession> {
  const data = await apiRequest<AuthResponse>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(input) },
    { auth: false },
  );
  return adoptAuthenticatedSession(toSession(data.user, data.tokens));
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthSession> {
  const data = await apiRequest<AuthResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    { auth: false },
  );
  return adoptAuthenticatedSession(toSession(data.user, data.tokens));
}

export async function logoutLocal(): Promise<void> {
  await withLocalDataBarrier(async () => {
    await clearUserScopedLocalData();
  });
}

export async function fetchCatalog(sinceVersion = 0): Promise<CatalogResponse> {
  return apiRequest<CatalogResponse>(`/catalog?sinceVersion=${sinceVersion}`);
}

export async function pushMutations(
  deviceId: string,
  mutations: SyncPushMutation[],
): Promise<SyncPushResponse> {
  return apiRequest<SyncPushResponse>('/sync/push', {
    method: 'POST',
    body: JSON.stringify({ deviceId, mutations }),
  });
}

export async function pullChanges(deviceId: string, since: string): Promise<SyncPullResponse> {
  const qs = new URLSearchParams({ deviceId, since });
  return apiRequest<SyncPullResponse>(`/sync/pull?${qs.toString()}`);
}

export async function createHouseholdRequest(name: string): Promise<HouseholdResponse> {
  return apiRequest<HouseholdResponse>('/households', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function joinHouseholdRequest(code: string): Promise<HouseholdResponse> {
  return apiRequest<HouseholdResponse>('/households/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function fetchMyHousehold(): Promise<HouseholdResponse> {
  return apiRequest<HouseholdResponse>('/households/me');
}

export async function leaveHouseholdRequest(): Promise<{ left: true; dissolved: boolean }> {
  return apiRequest<{ left: true; dissolved: boolean }>('/households/leave', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rotateHouseholdCodeRequest(): Promise<HouseholdResponse> {
  return apiRequest<HouseholdResponse>('/households/rotate-code', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
