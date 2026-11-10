import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { MealPlan, MealType } from '@orgmymiam/shared';
import { useAuth } from '../auth/AuthProvider';
import {
  buildMealSlot,
  createMealPlan,
  softDeleteMealPlan,
  updateMealPlan,
} from '../data/crud';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';
import { PLANNING_MEAL_TYPES, addDaysIso } from '../lib/homeHub';
import { formatPlanDate, todayIsoDate } from '../lib/planDates';
import { removeMealSlot, replaceMealSlotForDayType } from '../lib/mealSlots';
import { TrashIcon } from './icons';
import { VisibilityToggle } from './VisibilityToggle';

interface MealPlanEditorProps {
  plan?: MealPlan | null;
  onDone: () => void;
  onCancel: () => void;
  /** Jour + type de repas du créneau (Planning → Ajouter / Modifier). */
  seedSlot?: { date: string; mealType: MealType } | null;
}

function defaultPlanTitle(date: string, mealType: MealType, recipeTitle: string): string {
  const meal = MEAL_TYPE_LABELS[mealType] ?? mealType;
  const trimmed = recipeTitle.trim();
  if (trimmed) return `${meal} · ${trimmed}`.slice(0, 200);
  return `${meal} · ${formatPlanDate(date)}`.slice(0, 200);
}

function IconDayChevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MealPlanEditor({
  plan,
  onDone,
  onCancel,
  seedSlot = null,
}: MealPlanEditorProps) {
  const { session } = useAuth();
  const userId = session?.user._id;
  const recipes =
    useLiveQuery(
      () => (userId ? db.recipes.filter((r) => r.deletedAt == null).sortBy('title') : []),
      [userId],
    ) ?? [];

  const initialDate = seedSlot?.date ?? plan?.slots[0]?.date ?? plan?.startDate ?? todayIsoDate();
  const initialMealType: MealType =
    seedSlot?.mealType ?? plan?.slots[0]?.mealType ?? 'dejeuner';

  const bootstrapSlot = useMemo(() => {
    if (!plan) return null;
    return (
      plan.slots.find((s) => s.date === initialDate && s.mealType === initialMealType) ??
      (seedSlot ? null : (plan.slots[0] ?? null))
    );
  }, [plan, initialDate, initialMealType, seedSlot]);

  const [slotDate, setSlotDate] = useState(bootstrapSlot?.date ?? initialDate);
  const [mealType, setMealType] = useState<MealType>(bootstrapSlot?.mealType ?? initialMealType);
  const [recipeId, setRecipeId] = useState(bootstrapSlot?.recipeId ?? '');
  const [servingsOverride, setServingsOverride] = useState(
    bootstrapSlot?.servingsOverride != null
      ? String(bootstrapSlot.servingsOverride)
      : '',
  );
  const [editingSlotId, setEditingSlotId] = useState<string | null>(bootstrapSlot?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const date = seedSlot?.date ?? plan?.slots[0]?.date ?? plan?.startDate ?? todayIsoDate();
    const type: MealType = seedSlot?.mealType ?? plan?.slots[0]?.mealType ?? 'dejeuner';
    const slot =
      plan?.slots.find((s) => s.date === date && s.mealType === type) ??
      (seedSlot ? null : (plan?.slots[0] ?? null));
    setSlotDate(slot?.date ?? date);
    setMealType(slot?.mealType ?? type);
    setRecipeId(slot?.recipeId ?? '');
    setServingsOverride(
      slot?.servingsOverride != null ? String(slot.servingsOverride) : '',
    );
    setEditingSlotId(slot?.id ?? null);
    setError(null);
  }, [plan, seedSlot]);

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
  const isEdit = Boolean(editingSlotId);
  const mealLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;

  // Préremplir les portions depuis la recette (création ou changement de recette).
  useEffect(() => {
    if (!selectedRecipe) return;
    if (isEdit && bootstrapSlot?.recipeId === selectedRecipe._id && bootstrapSlot.servingsOverride != null) {
      return;
    }
    setServingsOverride((prev) => {
      if (prev.trim() !== '' && isEdit && bootstrapSlot?.recipeId === selectedRecipe._id) {
        return prev;
      }
      return String(selectedRecipe.servings);
    });
  }, [selectedRecipe?._id, selectedRecipe?.servings, isEdit, bootstrapSlot?.recipeId, bootstrapSlot?.servingsOverride]);

  function parsePortions(): number {
    const raw = servingsOverride.trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Indique un nombre de portions valide');
    }
    return value;
  }

  async function onSave() {
    if (!recipeId) {
      setError('Choisis une recette (crée-en une d’abord si besoin).');
      return;
    }
    let portions: number;
    try {
      portions = parsePortions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portions invalides');
      return;
    }

    const recipeServings = recipeById[recipeId]?.servings;
    const override =
      recipeServings != null && portions === recipeServings ? null : portions;

    setBusy(true);
    setError(null);
    try {
      const draft = editingSlotId
        ? {
            id: editingSlotId,
            date: slotDate,
            mealType,
            recipeId,
            servingsOverride: override,
          }
        : buildMealSlot({
            date: slotDate,
            mealType,
            recipeId,
            servingsOverride: override,
          });

      const nextSlots = replaceMealSlotForDayType(plan?.slots ?? [], draft, editingSlotId);
      const recipeTitle = recipeById[recipeId]?.title ?? 'Repas';
      const title = plan?.title?.trim()
        ? plan.title
        : defaultPlanTitle(slotDate, mealType, recipeTitle);

      if (plan) {
        await updateMealPlan(plan._id, {
          title,
          startDate: plan.startDate < slotDate ? plan.startDate : slotDate,
          slots: nextSlots,
        });
      } else {
        await createMealPlan({
          title,
          startDate: slotDate,
          slots: nextSlots,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!plan || !editingSlotId) return;
    if (!window.confirm('Supprimer ce repas du planning ?')) return;

    setBusy(true);
    setError(null);
    try {
      const nextSlots = removeMealSlot(plan.slots, editingSlotId);
      if (nextSlots.length === 0) {
        await softDeleteMealPlan(plan._id);
      } else {
        await updateMealPlan(plan._id, { slots: nextSlots });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-panel planning-editor">
      <div className="editor-header editor-header-stack editor-header-left">
        <button type="button" className="back-link" onClick={onCancel}>
          ← Retour
        </button>
        <h2>{isEdit ? 'Modifier le repas' : 'Ajouter un repas'}</h2>
      </div>

      <div className="planning-day-nav" aria-label="Jour du repas">
        <button
          type="button"
          className="planning-day-nav-btn"
          aria-label="Jour précédent"
          onClick={() => setSlotDate((d) => addDaysIso(d, -1))}
        >
          <IconDayChevron dir="left" />
        </button>
        <p className="planning-day-nav-label">
          {formatPlanDate(slotDate)} · {mealLabel}
        </p>
        <button
          type="button"
          className="planning-day-nav-btn"
          aria-label="Jour suivant"
          onClick={() => setSlotDate((d) => addDaysIso(d, 1))}
        >
          <IconDayChevron dir="right" />
        </button>
      </div>

      <div className="stack-form planning-editor-form">
        <label>
          Type de repas
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
            {PLANNING_MEAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {MEAL_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recette
          <select
            value={recipeId}
            onChange={(e) => {
              const nextId = e.target.value;
              setRecipeId(nextId);
              const recipe = recipeById[nextId];
              if (recipe) setServingsOverride(String(recipe.servings));
            }}
          >
            {recipes.length === 0 ? <option value="">Aucune recette</option> : null}
            {recipes.map((recipe) => (
              <option key={recipe._id} value={recipe._id}>
                {recipe.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Portions
          <input
            inputMode="numeric"
            required
            min={1}
            value={servingsOverride}
            onChange={(e) => setServingsOverride(e.target.value)}
            placeholder={
              selectedRecipe ? String(selectedRecipe.servings) : 'Nombre de portions'
            }
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

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        {isEdit ? (
          <button
            type="button"
            className="icon-btn soft"
            aria-label="Supprimer ce repas"
            title="Supprimer"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            <TrashIcon />
          </button>
        ) : null}
        <button
          type="button"
          className="primary-btn"
          disabled={busy || !recipeId}
          onClick={() => void onSave()}
        >
          {busy ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter au planning'}
        </button>
      </div>
    </div>
  );
}
