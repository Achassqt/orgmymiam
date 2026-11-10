import {
  normalizeProductName,
  type MealPlan,
  type MealSlot,
  type MealType,
  type Product,
  type ProductCategory,
  type Recipe,
  type RecipeIngredient,
  type ShoppingList,
  type ShoppingListItem,
  type Visibility,
} from '@orgmymiam/shared';
import { db, getMeta, META_KEYS, type AuthSession, type OutboxEntry } from '../db/database';
import { enqueueOutbox } from '../sync/engine';
import { defaultShareFields, getCachedHousehold, type CachedHousehold } from './household';
import type { ProductHit } from './productSearch';

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

function canAccessDoc(
  row: { userId: string; visibility?: Visibility; householdId?: string | null },
  userId: string,
  household: CachedHousehold,
): boolean {
  if (row.userId === userId) return true;
  if (row.visibility !== 'household' || !row.householdId || !household?.household) {
    return false;
  }
  return (
    row.householdId === household.household._id &&
    household.household.memberIds.includes(userId)
  );
}

function assertAccessible<
  T extends { userId: string; visibility?: Visibility; householdId?: string | null },
>(row: T | undefined, userId: string, household: CachedHousehold, label: string): T {
  if (!row || !canAccessDoc(row, userId, household)) {
    throw new Error(`${label} introuvable`);
  }
  return row;
}

async function shareDefaults() {
  const household = await getCachedHousehold();
  return { household, share: defaultShareFields(household) };
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

export type CreateProductResult =
  | { status: 'created'; product: Product }
  | { status: 'reused_user'; product: Product }
  | { status: 'reused_catalog'; product: Product; catalogId: string };

/**
 * Crée un produit user, ou réutilise un match exact (user prioritaire, sinon catalogue adopté).
 * Offline-first : écriture Dexie + outbox.
 */
export async function createProduct(input: {
  name: string;
  category?: ProductCategory;
  defaultUnit?: string;
  sourceCatalogId?: string | null;
}): Promise<CreateProductResult> {
  const userId = await requireUserId();
  const name = input.name.trim();
  const nameNormalized = normalizeProductName(name);
  if (!nameNormalized) {
    throw new Error('Nom de produit vide');
  }

  const existingUser = await db.products
    .where('userId')
    .equals(userId)
    .filter((p) => p.deletedAt == null && p.nameNormalized === nameNormalized)
    .first();
  if (existingUser) {
    return { status: 'reused_user', product: existingUser };
  }

  let sourceCatalogId = input.sourceCatalogId ?? null;
  let category = input.category ?? 'autres';
  let defaultUnit = input.defaultUnit ?? 'unité';
  let displayName = name;

  if (!sourceCatalogId) {
    const catalogHit = await db.catalogProducts.where('nameNormalized').equals(nameNormalized).first();
    if (catalogHit) {
      sourceCatalogId = catalogHit._id;
      category = catalogHit.category;
      defaultUnit = catalogHit.defaultUnit;
      displayName = catalogHit.name;
    }
  } else {
    const catalogHit = await db.catalogProducts.get(sourceCatalogId);
    if (catalogHit) {
      category = catalogHit.category;
      defaultUnit = catalogHit.defaultUnit;
      displayName = catalogHit.name;
    }
  }

  const now = nowIso();
  const { share } = await shareDefaults();
  const product: Product = {
    _id: crypto.randomUUID(),
    userId,
    name: displayName,
    nameNormalized,
    category,
    defaultUnit,
    sourceCatalogId,
    householdId: share.householdId,
    visibility: share.visibility,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.products.put(product);
  await queueMutation('products', 'create', product);

  if (sourceCatalogId) {
    return { status: 'reused_catalog', product, catalogId: sourceCatalogId };
  }
  return { status: 'created', product };
}

/** Adopte un produit catalogue dans la liste user (idempotent via nameNormalized). */
export async function adoptCatalogProduct(catalogId: string): Promise<CreateProductResult> {
  const catalog = await db.catalogProducts.get(catalogId);
  if (!catalog) {
    throw new Error('Produit catalogue introuvable');
  }
  return createProduct({
    name: catalog.name,
    category: catalog.category,
    defaultUnit: catalog.defaultUnit,
    sourceCatalogId: catalog._id,
  });
}

export async function softDeleteProduct(id: string): Promise<void> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = await db.products.get(id);
  if (!existing || !canAccessDoc(existing, userId, household)) return;
  const updated: Product = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.products.put(updated);
  await queueMutation('products', 'delete', updated);
}

export async function createRecipe(input: {
  title: string;
  servings?: number;
  notes?: string;
  ingredients?: RecipeIngredient[];
}): Promise<Recipe> {
  const userId = await requireUserId();
  const now = nowIso();
  const { share } = await shareDefaults();
  const recipe: Recipe = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    servings: input.servings ?? 2,
    ingredients: input.ingredients ?? [],
    notes: input.notes?.trim() ?? '',
    householdId: share.householdId,
    visibility: share.visibility,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.recipes.put(recipe);
  await queueMutation('recipes', 'create', recipe);
  return recipe;
}

export async function updateRecipe(
  id: string,
  patch: {
    title?: string;
    servings?: number;
    notes?: string;
    ingredients?: RecipeIngredient[];
  },
): Promise<Recipe> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.recipes.get(id), userId, household, 'Recette');
  if (existing.deletedAt) {
    throw new Error('Recette introuvable');
  }
  const updated: Recipe = {
    ...existing,
    title: patch.title?.trim() ?? existing.title,
    servings: patch.servings ?? existing.servings,
    notes: patch.notes !== undefined ? patch.notes.trim() : existing.notes,
    ingredients: patch.ingredients ?? existing.ingredients,
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.recipes.put(updated);
  await queueMutation('recipes', 'update', updated);
  return updated;
}

