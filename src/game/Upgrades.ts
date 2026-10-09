import { ensureMatch } from '@/data/ensureMatch';
import { PASSIVE_BY_ID, PASSIVES } from '@/data/passives';
import type { UpgradeOption } from '@/data/types';
import { BASE_WEAPONS, MAX_PASSIVES, MAX_WEAPONS, WEAPON_BY_ID } from '@/data/weapons';
import { shuffleTake } from './core/math';
import type { Player } from './Player';

/** Evoluciones disponibles ahora mismo: arma al máximo + pasiva requerida en posesión. */
export function availableEvolutions(player: Player): UpgradeOption[] {
  const out: UpgradeOption[] = [];
  for (const slot of player.weapons) {
    const evo = slot.def.evolution;
    if (!evo || slot.level < slot.def.levels.length || !player.passives.has(evo.requires)) continue;
    const into = WEAPON_BY_ID[evo.into]!;
    out.push({
      id: into.id,
      kind: 'evolution',
      nameKey: into.nameKey,
      descKey: into.descKey,
      note: 'lv_evolve',
      level: 1,
      maxLevel: 1,
      color: into.color,
      from: slot.def.id,
    });
  }
  return out;
}

/**
 * Candidatas = armas/pasivas que el jugador puede subir o adquirir.
 * Si ya tiene 4 armas (o 4 pasivas) solo se ofrecen mejoras de las que posee.
 * Una evolución disponible siempre ocupa la primera posición. Con `guarantee`, al menos una opción del resultado la cumple (si el pool lo permite).
 */
export function rollUpgrades(player: Player, count = 3, exclude: string[] = [], guarantee?: (o: UpgradeOption) => boolean): UpgradeOption[] {
  const evolutions = availableEvolutions(player).filter((e) => !exclude.includes(e.id));
  const pool: UpgradeOption[] = [];
  const weaponSlotsFree = player.weapons.length < MAX_WEAPONS;
  const passiveSlotsFree = player.passives.size < MAX_PASSIVES;

  for (const w of BASE_WEAPONS) {
    const lv = player.weaponLevel(w.id);
    const owned = player.weapons.some((s) => s.def.id === w.id || s.def.id === w.evolution?.into);
    if (lv >= w.levels.length || (!owned && !weaponSlotsFree) || exclude.includes(w.id)) continue;
    // Si ya tiene la forma evolucionada, el arma base no vuelve a aparecer.
    if (w.evolution && player.weapons.some((s) => s.def.id === w.evolution!.into)) continue;
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
  const picked = shuffleTake(pool, count - Math.min(1, evolutions.length));
  const final = guarantee ? ensureMatch(picked, pool, guarantee) : picked;
  return evolutions.length ? [evolutions[0]!, ...final] : final;
}

export function applyUpgrade(player: Player, option: UpgradeOption): void {
  if (option.kind === 'evolution') {
    player.evolveWeapon(option.from!, WEAPON_BY_ID[option.id]!);
  } else if (option.kind === 'weapon') {
    player.addWeapon(WEAPON_BY_ID[option.id]!);
  } else {
    const def = PASSIVE_BY_ID[option.id]!;
    player.addPassive(def.id, def.stat, def.perLevel);
  }
}
