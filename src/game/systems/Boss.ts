import { Container, Graphics, Sprite } from 'pixi.js';
import { adaptiveBossHp, BOSS, type BossAttack, type BossId, type BossPhase, type DevourerCfg } from '@/data/bosses';
import { ENEMY_BY_ID } from '@/data/enemies';
import type { EnemyDef } from '@/data/types';
import type { BossHud } from '@/state/run';
import type { Enemy } from '../core/entities';
import { rand, TAU } from '../core/math';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';
import type { Enemies } from './Enemies';
import type { Hazards } from './Hazards';
import type { Pickups } from './Pickups';

type Mode = 'idle' | 'intro' | 'fight' | 'down';
type Act = 'chase' | 'windup' | 'strike' | 'recover' | 'roar';

export interface BossEvents {
  onPlayerHit(amount: number): void;
  onPhase(phase: number): void;
  /** Aparecen fragmentos de luz (`first` = la primera vez, para el aviso). */
  onGemsSpawned(first: boolean): void;
  onAbsorb(stacks: number, x: number, y: number): void;
  /** Se abre el núcleo (punto débil); `first` solo la primera vez. */
  onExposed(first: boolean): void;
  onFire(): void;
  onBurst(x: number, y: number, color: number, count: number, speed: number, life: number, scale: number): void;
  onShake(amount: number): void;
  /** XP que da un fragmento de luz: `frac` del XP que falta para el siguiente nivel (antes del multiplicador de XP). */
  gemXp(frac: number): number;
}

const ARENA_COLOR = 0xb06bff;
const CORE_COLOR = 0xffd24a;
const AURA_COLOR = 0x9b6bff;
const EYES = 0xffe08a;

/**
 * Duelo contra el Devorador de Luz en una arena cerrada. Reutiliza la entidad Enemy (armas, empuje,
 * congelación y muerte ya funcionan) y este sistema gobierna su movimiento, sus ataques telegrafiados,
 * los fases, el punto débil y su mecánica única: absorbe los fragmentos de luz y se refuerza.
 */
export class BossDuel {
  /** Arena y brillos del jefe; va bajo el resto de capas del mundo. */
  readonly layer = new Container();
  mode: Mode = 'idle';
  boss: Enemy | null = null;
  phase = 1;
  stacks = 0;
  /** Segundos de combate (sin contar la intro). */
  elapsed = 0;
  /** Vida asignada al empezar el duelo (se recalibra una vez con el daño real al jefe). */
  maxHp = 0;
  /** DPS (sin bonificaciones) que el jugador hizo al jefe en la ventana de calibración; 0 hasta medirlo. */
  bossDps = 0;
  cx = 0;
  cy = 0;

  private cfg: DevourerCfg = BOSS.types.devourer;
  private readonly arena = new Graphics();
  private readonly aura: Sprite;
  private readonly core: Sprite;
  private act: Act = 'chase';
  private t = 0;
  private angle = 0;
  private attack: BossAttack = 'charge';
  private seq = 0;
  private hitDone = false;
  private chainNext = false;
  private exposed = 0;
  private exposedSeen = false;
  private frozen = false;
  private gemT = 0;
  private gemsSeen = false;
  private addT = 0;
  private introT = 0;
  private baseScale = 1;
  private hpMod = 1;
  private rawDealt = 0;
  private calibrated = false;
  private age = 0;
  private def: EnemyDef | null = null;
  private readonly pt = { x: 0, y: 0 };

  constructor(
    tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly hazards: Hazards,
    private readonly pickups: Pickups,
    private readonly events: BossEvents,
  ) {
    this.aura = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', tint: AURA_COLOR });
    this.core = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', tint: CORE_COLOR });
    this.aura.visible = this.core.visible = false;
    this.layer.addChild(this.arena, this.aura, this.core);
  }

  get radius(): number {
    return BOSS.arenaRadius;
  }

