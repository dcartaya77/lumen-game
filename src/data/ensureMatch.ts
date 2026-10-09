/** Garantiza que `picked` contenga algún elemento que cumpla `match`: si no, cambia uno al azar por uno del `pool` que sí lo cumpla. */
export function ensureMatch<T>(picked: readonly T[], pool: readonly T[], match: (x: T) => boolean, rnd: () => number = Math.random): T[] {
  const out = [...picked];
  if (out.length === 0 || out.some(match)) return out;
  const candidates = pool.filter((x) => match(x) && !out.includes(x));
  if (candidates.length === 0) return out;
  out[Math.floor(rnd() * out.length)] = candidates[Math.floor(rnd() * candidates.length)]!;
  return out;
}
