import { Container, Sprite } from 'pixi.js';
import { GEM_MAGNET_SPEED, GEM_PICKUP_RADIUS } from '@/data/balance';
import type { Gem } from '../core/entities';
import { rand } from '../core/math';
import { Pool } from '../core/Pool';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';

export interface PickupEvents {
  onXp(amount: number, x: number, y: number): void;
}

/** Fragmentos de luz (XP): flotan, el imán los atrae y se recogen al tocar al jugador. */
export class Pickups {
  readonly layer = new Container();
  private readonly gems: Pool<Gem>;
  private t = 0;

  constructor(
    tex: GameTextures,
    private readonly player: Player,
    private readonly events: PickupEvents,
  ) {
    this.gems = new Pool<Gem>(
      () => {
        const sprite = new Sprite({ texture: tex.gem, anchor: 0.5 });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { x: 0, y: 0, value: 1, pulled: false, sprite };
      },
      (g) => (g.sprite.visible = false),
      150,
    );
  }

  drop(x: number, y: number, value: number): void {
    const g = this.gems.acquire();
    g.x = x + rand(-6, 6);
    g.y = y + rand(-6, 6);
    g.value = value;
    g.pulled = false;
    g.sprite.visible = true;
    g.sprite.position.set(g.x, g.y);
    g.sprite.scale.set(value > 1 ? 1.3 : 1);
  }

  update(dt: number): void {
    this.t += dt;
    const p = this.player;
    const magnet = p.magnetRadius;
    const magnet2 = magnet * magnet;
    const pick = GEM_PICKUP_RADIUS + p.radius;
    const list = this.gems.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i]!;
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < pick * pick) {
        this.events.onXp(g.value, g.x, g.y);
        this.gems.releaseAt(i);
        continue;
      }
      if (g.pulled || d2 < magnet2) {
        g.pulled = true;
        const d = Math.sqrt(d2) || 1;
        // Aceleración creciente cuanto más cerca: sensación de "succión".
        const v = GEM_MAGNET_SPEED * (0.5 + 0.5 * Math.min(1, 120 / d));
        g.x += (dx / d) * v * dt;
        g.y += (dy / d) * v * dt;
        g.sprite.position.set(g.x, g.y);
      } else {
        g.sprite.y = g.y + Math.sin(this.t * 4 + g.x) * 2;
      }
    }
  }

  /** Atrae todas las gemas del mapa (futuro: objeto imán/evolución). */
  pullAll(): void {
    for (const g of this.gems.active) g.pulled = true;
  }

  clear(): void {
    this.gems.releaseAll();
  }
}
