import { Container, Sprite } from 'pixi.js';
import {
  adaptiveHp,
  MINI,
  miniTypeFor,
  RARITY_COLORS,
  rollRarity,
  type ChargerCfg,
  type FanCfg,
  type MiniType,
  type TalismanRarity,
} from '@/data/minibosses';
import type { EnemyDef } from '@/data/types';
import type { Enemy } from '../core/entities';
import { Pool } from '../core/Pool';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';
import type { Enemies } from './Enemies';
import type { Hazards } from './Hazards';

type Phase = 'chase' | 'windup' | 'strike' | 'recover' | 'leaving';

export interface MiniInstance {
  e: Enemy;
  type: MiniType;
  rarity: TalismanRarity;
  /** Segundos de combate (no avanza en pausa); decide la retirada. */
  age: number;
  phase: Phase;
  t: number;
  angle: number;
  /** Golpes pendientes de una cadena (vida baja). */
  chainLeft: number;
  hitDone: boolean;
  aura: Sprite;
}

export interface MiniEvents {
  onSpawned(m: MiniInstance): void;
  /** Golpe propio del minijefe (embestida); el contacto normal lo gestiona Enemies. */
  onPlayerHit(amount: number): void;
  onFire(m: MiniInstance): void;
  onRetreat(m: MiniInstance): void;
  onChestOpened(rarity: TalismanRarity, x: number, y: number): void;
}

export interface MiniSchedule {
  times: readonly number[];
  night: number;
  tier: number;
}

interface Chest {
  x: number;
  y: number;
  rarity: TalismanRarity;
  t: number;
  sprite: Sprite;
  glow: Sprite;
}

const LEAVE_TIME = 0.8;

/**
 * Minijefes de campaña: reutilizan la entidad Enemy (armas, empuje y muerte ya funcionan)
 * y este sistema gobierna su movimiento y sus ataques telegrafiados.
 * Cada tipo es una máquina de estados corta: chase -> windup (aviso) -> strike -> recover.
 */
export class Minibosses {
  readonly layer = new Container();
  schedule: MiniSchedule | null = null;
  readonly list: MiniInstance[] = [];

  private slot = 0;
  private readonly defs = new Map<MiniType, EnemyDef>();
  private readonly auras: Pool<Sprite>;
  private readonly chests: Pool<Chest>;
  private readonly pt = { x: 0, y: 0 };

  constructor(
    tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly hazards: Hazards,
    private readonly events: MiniEvents,
  ) {
    this.auras = new Pool<Sprite>(
      () => {
        const s = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add' });
        s.visible = false;
        this.layer.addChild(s);
        return s;
      },
      (s) => (s.visible = false),
      2,
    );
    this.chests = new Pool<Chest>(
      () => {
        const glow = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', alpha: 0.8 });
        const sprite = new Sprite({ texture: tex.chest, anchor: 0.5 });
        glow.visible = sprite.visible = false;
        this.layer.addChild(glow, sprite);
        return { x: 0, y: 0, rarity: 0, t: 0, sprite, glow };
      },
      (c) => (c.sprite.visible = c.glow.visible = false),
      3,
    );
  }

  /** Minijefe vivo más relevante para el HUD (el primero). */
  get current(): MiniInstance | null {
    return this.list[0] ?? null;
  }

