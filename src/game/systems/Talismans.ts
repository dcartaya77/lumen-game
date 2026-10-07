import { Container, Sprite } from 'pixi.js';
import { TAL, type TalismanId } from '@/data/talismans';
import type { TalismanRarity } from '@/data/minibosses';
import type { Enemy } from '../core/entities';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';
import type { Enemies } from './Enemies';
import type { Pickups } from './Pickups';

export interface TalismanEvents {
  onEnemyDamaged(e: Enemy, amount: number, x: number, y: number, knockback: number, nx: number, ny: number): void;
  onFx(x: number, y: number, color: number, count: number): void;
  /** Vida recuperada con Brasa vital (para el número flotante). */
  onHeal(amount: number): void;
  /** Devorador estelar: da XP equivalente a esta fracción del siguiente nivel. */
  onXp(frac: number): void;
  /** Amanecer: el motor elimina a los enemigos corrientes de la pantalla. */
  onDawn(): void;
}

interface Ring {
  sprite: Sprite;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
}

const RING_BASE = 40; // radio de la textura `ring`
const SHIELD_COLOR = 0x8ff0ff;
const NOVA_COLOR = 0xffd166;
const FROST_COLOR = 0xbdf3ff;
const EMBER_COLOR = 0x7dffa0;
const MAGNET_COLOR = 0xc78bff;
const SAND_COLOR = 0xffd9a0;
const FURY_COLOR = 0xff5a30;
const DEVOUR_COLOR = 0xffe9a8;
const ECLIPSE_COLOR = 0x9b6bff;
const REFLECT_COLOR = 0xe8e0ff;
const CARAPACE_COLOR = 0xffd24a;
const DAWN_COLOR = 0xfff3c4;

/** Efectos de los talismanes: escudo, daño en área, congelar, curar, atraer luz, ralentizar y acelerar los ataques; los exclusivos de jefe hacen cosas únicas. */
export class Talismans {
  readonly layer = new Container();
  private readonly rings: Ring[] = [];
  private readonly near: Enemy[] = [];

  constructor(
    private readonly tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly pickups: Pickups,
    private readonly events: TalismanEvents,
  ) {}

