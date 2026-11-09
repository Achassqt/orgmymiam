/** Dates de planning affichées en français (cohérent Accueil / éditeur). */

const FR_SHORT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
};

export function todayIsoDate(now = new Date()): string {
  return toIsoDate(now);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Affiche « Aujourd’hui » / « Demain » / « lun. 9 nov. ». */
export function formatPlanDate(iso: string, today = todayIsoDate()): string {
  if (iso === today) return 'Aujourd’hui';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === toIsoDate(tomorrow)) return 'Demain';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('fr-FR', FR_SHORT);
}
