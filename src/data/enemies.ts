import type { EnemyDef } from './types';

/** Hito 2: enemigo base. Los 8 tipos, élites y jefe llegan en el hito 3. */
export const ENEMIES: readonly EnemyDef[] = [
  {
    id: 'shade',
    nameKey: 'e_shade',
    hp: 18,
    speed: 72,
    dmg: 8,
    radius: 11,
    xp: 1,
    eyeColor: 0xff4d6d,
    tint: 0xffffff,
    scale: 1,
  },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
