import raw from './balance/campaign.json';
import { bossIdFor, type BossId } from './bosses';
import { ENEMY_BY_ID } from './enemies';
import { MAP_BY_ID } from './maps';
import { MINI } from './minibosses';
import { NO_MODS, type RunModifiers, type WaveSegment } from './types';
import { ELITE_IDS, type WaveConfig } from './waves';

/** Escala lineal por noche con tope: valor = min(max, base + perNight * (noche - 1)). */
interface Scale {
  base: number;
  perNight: number;
  max: number;
}

interface RawSegment {
  from: number;
  spawn: Record<string, number>;
  rate: number;
  cap: number;
  burst?: { id: string; n: number };
}

interface RawTier {
  id: string;
  map: string;
  from: number;
  to: number;
  waves: RawSegment[];
}

interface RawCampaign {
  nights: number;
  bossNights: number[];
  eliteTimes: number[];
  scaling: { hp: Scale; speed: Scale; dmg: Scale; count: Scale; sparks: Scale };
  replay: { enemyMult: number; sparksMult: number };
  firstClear: { base: number; perNight: number; bossMult: number };
  stars: { two: number; three: number };
  tiers: RawTier[];
}

const CFG = raw as unknown as RawCampaign;

export const CAMPAIGN_NIGHTS = CFG.nights;
export const BOSS_NIGHTS: readonly number[] = CFG.bossNights;

export interface CampaignTier {
  index: number;
  id: string;
  mapId: string;
  from: number;
  to: number;
  waves: WaveSegment[];
}

const TIERS: CampaignTier[] = CFG.tiers.map((t, index) => ({
  index,
  id: t.id,
  mapId: t.map,
  from: t.from,
  to: t.to,
  // El JSON usa { id: peso } por compacidad; el motor espera [{ id, w }].
  waves: t.waves.map((s) => ({
    from: s.from,
    spawn: Object.entries(s.spawn).map(([id, w]) => ({ id, w })),
    rate: s.rate,
    cap: s.cap,
    ...(s.burst ? { burst: s.burst } : {}),
  })),
}));

export const CAMPAIGN_TIERS: readonly CampaignTier[] = TIERS;

export function isBossNight(night: number): boolean {
  return BOSS_NIGHTS.includes(night);
}

/** Bit del jefe de esa noche en `CampaignShard.bosses` (0 si no es noche de jefe). */
export function bossBit(night: number): number {
  const i = BOSS_NIGHTS.indexOf(night);
  return i < 0 ? 0 : 1 << i;
}

export function tierOf(night: number): CampaignTier {
  return TIERS.find((t) => night >= t.from && night <= t.to) ?? TIERS[TIERS.length - 1]!;
}

export interface NightPlan {
  night: number;
  replay: boolean;
  tier: CampaignTier;
  boss: boolean;
  /** Jefe del duelo que sigue a las olas (null = la noche termina a los 5 minutos). */
  bossId: BossId | null;
  mods: RunModifiers;
  waves: WaveConfig;
  /** Multiplicador de las Chispas de la noche. */
  sparkMult: number;
  /** Bajas para 2 y 3 estrellas. */
  starKills: [number, number];
  /** Segundos en que aparece cada minijefe de la noche. */
  miniTimes: readonly number[];
}

const scale = (s: Scale, night: number) => Math.min(s.max, s.base + s.perNight * (night - 1));

/** Plan de una noche: escalado, olas y recompensas, todo a partir del JSON de balance. */
export function planNight(night: number, replay: boolean): NightPlan {
  const n = Math.min(CAMPAIGN_NIGHTS, Math.max(1, Math.round(night)));
  const tier = tierOf(n);
  const sc = CFG.scaling;
  const r = replay ? CFG.replay.enemyMult : 1;
  const count = scale(sc.count, n) * r;
  return {
    night: n,
    replay,
    tier,
    boss: isBossNight(n),
    bossId: bossIdFor(n),
    mods: {
      ...NO_MODS,
      enemyHp: scale(sc.hp, n) * r,
      enemySpeed: scale(sc.speed, n),
      enemyDmg: scale(sc.dmg, n),
      spawnRate: count,
      capMult: count,
    },
    waves: { waves: tier.waves, eliteTimes: CFG.eliteTimes, eliteIds: ELITE_IDS, bossTime: null },
    sparkMult: scale(sc.sparks, n) * (replay ? CFG.replay.sparksMult : 1),
    starKills: [Math.round(CFG.stars.two * count), Math.round(CFG.stars.three * count)],
    miniTimes: MINI.times,
  };
}

/** 1 = noche superada; 2 y 3 según bajas. */
export function starsFor(kills: number, plan: NightPlan): 1 | 2 | 3 {
  return kills >= plan.starKills[1] ? 3 : kills >= plan.starKills[0] ? 2 : 1;
}

/** Chispas extra la primera vez que se supera una noche (doble en noches de jefe). */
export function firstClearSparks(night: number): number {
  const f = CFG.firstClear;
  return Math.round((f.base + f.perNight * night) * (isBossNight(night) ? f.bossMult : 1));
}

/** Comprueba la coherencia del JSON; se ejecuta en desarrollo para cazar erratas al balancear. */
export function validateCampaign(): string[] {
  const errors: string[] = [];
  const covered = new Set<number>();
  for (const t of TIERS) {
    for (let n = t.from; n <= t.to; n++) covered.add(n);
    if (!MAP_BY_ID[t.mapId]) errors.push(`tier ${t.id}: mapa desconocido ${t.mapId}`);
    if (t.waves[0]?.from !== 0) errors.push(`tier ${t.id}: las olas deben empezar en 0`);
    t.waves.forEach((s, i) => {
      if (i > 0 && s.from <= t.waves[i - 1]!.from) errors.push(`tier ${t.id}: olas desordenadas en ${s.from}`);
      if (s.spawn.length === 0) errors.push(`tier ${t.id}: tramo ${s.from} sin enemigos`);
      for (const e of s.spawn) {
        if (!ENEMY_BY_ID[e.id]) errors.push(`tier ${t.id}: enemigo desconocido ${e.id}`);
        if (!(e.w > 0)) errors.push(`tier ${t.id}: peso inválido para ${e.id}`);
      }
      if (s.burst && !ENEMY_BY_ID[s.burst.id]) errors.push(`tier ${t.id}: burst desconocido ${s.burst.id}`);
    });
  }
  for (let n = 1; n <= CAMPAIGN_NIGHTS; n++) if (!covered.has(n)) errors.push(`noche ${n} sin tramo`);
  for (const b of BOSS_NIGHTS) if (b < 1 || b > CAMPAIGN_NIGHTS) errors.push(`noche de jefe fuera de rango: ${b}`);
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateCampaign();
  if (errs.length) console.error('[campaign.json]', errs);
}
