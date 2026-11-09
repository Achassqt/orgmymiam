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
import { mergeEntityLww } from './lww';

type Listener = (status: SyncStatus) => void;
type NoticeListener = (notice: string | null) => void;

const listeners = new Set<Listener>();
const noticeListeners = new Set<NoticeListener>();
let running: Promise<void> | null = null;
let onlineHandlerBound = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let enqueueTimer: ReturnType<typeof setTimeout> | null = null;

export const OUTBOX_MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeSyncNotice(listener: NoticeListener): () => void {
  noticeListeners.add(listener);
  return () => noticeListeners.delete(listener);
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

async function setNotice(notice: string | null): Promise<void> {
  await setMeta(META_KEYS.lastSyncNotice, notice);
  for (const listener of noticeListeners) listener(notice);
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

async function readLocal(entity: SyncEntityName, id: string): Promise<SyncEntity | undefined> {
  return (await tableFor(entity).get(id)) as SyncEntity | undefined;
}

async function applyServerDocument(
  entity: SyncEntityName,
  doc: SyncEntity,
  opts: { mergeLww?: boolean } = {},
): Promise<SyncEntity> {
  if (opts.mergeLww) {
    const local = await readLocal(entity, doc._id);
    const merged = mergeEntityLww(entity, local, doc);
    await tableFor(entity).put(merged as never);
    return merged;
  }
  await tableFor(entity).put(doc as never);
  return doc;
}

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = Math.floor(Math.random() * 400);
  return exp + jitter;
}

function scheduleRetryWakeup(): void {
  if (typeof window === 'undefined') return;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  void db.outbox
    .filter((e) => !e.deadLetter && !!e.nextRetryAt)
    .toArray()
    .then((entries) => {
      if (entries.length === 0) return;
      const next = entries
        .map((e) => Date.parse(e.nextRetryAt!))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b)[0];
      if (next == null) return;
      const delay = Math.max(250, next - Date.now());
      retryTimer = setTimeout(() => {
        void runSync('retry-timer');
      }, delay);
    })
    .catch(() => undefined);
}

async function markRetry(entry: OutboxEntry, error: string): Promise<void> {
  const attempts = entry.attempts + 1;
  const deadLetter = attempts >= OUTBOX_MAX_ATTEMPTS;
  const nextRetryAt = deadLetter
    ? undefined
    : new Date(Date.now() + backoffMs(attempts)).toISOString();

  await db.outbox.update(entry.id, {
    attempts,
    lastError: error,
    nextRetryAt,
    deadLetter,
  });
}