  update(dt: number, time: number, viewRadius: number, dps: number): void {
    const sch = this.schedule;
    if (sch && this.slot < sch.times.length && time >= sch.times[this.slot]!) {
      this.spawn(miniTypeFor(sch.night, this.slot), rollRarity(sch.tier), dps, viewRadius);
      this.slot++;
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i]!;
      if (m.e.hp <= 0 || !m.e.body.visible || this.updateOne(m, dt)) this.drop(i);
    }
    this.updateChests(dt);
  }

  /** Crea un minijefe fuera de pantalla; la vida sale del DPS medido del jugador. */
  spawn(type: MiniType, rarity: TalismanRarity, dps: number, viewRadius: number): MiniInstance {
    const cfg = MINI.types[type];
    const def = this.defFor(type);
    this.enemies.ringPoint(viewRadius, this.pt);
    const e = this.enemies.spawn(def, this.pt.x, this.pt.y, 1);
    const hp = adaptiveHp(type, dps, this.enemies.mods.hp);
    e.maxHp = e.hp = hp;
    e.dmg = cfg.contactDmg * this.enemies.mods.dmg;
    e.speed = cfg.speed * this.enemies.mods.speed;
    e.xp = cfg.xp;
    e.eyes.tint = RARITY_COLORS[rarity]!;
    e.eyes.scale.set(1.7);
    const aura = this.auras.acquire();
    aura.visible = true;
    aura.tint = RARITY_COLORS[rarity]!;
    const m: MiniInstance = {
      e,
      type,
      rarity,
      age: 0,
      phase: 'chase',
      t: cfg.cooldown * 0.6,
      angle: 0,
      chainLeft: 0,
      hitDone: false,
      aura,
    };
    this.list.push(m);
    this.events.onSpawned(m);
    return m;
  }

  /** Llamar cuando un minijefe muere: quita el aura y deja el cofre con su rareza. */
  onKilled(e: Enemy): MiniInstance | null {
    const i = this.list.findIndex((m) => m.e === e);
    if (i < 0) return null;
    const m = this.list[i]!;
    this.dropChest(e.x, e.y, m.rarity);
    this.drop(i);
    return m;
  }

  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.drop(i);
    this.chests.releaseAll();
    this.hazards.clear();
  }

  /* ------------------------------ internos ------------------------------ */

  private defFor(type: MiniType): EnemyDef {
    let def = this.defs.get(type);
    if (!def) {
      const cfg = MINI.types[type];
      def = {
        id: `mb_${type}`,
        nameKey: `mb_${type}`,
        hp: 1,
        speed: cfg.speed,
        dmg: cfg.contactDmg,
        radius: cfg.radius,
        xp: cfg.xp,
        eyeColor: 0xffffff,
        tint: type === 'charger' ? 0xff9f9f : 0x8fd0a0,
        scale: cfg.radius / 10.5,
        shape: type === 'charger' ? 'spiky' : 'blob',
        behavior: 'mini',
        mini: true,
      };
      this.defs.set(type, def);
    }
    return def;
  }

  private drop(i: number): void {
    const m = this.list[i]!;
    const a = this.auras.active.indexOf(m.aura);
    if (a >= 0) this.auras.releaseAt(a);
    this.list.splice(i, 1);
  }

  /** Avanza un minijefe; devuelve true cuando ya no existe (se retiró). */
  private updateOne(m: MiniInstance, dt: number): boolean {
    const e = m.e;
    m.age += dt;
    // Aura con el color de la rareza: lo que se juega el jugador.
    const pulse = 1 + Math.sin(m.age * 5) * 0.08;
    m.aura.position.set(e.x, e.y);
    m.aura.scale.set(((e.radius * 2.6) / 60) * pulse);
    m.aura.alpha = m.phase === 'leaving' ? 1 - m.t / LEAVE_TIME : 0.85;

    if (m.phase === 'leaving') {
      m.t += dt;
      e.body.alpha = Math.max(0, 1 - m.t / LEAVE_TIME);
      if (m.t >= LEAVE_TIME) {
        this.events.onRetreat(m);
        e.body.alpha = 1;
        this.enemies.kill(e);
        return true;
      }
      return false;
    }
    // Tiempo límite: se retira sin penalización; huir solo cuesta el talismán.
    if (m.age >= MINI.timeLimit) {
      m.phase = 'leaving';
      m.t = 0;
      e.dmg = 0;
      return false;
    }
    if (m.type === 'charger') this.updateCharger(m, dt, MINI.types.charger);
    else this.updateFan(m, dt, MINI.types.fan);
    return false;
  }

  private aimAt(m: MiniInstance): void {
    m.angle = Math.atan2(this.player.y - m.e.y, this.player.x - m.e.x);
  }

  private wobble(m: MiniInstance, k: number): void {
    const base = m.e.def.scale;
    m.e.body.scale.set(base * (1 + Math.sin(m.t * 45) * k));
  }

  private lowHp(m: MiniInstance, chainBelow: number): boolean {
    return m.e.hp < m.e.maxHp * chainBelow;
  }

  /** Embestidor: persigue, avisa con una línea roja y se lanza en línea recta. */
  private updateCharger(m: MiniInstance, dt: number, cfg: ChargerCfg): void {
    const e = m.e;
    const p = this.player;
    switch (m.phase) {
      case 'chase': {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;
        m.t -= dt;
        if (m.t <= 0 && d < 520) {
          m.chainLeft = this.lowHp(m, cfg.chainBelow) ? 1 : 0;
          this.startChargerWindup(m, cfg, cfg.windup);
        }
        break;
      }
      case 'windup':
        m.t -= dt;
        this.wobble(m, 0.06);
        if (m.t <= 0) {
          e.body.scale.set(e.def.scale);
          m.phase = 'strike';
          m.t = cfg.dashDur;
          m.hitDone = false;
        }
        break;
      case 'strike': {
        e.x += Math.cos(m.angle) * cfg.dashSpeed * dt;
        e.y += Math.sin(m.angle) * cfg.dashSpeed * dt;
        m.t -= dt;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (!m.hitDone && d < e.radius + p.radius + 4) {
          m.hitDone = true;
          e.contactCd = 0.5;
          this.events.onPlayerHit(cfg.dashDmg * this.enemies.mods.dmg);
        }
        if (m.t <= 0) {
          m.phase = 'recover';
          m.t = m.chainLeft > 0 ? 0.35 : cfg.recover;
        }
        break;
      }
      case 'recover':
        m.t -= dt;
        if (m.t <= 0) {
          if (m.chainLeft > 0) {
            m.chainLeft--;
            this.startChargerWindup(m, cfg, cfg.windupChain);
          } else {
            m.phase = 'chase';
            m.t = cfg.cooldown;
          }
        }
        break;
      case 'leaving':
        break;
    }
  }

  private startChargerWindup(m: MiniInstance, cfg: ChargerCfg, windup: number): void {
    this.aimAt(m);
    m.phase = 'windup';
    m.t = windup;
    this.hazards.warn({
      kind: 'line',
      x: m.e.x,
      y: m.e.y,
      angle: m.angle,
      length: cfg.dashSpeed * cfg.dashDur + m.e.radius,
      width: m.e.radius * 2 + 12,
      dur: windup,
    });
  }

  /** Rey Escupidor: mantiene distancia, avisa con un cono rojo y dispara un abanico. */
  private updateFan(m: MiniInstance, dt: number, cfg: FanCfg): void {
    const e = m.e;
    const p = this.player;
    switch (m.phase) {
      case 'chase': {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = d > cfg.keepDistance + 30 ? 1 : d < cfg.keepDistance - 30 ? -0.7 : 0;
        e.x += (dx / d) * e.speed * k * dt;
        e.y += (dy / d) * e.speed * k * dt;
        m.t -= dt;
        if (m.t <= 0 && d < cfg.range + 120) {
          m.chainLeft = this.lowHp(m, cfg.chainBelow) ? 1 : 0;
          this.startFanWindup(m, cfg, cfg.windup);
        }
        break;
      }
      case 'windup':
        m.t -= dt;
        this.wobble(m, 0.05);
        if (m.t <= 0) {
          e.body.scale.set(e.def.scale);
          this.fireFan(m, cfg);
          m.phase = 'recover';
          m.t = m.chainLeft > 0 ? 0.3 : cfg.recover;
        }
        break;
      case 'recover':
        m.t -= dt;
        if (m.t <= 0) {
          if (m.chainLeft > 0) {
            m.chainLeft--;
            this.startFanWindup(m, cfg, cfg.windupChain);
          } else {
            m.phase = 'chase';
            m.t = cfg.cooldown;
          }
        }
        break;
      case 'strike':
      case 'leaving':
        break;
    }
  }

  private startFanWindup(m: MiniInstance, cfg: FanCfg, windup: number): void {
    this.aimAt(m);
    m.phase = 'windup';
    m.t = windup;
    this.hazards.warn({ kind: 'cone', x: m.e.x, y: m.e.y, angle: m.angle, spread: cfg.spread, length: cfg.range, dur: windup });
  }

  private fireFan(m: MiniInstance, cfg: FanCfg): void {
    const n = this.lowHp(m, cfg.chainBelow) ? cfg.countLow : cfg.count;
    const dmg = cfg.shotDmg * this.enemies.mods.dmg;
    for (let i = 0; i < n; i++) {
      const a = m.angle + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * cfg.spread);
      this.enemies.fireShot(m.e.x, m.e.y, Math.cos(a) * cfg.shotSpeed, Math.sin(a) * cfg.shotSpeed, dmg, 1.4);
    }
    this.events.onFire(m);
  }

  /* ------------------------------- cofres ------------------------------- */

  private dropChest(x: number, y: number, rarity: TalismanRarity): void {
    const c = this.chests.acquire();
    c.x = x;
    c.y = y;
    c.rarity = rarity;
    c.t = 0;
    const color = RARITY_COLORS[rarity]!;
    c.sprite.visible = c.glow.visible = true;
    c.sprite.tint = color;
    c.glow.tint = color;
    c.sprite.position.set(x, y);
    c.glow.position.set(x, y);
  }

  private updateChests(dt: number): void {
    const p = this.player;
    const list = this.chests.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i]!;
      c.t += dt;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      // El imán del jugador también atrae el cofre: recogerlo no debe ser una molestia.
      if (d < p.magnetRadius * 1.3) {
        const v = 260 + (1 - Math.min(1, d / (p.magnetRadius * 1.3))) * 300;
        c.x += (dx / d) * v * dt;
        c.y += (dy / d) * v * dt;
      }
      if (d < 30) {
        this.events.onChestOpened(c.rarity, c.x, c.y);
        this.chests.releaseAt(i);
        continue;
      }
      const bob = Math.sin(c.t * 4) * 3;
      c.sprite.position.set(c.x, c.y + bob);
      c.glow.position.set(c.x, c.y + bob);
      c.glow.scale.set(0.55 + Math.sin(c.t * 5) * 0.06);
      c.sprite.scale.set(1.25);
    }
  }
}

/** Tipos válidos para el botón de debug. */
export function isMiniType(v: string): v is MiniType {
  return v in MINI.types;
}
