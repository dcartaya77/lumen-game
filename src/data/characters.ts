import type { CharacterDef } from './types';

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'ember',
    nameKey: 'c_ember',
    weaponId: 'spark',
    base: { maxHp: 100, speed: 165, magnet: 70, armor: 0, regen: 0 },
  },
];

export const CHARACTER_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
