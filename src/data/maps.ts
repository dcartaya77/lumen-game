import type { TranslationKey } from '@/i18n';

export interface MapTheme {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  /** Coste en Chispas (0 = gratis). */
  cost: number;
  /** Colores del tema. */
  ground: number;
  motes: number;
  glow: number;
  /** Multiplicador pequeño de dificultad opcional. */
  sparkBonus: number;
}

export const MAPS: readonly MapTheme[] = [
  { id: 'forest', nameKey: 'map_forest', descKey: 'map_forest_desc', cost: 0, ground: 0x0b0a14, motes: 0x3a3357, glow: 0xffa640, sparkBonus: 1 },
  { id: 'ruins', nameKey: 'map_ruins', descKey: 'map_ruins_desc', cost: 300, ground: 0x100d1a, motes: 0x4a3a6e, glow: 0xc78bff, sparkBonus: 1.05 },
  { id: 'crystal', nameKey: 'map_crystal', descKey: 'map_crystal_desc', cost: 600, ground: 0x08101a, motes: 0x2a5a7a, glow: 0x8ff0ff, sparkBonus: 1.1 },
  { id: 'neon', nameKey: 'map_neon', descKey: 'map_neon_desc', cost: 600, ground: 0x140814, motes: 0x6e2a5a, glow: 0xff2e8b, sparkBonus: 1.1 },
];

/** Solo de campaña (tramo final): no está en MAPS para no alterar la tienda ni el reto diario. */
export const VOID_MAP: MapTheme = {
  id: 'void',
  nameKey: 'map_void',
  descKey: 'map_void_desc',
  cost: 0,
  ground: 0x050309,
  motes: 0x3a1f6e,
  glow: 0xb04dff,
  sparkBonus: 1.1,
};

export const MAP_BY_ID: Record<string, MapTheme> = Object.fromEntries([...MAPS, VOID_MAP].map((m) => [m.id, m]));
