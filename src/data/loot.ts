import { randInt } from '@/game/core/math';
import { ECON } from './economy';

/** Botín de cofre/ruleta. Todo es moneda interna del juego, sin valor real. */
export interface Loot {
  sparks: number;
  frags: number;
  boost: boolean;
}

export const NO_LOOT: Loot = { sparks: 0, frags: 0, boost: false };

/** Cofre gratis diario: modesto. Con anuncio se abre un segundo cofre con mejor botín (valores en economy.json). */
export function rollChest(better: boolean): Loot {
  const t = ECON.rewards.chest[better ? 'ad' : 'free'];
  return {
    sparks: randInt(t.sparks[0], t.sparks[1]),
    frags: Math.random() < t.fragChance ? randInt(t.frags[0], t.frags[1]) : 0,
    boost: Math.random() < t.boostChance,
  };
}

export interface WheelSegment {
  prize: Loot;
  /** Peso relativo de salir. */
  weight: number;
  color: string;
  label: string;
}

export const WHEEL_AD_SPINS_PER_DAY = ECON.rewards.wheel.adSpinsPerDay;

/** Colores de los sectores (el sector i usa el color i, en ciclo); los premios y pesos salen de economy.json. */
const SEGMENT_COLORS = ['#3b2f5c', '#235a63', '#5c3b2f', '#5c2f48', '#2f4a5c', '#2f5c3f', '#5c4a2f', '#6b5314'];

/** Sectores en el orden del dibujo (en sentido horario desde arriba). */
export const WHEEL: readonly WheelSegment[] = ECON.rewards.wheel.segments.map((s, i) => {
  const prize: Loot = { sparks: s.sparks ?? 0, frags: s.frags ?? 0, boost: s.boost ?? false };
  const label = [prize.sparks > 0 ? `✦${prize.sparks}` : '', prize.frags > 0 ? `◆${prize.frags}` : '', prize.boost ? '▲' : '']
    .filter(Boolean)
    .join(' ');
  return { prize, weight: s.weight, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]!, label };
});

export function rollWheel(): number {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i]!.weight;
    if (r <= 0) return i;
  }
  return 0;
}
