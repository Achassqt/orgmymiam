import { normalizeProductName } from '@orgmymiam/shared';

/**
 * Stub web — Étape 2 livrera la PWA Dexie complète.
 * Ce placeholder vérifie que le monorepo et @orgmymiam/shared sont branchés.
 */
export function App() {
  const sample = normalizeProductName('Lait demi-écrémé');

  return (
    <main className="page">
      <p className="eyebrow">OrgMyMiam</p>
      <h1>Planification de repas, bientôt offline-first</h1>
      <p className="lede">
        Scaffold web minimal (Étape 0–1). La PWA Dexie arrive à l’Étape 2. Exemple de
        normalisation partagée : <code>{sample}</code>
      </p>
    </main>
  );
}
