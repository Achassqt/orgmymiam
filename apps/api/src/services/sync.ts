import type {
  MealPlan,
  Product,
  Recipe,
  ShoppingList,
  SyncEntity,
  SyncEntityName,
  SyncPullResponse,
  SyncPushMutation,
  SyncPushResponse,
  SyncPushResult,
} from '@orgmymiam/shared';
import {
  mealPlanSchema,
  productSchema,
  recipeSchema,
  shoppingListSchema,
} from '@orgmymiam/shared';
import type { Collection } from 'mongodb';
import { getCollections } from '../db/mongo.js';
import { newId, nowIso } from '../utils/crypto.js';

type UserCollection = Collection<Product> | Collection<Recipe> | Collection<MealPlan> | Collection<ShoppingList>;

function collectionFor(entity: SyncEntityName): UserCollection {
  const cols = getCollections();
  switch (entity) {
    case 'products':
      return cols.products;
    case 'recipes':
      return cols.recipes;
    case 'meal_plans':
      return cols.mealPlans;
    case 'shopping_lists':
      return cols.shoppingLists;
  }
}

function parseEntity(entity: SyncEntityName, payload: SyncEntity): SyncEntity | null {
  const result =
    entity === 'products'
      ? productSchema.safeParse(payload)
      : entity === 'recipes'
        ? recipeSchema.safeParse(payload)
        : entity === 'meal_plans'
          ? mealPlanSchema.safeParse(payload)
          : shoppingListSchema.safeParse(payload);

  return result.success ? (result.data as SyncEntity) : null;
}

function isNewerOrEqual(incoming: SyncEntity, stored: SyncEntity): boolean {
  if (incoming.updatedAt > stored.updatedAt) return true;
  if (incoming.updatedAt < stored.updatedAt) return false;
  return incoming.rev >= stored.rev;
}

async function applyMutation(
  userId: string,
  mutation: SyncPushMutation,
): Promise<SyncPushResult> {
  const parsed = parseEntity(mutation.entity, mutation.payload);
  if (!parsed) {
    return {
      entity: mutation.entity,
      id: mutation.payload._id,
      status: 'rejected',
      reason: 'invalid',
      message: 'Payload invalide',
    };
  }

  if (parsed.userId !== userId) {
    return {
      entity: mutation.entity,
      id: parsed._id,
      status: 'rejected',
      reason: 'forbidden',
      message: 'userId ne correspond pas à l’utilisateur authentifié',
    };
  }

  if (mutation.entity === 'shopping_lists') {
    const list = parsed as ShoppingList;
    if (!list.memberIds.includes(userId)) {
      return {
        entity: mutation.entity,
        id: parsed._id,
        status: 'rejected',
        reason: 'forbidden',
        message: 'memberIds doit inclure le propriétaire',
      };
    }
  }

  const col = collectionFor(mutation.entity);
  const existing = (await col.findOne({ _id: parsed._id })) as SyncEntity | null;

  if (existing && existing.userId !== userId) {
    return {
      entity: mutation.entity,
      id: parsed._id,
      status: 'rejected',
      reason: 'forbidden',
    };
  }

  if (existing && !isNewerOrEqual(parsed, existing)) {
    return {
      entity: mutation.entity,
      id: parsed._id,
      status: 'rejected',
      reason: 'stale',
      serverDocument: existing,
    };
  }

  let document = parsed;
  if (mutation.op === 'delete') {
    document = {
      ...parsed,
      deletedAt: parsed.deletedAt ?? nowIso(),
    };
  }

  await col.replaceOne({ _id: document._id }, document as never, { upsert: true });

  return {
    entity: mutation.entity,
    id: document._id,
    status: 'accepted',
    document,
  };
}

export async function pushMutations(
  userId: string,
  deviceId: string,
  mutations: SyncPushMutation[],
): Promise<SyncPushResponse> {
  const results: SyncPushResult[] = [];
  for (const mutation of mutations) {
    results.push(await applyMutation(userId, mutation));
  }

  const serverTime = nowIso();
  await upsertCursor(userId, deviceId, serverTime);

  return { results, serverTime };
}

export async function pullChanges(
  userId: string,
  deviceId: string,
  since: string,
): Promise<SyncPullResponse> {
  const cols = getCollections();
  const filter = { userId, updatedAt: { $gt: since } };

  const [products, recipes, mealPlans, shoppingLists] = await Promise.all([
    cols.products.find(filter).toArray(),
    cols.recipes.find(filter).toArray(),
    cols.mealPlans.find(filter).toArray(),
    cols.shoppingLists.find(filter).toArray(),
  ]);

  const serverTime = nowIso();
  await upsertCursor(userId, deviceId, serverTime);

  return {
    products,
    recipes,
    mealPlans,
    shoppingLists,
    serverTime,
    cursor: serverTime,
  };
}

async function upsertCursor(userId: string, deviceId: string, lastPulledAt: string): Promise<void> {
  const cols = getCollections();
  const existing = await cols.syncCursors.findOne({ userId, deviceId });
  const now = nowIso();

  if (existing) {
    await cols.syncCursors.updateOne(
      { _id: existing._id },
      { $set: { lastPulledAt, updatedAt: now } },
    );
    return;
  }

  await cols.syncCursors.insertOne({
    _id: newId(),
    userId,
    deviceId,
    lastPulledAt,
    updatedAt: now,
  });
}
