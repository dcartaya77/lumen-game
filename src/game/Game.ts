import { Application, Container, Graphics, type Ticker } from 'pixi.js';

/**
 * Orquestador del juego sobre PixiJS 8. En el hito 1 solo demuestra la
 * inicialización moderna (`await app.init()`), el redimensionado y un bucle
 * con la llama del jugador. Los sistemas (movimiento, combate, spawn…) se
 * añaden en el hito 2 sobre esta misma estructura.
 */
export class Game {
  readonly app = new Application();
  readonly world = new Container();
  private flame = new Graphics();
  private glow = new Graphics();
  private elapsed = 0;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: '#0b0a14',
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);
    this.buildFlame();
    this.app.ticker.add(this.update, this);
    this.app.ticker.maxFPS = 60;

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(host);
    this.layout();
  }

  private buildFlame(): void {
    this.glow.circle(0, 0, 90).fill({ color: 0xffa640, alpha: 0.12 });
    this.glow.circle(0, 0, 50).fill({ color: 0xffb95a, alpha: 0.18 });
    this.flame.circle(0, 0, 14).fill(0xfff3c4);
    this.flame.circle(0, 0, 20).stroke({ color: 0xffa640, width: 3, alpha: 0.9 });
    this.world.addChild(this.glow, this.flame);
  }

  private layout(): void {
    const { width, height } = this.app.screen;
    this.world.position.set(width / 2, height / 2);
  }

  private update(ticker: Ticker): void {
    this.elapsed += ticker.deltaMS / 1000;
    const pulse = 1 + Math.sin(this.elapsed * 4) * 0.06;
    this.glow.scale.set(pulse);
    this.flame.scale.set(1 + Math.sin(this.elapsed * 7) * 0.08);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (this.app.renderer) {
      this.app.ticker.remove(this.update, this);
      this.app.destroy(true, { children: true });
    }
  }
}
