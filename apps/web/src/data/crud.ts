import { normalizeProductName, type MealPlan, type Product, type ProductCategory, type Recipe, type ShoppingList } from '@orgmymiam/shared';
import { db, getMeta, META_KEYS, type AuthSession, type OutboxEntry } from '../db/database';
import { enqueueOutbox } from '../sync/engine';

function nowIso(): string {
  return new Date().toISOString();
}

async function requireUserId(): Promise<string> {
  const session = await getMeta<AuthSession | null>(META_KEYS.auth);
  if (!session?.user._id) {
    throw new Error('Non authentifié');
  }
  return session.user._id;
}

async function queueMutation(
  entity: OutboxEntry['entity'],
  op: OutboxEntry['op'],
  payload: OutboxEntry['payload'],
): Promise<void> {
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    entity,
    entityId: payload._id,
    op,
    payload,
    createdAt: nowIso(),
    attempts: 0,
  };
  await enqueueOutbox(entry);
}

export async function createProduct(input: {
  name: string;
  category?: ProductCategory;
  defaultUnit?: string;
}): Promise<Product> {
  const userId = await requireUserId();
  const now = nowIso();
  const product: Product = {
    _id: crypto.randomUUID(),
    userId,
    name: input.name.trim(),
    nameNormalized: normalizeProductName(input.name),
    category: input.category ?? 'autres',
    defaultUnit: input.defaultUnit ?? 'unité',
    sourceCatalogId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.products.put(product);
  await queueMutation('products', 'create', product);
  return product;
}

export async function softDeleteProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) return;
  const updated: Product = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.products.put(updated);
  await queueMutation('products', 'delete', updated);
}

export async function createRecipe(input: { title: string; servings?: number }): Promise<Recipe> {
  const userId = await requireUserId();
  const now = nowIso();
  const recipe: Recipe = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    servings: input.servings ?? 2,
    ingredients: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.recipes.put(recipe);
  await queueMutation('recipes', 'create', recipe);
  return recipe;
}

export async function softDeleteRecipe(id: string): Promise<void> {
  const existing = await db.recipes.get(id);
  if (!existing) return;
  const updated: Recipe = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.recipes.put(updated);
  await queueMutation('recipes', 'delete', updated);
}

export async function createMealPlan(input: { title: string; startDate: string }): Promise<MealPlan> {
  const userId = await requireUserId();
  const now = nowIso();
  const plan: MealPlan = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    startDate: input.startDate,
    slots: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.mealPlans.put(plan);
  await queueMutation('meal_plans', 'create', plan);
  return plan;
}

export async function softDeleteMealPlan(id: string): Promise<void> {
  const existing = await db.mealPlans.get(id);
  if (!existing) return;
  const updated: MealPlan = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.mealPlans.put(updated);
  await queueMutation('meal_plans', 'delete', updated);
}

export async function createShoppingList(input: { title: string }): Promise<ShoppingList> {
  const userId = await requireUserId();
  const now = nowIso();
  const list: ShoppingList = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    mealPlanId: null,
    status: 'open',
    items: [],
    memberIds: [userId],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.shoppingLists.put(list);
  await queueMutation('shopping_lists', 'create', list);
  return list;
}

export async function softDeleteShoppingList(id: string): Promise<void> {
  const existing = await db.shoppingLists.get(id);
  if (!existing) return;
  const updated: ShoppingList = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.shoppingLists.put(updated);
  await queueMutation('shopping_lists', 'delete', updated);
}
