import { Container, Graphics } from 'pixi.js';
import { Pool } from '../core/Pool';

export type TelegraphKind = 'line' | 'cone' | 'circle';

export interface TelegraphSpec {
  kind: TelegraphKind;
  x: number;
  y: number;
  /** Dirección en radianes (línea y cono). */
  angle?: number;
  /** Largo de la línea o alcance del cono. */
  length?: number;
  /** Ancho de la línea. */
  width?: number;
  /** Semiángulo del cono. */
  spread?: number;
  /** Radio del círculo. */
  radius?: number;
  /** Segundos de aviso antes del golpe. */
  dur: number;
}

interface Telegraph extends Required<TelegraphSpec> {
  t: number;
  g: Graphics;
}

const DANGER = 0xff3b3b;
const DANGER_SOFT = 0xffb0a0;

/**
 * Avisos de ataque (telegrafías) y pruebas de impacto. Cada aviso es rojo con borde grueso,
 * trae chevrones que indican la dirección y se rellena según se acerca el golpe: forma y color,
 * no solo brillo, para leerse en pantallas pequeñas.
 */
export class Hazards {
  readonly layer = new Container();
  private readonly pool: Pool<Telegraph>;

  constructor() {
    this.pool = new Pool<Telegraph>(
      () => {
        const g = new Graphics();
        g.visible = false;
        this.layer.addChild(g);
        return { kind: 'line', x: 0, y: 0, angle: 0, length: 0, width: 0, spread: 0, radius: 0, dur: 1, t: 0, g };
      },
      (tg) => (tg.g.visible = false),
      6,
    );
  }

  /** Muestra un aviso; se libera solo al cumplirse `dur`. */
  warn(spec: TelegraphSpec): void {
    const tg = this.pool.acquire();
    tg.kind = spec.kind;
    tg.x = spec.x;
    tg.y = spec.y;
    tg.angle = spec.angle ?? 0;
    tg.length = spec.length ?? 0;
    tg.width = spec.width ?? 0;
    tg.spread = spec.spread ?? 0;
    tg.radius = spec.radius ?? 0;
    tg.dur = spec.dur;
    tg.t = 0;
    tg.g.visible = true;
    tg.g.position.set(tg.x, tg.y);
    tg.g.rotation = tg.angle;
    this.draw(tg);
  }

  update(dt: number): void {
    const list = this.pool.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const tg = list[i]!;
      tg.t += dt;
      if (tg.t >= tg.dur) {
        this.pool.releaseAt(i);
        continue;
      }
      this.draw(tg);
    }
  }

  clear(): void {
    this.pool.releaseAll();
  }

  private draw(tg: Telegraph): void {
    const p = Math.min(1, tg.t / tg.dur);
    // Parpadeo rápido en el último tramo: "ya viene".
    const blink = p > 0.8 && Math.floor(tg.t * 18) % 2 === 0;
    const g = tg.g;
    g.clear();
    const edge = blink ? 0xffffff : DANGER;
    if (tg.kind === 'line') {
      const w = tg.width / 2;
      g.rect(0, -w, tg.length, tg.width).fill({ color: DANGER, alpha: 0.14 });
      g.rect(0, -w, tg.length * p, tg.width).fill({ color: DANGER, alpha: 0.38 });
      g.rect(0, -w, tg.length, tg.width).stroke({ color: edge, width: 3, alpha: 0.95 });
      for (let x = 24; x < tg.length - 10; x += 44) {
        g.moveTo(x, -w * 0.45).lineTo(x + 14, 0).lineTo(x, w * 0.45).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
      }
    } else if (tg.kind === 'cone') {
      const s = tg.spread;
      g.moveTo(0, 0).arc(0, 0, tg.length, -s, s).closePath().fill({ color: DANGER, alpha: 0.14 });
      g.moveTo(0, 0).arc(0, 0, tg.length * p, -s, s).closePath().fill({ color: DANGER, alpha: 0.38 });
      g.moveTo(0, 0).arc(0, 0, tg.length, -s, s).closePath().stroke({ color: edge, width: 3, alpha: 0.95 });
      for (let x = 60; x < tg.length - 20; x += 60) {
        const h = Math.tan(s) * x * 0.35;
        g.moveTo(x, -h).lineTo(x + 14, 0).lineTo(x, h).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
      }
    } else {
      const r = tg.radius;
      g.circle(0, 0, r).fill({ color: DANGER, alpha: 0.14 });
      g.circle(0, 0, r * p).fill({ color: DANGER, alpha: 0.38 });
      g.circle(0, 0, r).stroke({ color: edge, width: 3, alpha: 0.95 });
      const k = r * 0.35;
      g.moveTo(-k, -k).lineTo(k, k).moveTo(k, -k).lineTo(-k, k).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
    }
  }
}

/** ¿Un círculo (px, py, r) toca la línea que parte de (x, y) con ángulo `angle`, largo `length` y ancho `width`? */
export function hitsLine(px: number, py: number, r: number, x: number, y: number, angle: number, length: number, width: number): boolean {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = px - x;
  const dy = py - y;
  const along = dx * c + dy * s;
  const perp = -dx * s + dy * c;
  return along >= -r && along <= length + r && Math.abs(perp) <= width / 2 + r;
}
