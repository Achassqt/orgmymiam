import type {
  Household,
  HouseholdShare,
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
import type { Collection, Filter } from 'mongodb';
import { getCollections } from '../db/mongo.js';
import { newId, nowIso } from '../utils/crypto.js';
import { findHouseholdForUser } from './households.js';

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

function shareOf(doc: SyncEntity): HouseholdShare {
  return {
    householdId: doc.householdId ?? null,
    visibility: doc.visibility ?? 'private',
  };
}

function canAccessHouseholdDoc(
  authUserId: string,
  household: Household | null,
  doc: SyncEntity,
): boolean {
  const share = shareOf(doc);
  if (share.visibility !== 'household' || !share.householdId || !household) {
    return false;
  }
  return (
    share.householdId === household._id && household.memberIds.includes(authUserId)
  );
}

function canMutate(
  authUserId: string,
  household: Household | null,
  doc: SyncEntity,
  existing: SyncEntity | null,
): { ok: true } | { ok: false; message: string } {
  // Création / maj de ses propres docs
  if (doc.userId === authUserId) {
    const share = shareOf(doc);
    if (share.visibility === 'household') {
      if (!household || share.householdId !== household._id) {
        return {
          ok: false,
          message: 'visibility household exige d’appartenir au foyer indiqué',
        };
      }
    } else if (share.householdId != null) {
      return { ok: false, message: 'householdId doit être null en private' };
    }
    if (existing && existing.userId !== authUserId && !canAccessHouseholdDoc(authUserId, household, existing)) {
      return { ok: false, message: 'Document appartenant à un autre utilisateur' };
    }
    return { ok: true };
  }

  // Membre foyer qui mute un doc household d’un autre membre
  if (!canAccessHouseholdDoc(authUserId, household, doc)) {
    return {
      ok: false,
      message: 'userId ne correspond pas à l’utilisateur authentifié',
    };
  }
  if (existing && !canAccessHouseholdDoc(authUserId, household, existing)) {
    return { ok: false, message: 'Document hors foyer' };
  }
  // Le userId du doc doit rester celui du propriétaire d’origine
  if (existing && existing.userId !== doc.userId) {
    return { ok: false, message: 'Impossible de changer le propriétaire' };
  }
  return { ok: true };
}

async function applyMutation(
  userId: string,
  household: Household | null,
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

  const col = collectionFor(mutation.entity);
  const existing = (await col.findOne({ _id: parsed._id })) as SyncEntity | null;

  const access = canMutate(userId, household, parsed, existing);
  if (!access.ok) {
    return {
      entity: mutation.entity,
      id: parsed._id,
      status: 'rejected',
      reason: 'forbidden',
      message: access.message,
    };
  }

  if (mutation.entity === 'shopping_lists') {
    const list = parsed as ShoppingList;
    if (!list.memberIds.includes(list.userId)) {
      return {
        entity: mutation.entity,
        id: parsed._id,
        status: 'rejected',
        reason: 'forbidden',
        message: 'memberIds doit inclure le propriétaire',
      };
    }
    if (shareOf(list).visibility === 'household' && household) {
      const missingOwner = !list.memberIds.includes(list.userId);
      if (missingOwner) {
        return {
          entity: mutation.entity,
          id: parsed._id,
          status: 'rejected',
          reason: 'invalid',
          message: 'memberIds incohérent',
        };
      }
    }
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
  const household = await findHouseholdForUser(userId);
  const results: SyncPushResult[] = [];
  for (const mutation of mutations) {
    results.push(await applyMutation(userId, household, mutation));
  }

  const serverTime = nowIso();
  await upsertCursor(userId, deviceId, serverTime);

  return { results, serverTime };
}

function pullFilter(userId: string, household: Household | null, since: string): Filter<SyncEntity> {
  const owned = { userId, updatedAt: { $gt: since } };
  if (!household) {
    return owned as Filter<SyncEntity>;
  }
  return {
    updatedAt: { $gt: since },
    $or: [
      { userId },
      { householdId: household._id, visibility: 'household' },
    ],
  } as Filter<SyncEntity>;
}

export async function pullChanges(
  userId: string,
  deviceId: string,
  since: string,
): Promise<SyncPullResponse> {
  const cols = getCollections();
  const household = await findHouseholdForUser(userId);
  const filter = pullFilter(userId, household, since);

  const [products, recipes, mealPlans, shoppingLists] = await Promise.all([
    cols.products.find(filter as Filter<Product>).toArray(),
    cols.recipes.find(filter as Filter<Recipe>).toArray(),
    cols.mealPlans.find(filter as Filter<MealPlan>).toArray(),
    cols.shoppingLists.find(filter as Filter<ShoppingList>).toArray(),
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
