/** Constantes de balance de la partida. Todo lo que afecta a la dificultad vive aquí. */
export const RUN_DURATION = 300;
export const MAX_ENEMIES = 200;

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpForLevel(level: number): number {
  return Math.floor(6 + level * 4 + level * level * 0.6);
}

/** Enemigos vivos permitidos según el tiempo transcurrido (antes del multiplicador del tramo). */
export function maxAliveAt(t: number): number {
  return Math.min(MAX_ENEMIES, Math.floor(8 + t * 0.55));
}

/** Segundos entre apariciones según el tiempo (antes del multiplicador del tramo). */
export function spawnIntervalAt(t: number): number {
  return Math.max(0.1, 1.1 - (t / RUN_DURATION) * 0.95);
}

/** Multiplicador de vida de los enemigos según el tiempo. */
export function enemyHpScaleAt(t: number): number {
  return 1 + (t / 60) * 0.3;
}

/** Chispas ganadas al terminar. */
export function sparksFor(timeSurvived: number, kills: number, won: boolean, bossKilled: boolean): number {
  return Math.floor(kills * 0.5 + timeSurvived * 0.4) + (won ? 120 : 0) + (bossKilled ? 150 : 0);
}

export const CONTACT_DAMAGE_INTERVAL = 0.5;
export const INVULN_AFTER_HIT = 0.4;
export const GEM_PICKUP_RADIUS = 14;
export const GEM_MAGNET_SPEED = 620;
/** Radio base del aura (se multiplica por `size`). */
export const AURA_BASE_RADIUS = 70;
/** Radio de órbita de los orbes. */
export const ORBIT_RADIUS = 64;
/** Radio final base de la nova (se multiplica por `size`). */
export const NOVA_BASE_RADIUS = 150;
/** Salto máximo entre objetivos del rayo en cadena. */
export const CHAIN_RANGE = 150;
