import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
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
      summary: `${mealCount} repas · quantités ${servingsText}. Ex. : si une recette indique 400 g pour 2 pers. et le créneau est pour 4, la liste aura 800 g.`,
    };
  }, [selectedPlan]);

  if (selectedId) {
    return (
      <section className="page-section">
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

  return (
    <PullToRefresh>
      <section className="page-section">
        <h1>Liste de courses</h1>
        <p className="lede">
          Génère depuis un planning, ajuste les quantités, coche au fur et à mesure.
        </p>

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
              className="primary-btn"
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
              Crée d’abord un planning avec des recettes pour générer une liste.
            </p>
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
                    <strong>
                      {list.title} <HouseholdBadge visibility={list.visibility} />
                    </strong>
                    <span className="meta">
                      {list.status === 'open' ? 'Ouverte' : 'Terminée'} · {checked}/
                      {list.items.length} · {list.mealPlanId ? 'depuis planning' : 'manuelle'}
                      {list.visibility === 'household'
                        ? ` · ${list.memberIds.length} membre${list.memberIds.length === 1 ? '' : 's'}`
                        : ''}
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
    </PullToRefresh>
  );
}
