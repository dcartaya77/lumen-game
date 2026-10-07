import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSave, SAVE_VERSION } from '../src/state/save-schema.ts';

const old = (v: number, campaign: Record<string, unknown>) => ({ v, campaign });

test('v4 con next > 10 conserva la segunda ranura (bit del jefe de la noche 5)', () => {
  const s = normalizeSave(old(4, { next: 12, stars: '', bosses: 0, tal: { 'nova:1': 1 }, eq: ['nova:1'] }), 'es');
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.campaign.bosses & 1, 1);
  assert.deepEqual(s.campaign.eq, ['nova:1']);
});

test('v4 con next <= 10 no regala la ranura', () => {
  const s = normalizeSave(old(4, { next: 10, bosses: 0 }), 'es');
  assert.equal(s.campaign.bosses & 1, 0);
});

test('la migración no pisa otros jefes ya derrotados', () => {
  const s = normalizeSave(old(4, { next: 16, bosses: 0b10 }), 'es');
  assert.equal(s.campaign.bosses, 0b11);
});

test('un guardado v3 sin campaña llega a v5 con valores por defecto', () => {
  const s = normalizeSave({ v: 3 }, 'es');
  assert.equal(s.v, SAVE_VERSION);
  assert.equal(s.campaign.bosses, 0);
  assert.equal(s.campaign.bl, 0);
});

test('un guardado v5 no se vuelve a migrar', () => {
  const s = normalizeSave(old(SAVE_VERSION, { next: 12, bosses: 0 }), 'es');
  assert.equal(s.campaign.bosses, 0);
});
