import { Container, Graphics, Sprite } from 'pixi.js';
import {
  adaptiveHp,
  MINI,
  miniTypeFor,
  RARITY_COLORS,
  rollRarity,
  type ChargerCfg,
  type FanCfg,
  type HintedMini,
  type MiniType,
  type ShieldCfg,
  type SwarmCfg,
  type TalismanRarity,
  type TeleportCfg,
  type TrailCfg,
} from '@/data/minibosses';
import { ENEMY_BY_ID } from '@/data/enemies';
import type { EnemyDef } from '@/data/types';
import type { Enemy } from '../core/entities';
import { rand, TAU } from '../core/math';
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
  /** Estaba congelado el paso anterior (al descongelar se repite el aviso si estaba avisando). */
  frozen: boolean;
  /** Invocador: puntos marcados para el siguiente enjambre. */
  spots: { x: number; y: number }[];
  /** Escudo: ángulo del arco, graphics y segundos que lleva abierto (sin escudo) tras un golpe. */
  shieldAngle: number;
  shieldG: Graphics | null;
  open: number;
  /** Rastro: cuenta atrás para marcar un charco sobre el jugador (vida baja). */
  aimT: number;
  /** Teletransportador: destino del salto y si está oculto (lejos y sin poder ser dañado) hasta llegar. */
  destX: number;
  destY: number;
  hidden: boolean;
}

export interface MiniEvents {
  onSpawned(m: MiniInstance): void;
  /** Golpe propio del minijefe (embestida); el contacto normal lo gestiona Enemies. */
  onPlayerHit(amount: number): void;
  onFire(m: MiniInstance): void;
  onRetreat(m: MiniInstance): void;
  onChestOpened(rarity: TalismanRarity, x: number, y: number): void;
  onBurst(x: number, y: number, color: number, count: number, speed: number, life: number, scale: number): void;
  onShake(amount: number): void;
  /** Aviso de una mecánica nueva la primera vez que se ve (Game lo muestra una vez por tipo y partida). */
  onHint(type: HintedMini): void;
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

const LOOK: Record<MiniType, { tint: number; shape: EnemyDef['shape'] }> = {
  charger: { tint: 0xff9f9f, shape: 'spiky' },
  fan: { tint: 0x8fd0a0, shape: 'blob' },
  swarm: { tint: 0xd8a0ff, shape: 'blob' },
  trail: { tint: 0xffb066, shape: 'blob' },
  shield: { tint: 0x9fc8ff, shape: 'spiky' },
  teleport: { tint: 0xc0f0f0, shape: 'shade' },
};

/** Distancia a la que se esconde el teletransportador mientras viaja: fuera del alcance de armas y contacto. */
const HIDE_OFFSET = 6000;

/** Diferencia de ángulos normalizada a [-π, π]. */
function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

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
  private readonly shields: Pool<Graphics>;
  private readonly chests: Pool<Chest>;
  private readonly pt = { x: 0, y: 0 };
  /** Cuenta atrás del siguiente golpe de zona sobre el jugador. */
  private zoneCd = 0;

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
    this.shields = new Pool<Graphics>(
      () => {
        const g = new Graphics();
        g.visible = false;
        this.layer.addChild(g);
        return g;
      },
      (g) => (g.visible = false),
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
    this.updateZones(dt);
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
      frozen: false,
      spots: [],
      shieldAngle: Math.atan2(this.player.y - e.y, this.player.x - e.x),
      shieldG: null,
      open: 0,
      aimT: 0,
      destX: 0,
      destY: 0,
      hidden: false,
    };
    if (type === 'shield') {
      m.shieldG = this.shields.acquire();
      m.shieldG.visible = true;
    }
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

