import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelCosts } from '../src/data/prices.ts';

test('multiplica cada nivel y redondea al múltiplo', () => {
  assert.deepEqual(levelCosts([100, 200, 350, 550, 800], [1, 1, 1, 1.5, 2], 10), [100, 200, 350, 830, 1600]);
  assert.deepEqual(levelCosts([80, 160, 280, 440, 650], [1, 1, 1, 1.5, 2], 10), [80, 160, 280, 660, 1300]);
});

test('sin multiplicador para un nivel usa 1 y nunca baja del redondeo', () => {
  assert.deepEqual(levelCosts([100, 200, 300], [2], 10), [200, 200, 300]);
  assert.deepEqual(levelCosts([1], [0.1], 10), [10]);
});

test('con redondeo 1 devuelve los enteros exactos', () => {
  assert.deepEqual(levelCosts([550], [1.5], 1), [825]);
});
