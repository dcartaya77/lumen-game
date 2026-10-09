import { create } from 'zustand';
import { ACHIEVEMENTS } from '@/data/achievements';
import { BOSS, bossIdFor } from '@/data/bosses';
import { BOSS_NIGHTS, bossBit, CAMPAIGN_NIGHTS, firstClearSparks, planNight, starsFor } from '@/data/campaign';
import { CHARACTER_BY_ID } from '@/data/characters';
import { streakReward } from '@/data/economy';
import { dailyChallenge } from '@/data/events';
import { MAP_BY_ID } from '@/data/maps';
import { META_BY_ID } from '@/data/meta';
import { advanceMission, dailyMissions, MISSION_BY_ID } from '@/data/missions';
import { giveTalisman, inventoryTotal, rollTalisman, TAL, talismanKey, talismanSlots, type TalismanId } from '@/data/talismans';
import { WEAPON_BY_ID } from '@/data/weapons';
import { detectLang, setLang, type Lang, type TranslationKey } from '@/i18n';
import { tg } from '@/platform/telegram';
import { createServices, services } from '@/services/container';
import type { RunResult } from './run';
import type { CampaignRun, RunBoosts, RunMode } from './runOptions';
import { debugEnabled, setDebug } from './debug';
import {
  todayKey,
  yesterdayKey,
  type AdsShard,
  type CampaignShard,
  type DailyShard,
  type ProfileShard,
  type SaveData,
  type StatsShard,
} from './save-schema';

export type Screen =
  | 'boot'
  | 'menu'
  | 'run'
  | 'settings'
  | 'shop'
  | 'characters'
  | 'maps'
  | 'collection'
  | 'daily'
  | 'skins'
  | 'campaign'
  | 'prep'
  | 'ending';

const NO_BOOSTS: RunBoosts = { boost: false, trial: null };

/** Recompensas de derrotar a un jefe de campaña (la primera vez, o las menores al rejugar). */
export interface LastBoss {
  first: boolean;
  sparks: number;
  /** Claves de inventario de los talismanes ganados (exclusivo del jefe y/o talismán de rejugada). */
  talismans: string[];
  /** Skin exclusiva desbloqueada con este jefe (la primera vez que se vence, o la primera tras tenerla pendiente). */
  skin: string | null;
  /** Este jefe acaba de abrir la segunda ranura de talismán. */
  slot: boolean;
}

/** Resumen de la noche de campaña recién terminada (para la pantalla de resultados). */
export interface LastCampaign {
  night: number;
  stars: 1 | 2 | 3;
  /** Primera vez que se supera: da Chispas extra y abre la siguiente noche. */
  first: boolean;
  bonus: number;
  boss: LastBoss | null;
}

interface AppState {
  screen: Screen;
  booted: boolean;
  bootError: string | null;
  lang: Lang;
  /** Espejos de solo lectura del guardado para que React re-renderice. */
  profile: ProfileShard | null;
  stats: StatsShard | null;
  daily: DailyShard | null;
  ads: AdsShard | null;
  campaign: CampaignShard | null;
  /** Logros desbloqueados en la última partida (para mostrarlos en resultados). */
  lastAchievements: string[];
  /** Modo de la próxima partida. */
  runMode: RunMode;
  /** Noche de campaña en curso (null fuera de campaña). */
  runCampaign: CampaignRun | null;
  lastCampaign: LastCampaign | null;
  /** Noche para la que se está eligiendo talismanes (pantalla de preparación). */
  prepNight: number | null;
  /** Talismán ganado fuera de cofre en la última partida (reto diario). */
  lastReward: string | null;
  /** Herramientas de balance (siempre en desarrollo; en producción con el gesto secreto de Ajustes). */
  debug: boolean;
  /** Impulso inicial y skin de prueba que usa la partida en curso (se consumen al empezar). */
  runBoosts: RunBoosts;
  /** Aviso breve en pantalla (anuncio no disponible, etc.). */
  toast: { key: TranslationKey; id: number } | null;

