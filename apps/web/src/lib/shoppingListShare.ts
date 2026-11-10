import type { ShoppingListItem } from '@orgmymiam/shared';
import { formatPlanDate } from './planDates';
import { formatQuantity } from './units';

export function shoppingListTitleFromRange(rangeFrom: string, rangeTo: string): string {
  if (rangeFrom === rangeTo) {
    return `Courses · ${formatPlanDate(rangeFrom)}`;
  }
  return `Courses · ${formatPlanDate(rangeFrom)} → ${formatPlanDate(rangeTo)}`;
}

/** Texte checklist plat (sans catégories) pour partage / presse-papiers. */
export function formatShoppingListShareText(
  title: string,
  items: ShoppingListItem[],
  notes?: string | null,
): string {
  const lines: string[] = [title];
  if (notes?.trim()) {
    lines.push(notes.trim());
  }
  lines.push('');

  for (const item of items) {
    const box = item.checked ? '[x]' : '[ ]';
    const note = item.note?.trim() ? ` · ${item.note.trim()}` : '';
    lines.push(`${box} ${item.nameSnapshot} · ${formatQuantity(item.quantity, item.unit)}${note}`);
  }

  return lines.join('\n').trimEnd();
}

export function formatPrintDate(date = new Date()): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
