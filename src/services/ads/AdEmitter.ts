import type { AdEvent, AdEventHandler, AdOutcome, AdPlacement } from '../types';

/** Pequeño emisor compartido por todas las implementaciones de AdService. */
export class AdEmitter {
  private handlers: Record<AdEvent, Set<AdEventHandler>> = {
    start: new Set(),
    reward: new Set(),
    skip: new Set(),
    error: new Set(),
  };

  on(event: AdEvent, handler: AdEventHandler): () => void {
    this.handlers[event].add(handler);
    return () => this.handlers[event].delete(handler);
  }

  emit(event: AdEvent, placement: AdPlacement, outcome: AdOutcome): void {
    for (const h of this.handlers[event]) h(placement, outcome);
  }

  /** Emite el evento que corresponde al resultado y lo devuelve (atajo para `show`). */
  finish(placement: AdPlacement, outcome: AdOutcome): AdOutcome {
    const map: Record<AdOutcome['status'], AdEvent> = {
      rewarded: 'reward',
      skipped: 'skip',
      error: 'error',
      unavailable: 'error',
    };
    this.emit(map[outcome.status], placement, outcome);
    return outcome;
  }
}
