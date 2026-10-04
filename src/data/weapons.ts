import type { WeaponDef } from './types';

export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;

/** Hito 2: una sola arma. Las otras cinco y las evoluciones llegan en el hito 3. */
export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'spark',
    nameKey: 'w_spark',
    descKey: 'w_spark_desc',
    behavior: 'projectile',
    color: 0xffe9a8,
    range: 420,
    levels: [
      { dmg: 12, cooldown: 0.85, count: 1, speed: 520, pierce: 1, size: 1, note: 'lv_new' },
      { dmg: 12, cooldown: 0.85, count: 2, speed: 520, pierce: 1, size: 1, note: 'lv_count' },
      { dmg: 17, cooldown: 0.75, count: 2, speed: 540, pierce: 1, size: 1.1, note: 'lv_dmg' },
      { dmg: 17, cooldown: 0.75, count: 3, speed: 560, pierce: 2, size: 1.1, note: 'lv_count' },
      { dmg: 24, cooldown: 0.6, count: 3, speed: 600, pierce: 2, size: 1.25, note: 'lv_cd' },
    ],
  },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
