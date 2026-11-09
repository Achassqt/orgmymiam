import Dexie, { type EntityTable } from 'dexie';
import type {
  CatalogProduct,
  MealPlan,
  Product,
  PublicUser,
  Recipe,
  ShoppingList,
  SyncEntity,
  SyncEntityName,
} from '@orgmymiam/shared';

export type OutboxOp = 'create' | 'update' | 'delete';

export interface OutboxEntry {
  id: string;
  entity: SyncEntityName;
  entityId: string;
  op: OutboxOp;
  payload: SyncEntity;
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** ISO — ne pas retenter avant cette date */
  nextRetryAt?: string;
  /** Trop d’échecs : exclu du flush automatique */
  deadLetter?: boolean;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  /** epoch ms when access token is considered expired */
  accessExpiresAt: number;
}

export type MetaValue =
  | string
  | number
  | boolean
  | null
  | AuthSession
  | Record<string, unknown>;

export interface MetaRecord {
  key: string;
  value: MetaValue;
}

export const META_KEYS = {
  deviceId: 'deviceId',
  auth: 'auth',
  /** Dernier userId connu — survit à un auth null (token expiré) pour éviter une purge mono-compte. */
  lastUserId: 'lastUserId',
  catalogVersion: 'catalogVersion',
  lastSyncAt: 'lastSyncAt',
  lastSyncError: 'lastSyncError',
  lastSyncStatus: 'lastSyncStatus',
  lastSyncNotice: 'lastSyncNotice',
} as const;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export class OrgMyMiamDB extends Dexie {
  meta!: EntityTable<MetaRecord, 'key'>;
  catalogProducts!: EntityTable<CatalogProduct, '_id'>;
  products!: EntityTable<Product, '_id'>;
  recipes!: EntityTable<Recipe, '_id'>;
  mealPlans!: EntityTable<MealPlan, '_id'>;
  shoppingLists!: EntityTable<ShoppingList, '_id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;

  constructor() {
    super('orgmymiam');

    this.version(1).stores({
      meta: 'key',
      catalogProducts: '_id, nameNormalized, catalogVersion, category',
      products: '_id, userId, nameNormalized, updatedAt, deletedAt',
      recipes: '_id, userId, updatedAt, deletedAt',
      mealPlans: '_id, userId, updatedAt, deletedAt, startDate',
      shoppingLists: '_id, userId, updatedAt, deletedAt, status',
      outbox: 'id, entity, entityId, createdAt',
    });
  }
}

export const db = new OrgMyMiamDB();

export async function getMeta<T extends MetaValue>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: MetaValue): Promise<void> {
  await db.meta.put({ key, value });
}

export async function ensureDeviceId(): Promise<string> {
  const existing = await getMeta<string>(META_KEYS.deviceId);
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  await setMeta(META_KEYS.deviceId, deviceId);
  return deviceId;
}

export async function deleteMeta(key: string): Promise<void> {
  await db.meta.delete(key);
}

/**
 * Clés meta liées à la session / sync utilisateur.
 * Conservés volontairement au switch de compte :
 * - `deviceId` : identité appareil (cursors serveur sont (userId, deviceId))
 * - `catalogVersion` + table `catalogProducts` : catalogue socle partagé
 */
export const USER_SCOPED_META_KEYS = [
  META_KEYS.auth,
  META_KEYS.lastUserId,
  META_KEYS.lastSyncAt,
  META_KEYS.lastSyncError,
  META_KEYS.lastSyncStatus,
  META_KEYS.lastSyncNotice,
] as const;

/** Purge données user locales + meta sync/auth. Garde catalogue + deviceId. */
export async function clearUserScopedLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.meta, db.products, db.recipes, db.mealPlans, db.shoppingLists, db.outbox],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.recipes.clear(),
        db.mealPlans.clear(),
        db.shoppingLists.clear(),
        db.outbox.clear(),
        ...USER_SCOPED_META_KEYS.map((key) => db.meta.delete(key)),
      ]);
    },
  );
}

/** True s’il reste des données user / outbox locales (ex. logout incomplet). */
export async function hasLocalUserScopedData(): Promise<boolean> {
  const [products, recipes, mealPlans, shoppingLists, outbox] = await Promise.all([
    db.products.count(),
    db.recipes.count(),
    db.mealPlans.count(),
    db.shoppingLists.count(),
    db.outbox.count(),
  ]);
  return products + recipes + mealPlans + shoppingLists + outbox > 0;
}

/** True si une table user contient un autre `userId` que celui fourni. */
export async function hasForeignUserScopedData(userId: string): Promise<boolean> {
  const [product, recipe, mealPlan, shoppingList] = await Promise.all([
    db.products.filter((row) => row.userId !== userId).first(),
    db.recipes.filter((row) => row.userId !== userId).first(),
    db.mealPlans.filter((row) => row.userId !== userId).first(),
    db.shoppingLists.filter((row) => row.userId !== userId).first(),
  ]);
  return Boolean(product || recipe || mealPlan || shoppingList);
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getMeta<AuthSession | null>(META_KEYS.auth);
  return session?.user._id ?? null;
}
