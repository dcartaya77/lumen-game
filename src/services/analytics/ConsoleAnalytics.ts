import type { Analytics, AnalyticsEvent } from '../types';

/** Implementación actual: solo consola. Mismo contrato que tendrá el envío a backend en la v2. */
export class ConsoleAnalytics implements Analytics {
  private ctx: Record<string, string | number | boolean> = {};
  constructor(private readonly enabled = true) {}

  setContext(ctx: Record<string, string | number | boolean>): void {
    this.ctx = { ...this.ctx, ...ctx };
  }

  track(event: AnalyticsEvent, props: Record<string, string | number | boolean | null> = {}): void {
    if (!this.enabled) return;
    console.log(`%c[analytics] ${event}`, 'color:#f5a623', { ...this.ctx, ...props, t: Date.now() });
  }
}

/** v2: cola en memoria + envío por lotes a un endpoint propio. */
export class RemoteAnalyticsStub implements Analytics {
  setContext(): void {}
  track(): void {}
}
