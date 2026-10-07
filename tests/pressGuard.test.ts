import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPressGuard } from '../src/game/core/PressGuard.ts';

function clock() {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test('un pointerdown seguido de un click emulado (mismo instante) solo cuenta una vez', () => {
  const c = clock();
  const guard = createPressGuard(300, c.now);
  assert.equal(guard.accept(), true);
  c.advance(5);
  assert.equal(guard.accept(), false);
});

test('dos botones con el mismo gesto: el segundo se ignora', () => {
  const c = clock();
  const guard = createPressGuard(300, c.now);
  assert.equal(guard.accept(), true); // botón 1
  c.advance(40);
  assert.equal(guard.accept(), false); // botón 2, mismo gesto
});

test('pasado el bloqueo (300 ms) vuelve a aceptar', () => {
  const c = clock();
  const guard = createPressGuard(300, c.now);
  assert.equal(guard.accept(), true);
  c.advance(299);
  assert.equal(guard.accept(), false);
  c.advance(1);
  assert.equal(guard.accept(), true);
});

test('una pulsación rechazada no alarga el bloqueo', () => {
  const c = clock();
  const guard = createPressGuard(300, c.now);
  guard.accept();
  c.advance(200);
  assert.equal(guard.accept(), false);
  c.advance(100);
  assert.equal(guard.accept(), true);
});
