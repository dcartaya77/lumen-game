import type { TranslationKey } from '@/i18n';
import { metaCosts } from './economy';
import type { PassiveStat } from './types';

export interface MetaUpgradeDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  stat: PassiveStat;
  /** Valor por nivel; `xp` se traduce a multiplicador de XP de gemas. */
  perLevel: number;
  maxLevel: number;
  /** Coste del nivel n (1..maxLevel). */
  cost: number[];
  color: number;
}

/** Mejoras permanentes de la tienda. Se aplican como mods base al empezar la partida. */
export const META_UPGRADES: readonly MetaUpgradeDef[] = [
  { id: 'm_vigor', nameKey: 'mu_vigor', descKey: 'mu_vigor_desc', stat: 'maxHp', perLevel: 0.1, maxLevel: 5, cost: metaCosts('m_vigor'), color: 0xff6b6b },
  { id: 'm_power', nameKey: 'mu_power', descKey: 'mu_power_desc', stat: 'damage', perLevel: 0.08, maxLevel: 5, cost: metaCosts('m_power'), color: 0xffa640 },
  { id: 'm_swift', nameKey: 'mu_swift', descKey: 'mu_swift_desc', stat: 'speed', perLevel: 0.05, maxLevel: 5, cost: metaCosts('m_swift'), color: 0x8ff0ff },
  { id: 'm_magnet', nameKey: 'mu_magnet', descKey: 'mu_magnet_desc', stat: 'magnet', perLevel: 0.2, maxLevel: 5, cost: metaCosts('m_magnet'), color: 0xc78bff },
  { id: 'm_bark', nameKey: 'mu_bark', descKey: 'mu_bark_desc', stat: 'armor', perLevel: 0.5, maxLevel: 5, cost: metaCosts('m_bark'), color: 0xa3d977 },
  { id: 'm_regen', nameKey: 'mu_regen', descKey: 'mu_regen_desc', stat: 'regen', perLevel: 0.3, maxLevel: 5, cost: metaCosts('m_regen'), color: 0xffd38a },
  { id: 'm_luck', nameKey: 'mu_luck', descKey: 'mu_luck_desc', stat: 'damage', perLevel: 0, maxLevel: 5, cost: metaCosts('m_luck'), color: 0x9fd8ff },
];

export const META_BY_ID: Record<string, MetaUpgradeDef> = Object.fromEntries(META_UPGRADES.map((u) => [u.id, u]));

/** Suerte: +5% de XP por nivel (se aplica al valor de las gemas, no a mods de stat). */
export function xpLuckBonus(upgradeLevel: number): number {
  return upgradeLevel * 0.05;
}
