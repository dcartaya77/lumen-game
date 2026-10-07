import type { AdOutcome, AdPlacement, AdService } from '../types';
import { AdEmitter } from './AdEmitter';
import { loadScript } from './sdkLoader';

/** Firma del método global `show_<zone>` que crea el SDK de Monetag. */
type MonetagShow = (opts?: { type?: 'end' | 'start' | 'preload'; ymid?: string; requestVar?: string; timeout?: number }) => Promise<unknown>;

/**
 * Proveedor de respaldo: Monetag "Rewarded Interstitial" para Telegram Mini Apps.
 * El SDK expone `window.show_<zoneId>()`; la promesa resuelve al completar el anuncio
 * y rechaza si no hay inventario, se cierra antes o hay error (todo cuenta como no recompensado).
 */
export class MonetagAdService implements AdService {
  readonly providerId = 'monetag';
  private readonly emitter = new AdEmitter();
  private showFn: MonetagShow | null = null;
  private busy = false;
  private preloaded = false;

  constructor(
    private readonly zoneId: string,
    private readonly sdkUrl: string,
    private readonly userId: () => string,
  ) {}

  async init(): Promise<void> {
    if (!this.zoneId || !this.sdkUrl) return;
    const fnName = `show_${this.zoneId}`;
    try {
      await loadScript(this.sdkUrl, { 'data-zone': this.zoneId, 'data-sdk': fnName });
      const fn = (window as unknown as Record<string, unknown>)[fnName];
      if (typeof fn !== 'function') throw new Error(`${fnName} missing`);
      this.showFn = fn as MonetagShow;
      void this.preload();
    } catch (err) {
      console.warn('[ads:monetag] init failed', err);
    }
  }

  private async preload(): Promise<void> {
    if (!this.showFn) return;
    try {
      await this.showFn({ type: 'preload', ymid: this.userId(), timeout: 8 });
      this.preloaded = true;
    } catch {
      this.preloaded = false;
    }
  }

  isReady(): boolean {
    return !!this.showFn && !this.busy;
  }

  async show(placement: AdPlacement): Promise<AdOutcome> {
    if (!this.isReady()) return this.emitter.finish(placement, { status: 'unavailable' });
    this.busy = true;
    this.emitter.emit('start', placement, { status: 'rewarded' });
    try {
      await this.showFn!({ ymid: this.userId(), requestVar: placement });
      return this.emitter.finish(placement, { status: 'rewarded' });
    } catch (err) {
      // Sin inventario o cerrado antes de tiempo: no distinguimos, nunca se premia.
      return this.emitter.finish(placement, this.preloaded ? { status: 'skipped' } : { status: 'unavailable' });
    } finally {
      this.busy = false;
      this.preloaded = false;
      void this.preload();
    }
  }

  on: AdService['on'] = (event, handler) => this.emitter.on(event, handler);
}
