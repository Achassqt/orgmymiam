import type {
  MealPlan,
  Product,
  Recipe,
  ShoppingList,
  SyncEntity,
  SyncEntityName,
  SyncPushMutation,
} from '@orgmymiam/shared';
import { fetchCatalog, pullChanges, pushMutations } from '../api/client';
import {
  db,
  ensureDeviceId,
  getMeta,
  META_KEYS,
  setMeta,
  type AuthSession,
  type OutboxEntry,
  type SyncStatus,
} from '../db/database';

type Listener = (status: SyncStatus) => void;

const listeners = new Set<Listener>();
let running: Promise<void> | null = null;
let onlineHandlerBound = false;

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function setStatus(status: SyncStatus, error?: string): Promise<void> {
  await setMeta(META_KEYS.lastSyncStatus, status);
  if (error) {
    await setMeta(META_KEYS.lastSyncError, error);
  } else if (status !== 'error') {
    await setMeta(META_KEYS.lastSyncError, null);
  }
  for (const listener of listeners) listener(status);
}

function tableFor(entity: SyncEntityName) {
  switch (entity) {
    case 'products':
      return db.products;
    case 'recipes':
      return db.recipes;
    case 'meal_plans':
      return db.mealPlans;
    case 'shopping_lists':
      return db.shoppingLists;
  }
}

async function applyServerDocument(entity: SyncEntityName, doc: SyncEntity): Promise<void> {
  await tableFor(entity).put(doc as never);
}

async function flushOutbox(deviceId: string): Promise<void> {
  const pending = await db.outbox.orderBy('createdAt').toArray();
  if (pending.length === 0) return;

  const mutations: SyncPushMutation[] = pending.map((entry) => ({
    entity: entry.entity,
    op: entry.op,
    payload: entry.payload,
  })) as SyncPushMutation[];

  const result = await pushMutations(deviceId, mutations);

  for (let i = 0; i < result.results.length; i += 1) {
    const item = result.results[i]!;
    const entry = pending[i]!;

    if (item.status === 'accepted') {
      await applyServerDocument(item.entity, item.document);
      await db.outbox.delete(entry.id);
      continue;
    }

    if (item.reason === 'stale' && item.serverDocument) {
      // MVP : écraser le local avec la version serveur
      await applyServerDocument(item.entity, item.serverDocument);
      await db.outbox.delete(entry.id);
      continue;
    }

    await db.outbox.update(entry.id, {
      attempts: entry.attempts + 1,
      lastError: item.message ?? item.reason,
    });
  }
}

async function applyPull(payload: Awaited<ReturnType<typeof pullChanges>>): Promise<void> {
  await db.transaction(
    'rw',
    db.products,
    db.recipes,
    db.mealPlans,
    db.shoppingLists,
    async () => {
      await db.products.bulkPut(payload.products as Product[]);
      await db.recipes.bulkPut(payload.recipes as Recipe[]);
      await db.mealPlans.bulkPut(payload.mealPlans as MealPlan[]);
      await db.shoppingLists.bulkPut(payload.shoppingLists as ShoppingList[]);
    },
  );
  await setMeta(META_KEYS.lastSyncAt, payload.cursor);
}

export async function syncCatalog(): Promise<void> {
  const sinceVersion = (await getMeta<number>(META_KEYS.catalogVersion)) ?? 0;
  const catalog = await fetchCatalog(sinceVersion);
  if (catalog.products.length > 0) {
    await db.catalogProducts.bulkPut(catalog.products);
  }
  await setMeta(META_KEYS.catalogVersion, catalog.catalogVersion);
}

export async function runSync(reason = 'manual'): Promise<void> {
  if (running) return running;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await setStatus('offline');
    return;
  }

  const session = await getMeta<AuthSession | null>(META_KEYS.auth);
  if (!session?.accessToken) {
    await setStatus('idle');
    return;
  }

  running = (async () => {
    try {
      await setStatus('syncing');
      const deviceId = await ensureDeviceId();
      await syncCatalog();
      await flushOutbox(deviceId);
      const since = (await getMeta<string>(META_KEYS.lastSyncAt)) ?? '1970-01-01T00:00:00.000Z';
      const pulled = await pullChanges(deviceId, since);
      await applyPull(pulled);
      await setStatus('idle');
      console.debug('[sync] ok', reason);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de sync';
      await setStatus('error', message);
      console.warn('[sync] failed', reason, err);
    } finally {
      running = null;
    }
  })();

  return running;
}

export function enqueueOutbox(entry: OutboxEntry): Promise<string> {
  return db.outbox.put(entry).then(() => {
    void runSync('outbox');
    return entry.id;
  });
}

export function bindOnlineSync(): void {
  if (onlineHandlerBound || typeof window === 'undefined') return;
  onlineHandlerBound = true;
  window.addEventListener('online', () => {
    void runSync('online');
  });
  window.addEventListener('offline', () => {
    void setStatus('offline');
  });
}
