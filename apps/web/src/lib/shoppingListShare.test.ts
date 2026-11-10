import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ShoppingListItem } from '@orgmymiam/shared';
import {
  formatShoppingListShareText,
  sanitizeUiEmDash,
  shoppingListTitleFromRange,
} from './shoppingListShare';

function item(partial: Partial<ShoppingListItem> & Pick<ShoppingListItem, 'nameSnapshot'>): ShoppingListItem {
  return {
    id: crypto.randomUUID(),
    productId: crypto.randomUUID(),
    productSource: 'user',
    quantity: 1,
    unit: 'unité',
    category: 'autres',
    origin: 'extra',
    checked: false,
    checkedAt: null,
    updatedAt: new Date().toISOString(),
    note: '',
    ...partial,
  };
}

describe('formatShoppingListShareText', () => {
  it('renders a flat checklist without categories', () => {
    const text = formatShoppingListShareText(
      'Courses · Aujourd’hui',
      [
        item({ nameSnapshot: 'Pain', quantity: 1, unit: 'pièce', category: 'boulangerie' }),
        item({
          nameSnapshot: 'Lait',
          quantity: 2,
          unit: 'L',
          category: 'produits_laitiers',
          note: 'demi-écrémé',
          checked: true,
        }),
      ],
      'Week-end',
    );

    assert.match(text, /^Courses · Aujourd’hui/);
    assert.match(text, /Week-end/);
    assert.match(text, /\[ \] Pain/);
    assert.match(text, /\[x\] Lait/);
    assert.match(text, /demi-écrémé/);
    assert.doesNotMatch(text, /Boulangerie|Frais|Autres/i);
  });
});

describe('shoppingListTitleFromRange', () => {
  it('builds a title for a single day and a range', () => {
    const one = shoppingListTitleFromRange('2099-01-05', '2099-01-05');
    const range = shoppingListTitleFromRange('2099-01-05', '2099-01-19');
    assert.match(one, /^Courses · /);
    assert.match(range, /→/);
  });
});

describe('sanitizeUiEmDash', () => {
  it('replaces legacy em dashes in list titles', () => {
    assert.equal(
      sanitizeUiEmDash('Courses — lun. 9 nov. → mar. 24 nov.'),
      'Courses · lun. 9 nov. → mar. 24 nov.',
    );
    assert.equal(sanitizeUiEmDash('Courses · Aujourd’hui'), 'Courses · Aujourd’hui');
    assert.doesNotMatch(sanitizeUiEmDash('A — B — C'), /—/);
  });
});
