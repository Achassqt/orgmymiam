import { COMMON_UNITS, type CommonUnit } from '@orgmymiam/shared';

/** Libellés affichés (données inchangées : « unité » reste la valeur stockée). */
export const UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  L: 'L',
  unité: 'pièce',
  botte: 'botte',
  boîte: 'boîte',
  paquet: 'paquet',
};

export const UNIT_OPTIONS: Array<{ value: string; label: string }> = COMMON_UNITS.map((unit) => ({
  value: unit,
  label: UNIT_LABELS[unit] ?? unit,
}));

export function isCommonUnit(value: string): value is CommonUnit {
  return (COMMON_UNITS as readonly string[]).includes(value);
}

export function unitDisplayLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}

/** Affichage lisible : « 400 g », « 2 pièces ». */
export function formatQuantity(quantity: number, unit: string): string {
  const qty = formatQtyNumber(quantity);
  const label = unitDisplayLabel(unit);
  if (unit === 'unité' || label === 'pièce') {
    return Number(quantity) === 1 ? `${qty} pièce` : `${qty} pièces`;
  }
  return `${qty} ${label}`;
}

/** Phrase type « 400 g de pâtes » / « 2 pièces de tomates ». */
export function formatQuantityOf(quantity: number, unit: string, name: string): string {
  return `${formatQuantity(quantity, unit)} de ${name}`;
}

function formatQtyNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
