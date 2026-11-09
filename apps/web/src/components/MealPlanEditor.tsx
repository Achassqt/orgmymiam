import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MEAL_TYPES, type MealPlan, type MealType } from '@orgmymiam/shared';
import { buildMealSlot, createMealPlan, updateMealPlan } from '../data/crud';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';

interface MealPlanEditorProps {
  plan?: MealPlan | null;
  onDone: () => void;
  onCancel: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function MealPlanEditor({ plan, onDone, onCancel }: MealPlanEditorProps) {
  const recipes =
    useLiveQuery(
      () => db.recipes.filter((r) => r.deletedAt == null).sortBy('title'),
      [],
    ) ?? [];

  const [title, setTitle] = useState(plan?.title ?? '');
  const [startDate, setStartDate] = useState(plan?.startDate ?? todayIsoDate());
  const [slots, setSlots] = useState(plan?.slots ?? []);
  const [slotDate, setSlotDate] = useState(plan?.startDate ?? todayIsoDate());
  const [mealType, setMealType] = useState<MealType>('diner');
  const [recipeId, setRecipeId] = useState('');
  const [servingsOverride, setServingsOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title);
    setStartDate(plan.startDate);
    setSlots(plan.slots);
    setSlotDate(plan.startDate);
  }, [plan]);

  useEffect(() => {
    if (!recipeId && recipes[0]) {
      setRecipeId(recipes[0]._id);
    }
  }, [recipes, recipeId]);

  const recipeTitleById = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r._id, r.title])),
    [recipes],
  );

  const sortedSlots = useMemo(
    () =>
      [...slots].sort((a, b) =>
        a.date === b.date
          ? a.mealType.localeCompare(b.mealType)
          : a.date.localeCompare(b.date),
      ),
    [slots],
  );

  function addSlot() {
    if (!recipeId) {
      setError('Choisis une recette (crée-en une d’abord si besoin).');
      return;
    }
    const overrideRaw = servingsOverride.trim();
    const override = overrideRaw === '' ? null : Number(overrideRaw);
    if (overrideRaw !== '' && (!Number.isFinite(override) || (override ?? 0) <= 0)) {
      setError('Portions override invalides');
      return;
    }
    setError(null);
    setSlots((prev) => [
      ...prev,
      buildMealSlot({
        date: slotDate,
        mealType,
        recipeId,
        servingsOverride: override,
      }),
    ]);
  }

  async function onSave() {
    if (!title.trim()) {
      setError('Titre requis');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (plan) {
        await updateMealPlan(plan._id, { title, startDate, slots });
      } else {
        await createMealPlan({ title, startDate, slots });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <h2>{plan ? 'Modifier le plan' : 'Nouveau plan'}</h2>
        <button type="button" className="ghost-btn" onClick={onCancel}>
          Fermer
        </button>
      </div>

      <div className="stack-form">
        <label>
          Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Date de début
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setSlotDate(e.target.value);
            }}
            required
          />
        </label>
      </div>

      <h3 className="subhead">Créneaux</h3>
      {sortedSlots.length === 0 ? (
        <p className="empty">Aucun créneau — ajoute déjeuner, dîner, etc.</p>
      ) : (
        <ul className="entity-list">
          {sortedSlots.map((slot) => (
            <li key={slot.id}>
              <div>
                <strong>
                  {slot.date} · {MEAL_TYPE_LABELS[slot.mealType] ?? slot.mealType}
                </strong>
                <span className="meta">
                  {recipeTitleById[slot.recipeId] ?? 'Recette manquante'}
                  {slot.servingsOverride != null ? ` · ${slot.servingsOverride} portions` : ''}
                </span>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setSlots((prev) => prev.filter((s) => s.id !== slot.id))}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="slot-adder stack-form">
        <div className="qty-row">
          <label>
            Date
            <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
          </label>
          <label>
            Repas
            <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
              {MEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEAL_TYPE_LABELS[type] ?? type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Recette
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
            {recipes.length === 0 ? <option value="">Aucune recette</option> : null}
            {recipes.map((recipe) => (
              <option key={recipe._id} value={recipe._id}>
                {recipe.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Portions (optionnel)
          <input
            inputMode="numeric"
            placeholder="défaut recette"
            value={servingsOverride}
            onChange={(e) => setServingsOverride(e.target.value)}
          />
        </label>
        <div className="editor-actions wrap">
          <button type="button" className="primary-btn" onClick={addSlot} disabled={!recipeId}>
            Ajouter le créneau
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setSlotDate(addDays(slotDate, 1))}
          >
            Jour suivant
          </button>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void onSave()}>
          {busy ? 'Enregistrement…' : 'Enregistrer le plan'}
        </button>
      </div>
    </div>
  );
}
