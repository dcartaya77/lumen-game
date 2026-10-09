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

/** Zona persistente: avisa `warn` s (rojo, con aspa) y luego daña a quien la pise durante `life` s (naranja, con burbujas). */
interface Zone {
  x: number;
  y: number;
  radius: number;
  warn: number;
  life: number;
  t: number;
  g: Graphics;
}

const DANGER = 0xff3b3b;
const DANGER_SOFT = 0xffb0a0;
const ZONE_FILL = 0xff7a1a;
const ZONE_EDGE = 0xffc060;

/**
 * Avisos de ataque (telegrafías) y pruebas de impacto. Cada aviso es rojo con borde grueso,
 * trae chevrones que indican la dirección y se rellena según se acerca el golpe: forma y color,
 * no solo brillo, para leerse en pantallas pequeñas.
 */
export class Hazards {
  readonly layer = new Container();
  /** Oscuridad del duelo (Eclipse): centro y radio de la luz; los avisos que salen de ella llevan un contorno reforzado. r = 0, sin oscuridad. */
  light = { x: 0, y: 0, r: 0 };
  private readonly pool: Pool<Telegraph>;
  private readonly zones: Pool<Zone>;

  constructor() {
    this.zones = new Pool<Zone>(
      () => {
        const g = new Graphics();
        g.visible = false;
        this.layer.addChild(g);
        return { x: 0, y: 0, radius: 0, warn: 1, life: 1, t: 0, g };
      },
      (z) => (z.g.visible = false),
      6,
    );
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
    const zs = this.zones.active;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i]!;
      z.t += dt;
      if (z.t >= z.warn + z.life) this.zones.releaseAt(i);
      else this.drawZone(z);
    }
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

  /** Deja una zona persistente: primero avisa y después hace daño (consultar con `zoneHit`). */
  zone(x: number, y: number, radius: number, warn: number, life: number): void {
    const z = this.zones.acquire();
    z.x = x;
    z.y = y;
    z.radius = radius;
    z.warn = warn;
    z.life = life;
    z.t = 0;
    z.g.visible = true;
    z.g.position.set(x, y);
    this.drawZone(z);
  }

  get zoneCount(): number {
    return this.zones.size;
  }

  /** ¿El círculo (px, py, r) pisa una zona ya activa? */
  zoneHit(px: number, py: number, r: number): boolean {
    for (const z of this.zones.active) {
      if (z.t < z.warn) continue;
      const dx = px - z.x;
      const dy = py - z.y;
      const rr = z.radius + r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  clearZones(): void {
    this.zones.releaseAll();
  }

  private drawZone(z: Zone): void {
    const g = z.g;
    g.clear();
    const r = z.radius;
    if (z.t < z.warn) {
      const p = z.t / z.warn;
      const blink = p > 0.8 && Math.floor(z.t * 18) % 2 === 0;
      g.circle(0, 0, r).fill({ color: DANGER, alpha: 0.14 });
      g.circle(0, 0, r * p).fill({ color: DANGER, alpha: 0.38 });
      g.circle(0, 0, r).stroke({ color: blink ? 0xffffff : DANGER, width: 3, alpha: 0.95 });
      const k = r * 0.35;
      g.moveTo(-k, -k).lineTo(k, k).moveTo(k, -k).lineTo(-k, k).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
      return;
    }
    // Activa: se apaga en el último segundo para avisar de que desaparece.
    const left = z.warn + z.life - z.t;
    const fade = left < 1 ? left : 1;
    const pulse = 0.5 + Math.sin(z.t * 6) * 0.5;
    g.circle(0, 0, r).fill({ color: ZONE_FILL, alpha: (0.3 + pulse * 0.1) * fade });
    g.circle(0, 0, r).stroke({ color: ZONE_EDGE, width: 3, alpha: 0.9 * fade });
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + z.x * 0.01;
      const d = r * 0.5;
      g.circle(Math.cos(a) * d, Math.sin(a) * d, 6 + pulse * 4).stroke({ color: ZONE_EDGE, width: 2, alpha: 0.7 * fade });
    }
  }

  private draw(tg: Telegraph): void {
    const p = Math.min(1, tg.t / tg.dur);
    // Parpadeo rápido en el último tramo: "ya viene".
    const blink = p > 0.8 && Math.floor(tg.t * 18) % 2 === 0;
    const g = tg.g;
    g.clear();
    const strong = this.leavesLight(tg);
    const edge = blink ? 0xffffff : strong ? 0xffd0c8 : DANGER;
    const fill = strong ? 0.26 : 0.14;
    const prog = strong ? 0.5 : 0.38;
    // Fuera de la luz: borde negro grueso bajo el borde claro para que se lea sobre cualquier fondo.
    const outline = (shape: (g: Graphics) => Graphics) => {
      if (strong) shape(g).stroke({ color: 0x000000, width: 11, alpha: 0.9 });
      shape(g).stroke({ color: edge, width: strong ? 5 : 3, alpha: 0.95 });
    };
    if (tg.kind === 'line') {
      const w = tg.width / 2;
      g.rect(0, -w, tg.length, tg.width).fill({ color: DANGER, alpha: fill });
      g.rect(0, -w, tg.length * p, tg.width).fill({ color: DANGER, alpha: prog });
      outline((g) => g.rect(0, -w, tg.length, tg.width));
      for (let x = 24; x < tg.length - 10; x += 44) {
        g.moveTo(x, -w * 0.45).lineTo(x + 14, 0).lineTo(x, w * 0.45).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
      }
    } else if (tg.kind === 'cone') {
      const s = tg.spread;
      g.moveTo(0, 0).arc(0, 0, tg.length, -s, s).closePath().fill({ color: DANGER, alpha: fill });
      g.moveTo(0, 0).arc(0, 0, tg.length * p, -s, s).closePath().fill({ color: DANGER, alpha: prog });
      outline((g) => g.moveTo(0, 0).arc(0, 0, tg.length, -s, s).closePath());
      for (let x = 60; x < tg.length - 20; x += 60) {
        const h = Math.tan(s) * x * 0.35;
        g.moveTo(x, -h).lineTo(x + 14, 0).lineTo(x, h).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
      }
    } else {
      const r = tg.radius;
      g.circle(0, 0, r).fill({ color: DANGER, alpha: fill });
      g.circle(0, 0, r * p).fill({ color: DANGER, alpha: prog });
      outline((g) => g.circle(0, 0, r));
      const k = r * 0.35;
      g.moveTo(-k, -k).lineTo(k, k).moveTo(k, -k).lineTo(-k, k).stroke({ color: DANGER_SOFT, width: 3, alpha: 0.8 });
    }
  }

  /** ¿El aviso se sale del círculo de luz del jugador? (solo hay luz limitada en la oscuridad del duelo) */
  private leavesLight(tg: Telegraph): boolean {
    const L = this.light;
    if (L.r <= 0) return false;
    const far = (x: number, y: number) => (x - L.x) ** 2 + (y - L.y) ** 2 > L.r * L.r;
    if (tg.kind === 'circle') return Math.hypot(tg.x - L.x, tg.y - L.y) + tg.radius > L.r;
    return far(tg.x, tg.y) || far(tg.x + Math.cos(tg.angle) * tg.length, tg.y + Math.sin(tg.angle) * tg.length);
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
