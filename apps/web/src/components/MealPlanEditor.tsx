import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MEAL_TYPES, type MealPlan, type MealSlot, type MealType } from '@orgmymiam/shared';
import { useAuth } from '../auth/AuthProvider';
import { buildMealSlot, createMealPlan, updateMealPlan } from '../data/crud';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';
import { VisibilityToggle } from './VisibilityToggle';

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

function personsLabel(n: number): string {
  return `${n} personne${n === 1 ? '' : 's'}`;
}

export function MealPlanEditor({ plan, onDone, onCancel }: MealPlanEditorProps) {
  const { session } = useAuth();
  const userId = session?.user._id;
  const recipes =
    useLiveQuery(
      () => (userId ? db.recipes.filter((r) => r.deletedAt == null).sortBy('title') : []),
      [userId],
    ) ?? [];

  const [title, setTitle] = useState(plan?.title ?? '');
  const [startDate, setStartDate] = useState(plan?.startDate ?? todayIsoDate());
  const [slots, setSlots] = useState(plan?.slots ?? []);
  const [slotDate, setSlotDate] = useState(plan?.startDate ?? todayIsoDate());
  const [mealType, setMealType] = useState<MealType>('diner');
  const [recipeId, setRecipeId] = useState('');
  const [servingsOverride, setServingsOverride] = useState('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
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

  const recipeById = useMemo(
    () => Object.fromEntries(recipes.map((r) => [r._id, r])),
    [recipes],
  );

  const selectedRecipe = recipeId ? recipeById[recipeId] : undefined;

  const sortedSlots = useMemo(
    () =>
      [...slots].sort((a, b) =>
        a.date === b.date
          ? a.mealType.localeCompare(b.mealType)
          : a.date.localeCompare(b.date),
      ),
    [slots],
  );

  function resetSlotForm(nextDate?: string) {
    setEditingSlotId(null);
    setSlotDate(nextDate ?? startDate);
    setMealType('diner');
    setServingsOverride('');
    if (recipes[0]) setRecipeId(recipes[0]._id);
  }

  function beginEditSlot(slot: MealSlot) {
    setEditingSlotId(slot.id);
    setSlotDate(slot.date);
    setMealType(slot.mealType);
    setRecipeId(slot.recipeId);
    setServingsOverride(slot.servingsOverride != null ? String(slot.servingsOverride) : '');
    setError(null);
  }

  function parseOverride(): number | null {
    const overrideRaw = servingsOverride.trim();
    if (overrideRaw === '') return null;
    const override = Number(overrideRaw);
    if (!Number.isFinite(override) || override <= 0) {
      throw new Error('Nombre de personnes invalide');
    }
    return override;
  }

  function commitSlot() {
    if (!recipeId) {
      setError('Choisis une recette (crée-en une d’abord si besoin).');
      return;
    }
    let override: number | null;
    try {
      override = parseOverride();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nombre de personnes invalide');
      return;
    }
    setError(null);

    if (editingSlotId) {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === editingSlotId
            ? {
                ...slot,
                date: slotDate,
                mealType,
                recipeId,
                servingsOverride: override,
              }
            : slot,
        ),
      );
      resetSlotForm(slotDate);
      return;
    }

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
        <h2>{plan ? 'Modifier le planning' : 'Nouveau planning'}</h2>
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
              if (!editingSlotId) setSlotDate(e.target.value);
            }}
            required
          />
        </label>
        {plan ? (
          <VisibilityToggle
            entity="meal_plans"
            id={plan._id}
            value={plan.visibility ?? 'private'}
          />
        ) : null}
      </div>

      <h3 className="subhead">Créneaux</h3>
      {sortedSlots.length === 0 ? (
        <p className="empty">Aucun créneau — ajoute déjeuner, dîner, etc.</p>
      ) : (
        <ul className="entity-list">
          {sortedSlots.map((slot) => {
            const recipe = recipeById[slot.recipeId];
            const baseServings = recipe?.servings;
            return (
              <li key={slot.id} className={editingSlotId === slot.id ? 'is-editing' : undefined}>
                <div>
                  <strong>
                    {slot.date} · {MEAL_TYPE_LABELS[slot.mealType] ?? slot.mealType}
                  </strong>
                  <span className="meta">
                    {recipe?.title ?? 'Recette manquante'}
                    {baseServings != null ? ` (recette pour ${personsLabel(baseServings)})` : ''}
                    {slot.servingsOverride != null
                      ? ` · ce repas pour ${personsLabel(slot.servingsOverride)}`
                      : ''}
                  </span>
                </div>
                <div className="row-actions">
                  <button type="button" className="ghost-btn" onClick={() => beginEditSlot(slot)}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
                      if (editingSlotId === slot.id) resetSlotForm();
                    }}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="slot-adder stack-form">
        <h4 className="adder-title">
          {editingSlotId ? 'Modifier le créneau' : 'Ajouter un créneau'}
        </h4>
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
                {recipe.title} — pour {personsLabel(recipe.servings)}
              </option>
            ))}
          </select>
        </label>
        {selectedRecipe ? (
          <p className="field-help">
            Recette de base : quantités pour {personsLabel(selectedRecipe.servings)}.
            {servingsOverride.trim()
              ? ` Ce créneau sera adapté pour ${personsLabel(Number(servingsOverride) || selectedRecipe.servings)}.`
              : ' Laisse vide pour garder ces portions.'}
          </p>
        ) : null}
        <label>
          Pour combien de personnes ? (optionnel)
          <input
            inputMode="numeric"
            placeholder={
              selectedRecipe
                ? `comme la recette (${selectedRecipe.servings})`
                : 'comme dans la recette'
            }
            value={servingsOverride}
            onChange={(e) => setServingsOverride(e.target.value)}
          />
        </label>
        <p className="field-help">
          Si tu indiques un nombre, les quantités de la liste de courses seront adaptées.
        </p>
        <div className="editor-actions wrap">
          <button type="button" className="primary-btn" onClick={commitSlot} disabled={!recipeId}>
            {editingSlotId ? 'Enregistrer le créneau' : 'Ajouter le créneau'}
          </button>
          {editingSlotId ? (
            <button type="button" className="ghost-btn" onClick={() => resetSlotForm(slotDate)}>
              Annuler
            </button>
          ) : (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setSlotDate(addDays(slotDate, 1))}
            >
              Jour suivant
            </button>
          )}
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        <button type="button" className="primary-btn" disabled={busy} onClick={() => void onSave()}>
          {busy ? 'Enregistrement…' : 'Enregistrer le planning'}
        </button>
      </div>
    </div>
  );
}
