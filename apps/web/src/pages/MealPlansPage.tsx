import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { softDeleteMealPlan } from '../data/crud';
import { db } from '../db/database';

export function MealPlansPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const plans =
    useLiveQuery(
      () =>
        db.mealPlans
          .filter((p) => p.deletedAt == null)
          .reverse()
          .sortBy('updatedAt'),
      [],
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
      <section className="page-section">
        <MealPlanEditor
          plan={mode === 'edit' ? selected : null}
          onCancel={closeEditor}
          onDone={closeEditor}
        />
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Planning</h1>
          <p className="lede">Organise les repas de la semaine : date, type et recette.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setMode('create')}>
          Nouveau
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="empty">Aucun planning — crée ta semaine.</p>
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
                <strong>{plan.title}</strong>
                <span className="meta">
                  dès {plan.startDate} · {plan.slots.length}{' '}
                  {plan.slots.length === 1 ? 'créneau' : 'créneaux'}
                </span>
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => void softDeleteMealPlan(plan._id)}
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
