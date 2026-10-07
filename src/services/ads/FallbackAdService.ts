import type { AdOutcome, AdPlacement, AdService } from '../types';
import { AdEmitter } from './AdEmitter';

/**
 * Encadena proveedores en orden de prioridad: el primero que esté listo muestra el anuncio;
 * si responde "no disponible" o error, se intenta con el siguiente.
 * Un anuncio saltado por el usuario NO pasa al siguiente (el jugador ya decidió).
 */
export class FallbackAdService implements AdService {
  readonly providerId: string;
  private readonly emitter = new AdEmitter();

  constructor(private readonly providers: AdService[]) {
    this.providerId = providers.map((p) => p.providerId).join('>') || 'none';
    for (const p of providers) {
      p.on('start', (pl, o) => this.emitter.emit('start', pl, o));
    }
  }

  async init(): Promise<void> {
    await Promise.all(this.providers.map((p) => p.init().catch(() => undefined)));
  }

  isReady(placement: AdPlacement): boolean {
    return this.providers.some((p) => p.isReady(placement));
  }

  async show(placement: AdPlacement): Promise<AdOutcome> {
    let last: AdOutcome = { status: 'unavailable' };
    for (const p of this.providers) {
      if (!p.isReady(placement)) continue;
      last = await p.show(placement);
      if (last.status === 'rewarded' || last.status === 'skipped') break;
    }
    return this.emitter.finish(placement, last);
  }

  on: AdService['on'] = (event, handler) => this.emitter.on(event, handler);
}
