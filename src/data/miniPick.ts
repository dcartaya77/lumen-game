/**
 * Reparto determinista de tipos de minijefe: rota por el pool del tramo de cada noche
 * y nunca repite el tipo de la aparición anterior, ni siquiera al cambiar de tramo.
 */
export function pickMiniType<T extends string>(
  pools: readonly (readonly T[])[],
  tierOf: (night: number) => number,
  night: number,
  slot: number,
  perNight = 2,
): T {
  let prev: T | null = null;
  let out: T | null = null;
  const last = (night - 1) * perNight + slot;
  for (let s = 0; s <= last; s++) {
    const n = Math.floor(s / perNight) + 1;
    const pool = pools[Math.min(tierOf(n), pools.length - 1)]!;
    let i = s % pool.length;
    let pick = pool[i]!;
    for (let k = 0; k < pool.length && pick === prev; k++) {
      i = (i + 1) % pool.length;
      pick = pool[i]!;
    }
    prev = out = pick;
  }
  return out!;
}
