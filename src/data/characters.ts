import type { CharacterDef } from './types';
import type { TranslationKey } from '@/i18n';

export interface CharacterMeta extends CharacterDef {
  descKey: TranslationKey;
  /** Mods base permanentes del personaje. */
  mods?: Partial<{ maxHp: number; speed: number; damage: number; magnet: number; cooldown: number; armor: number; regen: number }>;
  /** Coste en Chispas (0 = gratis). 'streak' = recompensa de racha día 7. */
  cost: number | 'streak';
  color: number;
}

export const CHARACTERS: readonly CharacterMeta[] = [
  {
    id: 'ember',
    nameKey: 'c_ember',
    descKey: 'c_ember_desc',
    weaponId: 'spark',
    base: { maxHp: 100, speed: 165, magnet: 70, armor: 0, regen: 0 },
    cost: 0,
    color: 0xffa640,
  },
  {
    id: 'brasa',
    nameKey: 'c_brasa',
    descKey: 'c_brasa_desc',
    weaponId: 'embers',
    base: { maxHp: 120, speed: 150, magnet: 70, armor: 0, regen: 0.4 },
    mods: { speed: -0.05 },
    cost: 500,
    color: 0xff7a3d,
  },
  {
    id: 'iris',
    nameKey: 'c_iris',
    descKey: 'c_iris_desc',
    weaponId: 'orbs',
    base: { maxHp: 90, speed: 170, magnet: 70, armor: 0, regen: 0 },
    mods: { magnet: 0.5 },
    cost: 800,
    color: 0xc78bff,
  },
  {
    id: 'fenix',
    nameKey: 'c_fenix',
    descKey: 'c_fenix_desc',
    weaponId: 'nova',
    base: { maxHp: 110, speed: 165, magnet: 80, armor: 0, regen: 0.6 },
    mods: { damage: 0.1 },
    cost: 'streak',
    color: 0xffd38a,
  },
];

export const CHARACTER_BY_ID: Record<string, CharacterMeta> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