export async function softDeleteRecipe(id: string): Promise<void> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = await db.recipes.get(id);
  if (!existing || !canAccessDoc(existing, userId, household)) return;
  const updated: Recipe = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.recipes.put(updated);
  await queueMutation('recipes', 'delete', updated);
}

/** Résout un hit autocomplete vers une référence d’ingrédient (catalog|user). */
export async function resolveIngredientFromHit(
  hit: ProductHit,
  quantity: number,
  unit?: string,
): Promise<RecipeIngredient & { name: string }> {
  if (hit.source === 'catalog' && hit.catalogId) {
    return {
      productId: hit.catalogId,
      productSource: 'catalog',
      quantity,
      unit: unit?.trim() || hit.defaultUnit,
      name: hit.name,
    };
  }
  if (hit.source === 'user' && hit.userProductId) {
    return {
      productId: hit.userProductId,
      productSource: 'user',
      quantity,
      unit: unit?.trim() || hit.defaultUnit,
      name: hit.name,
    };
  }
  throw new Error('Hit produit invalide');
}

export async function resolveIngredientFromNewProduct(
  name: string,
  quantity: number,
  unit?: string,
): Promise<RecipeIngredient & { name: string }> {
  const created = await createProduct({
    name,
    defaultUnit: unit?.trim() || undefined,
  });
  return {
    productId: created.product._id,
    productSource: 'user',
    quantity,
    unit: unit?.trim() || created.product.defaultUnit,
    name: created.product.name,
  };
}

export async function createMealPlan(input: {
  title: string;
  startDate: string;
  slots?: MealSlot[];
}): Promise<MealPlan> {
  const userId = await requireUserId();
  const now = nowIso();
  const { share } = await shareDefaults();
  const plan: MealPlan = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    startDate: input.startDate,
    slots: input.slots ?? [],
    householdId: share.householdId,
    visibility: share.visibility,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.mealPlans.put(plan);
  await queueMutation('meal_plans', 'create', plan);
  return plan;
}

export async function updateMealPlan(
  id: string,
  patch: {
    title?: string;
    startDate?: string;
    slots?: MealSlot[];
  },
): Promise<MealPlan> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.mealPlans.get(id), userId, household, 'Plan');
  if (existing.deletedAt) {
    throw new Error('Plan introuvable');
  }
  const updated: MealPlan = {
    ...existing,
    title: patch.title?.trim() ?? existing.title,
    startDate: patch.startDate ?? existing.startDate,
    slots: patch.slots ?? existing.slots,
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.mealPlans.put(updated);
  await queueMutation('meal_plans', 'update', updated);
  return updated;
}

export function buildMealSlot(input: {
  date: string;
  mealType: MealType;
  recipeId: string;
  servingsOverride?: number | null;
}): MealSlot {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    mealType: input.mealType,
    recipeId: input.recipeId,
    servingsOverride: input.servingsOverride ?? null,
  };
}

export async function softDeleteMealPlan(id: string): Promise<void> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = await db.mealPlans.get(id);
  if (!existing || !canAccessDoc(existing, userId, household)) return;
  const updated: MealPlan = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.mealPlans.put(updated);
  await queueMutation('meal_plans', 'delete', updated);
}

