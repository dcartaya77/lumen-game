/** Coste de cada nivel: base × multiplicador del nivel, redondeado al múltiplo `round`. */
export function levelCosts(base: readonly number[], mult: readonly number[], round: number): number[] {
  return base.map((c, i) => Math.max(round, Math.round((c * (mult[i] ?? 1)) / round) * round));
}
