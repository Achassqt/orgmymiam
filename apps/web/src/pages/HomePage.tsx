import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../auth/AuthProvider';
import { HouseholdBadge } from '../components/VisibilityToggle';
import { PullToRefresh } from '../components/PullToRefresh';
import { MEAL_TYPE_LABELS } from '../data/productSearch';
import { db } from '../db/database';
import { useHousehold } from '../hooks/useHousehold';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  return (
    <PullToRefresh>
      <section className="page-section">
        <h1>Accueil</h1>
        <p className="lede">Organise tes repas de la semaine et ta liste de courses.</p>

        <p className="home-foyer-cta">
          {isMember ? (
            <Link to="/foyer">Gérer mon foyer</Link>
          ) : (
            <Link to="/foyer">Créer ou rejoindre un foyer</Link>
          )}
        </p>

        <section className="home-block">
          <h2 className="subhead">Prochains repas</h2>
          {!nextMeals || nextMeals.length === 0 ? (
            <p className="empty">
              Aucun repas prévu — <Link to="/plans">crée un planning</Link>
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
                  <Link className="entity-main-btn" to={`/plans?edit=${slot.planId}`}>
                    <strong>
                      {slot.recipeTitle} <HouseholdBadge visibility={slot.planVisibility} />
                    </strong>
                    <span className="meta">
                      {slot.date} · {MEAL_TYPE_LABELS[slot.mealType] ?? slot.mealType}
                      {slot.servingsOverride != null ? ` · ${slot.servingsOverride} pers.` : ''}
                      {' · '}
                      {slot.planTitle}
                    </span>
                  </Link>
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
              <HouseholdBadge visibility={latestList.visibility} />
              <span className="meta">
                {' '}
                · {latestList.items.filter((i) => i.checked).length}/{latestList.items.length}{' '}
                cochés
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
    </PullToRefresh>
  );
}
