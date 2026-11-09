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
