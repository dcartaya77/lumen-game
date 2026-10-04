import { tg } from '@/platform/telegram';
import { ConsoleAnalytics } from './analytics/ConsoleAnalytics';
import { MockAdService } from './ads/MockAdService';
import { CloudStorageBackend } from './save/CloudStorageBackend';
import { LocalStorageBackend } from './save/LocalStorageBackend';
import { RemoteBackendStub } from './save/RemoteBackendStub';
import { SaveManager } from './save/SaveManager';
import type { AdService, Analytics } from './types';

/**
 * Punto único de composición. Cambiar de proveedor (AdsGram, backend propio)
 * es sustituir aquí una línea; el resto de la app depende solo de las interfaces.
 */
export interface Services {
  save: SaveManager;
  ads: AdService;
  analytics: Analytics;
}

let instance: Services | null = null;

export function createServices(lang: () => 'es' | 'en'): Services {
  if (instance) return instance;
  const analytics: Analytics = new ConsoleAnalytics(import.meta.env.DEV);
  analytics.setContext({
    app: 'lumen',
    build: __APP_VERSION__,
    platform: tg.platform,
    tgVersion: tg.version,
  });

  const save = new SaveManager({
    analytics,
    lang,
    backends: [new CloudStorageBackend(lang), new LocalStorageBackend(lang), new RemoteBackendStub()],
  });

  // Hito 5: AdsGramAdService con fallback a Monetag detrás de la misma interfaz.
  const ads: AdService = new MockAdService();

  instance = { save, ads, analytics };
  return instance;
}

export function services(): Services {
  if (!instance) throw new Error('services not initialised');
  return instance;
}
