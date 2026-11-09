import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

  return (
    <section className="page-section">
      <h1>Accueil</h1>
      <p className="lede">Organise tes repas de la semaine et ta liste de courses.</p>

      <section className="home-block">
        <h2 className="subhead">Prochains repas</h2>
        {!nextMeals || nextMeals.length === 0 ? (
          <p className="empty">
            Aucun repas prévu —{' '}
            <Link to="/plans">crée un planning</Link>
            {recipesCount === 0 ? (
              <>
                {' '}
                ou <Link to="/recettes">ajoute une recette</Link>
              </>
            ) : null}
            .
          </p>
        ) : (
          <ul className="entity-list">
            {nextMeals.map((slot) => (
              <li key={slot.id}>
                <div>
                  <strong>{slot.recipeTitle}</strong>
                  <span className="meta">
                    {slot.date} · {MEAL_TYPE_LABELS[slot.mealType] ?? slot.mealType}
                    {slot.servingsOverride != null ? ` · ${slot.servingsOverride} pers.` : ''}
                    {' · '}
                    {slot.planTitle}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="quick-links">
          <Link to="/plans">Voir le planning</Link>
          <Link to="/recettes">Mes recettes</Link>
        </div>
      </section>

      <section className="home-block">
        <h2 className="subhead">Liste de courses</h2>
        {latestList ? (
          <p className="home-highlight">
            <Link to="/liste">{latestList.title}</Link>
            <span className="meta">
              {' '}
              · {latestList.items.filter((i) => i.checked).length}/{latestList.items.length} cochés
            </span>
          </p>
        ) : (
          <p className="empty">
            Pas de liste ouverte — <Link to="/liste">génère-en une depuis un plan</Link>.
          </p>
        )}
        <div className="quick-links">
          <Link to="/liste">Ouvrir les courses</Link>
          <Link to="/produits">Mes produits</Link>
        </div>
      </section>
    </section>
  );
}
