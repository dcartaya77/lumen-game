import { BOSS } from '@/data/bosses';
import { planNight } from '@/data/campaign';
import { dailyChallenge, weeklyEvent } from '@/data/events';
import { META_UPGRADES, xpLuckBonus } from '@/data/meta';
import { DEFAULT_SKIN, equippedSkin, SKIN_BY_ID, skinSlot, type SkinDef } from '@/data/skins';
import { equippedKeys } from '@/data/talismans';
import { mergeMods, NO_MODS, type RunModifiers } from '@/data/types';
import { WEAPON_BY_ID } from '@/data/weapons';
import { V1_WAVE_CONFIG, type WaveConfig } from '@/data/waves';
import type { GameOptions, GameSkins } from '@/game/Game';
import type { Modifiers } from '@/game/Player';
import { canAutoOffer } from '@/services/ads/AdPolicy';
import { adAvailability } from './adActions';
import type { ProfileShard, SaveData } from './save-schema';
import { consumeTalisman } from './talismanActions';

export type RunMode = 'normal' | 'challenge' | 'weekly' | 'campaign';

/** Noche de campaña en curso y si es una repetición de una ya superada. */
export interface CampaignRun {
  night: number;
  replay: boolean;
}

/** Ventajas de un solo uso para la partida que empieza (impulso inicial, skin de prueba). */
export interface RunBoosts {
  boost: boolean;
  trial: string | null;
}

/**
 * Skins activas de la partida: las equipadas, con la de prueba sustituyendo a la de su hueco.
 * Las skins por defecto no cambian nada (visual = null) para no gastar partículas de más.
 */
function resolveSkins(p: ProfileShard, trial: string | null): { skins: GameSkins; active: SkinDef[] } {
  const bySlot = new Map<string, SkinDef>();
  const slots = new Set<string>(['flame', 'death', 'levelup', ...Object.keys(p.selected.skin)]);
  for (const slot of slots) {
    const s = equippedSkin(p, slot);
    if (s) bySlot.set(slot, s);
  }
  const tried = trial ? SKIN_BY_ID[trial] : undefined;
  if (tried) bySlot.set(skinSlot(tried), tried);

  const skins: GameSkins = { flame: null, death: null, levelup: null, weapons: {} };
  for (const [slot, s] of bySlot) {
    if (s.target === 'weapon') {
      skins.weapons[slot] = s.visual;
      const evolved = WEAPON_BY_ID[slot]?.evolution?.into;
      if (evolved) skins.weapons[evolved] = s.visual;
    } else if (s.target === 'flame' || s.target === 'death' || s.target === 'levelup') {
      if (s.id !== DEFAULT_SKIN[s.target]) skins[s.target] = s.visual;
    }
  }
  return { skins, active: [...bySlot.values()] };
}

/**
 * Traduce el guardado y el modo elegido a las opciones del motor:
 * mejoras permanentes de la tienda, modificadores del reto diario o del
 * evento semanal, bonus de XP por suerte, bonus de Chispas y skins.
 */
export function runOptionsFor(
  data: SaveData,
  mode: RunMode,
  boosts: RunBoosts = { boost: false, trial: null },
  campaign: CampaignRun | null = null,
): GameOptions {
  const p = data.profile;
  const metaMods: Partial<Modifiers> = {};
  for (const u of META_UPGRADES) {
    const level = p.upgrades[u.id] ?? 0;
    if (level > 0 && u.perLevel > 0) metaMods[u.stat] = (metaMods[u.stat] ?? 0) + level * u.perLevel;
  }

  const { skins, active } = resolveSkins(p, boosts.trial);
  for (const s of active) {
    if (s.bonus) metaMods[s.bonus.stat] = (metaMods[s.bonus.stat] ?? 0) + s.bonus.value;
  }

  let mods: RunModifiers = NO_MODS;
  let sparkBonus = 1;
  let mapId = p.selected.m;
  let challengeTarget: number | undefined;
  let waves: WaveConfig = V1_WAVE_CONFIG;
  let mini: GameOptions['mini'] = null;
  let talismanKeys: string[] = [];
  let boss: GameOptions['boss'] = null;
  let help = 0;
  if (mode === 'campaign' && campaign) {
    const plan = planNight(campaign.night, campaign.replay);
    mods = plan.mods;
    mapId = plan.tier.mapId;
    sparkBonus = plan.sparkMult;
    waves = plan.waves;
    mini = { times: plan.miniTimes, night: plan.night, tier: plan.tier.index };
    talismanKeys = equippedKeys(data.campaign);
    if (plan.bossId) {
      boss = { id: plan.bossId };
      // Cada duelo perdido da algo de vida extra al siguiente intento (hasta un tope).
      help = Math.min(BOSS.help.maxLosses, data.campaign.bl) * BOSS.help.perLoss;
    }
  } else if (mode === 'challenge') {
    const ch = dailyChallenge();
    mods = mergeMods(NO_MODS, ch.modifier.mods);
    mapId = ch.mapId;
    challengeTarget = ch.targetTime;
  } else if (mode === 'weekly') {
    const w = weeklyEvent();
    mods = mergeMods(NO_MODS, w.mods);
    sparkBonus = w.sparkBonus;
  }

  return {
    characterId: p.selected.c,
    mapId,
    sound: p.settings.sound,
    music: p.settings.music,
    tutorial: !p.tut,
    haptics: p.settings.haptics,
    mods,
    metaMods,
    xpMult: (1 + xpLuckBonus(p.upgrades.m_luck ?? 0)) * mods.xp,
    sparkBonus,
    skins,
    boost: boosts.boost,
    waves,
    mini,
    talismans: { keys: talismanKeys, onUse: consumeTalisman },
    canOfferPick: () => adAvailability('talisman_pick').state === 'ready' && canAutoOffer(),
    boss,
    help,
    night: mode === 'campaign' && campaign ? campaign.night : null,
    replay: mode === 'campaign' && campaign ? campaign.replay : false,
    ...(challengeTarget !== undefined ? { challengeTarget } : {}),
  };
}
