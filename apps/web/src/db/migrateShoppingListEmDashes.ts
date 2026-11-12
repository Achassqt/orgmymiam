import type { ShoppingList } from '@orgmymiam/shared';
import { sanitizeUiEmDash } from '../lib/shoppingListShare';
import { enqueueOutbox } from '../sync/engine';
import { db, getMeta, META_KEYS, setMeta, type OutboxEntry } from './database';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Réécrit les titres de listes qui contiennent encore un tiret cadratin.
 * Idempotent via META_KEYS.shoppingListEmDashSanitizeV1.
 */
export async function migrateShoppingListEmDashes(): Promise<number> {
  const done = await getMeta<boolean>(META_KEYS.shoppingListEmDashSanitizeV1);
  if (done) return 0;

  const updates: ShoppingList[] = [];

  await db.transaction('rw', [db.shoppingLists, db.meta], async () => {
    const lists = await db.shoppingLists.toArray();
    for (const row of lists) {
      if (row.deletedAt != null) continue;
      if (!row.title.includes('—')) continue;
      const nextTitle = sanitizeUiEmDash(row.title);
      if (nextTitle === row.title) continue;
      const updated: ShoppingList = {
        ...row,
        title: nextTitle,
        updatedAt: nowIso(),
        rev: row.rev + 1,
      };
      await db.shoppingLists.put(updated);
      updates.push(updated);
    }
    await setMeta(META_KEYS.shoppingListEmDashSanitizeV1, true);
  });

  for (const list of updates) {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      entity: 'shopping_lists',
      entityId: list._id,
      op: 'update',
      payload: list,
      createdAt: nowIso(),
      attempts: 0,
    };
    await enqueueOutbox(entry, { syncNow: false });
  }

  return updates.length;
}
