import { create } from 'zustand';
import { detectLang, setLang, type Lang } from '@/i18n';
import { tg } from '@/platform/telegram';
import { createServices, services } from '@/services/container';
import type { ProfileShard, SaveData, StatsShard } from './save-schema';

export type Screen = 'boot' | 'menu' | 'run' | 'settings';

interface AppState {
  screen: Screen;
  booted: boolean;
  bootError: string | null;
  lang: Lang;
  /** Espejos de solo lectura del guardado para que React re-renderice. */
  profile: ProfileShard | null;
  stats: StatsShard | null;

  boot(): Promise<void>;
  go(screen: Screen): void;
  setLanguage(lang: Lang): void;
  toggleSetting(key: 'sound' | 'music' | 'haptics'): void;
  addSparks(n: number): void;
  resetProgress(): Promise<void>;
}

/** Copia superficial de los shards al store tras cada mutación. */
function mirror(data: SaveData) {
  return { profile: { ...data.profile }, stats: { ...data.stats } };
}

let bootStarted = false;

export const useApp = create<AppState>((set, get) => ({
  screen: 'boot',
  booted: false,
  bootError: null,
  lang: 'es',
  profile: null,
  stats: null,

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
      // El idioma guardado tiene prioridad sobre el detectado.
      setLang(data.profile.settings.lang);
      svc.analytics.setContext({ lang: data.profile.settings.lang });
      svc.analytics.track('app_open', { backends: svc.save.activeBackends.join(','), tg: tg.available });
      await svc.ads.init();

      set({ ...mirror(data), lang: data.profile.settings.lang, booted: true, screen: 'menu' });
      installLifecycleFlush();
    } catch (err) {
      console.error('[boot]', err);
      set({ bootError: String(err) });
    }
  },

  go(screen) {
    tg.haptic.select();
    set({ screen });
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

  addSparks(n) {
    services().save.update('profile', (d) => {
      d.profile.sparks = Math.max(0, d.profile.sparks + n);
    });
    set(mirror(services().save.data));
  },

  async resetProgress() {
    await services().save.resetAll();
    const data = services().save.data;
    setLang(data.profile.settings.lang);
    set({ ...mirror(data), lang: data.profile.settings.lang });
  },
}));

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
