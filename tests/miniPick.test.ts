import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickMiniType } from '../src/data/miniPick.ts';

const POOLS = [
  ['charger', 'fan', 'swarm'],
  ['fan', 'trail', 'charger', 'swarm'],
  ['shield', 'charger', 'teleport', 'fan'],
  ['teleport', 'trail', 'shield', 'swarm'],
  ['charger', 'fan', 'swarm', 'trail', 'shield', 'teleport'],
];
const tierOf = (n: number) => Math.min(4, Math.floor((n - 1) / 5));

function sequence(nights = 25) {
  const out: string[] = [];
  for (let n = 1; n <= nights; n++) for (let s = 0; s < 2; s++) out.push(pickMiniType(POOLS, tierOf, n, s));
  return out;
}

test('nunca repite el tipo de la aparición anterior (tampoco al cambiar de tramo)', () => {
  const seq = sequence();
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `repetido en la aparición ${i}`);
});

test('cada aparición sale del pool de su tramo', () => {
  for (let n = 1; n <= 25; n++) {
    for (let s = 0; s < 2; s++) assert.ok(POOLS[tierOf(n)]!.includes(pickMiniType(POOLS, tierOf, n, s)));
  }
});

test('es determinista y cada tramo ofrece variedad', () => {
  assert.deepEqual(sequence(), sequence());
  for (let t = 0; t < 5; t++) {
    const types = new Set<string>();
    for (let n = t * 5 + 1; n <= t * 5 + 5; n++) for (let s = 0; s < 2; s++) types.add(pickMiniType(POOLS, tierOf, n, s));
    assert.ok(types.size >= 3, `tramo ${t}: solo ${types.size} tipos`);
  }
});