  /** Empieza el duelo: dibuja la arena centrada en (cx, cy) y hace entrar al jefe por el lado opuesto al jugador. */
  start(id: BossId, dps: number, hpMod: number, cx: number, cy: number): void {
    this.cfg = BOSS.types[id];
    const c = this.cfg;
    this.cx = cx;
    this.cy = cy;
    this.drawArena();
    this.def = {
      id: `boss_${id}`,
      nameKey: 'boss_devourer',
      hp: 1,
      speed: c.speed,
      dmg: c.contactDmg,
      radius: c.radius,
      xp: c.xp,
      eyeColor: EYES,
      tint: 0x4b2f80,
      scale: c.radius / 10.5,
      shape: 'blob',
      behavior: 'mini',
      boss: true,
    };
    const away = Math.atan2(this.player.y - cy, this.player.x - cx) + Math.PI;
    const e = this.enemies.spawn(this.def, cx + Math.cos(away) * this.radius * 0.7, cy + Math.sin(away) * this.radius * 0.7, 1);
    this.maxHp = adaptiveBossHp(c.hp, dps, hpMod);
    this.hpMod = hpMod;
    this.bossDps = 0;
    this.rawDealt = 0;
    this.calibrated = false;
    e.maxHp = e.hp = this.maxHp;
    e.eyes.scale.set(1.7);
    e.body.alpha = 0;
    this.boss = e;
    this.baseScale = e.def.scale;
    this.mode = 'intro';
    this.introT = BOSS.introTime;
    this.phase = 1;
    this.stacks = 0;
    this.elapsed = 0;
    this.act = 'chase';
    this.seq = 0;
    this.exposed = 0;
    this.exposedSeen = false;
    this.gemsSeen = false;
    this.frozen = false;
    this.applyStats();
    this.aura.visible = true;
  }

  /** ¿El jugador puede dañar al jefe ahora? 0 en la intro; >1 con el núcleo abierto. */
  damageMult(): number {
    if (this.mode === 'intro') return 0;
    return this.exposed > 0 ? this.cfg.exposedMult : 1;
  }

  hud(e: Enemy): BossHud {
    return {
      nameKey: 'boss_devourer',
      hp: Math.max(0, Math.ceil(e.hp)),
      maxHp: e.maxHp,
      phase: this.phase,
      exposed: this.exposed > 0,
      stacks: this.stacks,
      maxStacks: this.cfg.gems.maxStacks,
    };
  }

  /** Daño del jugador al jefe antes de bonificaciones: alimenta la recalibración de su vida. */
  noteDamage(raw: number): void {
    if (this.mode === 'fight' && !this.calibrated) this.rawDealt += raw;
  }

  /**
   * La vida inicial sale del DPS contra las hordas, que no es el DPS contra un objetivo único. Pasados unos
   * segundos se corrige con el daño real al jefe, conservando la fracción de vida para que la barra no salte.
   */
  private calibrate(e: Enemy): void {
    this.calibrated = true;
    this.bossDps = this.rawDealt / Math.max(1, this.elapsed);
    const frac = e.hp / e.maxHp;
    this.maxHp = adaptiveBossHp(this.cfg.hp, this.bossDps, this.hpMod);
    e.maxHp = this.maxHp;
    e.hp = Math.max(1, Math.round(this.maxHp * frac));
  }

  /** Mantiene un objeto (jugador) dentro de la arena. */
  clamp(o: { x: number; y: number }, r: number): void {
    const dx = o.x - this.cx;
    const dy = o.y - this.cy;
    const d = Math.hypot(dx, dy);
    const max = this.radius - r;
    if (d > max) {
      o.x = this.cx + (dx / d) * max;
      o.y = this.cy + (dy / d) * max;
    }
  }

  update(dt: number): void {
    const e = this.boss;
    if (this.mode === 'idle' || !e) return;
    this.age += dt;
    this.syncVisuals(e);
    if (this.mode === 'down' || e.hp <= 0) return;

    if (this.mode === 'intro') {
      this.introT -= dt;
      e.body.alpha = Math.min(1, 1 - this.introT / BOSS.introTime + 0.15);
      if (this.introT <= 0) {
        e.body.alpha = 1;
        this.mode = 'fight';
        this.act = 'chase';
        this.t = 1.2;
        this.gemT = this.cfg.gems.firstDelay;
      }
      return;
    }

    this.elapsed += dt;
    if (!this.calibrated && (this.elapsed >= BOSS.calibrate.at || (this.elapsed >= 3 && e.hp < e.maxHp * 0.6))) this.calibrate(e);
    // Congelado (Escarcha): no ataca; al descongelar, un golpe a medias vuelve a avisar.
    if (e.freeze > 0) {
      this.frozen = true;
      return;
    }
    if (this.frozen) {
      this.frozen = false;
      if (this.act === 'windup') this.rewarn(Math.max(this.t, 0.6));
    }
    if (this.exposed > 0) this.exposed -= dt;

    // Cambio de fase por vida.
    const frac = e.hp / e.maxHp;
    const th = this.cfg.thresholds;
    const target = frac <= th[1] ? 3 : frac <= th[0] ? 2 : 1;
    if (this.calibrated && target > this.phase && this.act !== 'roar') this.beginRoar(target);

    this.updateGems(dt, e);
    this.updateAdds(dt, e);
    this.updateAct(dt * this.enemies.speedFactor(e), e);
    this.clamp(e, e.radius);
  }