async function flushOutbox(deviceId: string): Promise<{ conflicts: number; deadLetters: number }> {
  const now = Date.now();
  const pending = (await db.outbox.orderBy('createdAt').toArray()).filter((entry) => {
    if (entry.deadLetter) return false;
    if (!entry.nextRetryAt) return true;
    return Date.parse(entry.nextRetryAt) <= now;
  });

  if (pending.length === 0) {
    return { conflicts: 0, deadLetters: 0 };
  }

  // Un seul payload par entityId : le plus récent (coalesce défensif)
  const latestByKey = new Map<string, OutboxEntry>();
  for (const entry of pending) {
    latestByKey.set(`${entry.entity}:${entry.entityId}`, entry);
  }
  const batch = [...latestByKey.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Drop superseded older rows still in outbox for same key
  const keepIds = new Set(batch.map((e) => e.id));
  for (const entry of pending) {
    if (!keepIds.has(entry.id)) {
      await db.outbox.delete(entry.id);
    }
  }

  const mutations: SyncPushMutation[] = batch.map((entry) => ({
    entity: entry.entity,
    op: entry.op,
    payload: entry.payload,
  })) as SyncPushMutation[];

  let conflicts = 0;
  let deadLetters = 0;

  try {
    const result = await pushMutations(deviceId, mutations);

    for (let i = 0; i < result.results.length; i += 1) {
      const item = result.results[i]!;
      const entry = batch[i]!;

      if (item.status === 'accepted') {
        // Ne pas écraser un local plus récent non encore re-poussé
        await applyServerDocument(item.entity, item.document, { mergeLww: true });
        await db.outbox.delete(entry.id);
        continue;
      }

      if (item.reason === 'stale' && item.serverDocument) {
        conflicts += 1;
        const merged = await applyServerDocument(item.entity, item.serverDocument, {
          mergeLww: true,
        });
        await db.outbox.delete(entry.id);

        // Si le merge a gardé des changements locaux plus récents, re-queue un update
        if (merged.updatedAt > item.serverDocument.updatedAt || merged.rev > item.serverDocument.rev) {
          await enqueueOutbox(
            {
              id: crypto.randomUUID(),
              entity: item.entity,
              entityId: merged._id,
              op: 'update',
              payload: merged,
              createdAt: new Date().toISOString(),
              attempts: 0,
            },
            { syncNow: false },
          );
        }
        continue;
      }

      const message = item.message ?? item.reason;
      await markRetry(entry, message);
      if ((entry.attempts + 1) >= OUTBOX_MAX_ATTEMPTS) {
        deadLetters += 1;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Push échoué';
    for (const entry of batch) {
      await markRetry(entry, message);
      if (entry.attempts + 1 >= OUTBOX_MAX_ATTEMPTS) deadLetters += 1;
    }
    throw err;
  }

  scheduleRetryWakeup();
  return { conflicts, deadLetters };
}

async function applyPull(payload: Awaited<ReturnType<typeof pullChanges>>): Promise<void> {
  const pendingKeys = new Set(
    (await db.outbox.toArray()).map((e) => `${e.entity}:${e.entityId}`),
  );

  await db.transaction(
    'rw',
    db.products,
    db.recipes,
    db.mealPlans,
    db.shoppingLists,
    async () => {
      for (const doc of payload.products as Product[]) {
        if (pendingKeys.has(`products:${doc._id}`)) {
          const local = await db.products.get(doc._id);
          const merged = mergeEntityLww('products', local, doc);
          await db.products.put(merged as Product);
        } else {
          await db.products.put(doc);
        }
      }
      for (const doc of payload.recipes as Recipe[]) {
        if (pendingKeys.has(`recipes:${doc._id}`)) {
          const local = await db.recipes.get(doc._id);
          const merged = mergeEntityLww('recipes', local, doc);
          await db.recipes.put(merged as Recipe);
        } else {
          await db.recipes.put(doc);
        }
      }
      for (const doc of payload.mealPlans as MealPlan[]) {
        if (pendingKeys.has(`meal_plans:${doc._id}`)) {
          const local = await db.mealPlans.get(doc._id);
          const merged = mergeEntityLww('meal_plans', local, doc);
          await db.mealPlans.put(merged as MealPlan);
        } else {
          await db.mealPlans.put(doc);
        }
      }
      for (const doc of payload.shoppingLists as ShoppingList[]) {
        const local = await db.shoppingLists.get(doc._id);
        if (pendingKeys.has(`shopping_lists:${doc._id}`) || local) {
          const merged = mergeEntityLww('shopping_lists', local, doc) as ShoppingList;
          await db.shoppingLists.put(merged);
        } else {
          await db.shoppingLists.put(doc);
        }
      }
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
      let conflicts = 0;
      let deadLetters = 0;
      // Jusqu’à 3 passes si un conflit LWW re-queue un update local plus récent
      for (let round = 0; round < 3; round += 1) {
        const result = await flushOutbox(deviceId);
        conflicts += result.conflicts;
        deadLetters += result.deadLetters;
        const dueLeft = await db.outbox
          .filter((e) => !e.deadLetter && (!e.nextRetryAt || Date.parse(e.nextRetryAt) <= Date.now()))
          .count();
        if (dueLeft === 0) break;
      }
      const since = (await getMeta<string>(META_KEYS.lastSyncAt)) ?? '1970-01-01T00:00:00.000Z';
      const pulled = await pullChanges(deviceId, since);
      await applyPull(pulled);

      const remaining = await db.outbox.filter((e) => !e.deadLetter).count();
      if (conflicts > 0) {
        await setNotice(
          conflicts === 1
            ? 'Conflit résolu (version serveur fusionnée).'
            : `${conflicts} conflits résolus (fusion LWW).`,
        );
      } else if (deadLetters > 0) {
        await setNotice(`${deadLetters} mutation(s) en échec définitif — voir outbox.`);
      } else if (remaining === 0) {
        await setNotice(null);
      }

      await setStatus('idle');
      console.debug('[sync] ok', reason);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de sync';
      await setStatus('error', message);
      scheduleRetryWakeup();
      console.warn('[sync] failed', reason, err);
    } finally {
      running = null;
    }
  })();

  return running;
}

export async function enqueueOutbox(
  entry: OutboxEntry,
  opts: { syncNow?: boolean } = {},
): Promise<string> {
  const keyEntity = entry.entity;
  const keyId = entry.entityId;

  const existing = await db.outbox
    .filter((e) => e.entity === keyEntity && e.entityId === keyId && !e.deadLetter)
    .first();

  let outboxId = entry.id;
  if (existing) {
    // Coalesce : garder un seul job avec le payload le plus récent
    let op = entry.op;
    if (existing.op === 'create' && entry.op === 'update') {
      op = 'create';
    }
    if (entry.op === 'delete') {
      op = 'delete';
    }
    outboxId = existing.id;
    await db.outbox.put({
      ...existing,
      op,
      payload: entry.payload,
      createdAt: existing.createdAt,
      attempts: existing.attempts,
      lastError: undefined,
      nextRetryAt: undefined,
      deadLetter: false,
    });
  } else {
    await db.outbox.put({
      ...entry,
      attempts: entry.attempts ?? 0,
      nextRetryAt: undefined,
      deadLetter: false,
    });
  }

  if (opts.syncNow === false) {
    return outboxId;
  }

  if (enqueueTimer) clearTimeout(enqueueTimer);
  enqueueTimer = setTimeout(() => {
    void runSync('outbox');
  }, 150);

  return outboxId;
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
  window.addEventListener('focus', () => {
    if (navigator.onLine) void runSync('focus');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void runSync('visibility');
    }
  });

  scheduleRetryWakeup();
}

export async function clearDeadLetters(): Promise<number> {
  const dead = await db.outbox.filter((e) => !!e.deadLetter).toArray();
  await db.outbox.bulkDelete(dead.map((d) => d.id));
  return dead.length;
}
