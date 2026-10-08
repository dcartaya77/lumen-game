import raw from './balance/heroes.json';
import { CHARACTER_BY_ID, CHARACTERS } from './characters';
import type { WeaponTweak } from './heroTweak';
import { levelRegressions, tweakLevels } from './heroTweak';
import { PASSIVE_BY_ID } from './passives';
import type { UpgradeOption, WeaponDef } from './types';
import { WEAPON_BY_ID } from './weapons';

interface RawHeroes {
  /** La primera subida de nivel siempre ofrece algo ofensivo: un arma (nueva o mejora) o una de estas pasivas. */
  firstLevelUp: { offensivePassives: string[] };
  /** Ajuste del arma inicial y mods extra (se suman a los del héroe) por id de héroe; vacío = sin ajuste. */
  heroes: Record<string, { weapon?: WeaponTweak; mods?: Partial<Record<ModKey, number>> }>;
}

export type ModKey = 'maxHp' | 'speed' | 'damage' | 'magnet' | 'cooldown' | 'armor' | 'regen';
const MOD_KEYS: readonly ModKey[] = ['maxHp', 'speed', 'damage', 'magnet', 'cooldown', 'armor', 'regen'];

export const HEROES = raw as unknown as RawHeroes;

/** Mods extra de heroes.json para un héroe (p. ej. imanes de XP para quien mata lejos). */
export function heroMods(heroId: string): Partial<Record<ModKey, number>> {
  return HEROES.heroes[heroId]?.mods ?? {};
}

// Para afinar sin recargar: `__heroes.heroes.iris.weapon = {...}` y empezar una partida nueva.
if (import.meta.env.DEV) (window as unknown as { __heroes?: RawHeroes }).__heroes = HEROES;

/** Arma inicial de un héroe con su ajuste de heroes.json aplicado (misma id: evoluciones y skins siguen igual). */
export function heroWeaponDef(heroId: string, base: WeaponDef): WeaponDef {
  const tw = HEROES.heroes[heroId]?.weapon;
  if (!tw) return base;
  return { ...base, ...tw.def, levels: tweakLevels(base.levels, tw) };
}

/** ¿Es una opción ofensiva? Un arma (nueva o mejora) o una pasiva de daño/cadencia. */
export function isOffensiveOption(o: UpgradeOption): boolean {
  return o.kind === 'weapon' || (o.kind === 'passive' && HEROES.firstLevelUp.offensivePassives.includes(o.id));
}

/** Coherencia de heroes.json (se ejecuta en desarrollo): héroes conocidos y completos, y ningún nivel peor que el anterior. */
export function validateHeroes(): string[] {
  const errs: string[] = [];
  for (const c of CHARACTERS) if (!(c.id in HEROES.heroes)) errs.push(`falta ${c.id} en heroes.json`);
  for (const [id, h] of Object.entries(HEROES.heroes)) {
    const c = CHARACTER_BY_ID[id];
    if (!c) {
      errs.push(`héroe desconocido ${id}`);
      continue;
    }
    for (const k of Object.keys(h.mods ?? {})) if (!MOD_KEYS.includes(k as ModKey)) errs.push(`${id}: mod desconocido ${k}`);
    if (!h.weapon) continue;
    for (const e of levelRegressions(heroWeaponDef(id, WEAPON_BY_ID[c.weaponId]!).levels)) errs.push(`${id}: ${e}`);
  }
  for (const id of HEROES.firstLevelUp.offensivePassives) if (!PASSIVE_BY_ID[id]) errs.push(`pasiva desconocida ${id}`);
  return errs;
}

if (import.meta.env.DEV) {
  const errs = validateHeroes();
  if (errs.length) console.error('[heroes.json]', errs);
}
