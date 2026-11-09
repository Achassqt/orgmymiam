import type { AuthResponse, AuthTokens, CatalogResponse, SyncPullResponse, SyncPushResponse } from '@orgmymiam/shared';
import type { SyncPushMutation } from '@orgmymiam/shared';
import { getMeta, META_KEYS, setMeta, type AuthSession } from '../db/database';

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
  const session = toSession(data.user, data.tokens);
  await setMeta(META_KEYS.auth, session);
  return session;
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
  const session = toSession(data.user, data.tokens);
  await setMeta(META_KEYS.auth, session);
  return session;
}

export async function logoutLocal(): Promise<void> {
  await setMeta(META_KEYS.auth, null);
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
