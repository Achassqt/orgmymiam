import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { softDeleteMealPlan } from '../data/crud';
import { db } from '../db/database';

export function MealPlansPage() {
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

  if (mode === 'create' || (mode === 'edit' && selected)) {
    return (
      <section className="page-section">
        <MealPlanEditor
          plan={mode === 'edit' ? selected : null}
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
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>Plans de repas</h1>
          <p className="lede">
            Planifie des créneaux (date + type de repas + recette), 100 % offline.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setMode('create')}>
          Nouveau
        </button>
      </div>

      {plans.length === 0 ? (
        <p className="empty">Aucun plan — crée une semaine même sans réseau.</p>
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
