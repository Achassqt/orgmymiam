import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPlanDate, toIsoDate } from './planDates.js';

describe('formatPlanDate', () => {
  it('renvoie Aujourd’hui et Demain', () => {
    const today = '2026-11-09';
    assert.equal(formatPlanDate('2026-11-09', today), 'Aujourd’hui');
    assert.equal(formatPlanDate('2026-11-10', today), 'Demain');
  });

  it('formate les autres jours en fr-FR court', () => {
    const label = formatPlanDate('2026-11-12', '2026-11-09');
    assert.match(label, /jeu\.?\s*12\s*nov\.?/i);
  });

  it('toIsoDate est local YYYY-MM-DD', () => {
    assert.equal(toIsoDate(new Date(2026, 10, 9, 15, 30)), '2026-11-09');
  });
});
