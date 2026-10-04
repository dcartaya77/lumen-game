import { BitmapText, Container, Sprite, type Texture } from 'pixi.js';
import type { DamageText, Particle } from '../core/entities';
import { rand, TAU } from '../core/math';
import { Pool } from '../core/Pool';

/** Nivel de calidad: controla cuántas partículas se emiten (ajuste automático por FPS). */
export type Quality = 0 | 1 | 2;

/**
 * Partículas y números de daño con pools. Nada se crea durante la partida
 * salvo que el pool se quede corto (y entonces queda reutilizable).
 */
export class Fx {
  readonly layer = new Container();
  quality: Quality = 2;

  private readonly particles: Pool<Particle>;
  private readonly texts: Pool<DamageText>;
  private readonly maxParticles = [60, 160, 320];

  constructor(dot: Texture) {
    this.particles = new Pool<Particle>(
      () => {
        const sprite = new Sprite({ texture: dot, anchor: 0.5, blendMode: 'add' });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, startScale: 1, drag: 0, sprite };
      },
      (p) => (p.sprite.visible = false),
      160,
    );
    this.texts = new Pool<DamageText>(
      () => {
        const text = new BitmapText({
          text: '0',
          style: { fontFamily: 'Arial', fontSize: 18, fontWeight: '900', fill: 0xffffff },
        });
        text.anchor.set(0.5);
        text.visible = false;
        this.layer.addChild(text);
        return { x: 0, y: 0, vy: 0, life: 0, text };
      },
      (t) => (t.text.visible = false),
      40,
    );
  }

  burst(x: number, y: number, color: number, count: number, speed = 160, life = 0.45, scale = 1): void {
    const budget = this.maxParticles[this.quality]! - this.particles.size;
    const n = Math.min(count >> (2 - this.quality), budget);
    for (let i = 0; i < n; i++) {
      const p = this.particles.acquire();
      const a = rand(0, TAU);
      const s = rand(speed * 0.3, speed);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = p.life = rand(life * 0.6, life);
      p.startScale = rand(0.4, 1) * scale;
      p.drag = 3;
      p.sprite.tint = color;
      p.sprite.visible = true;
      p.sprite.alpha = 1;
    }
  }

  damage(x: number, y: number, amount: number, color = 0xffffff): void {
    if (this.quality === 0 && amount < 20) return;
    const t = this.texts.acquire();
    t.x = x + rand(-6, 6);
    t.y = y - 10;
    t.vy = -70;
    t.life = 0.6;
    t.text.text = String(Math.round(amount));
    t.text.tint = color;
    t.text.scale.set(amount >= 40 ? 1.3 : 1);
    t.text.alpha = 1;
    t.text.visible = true;
  }

  update(dt: number): void {
    const ps = this.particles.active;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.releaseAt(i);
        continue;
      }
      const k = 1 - p.drag * dt;
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.maxLife;
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set(p.startScale * t);
      p.sprite.alpha = t;
    }
    const ts = this.texts.active;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i]!;
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.releaseAt(i);
        continue;
      }
      t.y += t.vy * dt;
      t.vy += 120 * dt;
      t.text.position.set(t.x, t.y);
      t.text.alpha = Math.min(1, t.life * 3);
    }
  }

  clear(): void {
    this.particles.releaseAll();
    this.texts.releaseAll();
  }
}
