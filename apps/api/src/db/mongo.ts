import { MongoClient, type Db, type Collection } from 'mongodb';
import type {
  CatalogProduct,
  MealPlan,
  Product,
  Recipe,
  ShoppingList,
  SyncCursor,
  User,
} from '@orgmymiam/shared';
import { env } from '../config/env.js';

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: string;
  revokedAt: string | null;
}

export interface Collections {
  users: Collection<User>;
  catalogProducts: Collection<CatalogProduct>;
  products: Collection<Product>;
  recipes: Collection<Recipe>;
  mealPlans: Collection<MealPlan>;
  shoppingLists: Collection<ShoppingList>;
  syncCursors: Collection<SyncCursor>;
  refreshTokens: Collection<RefreshTokenDoc>;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let collections: Collections | null = null;

export async function connectMongo(): Promise<{ db: Db; collections: Collections }> {
  if (db && collections) {
    return { db, collections };
  }

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db();
  collections = {
    users: db.collection<User>('users'),
    catalogProducts: db.collection<CatalogProduct>('catalog_products'),
    products: db.collection<Product>('products'),
    recipes: db.collection<Recipe>('recipes'),
    mealPlans: db.collection<MealPlan>('meal_plans'),
    shoppingLists: db.collection<ShoppingList>('shopping_lists'),
    syncCursors: db.collection<SyncCursor>('sync_cursors'),
    refreshTokens: db.collection<RefreshTokenDoc>('refresh_tokens'),
  };

  await ensureIndexes(collections);
  return { db, collections };
}

export function getCollections(): Collections {
  if (!collections) {
    throw new Error('MongoDB non initialisé — appeler connectMongo() d’abord');
  }
  return collections;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    collections = null;
  }
}

async function ensureIndexes(cols: Collections): Promise<void> {
  await Promise.all([
    cols.users.createIndex({ email: 1 }, { unique: true }),
    cols.catalogProducts.createIndex({ catalogVersion: 1 }),
    cols.catalogProducts.createIndex({ nameNormalized: 1 }),
    cols.products.createIndex({ userId: 1, updatedAt: 1 }),
    cols.products.createIndex({ userId: 1, nameNormalized: 1 }),
    cols.recipes.createIndex({ userId: 1, updatedAt: 1 }),
    cols.mealPlans.createIndex({ userId: 1, updatedAt: 1 }),
    cols.shoppingLists.createIndex({ userId: 1, updatedAt: 1 }),
    cols.syncCursors.createIndex({ userId: 1, deviceId: 1 }, { unique: true }),
    cols.refreshTokens.createIndex({ userId: 1 }),
    cols.refreshTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
