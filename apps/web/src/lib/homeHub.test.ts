import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatMinutes,
  homeGreeting,
  pickDishIllo,
  recipeMinutes,
  startOfWeekMonday,
  weekDayStrip,
  weekTileBadge,
} from './homeHub';
import { toIsoDate } from './planDates';

describe('homeHub', () => {
  it('greeting uses Bonsoir after 18h and first name', () => {
    const g = homeGreeting('Sacha Quentin', new Date('2026-11-09T19:30:00'));
    assert.equal(g.hello, 'Bonsoir');
    assert.equal(g.firstName, 'Sacha');
    assert.equal(g.title, 'Bonsoir Sacha');
    assert.match(g.subtitle, /ce soir/);
  });

  it('greeting uses Bonjour daytime', () => {
    const g = homeGreeting('Alex', new Date('2026-11-09T11:00:00'));
    assert.equal(g.title, 'Bonjour Alex');
  });

  it('week strip is Mon–Sun with today flagged', () => {
    // 2026-11-09 is a Monday
    const days = weekDayStrip('2026-11-09');
    assert.equal(days.length, 7);
    assert.equal(days[0].label, 'L');
    assert.equal(days[0].date, '2026-11-09');
    assert.equal(days[0].isToday, true);
    assert.equal(days[6].label, 'D');
    assert.equal(days[6].date, '2026-11-15');
    const start = startOfWeekMonday('2026-11-12');
    assert.equal(toIsoDate(start), '2026-11-09');
  });

  it('pickDishIllo maps keywords and badges', () => {
    assert.equal(pickDishIllo('Pâtes carbonara'), 'carbonara');
    assert.equal(pickDishIllo('Poulet rôti aux légumes'), 'poulet');
    assert.equal(pickDishIllo('Salade de lentilles'), 'salade');
    assert.equal(pickDishIllo('Fondant au chocolat'), 'fondant');
    assert.equal(weekTileBadge('fondant').kind, 'star');
    assert.equal(weekTileBadge('salade').tone, 'sage');
  });

  it('recipeMinutes parses notes or title heuristics', () => {
    assert.equal(recipeMinutes('Soup', 'Cuisson 35 min environ'), 35);
    assert.equal(recipeMinutes('Pâtes carbonara', ''), 20);
    assert.equal(formatMinutes(20), '20 min');
    assert.equal(recipeMinutes('Plat mystère', ''), null);
  });
});