  /** Retira a los minijefes vivos sin soltar cofre (antesala del jefe); los cofres ya en el suelo se quedan. */
  dismiss(): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      this.enemies.kill(this.list[i]!.e);
      this.drop(i);
    }
  }

  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.drop(i);
    this.chests.releaseAll();
    this.hazards.clear();
    this.hazards.clearZones();
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
        tint: LOOK[type].tint,
        scale: cfg.radius / 10.5,
        shape: LOOK[type].shape,
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
    if (m.shieldG) {
      const s = this.shields.active.indexOf(m.shieldG);
      if (s >= 0) this.shields.releaseAt(s);
    }
    // Los charcos del rastro desaparecen con quien los dejó.
    if (m.type === 'trail') this.hazards.clearZones();
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
    m.aura.alpha = m.phase === 'leaving' ? 1 - m.t / LEAVE_TIME : m.hidden ? 0 : 0.85;
    if (m.shieldG) this.drawShield(m);

    // Congelado (Escarcha): no ataca. Al descongelar, un golpe a medias vuelve a avisar (mín. 0,6 s).
    if (e.freeze > 0) {
      m.frozen = true;
      return false;
    }
    if (m.frozen) {
      m.frozen = false;
      if (m.phase === 'windup') this.rewarn(m);
    }

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
      if (m.hidden) this.unhide(m);
      m.phase = 'leaving';
      m.t = 0;
      e.dmg = 0;
      return false;
    }
    // Reloj de arena: su tiempo propio corre más despacio.
    const sdt = dt * this.enemies.speedFactor(e);
    switch (m.type) {
      case 'charger':
        this.updateCharger(m, sdt, MINI.types.charger);
        break;
      case 'fan':
        this.updateFan(m, sdt, MINI.types.fan);
        break;
      case 'swarm':
        this.updateSwarm(m, sdt, MINI.types.swarm);
        break;
      case 'trail':
        this.updateTrail(m, sdt, MINI.types.trail);
        break;
      case 'shield':
        this.updateShield(m, sdt, MINI.types.shield);
        break;
      case 'teleport':
        this.updateTeleport(m, sdt, MINI.types.teleport);
        break;
    }
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

  /* --------------------------- tipos nuevos --------------------------- */

  /** Qué ve el HUD como posición del minijefe: mientras viaja oculto, su destino. */
  focus(m: MiniInstance): { x: number; y: number } {
    return m.hidden ? { x: m.destX, y: m.destY } : { x: m.e.x, y: m.e.y };
  }

  /** Fracción del daño que recibe: el escudo giratorio bloquea lo que viene del lado que cubre. */
  damageMult(e: Enemy): number {
    for (const m of this.list) {
      if (m.e !== e || m.type !== 'shield' || m.open > 0) continue;
      const cfg = MINI.types.shield;
      const toPlayer = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      if (Math.abs(angDiff(m.shieldAngle, toPlayer)) <= cfg.arc) return cfg.blockMult;
    }
    return 1;
  }

  /** Repite el aviso de un golpe a medias tras descongelar (mín. 0,6 s). */
  private rewarn(m: MiniInstance): void {
    m.t = Math.max(m.t, 0.6);
    switch (m.type) {
      case 'charger':
        this.startChargerWindup(m, MINI.types.charger, m.t);
        break;
      case 'fan':
        this.startFanWindup(m, MINI.types.fan, m.t);
        break;
      case 'swarm':
        for (const s of m.spots) this.hazards.warn({ kind: 'circle', x: s.x, y: s.y, radius: MINI.types.swarm.spotRadius, dur: m.t });
        break;
      case 'shield':
        this.startBashWindup(m, MINI.types.shield, m.t);
        break;
      case 'teleport':
        this.hazards.warn({ kind: 'circle', x: m.destX, y: m.destY, radius: MINI.types.teleport.blastRadius, dur: m.t });
        break;
      case 'trail':
        break;
    }
  }

  /** Se mueve hacia el jugador si está lejos o se aparta si está muy cerca; devuelve la distancia. */
  private keepAway(m: MiniInstance, dt: number, keep: number): number {
    const e = m.e;
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = d > keep + 30 ? 1 : d < keep - 30 ? -0.7 : 0;
    e.x += (dx / d) * e.speed * k * dt;
    e.y += (dy / d) * e.speed * k * dt;
    return d;
  }

  /* Invocador de enjambres: marca puntos con un aviso y de ellos brotan motas. */

  private updateSwarm(m: MiniInstance, dt: number, cfg: SwarmCfg): void {
    switch (m.phase) {
      case 'chase': {
        const d = this.keepAway(m, dt, cfg.keepDistance);
        m.t -= dt;
        if (m.t <= 0 && d < cfg.keepDistance + 300) {
          m.chainLeft = this.lowHp(m, cfg.chainBelow) ? 1 : 0;
          this.startSwarmWindup(m, cfg, cfg.windup);
        }
        break;
      }
      case 'windup':
        m.t -= dt;
        this.wobble(m, 0.06);
        if (m.t <= 0) {
          m.e.body.scale.set(m.e.def.scale);
          this.summon(m, cfg);
          m.phase = 'recover';
          m.t = m.chainLeft > 0 ? 0.35 : cfg.recover;
        }
        break;
      case 'recover':
        m.t -= dt;
        if (m.t <= 0) {
          if (m.chainLeft > 0) {
            m.chainLeft--;
            this.startSwarmWindup(m, cfg, cfg.windupChain);
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

  private startSwarmWindup(m: MiniInstance, cfg: SwarmCfg, windup: number): void {
    m.phase = 'windup';
    m.t = windup;
    const n = this.lowHp(m, cfg.chainBelow) ? cfg.spotsLow : cfg.spots;
    m.spots.length = 0;
    const base = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * TAU + rand(-0.35, 0.35);
      const d = rand(cfg.spotDist[0], cfg.spotDist[1]);
      const x = this.player.x + Math.cos(a) * d;
      const y = this.player.y + Math.sin(a) * d;
      m.spots.push({ x, y });
      this.hazards.warn({ kind: 'circle', x, y, radius: cfg.spotRadius, dur: windup });
    }
    this.events.onHint('swarm');
  }

  private summon(m: MiniInstance, cfg: SwarmCfg): void {
    const def = ENEMY_BY_ID.mote!;
    let alive = 0;
    for (const e of this.enemies.pool.active) if (e.def === def && e.hp > 0) alive++;
    for (const s of m.spots) {
      this.events.onBurst(s.x, s.y, 0xd8a0ff, 14, 160, 0.5, 1.1);
      for (let i = 0; i < cfg.perSpot && alive < cfg.maxAlive; i++, alive++) {
        const a = rand(0, TAU);
        const r = rand(0, cfg.spotRadius * 0.7);
        this.enemies.spawn(def, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 1);
      }
    }
    this.events.onShake(3);
    this.events.onFire(m);
  }

  /* Rastro de zonas: persigue y deja charcos que avisan antes de hacer daño. */

  private updateTrail(m: MiniInstance, dt: number, cfg: TrailCfg): void {
    const e = m.e;
    const p = this.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > e.radius + 40) {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    }
    m.t -= dt;
    if (m.t <= 0 && this.hazards.zoneCount < cfg.maxZones) {
      m.t = cfg.cooldown;
      this.hazards.zone(e.x, e.y, cfg.zoneRadius, cfg.windup, cfg.zoneLife);
      this.events.onHint('trail');
    }
    // Con poca vida también marca el sitio donde está el jugador (con aviso: basta con moverse).
    if (this.lowHp(m, cfg.chainBelow)) {
      m.aimT -= dt;
      if (m.aimT <= 0 && this.hazards.zoneCount < cfg.maxZones) {
        m.aimT = cfg.aimEvery;
        this.hazards.zone(p.x, p.y, cfg.zoneRadius, cfg.windupChain, cfg.zoneLife);
      }
    }
  }

  /** Daño de los charcos activos: un golpe cada `zoneTick` s mientras se pisan. */
  private updateZones(dt: number): void {
    if (this.hazards.zoneCount === 0) return;
    this.zoneCd -= dt;
    const cfg = MINI.types.trail;
    if (this.zoneCd <= 0 && this.hazards.zoneHit(this.player.x, this.player.y, this.player.radius * 0.6)) {
      this.zoneCd = cfg.zoneTick;
      this.events.onPlayerHit(cfg.zoneDmg * this.enemies.mods.dmg);
    }
  }

  /* Escudo giratorio: el arco se vuelve hacia el jugador (con retraso) y bloquea el daño de ese lado. */

  private updateShield(m: MiniInstance, dt: number, cfg: ShieldCfg): void {
    const e = m.e;
    const p = this.player;
    const low = this.lowHp(m, cfg.chainBelow);
    if (m.open > 0) m.open -= dt;
    else {
      const step = (low ? cfg.spinLow : cfg.spin) * dt;
      const diff = angDiff(m.shieldAngle, Math.atan2(p.y - e.y, p.x - e.x));
      m.shieldAngle += Math.max(-step, Math.min(step, diff));
    }
    switch (m.phase) {
      case 'chase': {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > e.radius + 90) {
          e.x += (dx / d) * e.speed * dt;
          e.y += (dy / d) * e.speed * dt;
        }
        m.t -= dt;
        if (m.t <= 0 && d < cfg.bashTrigger) {
          m.chainLeft = low ? 1 : 0;
          this.startBashWindup(m, cfg, cfg.windup);
        }
        break;
      }
      case 'windup':
        m.t -= dt;
        this.wobble(m, 0.05);
        if (m.t <= 0) {
          e.body.scale.set(e.def.scale);
          this.bash(m, cfg);
          m.phase = 'recover';
          m.t = m.chainLeft > 0 ? 0.35 : cfg.recover;
          // Tras el golpe final baja el escudo: es la ventana para atacar.
          if (m.chainLeft <= 0) m.open = cfg.recover;
        }
        break;
      case 'recover':
        m.t -= dt;
        if (m.t <= 0) {
          if (m.chainLeft > 0) {
            m.chainLeft--;
            this.startBashWindup(m, cfg, cfg.windupChain);
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

  private startBashWindup(m: MiniInstance, cfg: ShieldCfg, windup: number): void {
    this.aimAt(m);
    m.phase = 'windup';
    m.t = windup;
    this.hazards.warn({ kind: 'cone', x: m.e.x, y: m.e.y, angle: m.angle, spread: cfg.bashSpread, length: cfg.bashRange, dur: windup });
  }

  private bash(m: MiniInstance, cfg: ShieldCfg): void {
    const e = m.e;
    const p = this.player;
    const inRange = Math.hypot(p.x - e.x, p.y - e.y) < cfg.bashRange + p.radius;
    if (inRange && Math.abs(angDiff(m.angle, Math.atan2(p.y - e.y, p.x - e.x))) < cfg.bashSpread) {
      this.events.onPlayerHit(cfg.bashDmg * this.enemies.mods.dmg);
    }
    this.events.onBurst(e.x + Math.cos(m.angle) * e.radius, e.y + Math.sin(m.angle) * e.radius, RARITY_COLORS[m.rarity]!, 20, 220, 0.5, 1.2);
    this.events.onShake(5);
    this.events.onFire(m);
  }

  private drawShield(m: MiniInstance): void {
    const g = m.shieldG!;
    const e = m.e;
    g.position.set(e.x, e.y);
    g.clear();
    g.alpha = m.phase === 'leaving' ? Math.max(0, 1 - m.t / LEAVE_TIME) : 1;
    if (m.open > 0) return;
    const cfg = MINI.types.shield;
    const r = e.radius + 12;
    g.arc(0, 0, r, m.shieldAngle - cfg.arc, m.shieldAngle + cfg.arc).stroke({ color: 0xffffff, width: 13, alpha: 0.35 });
    g.arc(0, 0, r, m.shieldAngle - cfg.arc, m.shieldAngle + cfg.arc).stroke({ color: RARITY_COLORS[m.rarity]!, width: 7, alpha: 0.95 });
  }

  /* Teletransportador: desaparece, avisa dónde va a reaparecer y golpea en círculo al llegar. */

  private updateTeleport(m: MiniInstance, dt: number, cfg: TeleportCfg): void {
    const e = m.e;
    switch (m.phase) {
      case 'chase': {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > e.radius + 120) {
          e.x += (dx / d) * e.speed * dt;
          e.y += (dy / d) * e.speed * dt;
        }
        m.t -= dt;
        if (m.t <= 0) {
          m.chainLeft = this.lowHp(m, cfg.chainBelow) ? 1 : 0;
          this.startHop(m, cfg, cfg.windup);
        }
        break;
      }
      case 'windup':
        m.t -= dt;
        if (m.t <= 0) this.arrive(m, cfg);
        break;
      case 'recover':
        m.t -= dt;
        if (m.t <= 0) {
          if (m.chainLeft > 0) {
            m.chainLeft--;
            this.startHop(m, cfg, cfg.windupChain);
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

  private startHop(m: MiniInstance, cfg: TeleportCfg, windup: number): void {
    const e = m.e;
    m.phase = 'windup';
    m.t = windup;
    const a = rand(0, TAU);
    const d = rand(cfg.hopDist[0], cfg.hopDist[1]);
    m.destX = this.player.x + Math.cos(a) * d;
    m.destY = this.player.y + Math.sin(a) * d;
    this.events.onBurst(e.x, e.y, 0xc0f0f0, 24, 220, 0.5, 1.2);
    m.hidden = true;
    e.y += HIDE_OFFSET;
    e.body.alpha = 0;
    this.hazards.warn({ kind: 'circle', x: m.destX, y: m.destY, radius: cfg.blastRadius, dur: windup });
    this.events.onHint('teleport');
  }

  private unhide(m: MiniInstance): void {
    if (!m.hidden) return;
    m.hidden = false;
    m.e.x = m.destX;
    m.e.y = m.destY;
    m.e.body.alpha = 1;
  }

  private arrive(m: MiniInstance, cfg: TeleportCfg): void {
    this.unhide(m);
    const e = m.e;
    const p = this.player;
    if (Math.hypot(p.x - e.x, p.y - e.y) < cfg.blastRadius + p.radius) this.events.onPlayerHit(cfg.blastDmg * this.enemies.mods.dmg);
    this.events.onBurst(e.x, e.y, 0xc0f0f0, 40, 320, 0.7, 1.5);
    this.events.onShake(6);
    this.events.onFire(m);
    m.phase = 'recover';
    m.t = m.chainLeft > 0 ? 0.35 : cfg.recover;
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
