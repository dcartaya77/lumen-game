import { Container, Sprite } from 'pixi.js';
import type { Enemy, Projectile } from '../core/entities';
import { Pool } from '../core/Pool';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';
import type { Enemies } from './Enemies';

export interface WeaponEvents {
  onEnemyDamaged(e: Enemy, amount: number, x: number, y: number): void;
}

const SPREAD = 0.14; // radianes entre proyectiles múltiples

/**
 * Auto-ataque: cada arma dispara al enemigo más cercano cuando su cooldown
 * llega a cero. Los proyectiles viven en un pool y colisionan vía el hash de enemigos.
 */
export class Weapons {
  readonly layer = new Container();
  private readonly projectiles: Pool<Projectile>;
  private readonly near: Enemy[] = [];

  constructor(
    tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly events: WeaponEvents,
  ) {
    this.projectiles = new Pool<Projectile>(
      () => {
        const sprite = new Sprite({ texture: tex.bolt, anchor: 0.5, blendMode: 'add' });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { x: 0, y: 0, vx: 0, vy: 0, dmg: 0, radius: 6, life: 0, pierce: 1, hit: [], sprite };
      },
      (p) => (p.sprite.visible = false),
      64,
    );
  }

  update(dt: number): void {
    this.fire(dt);
    this.moveProjectiles(dt);
  }

  private fire(dt: number): void {
    const p = this.player;
    for (const slot of p.weapons) {
      slot.cd -= dt;
      if (slot.cd > 0) continue;
      const lv = slot.def.levels[slot.level - 1]!;
      const target = this.enemies.nearest(p.x, p.y, slot.def.range);
      if (!target) {
        slot.cd = 0.1; // sin objetivo: reintenta pronto sin gastar el cooldown completo
        continue;
      }
      slot.cd = lv.cooldown * p.cooldownMult;
      const base = Math.atan2(target.y - p.y, target.x - p.x);
      const half = (lv.count - 1) / 2;
      for (let i = 0; i < lv.count; i++) {
        const a = base + (i - half) * SPREAD;
        const pr = this.projectiles.acquire();
        pr.x = p.x;
        pr.y = p.y;
        pr.vx = Math.cos(a) * lv.speed;
        pr.vy = Math.sin(a) * lv.speed;
        pr.dmg = lv.dmg * p.damageMult;
        pr.radius = 6 * lv.size;
        pr.life = slot.def.range / lv.speed + 0.3;
        pr.pierce = lv.pierce;
        pr.hit.length = 0;
        pr.sprite.visible = true;
        pr.sprite.rotation = a;
        pr.sprite.scale.set(lv.size);
        pr.sprite.tint = slot.def.color;
      }
    }
  }

  private moveProjectiles(dt: number): void {
    const list = this.projectiles.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const pr = list[i]!;
      pr.life -= dt;
      if (pr.life <= 0) {
        this.projectiles.releaseAt(i);
        continue;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.sprite.position.set(pr.x, pr.y);

      const n = this.enemies.hash.query(pr.x, pr.y, pr.radius + 16, this.near);
      for (let j = 0; j < n && pr.pierce > 0; j++) {
        const e = this.near[j]!;
        if (e.hp <= 0 || pr.hit.includes(e.id)) continue;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        const r = e.radius + pr.radius;
        if (dx * dx + dy * dy > r * r) continue;
        pr.hit.push(e.id);
        pr.pierce--;
        this.events.onEnemyDamaged(e, pr.dmg, pr.x, pr.y);
      }
      if (pr.pierce <= 0) this.projectiles.releaseAt(i);
    }
  }

  clear(): void {
    this.projectiles.releaseAll();
  }
}
