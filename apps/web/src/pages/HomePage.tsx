import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { DISH_PASTEL, DishIllo } from '../components/DishIllos';
import { PullToRefresh } from '../components/PullToRefresh';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';
import { useHousehold } from '../hooks/useHousehold';
import {
  formatMinutes,
  homeGreeting,
  mealTypeOrder,
  nextMealBadgeLabel,
  pickDishIllo,
  pickNextMealByTime,
  recipeMinutes,
  weekDayStrip,
  weekTileBadge,
} from '../lib/homeHub';
import { todayIsoDate } from '../lib/planDates';

function IconClock({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
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

function IconChevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBasket() {
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

function IconLeaf() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

type HubMeal = {
  slotId: string;
  planId: string;
  date: string;
  mealType: string;
  recipeId: string;
  recipeTitle: string;
  recipeNotes: string;
  planVisibility: 'private' | 'household';
  servingsOverride: number | null;
};

export function HomePage() {
  const { session } = useAuth();
  const { isMember } = useHousehold();
  const userId = session?.user._id;
  const today = todayIsoDate();
  const days = useMemo(() => weekDayStrip(today), [today]);
  const [selectedDate, setSelectedDate] = useState(today);

  const recipesCount =
    useLiveQuery(
      () => (userId ? db.recipes.filter((r) => r.deletedAt == null).count() : 0),
      [userId],
    ) ?? 0;

  const openLists =
    useLiveQuery(
      () =>
        userId
          ? db.shoppingLists
              .filter((l) => l.deletedAt == null && l.status === 'open')
              .reverse()
              .sortBy('updatedAt')
          : [],
      [userId],
    ) ?? [];

  const weekMeals = useLiveQuery(async () => {
    if (!userId) return [] as HubMeal[];
    const weekDates = new Set(weekDayStrip(today).map((d) => d.date));
    const plans = await db.mealPlans.filter((p) => p.deletedAt == null).toArray();
    const recipes = await db.recipes.filter((r) => r.deletedAt == null).toArray();
    const recipeById = Object.fromEntries(recipes.map((r) => [r._id, r]));

    const slots: HubMeal[] = plans
      .flatMap((plan) =>
        plan.slots
          .filter((slot) => weekDates.has(slot.date))
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
              servingsOverride: slot.servingsOverride,
            };
          }),
      )
      .sort((a, b) =>
        a.date === b.date
          ? mealTypeOrder(a.mealType) - mealTypeOrder(b.mealType)
          : a.date.localeCompare(b.date),
      );

    return slots;
  }, [today, userId]);

  const latestList = openLists[0] ?? null;
  const checked = latestList ? latestList.items.filter((i) => i.checked).length : 0;
  const total = latestList?.items.length ?? 0;
  const remaining = Math.max(0, total - checked);
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  const meals = weekMeals ?? [];
  const nextMeal = pickNextMealByTime(meals);
  const selectedMeals = meals
    .filter((m) => m.date === selectedDate)
    .sort((a, b) => mealTypeOrder(a.mealType) - mealTypeOrder(b.mealType));

  const nextDish = nextMeal ? pickDishIllo(nextMeal.recipeTitle) : null;
  const nextMins = nextMeal
    ? recipeMinutes(nextMeal.recipeTitle, nextMeal.recipeNotes)
    : null;
  const nextBadge = nextMeal ? nextMealBadgeLabel(nextMeal, today) : '';
  const greeting = homeGreeting(session?.user.displayName, new Date(), nextMeal, today);

  return (
    <PullToRefresh>
      <section className="page-section home-accueil page-enter">
        <div className="home-greeting">
          <h1 className="home-greeting-title">{greeting.title}</h1>
          <p className="home-greeting-sub">{greeting.subtitle}</p>
        </div>
        {!weekMeals ? (
          <p className="empty">Chargement…</p>
        ) : nextMeal && nextDish ? (
          <Link
            className="home-tonight"
            to={`/plans?edit=${nextMeal.planId}`}
            aria-labelledby="tonight-title"
          >
            <DishIllo
              dish={nextDish}
              className="home-tonight-illo"
              alt=""
            />
            <span className="home-tonight-badge">{nextBadge}</span>
            <strong id="tonight-title" className="home-tonight-title">
              {nextMeal.recipeTitle}{' '}
              <HouseholdBadge visibility={nextMeal.planVisibility} />
            </strong>
            {nextMins != null ? (
              <span className="home-tonight-time">
                <IconClock size={16} color="#1F3D2B" />
                {formatMinutes(nextMins)}
              </span>
            ) : nextMeal.servingsOverride != null ? (
              <span className="home-tonight-time">{nextMeal.servingsOverride} pers.</span>
            ) : (
              <span className="home-tonight-time home-tonight-time-spacer" aria-hidden />
            )}
          </Link>
        ) : (
          <div className="home-tonight-empty home-tonight-empty-compact">
            <p className="home-empty-title">Rien de prévu pour l’instant</p>
            <p className="home-empty-desc">
              {recipesCount === 0
                ? 'Crée une recette, puis place-la dans le planning.'
                : 'Planifie un repas pour le voir ici.'}
            </p>
            <Link className="primary-btn" to={recipesCount === 0 ? '/recettes' : '/plans'}>
              {recipesCount === 0 ? 'Ajouter une recette' : 'Planifier un repas'}
            </Link>
          </div>
        )}

        <section className="home-week-section" aria-labelledby="week-heading">
          <div className="home-section-head">
            <h2 id="week-heading" className="home-section-title">
              Cette semaine
            </h2>
            <Link className="home-see-all" to="/plans">
              Voir tout
              <IconChevron />
            </Link>
          </div>

          <div className="home-week-strip" role="tablist" aria-label="Jours de la semaine">
            {days.map((day) => {
              const active = day.date === selectedDate;
              return (
                <button
                  key={day.date}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'home-week-day is-active' : 'home-week-day'}
                  onClick={() => setSelectedDate(day.date)}
                >
                  <span className="home-week-label">{day.label}</span>
                  <span className="home-week-num">{day.dayNum}</span>
                </button>
              );
            })}
          </div>

          {selectedMeals.length > 0 ? (
            <ul className="home-week-tiles">
              {selectedMeals.map((meal) => {
                const dish = pickDishIllo(meal.recipeTitle);
                const mins = recipeMinutes(meal.recipeTitle, meal.recipeNotes);
                const badge = weekTileBadge(dish);
                return (
                  <li key={meal.slotId}>
                    <Link className="home-week-tile" to={`/plans?edit=${meal.planId}`}>
                      <div
                        className="home-week-tile-illo"
                        style={{ background: DISH_PASTEL[dish] }}
                      >
                        <DishIllo dish={dish} className="home-week-tile-svg" alt="" />
                      </div>
                      <span
                        className={
                          badge.tone === 'terra'
                            ? 'home-week-tile-badge is-terra'
                            : 'home-week-tile-badge is-sage'
                        }
                      >
                        {badge.kind === 'star' ? <IconStar /> : <IconLeaf />}
                      </span>
                      <div className="home-week-tile-body">
                        <span className="home-week-tile-name">{meal.recipeTitle}</span>
                        {mins != null ? (
                          <span className="home-week-tile-time">
                            <IconClock size={13} color="#6B7368" />
                            {formatMinutes(mins)}
                          </span>
                        ) : (
                          <span className="home-week-tile-time">
                            {MEAL_TYPE_LABELS[meal.mealType] ?? meal.mealType}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="home-week-empty">
              Pas encore de repas ce jour.{' '}
              <Link to="/plans">Ouvrir le planning</Link>
            </p>
          )}
        </section>

        {latestList && total > 0 ? (
          <Link className="home-courses" to="/liste" aria-label="Ouvrir les courses">
            <span className="home-courses-basket" aria-hidden>
              <IconBasket />
            </span>
            <span className="home-courses-info">
              <span className="home-courses-title">
                Courses · <span className="home-courses-count">{checked}/{total} articles</span>
              </span>
              <span className="home-courses-sub">
                {remaining === 0
                  ? 'Liste terminée'
                  : remaining === 1
                    ? 'Plus qu’1 article'
                    : `Plus que ${remaining} articles`}
              </span>
              <span className="home-courses-track" aria-hidden>
                <span className="home-courses-fill" style={{ width: `${progress}%` }} />
              </span>
            </span>
            <span className="home-courses-chevron" aria-hidden>
              <IconChevron />
            </span>
          </Link>
        ) : (
          <Link className="home-courses home-courses-empty" to="/liste">
            <span className="home-courses-basket" aria-hidden>
              <IconBasket />
            </span>
            <span className="home-courses-info">
              <span className="home-courses-title">Courses</span>
              <span className="home-courses-sub">Créer ou ouvrir une liste</span>
            </span>
            <span className="home-courses-chevron" aria-hidden>
              <IconChevron />
            </span>
          </Link>
        )}

        <p className="home-foyer-cta">
          {isMember ? (
            <Link to="/foyer">Gérer mon foyer</Link>
          ) : (
            <Link to="/foyer">Créer ou rejoindre un foyer</Link>
          )}
        </p>
      </section>
    </PullToRefresh>
  );
}
