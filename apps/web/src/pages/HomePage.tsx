import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EmptyState } from '../components/EmptyState';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatMealDate(iso: string, today: string): string {
  if (iso === today) return 'Aujourd’hui';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === tomorrow.toISOString().slice(0, 10)) return 'Demain';
  return iso;
}

export function HomePage() {
  const today = todayIsoDate();
  const recipesCount =
    useLiveQuery(() => db.recipes.filter((r) => r.deletedAt == null).count(), []) ?? 0;
  const openLists =
    useLiveQuery(
      () =>
        db.shoppingLists
          .filter((l) => l.deletedAt == null && l.status === 'open')
          .reverse()
          .sortBy('updatedAt'),
      [],
    ) ?? [];

  const nextMeals = useLiveQuery(async () => {
    const plans = await db.mealPlans.filter((p) => p.deletedAt == null).toArray();
    const recipes = await db.recipes.filter((r) => r.deletedAt == null).toArray();
    const titleById = Object.fromEntries(recipes.map((r) => [r._id, r.title]));
    const slots = plans
      .flatMap((plan) =>
        plan.slots.map((slot) => ({
          ...slot,
          planId: plan._id,
          planTitle: plan.title,
          recipeTitle: titleById[slot.recipeId] ?? 'Recette',
        })),
      )
      .filter((slot) => slot.date >= today)
      .sort((a, b) =>
        a.date === b.date ? a.mealType.localeCompare(b.mealType) : a.date.localeCompare(b.date),
      )
      .slice(0, 3);
    return slots;
  }, [today]);

  const latestList = openLists[0] ?? null;
  const nextMeal = nextMeals?.[0] ?? null;
  const checked = latestList
    ? latestList.items.filter((i) => i.checked).length
    : 0;
  const total = latestList?.items.length ?? 0;

  return (
    <section className="page-section home-hub">
      <header className="home-hero">
        <p className="brand home-brand">OrgMyMiam</p>
        <h1>Ta semaine, sans prise de tête</h1>
        <p className="lede">Prochain repas, planning, courses — tout au même endroit.</p>
      </header>

      <section className="home-block" aria-labelledby="next-meal-heading">
        <h2 id="next-meal-heading" className="subhead">
          Prochain repas
        </h2>
        {!nextMeals ? (
          <p className="empty">Chargement…</p>
        ) : nextMeal ? (
          <Link className="hub-card" to={`/plans?edit=${nextMeal.planId}`}>
            <span className="hub-card-kicker">
              {formatMealDate(nextMeal.date, today)} ·{' '}
              {MEAL_TYPE_LABELS[nextMeal.mealType] ?? nextMeal.mealType}
            </span>
            <strong className="hub-card-title">{nextMeal.recipeTitle}</strong>
            <span className="meta">
              {nextMeal.servingsOverride != null
                ? `${nextMeal.servingsOverride} pers. · `
                : ''}
              {nextMeal.planTitle}
            </span>
          </Link>
        ) : (
          <EmptyState
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
        <Link className="primary-btn hub-cta" to="/liste">
          Faire mes courses
          {latestList && total > 0 ? (
            <span className="hub-cta-meta">
              {checked}/{total}
            </span>
          ) : null}
        </Link>
        <Link className="secondary-btn hub-cta" to="/plans">
          Ajouter un repas
        </Link>
      </div>

      {latestList ? (
        <p className="home-list-hint">
          Liste ouverte : <Link to="/liste">{latestList.title}</Link>
        </p>
      ) : null}
    </section>
  );
}
