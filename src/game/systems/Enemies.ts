import { Container, Sprite } from 'pixi.js';
import { enemyHpScaleAt, CONTACT_DAMAGE_INTERVAL, maxAliveAt, spawnIntervalAt } from '@/data/balance';
import type { EnemyDef } from '@/data/types';
import type { Enemy } from '../core/entities';
import { rand, TAU } from '../core/math';
import { Pool } from '../core/Pool';
import { SpatialHash } from '../core/SpatialHash';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';

export interface EnemyEvents {
  onPlayerHit(amount: number): void;
}

/**
 * Aparición, persecución, separación y daño por contacto.
 * El hash se reconstruye cada paso; lo consumen también proyectiles y recogida.
 */
export class Enemies {
  readonly layer = new Container();
  readonly pool: Pool<Enemy>;
  readonly hash = new SpatialHash<Enemy>(48);
  private readonly near: Enemy[] = [];
  private spawnTimer = 0;
  private nextId = 1;

  constructor(
    tex: GameTextures,
    private readonly player: Player,
    private readonly events: EnemyEvents,
  ) {
    this.pool = new Pool<Enemy>(
      () => {
        const body = new Container();
        const shadow = new Sprite({ texture: tex.shadow, anchor: 0.5 });
        const eyes = new Sprite({ texture: tex.eyes, anchor: 0.5 });
        body.addChild(shadow, eyes);
        body.visible = false;
        this.layer.addChild(body);
        return {
          id: 0,
          def: null as unknown as EnemyDef,
          x: 0,
          y: 0,
          hp: 1,
          maxHp: 1,
          radius: 10,
          speed: 0,
          contactCd: 0,
          flash: 0,
          body,
          shadow,
          eyes,
        };
      },
      (e) => (e.body.visible = false),
      120,
    );
  }

  spawn(def: EnemyDef, x: number, y: number, hpScale: number): Enemy {
    const e = this.pool.acquire();
    e.id = this.nextId++;
    e.def = def;
    e.x = x;
    e.y = y;
    e.maxHp = e.hp = Math.round(def.hp * hpScale);
    e.radius = def.radius * def.scale;
    e.speed = def.speed * rand(0.9, 1.1);
    e.contactCd = 0;
    e.flash = 0;
    e.body.visible = true;
    e.body.scale.set(def.scale);
    e.body.position.set(x, y);
    e.shadow.tint = def.tint;
    e.eyes.tint = def.eyeColor;
    return e;
  }

  /** Genera enemigos en un anillo fuera de pantalla alrededor del jugador. */
  updateSpawning(dt: number, time: number, defs: readonly EnemyDef[], viewRadius: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.pool.size >= maxAliveAt(time)) return;
    this.spawnTimer = spawnIntervalAt(time);
    const a = rand(0, TAU);
    const r = viewRadius + rand(40, 120);
    const def = defs[Math.floor(Math.random() * defs.length)]!;
    this.spawn(def, this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r, enemyHpScaleAt(time));
  }

  update(dt: number): void {
    const list = this.pool.active;
    const p = this.player;
    this.hash.clear();
    for (let i = 0; i < list.length; i++) this.hash.insert(list[i]!);

    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      let dx = p.x - e.x;
      let dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;

      // Separación: empuja lejos de vecinos solapados para que no se apilen en un punto.
      let sx = 0;
      let sy = 0;
      const n = this.hash.query(e.x, e.y, e.radius * 2, this.near);
      for (let j = 0; j < n; j++) {
        const o = this.near[j]!;
        if (o === e) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const od = ox * ox + oy * oy;
        const min = e.radius + o.radius;
        if (od < min * min && od > 0.0001) {
          const inv = 1 / Math.sqrt(od);
          sx += ox * inv;
          sy += oy * inv;
        }
      }
      e.x += (dx * e.speed + sx * 40) * dt;
      e.y += (dy * e.speed + sy * 40) * dt;

      // Contacto con el jugador.
      e.contactCd -= dt;
      const pr = e.radius + p.radius;
      if (d < pr && e.contactCd <= 0) {
        e.contactCd = CONTACT_DAMAGE_INTERVAL;
        this.events.onPlayerHit(e.def.dmg);
      }

      if (e.flash > 0) {
        e.flash -= dt;
        e.shadow.tint = e.flash > 0 ? 0xffffff : e.def.tint;
      }
      e.body.position.set(e.x, e.y);
      e.eyes.x = dx * 2;
    }
  }

  /** Enemigo activo más cercano dentro de `range`, o null. Escaneo lineal: ≤200 elementos. */
  nearest(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range * range;
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Elimina al enemigo por referencia (busca su índice). Para usar fuera de bucles de iteración. */
  kill(e: Enemy): void {
    const i = this.pool.active.indexOf(e);
    if (i >= 0) this.pool.releaseAt(i);
  }

  clear(): void {
    this.pool.releaseAll();
  }
}
