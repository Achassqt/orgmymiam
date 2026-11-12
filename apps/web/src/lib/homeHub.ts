import { todayIsoDate, toIsoDate } from './planDates';

/** Keys aligned with DishIllos - kept here to avoid SVG imports in unit tests. */
export const HOME_DISH_KEYS = ['carbonara', 'fondant', 'poulet', 'salade', 'soupe'] as const;
export type HomeDishKey = (typeof HOME_DISH_KEYS)[number];

/** Créneaux affichés pour le jour sélectionné (Planning). */
export const PLANNING_MEAL_TYPES = [
  'petit_dejeuner',
  'dejeuner',
  'collation',
  'diner',
  'en_cas',
] as const;
export type PlanningMealType = (typeof PLANNING_MEAL_TYPES)[number];

/** Normalise un ordre custom (persistance meta) vers la liste complète. */
export function normalizePlanningMealOrder(
  order: readonly string[] | null | undefined,
): PlanningMealType[] {
  const known = new Set<string>(PLANNING_MEAL_TYPES);
  const seen = new Set<string>();
  const next: PlanningMealType[] = [];
  for (const raw of order ?? []) {
    if (!known.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    next.push(raw as PlanningMealType);
  }
  for (const type of PLANNING_MEAL_TYPES) {
    if (!seen.has(type)) next.push(type);
  }
  return next;
}

export function movePlanningMealType(
  order: readonly PlanningMealType[],
  mealType: PlanningMealType,
  direction: -1 | 1,
): PlanningMealType[] {
  const list = [...order];
  const idx = list.indexOf(mealType);
  if (idx < 0) return list;
  const target = idx + direction;
  if (target < 0 || target >= list.length) return list;
  const tmp = list[idx]!;
  list[idx] = list[target]!;
  list[target] = tmp;
  return list;
}

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DAY_FULL = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

export type WeekDayChip = {
  label: (typeof DAY_LABELS)[number];
  date: string;
  dayNum: number;
  isToday: boolean;
  /** « Lundi 9 » - cartes jour Planning. */
  fullLabel: string;
};

/** Semaine calendaire FR (lundi → dimanche). */
export function startOfWeekMonday(iso = todayIsoDate()): Date {
  const d = new Date(`${iso}T12:00:00`);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

/** Décale une date ISO de N jours (midi local, stable DST). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/**
 * Strip L–D pour une semaine.
 * @param anchor jour quelconque de la semaine affichée
 * @param today référence « Aujourd’hui » (défaut : aujourd’hui)
 */
export function weekDayStrip(
  anchor = todayIsoDate(),
  today = todayIsoDate(),
): WeekDayChip[] {
  const start = startOfWeekMonday(anchor);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = toIsoDate(d);
    return {
      label,
      date,
      dayNum: d.getDate(),
      isToday: date === today,
      fullLabel: `${DAY_FULL[i]} ${d.getDate()}`,
    };
  });
}

/** « Semaine du 9 au 15 novembre » / croisement de mois. */
export function formatWeekSubtitle(anchorIso: string): string {
  const start = startOfWeekMonday(anchorIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString('fr-FR', { month: 'long' });
  const endMonth = end.toLocaleDateString('fr-FR', { month: 'long' });
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `Semaine du ${startDay} au ${endDay} ${endMonth}`;
  }
  return `Semaine du ${startDay} ${startMonth} au ${endDay} ${endMonth}`;
}

export type UpcomingMealLike = {
  date: string;
  mealType: string;
};

/** Moment de repas pour la phrase Accueil (« ce matin », « demain midi », …). */
export function mealMomentPhrase(
  meal: UpcomingMealLike | null | undefined,
  today = todayIsoDate(),
  now = new Date(),
): string {
  const slotPhrase = (mealType: string): string => {
    if (mealType === 'petit_dejeuner') return 'matin';
    if (mealType === 'dejeuner') return 'midi';
    if (mealType === 'collation') return 'après-midi';
    if (mealType === 'diner') return 'soir';
    if (mealType === 'en_cas') return 'en-cas';
    return 'prochain repas';
  };

  if (!meal) {
    const hour = now.getHours();
    if (hour < 11) return 'ce matin';
    if (hour < 15) return 'ce midi';
    if (hour < 18) return 'cet après-midi';
    return 'ce soir';
  }

  const slot = slotPhrase(meal.mealType);
  if (slot === 'prochain repas') return slot;

  if (meal.date === today) {
    if (slot === 'matin') return 'ce matin';
    if (slot === 'midi') return 'ce midi';
    if (slot === 'après-midi') return 'cet après-midi';
    if (slot === 'en-cas') return 'comme en-cas';
    return 'ce soir';
  }

  const tomorrow = addDaysIso(today, 1);
  if (meal.date === tomorrow) {
    if (slot === 'matin') return 'demain matin';
    if (slot === 'midi') return 'demain midi';
    if (slot === 'après-midi') return 'demain après-midi';
    if (slot === 'en-cas') return 'demain en-cas';
    return 'demain soir';
  }

  const d = new Date(`${meal.date}T12:00:00`);
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
  return `${weekday} ${slot === 'après-midi' ? 'après-midi' : slot}`;
}

/** « On mange quoi ce soir ? » selon le prochain repas (ou l’heure si vide). */
export function homeMealQuestion(
  meal?: UpcomingMealLike | null,
  today = todayIsoDate(),
  now = new Date(),
): string {
  return `On mange quoi ${mealMomentPhrase(meal, today, now)} ?`;
}

