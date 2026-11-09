import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingListDetail } from '../components/ShoppingListDetail';
import { createShoppingList, softDeleteShoppingList } from '../data/crud';
import { generateShoppingListFromMealPlan } from '../data/shoppingList';
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
  const plans =
    useLiveQuery(
      () =>
        db.mealPlans
          .filter((p) => p.deletedAt == null)
          .reverse()
          .sortBy('updatedAt'),
      [],
    ) ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealPlanId, setMealPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedId) {
    return (
      <section className="page-section">
        <ShoppingListDetail listId={selectedId} onBack={() => setSelectedId(null)} />
      </section>
    );
  }

  async function onGenerate() {
    if (!mealPlanId) {
      setError('Choisis un plan de repas');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const list = await generateShoppingListFromMealPlan({
        mealPlanId,
        title: title.trim() || undefined,
      });
      setTitle('');
      setSelectedId(list._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Génération impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateEmpty() {
    setBusy(true);
    setError(null);
    try {
      const list = await createShoppingList({
        title: title.trim() || 'Courses',
      });
      setTitle('');
      setSelectedId(list._id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Liste de courses</h1>
      <p className="lede">
        Génère depuis un plan (quantités consolidées), ajoute des extras, coche hors-ligne.
      </p>

      <div className="stack-form generate-box">
        <label>
          Depuis un plan
          <select
            value={mealPlanId}
            onChange={(e) => setMealPlanId(e.target.value)}
          >
            <option value="">Choisir…</option>
            {plans.map((plan) => (
              <option key={plan._id} value={plan._id}>
                {plan.title} ({plan.slots.length} créneaux)
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre (optionnel)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Courses semaine…"
          />
        </label>
        <div className="editor-actions wrap">
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !mealPlanId}
            onClick={() => void onGenerate()}
          >
            Générer la liste
          </button>
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => void onCreateEmpty()}>
            Liste vide (extras only)
          </button>
        </div>
        {plans.length === 0 ? (
          <p className="empty">Crée d’abord un plan avec recettes pour générer une liste.</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>

      <h2 className="subhead">Mes listes</h2>
      {lists.length === 0 ? (
        <p className="empty">Aucune liste pour l’instant.</p>
      ) : (
        <ul className="entity-list">
          {lists.map((list) => {
            const checked = list.items.filter((i) => i.checked).length;
            return (
              <li key={list._id}>
                <button
                  type="button"
                  className="entity-main-btn"
                  onClick={() => setSelectedId(list._id)}
                >
                  <strong>{list.title}</strong>
                  <span className="meta">
                    {list.status} · {checked}/{list.items.length} ·{' '}
                    {list.mealPlanId ? 'depuis plan' : 'manuelle'}
                  </span>
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => void softDeleteShoppingList(list._id)}
                >
                  Suppr.
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
