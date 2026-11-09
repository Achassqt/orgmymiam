import { z } from 'zod';
import {
  ITEM_ORIGINS,
  MEAL_TYPES,
  PRODUCT_CATEGORIES,
  PRODUCT_SOURCES,
  SHOPPING_LIST_STATUSES,
} from './categories.js';

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true }).or(z.string().datetime());
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const productCategorySchema = z.enum(PRODUCT_CATEGORIES);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const productSourceSchema = z.enum(PRODUCT_SOURCES);
export const shoppingListStatusSchema = z.enum(SHOPPING_LIST_STATUSES);
export const itemOriginSchema = z.enum(ITEM_ORIGINS);
export const visibilitySchema = z.enum(['private', 'household']);

export const syncMetaSchema = z.object({
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  rev: z.number().int().positive(),
});

/** Champs foyer — défauts pour docs existants / clients anciens. */
export const householdShareSchema = z.object({
  householdId: uuidSchema.nullable().default(null),
  visibility: visibilitySchema.default('private'),
});

export const householdSchema = z.object({
  _id: uuidSchema,
  name: z.string().min(1).max(80),
  inviteCode: z.string().regex(/^[A-Z0-9]{6}$/),
  ownerId: uuidSchema,
  memberIds: z.array(uuidSchema).min(1).max(8),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(80),
});

export const joinHouseholdSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Code invalide'),
});

export const catalogProductSchema = z.object({
  _id: uuidSchema,
  name: z.string().min(1).max(200),
  nameNormalized: z.string().min(1).max(200),
  category: productCategorySchema,
  defaultUnit: z.string().min(1).max(40),
  catalogVersion: z.number().int().positive(),
});

export const productSchema = z
  .object({
    _id: uuidSchema,
    userId: uuidSchema,
    name: z.string().min(1).max(200),
    nameNormalized: z.string().min(1).max(200),
    category: productCategorySchema,
    defaultUnit: z.string().min(1).max(40),
    sourceCatalogId: uuidSchema.nullable(),
  })
  .merge(syncMetaSchema)
  .merge(householdShareSchema);

export const recipeIngredientSchema = z.object({
  productId: uuidSchema,
  productSource: productSourceSchema,
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
});

export const recipeSchema = z
  .object({
    _id: uuidSchema,
    userId: uuidSchema,
    title: z.string().min(1).max(200),
    servings: z.number().positive(),
    ingredients: z.array(recipeIngredientSchema),
    notes: z.string().max(5000).default(''),
  })
  .merge(syncMetaSchema)
  .merge(householdShareSchema);

export const mealSlotSchema = z.object({
  id: uuidSchema,
  date: isoDateSchema,
  mealType: mealTypeSchema,
  recipeId: uuidSchema,
  servingsOverride: z.number().positive().nullable(),
});

export const mealPlanSchema = z
  .object({
    _id: uuidSchema,
    userId: uuidSchema,
    title: z.string().min(1).max(200),
    startDate: isoDateSchema,
    slots: z.array(mealSlotSchema),
  })
  .merge(syncMetaSchema)
  .merge(householdShareSchema);

export const shoppingListItemSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  productSource: productSourceSchema,
  nameSnapshot: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(40),
  category: productCategorySchema,
  origin: itemOriginSchema,
  checked: z.boolean(),
  checkedAt: isoDateTimeSchema.nullable(),
  updatedAt: isoDateTimeSchema,
  updatedBy: uuidSchema.optional(),
});

export const shoppingListSchema = z
  .object({
    _id: uuidSchema,
    userId: uuidSchema,
    title: z.string().min(1).max(200),
    mealPlanId: uuidSchema.nullable(),
    status: shoppingListStatusSchema,
    items: z.array(shoppingListItemSchema),
    memberIds: z.array(uuidSchema).min(1).max(8),
  })
  .merge(syncMetaSchema)
  .merge(householdShareSchema);

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const syncEntityNameSchema = z.enum([
  'products',
  'recipes',
  'meal_plans',
  'shopping_lists',
]);

export const syncPushMutationSchema = z.discriminatedUnion('entity', [
  z.object({
    entity: z.literal('products'),
    op: z.enum(['create', 'update', 'delete']),
    payload: productSchema,
  }),
  z.object({
    entity: z.literal('recipes'),
    op: z.enum(['create', 'update', 'delete']),
    payload: recipeSchema,
  }),
  z.object({
    entity: z.literal('meal_plans'),
    op: z.enum(['create', 'update', 'delete']),
    payload: mealPlanSchema,
  }),
  z.object({
    entity: z.literal('shopping_lists'),
    op: z.enum(['create', 'update', 'delete']),
    payload: shoppingListSchema,
  }),
]);

export const syncPushBodySchema = z.object({
  deviceId: uuidSchema,
  mutations: z.array(syncPushMutationSchema).max(500),
});

export const syncPullQuerySchema = z.object({
  since: isoDateTimeSchema.optional().default('1970-01-01T00:00:00.000Z'),
  deviceId: uuidSchema,
});

export const catalogQuerySchema = z.object({
  sinceVersion: z.coerce.number().int().nonnegative().optional().default(0),
});
