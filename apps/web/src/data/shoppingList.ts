import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductSource,
  type ShoppingList,
  type ShoppingListItem,
} from '@orgmymiam/shared';
import { db, getSessionUserId } from '../db/database';
import { shoppingListTitleFromRange } from '../lib/shoppingListShare';
import {
  createShoppingList,
  updateShoppingList,
} from './crud';
import { getCachedHousehold } from './household';
import type { ProductHit } from './productSearch';
import { categoryLabel } from './productSearch';

export { shoppingListTitleFromRange };

function canSee(
  row: { userId: string; visibility?: string; householdId?: string | null },
  userId: string | null,
  householdId: string | null,
): boolean {
  if (!userId) return true;
  if (row.userId === userId) return true;
  return row.visibility === 'household' && !!householdId && row.householdId === householdId;
}

export interface ProductMeta {
  name: string;
  category: ProductCategory;
  defaultUnit: string;
}

export async function lookupProductMeta(
  productId: string,
  source: ProductSource,
): Promise<ProductMeta> {
  if (source === 'catalog') {
    const item = await db.catalogProducts.get(productId);
    if (item) {
      return { name: item.name, category: item.category, defaultUnit: item.defaultUnit };
    }
  } else {
    const userId = await getSessionUserId();
    const household = await getCachedHousehold();
    const householdId = household?.household._id ?? null;
    const item = await db.products.get(productId);
    if (item && canSee(item, userId, householdId)) {
      return { name: item.name, category: item.category, defaultUnit: item.defaultUnit };
    }
  }
  return { name: 'Produit', category: 'autres', defaultUnit: 'unité' };
}