  /** El jefe ha muerto: limpia avisos, refuerzos y proyectiles. */
  onDefeated(): void {
    this.mode = 'down';
    this.hazards.clear();
    this.enemies.clearShots();
    this.exposed = 0;
    this.core.visible = false;
    this.aura.visible = false;
    this.boss = null;
  }

  clear(): void {
    this.mode = 'idle';
    this.boss = null;
    this.arena.clear();
    this.aura.visible = this.core.visible = false;
    this.hazards.clear();
  }

  /* ------------------------------ ataques ------------------------------ */

  private phaseCfg(): BossPhase {
    return this.cfg.phases[this.phase - 1]!;
  }

  private applyStats(): void {
    const e = this.boss;
    if (!e) return;
    const g = this.cfg.gems;
    e.speed = this.cfg.speed * this.enemies.mods.speed * this.phaseCfg().speedMult * (1 + this.stacks * g.speedPerStack);
    e.dmg = this.cfg.contactDmg * this.enemies.mods.dmg * (1 + this.stacks * g.dmgPerStack);
  }

  private dmg(base: number): number {
    return base * this.enemies.mods.dmg * (1 + this.stacks * this.cfg.gems.dmgPerStack);
  }

  private scaleNow(): number {
    return this.baseScale * (1 + this.stacks * this.cfg.gems.scalePerStack);
  }

  private updateAct(dt: number, e: Enemy): void {
    const c = this.cfg;
    const p = this.player;
    switch (this.act) {
      case 'chase': {
        // Con fragmentos a la vista deja de perseguir al jugador y corre a absorberlos.
        const gem = this.pickups.nearest(e.x, e.y);
        const gd = gem ? Math.hypot(gem.x - e.x, gem.y - e.y) : Infinity;
        const hunting = gem !== null && gd < c.gems.huntRange;
        const tx = hunting ? gem.x : p.x;
        const ty = hunting ? gem.y : p.y;
        const d = Math.hypot(tx - e.x, ty - e.y) || 1;
        if (hunting || d > e.radius + 120) {
          const sp = e.speed * (hunting ? c.gems.huntMult : 1);
          e.x += ((tx - e.x) / d) * sp * dt;
          e.y += ((ty - e.y) / d) * sp * dt;
        }
        this.t -= dt;
        if (this.t <= 0 && !hunting) this.startAttack();
        break;
      }
      case 'windup':
        this.t -= dt;
        e.body.scale.set(this.scaleNow() * (1 + Math.sin(this.t * 40) * 0.05));
        if (this.t <= 0) this.fire(e);
        break;
      case 'strike': {
        const ch = c.charge;
        e.x += Math.cos(this.angle) * ch.speed * dt;
        e.y += Math.sin(this.angle) * ch.speed * dt;
        this.t -= dt;
        if (!this.hitDone && Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius + 4) {
          this.hitDone = true;
          e.contactCd = 0.5;
          this.events.onPlayerHit(this.dmg(ch.dmg));
        }
        if (this.t <= 0) this.endStrike(e);
        break;
      }
      case 'recover':
        this.t -= dt;
        if (this.t <= 0) {
          if (this.chainNext) {
            this.chainNext = false;
            this.startCharge(c.charge.windupChain);
          } else {
            this.act = 'chase';
            this.t = this.phaseCfg().cooldown;
          }
        }
        break;
      case 'roar':
        this.t -= dt;
        e.body.scale.set(this.scaleNow() * (1 + Math.sin(this.age * 30) * 0.04));
        if (this.t <= 0) this.endRoar(e);
        break;
    }
  }

  private startAttack(): void {
    const seq = this.phaseCfg().seq;
    this.attack = seq[this.seq++ % seq.length]!;
    this.chainNext = this.attack === 'chain';
    const c = this.cfg;
    if (this.attack === 'charge' || this.attack === 'chain') this.startCharge(c.charge.windup);
    else if (this.attack === 'pulse') this.startPulse();
    else this.startFan();
  }

  private aim(e: Enemy): void {
    this.angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
  }

