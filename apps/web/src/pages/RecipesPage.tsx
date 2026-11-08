import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createRecipe, softDeleteRecipe } from '../data/crud';
import { db } from '../db/database';

export function RecipesPage() {
  const recipes =
    useLiveQuery(
      () =>
        db.recipes
          .filter((r) => r.deletedAt == null)
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
      await createRecipe({ title });
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Recettes</h1>
      <p className="lede">
        Placeholder CRUD local. Ingrédients détaillés = Étape 4.
      </p>

      <form className="inline-form" onSubmit={(e) => void onCreate(e)}>
        <input
          placeholder="Titre de recette…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <button type="submit" className="primary-btn" disabled={busy}>
          Ajouter
        </button>
      </form>

      {recipes.length === 0 ? (
        <p className="empty">Aucune recette.</p>
      ) : (
        <ul className="entity-list">
          {recipes.map((recipe) => (
            <li key={recipe._id}>
              <div>
                <strong>{recipe.title}</strong>
                <span className="meta">{recipe.servings} portions</span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void softDeleteRecipe(recipe._id)}
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