  boot(): Promise<void>;
  go(screen: Screen): void;
  showToast(key: TranslationKey): void;
  /** Selecciona el modo y arranca la partida; `night` solo aplica a la campaña. */
  startRun(mode: RunMode, night?: number): void;
  /** Entrada a una noche de campaña: pasa por la preparación solo si hay talismanes en el inventario. */
  beginNight(night: number): void;
  toggleDebug(): void;
  /** Debug: fija la próxima noche de campaña (1..26) y marca las anteriores como superadas. */
  debugSetNext(next: number): void;
  setLanguage(lang: Lang): void;
  toggleSetting(key: 'sound' | 'music' | 'haptics'): void;
  toggleMute(): void;
  completeTutorial(): void;
  addSparks(n: number): void;
  /** Registra el resultado de una partida: Chispas, récords, misiones, racha, logros. */
  finishRun(result: RunResult): void;
  buyUpgrade(id: string): void;
  unlockCharacter(id: string): boolean;
  unlockMap(id: string): boolean;
  selectCharacter(id: string): void;
  selectMap(id: string): void;
  claimMission(id: string): void;
  resetProgress(): Promise<void>;
}

/** Copia superficial de los shards al store tras cada mutación. */
function mirror(data: SaveData) {
  // `settings` se copia aparte: los selectores que lo leen deben ver una referencia nueva al cambiarlo.
  return {
    profile: { ...data.profile, settings: { ...data.profile.settings } },
    stats: { ...data.stats },
    daily: { ...data.daily },
    ads: { ...data.ads },
    campaign: { ...data.campaign },
  };
}

/** Si cambió el día: misiones nuevas, cofre/ruleta/reto reiniciados. La racha NO se reinicia (la mira finishRun). */
function ensureDaily() {
  const svc = services();
  const day = todayKey();
  if (svc.save.data.daily.day !== day) {
    svc.save.update(['daily', 'ads'], (d) => {
      d.daily = {
        day,
        streak: d.daily.streak,
        missions: dailyMissions(day).map((m) => ({ id: m.id, p: 0, done: false })),
        chest: { free: true, ad: true },
        wheel: { free: true, ads: 0 },
        challenge: { done: false, best: 0 },
      };
      d.ads.day = day;
      d.ads.seen = 0;
    });
    return;
  }
  // Guardado nuevo: el día ya coincide pero las misiones nunca se generaron.
  if (svc.save.data.daily.missions.length === 0) {
    svc.save.update('daily', (d) => {
      d.daily.missions = dailyMissions(day).map((m) => ({ id: m.id, p: 0, done: false }));
    });
  }
}

let bootStarted = false;

