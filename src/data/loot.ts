import { randInt } from '@/game/core/math';

/** Botín de cofre/ruleta. Todo es moneda interna del juego, sin valor real. */
export interface Loot {
  sparks: number;
  frags: number;
  boost: boolean;
}

export const NO_LOOT: Loot = { sparks: 0, frags: 0, boost: false };

/** Cofre gratis diario: modesto. Con anuncio se abre un segundo cofre con mejor botín. */
export function rollChest(better: boolean): Loot {
  if (!better) {
    return { sparks: randInt(60, 120), frags: Math.random() < 0.25 ? 1 : 0, boost: false };
  }
  return { sparks: randInt(150, 300), frags: randInt(1, 2), boost: Math.random() < 0.15 };
}

export interface WheelSegment {
  prize: Loot;
  /** Peso relativo de salir. */
  weight: number;
  color: string;
  label: string;
}

export const WHEEL_AD_SPINS_PER_DAY = 3;

/** 8 sectores de 45º; el orden es el del dibujo (en sentido horario desde arriba). */
export const WHEEL: readonly WheelSegment[] = [
  { prize: { ...NO_LOOT, sparks: 40 }, weight: 18, color: '#3b2f5c', label: '✦40' },
  { prize: { ...NO_LOOT, frags: 1 }, weight: 12, color: '#235a63', label: '◆1' },
  { prize: { ...NO_LOOT, sparks: 80 }, weight: 16, color: '#5c3b2f', label: '✦80' },
  { prize: { ...NO_LOOT, boost: true }, weight: 10, color: '#5c2f48', label: '▲' },
  { prize: { ...NO_LOOT, sparks: 60 }, weight: 16, color: '#2f4a5c', label: '✦60' },
  { prize: { ...NO_LOOT, frags: 2 }, weight: 8, color: '#2f5c3f', label: '◆2' },
  { prize: { ...NO_LOOT, sparks: 120 }, weight: 12, color: '#5c4a2f', label: '✦120' },
  { prize: { ...NO_LOOT, sparks: 300 }, weight: 4, color: '#6b5314', label: '✦300' },
];

export function rollWheel(): number {
  const total = WHEEL.reduce((a, s) => a + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i]!.weight;
    if (r <= 0) return i;
  }
  return 0;
}
