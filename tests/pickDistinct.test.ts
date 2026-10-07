import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickDistinct } from '../src/data/pickDistinct.ts';

const pool = ['a', 'b', 'c', 'd', 'e'];

test('devuelve n elementos distintos y empieza por first', () => {
  for (let i = 0; i < 50; i++) {
    const r = pickDistinct(pool, 3, 'c');
    assert.equal(r.length, 3);
    assert.equal(r[0], 'c');
    assert.equal(new Set(r).size, 3);
  }
});

test('sin first elige solo del pool', () => {
  const r = pickDistinct(pool, 3);
  assert.equal(new Set(r).size, 3);
  assert.ok(r.every((x) => pool.includes(x)));
});

test('un pool pequeño devuelve lo que hay y no modifica el original', () => {
  const small = ['x', 'y'];
  assert.deepEqual(pickDistinct(small, 3, 'x').sort(), ['x', 'y']);
  assert.deepEqual(small, ['x', 'y']);
});

test('usa el generador inyectado', () => {
  assert.deepEqual(pickDistinct(pool, 3, undefined, () => 0), ['a', 'b', 'c']);
});
