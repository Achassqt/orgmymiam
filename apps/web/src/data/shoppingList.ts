import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
  type ProductSource,
  type ShoppingList,
  type ShoppingListItem,
} from '@orgmymiam/shared';
import { db, getSessionUserId } from '../db/database';
import {
  createShoppingList,
  updateShoppingList,
} from './crud';
import type { ProductHit } from './productSearch';
import { categoryLabel } from './productSearch';

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
    const item = await db.products.get(productId);
    if (item && (!userId || item.userId === userId)) {
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

/** Construit les lignes consolidées (origin meal) depuis un meal plan. */
export async function buildMealItemsFromPlan(mealPlanId: string): Promise<ShoppingListItem[]> {
  const userId = await getSessionUserId();
  const plan = await db.mealPlans.get(mealPlanId);
  if (!plan || plan.deletedAt || (userId && plan.userId !== userId)) {
    throw new Error('Plan de repas introuvable');
  }

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

  for (const slot of plan.slots) {
    const recipe = await db.recipes.get(slot.recipeId);
    if (!recipe || recipe.deletedAt || (userId && recipe.userId !== userId)) continue;

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
  }));
}

function roundQty(value: number): number {
  // évite 399.999999 ; garde des décimales utiles
  return Math.round(value * 1000) / 1000;
}

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
  const title = input.title?.trim() || `Courses — ${plan.title}`;

  const list = await createShoppingList({
    title,
    mealPlanId: input.mealPlanId,
    items,
  });
  return list;
}

/** Régénère les lignes meal en conservant les extras (et le cochage extras). */
export async function regenerateMealItems(listId: string): Promise<ShoppingList> {
  const userId = await getSessionUserId();
  const list = await db.shoppingLists.get(listId);
  if (!list || list.deletedAt || (userId && list.userId !== userId)) {
    throw new Error('Liste introuvable');
  }
  if (!list.mealPlanId) {
    throw new Error('Cette liste n’est pas liée à un plan');
  }

  const extras = list.items.filter((item) => item.origin === 'extra');
  const mealItems = await buildMealItemsFromPlan(list.mealPlanId);

  // Conserva le cochage meal si même productId+unit
  const prevMeal = new Map(
    list.items
      .filter((i) => i.origin === 'meal')
      .map((i) => [itemKey(i.productId, i.productSource, i.unit), i]),
  );

  const mergedMeal = mealItems.map((item) => {
    const prev = prevMeal.get(itemKey(item.productId, item.productSource, item.unit));
    if (prev?.checked) {
      return {
        ...item,
        checked: true,
        checkedAt: prev.checkedAt,
        updatedAt: nowIso(),
      };
    }
    return item;
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

export async function buildExtraItemFromHit(
  hit: ProductHit,
  quantity: number,
  unit?: string,
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
  };
}
