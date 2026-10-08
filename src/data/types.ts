import type { TranslationKey } from '@/i18n';

/** Nota corta que describe qué aporta cada nivel (clave de traducción). */
export type LevelNote =
  | 'lv_new'
  | 'lv_dmg'
  | 'lv_count'
  | 'lv_cd'
  | 'lv_pierce'
  | 'lv_size'
  | 'lv_speed'
  | 'lv_duration'
  | 'lv_evolve';

export interface WeaponLevel {
  dmg: number;
  /** Segundos entre activaciones (en auras/órbitas: entre ticks de daño). */
  cooldown: number;
  count: number;
  /** Velocidad de proyectil, giro de órbita o longitud de haz según comportamiento. */
  speed: number;
  pierce: number;
  /** Multiplicador de tamaño del proyectil/área. */
  size: number;
  /** Duración de proyectiles/efectos en segundos (si aplica). */
  duration: number;
  note: LevelNote;
}

export type WeaponBehavior = 'projectile' | 'homing' | 'aura' | 'orbit' | 'beam' | 'nova' | 'chain';

export interface WeaponDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  behavior: WeaponBehavior;
  color: number;
  /** Alcance de auto-apuntado. */
  range: number;
  /** Fuerza de empuje aplicada al golpear (px/s). */
  knockback: number;
  levels: readonly WeaponLevel[];
  /** Evolución: requiere este arma al máximo + la pasiva indicada. */
  evolution?: { into: string; requires: string };
  /** true si es una forma evolucionada (no aparece en el pool normal). */
  evolved?: boolean;
  /** Multiplicador del radio de órbita de los orbes (ajuste de héroe). */
  orbitRadius?: number;
  /** Los orbes "respiran": el radio oscila `amp` (fracción) cada `period` segundos, así barren tanto lo pegado como lo lejano (ajuste de héroe). */
  orbitPulse?: { amp: number; period: number };
  /** Auras: lo que tocan se ralentiza (`k` = factor de velocidad) durante `secs` segundos (ajuste de héroe). */
  slow?: { k: number; secs: number };
}

export type PassiveStat = 'maxHp' | 'speed' | 'damage' | 'magnet' | 'cooldown' | 'armor' | 'regen';

export interface PassiveDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  stat: PassiveStat;
  perLevel: number;
  maxLevel: number;
  color: number;
}

export type EnemyBehavior = 'chase' | 'charge' | 'ranged' | 'drift' | 'boss' | 'mini';

export interface EnemyDef {
  id: string;
  nameKey: TranslationKey;
  hp: number;
  speed: number;
  dmg: number;
  radius: number;
  xp: number;
  eyeColor: number;
  tint: number;
  scale: number;
  shape: 'shade' | 'spiky' | 'blob';
  behavior: EnemyBehavior;
  /** Al morir genera `n` enemigos de `id`. */
  onDeath?: { id: string; n: number };
  /** Enemigos a distancia: cadencia y velocidad del disparo. */
  shot?: { cooldown: number; speed: number; dmg: number; keepDistance: number };
  boss?: boolean;
  /** Minijefe de campaña: su movimiento y ataques los gobierna el sistema Minibosses. */
  mini?: boolean;
}

export interface CharacterDef {
  id: string;
  nameKey: TranslationKey;
  weaponId: string;
  base: { maxHp: number; speed: number; magnet: number; armor: number; regen: number };
}

export interface UpgradeOption {
  id: string;
  kind: 'weapon' | 'passive' | 'evolution';
  nameKey: TranslationKey;
  descKey: TranslationKey;
  note: LevelNote;
  /** Nivel que tendrá tras elegirla (1 = nueva). */
  level: number;
  maxLevel: number;
  color: number;
  /** Para evoluciones: arma de origen. */
  from?: string;
}

/** Multiplicadores de partida (reto diario, evento semanal). 1 = normal. */
export interface RunModifiers {
  enemyHp: number;
  enemySpeed: number;
  enemyDmg: number;
  playerDamage: number;
  xp: number;
  spawnRate: number;
  /** Multiplicador del tope de enemigos vivos. */
  capMult: number;
}

export const NO_MODS: RunModifiers = {
  enemyHp: 1,
  enemySpeed: 1,
  enemyDmg: 1,
  playerDamage: 1,
  xp: 1,
  spawnRate: 1,
  capMult: 1,
};

export function mergeMods(base: RunModifiers, extra: Partial<RunModifiers>): RunModifiers {
  const out = { ...base };
  for (const k of Object.keys(extra) as (keyof RunModifiers)[]) out[k] *= extra[k]!;
  return out;
}

/** Tramo de la línea temporal de olas. */
export interface WaveSegment {
  from: number;
  /** Enemigos y su peso relativo de aparición. */
  spawn: { id: string; w: number }[];
  /** Multiplicador de cadencia (menor = más rápido). */
  rate: number;
  /** Multiplicador del tope de enemigos vivos. */
  cap: number;
  /** Grupo que entra de golpe al empezar el tramo. */
  burst?: { id: string; n: number };
}
