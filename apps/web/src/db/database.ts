import Dexie, { type EntityTable } from 'dexie';
import type {
  CatalogProduct,
  HouseholdResponse,
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
  /** ISO - ne pas retenter avant cette date */
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
  | HouseholdResponse
  | Record<string, unknown>;

export interface MetaRecord {
  key: string;
  value: MetaValue;
}

export const META_KEYS = {
  deviceId: 'deviceId',
  auth: 'auth',
  /** Dernier userId connu - survit à un auth null (token expiré) pour éviter une purge mono-compte. */
  lastUserId: 'lastUserId',
  /** Cache foyer courant (HouseholdResponse | null). */
  household: 'household',
  catalogVersion: 'catalogVersion',
  lastSyncAt: 'lastSyncAt',
  lastSyncError: 'lastSyncError',
  lastSyncStatus: 'lastSyncStatus',
  lastSyncNotice: 'lastSyncNotice',
  /**
   * Map userId → true : onboarding cartoon déjà vu (survit au logout).
   * Non inclus dans USER_SCOPED_META_KEYS.
   */
  onboardingDoneBy: 'onboardingDoneBy',
  /** Bandeau PWA « Ajouter à l’écran d’accueil » dismissé (appareil). */
  pwaInstallDismissed: 'pwaInstallDismissed',
  /**
   * true quand catalogue + produits locaux ont été re-normalisés
   * après correctif ligatures (œ→oe). Non user-scoped : une fois par appareil.
   */
  nameNormalizeLigaturesV2: 'nameNormalizeLigaturesV2',
  /** Titres listes courses sans tiret cadratin (migration locale). */
  shoppingListEmDashSanitizeV1: 'shoppingListEmDashSanitizeV1',
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

    this.version(2).stores({
      meta: 'key',
      catalogProducts: '_id, nameNormalized, catalogVersion, category',
      products: '_id, userId, householdId, nameNormalized, updatedAt, deletedAt',
      recipes: '_id, userId, householdId, updatedAt, deletedAt',
      mealPlans: '_id, userId, householdId, updatedAt, deletedAt, startDate',
      shoppingLists: '_id, userId, householdId, updatedAt, deletedAt, status',
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
  META_KEYS.household,
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

/**
 * True s’il reste des docs d’un autre compte hors partage foyer.
 * Les docs `visibility: household` d’autres membres sont attendus après pull.
 */
export async function hasForeignUserScopedData(userId: string): Promise<boolean> {
  const isForeignPrivate = (row: { userId: string; visibility?: string }) =>
    row.userId !== userId && row.visibility !== 'household';
  const [product, recipe, mealPlan, shoppingList] = await Promise.all([
    db.products.filter(isForeignPrivate).first(),
    db.recipes.filter(isForeignPrivate).first(),
    db.mealPlans.filter(isForeignPrivate).first(),
    db.shoppingLists.filter(isForeignPrivate).first(),
  ]);
  return Boolean(product || recipe || mealPlan || shoppingList);
}

/** Docs visibles localement : perso + partagés foyer déjà pullés. */
export function isLocallyVisibleDoc(
  row: { deletedAt: string | null },
): boolean {
  return row.deletedAt == null;
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getMeta<AuthSession | null>(META_KEYS.auth);
  return session?.user._id ?? null;
}
