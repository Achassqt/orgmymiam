import type {
  ItemOrigin,
  MealType,
  ProductCategory,
  ProductSource,
  ShoppingListStatus,
} from './categories.js';

/** Timestamps ISO 8601 */
export type IsoDateTime = string;
export type IsoDate = string;

export interface SyncMeta {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
  rev: number;
}

export interface UserOwned {
  _id: string;
  userId: string;
}

export interface User {
  _id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface PublicUser {
  _id: string;
  email: string;
  displayName: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CatalogProduct {
  _id: string;
  name: string;
  nameNormalized: string;
  category: ProductCategory;
  defaultUnit: string;
  catalogVersion: number;
}

export interface Product extends UserOwned, SyncMeta {
  name: string;
  nameNormalized: string;
  category: ProductCategory;
  defaultUnit: string;
  sourceCatalogId: string | null;
}

export interface RecipeIngredient {
  productId: string;
  productSource: ProductSource;
  quantity: number;
  unit: string;
}

export interface Recipe extends UserOwned, SyncMeta {
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
  notes: string;
}

export interface MealSlot {
  id: string;
  date: IsoDate;
  mealType: MealType;
  recipeId: string;
  servingsOverride: number | null;
}

export interface MealPlan extends UserOwned, SyncMeta {
  title: string;
  startDate: IsoDate;
  slots: MealSlot[];
}

export interface ShoppingListItem {
  id: string;
  productId: string;
  productSource: ProductSource;
  nameSnapshot: string;
  quantity: number;
  unit: string;
  category: ProductCategory;
  origin: ItemOrigin;
  checked: boolean;
  checkedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  /** Réservé multi-user (MVP : propriétaire) */
  updatedBy?: string;
}

export interface ShoppingList extends UserOwned, SyncMeta {
  title: string;
  mealPlanId: string | null;
  status: ShoppingListStatus;
  items: ShoppingListItem[];
  /** Réservé partage futur — MVP : [userId] */
  memberIds: string[];
}

export interface SyncCursor {
  _id: string;
  userId: string;
  deviceId: string;
  lastPulledAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type SyncEntityName = 'products' | 'recipes' | 'meal_plans' | 'shopping_lists';

export type SyncEntity = Product | Recipe | MealPlan | ShoppingList;

export interface SyncPushMutation {
  entity: SyncEntityName;
  op: 'create' | 'update' | 'delete';
  payload: SyncEntity;
}

export interface SyncPushAccepted {
  entity: SyncEntityName;
  id: string;
  status: 'accepted';
  document: SyncEntity;
}

export interface SyncPushRejected {
  entity: SyncEntityName;
  id: string;
  status: 'rejected';
  reason: 'stale' | 'invalid' | 'forbidden';
  serverDocument?: SyncEntity;
  message?: string;
}

export type SyncPushResult = SyncPushAccepted | SyncPushRejected;

export interface SyncPushResponse {
  results: SyncPushResult[];
  serverTime: IsoDateTime;
}

export interface SyncPullResponse {
  products: Product[];
  recipes: Recipe[];
  mealPlans: MealPlan[];
  shoppingLists: ShoppingList[];
  serverTime: IsoDateTime;
  cursor: IsoDateTime;
}

export interface CatalogResponse {
  products: CatalogProduct[];
  catalogVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: AuthTokens;
}
