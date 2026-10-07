import raw from './balance/campaign.json';
import { pickMiniType } from './miniPick';

/** Rareza del talismán que suelta un minijefe: 0 común, 1 raro, 2 épico, 3 legendario. */
export type TalismanRarity = 0 | 1 | 2 | 3;
export const RARITY_COLORS: readonly number[] = [0xdfe6ee, 0x4fa8ff, 0xc78bff, 0xffd700];
export const RARITY_KEYS = ['rarity_common', 'rarity_rare', 'rarity_epic', 'rarity_legendary'] as const;

/** Vida adaptativa: clamp(dps × k, min, max); k son los segundos que debería durar el combate. */
export interface HpRule {
  k: number;
  min: number;
  max: number;
}

interface BaseCfg {
  radius: number;
  speed: number;
  contactDmg: number;
  xp: number;
  hp: HpRule;
  /** Aviso antes de golpear (0,5-1 s) y aviso del segundo golpe de una cadena. */
  windup: number;
  windupChain: number;
  recover: number;
  cooldown: number;
  /** Por debajo de esta fracción de vida encadena dos golpes. */
  chainBelow: number;
}

export interface ChargerCfg extends BaseCfg {
  dashSpeed: number;
  dashDur: number;
  dashDmg: number;
}

export interface FanCfg extends BaseCfg {
  keepDistance: number;
  count: number;
  countLow: number;
  /** Semiángulo del abanico en radianes. */
  spread: number;
  shotSpeed: number;
  shotDmg: number;
  /** Longitud del aviso en píxeles. */
  range: number;
}

interface RawTypes {
  charger: ChargerCfg;
  fan: FanCfg;
  swarm: SwarmCfg;
  trail: TrailCfg;
  shield: ShieldCfg;
  teleport: TeleportCfg;
}

/** Invocador de enjambres: marca puntos con un círculo y, al acabar el aviso, brotan motas en ellos. */
export interface SwarmCfg extends BaseCfg {
  keepDistance: number;
  spots: number;
  spotsLow: number;
  spotRadius: number;
  /** Distancia mínima y máxima de los puntos al jugador. */
  spotDist: [number, number];
  perSpot: number;
  /** Máximo de motas vivas a la vez. */
  maxAlive: number;
}

/** Rastro de zonas: persigue al jugador y va dejando charcos que avisan antes de hacer daño. */
export interface TrailCfg extends BaseCfg {
  zoneRadius: number;
  zoneLife: number;
  zoneDmg: number;
  /** Segundos entre golpes mientras se pisa una zona. */
  zoneTick: number;
  maxZones: number;
  /** Con poca vida marca además el sitio del jugador cada `aimEvery` s. */
  aimEvery: number;
}

/** Escudo giratorio: un arco de escudo gira a su alrededor y bloquea el daño que viene de ese lado. */
export interface ShieldCfg extends BaseCfg {
  /** Semiancho del escudo en radianes. */
  arc: number;
  spin: number;
  spinLow: number;
  /** Fracción del daño que pasa por el escudo. */
  blockMult: number;
  bashTrigger: number;
  bashRange: number;
  bashSpread: number;
  bashDmg: number;
}

/** Teletransportador: desaparece, avisa dónde reaparecer y golpea en círculo al llegar. */
export interface TeleportCfg extends BaseCfg {
  hopDist: [number, number];
  blastRadius: number;
  blastDmg: number;
}

interface RawMinibosses {
  times: number[];
  timeLimit: number;
  dpsWindow: number;
  fallbackDps: number;
  rarityWeights: number[][];
  /** Tipos de minijefe de cada tramo de la campaña. */
  pools: MiniType[][];
  types: RawTypes;
}

export const MINI = (raw as unknown as { minibosses: RawMinibosses }).minibosses;

export type MiniType = keyof RawTypes;
/** Tipos con una mecánica que merece un aviso la primera vez que aparece. */
export type HintedMini = Exclude<MiniType, 'charger' | 'fan'>;
/** Todos los tipos; añadir uno nuevo = una entrada aquí, otra en el JSON (tipos y pools) y una rama en `Minibosses`. */
export const MINI_TYPES: readonly MiniType[] = ['charger', 'fan', 'swarm', 'trail', 'shield', 'teleport'];

const TIERS = (raw as unknown as { tiers: { from: number; to: number }[] }).tiers;
const tierIndexOf = (night: number) => Math.max(0, TIERS.findIndex((t) => night >= t.from && night <= t.to));

/** Tipo de minijefe de una aparición: sale del pool del tramo y nunca repite el anterior. */
export function miniTypeFor(night: number, slot: number): MiniType {
  return pickMiniType(MINI.pools, tierIndexOf, night, slot, MINI.times.length);
}

export function rollRarity(tierIndex: number, rnd: () => number = Math.random): TalismanRarity {
  const weights = MINI.rarityWeights[Math.min(tierIndex, MINI.rarityWeights.length - 1)] ?? [1, 0, 0, 0];
  const total = weights.reduce((a, w) => a + w, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i as TalismanRarity;
  }
  return 0;
}

/** Vida del minijefe según el DPS medido; `hpMod` es el escalado de vida de la noche. */
export function adaptiveHp(type: MiniType, dps: number, hpMod: number): number {
  const rule = MINI.types[type].hp;
  const target = (dps >= 1 ? dps : MINI.fallbackDps) * rule.k;
  return Math.round(Math.min(rule.max * hpMod, Math.max(rule.min * hpMod, target)));
}

/** Coherencia del JSON de minijefes (se ejecuta en desarrollo). */
export function validateMinibosses(): string[] {
  const errors: string[] = [];
  for (const t of MINI_TYPES) {
    const c = MINI.types[t];
    if (!c) errors.push(`minijefe ${t}: falta en el JSON`);
    else {
      if (!(c.hp.min > 0 && c.hp.max >= c.hp.min)) errors.push(`minijefe ${t}: hp min/max inválidos`);
      if (c.windup < 0.5 || c.windup > 1 || c.windupChain < 0.5 || c.windupChain > 1)
        errors.push(`minijefe ${t}: el aviso debe durar entre 0,5 y 1 s`);
    }
  }
  if (MINI.rarityWeights.some((w) => w.length !== 4)) errors.push('rarityWeights: 4 pesos por tramo');
  if (MINI.pools.length !== TIERS.length) errors.push(`pools: se esperaba un pool por tramo (${TIERS.length})`);
  MINI.pools.forEach((pool, i) => {
    if (pool.length < 2) errors.push(`pools[${i}]: mínimo 2 tipos para no repetir seguidos`);
    for (const t of pool) if (!MINI_TYPES.includes(t)) errors.push(`pools[${i}]: tipo desconocido ${t}`);
  });
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateMinibosses();
  if (errs.length) console.error('[campaign.json minibosses]', errs);
}
