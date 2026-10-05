import { Container, Sprite } from 'pixi.js';
import { AURA_BASE_RADIUS, CHAIN_RANGE, NOVA_BASE_RADIUS, ORBIT_RADIUS } from '@/data/balance';
import type { Enemy, Flash, Nova, Projectile } from '../core/entities';
import { TAU } from '../core/math';
import { Pool } from '../core/Pool';
import type { Player, WeaponSlot } from '../Player';
import type { GameTextures } from '../render/textures';
import type { Enemies } from './Enemies';

export interface WeaponEvents {
  /** `nx, ny` = dirección del empuje (unitaria). */
  onEnemyDamaged(e: Enemy, amount: number, x: number, y: number, knockback: number, nx: number, ny: number): void;
  onHeal(amount: number): void;
  onFire(weaponId: string): void;
}

const SPREAD = 0.14;

/**
 * Todas las armas en un sistema: cada comportamiento es un método corto.
 * Las armas no saben de enemigos concretos; piden "el más cercano" o consultan el hash.
 */
export class Weapons {
  /** Debajo del jugador: auras. */
  readonly underLayer = new Container();
  /** Encima: proyectiles, orbes, haces, novas. */
  readonly layer = new Container();

  private readonly projectiles: Pool<Projectile>;
  private readonly flashes: Pool<Flash>;
  private readonly novas: Pool<Nova>;
  private readonly auras = new Map<string, Sprite>();
  private readonly orbs = new Map<string, Sprite[]>();
  private readonly near: Enemy[] = [];
  private orbitAngle = 0;
  private pendingNova: { slot: WeaponSlot; n: number; t: number } | null = null;
  private time = 0;

  constructor(
    private readonly tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly events: WeaponEvents,
  ) {
    this.projectiles = new Pool<Projectile>(
      () => {
        const sprite = new Sprite({ texture: tex.bolt, anchor: 0.5, blendMode: 'add' });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return {
          x: 0, y: 0, vx: 0, vy: 0, dmg: 0, radius: 6, life: 0, pierce: 1, knockback: 0,
          homing: false, speed: 0, hit: [], sprite,
        };
      },
      (p) => (p.sprite.visible = false),
      64,
    );
    this.flashes = new Pool<Flash>(
      () => {
        const sprite = new Sprite({ texture: tex.beam, anchor: { x: 0, y: 0.5 }, blendMode: 'add' });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { life: 0, maxLife: 1, sprite };
      },
      (f) => (f.sprite.visible = false),
      16,
    );
    this.novas = new Pool<Nova>(
      () => {
        const sprite = new Sprite({ texture: tex.ring, anchor: 0.5, blendMode: 'add' });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { x: 0, y: 0, radius: 0, maxRadius: 1, speed: 0, dmg: 0, knockback: 0, hit: [], sprite };
      },
      (n) => (n.sprite.visible = false),
      4,
    );
  }

  update(dt: number): void {
    this.time += dt;
    const p = this.player;
    for (const slot of p.weapons) {
      slot.cd -= dt;
      switch (slot.def.behavior) {
        case 'projectile':
        case 'homing':
          if (slot.cd <= 0) this.fireProjectiles(slot);
          break;
        case 'aura':
          this.updateAura(slot);
          break;
        case 'orbit':
          this.updateOrbit(slot, dt);
          break;
        case 'beam':
          if (slot.cd <= 0) this.fireBeam(slot);
          break;
        case 'nova':
          if (slot.cd <= 0) this.fireNova(slot);
          break;
        case 'chain':
          if (slot.cd <= 0) this.fireChain(slot);
          break;
      }
    }
    this.updatePendingNova(dt);
    this.moveProjectiles(dt);
    this.updateNovas(dt);
    this.updateFlashes(dt);
    this.cleanupRemoved();
  }

  /* ------------------------------ proyectiles ------------------------------ */

