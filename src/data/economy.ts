import raw from './balance/economy.json';
import { levelCosts } from './prices';

/** Botín de un cofre: rangos `[mín, máx]` enteros; `fragChance` y `boostChance` son probabilidades 0-1. */
export interface ChestTier {
  sparks: [number, number];
  frags: [number, number];
  fragChance: number;
  boostChance: number;
}

/** Sector de la ruleta: lo que da y su peso relativo. */
export interface WheelPrize {
  sparks?: number;
  frags?: number;
  boost?: boolean;
  weight: number;
}

interface RawEconomy {
  /** Chispas al terminar una partida: `perKill` por baja, `perSecond` por segundo, y bonos por victoria y por jefe. */
  sparks: { perKill: number; perSecond: number; win: number; boss: number };
  /** Multiplicador de Chispas de cada mapa y de cada evento semanal / modificador del reto diario. */
  sparkBonus: { maps: Record<string, number>; events: Record<string, number> };
  rewards: {
    /** Racha diaria: `perDay` × días seguidos, con tope en `maxDays`. */
    streak: { perDay: number; maxDays: number };
    /** Premio único al superar el reto diario. */
    challenge: number;
    chest: { free: ChestTier; ad: ChestTier };
    wheel: { adSpinsPerDay: number; segments: WheelPrize[] };
    missions: Record<string, number>;
    achievements: Record<string, number>;
  };
  prices: {
    /** Multiplicador del coste de cada nivel de las mejoras permanentes y redondeo del resultado. */
    metaLevelMult: number[];
    metaRound: number;
    meta: Record<string, number[]>;
    characters: Record<string, number>;
    maps: Record<string, number>;
    /** Chispas o fragmentos según el tipo de desbloqueo de la skin. */
    skins: Record<string, number>;
  };
  ads: {
    /** Tope de Chispas extra del anuncio "x2" de una partida normal. */
    doubleSparksMax: number;
  };
}

export const ECON = raw as unknown as RawEconomy;

export function metaCosts(id: string): number[] {
  const base = ECON.prices.meta[id];
  if (!base) throw new Error(`economy.json: falta el precio de la mejora ${id}`);
  return levelCosts(base, ECON.prices.metaLevelMult, ECON.prices.metaRound);
}

export function priceOf(group: 'characters' | 'maps' | 'skins', id: string): number {
  const p = ECON.prices[group][id];
  if (p === undefined) throw new Error(`economy.json: falta el precio de ${group}.${id}`);
  return p;
}

export function mapBonus(id: string): number {
  const b = ECON.sparkBonus.maps[id];
  if (b === undefined) throw new Error(`economy.json: falta sparkBonus.maps.${id}`);
  return b;
}

export function eventBonus(id: string): number {
  const b = ECON.sparkBonus.events[id];
  if (b === undefined) throw new Error(`economy.json: falta sparkBonus.events.${id}`);
  return b;
}

/** Recompensa en Chispas de una misión diaria o de un logro. */
export function rewardOf(group: 'missions' | 'achievements', id: string): number {
  const r = ECON.rewards[group][id];
  if (r === undefined) throw new Error(`economy.json: falta rewards.${group}.${id}`);
  return r;
}

/** Chispas del día `n` de racha (la primera partida de cada día). */
export function streakReward(n: number): number {
  const s = ECON.rewards.streak;
  return Math.min(s.maxDays, n) * s.perDay;
}

/** Coherencia del JSON de economía (se ejecuta en desarrollo). */
export function validateEconomy(): string[] {
  const errors: string[] = [];
  const { prices, sparks, ads } = ECON;
  if (!(prices.metaRound >= 1)) errors.push('prices.metaRound debe ser >= 1');
  if (prices.metaLevelMult.length !== 5 || prices.metaLevelMult.some((m) => !(m > 0))) errors.push('prices.metaLevelMult: 5 multiplicadores > 0');
  for (const [id, base] of Object.entries(prices.meta)) {
    if (base.length !== 5 || base.some((c) => !(c > 0))) errors.push(`prices.meta.${id}: 5 costes > 0`);
  }
  for (const group of ['characters', 'maps', 'skins'] as const) {
    for (const [id, c] of Object.entries(prices[group])) if (!(c > 0)) errors.push(`prices.${group}.${id}: debe ser > 0`);
  }
  if (Object.values(sparks).some((v) => !(v >= 0))) errors.push('sparks: valores >= 0');
  if (!(ads.doubleSparksMax >= 0)) errors.push('ads.doubleSparksMax >= 0');
  const { sparkBonus, rewards } = ECON;
  for (const group of ['maps', 'events'] as const) {
    for (const [id, b] of Object.entries(sparkBonus[group])) if (!(b >= 1)) errors.push(`sparkBonus.${group}.${id}: debe ser >= 1`);
  }
  if (!(rewards.streak.perDay >= 0 && rewards.streak.maxDays >= 1)) errors.push('rewards.streak: perDay >= 0 y maxDays >= 1');
  if (!(rewards.challenge >= 0)) errors.push('rewards.challenge >= 0');
  for (const [tier, c] of Object.entries(rewards.chest)) {
    if (!(c.sparks[0] >= 0 && c.sparks[1] >= c.sparks[0])) errors.push(`rewards.chest.${tier}.sparks: [mín, máx] con mín <= máx`);
    if (!(c.frags[0] >= 0 && c.frags[1] >= c.frags[0])) errors.push(`rewards.chest.${tier}.frags: [mín, máx] con mín <= máx`);
    for (const p of [c.fragChance, c.boostChance]) if (!(p >= 0 && p <= 1)) errors.push(`rewards.chest.${tier}: las probabilidades van de 0 a 1`);
  }
  const { wheel } = rewards;
  if (!Number.isInteger(wheel.adSpinsPerDay) || wheel.adSpinsPerDay < 0) errors.push('rewards.wheel.adSpinsPerDay: entero >= 0');
  if (wheel.segments.length < 2) errors.push('rewards.wheel.segments: al menos 2 sectores');
  wheel.segments.forEach((s, i) => {
    if (!(s.weight > 0)) errors.push(`rewards.wheel.segments[${i}].weight debe ser > 0`);
    if (!(s.sparks || s.frags || s.boost)) errors.push(`rewards.wheel.segments[${i}] no da nada`);
  });
  for (const group of ['missions', 'achievements'] as const) {
    for (const [id, r] of Object.entries(rewards[group])) if (!(r >= 0)) errors.push(`rewards.${group}.${id}: debe ser >= 0`);
  }
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateEconomy();
  if (errs.length) console.error('[economy.json]', errs);
}
