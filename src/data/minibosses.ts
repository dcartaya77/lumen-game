import raw from './balance/campaign.json';

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

interface RawMinibosses {
  times: number[];
  timeLimit: number;
  dpsWindow: number;
  fallbackDps: number;
  rarityWeights: number[][];
  types: { charger: ChargerCfg; fan: FanCfg };
}

export const MINI = (raw as unknown as { minibosses: RawMinibosses }).minibosses;

export type MiniType = keyof RawMinibosses['types'];
/** Orden de rotación entre noches; añadir un tipo nuevo = una entrada aquí y otra en el JSON. */
export const MINI_TYPES: readonly MiniType[] = ['charger', 'fan'];

/** Tipo de minijefe de una noche: alterna para que los dos de una noche sean distintos. */
export function miniTypeFor(night: number, slot: number): MiniType {
  return MINI_TYPES[(night + slot) % MINI_TYPES.length]!;
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
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateMinibosses();
  if (errs.length) console.error('[campaign.json minibosses]', errs);
}
