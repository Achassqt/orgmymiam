import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import type { MealType } from '@orgmymiam/shared';
import { useAuth } from '../auth/AuthProvider';
import { DISH_PASTEL, DishIllo } from '../components/DishIllos';
import { MealPlanEditor } from '../components/MealPlanEditor';
import { PullToRefresh } from '../components/PullToRefresh';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { META_KEYS, db, setMeta } from '../db/database';
import {
  PLANNING_MEAL_TYPES,
  addDaysIso,
  formatMinutes,
  formatWeekSubtitle,
  mealTypeOrder,
  movePlanningMealType,
  normalizePlanningMealOrder,
  pickDishIllo,
  recipeMinutes,
  weekDayStrip,
  type PlanningMealType,
} from '../lib/homeHub';
import { todayIsoDate } from '../lib/planDates';

function IconChevron({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) {
  const path =
    dir === 'left'
      ? 'm15 18-6-6 6-6'
      : dir === 'right'
        ? 'm9 18 6-6-6-6'
        : dir === 'up'
          ? 'm6 15 6-6 6 6'
          : 'm6 9 6 6 6-6';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock({ size = 13, color = '#6B7368' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path
        d="M12 7v5l3 2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type PlanMeal = {
  slotId: string;
  planId: string;
  date: string;
  mealType: string;
  recipeId: string;
  recipeTitle: string;
  recipeNotes: string;
  planVisibility: 'private' | 'household';
};

function defaultSelectedDate(weekDates: string[], today: string): string {
  if (weekDates.includes(today)) return today;
  return weekDates[0] ?? today;
}

export function MealPlansPage() {
  const { session } = useAuth();
  const userId = session?.user._id;
  const today = todayIsoDate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seedSlot, setSeedSlot] = useState<{ date: string; mealType: MealType } | null>(
    null,
  );
  const [reorderMode, setReorderMode] = useState(false);

  const storedOrder = useLiveQuery(
    async () => (await db.meta.get(META_KEYS.planningMealOrder))?.value ?? null,
    [],
  );
  const slotOrder = useMemo(() => {
    const raw =
      storedOrder &&
      typeof storedOrder === 'object' &&
      !Array.isArray(storedOrder) &&
      Array.isArray((storedOrder as { order?: unknown }).order)
        ? ((storedOrder as { order: string[] }).order)
        : null;
    return normalizePlanningMealOrder(raw);
  }, [storedOrder]);

  const days = useMemo(() => weekDayStrip(weekAnchor, today), [weekAnchor, today]);
  const weekDates = useMemo(() => days.map((d) => d.date), [days]);
  const weekDateSet = useMemo(() => new Set(weekDates), [weekDates]);
  const weekSubtitle = useMemo(() => formatWeekSubtitle(weekAnchor), [weekAnchor]);

  useEffect(() => {
    setSelectedDate((prev) =>
      weekDateSet.has(prev) ? prev : defaultSelectedDate(weekDates, today),
    );
  }, [weekDateSet, weekDates, today]);

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

  const weekMeals = useLiveQuery(async () => {
    if (!userId) return [] as PlanMeal[];
    const allPlans = await db.mealPlans.filter((p) => p.deletedAt == null).toArray();
    const recipes = await db.recipes.filter((r) => r.deletedAt == null).toArray();
    const recipeById = Object.fromEntries(recipes.map((r) => [r._id, r]));

    return allPlans
      .flatMap((plan) =>
        plan.slots
          .filter((slot) => weekDateSet.has(slot.date))
          .map((slot) => {
            const recipe = recipeById[slot.recipeId];
            return {
              slotId: slot.id,
              planId: plan._id,
              date: slot.date,
              mealType: slot.mealType,
              recipeId: slot.recipeId,
              recipeTitle: recipe?.title ?? 'Recette',
              recipeNotes: recipe?.notes ?? '',
              planVisibility: plan.visibility,
            };
          }),
      )
      .sort((a, b) =>
        a.date === b.date
          ? mealTypeOrder(a.mealType) - mealTypeOrder(b.mealType)
          : a.date.localeCompare(b.date),
      );
  }, [userId, weekDates.join('|')]);

  const selected = plans.find((p) => p._id === selectedId) ?? null;
  const meals = weekMeals ?? [];
  const selectedDay = days.find((d) => d.date === selectedDate) ?? days[0];

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    if (mode !== 'list' && selectedId === editId) return;
    const plan = plans.find((p) => p._id === editId);
    if (!plan) return;
    setSelectedId(plan._id);
    setMode('edit');
    const slot =
      plan.slots.find((s) => s.date === today) ??
      plan.slots.find((s) => weekDateSet.has(s.date)) ??
      plan.slots[0];
    if (slot) {
      setSeedSlot({ date: slot.date, mealType: slot.mealType });
      setWeekAnchor(slot.date);
      setSelectedDate(slot.date);
    } else {
      setSeedSlot({ date: today, mealType: 'dejeuner' });
    }
  }, [searchParams, plans, today, weekDateSet, mode, selectedId]);

  function closeEditor() {
    setMode('list');
    setSelectedId(null);
    setSeedSlot(null);
    if (searchParams.has('edit')) {
      const next = new URLSearchParams(searchParams);
      next.delete('edit');
      setSearchParams(next, { replace: true });
    }
  }

  function openEditMeal(meal: PlanMeal) {
    setSeedSlot({ date: meal.date, mealType: meal.mealType as MealType });
    setSelectedId(meal.planId);
    setMode('edit');
  }

  function openAddSlot(date: string, mealType: PlanningMealType) {
    const seed = { date, mealType: mealType as MealType };
    setSeedSlot(seed);

    const planWithDay = plans.find((p) => p.slots.some((s) => s.date === date));
    const planInWeek = plans.find((p) => p.slots.some((s) => weekDateSet.has(s.date)));
    const target = planWithDay ?? planInWeek ?? plans[0] ?? null;

    if (target) {
      setSelectedId(target._id);
      setMode('edit');
    } else {
      setSelectedId(null);
      setMode('create');
    }
  }

  function mealFor(date: string, mealType: PlanningMealType): PlanMeal | null {
    return meals.find((m) => m.date === date && m.mealType === mealType) ?? null;
  }

  function mealDots(date: string): boolean[] {
    return slotOrder.map((type) =>
      meals.some((m) => m.date === date && m.mealType === type),
    );
  }

  function shiftWeek(deltaDays: number) {
    setWeekAnchor((a) => addDaysIso(a, deltaDays));
  }

  async function reorderSlot(mealType: PlanningMealType, direction: -1 | 1) {
    const next = movePlanningMealType(slotOrder, mealType, direction);
    await setMeta(META_KEYS.planningMealOrder, { order: next });
  }

  if (mode === 'create' || (mode === 'edit' && selected)) {
    return (
      <section className="page-section page-enter">
        <MealPlanEditor
          plan={mode === 'edit' ? selected : null}
          seedSlot={seedSlot}
          onCancel={closeEditor}
          onDone={closeEditor}
        />
      </section>
    );
  }

  return (
    <PullToRefresh>
      <section className="page-section planning-page page-enter">
        <header className="planning-header">
          <h1 className="planning-title">Planning</h1>
          <div className="planning-header-row">
            <p className="planning-subtitle">{weekSubtitle}</p>
            <div className="planning-week-nav">
              <button
                type="button"
                className="planning-week-btn"
                aria-label="Semaine précédente"
                onClick={() => shiftWeek(-7)}
              >
                <IconChevron dir="left" />
              </button>
              <button
                type="button"
                className="planning-week-btn"
                aria-label="Semaine suivante"
                onClick={() => shiftWeek(7)}
              >
                <IconChevron dir="right" />
              </button>
            </div>
          </div>
        </header>

        <div className="planning-week-strip" role="tablist" aria-label="Jours de la semaine">
          {days.map((day) => {
            const active = day.date === selectedDate;
            const dots = mealDots(day.date);
            return (
              <button
                key={day.date}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? 'planning-week-day is-active'
                    : day.isToday
                      ? 'planning-week-day is-today'
                      : 'planning-week-day'
                }
                onClick={() => setSelectedDate(day.date)}
              >
                <span className="planning-week-label">{day.label}</span>
                <span className="planning-week-num">{day.dayNum}</span>
                <span className="planning-week-dots" aria-hidden>
                  {dots.map((filled, i) => (
                    <span key={slotOrder[i]} className={filled ? 'is-filled' : undefined} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {!weekMeals ? (
          <p className="empty">Chargement…</p>
        ) : selectedDay ? (
          <article
            className="planning-day-card"
            aria-labelledby={`planning-day-${selectedDay.date}`}
          >
            <header className="planning-day-header">
              <h2 id={`planning-day-${selectedDay.date}`} className="planning-day-title">
                {selectedDay.fullLabel}
              </h2>
              <div className="planning-day-actions">
                {selectedDay.isToday ? (
                  <span className="planning-today-badge">Aujourd&apos;hui</span>
                ) : null}
                <button
                  type="button"
                  className={
                    reorderMode
                      ? 'planning-reorder-btn is-active'
                      : 'planning-reorder-btn'
                  }
                  aria-pressed={reorderMode}
                  onClick={() => setReorderMode((v) => !v)}
                >
                  {reorderMode ? 'OK' : 'Réordonner'}
                </button>
              </div>
            </header>

            <ul className="planning-slots">
              {slotOrder.map((mealType, index) => {
                const meal = mealFor(selectedDay.date, mealType);
                const label = MEAL_TYPE_LABELS[mealType] ?? mealType;
                const reorderControls = reorderMode ? (
                  <div className="planning-slot-reorder">
                    <button
                      type="button"
                      className="planning-slot-move"
                      aria-label={`Monter ${label}`}
                      disabled={index === 0}
                      onClick={() => void reorderSlot(mealType, -1)}
                    >
                      <IconChevron dir="up" />
                    </button>
                    <button
                      type="button"
                      className="planning-slot-move"
                      aria-label={`Descendre ${label}`}
                      disabled={index === slotOrder.length - 1}
                      onClick={() => void reorderSlot(mealType, 1)}
                    >
                      <IconChevron dir="down" />
                    </button>
                  </div>
                ) : null;

                if (meal) {
                  const dish = pickDishIllo(meal.recipeTitle);
                  const mins = recipeMinutes(meal.recipeTitle, meal.recipeNotes);
                  return (
                    <li key={mealType} className="planning-slot-row">
                      {reorderControls}
                      <button
                        type="button"
                        className="planning-slot"
                        onClick={() => {
                          if (reorderMode) return;
                          openEditMeal(meal);
                        }}
                        disabled={reorderMode}
                      >
                        <span
                          className="planning-slot-thumb"
                          style={{ background: DISH_PASTEL[dish] }}
                          aria-hidden
                        >
                          <DishIllo dish={dish} className="planning-slot-illo" alt="" />
                        </span>
                        <span className="planning-slot-body">
                          <span className="planning-slot-meal">{label}</span>
                          <span className="planning-slot-name">
                            {meal.recipeTitle}{' '}
                            <HouseholdBadge visibility={meal.planVisibility} />
                          </span>
                        </span>
                        {mins != null ? (
                          <span className="planning-slot-time">
                            <IconClock />
                            {formatMinutes(mins)}
                          </span>
                        ) : (
                          <span className="planning-slot-time planning-slot-time-empty" />
                        )}
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={mealType} className="planning-slot-row">
                    {reorderControls}
                    <button
                      type="button"
                      className="planning-slot-empty"
                      onClick={() => {
                        if (reorderMode) return;
                        openAddSlot(selectedDay.date, mealType);
                      }}
                      disabled={reorderMode}
                    >
                      <IconPlus />
                      <span>Ajouter un {label.toLowerCase()}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        ) : (
          <p className="empty">Aucun jour sélectionné.</p>
        )}
      </section>
    </PullToRefresh>
  );
}
