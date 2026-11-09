import type { ShoppingList, ShoppingListItem, SyncEntity } from '@orgmymiam/shared';

/** Compare ISO timestamps ; égalité → true si a >= b. */
export function isAtLeastAsNew(a: string, b: string): boolean {
  return a >= b;
}

/**
 * Fusion LWW au niveau item pour une shopping list.
 * Évite de perdre des cochages offline plus récents qu’une version serveur.
 */
export function mergeShoppingListLww(local: ShoppingList, server: ShoppingList): ShoppingList {
  const byId = new Map<string, ShoppingListItem>();

  for (const item of server.items) {
    byId.set(item.id, item);
  }
  for (const item of local.items) {
    const existing = byId.get(item.id);
    if (!existing || isAtLeastAsNew(item.updatedAt, existing.updatedAt)) {
      byId.set(item.id, item);
    }
  }

  const listWinner = isAtLeastAsNew(local.updatedAt, server.updatedAt) ? local : server;
  const items = [...byId.values()].sort((a, b) =>
    a.nameSnapshot.localeCompare(b.nameSnapshot, 'fr'),
  );

  const serverById = new Map(server.items.map((i) => [i.id, i]));
  const itemsDiverge = items.some((item) => {
    const s = serverById.get(item.id);
    return !s || s.updatedAt !== item.updatedAt || s.checked !== item.checked;
  }) || items.length !== server.items.length;

  // Si des items locaux plus récents ont été gardés, remonter updatedAt/rev
  // pour permettre un re-push après un rejet stale.
  const baseUpdatedAt =
    local.updatedAt >= server.updatedAt ? local.updatedAt : server.updatedAt;
  const newestItemAt = items.reduce(
    (max, item) => (item.updatedAt > max ? item.updatedAt : max),
    baseUpdatedAt,
  );

  return {
    ...listWinner,
    items,
    rev: Math.max(local.rev, server.rev) + (itemsDiverge ? 1 : 0),
    updatedAt: itemsDiverge
      ? newestItemAt > baseUpdatedAt
        ? newestItemAt
        : new Date(Date.parse(baseUpdatedAt) + 1).toISOString()
      : baseUpdatedAt,
    deletedAt:
      local.deletedAt && server.deletedAt
        ? local.deletedAt >= server.deletedAt
          ? local.deletedAt
          : server.deletedAt
        : (local.deletedAt ?? server.deletedAt),
  };
}

export function mergeEntityLww(
  entity: 'products' | 'recipes' | 'meal_plans' | 'shopping_lists',
  local: SyncEntity | undefined,
  server: SyncEntity,
): SyncEntity {
  if (!local) return server;

  if (entity === 'shopping_lists') {
    return mergeShoppingListLww(local as ShoppingList, server as ShoppingList);
  }

  // Autres entités : LWW document entier
  return isAtLeastAsNew(local.updatedAt, server.updatedAt) ? local : server;
}
