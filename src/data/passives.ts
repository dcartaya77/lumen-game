import type { PassiveDef } from './types';

export const PASSIVES: readonly PassiveDef[] = [
  { id: 'vigor', nameKey: 'p_vigor', descKey: 'p_vigor_desc', stat: 'maxHp', perLevel: 0.2, maxLevel: 5, color: 0xff6b6b },
  { id: 'swift', nameKey: 'p_swift', descKey: 'p_swift_desc', stat: 'speed', perLevel: 0.1, maxLevel: 5, color: 0x8ff0ff },
  { id: 'might', nameKey: 'p_might', descKey: 'p_might_desc', stat: 'damage', perLevel: 0.12, maxLevel: 5, color: 0xffa640 },
  { id: 'lodestone', nameKey: 'p_lodestone', descKey: 'p_lodestone_desc', stat: 'magnet', perLevel: 0.35, maxLevel: 5, color: 0xc78bff },
  { id: 'haste', nameKey: 'p_haste', descKey: 'p_haste_desc', stat: 'cooldown', perLevel: 0.08, maxLevel: 5, color: 0xfff3c4 },
  { id: 'bark', nameKey: 'p_bark', descKey: 'p_bark_desc', stat: 'armor', perLevel: 1, maxLevel: 5, color: 0xa3d977 },
];

export const PASSIVE_BY_ID: Record<string, PassiveDef> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));