  private fireProjectiles(slot: WeaponSlot): void {
    const p = this.player;
    const lv = slot.def.levels[slot.level - 1]!;
    const target = this.enemies.nearest(p.x, p.y, slot.def.range);
    if (!target) {
      slot.cd = 0.1;
      return;
    }
    slot.cd = lv.cooldown * p.cooldownMult;
    this.events.onFire(slot.def.id);
    const homing = slot.def.behavior === 'homing';
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    const half = (lv.count - 1) / 2;
    for (let i = 0; i < lv.count; i++) {
      const a = homing ? base + (i - half) * 0.5 : base + (i - half) * SPREAD;
      const pr = this.projectiles.acquire();
      pr.x = p.x;
      pr.y = p.y;
      pr.speed = lv.speed;
      pr.vx = Math.cos(a) * lv.speed;
      pr.vy = Math.sin(a) * lv.speed;
      pr.dmg = lv.dmg * p.damageMult;
      pr.radius = 6 * lv.size;
      pr.life = homing ? lv.duration : slot.def.range / lv.speed + 0.3;
      pr.pierce = lv.pierce;
      pr.knockback = slot.def.knockback;
      pr.homing = homing;
      pr.hit.length = 0;
      pr.sprite.texture = homing ? this.tex.dot : this.tex.bolt;
      pr.sprite.visible = true;
      pr.sprite.rotation = a;
      pr.sprite.scale.set(homing ? lv.size * 1.6 : lv.size);
      pr.sprite.tint = slot.def.color;
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
      if (pr.homing) {
        const t = this.enemies.nearest(pr.x, pr.y, 300, pr.hit);
        if (t) {
          const dx = t.x - pr.x;
          const dy = t.y - pr.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, 6 * dt);
          pr.vx += ((dx / d) * pr.speed - pr.vx) * k;
          pr.vy += ((dy / d) * pr.speed - pr.vy) * k;
          pr.sprite.rotation = Math.atan2(pr.vy, pr.vx);
        }
        pr.sprite.alpha = 0.6 + Math.sin(this.time * 20 + i) * 0.4;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.sprite.position.set(pr.x, pr.y);

      const n = this.enemies.hash.query(pr.x, pr.y, pr.radius + 24, this.near);
      for (let j = 0; j < n && pr.pierce > 0; j++) {
        const e = this.near[j]!;
        if (e.hp <= 0 || pr.hit.includes(e.id)) continue;
        const dx = e.x - pr.x;
        const dy = e.y - pr.y;
        const r = e.radius + pr.radius;
        if (dx * dx + dy * dy > r * r) continue;
        pr.hit.push(e.id);
        pr.pierce--;
        const vl = Math.hypot(pr.vx, pr.vy) || 1;
        this.events.onEnemyDamaged(e, pr.dmg, pr.x, pr.y, pr.knockback, pr.vx / vl, pr.vy / vl);
      }
      if (pr.pierce <= 0) this.projectiles.releaseAt(i);
    }
  }

  /* --------------------------------- aura --------------------------------- */

