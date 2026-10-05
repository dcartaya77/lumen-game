import type { TranslationKey } from '@/i18n';
import type { RunResult } from '@/state/run';
import { seedFromString, seededRng } from '@/game/core/rng';

export interface MissionDef {
  id: string;
  descKey: TranslationKey;
  /** Objetivo numérico. */
  target: number;
  reward: number;
  /** `sum`: acumula entre partidas (bajas, partidas). `max`: cuenta la mejor partida (nivel, tiempo). */
  mode: 'sum' | 'max';
  /** Progreso que aporta una partida. */
  progress(result: RunResult): number;
}

/** Pool de misiones; cada día se eligen 3 por semilla de fecha. */
export const MISSION_POOL: readonly MissionDef[] = [
  { id: 'k150', descKey: 'mi_kills150', target: 150, reward: 40, mode: 'sum', progress: (r) => r.kills },
  { id: 'k400', descKey: 'mi_kills400', target: 400, reward: 70, mode: 'sum', progress: (r) => r.kills },
  { id: 'lv10', descKey: 'mi_level10', target: 10, reward: 40, mode: 'max', progress: (r) => r.level },
  { id: 'lv14', descKey: 'mi_level14', target: 14, reward: 60, mode: 'max', progress: (r) => r.level },
  { id: 't150', descKey: 'mi_time150', target: 150, reward: 40, mode: 'max', progress: (r) => Math.floor(r.time) },
  { id: 't300', descKey: 'mi_time300', target: 300, reward: 90, mode: 'max', progress: (r) => Math.floor(r.time) },
  { id: 'e3', descKey: 'mi_elites3', target: 3, reward: 50, mode: 'sum', progress: (r) => r.elitesKilled },
  { id: 'e6', descKey: 'mi_elites6', target: 6, reward: 80, mode: 'sum', progress: (r) => r.elitesKilled },
  { id: 's250', descKey: 'mi_sparks250', target: 250, reward: 50, mode: 'max', progress: (r) => r.sparks },
  { id: 'boss', descKey: 'mi_boss', target: 1, reward: 100, mode: 'max', progress: (r) => (r.bossKilled ? 1 : 0) },
  { id: 'runs3', descKey: 'mi_runs3', target: 3, reward: 45, mode: 'sum', progress: () => 1 },
  { id: 'evo', descKey: 'mi_evolution', target: 1, reward: 60, mode: 'max', progress: (r) => (r.evolved ? 1 : 0) },
];

/** Aplica el progreso de una partida al contador guardado. */
export function advanceMission(def: MissionDef, current: number, result: RunResult): number {
  const p = def.progress(result);
  return Math.min(def.target, def.mode === 'max' ? Math.max(current, p) : current + p);
}

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSION_POOL.map((m) => [m.id, m]));

/** Las 3 misiones del día (mismas para todos los jugadores, sin servidor). */
export function dailyMissions(dayKey: string): MissionDef[] {
  const rng = seededRng(seedFromString(`missions:${dayKey}`));
  const pool = [...MISSION_POOL];
  const out: MissionDef[] = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  return out;
}