export async function createShoppingList(input: {
  title: string;
  mealPlanId?: string | null;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  notes?: string;
  items?: ShoppingListItem[];
}): Promise<ShoppingList> {
  const userId = await requireUserId();
  const now = nowIso();
  const { household, share } = await shareDefaults();
  const memberIds =
    share.visibility === 'household' && household?.household
      ? [...household.household.memberIds]
      : [userId];
  const list: ShoppingList = {
    _id: crypto.randomUUID(),
    userId,
    title: input.title.trim(),
    mealPlanId: input.mealPlanId ?? null,
    rangeFrom: input.rangeFrom ?? null,
    rangeTo: input.rangeTo ?? null,
    notes: input.notes?.trim() ?? '',
    status: 'open',
    items: (input.items ?? []).map((item) => ({
      ...item,
      note: item.note ?? '',
    })),
    memberIds,
    householdId: share.householdId,
    visibility: share.visibility,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    rev: 1,
  };
  await db.shoppingLists.put(list);
  await queueMutation('shopping_lists', 'create', list);
  return list;
}

export async function updateShoppingList(
  id: string,
  patch: {
    title?: string;
    status?: ShoppingList['status'];
    mealPlanId?: string | null;
    rangeFrom?: string | null;
    rangeTo?: string | null;
    notes?: string;
    items?: ShoppingListItem[];
  },
): Promise<ShoppingList> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(id), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }
  const updated: ShoppingList = {
    ...existing,
    title: patch.title?.trim() ?? existing.title,
    status: patch.status ?? existing.status,
    mealPlanId: patch.mealPlanId !== undefined ? patch.mealPlanId : existing.mealPlanId,
    rangeFrom: patch.rangeFrom !== undefined ? patch.rangeFrom : (existing.rangeFrom ?? null),
    rangeTo: patch.rangeTo !== undefined ? patch.rangeTo : (existing.rangeTo ?? null),
    notes: patch.notes !== undefined ? patch.notes.trim() : (existing.notes ?? ''),
    items: patch.items ?? existing.items,
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.shoppingLists.put(updated);
  await queueMutation('shopping_lists', 'update', updated);
  return updated;
}

export async function toggleShoppingItem(
  listId: string,
  itemId: string,
  checked?: boolean,
): Promise<ShoppingList> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(listId), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }
  const now = nowIso();
  const items = existing.items.map((item) => {
    if (item.id !== itemId) return item;
    const nextChecked = checked ?? !item.checked;
    return {
      ...item,
      checked: nextChecked,
      checkedAt: nextChecked ? now : null,
      updatedAt: now,
      updatedBy: userId,
    };
  });
  return updateShoppingList(listId, { items });
}

export async function addExtraItemToList(
  listId: string,
  item: ShoppingListItem,
): Promise<ShoppingList> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(listId), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }

  // Consolider avec un extra existant même productId+unit
  const keyMatch = (row: ShoppingListItem) =>
    row.origin === 'extra' &&
    row.productId === item.productId &&
    row.productSource === item.productSource &&
    row.unit === item.unit;

  const existingExtra = existing.items.find(keyMatch);
  const stamped: ShoppingListItem = { ...item, updatedBy: userId };
  let items: ShoppingListItem[];
  if (existingExtra) {
    items = existing.items.map((row) =>
      row.id === existingExtra.id
        ? {
            ...row,
            quantity: roundQtyLocal(row.quantity + item.quantity),
            nameSnapshot: item.nameSnapshot,
            category: item.category,
            updatedAt: nowIso(),
            updatedBy: userId,
            checked: false,
            checkedAt: null,
          }
        : row,
    );
  } else {
    items = [...existing.items, stamped];
  }

  return updateShoppingList(listId, { items });
}

function roundQtyLocal(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function removeShoppingItem(listId: string, itemId: string): Promise<ShoppingList> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(listId), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }
  return updateShoppingList(listId, {
    items: existing.items.filter((item) => item.id !== itemId),
  });
}

/** Ajuste la quantité d’une ligne de liste (même flux outbox que les autres updates). */
export async function updateShoppingItemQuantity(
  listId: string,
  itemId: string,
  quantity: number,
): Promise<ShoppingList> {
  return updateShoppingItemFields(listId, itemId, { quantity });
}

/** Ajuste quantité, unité et/ou note d’une ligne de liste. */
export async function updateShoppingItemFields(
  listId: string,
  itemId: string,
  patch: { quantity?: number; unit?: string; note?: string },
): Promise<ShoppingList> {
  if (patch.quantity != null && (!Number.isFinite(patch.quantity) || patch.quantity <= 0)) {
    throw new Error('Quantité invalide');
  }
  if (patch.unit != null && !patch.unit.trim()) {
    throw new Error('Unité invalide');
  }
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(listId), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }
  const now = nowIso();
  const items = existing.items.map((item) => {
    if (item.id !== itemId) return item;
    return {
      ...item,
      quantity: patch.quantity != null ? roundQtyLocal(patch.quantity) : item.quantity,
      unit: patch.unit != null ? patch.unit.trim() : item.unit,
      note: patch.note !== undefined ? patch.note.trim() : (item.note ?? ''),
      updatedAt: now,
      updatedBy: userId,
    };
  });
  return updateShoppingList(listId, { items });
}

