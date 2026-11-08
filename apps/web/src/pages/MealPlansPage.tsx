import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createMealPlan, softDeleteMealPlan } from '../data/crud';
import { db } from '../db/database';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [busy, setBusy] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createMealPlan({ title, startDate });
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-section">
      <h1>Plans de repas</h1>
      <p className="lede">Placeholder. Slots détaillés = Étape 4.</p>

      <form className="stack-form" onSubmit={(e) => void onCreate(e)}>
        <label>
          Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Début
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>
          Créer un plan
        </button>
      </form>

      {plans.length === 0 ? (
        <p className="empty">Aucun plan.</p>
      ) : (
        <ul className="entity-list">
          {plans.map((plan) => (
            <li key={plan._id}>
              <div>
                <strong>{plan.title}</strong>
                <span className="meta">à partir du {plan.startDate}</span>
              </div>
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