  private startCharge(windup: number): void {
    const e = this.boss!;
    this.aim(e);
    this.attack = 'charge';
    this.act = 'windup';
    this.t = windup;
    this.hitDone = false;
    this.warn(windup);
  }

  private startPulse(): void {
    this.act = 'windup';
    this.t = this.cfg.pulse.windup;
    this.warn(this.t);
  }

  private startFan(): void {
    this.aim(this.boss!);
    this.act = 'windup';
    this.t = this.cfg.fan.windup;
    this.warn(this.t);
  }

  /** Aviso del ataque en curso con `dur` segundos restantes. */
  private warn(dur: number): void {
    const e = this.boss!;
    const c = this.cfg;
    if (this.attack === 'pulse') {
      this.hazards.warn({ kind: 'circle', x: e.x, y: e.y, radius: c.pulse.radius, dur });
    } else if (this.attack === 'fan') {
      this.hazards.warn({ kind: 'cone', x: e.x, y: e.y, angle: this.angle, spread: c.fan.spread, length: c.fan.range, dur });
    } else {
      this.hazards.warn({
        kind: 'line',
        x: e.x,
        y: e.y,
        angle: this.angle,
        length: c.charge.length + e.radius,
        width: e.radius * 2 + 16,
        dur,
      });
    }
  }

  private rewarn(dur: number): void {
    this.t = dur;
    if (this.attack === 'charge') this.aim(this.boss!);
    this.warn(dur);
  }

  /** Fin del aviso: el golpe sale. */
  private fire(e: Enemy): void {
    const c = this.cfg;
    const p = this.player;
    e.body.scale.set(this.scaleNow());
    if (this.attack === 'charge') {
      this.act = 'strike';
      this.t = c.charge.length / c.charge.speed;
    } else if (this.attack === 'pulse') {
      if (Math.hypot(p.x - e.x, p.y - e.y) < c.pulse.radius + p.radius) this.events.onPlayerHit(this.dmg(c.pulse.dmg));
      this.events.onBurst(e.x, e.y, 0xff5a7a, 40, 340, 0.7, 1.5);
      this.events.onShake(8);
      this.events.onFire();
      this.openCore(c.pulse.exposed);
    } else {
      const f = c.fan;
      for (let i = 0; i < f.count; i++) {
        const a = this.angle + (f.count === 1 ? 0 : (i / (f.count - 1) - 0.5) * 2 * f.spread);
        this.enemies.fireShot(e.x, e.y, Math.cos(a) * f.shotSpeed, Math.sin(a) * f.shotSpeed, this.dmg(f.shotDmg), 1.5);
      }
      this.events.onFire();
      this.act = 'recover';
      this.t = f.recover;
    }
  }

  private endStrike(e: Enemy): void {
    const ch = this.cfg.charge;
    this.events.onShake(5);
    if (this.chainNext) {
      // Primer golpe de una cadena: respira un momento y vuelve a avisar.
      this.act = 'recover';
      this.t = 0.45;
      return;
    }
    // Golpe fallido = punto débil abierto; si acierta, el hueco es mucho menor.
    this.events.onBurst(e.x, e.y, 0xffd24a, 24, 240, 0.6, 1.2);
    this.openCore(this.hitDone ? ch.exposedHit : ch.exposedMiss);
  }

  /** Abre el núcleo `secs` segundos: daño bonificado y quieto. */
  private openCore(secs: number): void {
    this.exposed = secs;
    this.act = 'recover';
    this.t = secs + (this.attack === 'charge' ? this.cfg.charge.recover : 0.2);
    this.events.onExposed(!this.exposedSeen);
    this.exposedSeen = true;
  }

  /* ------------------------------ fases ------------------------------ */

  private beginRoar(phase: number): void {
    const e = this.boss!;
    this.phase = phase;
    this.act = 'roar';
    this.t = this.cfg.roar;
    this.exposed = 0;
    this.chainNext = false;
    this.hazards.clear();
    this.enemies.clearShots();
    this.applyStats();
    this.events.onPhase(phase);
    this.events.onBurst(e.x, e.y, ARENA_COLOR, 50, 360, 0.8, 1.6);
    this.events.onShake(10);
  }

  private endRoar(e: Enemy): void {
    e.body.scale.set(this.scaleNow());
    const adds = this.phaseCfg().adds;
    this.addT = adds && adds.every > 0 ? adds.every : 0;
    if (adds) this.spawnAdds(e, adds.id, adds.n);
    this.act = 'chase';
    this.t = 1.0;
  }