  private updateAura(slot: WeaponSlot): void {
    const p = this.player;
    const lv = slot.def.levels[slot.level - 1]!;
    const radius = AURA_BASE_RADIUS * lv.size;
    let sprite = this.auras.get(slot.def.id);
    if (!sprite) {
      sprite = new Sprite({ texture: this.tex.aura, anchor: 0.5, blendMode: 'add', tint: slot.def.color });
      this.underLayer.addChild(sprite);
      this.auras.set(slot.def.id, sprite);
    }
    const pulse = 1 + Math.sin(this.time * 5) * 0.04;
    sprite.position.set(p.x, p.y);
    sprite.scale.set((radius / 64) * pulse);
    sprite.alpha = 0.55 + Math.sin(this.time * 5) * 0.1;

    if (slot.cd > 0) return;
    slot.cd = lv.cooldown * p.cooldownMult;
    const n = this.enemies.hash.query(p.x, p.y, radius, this.near);
    let hits = 0;
    for (let j = 0; j < n; j++) {
      const e = this.near[j]!;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > radius + e.radius || e.hp <= 0) continue;
      hits++;
      this.events.onEnemyDamaged(e, lv.dmg * p.damageMult, e.x, e.y, slot.def.knockback, dx / (d || 1), dy / (d || 1));
    }
    // Hoguera: cura un poco por cada enemigo que quema.
    if (slot.def.id === 'bonfire' && hits > 0) this.events.onHeal(Math.min(3, hits) * 0.6);
  }

  /* --------------------------------- órbita -------------------------------- */

  private updateOrbit(slot: WeaponSlot, dt: number): void {
    const p = this.player;
    const lv = slot.def.levels[slot.level - 1]!;
    let sprites = this.orbs.get(slot.def.id);
    if (!sprites) {
      sprites = [];
      this.orbs.set(slot.def.id, sprites);
    }
    while (sprites.length < lv.count) {
      const s = new Sprite({ texture: this.tex.orb, anchor: 0.5, blendMode: 'add', tint: slot.def.color });
      this.layer.addChild(s);
      sprites.push(s);
    }
    this.orbitAngle += lv.speed * dt;
    const radius = ORBIT_RADIUS * (slot.def.evolved ? 1.4 : 1);
    const hitRadius = 10 * lv.size;
    const tick = slot.cd <= 0;
    if (tick) slot.cd = lv.cooldown * p.cooldownMult;

    for (let i = 0; i < lv.count; i++) {
      const a = this.orbitAngle + (i / lv.count) * TAU;
      const ox = p.x + Math.cos(a) * radius;
      const oy = p.y + Math.sin(a) * radius;
      const s = sprites[i]!;
      s.position.set(ox, oy);
      s.scale.set(lv.size);
      if (!tick) continue;
      const n = this.enemies.hash.query(ox, oy, hitRadius + 24, this.near);
      for (let j = 0; j < n; j++) {
        const e = this.near[j]!;
        const dx = e.x - ox;
        const dy = e.y - oy;
        const r = e.radius + hitRadius;
        if (e.hp <= 0 || dx * dx + dy * dy > r * r) continue;
        // Empuje tangencial: los orbes "barren" a los enemigos.
        const tx = -Math.sin(a);
        const ty = Math.cos(a);
        this.events.onEnemyDamaged(e, lv.dmg * p.damageMult, e.x, e.y, slot.def.knockback, tx, ty);
      }
    }
  }

  /* ---------------------------------- haz ---------------------------------- */

  private fireBeam(slot: WeaponSlot): void {
    const p = this.player;
    const lv = slot.def.levels[slot.level - 1]!;
    const target = this.enemies.nearest(p.x, p.y, slot.def.range);
    if (!target) {
      slot.cd = 0.1;
      return;
    }
    slot.cd = lv.cooldown * p.cooldownMult;
    this.events.onFire(slot.def.id);
    const base = Math.atan2(target.y - p.y, target.x - p.x);
    const half = (lv.count - 1) / 2;
    const len = lv.speed;
    const width = 10 * lv.size;
    for (let i = 0; i < lv.count; i++) {
      const a = base + (i - half) * 0.35;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      this.flash(p.x, p.y, a, len, lv.size, slot.def.color, lv.duration);
      const list = this.enemies.pool.active;
      for (let j = 0; j < list.length; j++) {
        const e = list[j]!;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const along = dx * ux + dy * uy;
        if (along < 0 || along > len) continue;
        const perp = Math.abs(dx * uy - dy * ux);
        if (perp > width / 2 + e.radius) continue;
        this.events.onEnemyDamaged(e, lv.dmg * p.damageMult, e.x, e.y, slot.def.knockback, ux, uy);
      }
    }
  }

  /* --------------------------------- cadena -------------------------------- */

  private fireChain(slot: WeaponSlot): void {
    const p = this.player;
    const lv = slot.def.levels[slot.level - 1]!;
    let target = this.enemies.nearest(p.x, p.y, slot.def.range);
    if (!target) {
      slot.cd = 0.1;
      return;
    }
    slot.cd = lv.cooldown * p.cooldownMult;
    this.events.onFire(slot.def.id);
    const visited: number[] = [];
    let fromX = p.x;
    let fromY = p.y;
    for (let jump = 0; jump < lv.count && target; jump++) {
      const dx = target.x - fromX;
      const dy = target.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      this.flash(fromX, fromY, Math.atan2(dy, dx), d, 0.5, slot.def.color, 0.15);
      visited.push(target.id);
      this.events.onEnemyDamaged(target, lv.dmg * p.damageMult, target.x, target.y, slot.def.knockback, dx / d, dy / d);
      fromX = target.x;
      fromY = target.y;
      target = this.enemies.nearest(fromX, fromY, CHAIN_RANGE, visited);
    }
  }

  /* ---------------------------------- nova --------------------------------- */

  private fireNova(slot: WeaponSlot): void {
    const lv = slot.def.levels[slot.level - 1]!;
    slot.cd = lv.cooldown * this.player.cooldownMult;
    this.events.onFire(slot.def.id);
    this.spawnNova(slot);
    if (lv.count > 1) this.pendingNova = { slot, n: lv.count - 1, t: 0.35 };
  }

  private updatePendingNova(dt: number): void {
    const pn = this.pendingNova;
    if (!pn) return;
    pn.t -= dt;
    if (pn.t > 0) return;
    this.spawnNova(pn.slot);
    pn.n--;
    pn.t = 0.35;
    if (pn.n <= 0) this.pendingNova = null;
  }

  private spawnNova(slot: WeaponSlot): void {
    const lv = slot.def.levels[slot.level - 1]!;
    const nv = this.novas.acquire();
    nv.x = this.player.x;
    nv.y = this.player.y;
    nv.radius = 10;
    nv.maxRadius = NOVA_BASE_RADIUS * lv.size;
    nv.speed = lv.speed;
    nv.dmg = lv.dmg * this.player.damageMult;
    nv.knockback = slot.def.knockback;
    nv.hit.length = 0;
    nv.sprite.visible = true;
    nv.sprite.tint = slot.def.color;
    nv.sprite.alpha = 1;
    nv.sprite.position.set(nv.x, nv.y);
  }

  private updateNovas(dt: number): void {
    const list = this.novas.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const nv = list[i]!;
      nv.radius += nv.speed * dt;
      if (nv.radius >= nv.maxRadius) {
        this.novas.releaseAt(i);
        continue;
      }
      nv.sprite.scale.set(nv.radius / 40);
      nv.sprite.alpha = 1 - nv.radius / nv.maxRadius;
      const n = this.enemies.hash.query(nv.x, nv.y, nv.radius + 30, this.near);
      for (let j = 0; j < n; j++) {
        const e = this.near[j]!;
        if (e.hp <= 0 || nv.hit.includes(e.id)) continue;
        const dx = e.x - nv.x;
        const dy = e.y - nv.y;
        const d = Math.hypot(dx, dy);
        if (d > nv.radius + e.radius) continue;
        nv.hit.push(e.id);
        this.events.onEnemyDamaged(e, nv.dmg, e.x, e.y, nv.knockback, dx / (d || 1), dy / (d || 1));
      }
    }
  }

  /* -------------------------------- visuales ------------------------------- */

  private flash(x: number, y: number, angle: number, length: number, thickness: number, color: number, life: number): void {
    const f = this.flashes.acquire();
    f.life = f.maxLife = life;
    f.sprite.visible = true;
    f.sprite.position.set(x, y);
    f.sprite.rotation = angle;
    f.sprite.scale.set(length / 64, thickness);
    f.sprite.tint = color;
    f.sprite.alpha = 1;
  }

  private updateFlashes(dt: number): void {
    const list = this.flashes.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const f = list[i]!;
      f.life -= dt;
      if (f.life <= 0) this.flashes.releaseAt(i);
      else f.sprite.alpha = f.life / f.maxLife;
    }
  }

  /** Retira auras/orbes de armas que ya no están (tras una evolución). */
  private cleanupRemoved(): void {
    const ids = new Set(this.player.weapons.map((w) => w.def.id));
    for (const [id, s] of this.auras) {
      if (ids.has(id)) continue;
      s.destroy();
      this.auras.delete(id);
    }
    for (const [id, list] of this.orbs) {
      if (ids.has(id)) continue;
      for (const s of list) s.destroy();
      this.orbs.delete(id);
    }
  }

  clear(): void {
    this.projectiles.releaseAll();
    this.flashes.releaseAll();
    this.novas.releaseAll();
  }
}