/** Bonjour / Bonsoir selon l’heure locale + prénom (1er mot du displayName). */
export function homeGreeting(
  displayName: string | undefined,
  now = new Date(),
  nextMeal?: UpcomingMealLike | null,
  today = todayIsoDate(),
): { hello: string; firstName: string; title: string; subtitle: string } {
  const firstName = (displayName ?? '').trim().split(/\s+/)[0] || 'toi';
  const hour = now.getHours();
  const hello = hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
  return {
    hello,
    firstName,
    title: `${hello} ${firstName}`,
    subtitle: homeMealQuestion(nextMeal, today, now),
  };
}

/** Illos plats d’après le titre (mots-clés) ; fallback stable. */
export function pickDishIllo(title: string): HomeDishKey {
  const t = title.toLowerCase();
  if (/carbonara|spaghetti|pâtes?|pates?|pasta|tagliatelle|penne/.test(t)) {
    return 'carbonara';
  }
  if (/fondant|chocolat|gâteau|gateau|dessert|brownie|mousse/.test(t)) {
    return 'fondant';
  }
  if (/poulet|rôti|roti|dinde|volaille/.test(t)) return 'poulet';
  if (/salade|lentille|feta|crudit|quinoa/.test(t)) return 'salade';
  if (/soupe|potage|velouté|veloute|bouillon/.test(t)) return 'soupe';

  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash + title.charCodeAt(i) * (i + 1)) % HOME_DISH_KEYS.length;
  }
  return HOME_DISH_KEYS[hash] ?? 'poulet';
}

/** Minutes : parse notes « N min », sinon heuristique titre, sinon null. */
export function recipeMinutes(
  title: string,
  notes?: string | null,
): number | null {
  const fromNotes = notes?.match(/(\d+)\s*min/i);
  if (fromNotes) return Number(fromNotes[1]);

  const t = title.toLowerCase();
  if (/carbonara/.test(t)) return 20;
  if (/poulet/.test(t)) return 45;
  if (/salade|lentille/.test(t)) return 30;
  if (/fondant|chocolat/.test(t)) return 25;
  if (/soupe|potage|velouté|veloute/.test(t)) return 35;
  return null;
}

export function formatMinutes(min: number): string {
  return `${min} min`;
}

/** Badge décoratif carte semaine (feuille sauge / étoile terra). */
export function weekTileBadge(
  dish: HomeDishKey,
): { kind: 'leaf' | 'star'; tone: 'sage' | 'terra' } {
  if (dish === 'fondant') return { kind: 'star', tone: 'terra' };
  return { kind: 'leaf', tone: 'sage' };
}

/** Heure typique de début (locale) pour classer / filtrer le prochain repas. */
export const MEAL_TYPE_HOUR: Record<string, number> = {
  petit_dejeuner: 8,
  dejeuner: 12,
  collation: 16,
  diner: 19,
  en_cas: 21,
};

const MEAL_TYPE_ORDER = [
  'petit_dejeuner',
  'dejeuner',
  'collation',
  'diner',
  'en_cas',
] as const;

export function mealTypeOrder(mealType: string): number {
  const idx = (MEAL_TYPE_ORDER as readonly string[]).indexOf(mealType);
  return idx >= 0 ? idx : 99;
}

/**
 * Prochain repas selon l’heure actuelle : ignore les créneaux déjà passés
 * aujourd’hui ; regarde ensuite les jours suivants de la semaine.
 */
export function pickNextMealByTime<T extends UpcomingMealLike>(
  meals: T[],
  now = new Date(),
): T | null {
  if (meals.length === 0) return null;
  const today = toIsoDate(now);
  const hour = now.getHours() + now.getMinutes() / 60;

  const upcoming = meals
    .filter((m) => {
      if (m.date > today) return true;
      if (m.date < today) return false;
      const mealHour = MEAL_TYPE_HOUR[m.mealType] ?? 12;
      // Encore « à venir » jusqu’à 1 h après l’heure typique.
      return hour < mealHour + 1;
    })
    .sort((a, b) =>
      a.date === b.date
        ? mealTypeOrder(a.mealType) - mealTypeOrder(b.mealType)
        : a.date.localeCompare(b.date),
    );

  return upcoming[0] ?? null;
}

/** Badge carte haut Accueil (« Ce soir · Dîner », « Mercredi · Déjeuner », …). */
export function nextMealBadgeLabel(
  meal: UpcomingMealLike,
  today = todayIsoDate(),
): string {
  const mealLabel =
    meal.mealType === 'petit_dejeuner'
      ? 'Petit-déj'
      : meal.mealType === 'dejeuner'
        ? 'Déjeuner'
        : meal.mealType === 'diner'
          ? 'Dîner'
          : meal.mealType === 'collation'
            ? 'Goûter'
            : meal.mealType === 'en_cas'
              ? 'En-cas'
              : meal.mealType;

  if (meal.date === today) {
    if (meal.mealType === 'diner') return `Ce soir · ${mealLabel}`;
    if (meal.mealType === 'dejeuner') return `À midi · ${mealLabel}`;
    if (meal.mealType === 'petit_dejeuner') return `Ce matin · ${mealLabel}`;
    if (meal.mealType === 'collation') return `Cet après-midi · ${mealLabel}`;
    if (meal.mealType === 'en_cas') return `En-cas · ${mealLabel}`;
    return `Prochain · ${mealLabel}`;
  }

  const d = new Date(`${meal.date}T12:00:00`);
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${dayName} · ${mealLabel}`;
}