function itemKey(productId: string, productSource: ProductSource, unit: string): string {
  return `${productSource}:${productId}::${unit}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

type SlotRef = {
  recipeId: string;
  servingsOverride: number | null;
  planId: string;
};

/** Slots de tous les plannings visibles dans [from, to] (inclus). */
export async function collectSlotsInRange(
  rangeFrom: string,
  rangeTo: string,
): Promise<SlotRef[]> {
  const userId = await getSessionUserId();
  const household = await getCachedHousehold();
  const householdId = household?.household._id ?? null;
  const plans = await db.mealPlans.filter((p) => p.deletedAt == null).toArray();
  const slots: SlotRef[] = [];

  for (const plan of plans) {
    if (!canSee(plan, userId, householdId)) continue;
    for (const slot of plan.slots) {
      if (slot.date < rangeFrom || slot.date > rangeTo) continue;
      slots.push({
        recipeId: slot.recipeId,
        servingsOverride: slot.servingsOverride,
        planId: plan._id,
      });
    }
  }

  return slots;
}

async function buildMealItemsFromSlots(slots: SlotRef[]): Promise<ShoppingListItem[]> {
  const userId = await getSessionUserId();
  const household = await getCachedHousehold();
  const householdId = household?.household._id ?? null;

  const consolidated = new Map<
    string,
    {
      productId: string;
      productSource: ProductSource;
      unit: string;
      quantity: number;
      nameSnapshot: string;
      category: ProductCategory;
    }
  >();

  for (const slot of slots) {
    const recipe = await db.recipes.get(slot.recipeId);
    if (!recipe || recipe.deletedAt || !canSee(recipe, userId, householdId)) continue;

    const baseServings = recipe.servings > 0 ? recipe.servings : 1;
    const targetServings = slot.servingsOverride ?? recipe.servings;
    const factor = targetServings / baseServings;

    for (const ing of recipe.ingredients) {
      const meta = await lookupProductMeta(ing.productId, ing.productSource);
      const unit = ing.unit;
      const key = itemKey(ing.productId, ing.productSource, unit);
      const qty = ing.quantity * factor;
      const existing = consolidated.get(key);
      if (existing) {
        existing.quantity += qty;
      } else {
        consolidated.set(key, {
          productId: ing.productId,
          productSource: ing.productSource,
          unit,
          quantity: qty,
          nameSnapshot: meta.name,
          category: meta.category,
        });
      }
    }
  }

  const stamp = nowIso();
  return [...consolidated.values()].map((row) => ({
    id: crypto.randomUUID(),
    productId: row.productId,
    productSource: row.productSource,
    nameSnapshot: row.nameSnapshot,
    quantity: roundQty(row.quantity),
    unit: row.unit,
    category: row.category,
    origin: 'meal' as const,
    checked: false,
    checkedAt: null,
    updatedAt: stamp,
    note: '',
  }));
}

/** Construit les lignes consolidées (origin meal) depuis un meal plan. */
export async function buildMealItemsFromPlan(mealPlanId: string): Promise<ShoppingListItem[]> {
  const userId = await getSessionUserId();
  const household = await getCachedHousehold();
  const householdId = household?.household._id ?? null;
  const plan = await db.mealPlans.get(mealPlanId);
  if (!plan || plan.deletedAt || !canSee(plan, userId, householdId)) {
    throw new Error('Plan de repas introuvable');
  }

  return buildMealItemsFromSlots(
    plan.slots.map((slot) => ({
      recipeId: slot.recipeId,
      servingsOverride: slot.servingsOverride,
      planId: plan._id,
    })),
  );
}

export async function buildMealItemsFromDateRange(
  rangeFrom: string,
  rangeTo: string,
): Promise<{ items: ShoppingListItem[]; mealPlanId: string | null; mealCount: number }> {
  if (rangeFrom > rangeTo) {
    throw new Error('La date de début doit précéder la date de fin');
  }
  const slots = await collectSlotsInRange(rangeFrom, rangeTo);
  const items = await buildMealItemsFromSlots(slots);
  const planIds = [...new Set(slots.map((s) => s.planId))];
  return {
    items,
    mealPlanId: planIds.length === 1 ? planIds[0]! : null,
    mealCount: slots.length,
  };
}

export async function generateShoppingListFromDateRange(input: {
  rangeFrom: string;
  rangeTo: string;
  notes?: string;
}): Promise<ShoppingList> {
  const { items, mealPlanId, mealCount } = await buildMealItemsFromDateRange(
    input.rangeFrom,
    input.rangeTo,
  );
  if (mealCount === 0) {
    throw new Error('Aucun repas sur cette plage de dates');
  }

  return createShoppingList({
    title: shoppingListTitleFromRange(input.rangeFrom, input.rangeTo),
    mealPlanId,
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo,
    notes: input.notes,
    items,
  });
}

/** @deprecated Préférer generateShoppingListFromDateRange. */
export async function generateShoppingListFromMealPlan(input: {
  mealPlanId: string;
  title?: string;
}): Promise<ShoppingList> {
  const userId = await getSessionUserId();
  const plan = await db.mealPlans.get(input.mealPlanId);
  if (!plan || plan.deletedAt || (userId && plan.userId !== userId)) {
    throw new Error('Plan de repas introuvable');
  }

  const items = await buildMealItemsFromPlan(input.mealPlanId);
  const dates = plan.slots.map((s) => s.date).sort();
  const rangeFrom = dates[0] ?? plan.startDate;
  const rangeTo = dates[dates.length - 1] ?? plan.startDate;
  const title = input.title?.trim() || shoppingListTitleFromRange(rangeFrom, rangeTo);

  return createShoppingList({
    title,
    mealPlanId: input.mealPlanId,
    rangeFrom,
    rangeTo,
    items,
  });
}

/** Régénère les lignes meal en conservant les extras (et le cochage extras). */
export async function regenerateMealItems(listId: string): Promise<ShoppingList> {
  const userId = await getSessionUserId();
  const list = await db.shoppingLists.get(listId);
  if (!list || list.deletedAt || (userId && list.userId !== userId)) {
    throw new Error('Liste introuvable');
  }

  let mealItems: ShoppingListItem[];
  if (list.rangeFrom && list.rangeTo) {
    const built = await buildMealItemsFromDateRange(list.rangeFrom, list.rangeTo);
    mealItems = built.items;
  } else if (list.mealPlanId) {
    mealItems = await buildMealItemsFromPlan(list.mealPlanId);
  } else {
    throw new Error('Cette liste n’est pas liée à un planning');
  }

  const extras = list.items.filter((item) => item.origin === 'extra');

  // Conserva le cochage / note meal si même productId+unit
  const prevMeal = new Map(
    list.items
      .filter((i) => i.origin === 'meal')
      .map((i) => [itemKey(i.productId, i.productSource, i.unit), i]),
  );

  const mergedMeal = mealItems.map((item) => {
    const prev = prevMeal.get(itemKey(item.productId, item.productSource, item.unit));
    if (!prev) return item;
    return {
      ...item,
      note: prev.note ?? '',
      checked: prev.checked,
      checkedAt: prev.checked ? prev.checkedAt : null,
      updatedAt: nowIso(),
    };
  });

  return updateShoppingList(listId, {
    items: [...mergedMeal, ...extras],
  });
}

export function groupItemsByCategory(items: ShoppingListItem[]): Array<{
  category: ProductCategory;
  label: string;
  items: ShoppingListItem[];
}> {
  const byCat = new Map<ProductCategory, ShoppingListItem[]>();
  for (const item of items) {
    const bucket = byCat.get(item.category) ?? [];
    bucket.push(item);
    byCat.set(item.category, bucket);
  }

  return PRODUCT_CATEGORIES.filter((cat) => byCat.has(cat)).map((category) => ({
    category,
    label: categoryLabel(category),
    items: (byCat.get(category) ?? []).sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return a.nameSnapshot.localeCompare(b.nameSnapshot, 'fr');
    }),
  }));
}

/** Ordre d’affichage = ordre manuel du tableau (réordonnancement). */
export function orderedShoppingItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return items;
}

export async function buildExtraItemFromHit(
  hit: ProductHit,
  quantity: number,
  unit?: string,
  note = '',
): Promise<ShoppingListItem> {
  const qty = quantity > 0 ? quantity : 1;
  const productId = hit.source === 'catalog' ? hit.catalogId : hit.userProductId;
  if (!productId) {
    throw new Error('Produit invalide');
  }
  const stamp = nowIso();
  return {
    id: crypto.randomUUID(),
    productId,
    productSource: hit.source,
    nameSnapshot: hit.name,
    quantity: qty,
    unit: unit?.trim() || hit.defaultUnit,
    category: hit.category,
    origin: 'extra',
    checked: false,
    checkedAt: null,
    updatedAt: stamp,
    note: note.trim(),
  };
}
