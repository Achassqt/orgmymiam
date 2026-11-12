export const PRODUCT_CATEGORIES = [
  'fruits_legumes',
  'viandes_poissons',
  'produits_laitiers',
  'epicerie',
  'boulangerie',
  'boissons',
  'surgeles',
  'entretien',
  'hygiene',
  'autres',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const MEAL_TYPES = [
  'petit_dejeuner',
  'dejeuner',
  'diner',
  'collation',
  'en_cas',
] as const;

export type MealType = (typeof MEAL_TYPES)[number];

export const PRODUCT_SOURCES = ['catalog', 'user'] as const;

export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const SHOPPING_LIST_STATUSES = ['open', 'closed'] as const;

export type ShoppingListStatus = (typeof SHOPPING_LIST_STATUSES)[number];

export const ITEM_ORIGINS = ['meal', 'extra'] as const;

export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

export const COMMON_UNITS = ['g', 'kg', 'ml', 'L', 'unité', 'botte', 'boîte', 'paquet'] as const;

export type CommonUnit = (typeof COMMON_UNITS)[number];
