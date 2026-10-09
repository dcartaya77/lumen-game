import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureMatch } from '../src/data/ensureMatch.ts';
import { levelRegressions, tweakLevels, type TweakableLevel } from '../src/data/heroTweak.ts';

const L = (o: Partial<TweakableLevel> = {}): TweakableLevel => ({ dmg: 10, cooldown: 0.5, count: 1, speed: 2, pierce: 1, size: 1, duration: 0, ...o });

test('tweakLevels multiplica, suma y no toca el original', () => {
  const base = [L(), L({ dmg: 20, count: 2 })];
  const out = tweakLevels(base, { mult: { dmg: 1.5, cooldown: 0.8 }, add: { count: 2 } });
  assert.deepEqual(out.map((l) => [l.dmg, l.cooldown, l.count]), [[15, 0.4, 3], [30, 0.4, 4]]);
  assert.equal(base[0]!.dmg, 10);
  assert.equal(out[0]!.speed, 2);
});

test('tweakLevels sin ajuste devuelve copias iguales', () => {
  const base = [L(), L({ dmg: 12 })];
  assert.deepEqual(tweakLevels(base, {}), base);
});

test('ensureMatch no cambia nada si ya hay uno que cumple', () => {
  assert.deepEqual(ensureMatch(['a', 'b', 'c'], ['a', 'b', 'c', 'x'], (x) => x === 'b'), ['a', 'b', 'c']);
});

test('ensureMatch sustituye uno por un candidato del pool', () => {
  for (let i = 0; i < 30; i++) {
    const r = ensureMatch(['a', 'b', 'c'], ['a', 'b', 'c', 'x', 'y'], (v) => v === 'x' || v === 'y');
    assert.equal(r.length, 3);
    assert.ok(r.some((v) => v === 'x' || v === 'y'));
    assert.equal(new Set(r).size, 3);
  }
});

test('ensureMatch sin candidatos devuelve lo mismo', () => {
  assert.deepEqual(ensureMatch(['a', 'b'], ['a', 'b'], (v) => v === 'z'), ['a', 'b']);
  assert.deepEqual(ensureMatch([], ['x'], () => true), []);
});

test('tweakLevels admite un valor por nivel y repite el último', () => {
  const base = [L(), L(), L(), L()];
  const out = tweakLevels(base, { mult: { dmg: [2, 1.5, 1] }, add: { count: [3, 2] } });
  assert.deepEqual(out.map((l) => l.dmg), [20, 15, 10, 10]);
  assert.deepEqual(out.map((l) => l.count), [4, 3, 3, 3]);
});

test('levelRegressions detecta niveles que empeoran', () => {
  assert.deepEqual(levelRegressions([L(), L({ dmg: 12, count: 2, cooldown: 0.4 })]), []);
  const errs = levelRegressions([L({ dmg: 20 }), L({ dmg: 15, cooldown: 0.6 })]);
  assert.equal(errs.length, 2);
});
