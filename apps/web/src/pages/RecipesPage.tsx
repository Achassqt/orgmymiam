import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { DISH_PASTEL, DishIllo } from '../components/DishIllos';
import { EmptyState } from '../components/EmptyState';
import { TrashIcon } from '../components/icons';
import { PullToRefresh } from '../components/PullToRefresh';
import { RecipeEditor } from '../components/RecipeEditor';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { softDeleteRecipe } from '../data/crud';
import { db } from '../db/database';
import { formatMinutes, pickDishIllo, recipeMinutes } from '../lib/homeHub';

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
    <PullToRefresh>
      <section className="page-section page-enter screen-recettes">
        <div className="page-heading">
          <div>
            <h1 className="screen-title">Recettes</h1>
            <p className="lede">Tes plats avec portions et ingrédients.</p>
          </div>
          {recipes.length > 0 ? (
            <button
              type="button"
              className="primary-btn bounce-press"
              onClick={() => setMode('create')}
            >
              Nouvelle
            </button>
          ) : null}
        </div>

        {recipes.length === 0 ? (
          <EmptyState
            illo="chef"
            title="Ta première recette ?"
            description="Ajoute un plat, ses portions et ses ingrédients — ensuite place-le au planning."
            action={
              <button
                type="button"
                className="primary-btn bounce-press"
                onClick={() => setMode('create')}
              >
                Créer une recette
              </button>
            }
          />
        ) : (
          <ul className="entity-list recipe-card-list">
            {recipes.map((recipe) => {
              const dish = pickDishIllo(recipe.title);
              const mins = recipeMinutes(recipe.title, recipe.notes);
              return (
                <li key={recipe._id} className="recipe-card">
                  <button
                    type="button"
                    className="entity-main-btn recipe-card-btn"
                    onClick={() => {
                      setSelectedId(recipe._id);
                      setMode('edit');
                    }}
                  >
                    <span
                      className="recipe-card-thumb"
                      style={{ background: DISH_PASTEL[dish] }}
                      aria-hidden
                    >
                      <DishIllo dish={dish} className="recipe-card-illo" />
                    </span>
                    <span className="recipe-card-body">
                      <strong className="recipe-card-title">
                        {recipe.title}{' '}
                        <HouseholdBadge visibility={recipe.visibility} />
                      </strong>
                      <span className="meta">
                        pour {recipe.servings} personne
                        {recipe.servings === 1 ? '' : 's'} · {recipe.ingredients.length}{' '}
                        ingrédient
                        {recipe.ingredients.length === 1 ? '' : 's'}
                      </span>
                      {mins != null ? (
                        <span className="recipe-card-time">{formatMinutes(mins)}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn soft"
                    aria-label={`Supprimer ${recipe.title}`}
                    title="Supprimer"
                    onClick={() => {
                      if (!window.confirm(`Supprimer « ${recipe.title} » ?`)) return;
                      void softDeleteRecipe(recipe._id);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {recipes.length > 0 ? (
          <p className="page-foot-link">
            <Link to="/produits">Gérer mes produits</Link>
          </p>
        ) : null}
      </section>
    </PullToRefresh>
  );
}
