import type { TranslationKey } from '@/i18n';
import type { ProfileShard } from '@/state/save-schema';
import type { PassiveStat } from './types';

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';
/** Qué personaliza la skin. `flame` vale para todos los personajes. */
export type SkinTarget = 'flame' | 'weapon' | 'death' | 'levelup' | 'frame';

export type SkinUnlock =
  | { type: 'free' }
  | { type: 'sparks'; cost: number }
  | { type: 'frags'; cost: number }
  /** Barra de progreso: `count` anuncios vistos (repartibles en varios días). */
  | { type: 'ads'; count: number };

export interface SkinVisual {
  /** Color principal (tinte de llama / proyectil / partículas). */
  color: number;
  /** Color secundario (halo, estela). */
  glow: number;
  /** Estela de partículas al moverse (legendarias). */
  trail?: boolean;
  /** Variación del sonido del arma (semitonos relativos). */
  pitch?: number;
  /** Forma de onda alternativa para el sonido del arma. */
  wave?: OscillatorType;
  /** Multiplicador de partículas en efectos de muerte / nivel-up. */
  particles?: number;
  /** Clase CSS del marco en la tarjeta de resultados. */
  css?: string;
}

export interface SkinDef {
  id: string;
  nameKey: TranslationKey;
  rarity: SkinRarity;
  target: SkinTarget;
  /** Para skins de arma: id del arma base a la que aplica. */
  weaponId?: string;
  unlock: SkinUnlock;
  visual: SkinVisual;
  /** Bonus pasivo pequeño (≤ 2%) para que sea deseable sin romper el equilibrio. */
  bonus?: { stat: PassiveStat; value: number };
}

export const SKINS: readonly SkinDef[] = [
  /* ---------- Llama: 3 por rareza ---------- */
  { id: 'f_ember', nameKey: 'sk_f_ember', rarity: 'common', target: 'flame', unlock: { type: 'free' }, visual: { color: 0xffa640, glow: 0xffa640 } },
  { id: 'f_cobalt', nameKey: 'sk_f_cobalt', rarity: 'common', target: 'flame', unlock: { type: 'sparks', cost: 150 }, visual: { color: 0x6fb8ff, glow: 0x4f8fff } },
  { id: 'f_moss', nameKey: 'sk_f_moss', rarity: 'common', target: 'flame', unlock: { type: 'sparks', cost: 150 }, visual: { color: 0xa3ff8f, glow: 0x5fd47a } },
  { id: 'f_rose', nameKey: 'sk_f_rose', rarity: 'rare', target: 'flame', unlock: { type: 'sparks', cost: 600 }, visual: { color: 0xff7ab8, glow: 0xff2e8b }, bonus: { stat: 'speed', value: 0.01 } },
  { id: 'f_violet', nameKey: 'sk_f_violet', rarity: 'rare', target: 'flame', unlock: { type: 'frags', cost: 12 }, visual: { color: 0xc78bff, glow: 0x8a4dff }, bonus: { stat: 'magnet', value: 0.02 } },
  { id: 'f_frost', nameKey: 'sk_f_frost', rarity: 'rare', target: 'flame', unlock: { type: 'frags', cost: 12 }, visual: { color: 0xdff8ff, glow: 0x8ff0ff }, bonus: { stat: 'maxHp', value: 0.02 } },
  { id: 'f_gold', nameKey: 'sk_f_gold', rarity: 'epic', target: 'flame', unlock: { type: 'ads', count: 5 }, visual: { color: 0xffe066, glow: 0xffd700 }, bonus: { stat: 'damage', value: 0.02 } },
  { id: 'f_abyss', nameKey: 'sk_f_abyss', rarity: 'epic', target: 'flame', unlock: { type: 'ads', count: 5 }, visual: { color: 0x9b7bff, glow: 0x6a4ad8 }, bonus: { stat: 'armor', value: 0.5 } },
  { id: 'f_coral', nameKey: 'sk_f_coral', rarity: 'epic', target: 'flame', unlock: { type: 'ads', count: 5 }, visual: { color: 0xff8f6b, glow: 0xff5a3d }, bonus: { stat: 'regen', value: 0.1 } },
  { id: 'f_aurora', nameKey: 'sk_f_aurora', rarity: 'legendary', target: 'flame', unlock: { type: 'ads', count: 10 }, visual: { color: 0x9dffd0, glow: 0x6a9bff, trail: true }, bonus: { stat: 'speed', value: 0.02 } },
  { id: 'f_nova', nameKey: 'sk_f_nova', rarity: 'legendary', target: 'flame', unlock: { type: 'ads', count: 10 }, visual: { color: 0xfff6d6, glow: 0xffb347, trail: true }, bonus: { stat: 'damage', value: 0.02 } },
  { id: 'f_void', nameKey: 'sk_f_void', rarity: 'legendary', target: 'flame', unlock: { type: 'ads', count: 10 }, visual: { color: 0xff3d7a, glow: 0x7a00ff, trail: true }, bonus: { stat: 'magnet', value: 0.02 } },

  /* ---------- Armas: cambian color y sonido, no el daño ---------- */
  { id: 'w_spark_gold', nameKey: 'sk_w_spark_gold', rarity: 'epic', target: 'weapon', weaponId: 'spark', unlock: { type: 'ads', count: 5 }, visual: { color: 0xffd700, glow: 0xffd700, pitch: 4 } },
  { id: 'w_embers_blue', nameKey: 'sk_w_embers_blue', rarity: 'epic', target: 'weapon', weaponId: 'embers', unlock: { type: 'ads', count: 5 }, visual: { color: 0x4fa8ff, glow: 0x4fa8ff, wave: 'sine' } },
  { id: 'w_orbs_galaxy', nameKey: 'sk_w_orbs_galaxy', rarity: 'legendary', target: 'weapon', weaponId: 'orbs', unlock: { type: 'ads', count: 10 }, visual: { color: 0xe0b0ff, glow: 0x6a3dff, trail: true, pitch: -3 } },
  { id: 'w_beam_crimson', nameKey: 'sk_w_beam_crimson', rarity: 'rare', target: 'weapon', weaponId: 'beam', unlock: { type: 'sparks', cost: 500 }, visual: { color: 0xff4d6d, glow: 0xff4d6d, pitch: -5, wave: 'square' } },
  { id: 'w_fireflies_ice', nameKey: 'sk_w_fireflies_ice', rarity: 'rare', target: 'weapon', weaponId: 'fireflies', unlock: { type: 'frags', cost: 10 }, visual: { color: 0xbff4ff, glow: 0x8ff0ff, pitch: 7 } },
  { id: 'w_nova_sun', nameKey: 'sk_w_nova_sun', rarity: 'legendary', target: 'weapon', weaponId: 'nova', unlock: { type: 'ads', count: 10 }, visual: { color: 0xfff0a0, glow: 0xffa640, pitch: 2, wave: 'triangle' } },

  /* ---------- Efectos de muerte y de nivel-up ---------- */
  { id: 'd_default', nameKey: 'sk_d_default', rarity: 'common', target: 'death', unlock: { type: 'free' }, visual: { color: 0, glow: 0 } },
  { id: 'd_stars', nameKey: 'sk_d_stars', rarity: 'rare', target: 'death', unlock: { type: 'sparks', cost: 400 }, visual: { color: 0xfff3c4, glow: 0xffd700, particles: 1.4 } },
  { id: 'd_ink', nameKey: 'sk_d_ink', rarity: 'epic', target: 'death', unlock: { type: 'ads', count: 5 }, visual: { color: 0x7a3dff, glow: 0xb06bff, particles: 1.8 } },
  { id: 'l_default', nameKey: 'sk_l_default', rarity: 'common', target: 'levelup', unlock: { type: 'free' }, visual: { color: 0xffe9a8, glow: 0xffe9a8 } },
  { id: 'l_bloom', nameKey: 'sk_l_bloom', rarity: 'rare', target: 'levelup', unlock: { type: 'frags', cost: 8 }, visual: { color: 0xff7ab8, glow: 0xa3ff8f, particles: 1.6 } },
  { id: 'l_thunder', nameKey: 'sk_l_thunder', rarity: 'epic', target: 'levelup', unlock: { type: 'ads', count: 5 }, visual: { color: 0x8ff0ff, glow: 0xffffff, particles: 2.2 } },

  /* ---------- Marcos para la tarjeta de resultados ---------- */
  { id: 'r_plain', nameKey: 'sk_r_plain', rarity: 'common', target: 'frame', unlock: { type: 'free' }, visual: { color: 0, glow: 0, css: '' } },
  { id: 'r_ember', nameKey: 'sk_r_ember', rarity: 'rare', target: 'frame', unlock: { type: 'sparks', cost: 300 }, visual: { color: 0xffa640, glow: 0xffa640, css: 'frame-ember' } },
  { id: 'r_aurora', nameKey: 'sk_r_aurora', rarity: 'legendary', target: 'frame', unlock: { type: 'ads', count: 10 }, visual: { color: 0x9dffd0, glow: 0x6a9bff, css: 'frame-aurora' } },
];

