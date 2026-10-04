import type {
  TgImpactStyle,
  TgNotificationType,
  TgSafeAreaInset,
  TgThemeParams,
  TgUser,
  TgWebApp,
} from './telegram-types';

/**
 * Capa de acceso a Telegram.WebApp.
 * Fuera de Telegram (navegador de desarrollo) todas las llamadas son no-op seguras,
 * así el juego se puede desarrollar y probar sin el cliente.
 */

const ZERO_INSET: TgSafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

function getWebApp(): TgWebApp | null {
  const wa = window.Telegram?.WebApp;
  // Fuera de Telegram el script existe pero initData está vacío y la versión es "6.0" por defecto.
  if (!wa || (!wa.initData && wa.platform === 'unknown')) return null;
  return wa;
}

const webApp = getWebApp();

export const tg = {
  /** true si corremos dentro del cliente de Telegram. */
  available: webApp !== null,
  raw: webApp,

  get user(): TgUser | null {
    return webApp?.initDataUnsafe.user ?? null;
  },

  get startParam(): string | null {
    return webApp?.initDataUnsafe.start_param ?? null;
  },

  get languageCode(): string {
    return webApp?.initDataUnsafe.user?.language_code ?? navigator.language ?? 'en';
  },

  get colorScheme(): 'light' | 'dark' {
    return webApp?.colorScheme ?? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  },

  get platform(): string {
    return webApp?.platform ?? 'browser';
  },

  get version(): string {
    return webApp?.version ?? '0';
  },

  isVersionAtLeast(v: string): boolean {
    return webApp?.isVersionAtLeast(v) ?? false;
  },

  get safeArea(): TgSafeAreaInset {
    return webApp?.safeAreaInset ?? ZERO_INSET;
  },

  get contentSafeArea(): TgSafeAreaInset {
    return webApp?.contentSafeAreaInset ?? ZERO_INSET;
  },

  get cloudStorage() {
    if (!webApp?.CloudStorage || !webApp.isVersionAtLeast('6.9')) return null;
    return webApp.CloudStorage;
  },

  /** Inicialización única: señala ready, expande, fija colores y conecta listeners de tema/safe-area. */
  init(): void {
    applyTheme(webApp?.themeParams ?? {}, tg.colorScheme);
    applySafeArea(tg.safeArea, tg.contentSafeArea);
    if (!webApp) return;

    webApp.ready();
    webApp.expand();
    try {
      webApp.setHeaderColor('#0b0a14');
      webApp.setBackgroundColor('#0b0a14');
      webApp.setBottomBarColor?.('#0b0a14');
    } catch {
      /* versiones antiguas pueden rechazar colores arbitrarios */
    }

    webApp.onEvent('themeChanged', () => applyTheme(webApp.themeParams, webApp.colorScheme));
    const onSafeArea = () => applySafeArea(tg.safeArea, tg.contentSafeArea);
    webApp.onEvent('safeAreaChanged', onSafeArea);
    webApp.onEvent('contentSafeAreaChanged', onSafeArea);
    webApp.onEvent('viewportChanged', () => {
      document.documentElement.style.setProperty('--tg-vh', `${webApp.viewportStableHeight}px`);
    });
    document.documentElement.style.setProperty('--tg-vh', `${webApp.viewportStableHeight}px`);
  },

  /** Bloquea el gesto de cerrar deslizando (durante la partida). Requiere 7.7+. */
  lockGestures(lock: boolean): void {
    if (!webApp) return;
    if (lock) {
      webApp.disableVerticalSwipes?.();
      webApp.enableClosingConfirmation();
    } else {
      webApp.enableVerticalSwipes?.();
      webApp.disableClosingConfirmation();
    }
  },

  haptic: {
    impact(style: TgImpactStyle = 'light'): void {
      try {
        webApp?.HapticFeedback.impactOccurred(style);
      } catch {
        /* no soportado */
      }
    },
    notify(type: TgNotificationType): void {
      try {
        webApp?.HapticFeedback.notificationOccurred(type);
      } catch {
        /* no soportado */
      }
    },
    select(): void {
      try {
        webApp?.HapticFeedback.selectionChanged();
      } catch {
        /* no soportado */
      }
    },
  },

  backButton: {
    _handler: null as (() => void) | null,
    show(handler: () => void): void {
      this.hide();
      this._handler = handler;
      if (!webApp) return;
      webApp.BackButton.onClick(handler);
      webApp.BackButton.show();
    },
    hide(): void {
      if (webApp && this._handler) webApp.BackButton.offClick(this._handler);
      this._handler = null;
      webApp?.BackButton.hide();
    },
  },

  /** Abre el selector de chats de Telegram con un enlace y texto prellenado. */
  share(url: string, text: string): void {
    const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    if (webApp) webApp.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener');
  },

  /** Enlace a la Mini App, con parámetro de arranque opcional (para retos/referencias futuras). */
  appLink(startParam?: string): string {
    const bot = import.meta.env.VITE_BOT_USERNAME || 'lumen_game_bot';
    const short = import.meta.env.VITE_APP_SHORT_NAME;
    const base = short ? `https://t.me/${bot}/${short}` : `https://t.me/${bot}`;
    return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
  },

  alert(message: string): Promise<void> {
    return new Promise((resolve) => {
      if (webApp) webApp.showAlert(message, resolve);
      else {
        window.alert(message);
        resolve();
      }
    });
  },
};

function applyTheme(params: TgThemeParams, scheme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.dataset.scheme = scheme;
  const map: Record<string, string | undefined> = {
    '--tg-bg': params.bg_color,
    '--tg-text': params.text_color,
    '--tg-hint': params.hint_color,
    '--tg-link': params.link_color,
    '--tg-button': params.button_color,
    '--tg-button-text': params.button_text_color,
    '--tg-secondary-bg': params.secondary_bg_color,
    '--tg-section-bg': params.section_bg_color,
    '--tg-accent': params.accent_text_color,
    '--tg-subtitle': params.subtitle_text_color,
    '--tg-destructive': params.destructive_text_color,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  }
}

function applySafeArea(sa: TgSafeAreaInset, csa: TgSafeAreaInset): void {
  const root = document.documentElement.style;
  root.setProperty('--sa-top', `${sa.top + csa.top}px`);
  root.setProperty('--sa-bottom', `${sa.bottom + csa.bottom}px`);
  root.setProperty('--sa-left', `${sa.left + csa.left}px`);
  root.setProperty('--sa-right', `${sa.right + csa.right}px`);
}
