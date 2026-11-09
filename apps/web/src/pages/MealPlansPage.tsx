import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { TrashIcon } from '../components/icons';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { PullToRefresh } from '../components/PullToRefresh';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { softDeleteMealPlan } from '../data/crud';
import { db } from '../db/database';

export function MealPlansPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = plans.find((p) => p._id === selectedId) ?? null;

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    if (plans.some((p) => p._id === editId)) {
      setSelectedId(editId);
      setMode('edit');
    }
  }, [searchParams, plans]);

  function closeEditor() {
    setMode('list');
    setSelectedId(null);
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }

  if (mode === 'create' || (mode === 'edit' && selected)) {
    return (
      <section className="page-section page-enter">
        <MealPlanEditor
          plan={mode === 'edit' ? selected : null}
          onCancel={closeEditor}
          onDone={closeEditor}
        />
      </section>
    );
  }

  return (
    <PullToRefresh>
      <section className="page-section page-enter">
        <div className="page-heading">
          <div>
            <h1>Planning</h1>
            <p className="lede">La semaine en créneaux : date, type, recette.</p>
          </div>
          {plans.length > 0 ? (
            <button
              type="button"
              className="primary-btn bounce-press"
              onClick={() => setMode('create')}
            >
              Nouveau
            </button>
          ) : null}
        </div>

        {plans.length === 0 ? (
          <EmptyState
            illo="calendar"
            title="Planifie ta semaine"
            description="Place tes recettes sur des créneaux, puis génère la liste de courses."
            action={
              <button
                type="button"
                className="primary-btn bounce-press"
                onClick={() => setMode('create')}
              >
                Créer un planning
              </button>
            }
          />
        ) : (
          <ul className="entity-list">
            {plans.map((plan) => (
              <li key={plan._id}>
                <button
                  type="button"
                  className="entity-main-btn"
                  onClick={() => {
                    setSelectedId(plan._id);
                    setMode('edit');
                  }}
                >
                  <strong>
                    {plan.title} <HouseholdBadge visibility={plan.visibility} />
                  </strong>
                  <span className="meta">
                    dès {plan.startDate} · {plan.slots.length}{' '}
                    {plan.slots.length === 1 ? 'créneau' : 'créneaux'}
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn soft"
                  aria-label={`Supprimer ${plan.title}`}
                  title="Supprimer"
                  onClick={() => {
                    if (!window.confirm(`Supprimer « ${plan.title} » ?`)) return;
                    void softDeleteMealPlan(plan._id);
                  }}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PullToRefresh>
  );
}
