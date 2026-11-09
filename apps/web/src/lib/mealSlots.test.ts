import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MealSlot } from '@orgmymiam/shared';
import { mealSlotKey, upsertMealSlot } from './mealSlots.js';

function slot(
  partial: Partial<MealSlot> & Pick<MealSlot, 'id' | 'date' | 'mealType' | 'recipeId'>,
): MealSlot {
  return {
    servingsOverride: null,
    ...partial,
  };
}

describe('mealSlotKey', () => {
  it('compose date + mealType + recipeId', () => {
    assert.equal(
      mealSlotKey({ date: '2026-11-09', mealType: 'diner', recipeId: 'r1' }),
      '2026-11-09|diner|r1',
    );
  });
});

describe('upsertMealSlot', () => {
  it('ajoute un créneau distinct', () => {
    const a = slot({ id: 'a', date: '2026-11-09', mealType: 'diner', recipeId: 'r1' });
    const next = upsertMealSlot([a], {
      id: 'b',
      date: '2026-11-10',
      mealType: 'diner',
      recipeId: 'r1',
      servingsOverride: 2,
    });
    assert.equal(next.length, 2);
    assert.equal(next[1]?.id, 'b');
  });

  it('fusionne un doublon exact à l’ajout', () => {
    const a = slot({
      id: 'a',
      date: '2026-11-09',
      mealType: 'diner',
      recipeId: 'r1',
      servingsOverride: 2,
    });
    const next = upsertMealSlot([a], {
      id: 'b',
      date: '2026-11-09',
      mealType: 'diner',
      recipeId: 'r1',
      servingsOverride: 4,
    });
    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, 'a');
    assert.equal(next[0]?.servingsOverride, 4);
  });

  it('fusionne si l’édition crée un doublon exact', () => {
    const a = slot({ id: 'a', date: '2026-11-09', mealType: 'diner', recipeId: 'r1' });
    const b = slot({ id: 'b', date: '2026-11-10', mealType: 'diner', recipeId: 'r2' });
    const next = upsertMealSlot(
      [a, b],
      {
        date: '2026-11-09',
        mealType: 'diner',
        recipeId: 'r1',
        servingsOverride: 3,
      },
      'b',
    );
    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, 'a');
    assert.equal(next[0]?.servingsOverride, 3);
  });

  it('conserve l’id édité si la clé change sans collision', () => {
    const a = slot({ id: 'a', date: '2026-11-09', mealType: 'diner', recipeId: 'r1' });
    const next = upsertMealSlot(
      [a],
      {
        date: '2026-11-11',
        mealType: 'dejeuner',
        recipeId: 'r1',
        servingsOverride: null,
      },
      'a',
    );
    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, 'a');
    assert.equal(next[0]?.date, '2026-11-11');
    assert.equal(next[0]?.mealType, 'dejeuner');
  });
});
