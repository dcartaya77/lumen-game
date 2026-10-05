import { dailyChallenge, weeklyEvent } from '@/data/events';
import { META_UPGRADES, xpLuckBonus } from '@/data/meta';
import { mergeMods, NO_MODS, type RunModifiers } from '@/data/types';
import type { GameOptions } from '@/game/Game';
import type { Modifiers } from '@/game/Player';
import type { SaveData } from './save-schema';

export type RunMode = 'normal' | 'challenge' | 'weekly';

/**
 * Traduce el guardado y el modo elegido a las opciones del motor:
 * mejoras permanentes de la tienda, modificadores del reto diario o del
 * evento semanal, bonus de XP por suerte y bonus de Chispas.
 */
export function runOptionsFor(data: SaveData, mode: RunMode): GameOptions {
  const p = data.profile;
  const metaMods: Partial<Modifiers> = {};
  for (const u of META_UPGRADES) {
    const level = p.upgrades[u.id] ?? 0;
    if (level > 0 && u.perLevel > 0) metaMods[u.stat] = (metaMods[u.stat] ?? 0) + level * u.perLevel;
  }

  let mods: RunModifiers = NO_MODS;
  let sparkBonus = 1;
  let mapId = p.selected.m;
  let challengeTarget: number | undefined;
  if (mode === 'challenge') {
    const ch = dailyChallenge();
    mods = mergeMods(NO_MODS, ch.modifier.mods);
    mapId = ch.mapId;
    challengeTarget = ch.targetTime;
  } else if (mode === 'weekly') {
    const w = weeklyEvent();
    mods = mergeMods(NO_MODS, w.mods);
    sparkBonus = w.sparkBonus;
  }

  return {
    characterId: p.selected.c,
    mapId,
    sound: p.settings.sound,
    haptics: p.settings.haptics,
    mods,
    metaMods,
    xpMult: (1 + xpLuckBonus(p.upgrades.m_luck ?? 0)) * mods.xp,
    sparkBonus,
    ...(challengeTarget !== undefined ? { challengeTarget } : {}),
  };
}
