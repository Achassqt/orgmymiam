import {
  normalizeProductName,
  type CatalogProduct,
  type Product,
  type ProductCategory,
  type ProductSource,
} from '@orgmymiam/shared';
import { db } from '../db/database';

export interface ProductHit {
  id: string;
  name: string;
  nameNormalized: string;
  category: ProductCategory;
  defaultUnit: string;
  source: ProductSource;
  /** Présent seulement pour les produits user */
  userProductId?: string;
  catalogId?: string;
}

export interface ProductSearchResult {
  query: string;
  normalizedQuery: string;
  hits: ProductHit[];
  exactMatch: ProductHit | null;
  canCreate: boolean;
}

function scoreHit(normalizedQuery: string, nameNormalized: string): number {
  if (!normalizedQuery) return 0;
  if (nameNormalized === normalizedQuery) return 300;
  if (nameNormalized.startsWith(normalizedQuery)) return 200;
  if (nameNormalized.includes(` ${normalizedQuery}`)) return 150;
  if (nameNormalized.includes(normalizedQuery)) return 100;
  return 0;
}

function toCatalogHit(item: CatalogProduct): ProductHit {
  return {
    id: `catalog:${item._id}`,
    name: item.name,
    nameNormalized: item.nameNormalized,
    category: item.category,
    defaultUnit: item.defaultUnit,
    source: 'catalog',
    catalogId: item._id,
  };
}

function toUserHit(item: Product): ProductHit {
  return {
    id: `user:${item._id}`,
    name: item.name,
    nameNormalized: item.nameNormalized,
    category: item.category,
    defaultUnit: item.defaultUnit,
    source: 'user',
    userProductId: item._id,
    catalogId: item.sourceCatalogId ?? undefined,
  };
}

/** Fusionne catalogue + produits user (non deleted), dédupliqués par nameNormalized (user prioritaire). */
export async function loadProductUniverse(): Promise<ProductHit[]> {
  const [catalog, products] = await Promise.all([
    db.catalogProducts.toArray(),
    db.products.filter((p) => p.deletedAt == null).toArray(),
  ]);

  const byNormalized = new Map<string, ProductHit>();

  for (const item of catalog) {
    byNormalized.set(item.nameNormalized, toCatalogHit(item));
  }

  // Les produits user écrasent le catalogue pour le même nom normalisé
  for (const item of products) {
    byNormalized.set(item.nameNormalized, toUserHit(item));
  }

  return [...byNormalized.values()].sort((a, b) => a.nameNormalized.localeCompare(b.nameNormalized));
}

export function searchProductHits(
  universe: ProductHit[],
  rawQuery: string,
  limit = 12,
): ProductSearchResult {
  const query = rawQuery.trim();
  const normalizedQuery = normalizeProductName(query);

  if (!normalizedQuery) {
    return {
      query,
      normalizedQuery,
      hits: [],
      exactMatch: null,
      canCreate: false,
    };
  }

  const ranked = universe
    .map((hit) => ({ hit, score: scoreHit(normalizedQuery, hit.nameNormalized) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name, 'fr'));

  const hits = ranked.slice(0, limit).map((row) => row.hit);
  const exactMatch = ranked.find((row) => row.hit.nameNormalized === normalizedQuery)?.hit ?? null;

  return {
    query,
    normalizedQuery,
    hits,
    exactMatch,
    canCreate: !exactMatch,
  };
}

export async function findExactProductMatch(rawName: string): Promise<ProductHit | null> {
  const normalized = normalizeProductName(rawName);
  if (!normalized) return null;

  const user = await db.products
    .filter((p) => p.deletedAt == null && p.nameNormalized === normalized)
    .first();
  if (user) return toUserHit(user);

  const catalog = await db.catalogProducts.where('nameNormalized').equals(normalized).first();
  if (catalog) return toCatalogHit(catalog);

  return null;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  fruits_legumes: 'Fruits & légumes',
  viandes_poissons: 'Viandes & poissons',
  produits_laitiers: 'Produits laitiers',
  epicerie: 'Épicerie',
  boulangerie: 'Boulangerie',
  boissons: 'Boissons',
  surgeles: 'Surgelés',
  entretien: 'Entretien',
  hygiene: 'Hygiène',
  autres: 'Autres',
};

export function categoryLabel(category: ProductCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export async function lookupProductLabel(
  productId: string,
  source: ProductSource,
): Promise<string> {
  if (source === 'catalog') {
    const item = await db.catalogProducts.get(productId);
    return item?.name ?? 'Produit catalogue';
  }
  const item = await db.products.get(productId);
  return item?.name ?? 'Produit perso';
}

export const MEAL_TYPE_LABELS: Record<string, string> = {
  petit_dejeuner: 'Petit-déj',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
};
