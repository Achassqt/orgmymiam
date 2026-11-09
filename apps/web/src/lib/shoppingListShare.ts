import type { ShoppingListItem } from '@orgmymiam/shared';
import { groupItemsByCategory } from '../data/shoppingList';
import { formatQuantity } from './units';

/** Texte checklist lisible, groupé par catégorie, pour partage / presse-papiers. */
export function formatShoppingListShareText(
  title: string,
  items: ShoppingListItem[],
): string {
  const groups = groupItemsByCategory(items);
  const lines: string[] = [title, ''];

  for (const group of groups) {
    lines.push(group.label);
    for (const item of group.items) {
      const box = item.checked ? '[x]' : '[ ]';
      lines.push(`${box} ${item.nameSnapshot} — ${formatQuantity(item.quantity, item.unit)}`);
    }
    lines.push('');
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
