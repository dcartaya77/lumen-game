/** Constantes de balance de la partida. Todo lo que afecta a la dificultad vive aquí. */
export const RUN_DURATION = 300;
export const MAX_ENEMIES = 200;

/** XP necesaria para pasar del nivel `level` al siguiente. */
export function xpForLevel(level: number): number {
  return Math.floor(6 + level * 4 + level * level * 0.6);
}

/** Enemigos vivos permitidos según el tiempo transcurrido. */
export function maxAliveAt(t: number): number {
  return Math.min(MAX_ENEMIES, Math.floor(8 + t * 0.6));
}

/** Segundos entre apariciones según el tiempo transcurrido. */
export function spawnIntervalAt(t: number): number {
  return Math.max(0.12, 1.1 - (t / RUN_DURATION) * 0.95);
}

/** Multiplicador de vida de los enemigos según el tiempo. */
export function enemyHpScaleAt(t: number): number {
  return 1 + (t / 60) * 0.35;
}

/** Chispas ganadas al terminar. */
export function sparksFor(timeSurvived: number, kills: number, won: boolean): number {
  return Math.floor(kills * 0.6 + timeSurvived * 0.4) + (won ? 120 : 0);
}

export const CONTACT_DAMAGE_INTERVAL = 0.5;
export const INVULN_AFTER_HIT = 0.4;
export const GEM_PICKUP_RADIUS = 14;
export const GEM_MAGNET_SPEED = 620;
