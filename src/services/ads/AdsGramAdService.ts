import type { AdOutcome, AdPlacement, AdService } from '../types';
import { AdEmitter } from './AdEmitter';
import { loadScript } from './sdkLoader';

/** Subconjunto tipado del SDK oficial (docs.adsgram.ai/publisher/typescript). */
interface ShowPromiseResult {
  done: boolean;
  description: string;
  state: 'load' | 'render' | 'playing' | 'destroy';
  error: boolean;
}
interface AdController {
  show(): Promise<ShowPromiseResult>;
  destroy(): void;
}
interface AdsgramGlobal {
  init(params: { blockId: string; debug?: boolean; debugBannerType?: 'FullscreenMedia' | 'RewardedVideo' }): AdController;
}

const SDK_URL = 'https://sad.adsgram.ai/js/sad.min.js';

/**
 * Proveedor principal: AdsGram (rewarded video para Telegram Mini Apps).
 * `show()` del SDK resuelve solo si el usuario ve el anuncio hasta el final;
 * si lo cierra antes o hay error, rechaza con el mismo tipo de resultado.
 */
export class AdsGramAdService implements AdService {
  readonly providerId = 'adsgram';
  private readonly emitter = new AdEmitter();
  private controller: AdController | null = null;
  private busy = false;
  private failed = false;

  constructor(
    private readonly blockId: string,
    private readonly debug = false,
  ) {}

  async init(): Promise<void> {
    if (!this.blockId) return;
    try {
      await loadScript(SDK_URL);
      const sdk = (window as unknown as { Adsgram?: AdsgramGlobal }).Adsgram;
      if (!sdk) throw new Error('Adsgram global missing');
      this.controller = sdk.init(this.debug ? { blockId: this.blockId, debug: true, debugBannerType: 'RewardedVideo' } : { blockId: this.blockId });
    } catch (err) {
      this.failed = true;
      console.warn('[ads:adsgram] init failed', err);
    }
  }

  isReady(): boolean {
    return !!this.controller && !this.busy && !this.failed;
  }

  async show(placement: AdPlacement): Promise<AdOutcome> {
    if (!this.isReady()) return this.emitter.finish(placement, { status: 'unavailable' });
    this.busy = true;
    this.emitter.emit('start', placement, { status: 'rewarded' });
    try {
      const result = await this.controller!.show();
      return this.emitter.finish(placement, result.done ? { status: 'rewarded' } : { status: 'skipped' });
    } catch (raw) {
      const r = raw as Partial<ShowPromiseResult> | undefined;
      if (r && r.error === false) return this.emitter.finish(placement, { status: 'skipped' });
      return this.emitter.finish(placement, { status: 'error', reason: r?.description ?? String(raw) });
    } finally {
      this.busy = false;
    }
  }

  on: AdService['on'] = (event, handler) => this.emitter.on(event, handler);
}
