import { PASSIVE_BY_ID, PASSIVES } from '@/data/passives';
import type { UpgradeOption } from '@/data/types';
import { MAX_PASSIVES, MAX_WEAPONS, WEAPON_BY_ID, WEAPONS } from '@/data/weapons';
import { shuffleTake } from './core/math';
import type { Player } from './Player';

/**
 * Candidatas = armas/pasivas que el jugador puede subir o adquirir.
 * Si ya tiene 4 armas (o 4 pasivas) solo se ofrecen mejoras de las que posee.
 */
export function rollUpgrades(player: Player, count = 3, exclude: string[] = []): UpgradeOption[] {
  const pool: UpgradeOption[] = [];
  const weaponSlotsFree = player.weapons.length < MAX_WEAPONS;
  const passiveSlotsFree = player.passives.size < MAX_PASSIVES;

  for (const w of WEAPONS) {
    const lv = player.weaponLevel(w.id);
    if (lv >= w.levels.length || (lv === 0 && !weaponSlotsFree) || exclude.includes(w.id)) continue;
    pool.push({
      id: w.id,
      kind: 'weapon',
      nameKey: w.nameKey,
      descKey: w.descKey,
      note: w.levels[lv]!.note,
      level: lv + 1,
      maxLevel: w.levels.length,
      color: w.color,
    });
  }
  for (const p of PASSIVES) {
    const lv = player.passives.get(p.id) ?? 0;
    if (lv >= p.maxLevel || (lv === 0 && !passiveSlotsFree) || exclude.includes(p.id)) continue;
    pool.push({
      id: p.id,
      kind: 'passive',
      nameKey: p.nameKey,
      descKey: p.descKey,
      note: lv === 0 ? 'lv_new' : 'lv_dmg',
      level: lv + 1,
      maxLevel: p.maxLevel,
      color: p.color,
    });
  }
  return shuffleTake(pool, count);
}

export function applyUpgrade(player: Player, option: UpgradeOption): void {
  if (option.kind === 'weapon') {
    player.addWeapon(WEAPON_BY_ID[option.id]!);
  } else {
    const def = PASSIVE_BY_ID[option.id]!;
    player.addPassive(def.id, def.stat, def.perLevel);
  }
}
