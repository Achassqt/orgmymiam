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
      <section className="page-section page-enter screen-courses">
        <div className="page-heading">
          <div>
            <h1 className="screen-title">Courses</h1>
            <p className="lede">Génère depuis un planning, coche au fur et à mesure.</p>
          </div>
        </div>

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
          <div className="stack-form generate-box soft-card">
            <h2 className="subhead generate-box-title">Nouvelle liste</h2>
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
            <ul className="entity-list shop-hub-list">
              {lists.map((list) => {
                const checked = list.items.filter((i) => i.checked).length;
                const total = list.items.length;
                const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
                return (
                  <li key={list._id} className="shop-hub-card">
                    <button
                      type="button"
                      className="entity-main-btn shop-list-card-btn"
                      onClick={() => setSelectedId(list._id)}
                    >
                      <span className="shop-hub-icon" aria-hidden>
                        <ShopBasketIcon />
                      </span>
                      <span className="shop-hub-body">
                        <strong className="shop-hub-title">
                          {list.title} <HouseholdBadge visibility={list.visibility} />
                        </strong>
                        <span className="meta">
                          {list.status === 'open' ? 'Ouverte' : 'Terminée'}
                          {list.visibility === 'household'
                            ? ` · ${list.memberIds.length} membre${list.memberIds.length === 1 ? '' : 's'}`
                            : ''}
                        </span>
                        <span className="shop-hub-progress" aria-hidden>
                          <span className="shop-hub-progress-bar" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="shop-hub-fraction">
                          <span className="shop-hub-fraction-num">
                            {checked}/{total}
                          </span>{' '}
                          cochés
                        </span>
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

function ShopBasketIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 10h17l-1.6 8.6a2 2 0 0 1-2 1.6H7.1a2 2 0 0 1-2-1.6z"
        stroke="#1F3D2B"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 10l4-6 4 6M9 13.5v3.5M12 13.5v3.5M15 13.5v3.5"
        stroke="#1F3D2B"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
