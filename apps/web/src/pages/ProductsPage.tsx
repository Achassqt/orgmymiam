import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ProductSearchBox } from '../components/ProductSearchBox';
import { adoptCatalogProduct, createProduct, softDeleteProduct } from '../data/crud';
import {
  categoryLabel,
  loadProductUniverse,
  type ProductHit,
} from '../data/productSearch';
import { db } from '../db/database';

export function ProductsPage() {
  const products =
    useLiveQuery(
      () =>
        db.products
          .filter((p) => p.deletedAt == null)
          .reverse()
          .sortBy('updatedAt'),
      [],
    ) ?? [];
  const universe = useLiveQuery(() => loadProductUniverse(), []) ?? [];
  const catalogCount = useLiveQuery(() => db.catalogProducts.count(), []) ?? 0;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const filteredMine = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.nameNormalized.includes(q),
    );
  }, [products, filter]);

  async function handleCreate(name: string) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await createProduct({ name });
      if (result.status === 'reused_user') {
        setFeedback(`Réutilisé (déjà présent) : « ${result.product.name} ».`);
      } else if (result.status === 'reused_catalog') {
        setFeedback(`Issu du catalogue, ajouté à tes produits : « ${result.product.name} ».`);
      } else {
        setFeedback(`Créé hors-ligne : « ${result.product.name} ».`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSelect(hit: ProductHit) {
    setBusy(true);
    setFeedback(null);
    try {
      if (hit.source === 'user' && hit.userProductId) {
        setFeedback(`Produit déjà dans ta liste : « ${hit.name} ».`);
        return;
      }
      if (hit.source === 'catalog' && hit.catalogId) {
        const result = await adoptCatalogProduct(hit.catalogId);
        if (result.status === 'reused_user') {
          setFeedback(`Déjà adopté : « ${result.product.name} ».`);
        } else {
          setFeedback(`Catalogue adopté : « ${result.product.name} » (sync via outbox).`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Produits</h1>
      <p className="lede">
        Recherche hybride catalogue + perso, anti-doublons via normalisation (accents, casse,
        pluriels légers).
      </p>

      <p className="search-stats">
        Index local : <strong>{universe.length}</strong> noms uniques · catalogue{' '}
        <strong>{catalogCount}</strong> · perso <strong>{products.length}</strong>
      </p>

      <ProductSearchBox busy={busy} onCreate={handleCreate} onSelect={handleSelect} />

      {feedback ? <p className="search-notice">{feedback}</p> : null}

      <h2 className="subhead">Mes produits</h2>
      <input
        className="filter-input"
        placeholder="Filtrer ma liste…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {filteredMine.length === 0 ? (
        <p className="empty">
          {products.length === 0
            ? 'Aucun produit perso — cherche dans le catalogue ou crée-en un.'
            : 'Aucun résultat pour ce filtre.'}
        </p>
      ) : (
        <ul className="entity-list">
          {filteredMine.map((product) => (
            <li key={product._id}>
              <div>
                <strong>{product.name}</strong>
                <span className="meta">
                  {categoryLabel(product.category)} · {product.defaultUnit}
                  {product.sourceCatalogId ? ' · depuis catalogue' : ' · perso'}
                  <br />
                  <code>{product.nameNormalized}</code>
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void softDeleteProduct(product._id)}
              >
                Suppr.
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
