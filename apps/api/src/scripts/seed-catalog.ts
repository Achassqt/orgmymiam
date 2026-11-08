import { normalizeProductName } from '@orgmymiam/shared';
import type { CatalogProduct } from '@orgmymiam/shared';
import { env } from '../config/env.js';
import { CATALOG_SEED } from '../data/catalog-seed.js';
import { closeMongo, connectMongo } from '../db/mongo.js';
import { newId } from '../utils/crypto.js';

async function main(): Promise<void> {
  const { collections } = await connectMongo();
  const version = env.CATALOG_VERSION;

  const docs: CatalogProduct[] = CATALOG_SEED.map((item) => ({
    _id: newId(),
    name: item.name,
    nameNormalized: normalizeProductName(item.name),
    category: item.category,
    defaultUnit: item.defaultUnit,
    catalogVersion: version,
  }));

  await collections.catalogProducts.deleteMany({ catalogVersion: version });
  if (docs.length > 0) {
    await collections.catalogProducts.insertMany(docs);
  }

  const count = await collections.catalogProducts.countDocuments({ catalogVersion: version });
  console.log(`Catalogue seedé : ${count} produits (version ${version})`);
  await closeMongo();
}

main().catch(async (err) => {
  console.error(err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