export const useApp = create<AppState>((set, get) => ({
  screen: 'boot',
  booted: false,
  bootError: null,
  lang: 'es',
  profile: null,
  stats: null,
  daily: null,
  ads: null,
  campaign: null,
  lastAchievements: [],
  runMode: 'normal',
  runCampaign: null,
  lastCampaign: null,
  prepNight: null,
  lastReward: null,
  debug: debugEnabled(),
  runBoosts: NO_BOOSTS,
  toast: null,

  async boot() {
    if (bootStarted) return;
    bootStarted = true;
    try {
      tg.init();
      const initialLang = detectLang(tg.languageCode);
      setLang(initialLang);
      set({ lang: initialLang });

      const svc = createServices(() => get().lang);
      const data = await svc.save.load();
      ensureDaily();
      // El idioma guardado tiene prioridad sobre el detectado.
      setLang(data.profile.settings.lang);
      svc.analytics.setContext({ lang: data.profile.settings.lang });
      svc.analytics.track('app_open', { backends: svc.save.activeBackends.join(','), tg: tg.available });
      // Los SDK de anuncios cargan en segundo plano: el menú no espera a la red.
      void svc.ads.init();

      set({ ...mirror(services().save.data), lang: data.profile.settings.lang, booted: true, screen: 'menu' });
      installLifecycleFlush();
      preloadGameEngine();
    } catch (err) {
      console.error('[boot]', err);
      set({ bootError: String(err) });
    }
  },

  go(screen) {
    tg.haptic.select();
    set({ screen });
  },

  showToast(key) {
    const id = Date.now();
    set({ toast: { key, id } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 2600);
  },

  startRun(mode, night) {
    const svc = services();
    // Campaña: solo se puede entrar en la siguiente noche o en una ya superada.
    let camp: CampaignRun | null = null;
    if (mode === 'campaign') {
      const next = svc.save.data.campaign.next;
      const n = Math.min(CAMPAIGN_NIGHTS, Math.max(1, night ?? next));
      if (n > next) return;
      camp = { night: n, replay: n < next };
    }
    tg.haptic.impact('medium');
    ensureDaily();
    // El impulso y la prueba de skin valen para UNA partida: se toman y se borran del guardado.
    const { boost, trial } = svc.save.data.ads;
    if (boost || trial) {
      svc.save.update('ads', (d) => {
        d.ads.boost = false;
        d.ads.trial = null;
      });
    }
    svc.analytics.track('run_start', { mode, boost, trial, night: camp?.night ?? null });
    set({
      runMode: mode,
      runCampaign: camp,
      lastCampaign: null,
      lastReward: null,
      runBoosts: { boost, trial },
      screen: 'run',
      lastAchievements: [],
      ...mirror(svc.save.data),
    });
  },

  beginNight(night) {
    const c = services().save.data.campaign;
    if (night > c.next) return;
    if (inventoryTotal(c) > 0) {
      tg.haptic.select();
      set({ prepNight: night, screen: 'prep', ...mirror(services().save.data) });
    } else get().startRun('campaign', night);
  },

  toggleDebug() {
    const on = !get().debug;
    setDebug(on);
    set({ debug: debugEnabled() });
  },

  debugSetNext(next) {
    if (!get().debug) return;
    const n = Math.min(CAMPAIGN_NIGHTS + 1, Math.max(1, Math.round(next)));
    services().save.update('campaign', (d) => {
      d.campaign.next = n;
      // Los jefes de noches anteriores cuentan como derrotados (la 2ª ranura depende de ello).
      d.campaign.bosses = BOSS_NIGHTS.reduce((m, b) => (b < n ? m | bossBit(b) : m), 0);
      // Las noches anteriores cuentan como superadas (1 estrella) para que el mapa sea coherente.
      d.campaign.stars = Array.from({ length: CAMPAIGN_NIGHTS }, (_, i) =>
        i + 1 < n ? (d.campaign.stars[i] === '0' ? '1' : d.campaign.stars[i]) : '0',
      ).join('');
    });
    set(mirror(services().save.data));
  },

  setLanguage(lang) {
    setLang(lang);
    services().save.update('profile', (d) => {
      d.profile.settings.lang = lang;
    });
    set({ lang, ...mirror(services().save.data) });
  },

  toggleSetting(key) {
    services().save.update('profile', (d) => {
      d.profile.settings[key] = !d.profile.settings[key];
    });
    set(mirror(services().save.data));
  },

  /** Silencia sonido y música a la vez; si ya estaba todo en silencio, los reactiva. */
  toggleMute() {
    services().save.update('profile', (d) => {
      const s = d.profile.settings;
      const on = !(s.sound || s.music);
      s.sound = on;
      s.music = on;
    });
    set(mirror(services().save.data));
  },

  completeTutorial() {
    if (services().save.data.profile.tut) return;
    services().save.update('profile', (d) => {
      d.profile.tut = true;
    });
    set(mirror(services().save.data));
  },

  addSparks(n) {
    services().save.update('profile', (d) => {
      d.profile.sparks = Math.max(0, d.profile.sparks + n);
    });
    set(mirror(services().save.data));
  },

  finishRun(result) {
    ensureDaily();
    const svc = services();
    let newAch: string[] = [];
    let camp: LastCampaign | null = null;
    let reward = null as string | null;
    svc.save.update(['profile', 'stats', 'daily', 'campaign'], (d) => {
      const day = todayKey();
      d.profile.sparks += result.sparks;
      d.profile.tut = true;
      // Campaña: superar la noche guarda estrellas y, la primera vez, abre la siguiente y da un bono.
      if (result.night !== null && result.won) {
        const c = d.campaign;
        const idx = result.night - 1;
        const stars = starsFor(result.kills, planNight(result.night, result.replay));
        if (stars > Number(c.stars[idx] ?? '0')) c.stars = c.stars.slice(0, idx) + stars + c.stars.slice(idx + 1);
        const first = c.next === result.night;
        let bonus = 0;
        if (first) {
          c.next = Math.min(CAMPAIGN_NIGHTS + 1, result.night + 1);
          bonus = firstClearSparks(result.night);
          d.profile.sparks += bonus;
        }
        camp = { night: result.night, stars, first, bonus, boss: null };
        // Duelo ganado: el jefe queda derrotado; la primera vez da más y abre la segunda ranura de talismán.
        const bit = result.duel?.won ? bossBit(result.night) : 0;
        if (bit) {
          const firstBoss = !(c.bosses & bit);
          const slotsBefore = talismanSlots(c);
          c.bosses |= bit;
          c.bl = 0;
          // La primera victoria da el talismán exclusivo del jefe; al rejugar, uno raro y, con suerte, el exclusivo.
          // La skin exclusiva se entrega la primera vez que se vence si aún no se tiene (cubre partidas previas a ella).
          const bc = BOSS.types[bossIdFor(result.night) ?? 'devourer'];
          const rw = firstBoss ? BOSS.rewards.first : BOSS.rewards.replay;
          d.profile.sparks += rw.sparks;
          const tals: string[] = [];
          const exclusive = talismanKey(bc.reward.talisman as TalismanId, 3);
          if (firstBoss) tals.push(exclusive);
          else {
            if (Math.random() < BOSS.rewards.replay.chance) tals.push(rollTalisman(BOSS.rewards.replay.rarity));
            if (Math.random() < BOSS.rewards.replay.exclusiveChance) tals.push(exclusive);
          }
          for (const k of tals) giveTalisman(c, k);
          let skin: string | null = null;
          if (!d.profile.unlocked.s.includes(bc.reward.skin)) {
            d.profile.unlocked.s.push(bc.reward.skin);
            skin = bc.reward.skin;
          }
          camp.boss = { first: firstBoss, sparks: rw.sparks, talismans: tals, skin, slot: talismanSlots(c) > slotsBefore };
        }
      }
      // Perder el duelo da algo de vida extra al siguiente intento.
      if (result.night !== null && result.duel && !result.duel.won) {
        d.campaign.bl = Math.min(BOSS.help.maxLosses, d.campaign.bl + 1);
      }
      // Talismanes de los cofres de minijefe: se conservan aunque la noche se pierda.
      for (const key of result.found) giveTalisman(d.campaign, key);
      const s = d.stats;
      s.runs++;
      if (result.won) s.wins++;
      s.kills += result.kills;
      s.bestKills = Math.max(s.bestKills, result.kills);
      if (result.time > s.bestTime) {
        s.bestTime = result.time;
        s.bestRun = {
          t: Math.round(result.time),
          k: result.kills,
          w: result.weaponIds[0] ?? '',
          c: result.characterId,
          at: Date.now(),
        };
      }
      for (const w of result.weaponIds) {
        const list = WEAPON_BY_ID[w]?.evolved ? s.seen.ev : s.seen.w;
        if (!list.includes(w)) list.push(w);
      }
      for (const e of result.seenEnemies) if (!s.seen.e.includes(e)) s.seen.e.push(e);

      // Misiones diarias: suman el progreso de esta partida.
      for (const m of d.daily.missions) {
        const def = MISSION_BY_ID[m.id];
        if (m.done || !def) continue;
        m.p = advanceMission(def, m.p, result);
      }
      // Racha: la primera partida del día la suma (consecutiva) o la reinicia.
      if (d.daily.streak.last !== day) {
        d.daily.streak.n = d.daily.streak.last === yesterdayKey() ? d.daily.streak.n + 1 : 1;
        d.daily.streak.last = day;
        const reward = streakReward(d.daily.streak.n);
        d.profile.sparks += reward;
        if (d.daily.streak.n >= 7 && !d.profile.unlocked.c.includes('fenix')) {
          d.profile.unlocked.c.push('fenix');
        }
      }
      // Reto diario: premio único al superarlo.
      if (result.challengeDone && !d.daily.challenge.done) {
        d.daily.challenge.done = true;
        d.profile.sparks += dailyChallenge().reward;
        reward = rollTalisman(TAL.challengeRarity);
        giveTalisman(d.campaign, reward);
      }
      if (result.challenge) d.daily.challenge.best = Math.max(d.daily.challenge.best, Math.round(result.time));
      // Logros.
      for (const a of ACHIEVEMENTS) {
        if (!s.ach.includes(a.id) && a.check(result, d)) {
          s.ach.push(a.id);
          d.profile.sparks += a.reward;
          newAch.push(a.id);
        }
      }
    });
    svc.analytics.track('run_end', {
      won: result.won,
      time: Math.round(result.time),
      kills: result.kills,
      level: result.level,
      sparks: result.sparks,
      ach: newAch.join(',') || 'none',
      chests: result.found.length,
      duel: result.duel ? (result.duel.won ? 'win' : 'loss') : 'none',
      duel_t: result.duel ? Math.round(result.duel.time) : 0,
    });
    for (const key of result.found) svc.analytics.track('talisman_found', { key, via: result.foundAd.includes(key) ? 'ad_pick' : 'chest' });
    if (reward) svc.analytics.track('talisman_found', { key: reward, via: 'challenge' });
    void svc.save.flush();
    set({ ...mirror(svc.save.data), lastAchievements: newAch, lastCampaign: camp, lastReward: reward });
  },

  buyUpgrade(id) {
    const svc = services();
    const def = META_BY_ID[id];
    if (!def) return;
    const level = svc.save.data.profile.upgrades[id] ?? 0;
    if (level >= def.maxLevel || svc.save.data.profile.sparks < def.cost[level]!) return;
    svc.save.update('profile', (d) => {
      d.profile.sparks -= def.cost[level]!;
      d.profile.upgrades[id] = level + 1;
    });
    svc.analytics.track('purchase_upgrade', { id, level: level + 1 });
    set(mirror(svc.save.data));
  },

  unlockCharacter(id) {
    const svc = services();
    const def = CHARACTER_BY_ID[id];
    if (!def || typeof def.cost !== 'number' || svc.save.data.profile.unlocked.c.includes(id)) return false;
    if (svc.save.data.profile.sparks < def.cost) return false;
    svc.save.update('profile', (d) => {
      d.profile.sparks -= def.cost as number;
      d.profile.unlocked.c.push(id);
      d.profile.selected.c = id;
    });
    svc.analytics.track('unlock', { kind: 'character', id });
    set(mirror(svc.save.data));
    return true;
  },

  unlockMap(id) {
    const svc = services();
    const def = MAP_BY_ID[id];
    if (!def || svc.save.data.profile.unlocked.m.includes(id) || svc.save.data.profile.sparks < def.cost) return false;
    svc.save.update('profile', (d) => {
      d.profile.sparks -= def.cost;
      d.profile.unlocked.m.push(id);
      d.profile.selected.m = id;
    });
    svc.analytics.track('unlock', { kind: 'map', id });
    set(mirror(svc.save.data));
    return true;
  },

  selectCharacter(id) {
    if (!services().save.data.profile.unlocked.c.includes(id)) return;
    services().save.update('profile', (d) => {
      d.profile.selected.c = id;
    });
    set(mirror(services().save.data));
  },

  selectMap(id) {
    if (!services().save.data.profile.unlocked.m.includes(id)) return;
    services().save.update('profile', (d) => {
      d.profile.selected.m = id;
    });
    set(mirror(services().save.data));
  },

  claimMission(id) {
    const svc = services();
    const def = MISSION_BY_ID[id];
    const m = svc.save.data.daily.missions.find((x) => x.id === id);
    if (!def || !m || m.done || m.p < def.target) return;
    svc.save.update(['daily', 'profile'], (d) => {
      const mm = d.daily.missions.find((x) => x.id === id)!;
      mm.done = true;
      d.profile.sparks += def.reward;
    });
    set(mirror(svc.save.data));
  },

  async resetProgress() {
    await services().save.resetAll();
    const data = services().save.data;
    setLang(data.profile.settings.lang);
    set({ ...mirror(data), lang: data.profile.settings.lang });
  },
}));

if (import.meta.env.DEV) (window as unknown as { __app?: typeof useApp }).__app = useApp;

/** Publica en React el guardado actual tras mutarlo desde otro módulo de acciones. */
export function commit(): void {
  useApp.setState(mirror(services().save.data));
}

/** Reinicia lo diario si cambió el día con la app abierta (cofre, ruleta, misiones, tope de anuncios). */
export function refreshDaily(): void {
  ensureDaily();
  commit();
}

/** Descarga el motor (PixiJS) en un momento ocioso para que la primera partida arranque al instante. */
function preloadGameEngine(): void {
  const load = () => void import('@/game/Game').catch(() => undefined);
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 4000 });
  else setTimeout(load, 1500);
}

/** Vuelca el guardado pendiente al ocultar/cerrar la app (Telegram mata la WebView sin aviso). */
function installLifecycleFlush(): void {
  const flush = () => void services().save.flush();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  tg.raw?.onEvent('deactivated', flush);
}
