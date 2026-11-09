import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState } from '../components/EmptyState';
import { RecipeEditor } from '../components/RecipeEditor';
import { softDeleteRecipe } from '../data/crud';
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
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = recipes.find((r) => r._id === selectedId) ?? null;

  if (mode === 'create' || (mode === 'edit' && selected)) {
    return (
      <section className="page-section page-enter">
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
    <section className="page-section page-enter">
      <div className="page-heading">
        <div>
          <h1>Recettes</h1>
          <p className="lede">Tes plats, portions et ingrédients.</p>
        </div>
        {recipes.length > 0 ? (
          <button type="button" className="primary-btn" onClick={() => setMode('create')}>
            Nouvelle
          </button>
        ) : null}
      </div>

      {recipes.length === 0 ? (
        <EmptyState
          title="Ta première recette"
          description="Ajoute un plat avec ses portions — les courses suivront."
          action={
            <button type="button" className="primary-btn" onClick={() => setMode('create')}>
              Créer une recette
            </button>
          }
        />
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
                <strong>{recipe.title}</strong>
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

      <p className="page-footnote">
        Gérer le catalogue ? <Link to="/produits">Produits</Link>
      </p>
    </section>
  );
}
