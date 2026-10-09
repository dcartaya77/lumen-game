import raw from './balance/campaign.json';
import { ENEMY_BY_ID } from './enemies';

/** Límites de la vida del jefe (antes del escalado de la noche). */
export interface BossHp {
  min: number;
  max: number;
}

export type BossId = 'devourer' | 'eclipse' | 'mirror' | 'colossus' | 'snuffer';
/** `mirror` copia el siguiente arma del jugador y la lanza como carga, abanico, círculo o rayo. */
export type BossAttack = 'charge' | 'chain' | 'pulse' | 'fan' | 'beam' | 'laser' | 'rain' | 'mirror';
/** Mecánicas que se activan por fase: fragmentos de luz, oscuridad y cristales. */
export type BossMech = 'gems' | 'dark' | 'crystals';

export interface BossPhase {
  speedMult: number;
  /** Pausa entre ataques. */
  cooldown: number;
  /** Rotación de ataques de la fase. */
  seq: BossAttack[];
  mech: BossMech[];
  /** Refuerzos: `every` = 0 los invoca una vez al entrar en la fase. */
  adds?: { id: string; n: number; every: number };
}

export interface AttackCfgs {
  charge: { windup: number; windupChain: number; length: number; speed: number; dmg: number; exposedMiss: number; exposedHit: number; recover: number };
  pulse: { windup: number; radius: number; dmg: number; exposed: number; recover?: number };
  fan: { windup: number; count: number; spread: number; shotSpeed: number; shotDmg: number; range: number; recover: number; exposed?: number };
  /** Rayo desde el jefe (`beam`) o desde un cristal (`laser`): línea con aviso y daño instantáneo. */
  beam: { windup: number; length: number; width: number; dmg: number; exposed?: number; recover: number };
  laser: { windup: number; length: number; width: number; dmg: number; recover: number };
  /** Varios círculos con aviso, uno sobre el jugador. */
  rain: { windup: number; count: number; radius: number; dmg: number; recover: number };
}

/** Fragmentos de luz: aparecen en la arena y el jefe se refuerza al absorberlos. */
export interface GemsCfg {
  firstDelay: number;
  every: number;
  count: number;
  /** Fracción del XP del nivel actual que da cada fragmento al jugador. */
  xpFrac: number;
  maxStacks: number;
  speedPerStack: number;
  dmgPerStack: number;
  scalePerStack: number;
  huntRange: number;
  huntMult: number;
}

/** Oscuridad: solo se ve en el radio de la llama (por fase; 0 = sin oscuridad) y el jefe ataca desde la sombra. */
export interface DarkCfg {
  light: [number, number, number];
  feather: number;
  blink: boolean;
}

/** Cristales que protegen al jefe: con alguno en pie recibe `armorMult`; al romperlos todos queda expuesto `coreSecs`. */
export interface CrystalsCfg {
  count: [number, number, number];
  radius: number;
  /** Distancia al centro de la arena como fracción de su radio. */
  ring: number;
  /** Vida de cada cristal = DPS × `secs` (entre `hpMin` y `hpMax`). */
  secs: number;
  hpMin: number;
  hpMax: number;
  armorMult: number;
  coreSecs: number;
}

export interface MirrorCfg {
  dmgMult: number;
  /** Disparos extra del abanico por nivel del arma copiada, hasta `maxExtra`. */
  perLevel: number;
  maxExtra: number;
}

export interface BossCfg {
  hp: BossHp;
  /** Multiplicador de la vida (jefes largos, como el final). */
  kMult: number;
  look: { tint: string; eyes: string; aura: string };
  /** Skin legendaria y talismán exclusivo de la primera victoria. */
  reward: { skin: string; talisman: string };
  radius: number;
  speed: number;
  contactDmg: number;
  xp: number;
  /** Multiplicador de daño recibido mientras está expuesto (punto débil). */
  exposedMult: number;
  /** Fracciones de vida en que cambia de fase. */
  thresholds: [number, number];
  roar: number;
  attacks: Partial<AttackCfgs>;
  phases: [BossPhase, BossPhase, BossPhase];
  gems?: GemsCfg;
  dark?: DarkCfg;
  crystals?: CrystalsCfg;
  mirror?: MirrorCfg;
}

/** Color del JSON ("#rrggbb") como número para PixiJS. */
export const colorOf = (s: string): number => parseInt(s.replace('#', ''), 16);

/** Clave de traducción del nombre del jefe. */
export const bossNameKey = (id: BossId) => `boss_${id}` as const;