export const SKIN_BY_ID: Record<string, SkinDef> = Object.fromEntries(SKINS.map((s) => [s.id, s]));

/** Skins por defecto (siempre poseídas) para cada objetivo. */
export const DEFAULT_SKIN: Record<Exclude<SkinTarget, 'weapon'>, string> = {
  flame: 'f_ember',
  death: 'd_default',
  levelup: 'l_default',
  frame: 'r_plain',
};

export const RARITY_ORDER: Record<SkinRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

/** Hueco que ocupa una skin: el id del arma para skins de arma, o el objetivo para el resto. */
export function skinSlot(skin: SkinDef): string {
  return skin.target === 'weapon' ? skin.weaponId! : skin.target;
}

export function isSkinOwned(profile: Pick<ProfileShard, 'unlocked'>, skin: SkinDef): boolean {
  return skin.unlock.type === 'free' || profile.unlocked.s.includes(skin.id);
}

/** Skin equipada en un hueco; si la guardada no es válida cae a la de por defecto (o null). */
export function equippedSkin(profile: ProfileShard, slot: string): SkinDef | null {
  const saved = SKIN_BY_ID[profile.selected.skin[slot] ?? ''];
  if (saved && skinSlot(saved) === slot && isSkinOwned(profile, saved)) return saved;
  const fallback = (DEFAULT_SKIN as Record<string, string>)[slot];
  return fallback ? (SKIN_BY_ID[fallback] ?? null) : null;
}

/** Solo las legendarias con efecto en partida se pueden probar con un anuncio. */
export function isTrialable(skin: SkinDef): boolean {
  return skin.rarity === 'legendary' && (skin.target === 'flame' || skin.target === 'weapon');
}
