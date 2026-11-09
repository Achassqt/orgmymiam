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
  const rounded = roundQty(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Arrondi stable pour quantités affichées / stockées. */
export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Recalcule une quantité quand on change le nombre de personnes de référence. */
export function scaleQuantity(
  quantity: number,
  fromServings: number,
  toServings: number,
): number {
  const from = fromServings > 0 ? fromServings : 1;
  const to = toServings > 0 ? toServings : 1;
  if (from === to) return roundQty(quantity);
  return roundQty((quantity * to) / from);
}