  /** Aplica el efecto. Devuelve los segundos de efecto, la curación (Brasa vital) o los enemigos alcanzados (Nova). */
  use(id: TalismanId, rarity: TalismanRarity): number {
    const p = this.player;
    const v = TAL.values;
    switch (id) {
      case 'aegis': {
        p.shield = Math.max(p.shield, v.aegis.seconds[rarity]!);
        this.ring(p.x, p.y, 90, 0.5, SHIELD_COLOR);
        this.events.onFx(p.x, p.y, SHIELD_COLOR, 24);
        return p.shield;
      }
      case 'nova': {
        const radius = v.nova.radius[rarity]!;
        const dmg = v.nova.damage[rarity]! * p.damageMult;
        this.ring(p.x, p.y, radius, 0.4, NOVA_COLOR);
        this.events.onFx(p.x, p.y, NOVA_COLOR, 40);
        const n = this.enemies.hash.query(p.x, p.y, radius + 40, this.near);
        let hits = 0;
        for (let i = 0; i < n; i++) {
          const e = this.near[i]!;
          if (e.hp <= 0) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d > radius + e.radius) continue;
          hits++;
          this.events.onEnemyDamaged(e, dmg, e.x, e.y, v.nova.knockback, dx / (d || 1), dy / (d || 1));
        }
        return hits;
      }
      case 'frost': {
        const s = v.frost.seconds[rarity]!;
        this.enemies.freezeAll(s, v.frost.bossMult);
        this.ring(p.x, p.y, 520, 0.6, FROST_COLOR);
        this.events.onFx(p.x, p.y, FROST_COLOR, 50);
        return s;
      }
      case 'ember': {
        const before = p.hp;
        p.heal(p.maxHp * v.ember.heal[rarity]!);
        const healed = Math.round(p.hp - before);
        this.ring(p.x, p.y, 80, 0.5, EMBER_COLOR);
        this.events.onFx(p.x, p.y, EMBER_COLOR, 30);
        if (healed > 0) this.events.onHeal(healed);
        return healed;
      }
      case 'magnet': {
        const s = v.magnet.seconds[rarity]!;
        p.magnetT = Math.max(p.magnetT, s);
        p.magnetK = v.magnet.radiusMult;
        this.pickups.pullAll();
        this.ring(p.x, p.y, 420, 0.6, MAGNET_COLOR);
        this.events.onFx(p.x, p.y, MAGNET_COLOR, 30);
        return s;
      }
      case 'hourglass': {
        const s = v.hourglass.seconds[rarity]!;
        this.enemies.slowAll(s, v.hourglass.slow[rarity]!, v.hourglass.bossMult);
        this.ring(p.x, p.y, 520, 0.6, SAND_COLOR);
        this.events.onFx(p.x, p.y, SAND_COLOR, 40);
        return s;
      }
      case 'fury': {
        const s = v.fury.seconds[rarity]!;
        p.furyK = Math.max(p.furyT > 0 ? p.furyK : 1, v.fury.mult[rarity]!);
        p.furyT = Math.max(p.furyT, s);
        this.ring(p.x, p.y, 120, 0.45, FURY_COLOR);
        this.events.onFx(p.x, p.y, FURY_COLOR, 36);
        return s;
      }
      case 'devour': {
        const before = p.hp;
        p.heal(p.maxHp * v.devour.heal);
        const healed = Math.round(p.hp - before);
        this.pickups.pullAll();
        this.events.onXp(v.devour.xpFrac);
        this.ring(p.x, p.y, 460, 0.6, DEVOUR_COLOR);
        this.events.onFx(p.x, p.y, DEVOUR_COLOR, 44);
        if (healed > 0) this.events.onHeal(healed);
        return healed;
      }
      case 'eclipse': {
        const n = this.enemies.blindAll(v.eclipse.seconds);
        this.ring(p.x, p.y, 520, 0.6, ECLIPSE_COLOR);
        this.events.onFx(p.x, p.y, ECLIPSE_COLOR, 44);
        return n;
      }
      case 'reflect': {
        p.reflectT = Math.max(p.reflectT, v.reflect.seconds);
        this.ring(p.x, p.y, 100, 0.5, REFLECT_COLOR);
        this.events.onFx(p.x, p.y, REFLECT_COLOR, 30);
        return p.reflectT;
      }
      case 'carapace': {
        p.barrier = p.maxHp * v.carapace.frac;
        p.barrierT = v.carapace.seconds;
        this.ring(p.x, p.y, 100, 0.5, CARAPACE_COLOR);
        this.events.onFx(p.x, p.y, CARAPACE_COLOR, 30);
        return p.barrier;
      }
      case 'dawn': {
        const before = p.hp;
        p.heal(p.maxHp * v.dawn.heal);
        const healed = Math.round(p.hp - before);
        p.shield = Math.max(p.shield, v.dawn.shield);
        this.events.onDawn();
        this.ring(p.x, p.y, 900, 0.9, DAWN_COLOR);
        this.events.onFx(p.x, p.y, DAWN_COLOR, 70);
        if (healed > 0) this.events.onHeal(healed);
        return healed;
      }
    }
  }

  /** Reflejo activo: el golpe recibido estalla en daño a los enemigos cercanos (nunca menos de `min`). */
  reflect(amount: number): void {
    const p = this.player;
    const r = TAL.values.reflect;
    const dmg = Math.max(r.min, amount * r.mult);
    this.ring(p.x, p.y, r.radius, 0.35, REFLECT_COLOR);
    this.events.onFx(p.x, p.y, REFLECT_COLOR, 18);
    const n = this.enemies.hash.query(p.x, p.y, r.radius + 40, this.near);
    for (let i = 0; i < n; i++) {
      const e = this.near[i]!;
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > r.radius + e.radius) continue;
      this.events.onEnemyDamaged(e, dmg, e.x, e.y, 160, dx / (d || 1), dy / (d || 1));
    }
  }

  update(dt: number): void {
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.sprite.visible = false;
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      r.sprite.scale.set(((0.15 + 0.85 * Math.sqrt(k)) * r.maxRadius) / RING_BASE);
      r.sprite.alpha = 1 - k;
    }
  }

  clear(): void {
    for (const r of this.rings) {
      r.life = 0;
      r.sprite.visible = false;
    }
    this.near.length = 0;
  }

  private ring(x: number, y: number, maxRadius: number, life: number, color: number): void {
    let r = this.rings.find((q) => q.life <= 0);
    if (!r) {
      const sprite = new Sprite({ texture: this.tex.ring, anchor: 0.5, blendMode: 'add' });
      sprite.visible = false;
      this.layer.addChild(sprite);
      r = { sprite, x: 0, y: 0, life: 0, maxLife: 1, maxRadius: 1 };
      this.rings.push(r);
    }
    r.x = x;
    r.y = y;
    r.life = r.maxLife = life;
    r.maxRadius = maxRadius;
    r.sprite.position.set(x, y);
    r.sprite.tint = color;
    r.sprite.visible = true;
    r.sprite.alpha = 1;
  }
}