interface RawBosses {
  byNight: Record<string, BossId>;
  arenaRadius: number;
  clearTime: number;
  introTime: number;
  invulnAfterHit: number;
  maxAdds: number;
  fallbackDps: number;
  dpsSampleSecs: number;
  /**
   * Vida = k × DPS^exp. Con exp < 1 la vida crece menos que el DPS: un build fuerte acorta el duelo y uno flojo lo alarga.
   * Se aplica con el DPS contra las hordas al empezar y se recalibra a los `at` s con el daño real al jefe.
   */
  calibrate: { at: number; k: number; exp: number };
  help: { perLoss: number; maxLosses: number };
  dash: { dist: number; dur: number; cooldown: number; iframes: number };
  gifts: { shieldSecs: number; adShieldSecs: number };
  rewards: {
    first: { sparks: number };
    /** Al rejugar: Chispas menores, un talismán raro con `chance` y el exclusivo con `exclusiveChance`. */
    replay: { sparks: number; chance: number; rarity: 0 | 1 | 2 | 3; exclusiveChance: number };
  };
  types: Record<BossId, BossCfg>;
}

export const BOSS = (raw as unknown as { bosses: RawBosses }).bosses;

/** Jefe del duelo final de esa noche, o null si la noche no tiene duelo (todavía). */
export function bossIdFor(night: number): BossId | null {
  return BOSS.byNight[String(night)] ?? null;
}

/** Vida del jefe: k × DPS^exp dentro de [mín, máx], escalada por la vida de la noche. */
export function adaptiveBossHp(range: BossHp, dps: number, hpMod: number, kMult = 1): number {
  const target = BOSS.calibrate.k * kMult * (dps >= 1 ? dps : BOSS.fallbackDps) ** BOSS.calibrate.exp;
  return Math.round(Math.min(range.max * hpMod, Math.max(range.min * hpMod, target)));
}

/** Coherencia del JSON de jefes (se ejecuta en desarrollo). */
export function validateBosses(): string[] {
  const errors: string[] = [];
  for (const [night, id] of Object.entries(BOSS.byNight)) {
    if (!BOSS.types[id]) errors.push(`jefe ${id} (noche ${night}): falta su configuración`);
  }
  if (!(BOSS.calibrate.at >= 3 && BOSS.calibrate.k > 0)) errors.push('calibrate: at >= 3 y k > 0');
  if (!(BOSS.calibrate.exp > 0.3 && BOSS.calibrate.exp <= 1)) errors.push('calibrate: exp entre 0,3 y 1');
  for (const [id, c] of Object.entries(BOSS.types) as [BossId, BossCfg][]) {
    if (!(c.hp.min > 0 && c.hp.max >= c.hp.min)) errors.push(`${id}: hp min/max inválidos`);
    if (!(c.thresholds[0] > c.thresholds[1] && c.thresholds[1] > 0)) errors.push(`${id}: umbrales de fase desordenados`);
    for (const [name, a] of Object.entries(c.attacks)) {
      const w = a as { windup: number; windupChain?: number };
      if ([w.windup, w.windupChain ?? w.windup].some((s) => s < 0.5 || s > 1.3)) errors.push(`${id}.${name}: el aviso debe durar entre 0,5 y 1,3 s`);
    }
    c.phases.forEach((p, i) => {
      if (p.seq.length === 0) errors.push(`${id}: fase ${i + 1} sin ataques`);
      if (p.adds && !ENEMY_BY_ID[p.adds.id]) errors.push(`${id}: enemigo de refuerzo desconocido ${p.adds.id}`);
      for (const a of p.seq) {
        const needs: (keyof AttackCfgs)[] = a === 'chain' ? ['charge'] : a === 'mirror' ? ['fan', 'pulse', 'beam'] : [a];
        for (const n of needs) if (!c.attacks[n]) errors.push(`${id}: la fase ${i + 1} usa ${a} pero falta attacks.${n}`);
        if (a === 'mirror' && !c.mirror) errors.push(`${id}: usa mirror sin bloque mirror`);
      }
      if (p.mech.includes('gems') && !c.gems) errors.push(`${id}: fase ${i + 1} usa gems sin bloque gems`);
      if (p.mech.includes('dark') && !(c.dark && c.dark.light[i]! > 0)) errors.push(`${id}: fase ${i + 1} usa dark sin radio de luz`);
      if (p.mech.includes('crystals') && !(c.crystals && c.crystals.count[i]! > 0)) errors.push(`${id}: fase ${i + 1} usa crystals sin cristales`);
    });
  }
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateBosses();
  if (errs.length) console.error('[campaign.json bosses]', errs);
}
