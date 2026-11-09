import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { ProductSearchBox } from '../components/ProductSearchBox';
import { UnitSelect } from '../components/UnitSelect';
import { adoptCatalogProduct, createProduct, softDeleteProduct } from '../data/crud';
import { categoryLabel, type ProductHit } from '../data/productSearch';
import { db } from '../db/database';
import { unitDisplayLabel } from '../lib/units';

export function ProductsPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const products =
    useLiveQuery(
      () =>
        userId
          ? db.products
              .filter((p) => p.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('unité');

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
      const result = await createProduct({ name, defaultUnit });
      if (result.status === 'reused_user') {
        setFeedback(`Déjà dans ta liste : « ${result.product.name} ».`);
      } else if (result.status === 'reused_catalog') {
        setFeedback(`Ajouté à tes produits : « ${result.product.name} ».`);
      } else {
        setFeedback(
          `Produit créé : « ${result.product.name} » (${unitDisplayLabel(result.product.defaultUnit)}).`,
        );
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
        setFeedback(`Déjà dans ta liste : « ${hit.name} ».`);
        return;
      }
      if (hit.source === 'catalog' && hit.catalogId) {
        const result = await adoptCatalogProduct(hit.catalogId);
        if (result.status === 'reused_user') {
          setFeedback(`Déjà dans ta liste : « ${result.product.name} ».`);
        } else {
          setFeedback(`Ajouté à tes produits : « ${result.product.name} ».`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section page-enter">
      <div className="page-heading">
        <div>
          <h1>Produits</h1>
          <p className="lede">Catalogue perso — aussi accessible depuis les recettes.</p>
        </div>
        <Link className="ghost-btn" to="/recettes">
          ← Recettes
        </Link>
      </div>

      <div className="product-create-unit">
        <label>
          Unité par défaut (nouveaux produits)
          <UnitSelect value={defaultUnit} onChange={setDefaultUnit} />
        </label>
      </div>

      <ProductSearchBox busy={busy} onCreate={handleCreate} onSelect={handleSelect} />

      {feedback ? <p className="search-notice">{feedback}</p> : null}

      <h2 className="subhead">Mes produits</h2>
      {products.length > 0 ? (
        <input
          className="filter-input"
          placeholder="Filtrer ma liste…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      ) : null}

      {filteredMine.length === 0 ? (
        products.length === 0 ? (
          <EmptyState
            illo="bowl"
            title="Aucun produit encore"
            description="Cherche ci-dessus, ou ajoute des ingrédients depuis une recette."
            action={
              <Link className="primary-btn bounce-press" to="/recettes">
                Aller aux recettes
              </Link>
            }
          />
        ) : (
          <p className="empty">Aucun résultat pour ce filtre.</p>
        )
      ) : (
        <ul className="entity-list">
          {filteredMine.map((product) => (
            <li key={product._id}>
              <div>
                <strong>{product.name}</strong>
                <span className="meta">
                  {categoryLabel(product.category)} · {unitDisplayLabel(product.defaultUnit)}
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
