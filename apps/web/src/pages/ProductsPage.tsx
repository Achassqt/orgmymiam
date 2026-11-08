import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProduct, softDeleteProduct } from '../data/crud';
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
  const catalogSample =
    useLiveQuery(() => db.catalogProducts.orderBy('nameNormalized').limit(8).toArray(), []) ?? [];
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createProduct({ name });
      setName('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Produits</h1>
      <p className="lede">
        CRUD local optimiste (Étape 2). Autocomplete anti-doublons = Étape 3.
      </p>

      <form className="inline-form" onSubmit={(e) => void onCreate(e)}>
        <input
          placeholder="Nouveau produit…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="primary-btn" disabled={busy}>
          Ajouter
        </button>
      </form>

      <h2 className="subhead">Mes produits</h2>
      {products.length === 0 ? (
        <p className="empty">Aucun produit perso pour l’instant.</p>
      ) : (
        <ul className="entity-list">
          {products.map((product) => (
            <li key={product._id}>
              <div>
                <strong>{product.name}</strong>
                <span className="meta">
                  {product.category} · {product.defaultUnit}
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

      <h2 className="subhead">Aperçu catalogue</h2>
      <ul className="entity-list muted">
        {catalogSample.map((item) => (
          <li key={item._id}>
            <div>
              <strong>{item.name}</strong>
              <span className="meta">{item.category}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