/** Réordonne les lignes (ordre du tableau = ordre d’affichage). */
export async function reorderShoppingItems(
  listId: string,
  orderedIds: string[],
): Promise<ShoppingList> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = assertAccessible(await db.shoppingLists.get(listId), userId, household, 'Liste');
  if (existing.deletedAt) {
    throw new Error('Liste introuvable');
  }
  const byId = new Map(existing.items.map((item) => [item.id, item]));
  const next: ShoppingListItem[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (row) {
      next.push(row);
      byId.delete(id);
    }
  }
  for (const row of byId.values()) next.push(row);
  return updateShoppingList(listId, { items: next });
}

export async function softDeleteShoppingList(id: string): Promise<void> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  const existing = await db.shoppingLists.get(id);
  if (!existing || !canAccessDoc(existing, userId, household)) return;
  const updated: ShoppingList = {
    ...existing,
    deletedAt: nowIso(),
    updatedAt: nowIso(),
    rev: existing.rev + 1,
  };
  await db.shoppingLists.put(updated);
  await queueMutation('shopping_lists', 'delete', updated);
}

/** Change Perso ↔ Foyer sur une entité syncable. Cascade produits user pour les recettes. */
export async function setEntityVisibility(
  entity: 'recipes' | 'meal_plans' | 'shopping_lists' | 'products',
  id: string,
  visibility: Visibility,
): Promise<void> {
  const userId = await requireUserId();
  const household = await getCachedHousehold();
  if (visibility === 'household' && !household?.household) {
    throw new Error('Rejoins un foyer pour partager');
  }

  const householdId = visibility === 'household' ? household!.household._id : null;
  const now = nowIso();

  if (entity === 'recipes') {
    const existing = assertAccessible(await db.recipes.get(id), userId, household, 'Recette');
    const updated: Recipe = {
      ...existing,
      visibility,
      householdId,
      updatedAt: now,
      rev: existing.rev + 1,
    };
    await db.recipes.put(updated);
    await queueMutation('recipes', 'update', updated);

    // Cascade : produits user référencés deviennent household pour le pull des membres
    if (visibility === 'household') {
      for (const ing of existing.ingredients) {
        if (ing.productSource !== 'user') continue;
        const product = await db.products.get(ing.productId);
        if (!product || product.deletedAt || !canAccessDoc(product, userId, household)) continue;
        if (product.visibility === 'household' && product.householdId === householdId) continue;
        const nextProduct: Product = {
          ...product,
          visibility: 'household',
          householdId,
          updatedAt: now,
          rev: product.rev + 1,
        };
        await db.products.put(nextProduct);
        await queueMutation('products', 'update', nextProduct);
      }
    }
    return;
  }

  if (entity === 'meal_plans') {
    const existing = assertAccessible(await db.mealPlans.get(id), userId, household, 'Plan');
    const updated: MealPlan = {
      ...existing,
      visibility,
      householdId,
      updatedAt: now,
      rev: existing.rev + 1,
    };
    await db.mealPlans.put(updated);
    await queueMutation('meal_plans', 'update', updated);
    return;
  }

  if (entity === 'shopping_lists') {
    const existing = assertAccessible(await db.shoppingLists.get(id), userId, household, 'Liste');
    const memberIds =
      visibility === 'household' && household?.household
        ? [...household.household.memberIds]
        : [existing.userId];
    const updated: ShoppingList = {
      ...existing,
      visibility,
      householdId,
      memberIds,
      updatedAt: now,
      rev: existing.rev + 1,
    };
    await db.shoppingLists.put(updated);
    await queueMutation('shopping_lists', 'update', updated);

    if (visibility === 'household') {
      for (const item of existing.items) {
        if (item.productSource !== 'user') continue;
        const product = await db.products.get(item.productId);
        if (!product || product.deletedAt || !canAccessDoc(product, userId, household)) continue;
        if (product.visibility === 'household' && product.householdId === householdId) continue;
        const nextProduct: Product = {
          ...product,
          visibility: 'household',
          householdId,
          updatedAt: now,
          rev: product.rev + 1,
        };
        await db.products.put(nextProduct);
        await queueMutation('products', 'update', nextProduct);
      }
    }
    return;
  }

  const existing = assertAccessible(await db.products.get(id), userId, household, 'Produit');
  const updated: Product = {
    ...existing,
    visibility,
    householdId,
    updatedAt: now,
    rev: existing.rev + 1,
  };
  await db.products.put(updated);
  await queueMutation('products', 'update', updated);
}
