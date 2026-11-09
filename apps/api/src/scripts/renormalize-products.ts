/**
 * Re-calcule nameNormalized pour tous les produits user Mongo
 * (correctif ligatures œ→oe après mise à jour de normalizeProductName).
 *
 * Usage : npx tsx src/scripts/renormalize-products.ts
 */
import { normalizeProductName } from '@orgmymiam/shared';
import { closeMongo, connectMongo } from '../db/mongo.js';

async function main(): Promise<void> {
  const { collections } = await connectMongo();
  const cursor = collections.products.find({});
  let scanned = 0;
  let updated = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const next = normalizeProductName(doc.name);
    if (!next || next === doc.nameNormalized) continue;
    const now = new Date().toISOString();
    await collections.products.updateOne(
      { _id: doc._id },
      {
        $set: {
          nameNormalized: next,
          updatedAt: now,
          rev: (doc.rev ?? 0) + 1,
        },
      },
    );
    updated += 1;
    console.log(`  ${doc.name}: "${doc.nameNormalized}" → "${next}"`);
  }

  console.log(`Produits scannés : ${scanned}, mis à jour : ${updated}`);
  await closeMongo();
}

main().catch(async (err) => {
  console.error(err);
  await closeMongo().catch(() => undefined);
  process.exit(1);
});
