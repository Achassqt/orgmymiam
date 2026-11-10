import { normalizeProductName, type Product } from '@orgmymiam/shared';
import { enqueueOutbox } from '../sync/engine';
import { db, getMeta, META_KEYS, setMeta, type OutboxEntry } from './database';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Re-calcule `nameNormalized` depuis `name` (correctif ligatures œ→oe).
 * - Catalogue local : rewrite silencieux (sera aussi remplacé au sync v2).
 * - Produits user : rewrite + outbox update si la valeur change (pousse Mongo).
 *
 * Idempotent via META_KEYS.nameNormalizeLigaturesV2.
 */
export async function migrateNameNormalizedLigatures(): Promise<{
  catalogFixed: number;
  productsFixed: number;
}> {
  const done = await getMeta<boolean>(META_KEYS.nameNormalizeLigaturesV2);
  if (done) {
    return { catalogFixed: 0, productsFixed: 0 };
  }

  let catalogFixed = 0;
  let productsFixed = 0;
  const productUpdates: Product[] = [];

  await db.transaction('rw', [db.catalogProducts, db.products, db.meta], async () => {
    const catalog = await db.catalogProducts.toArray();
    for (const row of catalog) {
      const next = normalizeProductName(row.name);
      if (next && next !== row.nameNormalized) {
        await db.catalogProducts.put({ ...row, nameNormalized: next });
        catalogFixed += 1;
      }
    }

    const products = await db.products.toArray();
    for (const row of products) {
      const next = normalizeProductName(row.name);
      if (!next || next === row.nameNormalized) continue;
      const updated: Product = {
        ...row,
        nameNormalized: next,
        updatedAt: nowIso(),
        rev: row.rev + 1,
      };
      await db.products.put(updated);
      productUpdates.push(updated);
      productsFixed += 1;
    }

    await setMeta(META_KEYS.nameNormalizeLigaturesV2, true);
  });

  for (const product of productUpdates) {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      entity: 'products',
      entityId: product._id,
      op: 'update',
      payload: product,
      createdAt: nowIso(),
      attempts: 0,
    };
    // syncNow: false - le caller (boot / auth) déclenche runSync ensuite
    await enqueueOutbox(entry, { syncNow: false });
  }

  return { catalogFixed, productsFixed };
}
