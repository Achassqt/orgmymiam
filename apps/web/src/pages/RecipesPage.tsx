import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { PullToRefresh } from '../components/PullToRefresh';
import { RecipeEditor } from '../components/RecipeEditor';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { softDeleteRecipe } from '../data/crud';
import { db } from '../db/database';

export function RecipesPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const recipes =
    useLiveQuery(
      () =>
        userId
          ? db.recipes
              .filter((r) => r.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = recipes.find((r) => r._id === selectedId) ?? null;
  const editing = mode === 'create' || (mode === 'edit' && selected);

  if (editing) {
    return (
      <section className="page-section">
        <RecipeEditor
          recipe={mode === 'edit' ? selected : null}
          onCancel={() => {
            setMode('list');
            setSelectedId(null);
          }}
          onDone={() => {
            setMode('list');
            setSelectedId(null);
          }}
        />
      </section>
    );
  }

  return (
    <PullToRefresh>
      <section className="page-section">
        <div className="page-heading">
          <div>
            <h1>Recettes</h1>
            <p className="lede">Tes plats avec portions et ingrédients.</p>
          </div>
          <button type="button" className="primary-btn" onClick={() => setMode('create')}>
            Nouvelle
          </button>
        </div>

        {recipes.length === 0 ? (
          <p className="empty">Aucune recette — crée ta première.</p>
        ) : (
          <ul className="entity-list">
            {recipes.map((recipe) => (
              <li key={recipe._id}>
                <button
                  type="button"
                  className="entity-main-btn"
                  onClick={() => {
                    setSelectedId(recipe._id);
                    setMode('edit');
                  }}
                >
                  <strong>
                    {recipe.title} <HouseholdBadge visibility={recipe.visibility} />
                  </strong>
                  <span className="meta">
                    pour {recipe.servings} personne{recipe.servings === 1 ? '' : 's'} ·{' '}
                    {recipe.ingredients.length} ingrédient
                    {recipe.ingredients.length === 1 ? '' : 's'}
                  </span>
                </button>
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
    </PullToRefresh>
  );
}
