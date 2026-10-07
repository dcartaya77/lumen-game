/** `n` elementos distintos de `pool`, empezando por `first` si se da. */
export function pickDistinct<T>(pool: readonly T[], n: number, first?: T, rnd: () => number = Math.random): T[] {
  const out: T[] = first === undefined ? [] : [first];
  const rest = pool.filter((x) => x !== first);
  while (out.length < n && rest.length > 0) out.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]!);
  return out;
}
