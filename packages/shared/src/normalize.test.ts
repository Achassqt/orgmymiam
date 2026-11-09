import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeProductName } from './normalize.ts';

describe('normalizeProductName', () => {
  it('translittère œ → oe (majuscule et minuscule)', () => {
    assert.equal(normalizeProductName('Œufs'), 'oeuf');
    assert.equal(normalizeProductName('œufs'), 'oeuf');
    assert.equal(normalizeProductName('oeufs'), 'oeuf');
  });

  it('fait correspondre recherche ascii et ligature pour les œufs', () => {
    const fromLigature = normalizeProductName('Œufs');
    const fromAscii = normalizeProductName('oeufs');
    const fromMixed = normalizeProductName('OEufs');
    assert.equal(fromLigature, fromAscii);
    assert.equal(fromLigature, fromMixed);
  });

  it('translittère œ au milieu d’un mot (bœuf)', () => {
    assert.equal(normalizeProductName('Bœuf'), 'boeuf');
    assert.equal(normalizeProductName('bœuf'), 'boeuf');
    assert.equal(normalizeProductName('boeuf'), 'boeuf');
    assert.equal(normalizeProductName('Bœuf à mijoter'), 'boeuf a mijoter');
  });

  it('translittère æ → ae', () => {
    assert.equal(normalizeProductName('Cæsar'), 'caesar');
    assert.equal(normalizeProductName('cæsar'), normalizeProductName('caesar'));
    assert.equal(normalizeProductName('Encyclopædia'), 'encyclopaedia');
  });

  it('conserve le comportement accents / casse / espaces', () => {
    assert.equal(normalizeProductName('  Lait demi-écrémé '), 'lait demi ecreme');
    assert.equal(normalizeProductName('TOMATES'), 'tomate');
  });

  it('ne laisse plus de trou à la place d’une ligature', () => {
    assert.notEqual(normalizeProductName('Œufs'), 'ufs');
    assert.notEqual(normalizeProductName('Bœuf'), 'b uf');
    assert.ok(!normalizeProductName('Bœuf').includes('  '));
  });
});
