import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { EmptyState } from '../components/EmptyState';
import { DecorDots, IlloBurger } from '../components/FoodIllos';
import { PullToRefresh } from '../components/PullToRefresh';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';
import { useHousehold } from '../hooks/useHousehold';
import { formatPlanDate, todayIsoDate } from '../lib/planDates';

export function HomePage() {
  const { session } = useAuth();
  const { isMember } = useHousehold();
  const userId = session?.user._id;
  const today = todayIsoDate();
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

  const nextMeals = useLiveQuery(async () => {
    if (!userId) return [];
    const plans = await db.mealPlans.filter((p) => p.deletedAt == null).toArray();
    const recipes = await db.recipes.filter((r) => r.deletedAt == null).toArray();
    const titleById = Object.fromEntries(recipes.map((r) => [r._id, r.title]));
    const slots = plans
      .flatMap((plan) =>
        plan.slots.map((slot) => ({
          ...slot,
          planId: plan._id,
          planTitle: plan.title,
          planVisibility: plan.visibility,
          recipeTitle: titleById[slot.recipeId] ?? 'Recette',
        })),
      )
      .filter((slot) => slot.date >= today)
      .sort((a, b) =>
        a.date === b.date ? a.mealType.localeCompare(b.mealType) : a.date.localeCompare(b.date),
      )
      .slice(0, 3);
    return slots;
  }, [today, userId]);

  const latestList = openLists[0] ?? null;
  const nextMeal = nextMeals?.[0] ?? null;
  const checked = latestList ? latestList.items.filter((i) => i.checked).length : 0;
  const total = latestList?.items.length ?? 0;

  return (
    <PullToRefresh>
      <section className="page-section home-hub page-enter">
        <header className="home-hero panel-yellow">
          <DecorDots className="hero-decor" />
          <div className="home-hero-copy">
            <p className="brand home-brand">OrgMyMiam</p>
            <h1>Miam, on organise !</h1>
            <p className="lede">Recettes, planning, courses — tout en un coup d’œil.</p>
          </div>
          <div className="home-hero-illo float-soft" aria-hidden>
            <IlloBurger className="food-illo food-illo-lg" />
          </div>
        </header>

        <p className="home-foyer-cta">
          {isMember ? (
            <Link to="/foyer">Gérer mon foyer</Link>
          ) : (
            <Link to="/foyer">Créer ou rejoindre un foyer</Link>
          )}
        </p>

        <section className="home-block" aria-labelledby="next-meal-heading">
          <h2 id="next-meal-heading" className="subhead">
            Prochain repas
          </h2>
          {!nextMeals ? (
            <p className="empty">Chargement…</p>
          ) : nextMeal ? (
            <Link className="hub-card" to={`/plans?edit=${nextMeal.planId}`}>
              <span className="hub-card-kicker">
                {formatPlanDate(nextMeal.date, today)} ·{' '}
                {MEAL_TYPE_LABELS[nextMeal.mealType] ?? nextMeal.mealType}
              </span>
              <strong className="hub-card-title">
                {nextMeal.recipeTitle} <HouseholdBadge visibility={nextMeal.planVisibility} />
              </strong>
              <span className="meta">
                {nextMeal.servingsOverride != null ? `${nextMeal.servingsOverride} pers. · ` : ''}
                {nextMeal.planTitle}
              </span>
            </Link>
          ) : (
            <EmptyState
              illo="calendar"
              title="Aucun repas prévu"
              description={
                recipesCount === 0
                  ? 'Commence par une recette, puis place-la dans le planning.'
                  : 'Ajoute un créneau pour voir le prochain plat ici.'
              }
              action={
                <Link className="primary-btn" to={recipesCount === 0 ? '/recettes' : '/plans'}>
                  {recipesCount === 0 ? 'Ajouter une recette' : 'Ajouter un repas'}
                </Link>
              }
            />
          )}
        </section>

        <div className="hub-cta-row">
          <Link className="primary-btn hub-cta bounce-press" to="/liste">
            Faire mes courses
            {latestList && total > 0 ? (
              <span className="hub-cta-meta">
                {checked}/{total}
              </span>
            ) : null}
          </Link>
          <Link className="secondary-btn hub-cta bounce-press" to="/plans">
            Ajouter un repas
          </Link>
        </div>

        {latestList ? (
          <p className="home-list-hint">
            Liste ouverte : <Link to="/liste">{latestList.title}</Link>{' '}
            <HouseholdBadge visibility={latestList.visibility} />
          </p>
        ) : null}
      </section>
    </PullToRefresh>
  );
}
