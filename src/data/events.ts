import type { TranslationKey } from '@/i18n';
import { seedFromString, seededRng } from '@/game/core/rng';
import { MAPS } from './maps';
import type { RunModifiers } from './types';
import { todayKey } from '@/state/save-schema';

export interface EventDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  mods: Partial<RunModifiers>;
  /** Multiplicador de Chispas al jugar con el evento activo. */
  sparkBonus: number;
}

/** Modificadores semanales: rotan por semana del calendario. */
export const WEEKLY_EVENTS: readonly EventDef[] = [
  { id: 'storm', nameKey: 'ev_storm', descKey: 'ev_storm_desc', mods: { enemySpeed: 1.3 }, sparkBonus: 1.2 },
  { id: 'tide', nameKey: 'ev_tide', descKey: 'ev_tide_desc', mods: { spawnRate: 1.4, xp: 1.15 }, sparkBonus: 1.15 },
  { id: 'dim', nameKey: 'ev_dim', descKey: 'ev_dim_desc', mods: { playerDamage: 0.8 }, sparkBonus: 1.25 },
  { id: 'cursed', nameKey: 'ev_cursed', descKey: 'ev_cursed_desc', mods: { enemyHp: 1.35 }, sparkBonus: 1.2 },
];

/** Modificadores del reto diario (distintos de los semanales). */
export const DAILY_MODIFIERS: readonly EventDef[] = [
  { id: 'd_fast', nameKey: 'ev_storm', descKey: 'ev_storm_desc', mods: { enemySpeed: 1.35 }, sparkBonus: 1 },
  { id: 'd_tough', nameKey: 'ev_tough', descKey: 'ev_tough_desc', mods: { enemyHp: 1.5, enemyDmg: 1.2 }, sparkBonus: 1 },
  { id: 'd_swarm', nameKey: 'ev_tide', descKey: 'ev_tide_desc', mods: { spawnRate: 1.5 }, sparkBonus: 1 },
  { id: 'd_glass', nameKey: 'ev_glass', descKey: 'ev_glass_desc', mods: { playerDamage: 1.3, enemyDmg: 1.4 }, sparkBonus: 1 },
  { id: 'd_starved', nameKey: 'ev_starved', descKey: 'ev_starved_desc', mods: { xp: 0.7 }, sparkBonus: 1 },
  { id: 'd_greed', nameKey: 'ev_greed', descKey: 'ev_greed_desc', mods: { xp: 1.4, enemyHp: 1.2 }, sparkBonus: 1 },
];

export interface DailyChallenge {
  day: string;
  mapId: string;
  modifier: EventDef;
  /** Segundos mínimos a sobrevivir para superarlo. */
  targetTime: number;
  reward: number;
}

/** Reto diario determinista: todos los jugadores reciben el mismo sin servidor. */
export function dailyChallenge(dayKey = todayKey()): DailyChallenge {
  const rng = seededRng(seedFromString(`challenge:${dayKey}`));
  const map = MAPS[Math.floor(rng() * MAPS.length)]!;
  const modifier = DAILY_MODIFIERS[Math.floor(rng() * DAILY_MODIFIERS.length)]!;
  const targetTime = 150 + Math.floor(rng() * 4) * 30; // 2:30 a 4:00
  return { day: dayKey, mapId: map.id, modifier, targetTime, reward: 150 };
}

/** Evento semanal activo según la semana del año. */
export function weeklyEvent(date = new Date()): EventDef {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.floor((date.getTime() - startOfYear.getTime()) / (7 * 864e5));
  return WEEKLY_EVENTS[week % WEEKLY_EVENTS.length]!;
}

/** Semana en curso "YYYY-Www" para saber si la racha ya se reparó esta semana. */
export function weekKey(date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.floor((date.getTime() - startOfYear.getTime()) / (7 * 864e5));
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
