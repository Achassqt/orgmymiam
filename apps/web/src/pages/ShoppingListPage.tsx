import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createShoppingList, softDeleteShoppingList } from '../data/crud';
import { db } from '../db/database';

export function ShoppingListPage() {
  const lists =
    useLiveQuery(
      () =>
        db.shoppingLists
          .filter((l) => l.deletedAt == null)
          .reverse()
          .sortBy('updatedAt'),
      [],
    ) ?? [];
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createShoppingList({ title });
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Liste de courses</h1>
      <p className="lede">
        Placeholder listes. Génération depuis un plan + cochage = Étape 5.
      </p>

      <form className="inline-form" onSubmit={(e) => void onCreate(e)}>
        <input
          placeholder="Nom de liste…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit" className="primary-btn" disabled={busy}>
          Créer
        </button>
      </form>

      {lists.length === 0 ? (
        <p className="empty">Aucune liste.</p>
      ) : (
        <ul className="entity-list">
          {lists.map((list) => (
            <li key={list._id}>
              <div>
                <strong>{list.title}</strong>
                <span className="meta">
                  {list.status} · {list.items.length} articles
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void softDeleteShoppingList(list._id)}
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
