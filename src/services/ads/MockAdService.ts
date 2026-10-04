import type { AdOutcome, AdPlacement, AdService } from '../types';
import { AdEmitter } from './AdEmitter';

/**
 * Proveedor de desarrollo: simula un anuncio de 1.5 s y confirma la recompensa.
 * Permite probar todo el flujo de ofertas sin SDK. En producción se sustituye por AdsGram.
 */
export class MockAdService implements AdService {
  readonly providerId = 'mock';
  private readonly emitter = new AdEmitter();
  private busy = false;

  constructor(private readonly durationMs = 1500, private readonly failRate = 0) {}

  async init(): Promise<void> {}

  isReady(): boolean {
    return !this.busy;
  }

  show(placement: AdPlacement): Promise<AdOutcome> {
    if (this.busy) return Promise.resolve(this.emitter.finish(placement, { status: 'unavailable' }));
    this.busy = true;
    this.emitter.emit('start', placement, { status: 'rewarded' });
    return new Promise((resolve) => {
      setTimeout(() => {
        this.busy = false;
        const outcome: AdOutcome =
          Math.random() < this.failRate ? { status: 'skipped' } : { status: 'rewarded' };
        resolve(this.emitter.finish(placement, outcome));
      }, this.durationMs);
    });
  }

  on: AdService['on'] = (event, handler) => this.emitter.on(event, handler);
}

/** Proveedor nulo: nunca hay anuncio disponible. Útil para builds sin monetización. */
export class NoAdService implements AdService {
  readonly providerId = 'none';
  private readonly emitter = new AdEmitter();
  async init(): Promise<void> {}
  isReady(): boolean {
    return false;
  }
  async show(placement: AdPlacement): Promise<AdOutcome> {
    return this.emitter.finish(placement, { status: 'unavailable' });
  }
  on: AdService['on'] = (event, handler) => this.emitter.on(event, handler);
}
