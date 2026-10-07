import raw from './balance/campaign.json';
import { ENEMY_BY_ID } from './enemies';
import type { HpRule } from './minibosses';

export type BossId = 'devourer';
export type BossAttack = 'charge' | 'pulse' | 'fan' | 'chain';

export interface BossPhase {
  speedMult: number;
  /** Pausa entre ataques. */
  cooldown: number;
  /** Rotación de ataques de la fase. */
  seq: BossAttack[];
  /** Refuerzos: `every` = 0 los invoca una vez al entrar en la fase. */
  adds?: { id: string; n: number; every: number };
}

export interface DevourerCfg {
  hp: HpRule;
  radius: number;
  speed: number;
  contactDmg: number;
  xp: number;
  /** Multiplicador de daño recibido mientras está expuesto (punto débil). */
  exposedMult: number;
  /** Fracciones de vida en que cambia de fase. */
  thresholds: [number, number];
  roar: number;
  charge: { windup: number; windupChain: number; length: number; speed: number; dmg: number; exposedMiss: number; exposedHit: number; recover: number };
  pulse: { windup: number; radius: number; dmg: number; exposed: number };
  fan: { windup: number; count: number; spread: number; shotSpeed: number; shotDmg: number; range: number; recover: number };
  phases: [BossPhase, BossPhase, BossPhase];
  /** Fragmentos de luz: aparecen en la arena y el jefe se refuerza al absorberlos. */
  gems: {
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
  };
}

interface RawBosses {
  byNight: Record<string, BossId>;
  arenaRadius: number;
  clearTime: number;
  introTime: number;
  invulnAfterHit: number;
  maxAdds: number;
  fallbackDps: number;
  dpsSampleSecs: number;
  /** Recalibración de la vida con el daño real al jefe: a los `at` segundos de combate, vida = DPS al jefe × `k`. */
  calibrate: { at: number; k: number };
  help: { perLoss: number; maxLosses: number };
  dash: { dist: number; dur: number; cooldown: number; iframes: number };
  gifts: { shieldSecs: number };
  rewards: {
    first: { sparks: number; rarity: 0 | 1 | 2 | 3 };
    replay: { sparks: number; chance: number; rarity: 0 | 1 | 2 | 3 };
  };
  types: { devourer: DevourerCfg };
}

export const BOSS = (raw as unknown as { bosses: RawBosses }).bosses;

/** Jefe del duelo final de esa noche, o null si la noche no tiene duelo (todavía). */
export function bossIdFor(night: number): BossId | null {
  return BOSS.byNight[String(night)] ?? null;
}

/** Vida del jefe: clamp(DPS medido × k, mín, máx), escalada por la vida de la noche. */
export function adaptiveBossHp(rule: HpRule, dps: number, hpMod: number): number {
  const target = (dps >= 1 ? dps : BOSS.fallbackDps) * rule.k;
  return Math.round(Math.min(rule.max * hpMod, Math.max(rule.min * hpMod, target)));
}

/** Coherencia del JSON de jefes (se ejecuta en desarrollo). */
export function validateBosses(): string[] {
  const errors: string[] = [];
  for (const [night, id] of Object.entries(BOSS.byNight)) {
    if (!BOSS.types[id]) errors.push(`jefe ${id} (noche ${night}): falta su configuración`);
  }
  const d = BOSS.types.devourer;
  if (!(d.hp.min > 0 && d.hp.max >= d.hp.min)) errors.push('devourer: hp min/max inválidos');
  if (!(d.thresholds[0] > d.thresholds[1] && d.thresholds[1] > 0)) errors.push('devourer: umbrales de fase desordenados');
  if (!(BOSS.calibrate.at >= 3 && BOSS.calibrate.k > 0)) errors.push('calibrate: at >= 3 y k > 0');
  const warns = [d.charge.windup, d.charge.windupChain, d.pulse.windup, d.fan.windup];
  if (warns.some((w) => w < 0.5 || w > 1.3)) errors.push('devourer: los avisos deben durar entre 0,5 y 1,3 s');
  for (const p of d.phases) {
    if (p.seq.length === 0) errors.push('devourer: fase sin ataques');
    if (p.adds && !ENEMY_BY_ID[p.adds.id]) errors.push(`devourer: enemigo de refuerzo desconocido ${p.adds.id}`);
  }
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateBosses();
  if (errs.length) console.error('[campaign.json bosses]', errs);
}
