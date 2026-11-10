import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLANNING_MEAL_TYPES,
  addDaysIso,
  formatMinutes,
  formatWeekSubtitle,
  homeGreeting,
  nextMealBadgeLabel,
  pickDishIllo,
  pickNextMealByTime,
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
    assert.match(g.subtitle, /On mange quoi ce soir/);
  });

  it('greeting uses Bonjour daytime', () => {
    const g = homeGreeting('Alex', new Date('2026-11-09T11:00:00'));
    assert.equal(g.title, 'Bonjour Alex');
  });

  it('greeting subtitle follows next meal including demain', () => {
    const lunch = homeGreeting(
      'Sacha',
      new Date('2026-11-10T09:00:00'),
      { date: '2026-11-10', mealType: 'dejeuner' },
      '2026-11-10',
    );
    assert.equal(lunch.subtitle, 'On mange quoi ce midi ?');
    const tomorrow = homeGreeting(
      'Sacha',
      new Date('2026-11-10T21:00:00'),
      { date: '2026-11-11', mealType: 'diner' },
      '2026-11-10',
    );
    assert.equal(tomorrow.subtitle, 'On mange quoi demain soir ?');
  });

  it('week strip is Mon–Sun with today flagged', () => {
    // 2026-11-09 is a Monday
    const days = weekDayStrip('2026-11-09', '2026-11-09');
    assert.equal(days.length, 7);
    assert.equal(days[0].label, 'L');
    assert.equal(days[0].date, '2026-11-09');
    assert.equal(days[0].isToday, true);
    assert.equal(days[0].fullLabel, 'Lundi 9');
    assert.equal(days[6].label, 'D');
    assert.equal(days[6].date, '2026-11-15');
    const start = startOfWeekMonday('2026-11-12');
    assert.equal(toIsoDate(start), '2026-11-09');
  });

  it('week strip can show another week while keeping today flag', () => {
    const days = weekDayStrip('2026-11-16', '2026-11-09');
    assert.equal(days[0].date, '2026-11-16');
    assert.equal(days[0].isToday, false);
    assert.equal(formatWeekSubtitle('2026-11-09'), 'Semaine du 9 au 15 novembre');
    assert.equal(addDaysIso('2026-11-09', 7), '2026-11-16');
    assert.equal(addDaysIso('2026-11-09', -7), '2026-11-02');
  });

  it('formatWeekSubtitle crosses months', () => {
    // 2026-11-30 is Monday
    assert.equal(
      formatWeekSubtitle('2026-11-30'),
      'Semaine du 30 novembre au 6 décembre',
    );
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

  it('pickNextMealByTime picks upcoming meal by hour, not empty if later day', () => {
    const meals = [
      { date: '2026-11-10', mealType: 'dejeuner', id: 'lunch' },
      { date: '2026-11-10', mealType: 'diner', id: 'dinner' },
      { date: '2026-11-11', mealType: 'diner', id: 'tue' },
    ];
    const morning = pickNextMealByTime(meals, new Date('2026-11-10T09:00:00'));
    assert.equal(morning?.id, 'lunch');
    const afternoon = pickNextMealByTime(meals, new Date('2026-11-10T14:00:00'));
    assert.equal(afternoon?.id, 'dinner');
    const late = pickNextMealByTime(meals, new Date('2026-11-10T21:30:00'));
    assert.equal(late?.id, 'tue');
  });

  it('pickNextMealByTime skips empty today when a later meal exists', () => {
    const meals = [{ date: '2026-11-12', mealType: 'diner', id: 'wed' }];
    const next = pickNextMealByTime(meals, new Date('2026-11-10T11:00:00'));
    assert.equal(next?.id, 'wed');
    assert.equal(pickNextMealByTime([], new Date('2026-11-10T11:00:00')), null);
  });

  it('nextMealBadgeLabel covers today and other days', () => {
    assert.equal(
      nextMealBadgeLabel({ date: '2026-11-10', mealType: 'diner' }, '2026-11-10'),
      'Ce soir · Dîner',
    );
    assert.equal(
      nextMealBadgeLabel({ date: '2026-11-10', mealType: 'dejeuner' }, '2026-11-10'),
      'À midi · Déjeuner',
    );
    assert.match(
      nextMealBadgeLabel({ date: '2026-11-11', mealType: 'diner' }, '2026-11-10'),
      /Mercredi · Dîner/,
    );
    assert.equal(
      nextMealBadgeLabel({ date: '2026-11-10', mealType: 'petit_dejeuner' }, '2026-11-10'),
      'Ce matin · Petit-déj',
    );
    assert.equal(
      nextMealBadgeLabel({ date: '2026-11-10', mealType: 'collation' }, '2026-11-10'),
      'Cet après-midi · Goûter',
    );
  });

  it('PLANNING_MEAL_TYPES includes breakfast and snack in chrono order', () => {
    assert.deepEqual([...PLANNING_MEAL_TYPES], [
      'petit_dejeuner',
      'dejeuner',
      'collation',
      'diner',
    ]);
  });
});
