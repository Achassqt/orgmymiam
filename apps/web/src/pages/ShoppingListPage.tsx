import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { TrashIcon } from '../components/icons';
import { PullToRefresh } from '../components/PullToRefresh';
import { ShoppingListDetail } from '../components/ShoppingListDetail';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { createShoppingList, softDeleteShoppingList } from '../data/crud';
import { generateShoppingListFromMealPlan } from '../data/shoppingList';
import { db } from '../db/database';

export function ShoppingListPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const lists =
    useLiveQuery(
      () =>
        userId
          ? db.shoppingLists
              .filter((l) => l.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];
  const plans =
    useLiveQuery(
      () =>
        userId
          ? db.mealPlans
              .filter((p) => p.deletedAt == null)
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mealPlanId, setMealPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((p) => p._id === mealPlanId) ?? null,
    [plans, mealPlanId],
  );

  const portionsPreview = useMemo(() => {
    if (!selectedPlan) return null;
    const mealCount = selectedPlan.slots.length;
    const overrides = selectedPlan.slots
      .map((s) => s.servingsOverride)
      .filter((n): n is number => n != null && n > 0);
    const unique = [...new Set(overrides)];
    let servingsText: string;
    if (unique.length === 1) {
      servingsText = `pour ${unique[0]} personne${unique[0] === 1 ? '' : 's'}`;
    } else if (unique.length > 1) {
      servingsText = 'selon les portions de chaque repas';
    } else {
      servingsText = 'selon les portions de chaque recette';
    }
    return {
      mealCount,
      summary: `${mealCount} repas · quantités ${servingsText}.`,
    };
  }, [selectedPlan]);

  if (selectedId) {
    return (
      <section className="page-section page-enter">
        <ShoppingListDetail listId={selectedId} onBack={() => setSelectedId(null)} />
      </section>
    );
  }

  async function onGenerate() {
    if (!mealPlanId) {
      setError('Choisis un planning');
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

  const showEmptyHub = lists.length === 0 && plans.length === 0;

  return (
    <PullToRefresh>
      <section className="page-section page-enter">
        <h1>Courses</h1>
        <p className="lede">Génère depuis un planning, coche au fur et à mesure.</p>

        {showEmptyHub ? (
          <EmptyState
            illo="cart"
            title="Pas encore de liste"
            description="Crée d’abord un planning avec des recettes, puis reviens générer tes courses."
            action={
              <Link className="primary-btn bounce-press" to="/plans">
                Aller au planning
              </Link>
            }
          />
        ) : (
          <div className="stack-form generate-box">
            <label>
              Depuis un planning
              <select value={mealPlanId} onChange={(e) => setMealPlanId(e.target.value)}>
                <option value="">Choisir…</option>
                {plans.map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.title} ({plan.slots.length} repas)
                  </option>
                ))}
              </select>
            </label>
            {portionsPreview ? (
              <p className="portions-banner" role="status">
                {portionsPreview.summary}
              </p>
            ) : null}
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
                className="primary-btn bounce-press"
                disabled={busy || !mealPlanId}
                onClick={() => void onGenerate()}
              >
                Générer la liste
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => void onCreateEmpty()}
              >
                Liste vide
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="empty">
                Crée d’abord un <Link to="/plans">planning</Link> pour générer une liste.
              </p>
            ) : null}
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        )}

        {lists.length > 0 ? (
          <>
            <h2 className="subhead">Mes listes</h2>
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
                      <strong>
                        {list.title} <HouseholdBadge visibility={list.visibility} />
                      </strong>
                      <span className="meta">
                        {list.status === 'open' ? 'Ouverte' : 'Terminée'} · {checked}/
                        {list.items.length}
                        {list.visibility === 'household'
                          ? ` · ${list.memberIds.length} membre${list.memberIds.length === 1 ? '' : 's'}`
                          : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn soft"
                      aria-label={`Supprimer ${list.title}`}
                      title="Supprimer"
                      onClick={() => {
                        if (!window.confirm(`Supprimer « ${list.title} » ?`)) return;
                        void softDeleteShoppingList(list._id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>
    </PullToRefresh>
  );
}
