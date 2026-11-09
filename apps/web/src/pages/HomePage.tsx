import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useSyncStatus } from '../hooks/useSyncStatus';

export function HomePage() {
  const { online, outboxCount, lastSyncAt } = useSyncStatus();
  const catalogCount = useLiveQuery(() => db.catalogProducts.count(), []) ?? 0;
  const productCount =
    useLiveQuery(() => db.products.filter((p) => p.deletedAt == null).count(), []) ?? 0;
  const recipeCount =
    useLiveQuery(() => db.recipes.filter((r) => r.deletedAt == null).count(), []) ?? 0;

  return (
    <section className="page-section">
      <h1>Accueil</h1>
      <p className="lede">
        Offline-first prêt : les écritures passent par Dexie + outbox, la sync tourne en
        arrière-plan.
      </p>

      <ul className="stat-list">
        <li>
          Réseau : <strong>{online ? 'en ligne' : 'hors ligne'}</strong>
        </li>
        <li>
          Outbox : <strong>{outboxCount}</strong>
        </li>
        <li>
          Catalogue local : <strong>{catalogCount}</strong>
        </li>
        <li>
          Produits / recettes :{' '}
          <strong>
            {productCount} / {recipeCount}
          </strong>
        </li>
        <li>
          Dernière sync : <strong>{lastSyncAt ? new Date(lastSyncAt).toLocaleString('fr-FR') : 'jamais'}</strong>
        </li>
      </ul>

      <div className="quick-links">
        <Link to="/produits">Produits</Link>
        <Link to="/recettes">Recettes</Link>
        <Link to="/plans">Plans</Link>
        <Link to="/liste">Liste de courses</Link>
      </div>
    </section>
  );
}
