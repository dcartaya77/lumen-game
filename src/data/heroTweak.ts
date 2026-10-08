/** Campos de un nivel de arma que un ajuste de héroe puede tocar. */
export interface TweakableLevel {
  dmg: number;
  cooldown: number;
  count: number;
  speed: number;
  pierce: number;
  size: number;
  duration: number;
}

/** Un número para todos los niveles, o uno por nivel (el último se repite) para que el refuerzo se atenúe y no pase de la forma evolucionada. */
export type PerLevel = number | readonly number[];

/** Ajuste del arma inicial de un héroe: multiplica campos de cada nivel, suma enteros a `count`/`pierce` y puede cambiar datos de la propia arma. */
export interface WeaponTweak {
  mult?: Partial<Record<'dmg' | 'cooldown' | 'speed' | 'size' | 'duration', PerLevel>>;
  add?: Partial<Record<'count' | 'pierce', PerLevel>>;
  def?: {
    range?: number;
    knockback?: number;
    /** Multiplica el radio de órbita (orbes). */
    orbitRadius?: number;
    /** Los orbes "respiran": el radio oscila `amp` (fracción) cada `period` segundos. */
    orbitPulse?: { amp: number; period: number };
    /** Las auras ralentizan a lo que tocan: `k` = factor de velocidad y `secs` = duración. */
    slow?: { k: number; secs: number };
  };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
const at = (v: PerLevel, i: number): number => (typeof v === 'number' ? v : v[Math.min(i, v.length - 1)]!);

/** Aplica el ajuste a todos los niveles (así cada subida de nivel sigue mejorando el arma). */
export function tweakLevels<T extends TweakableLevel>(levels: readonly T[], tw: WeaponTweak): T[] {
  return levels.map((lv, i) => {
    const src = lv as unknown as Record<string, number>;
    const out: Record<string, unknown> = { ...(lv as object) };
    for (const [k, m] of Object.entries(tw.mult ?? {})) out[k] = round2(src[k]! * at(m, i));
    for (const [k, a] of Object.entries(tw.add ?? {})) out[k] = src[k]! + at(a, i);
    return out as unknown as T;
  });
}

/** Campos que no deben empeorar al subir de nivel (la cadencia, al revés): devuelve los fallos para avisar al afinar el JSON. */
export function levelRegressions(levels: readonly TweakableLevel[]): string[] {
  const errs: string[] = [];
  for (let i = 1; i < levels.length; i++) {
    const a = levels[i - 1]!;
    const b = levels[i]!;
    for (const k of ['dmg', 'count', 'speed', 'pierce', 'size'] as const) if (b[k] < a[k]) errs.push(`nivel ${i + 1}: ${k} baja de ${a[k]} a ${b[k]}`);
    if (b.cooldown > a.cooldown) errs.push(`nivel ${i + 1}: cooldown sube de ${a.cooldown} a ${b.cooldown}`);
  }
  return errs;
}
