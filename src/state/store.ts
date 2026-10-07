import { create } from 'zustand';
import { ACHIEVEMENTS } from '@/data/achievements';
import { CHARACTER_BY_ID } from '@/data/characters';
import { dailyChallenge } from '@/data/events';
import { MAP_BY_ID } from '@/data/maps';
import { META_BY_ID } from '@/data/meta';
import { advanceMission, dailyMissions, MISSION_BY_ID } from '@/data/missions';
import { WEAPON_BY_ID } from '@/data/weapons';
import { detectLang, setLang, type Lang, type TranslationKey } from '@/i18n';
import { tg } from '@/platform/telegram';
import { createServices, services } from '@/services/container';
import type { RunResult } from './run';
import type { RunBoosts } from './runOptions';
import {
  todayKey,
  yesterdayKey,
  type AdsShard,
  type DailyShard,
  type ProfileShard,
  type SaveData,
  type StatsShard,
} from './save-schema';

export type Screen = 'boot' | 'menu' | 'run' | 'settings' | 'shop' | 'characters' | 'maps' | 'collection' | 'daily' | 'skins';

const NO_BOOSTS: RunBoosts = { boost: false, trial: null };

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
  /** Logros desbloqueados en la última partida (para mostrarlos en resultados). */
  lastAchievements: string[];
  /** Modo de la próxima partida. */
  runMode: 'normal' | 'challenge' | 'weekly';
  /** Impulso inicial y skin de prueba que usa la partida en curso (se consumen al empezar). */
  runBoosts: RunBoosts;
  /** Aviso breve en pantalla (anuncio no disponible, etc.). */
  toast: { key: TranslationKey; id: number } | null;

  boot(): Promise<void>;
  go(screen: Screen): void;
  showToast(key: TranslationKey): void;
  /** Selecciona el modo y arranca la partida. */
  startRun(mode: 'normal' | 'challenge' | 'weekly'): void;
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
  lastAchievements: [],
  runMode: 'normal',
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

  startRun(mode) {
    tg.haptic.impact('medium');
    ensureDaily();
    const svc = services();
    // El impulso y la prueba de skin valen para UNA partida: se toman y se borran del guardado.
    const { boost, trial } = svc.save.data.ads;
    if (boost || trial) {
      svc.save.update('ads', (d) => {
        d.ads.boost = false;
        d.ads.trial = null;
      });
    }
    svc.analytics.track('run_start', { mode, boost, trial });
    set({ runMode: mode, runBoosts: { boost, trial }, screen: 'run', lastAchievements: [], ...mirror(svc.save.data) });
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
    svc.save.update(['profile', 'stats', 'daily'], (d) => {
      const day = todayKey();
      d.profile.sparks += result.sparks;
      d.profile.tut = true;
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
        const reward = Math.min(7, d.daily.streak.n) * 10;
        d.profile.sparks += reward;
        if (d.daily.streak.n >= 7 && !d.profile.unlocked.c.includes('fenix')) {
          d.profile.unlocked.c.push('fenix');
        }
      }
      // Reto diario: premio único al superarlo.
      if (result.challengeDone && !d.daily.challenge.done) {
        d.daily.challenge.done = true;
        d.profile.sparks += dailyChallenge().reward;
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
    });
    void svc.save.flush();
    set({ ...mirror(svc.save.data), lastAchievements: newAch });
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
