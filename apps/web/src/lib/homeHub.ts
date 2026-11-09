import { todayIsoDate, toIsoDate } from './planDates';

/** Keys aligned with DishIllos — kept here to avoid SVG imports in unit tests. */
export const HOME_DISH_KEYS = ['carbonara', 'fondant', 'poulet', 'salade', 'soupe'] as const;
export type HomeDishKey = (typeof HOME_DISH_KEYS)[number];

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

export type WeekDayChip = {
  label: (typeof DAY_LABELS)[number];
  date: string;
  dayNum: number;
  isToday: boolean;
};

/** Semaine calendaire FR (lundi → dimanche). */
export function startOfWeekMonday(iso = todayIsoDate()): Date {
  const d = new Date(`${iso}T12:00:00`);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

export function weekDayStrip(today = todayIsoDate()): WeekDayChip[] {
  const start = startOfWeekMonday(today);
  return DAY_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = toIsoDate(d);
    return {
      label,
      date,
      dayNum: d.getDate(),
      isToday: date === today,
    };
  });
}

/** Bonjour / Bonsoir selon l’heure locale + prénom (1er mot du displayName). */
export function homeGreeting(
  displayName: string | undefined,
  now = new Date(),
): { hello: string; firstName: string; title: string; subtitle: string } {
  const firstName = (displayName ?? '').trim().split(/\s+/)[0] || 'toi';
  const hour = now.getHours();
  const hello = hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
  return {
    hello,
    firstName,
    title: `${hello} ${firstName}`,
    subtitle: "Qu'est-ce qu'on mange ce soir ?",
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
