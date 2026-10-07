import { tg } from '@/platform/telegram';
import { ConsoleAnalytics } from './analytics/ConsoleAnalytics';
import { AdsGramAdService } from './ads/AdsGramAdService';
import { FallbackAdService } from './ads/FallbackAdService';
import { MockAdService, NoAdService } from './ads/MockAdService';
import { MonetagAdService } from './ads/MonetagAdService';
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

  const ads = createAdService();
  analytics.setContext({ adsProvider: ads.providerId });

  instance = { save, ads, analytics };
  return instance;
}

/**
 * AdsGram principal + Monetag de respaldo detrás de la misma interfaz.
 * Sin IDs configurados: mock en desarrollo (para probar flujos) y "sin anuncios" en producción.
 */
function createAdService(): AdService {
  const env = import.meta.env;
  const mode = env.VITE_ADS_PROVIDER ?? 'auto';
  if (mode === 'none') return new NoAdService();
  if (mode === 'mock') return new MockAdService();
  const providers: AdService[] = [];
  if (env.VITE_ADSGRAM_BLOCK_ID) providers.push(new AdsGramAdService(env.VITE_ADSGRAM_BLOCK_ID, import.meta.env.DEV));
  if (env.VITE_MONETAG_ZONE_ID) {
    providers.push(
      new MonetagAdService(env.VITE_MONETAG_ZONE_ID, env.VITE_MONETAG_SDK_URL ?? 'https://libtl.com/sdk.js', () =>
        String(tg.user?.id ?? 'anon'),
      ),
    );
  }
  if (providers.length === 0) return import.meta.env.DEV ? new MockAdService() : new NoAdService();
  return providers.length === 1 ? providers[0]! : new FallbackAdService(providers);
}

export function services(): Services {
  if (!instance) throw new Error('services not initialised');
  return instance;
}