  private updateAdds(dt: number, e: Enemy): void {
    const adds = this.phaseCfg().adds;
    if (!adds || adds.every <= 0 || this.act === 'roar') return;
    this.addT -= dt;
    if (this.addT <= 0) {
      this.addT = adds.every;
      this.spawnAdds(e, adds.id, adds.n);
    }
  }

  private spawnAdds(e: Enemy, id: string, n: number): void {
    const def = ENEMY_BY_ID[id];
    if (!def) return;
    for (let i = 0; i < n; i++) {
      // Siempre hay un máximo de refuerzos vivos: la arena debe leerse bien.
      if (this.enemies.pool.size - 1 >= BOSS.maxAdds) return;
      const a = rand(0, TAU);
      const r = e.radius + 50;
      this.pt.x = e.x + Math.cos(a) * r;
      this.pt.y = e.y + Math.sin(a) * r;
      this.clamp(this.pt, def.radius);
      this.enemies.spawn(def, this.pt.x, this.pt.y, 1);
    }
    this.events.onBurst(e.x, e.y, ARENA_COLOR, 16, 200, 0.5, 1);
  }

  /* ------------------------ fragmentos de luz ------------------------ */

  private updateGems(dt: number, e: Enemy): void {
    const g = this.cfg.gems;
    this.gemT -= dt;
    if (this.gemT <= 0) {
      this.gemT = g.every;
      this.spawnGems(e);
    }
    const n = this.pickups.take(e.x, e.y, e.radius + 16);
    if (n > 0) {
      this.stacks = Math.min(g.maxStacks, this.stacks + n);
      this.applyStats();
      this.events.onAbsorb(this.stacks, e.x, e.y);
    }
  }

  /** Un racimo de fragmentos en el lado del jugador: gana quien llegue antes. */
  private spawnGems(e: Enemy): void {
    const g = this.cfg.gems;
    const p = this.player;
    let bx = this.cx;
    let by = this.cy;
    let best = -Infinity;
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      const r = this.radius * rand(0.25, 0.75);
      const x = this.cx + Math.cos(a) * r;
      const y = this.cy + Math.sin(a) * r;
      const score = Math.hypot(x - e.x, y - e.y) - Math.hypot(x - p.x, y - p.y) * 1.5;
      if (score > best) {
        best = score;
        bx = x;
        by = y;
      }
    }
    const xp = this.events.gemXp(g.xpFrac);
    for (let i = 0; i < g.count; i++) {
      const a = (i / g.count) * TAU;
      this.pt.x = bx + Math.cos(a) * 36;
      this.pt.y = by + Math.sin(a) * 36;
      this.clamp(this.pt, 8);
      this.pickups.drop(this.pt.x, this.pt.y, xp);
    }
    this.events.onBurst(bx, by, 0xffe9a8, 14, 120, 0.6, 1.1);
    this.events.onGemsSpawned(!this.gemsSeen);
    this.gemsSeen = true;
  }

  /* ------------------------------ visual ------------------------------ */

  private syncVisuals(e: Enemy): void {
    const open = this.exposed > 0;
    e.eyes.tint = open ? CORE_COLOR : EYES;
    e.eyes.scale.set(open ? 2.6 + Math.sin(this.age * 14) * 0.25 : 1.7);
    this.aura.position.set(e.x, e.y);
    this.aura.scale.set((e.radius * (2.6 + this.stacks * 0.12)) / 60);
    this.aura.alpha = 0.15 + (this.stacks / this.cfg.gems.maxStacks) * 0.6;
    this.core.visible = open;
    if (open) {
      this.core.position.set(e.x, e.y);
      this.core.scale.set((e.radius * 1.5) / 60 + Math.sin(this.age * 14) * 0.05);
      this.core.alpha = 0.9;
    }
    if (this.act !== 'windup' && this.act !== 'roar') e.body.scale.set(this.scaleNow());
  }

  private drawArena(): void {
    const g = this.arena;
    const r = this.radius;
    g.clear();
    g.rect(this.cx - 3000, this.cy - 3000, 6000, 6000).fill({ color: 0x05040a, alpha: 0.78 });
    g.circle(this.cx, this.cy, r).cut();
    g.circle(this.cx, this.cy, r).stroke({ color: ARENA_COLOR, width: 5, alpha: 0.9 });
    g.circle(this.cx, this.cy, r - 9).stroke({ color: ARENA_COLOR, width: 2, alpha: 0.3 });
  }
}
