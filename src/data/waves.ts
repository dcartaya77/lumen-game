import type { WaveSegment } from './types';

/**
 * Línea temporal de 5 minutos. Cada tramo define qué aparece y con qué intensidad.
 * Élites: uno por minuto (ver ELITE_TIMES). Jefe: BOSS_TIME.
 */
export const WAVES: readonly WaveSegment[] = [
  { from: 0, spawn: [{ id: 'shade', w: 1 }], rate: 1, cap: 1 },
  { from: 30, spawn: [{ id: 'shade', w: 3 }, { id: 'wisp', w: 2 }], rate: 1, cap: 1 },
  { from: 60, spawn: [{ id: 'shade', w: 3 }, { id: 'wisp', w: 2 }, { id: 'brute', w: 1 }], rate: 0.95, cap: 1, burst: { id: 'mote', n: 10 } },
  { from: 90, spawn: [{ id: 'shade', w: 2 }, { id: 'wisp', w: 2 }, { id: 'charger', w: 1 }, { id: 'spitter', w: 1 }], rate: 0.9, cap: 1.05 },
  { from: 120, spawn: [{ id: 'shade', w: 2 }, { id: 'husk', w: 1 }, { id: 'charger', w: 1 }, { id: 'spitter', w: 1 }, { id: 'drifter', w: 1 }], rate: 0.85, cap: 1.1, burst: { id: 'wisp', n: 12 } },
  { from: 150, spawn: [{ id: 'wisp', w: 2 }, { id: 'brute', w: 2 }, { id: 'drifter', w: 2 }, { id: 'spitter', w: 1 }], rate: 0.8, cap: 1.15 },
  { from: 180, spawn: [{ id: 'shade', w: 2 }, { id: 'husk', w: 2 }, { id: 'charger', w: 2 }, { id: 'brute', w: 1 }, { id: 'drifter', w: 1 }], rate: 0.75, cap: 1.2, burst: { id: 'mote', n: 20 } },
  { from: 210, spawn: [{ id: 'wisp', w: 3 }, { id: 'charger', w: 2 }, { id: 'spitter', w: 2 }, { id: 'husk', w: 1 }, { id: 'brute', w: 1 }], rate: 0.7, cap: 1.25 },
  { from: 240, spawn: [{ id: 'brute', w: 2 }, { id: 'husk', w: 2 }, { id: 'drifter', w: 2 }, { id: 'charger', w: 1 }], rate: 0.7, cap: 1.3, burst: { id: 'charger', n: 6 } },
  // Durante el jefe: menos relleno para que la pelea se lea bien.
  { from: 255, spawn: [{ id: 'shade', w: 2 }, { id: 'wisp', w: 1 }], rate: 1.2, cap: 0.6 },
];

export const ELITE_TIMES = [60, 120, 180, 240];
export const BOSS_TIME = 255;
/** Candidatos a élite por minuto (en orden). */
export const ELITE_IDS = ['brute', 'charger', 'husk', 'spitter'];

export function segmentAt(t: number, waves: readonly WaveSegment[] = WAVES): WaveSegment {
  let seg = waves[0]!;
  for (const s of waves) if (t >= s.from) seg = s;
  return seg;
}

/** Todo lo que el motor necesita saber de las olas de una partida. */
export interface WaveConfig {
  waves: readonly WaveSegment[];
  eliteTimes: readonly number[];
  eliteIds: readonly string[];
  /** Segundo en que aparece el jefe de la partida normal; null = sin jefe. */
  bossTime: number | null;
}

export const V1_WAVE_CONFIG: WaveConfig = { waves: WAVES, eliteTimes: ELITE_TIMES, eliteIds: ELITE_IDS, bossTime: BOSS_TIME };
