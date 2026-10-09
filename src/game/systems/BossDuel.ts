import { Container, Graphics, Sprite } from 'pixi.js';
import { adaptiveBossHp, BOSS, bossNameKey, colorOf, type AttackCfgs, type BossAttack, type BossCfg, type BossId, type BossMech, type BossPhase } from '@/data/bosses';
import { ENEMY_BY_ID } from '@/data/enemies';
import type { EnemyDef } from '@/data/types';
import type { TranslationKey } from '@/i18n';
import type { BossHud } from '@/state/run';
import type { Enemy } from '../core/entities';
import { clamp, rand, TAU } from '../core/math';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';
import { CRYSTAL_ID, type Enemies } from './Enemies';
import { hitsLine, type Hazards } from './Hazards';
import type { Pickups } from './Pickups';

type Mode = 'idle' | 'intro' | 'fight' | 'down';
type Act = 'chase' | 'windup' | 'strike' | 'recover' | 'roar';
/** Ataques que ejecutan algo de verdad; `chain` es una carga doble y `mirror` elige uno según el arma copiada. */
type Primitive = 'charge' | 'pulse' | 'fan' | 'beam' | 'laser' | 'rain';

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
  /** Primera vez que aparece una mecánica con aviso propio. */
  onHint(kind: 'dark' | 'crystals'): void;
  /** El Espejo copia un arma del jugador. */
  onMirror(nameKey: TranslationKey, color: number): void;
}

interface Crystal {
  e: Enemy;
  x: number;
  y: number;
  view: Container;
  glow: Sprite;
  bar: Graphics;
}

const CORE_COLOR = 0xffd24a;
const BEAM_COLOR = 0xff5a7a;

/**
 * Duelo contra el jefe de una noche de campaña en una arena cerrada. Reutiliza la entidad Enemy (armas, empuje,
 * congelación y muerte ya funcionan). El motor gobierna movimiento, ataques telegrafiados, fases y punto débil;
 * cada jefe es datos (JSON) más las mecánicas que activa por fase: fragmentos de luz (se refuerza al absorberlos),
 * oscuridad (solo se ve en el radio de la llama) y cristales (armadura hasta romperlos todos).
 */
export class BossDuel {
  /** Arena y brillos del jefe; va bajo el resto de capas del mundo. */
  readonly layer = new Container();
  /** Oscuridad del duelo: sobre el mundo y bajo los avisos de ataque. */
  readonly darkLayer = new Container();
  mode: Mode = 'idle';
  boss: Enemy | null = null;
  id: BossId = 'devourer';
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

  private cfg: BossCfg = BOSS.types.devourer;
  private readonly arena = new Graphics();
  private readonly darkG = new Graphics();
  private readonly crystalLayer = new Container();
  private readonly aura: Sprite;
  private readonly core: Sprite;
  private act: Act = 'chase';
  private t = 0;
  private angle = 0;
  private attack: Primitive = 'charge';
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
  private hordeDps = 0;
  private rawDealt = 0;
  /** Daño de la ventana en curso: jefe (suma) y cristales (media por cristal), para que un área no cuente varias veces. */
  private noteAge = -1;
  private noteBoss = 0;
  private readonly noteCry = new Map<Enemy, number>();
  private calibrated = false;
  private age = 0;
  private readonly pt = { x: 0, y: 0 };
  // Rayos (origen y ángulo) y lluvia de círculos.
  private lineX = 0;
  private lineY = 0;
  private lineA = 0;
  private rainSpots: { x: number; y: number }[] = [];
  // Espejo: siguiente arma a copiar, daño relativo, nivel del arma y su color.
  private mirrorIdx = 0;
  private mirrored = false;
  private mirrorK = 1;
  private mirrorLevel = 1;
  private mirrorColor = 0;
  // Oscuridad: radio de luz de la fase (0 = apagada), el dibujado actual y la visibilidad del jefe.
  private lightR = 0;
  private darkDrawn = -1;
  private darkSeen = false;
  private vis = 1;
  // Cristales.
  private crystals: Crystal[] = [];
  private crystalsDown = false;
  private crystalsSeen = false;
  private auraColor = 0xffffff;

  constructor(
    private readonly tex: GameTextures,
    private readonly player: Player,
    private readonly enemies: Enemies,
    private readonly hazards: Hazards,
    private readonly pickups: Pickups,
    private readonly events: BossEvents,
  ) {
    this.aura = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add' });
    this.core = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', tint: CORE_COLOR });
    this.aura.visible = this.core.visible = false;
    this.darkG.visible = false;
    this.layer.addChild(this.arena, this.aura, this.core, this.crystalLayer);
    this.darkLayer.addChild(this.darkG);
  }

  get radius(): number {
    return BOSS.arenaRadius;
  }

  /** Empieza el duelo: dibuja la arena centrada en (cx, cy) y hace entrar al jefe por el lado opuesto al jugador. */
  start(id: BossId, dps: number, hpMod: number, cx: number, cy: number): void {
    this.id = id;
    this.cfg = BOSS.types[id];
    const c = this.cfg;
    this.auraColor = colorOf(c.look.aura);
    this.aura.tint = this.auraColor;
    this.cx = cx;
    this.cy = cy;
    this.drawArena();
    const def: EnemyDef = {
      id: `boss_${id}`,
      nameKey: bossNameKey(id),
      hp: 1,
      speed: c.speed,
      dmg: c.contactDmg,
      radius: c.radius,
      xp: c.xp,
      eyeColor: colorOf(c.look.eyes),
      tint: colorOf(c.look.tint),
      scale: c.radius / 10.5,
      shape: 'blob',
      behavior: 'mini',
      boss: true,
    };
    const away = Math.atan2(this.player.y - cy, this.player.x - cx) + Math.PI;
    const e = this.enemies.spawn(def, cx + Math.cos(away) * this.radius * 0.7, cy + Math.sin(away) * this.radius * 0.7, 1);
    this.maxHp = adaptiveBossHp(c.hp, dps, hpMod, c.kMult);
    this.hpMod = hpMod;
    this.hordeDps = dps;
    this.bossDps = 0;
    this.rawDealt = 0;
    this.noteAge = -1;
    this.noteBoss = 0;
    this.noteCry.clear();
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
    this.darkSeen = false;
    this.crystalsSeen = false;
    this.crystalsDown = false;
    this.mirrorIdx = 0;
    this.mirrored = false;
    this.mirrorK = 1;
    this.mirrorColor = 0;
    this.lightR = 0;
    this.darkDrawn = -1;
    this.frozen = false;
    this.applyStats();
    this.aura.visible = true;
  }

  /** ¿El jugador puede dañar al jefe ahora? 0 en la intro; poco con cristales en pie; >1 con el núcleo abierto. */
  damageMult(): number {
    if (this.mode === 'intro') return 0;
    if (this.mechOn('crystals') && this.crystals.length > 0) return this.cfg.crystals!.armorMult;
    return this.exposed > 0 ? this.cfg.exposedMult : 1;
  }

  hud(e: Enemy): BossHud {
    return {
      nameKey: bossNameKey(this.id),
      hp: Math.max(0, Math.ceil(e.hp)),
      maxHp: e.maxHp,
      phase: this.phase,
      exposed: this.exposed > 0,
      stacks: this.stacks,
      maxStacks: this.cfg.gems?.maxStacks ?? 0,
      thresholds: this.cfg.thresholds,
      armor: this.mechOn('crystals') && this.crystals.length > 0,
      crystals: this.crystals.length,
    };
  }

  /** Daño del jugador al jefe (o a sus cristales) antes de bonificaciones: alimenta la recalibración de su vida. */
  noteDamage(raw: number, crystal?: Enemy): void {
    if (this.mode !== 'fight' || this.calibrated) return;
    if (this.noteAge < 0 || this.age - this.noteAge >= BOSS.calibrate.window) {
      this.flushNote();
      this.noteAge = this.age;
    }
    if (crystal) this.noteCry.set(crystal, (this.noteCry.get(crystal) ?? 0) + raw);
    else this.noteBoss += raw;
  }

  /** Un golpe de área alcanza al jefe y a varios cristales casi a la vez: cuenta como un solo objetivo. */
  private flushNote(): void {
    let cry = 0;
    for (const v of this.noteCry.values()) cry += v;
    this.rawDealt += Math.max(this.noteBoss, this.noteCry.size > 0 ? cry / this.noteCry.size : 0);
    this.noteBoss = 0;
    this.noteCry.clear();
  }

  isCrystal(e: Enemy): boolean {
    return this.crystals.some((c) => c.e === e);
  }

  /** Un cristal se ha roto: con el último, la armadura cae y el núcleo queda expuesto. */
  onCrystalBroken(e: Enemy): void {
    const i = this.crystals.findIndex((c) => c.e === e);
    if (i < 0) return;
    this.crystals[i]!.view.destroy({ children: true });
    this.crystals.splice(i, 1);
    this.events.onBurst(e.x, e.y, 0x8ff0ff, 24, 240, 0.6, 1.3);
    this.events.onShake(4);
    if (this.crystals.length === 0 && this.mechOn('crystals') && this.boss) {
      this.crystalsDown = true;
      this.hazards.clear();
      this.chainNext = false;
      this.openCore(this.cfg.crystals!.coreSecs, 0.2);
      this.events.onBurst(this.boss.x, this.boss.y, CORE_COLOR, 40, 320, 0.7, 1.5);
      this.events.onShake(8);
    }
  }

  /**
   * La vida inicial sale del DPS contra las hordas, que no es el DPS contra un objetivo único. Pasados unos
   * segundos se corrige con el daño real al jefe, conservando la fracción de vida para que la barra no salte.
   */
  private calibrate(e: Enemy): void {
    this.flushNote();
    this.calibrated = true;
    this.bossDps = this.rawDealt / Math.max(1, this.elapsed);
    const frac = e.hp / e.maxHp;
    this.maxHp = adaptiveBossHp(this.cfg.hp, this.bossDps, this.hpMod, this.cfg.kMult);
    e.maxHp = this.maxHp;
    e.hp = Math.max(1, Math.round(this.maxHp * frac));
    // Los cristales nacieron con una estimación del DPS contra hordas: se ajustan igual que el jefe.
    if (this.crystals.length > 0) {
      const hp = this.crystalHp();
      for (const c of this.crystals) {
        const f = c.e.hp / c.e.maxHp;
        c.e.maxHp = hp;
        c.e.hp = Math.max(1, Math.round(hp * f));
      }
    }
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
        this.enterPhase();
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

    if (this.mechOn('gems')) this.updateGems(dt, e);
    if (this.mechOn('crystals')) this.updateCrystals();
    this.updateAdds(dt, e);
    this.updateAct(dt * this.enemies.speedFactor(e), e);
    this.clamp(e, e.radius);
  }

  /** Tras revivir al jugador: se cancelan los avisos y proyectiles y el jefe se toma un respiro antes de atacar. */
  calm(): void {
    if (this.mode !== 'fight') return;
    this.hazards.clear();
    this.enemies.clearShots();
    this.rainSpots.length = 0;
    this.chainNext = false;
    if (this.act === 'windup' || this.act === 'strike') {
      this.act = 'chase';
      this.t = 1.5;
      this.boss?.body.scale.set(this.scaleNow());
    } else if (this.act === 'chase') this.t = Math.max(this.t, 1.5);
  }

  /** El jefe ha muerto: limpia avisos, refuerzos, cristales y proyectiles. */
  onDefeated(): void {
    this.mode = 'down';
    this.hazards.clear();
    this.enemies.clearShots();
    this.exposed = 0;
    this.clearCrystals();
    this.darkG.visible = false;
    this.lightR = 0;
    this.core.visible = false;
    this.aura.visible = false;
    this.boss = null;
  }

  clear(): void {
    this.mode = 'idle';
    this.boss = null;
    this.arena.clear();
    this.clearCrystals();
    this.darkG.visible = false;
    this.lightR = 0;
    this.aura.visible = this.core.visible = false;
    this.hazards.clear();
  }

  /* ------------------------------ fases y mecánicas ------------------------------ */

  private phaseCfg(): BossPhase {
    return this.cfg.phases[this.phase - 1]!;
  }

  private mechOn(m: BossMech): boolean {
    return this.phaseCfg().mech.includes(m);
  }

  private atk<K extends keyof AttackCfgs>(k: K): AttackCfgs[K] {
    return this.cfg.attacks[k]!;
  }

  /** Prepara las mecánicas de la fase actual (al empezar el combate y en cada cambio de fase). */
  private enterPhase(): void {
    const c = this.cfg;
    this.lightR = this.mechOn('dark') ? c.dark!.light[this.phase - 1]! : 0;
    this.darkG.visible = this.lightR > 0;
    if (this.lightR > 0) {
      if (this.darkDrawn !== this.lightR) this.drawDark(this.lightR);
      if (!this.darkSeen) {
        this.darkSeen = true;
        this.events.onHint('dark');
      }
    } else if (this.boss) {
      this.boss.shadow.alpha = this.boss.eyes.alpha = 1;
      this.vis = 1;
    }
    this.clearCrystals();
    this.crystalsDown = false;
    if (this.mechOn('crystals')) {
      this.spawnCrystals(c.crystals!.count[this.phase - 1]!);
      if (!this.crystalsSeen) {
        this.crystalsSeen = true;
        this.events.onHint('crystals');
      }
    }
    if (this.mechOn('gems')) this.gemT = c.gems!.firstDelay;
  }

  private beginRoar(phase: number): void {
    const e = this.boss!;
    this.phase = phase;
    this.act = 'roar';
    this.t = this.cfg.roar;
    this.exposed = 0;
    this.chainNext = false;
    this.rainSpots.length = 0;
    this.hazards.clear();
    this.enemies.clearShots();
    this.enterPhase();
    this.applyStats();
    this.events.onPhase(phase);
    this.events.onBurst(e.x, e.y, this.auraColor, 50, 360, 0.8, 1.6);
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

  private applyStats(): void {
    const e = this.boss;
    if (!e) return;
    const g = this.cfg.gems;
    const st = g ? this.stacks : 0;
    e.speed = this.cfg.speed * this.enemies.mods.speed * this.phaseCfg().speedMult * (1 + st * (g?.speedPerStack ?? 0));
    e.dmg = this.cfg.contactDmg * this.enemies.mods.dmg * (1 + st * (g?.dmgPerStack ?? 0));
  }

  private dmg(base: number): number {
    return base * this.enemies.mods.dmg * (1 + this.stacks * (this.cfg.gems?.dmgPerStack ?? 0)) * this.mirrorK;
  }

  private scaleNow(): number {
    return this.baseScale * (1 + this.stacks * (this.cfg.gems?.scalePerStack ?? 0));
  }

  /* ------------------------------ ataques ------------------------------ */

  private updateAct(dt: number, e: Enemy): void {
    const p = this.player;
    switch (this.act) {
      case 'chase': {
        // Con fragmentos a la vista deja de perseguir al jugador y corre a absorberlos.
        const g = this.mechOn('gems') ? this.cfg.gems : undefined;
        const gem = g ? this.pickups.nearest(e.x, e.y) : null;
        const gd = gem ? Math.hypot(gem.x - e.x, gem.y - e.y) : Infinity;
        const hunting = g !== undefined && gem !== null && gd < g.huntRange;
        const tx = hunting ? gem.x : p.x;
        const ty = hunting ? gem.y : p.y;
        const d = Math.hypot(tx - e.x, ty - e.y) || 1;
        if (hunting || d > e.radius + 120) {
          const sp = e.speed * (hunting ? g!.huntMult : 1);
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
        const ch = this.atk('charge');
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
            this.startCharge(this.atk('charge').windupChain);
          } else {
            this.act = 'chase';
            this.t = this.phaseCfg().cooldown;
            this.mirrored = false;
            this.mirrorColor = 0;
            this.mirrorK = 1;
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
    const a: BossAttack = seq[this.seq++ % seq.length]!;
    this.mirrored = false;
    this.mirrorK = 1;
    this.mirrorColor = 0;
    this.chainNext = a === 'chain';
    const kind: Primitive = a === 'mirror' ? this.pickMirror() : a === 'chain' ? 'charge' : a;
    // Eclipse: ataca desde la sombra, lejos del radio de luz.
    if (this.lightR > 0 && this.cfg.dark?.blink) this.blink();
    this.attack = kind;
    switch (kind) {
      case 'charge':
        this.startCharge(this.atk('charge').windup);
        break;
      case 'pulse':
        this.act = 'windup';
        this.t = this.atk('pulse').windup;
        this.warn(this.t);
        break;
      case 'fan':
        this.aim(this.boss!);
        this.act = 'windup';
        this.t = this.atk('fan').windup;
        this.warn(this.t);
        break;
      case 'beam':
      case 'laser':
        this.startLine(kind);
        break;
      case 'rain':
        this.startRain();
        break;
    }
  }

  /** El Espejo copia el siguiente arma del jugador: proyectiles -> abanico, áreas y orbes -> círculo, rayo -> rayo. */
  private pickMirror(): Primitive {
    const ws = this.player.weapons;
    const m = this.cfg.mirror!;
    if (ws.length === 0) return 'pulse';
    const w = ws[this.mirrorIdx++ % ws.length]!;
    this.mirrored = true;
    this.mirrorK = m.dmgMult;
    this.mirrorLevel = w.level;
    this.mirrorColor = w.def.color;
    this.events.onMirror(w.def.nameKey, w.def.color);
    const b = w.def.behavior;
    return b === 'beam' ? 'beam' : b === 'aura' || b === 'orbit' || b === 'nova' ? 'pulse' : 'fan';
  }

  /** Se teletransporta a la sombra (fuera del radio de luz) justo antes de avisar su ataque. */
  private blink(): void {
    const e = this.boss!;
    const p = this.player;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      const r = rand(this.lightR * 1.1, this.lightR * 1.5);
      const x = p.x + Math.cos(a) * r;
      const y = p.y + Math.sin(a) * r;
      if (Math.hypot(x - this.cx, y - this.cy) > this.radius - e.radius - 10) continue;
      this.events.onBurst(e.x, e.y, this.auraColor, 14, 160, 0.5, 1.1);
      e.x = x;
      e.y = y;
      this.events.onBurst(x, y, this.auraColor, 14, 160, 0.5, 1.1);
      return;
    }
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

  /** Rayo con aviso: desde el jefe (`beam`) o desde un cristal en pie (`laser`). */
  private startLine(kind: 'beam' | 'laser'): void {
    const e = this.boss!;
    const c = kind === 'laser' && this.crystals.length > 0 ? this.crystals[Math.floor(Math.random() * this.crystals.length)]! : null;
    this.lineX = c ? c.x : e.x;
    this.lineY = c ? c.y : e.y;
    this.lineA = Math.atan2(this.player.y - this.lineY, this.player.x - this.lineX);
    this.act = 'windup';
    this.t = this.atk(kind).windup;
    this.warn(this.t);
  }

  /** Varios círculos con aviso: uno justo sobre el jugador y el resto a su alrededor. */
  private startRain(): void {
    const r = this.atk('rain');
    const p = this.player;
    this.rainSpots.length = 0;
    this.rainSpots.push({ x: p.x, y: p.y });
    for (let i = 1; i < r.count; i++) {
      const a = rand(0, TAU);
      const d = rand(90, 260);
      this.pt.x = p.x + Math.cos(a) * d;
      this.pt.y = p.y + Math.sin(a) * d;
      this.clamp(this.pt, 20);
      this.rainSpots.push({ x: this.pt.x, y: this.pt.y });
    }
    this.act = 'windup';
    this.t = r.windup;
    this.warn(this.t);
  }

  /** Aviso del ataque en curso con `dur` segundos restantes. */
  private warn(dur: number): void {
    const e = this.boss!;
    switch (this.attack) {
      case 'pulse':
        this.hazards.warn({ kind: 'circle', x: e.x, y: e.y, radius: this.atk('pulse').radius, dur });
        break;
      case 'fan': {
        const f = this.atk('fan');
        this.hazards.warn({ kind: 'cone', x: e.x, y: e.y, angle: this.angle, spread: f.spread, length: f.range, dur });
        break;
      }
      case 'beam':
      case 'laser': {
        const b = this.atk(this.attack);
        this.hazards.warn({ kind: 'line', x: this.lineX, y: this.lineY, angle: this.lineA, length: b.length, width: b.width, dur });
        break;
      }
      case 'rain': {
        const r = this.atk('rain');
        for (const s of this.rainSpots) this.hazards.warn({ kind: 'circle', x: s.x, y: s.y, radius: r.radius, dur });
        break;
      }
      case 'charge':
        this.hazards.warn({
          kind: 'line',
          x: e.x,
          y: e.y,
          angle: this.angle,
          length: this.atk('charge').length + e.radius,
          width: e.radius * 2 + 16,
          dur,
        });
        break;
    }
  }

  private rewarn(dur: number): void {
    this.t = dur;
    if (this.attack === 'charge') this.aim(this.boss!);
    else if (this.attack === 'beam' || this.attack === 'laser') this.lineA = Math.atan2(this.player.y - this.lineY, this.player.x - this.lineX);
    this.warn(dur);
  }

  /** Fin del aviso: el golpe sale. */
  private fire(e: Enemy): void {
    const p = this.player;
    e.body.scale.set(this.scaleNow());
    switch (this.attack) {
      case 'charge':
        this.act = 'strike';
        this.t = this.atk('charge').length / this.atk('charge').speed;
        break;
      case 'pulse': {
        const a = this.atk('pulse');
        if (Math.hypot(p.x - e.x, p.y - e.y) < a.radius + p.radius) this.events.onPlayerHit(this.dmg(a.dmg));
        this.events.onBurst(e.x, e.y, BEAM_COLOR, 40, 340, 0.7, 1.5);
        this.events.onShake(8);
        this.events.onFire();
        this.finishAttack(a.exposed, a.recover ?? 0.8);
        break;
      }
      case 'fan': {
        const f = this.atk('fan');
        const extra = this.mirrored && this.cfg.mirror ? Math.min(this.cfg.mirror.maxExtra, (this.mirrorLevel - 1) * this.cfg.mirror.perLevel) : 0;
        const n = f.count + extra;
        for (let i = 0; i < n; i++) {
          const a = this.angle + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * f.spread);
          this.enemies.fireShot(e.x, e.y, Math.cos(a) * f.shotSpeed, Math.sin(a) * f.shotSpeed, this.dmg(f.shotDmg), 1.5);
        }
        this.events.onFire();
        this.finishAttack(f.exposed ?? 0, f.recover);
        break;
      }
      case 'beam':
      case 'laser': {
        const b = this.atk(this.attack);
        if (hitsLine(p.x, p.y, p.radius, this.lineX, this.lineY, this.lineA, b.length, b.width)) this.events.onPlayerHit(this.dmg(b.dmg));
        for (let i = 1; i <= 6; i++) {
          const d = (b.length / 6) * i;
          this.events.onBurst(this.lineX + Math.cos(this.lineA) * d, this.lineY + Math.sin(this.lineA) * d, this.mirrorColor || BEAM_COLOR, 5, 90, 0.35, 1);
        }
        this.events.onShake(5);
        this.events.onFire();
        this.finishAttack('exposed' in b ? (b.exposed ?? 0) : 0, b.recover);
        break;
      }
      case 'rain': {
        const r = this.atk('rain');
        let hit = false;
        for (const s of this.rainSpots) {
          this.events.onBurst(s.x, s.y, BEAM_COLOR, 18, 200, 0.5, 1.2);
          if (!hit && Math.hypot(p.x - s.x, p.y - s.y) < r.radius + p.radius) {
            hit = true;
            this.events.onPlayerHit(this.dmg(r.dmg));
          }
        }
        this.rainSpots.length = 0;
        this.events.onShake(6);
        this.events.onFire();
        this.finishAttack(0, r.recover);
        break;
      }
    }
  }

  /** Tras un ataque: con `exposed` > 0 se abre el núcleo (punto débil); si no, solo recupera el aliento. */
  private finishAttack(exposed: number, recover: number): void {
    if (exposed > 0) this.openCore(exposed, 0.2);
    else {
      this.act = 'recover';
      this.t = recover;
    }
  }

  private endStrike(e: Enemy): void {
    const ch = this.atk('charge');
    this.events.onShake(5);
    if (this.chainNext) {
      // Primer golpe de una cadena: respira un momento y vuelve a avisar.
      this.act = 'recover';
      this.t = 0.45;
      return;
    }
    // Golpe fallido = punto débil abierto; si acierta, el hueco es mucho menor.
    this.events.onBurst(e.x, e.y, CORE_COLOR, 24, 240, 0.6, 1.2);
    this.openCore(this.hitDone ? ch.exposedHit : ch.exposedMiss, ch.recover);
  }

  /** Abre el núcleo `secs` segundos: daño bonificado y quieto. */
  private openCore(secs: number, extra: number): void {
    this.exposed = secs;
    this.act = 'recover';
    this.t = secs + extra;
    this.events.onExposed(!this.exposedSeen);
    this.exposedSeen = true;
  }

  /* ------------------------------ refuerzos ------------------------------ */

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
      if (this.enemies.pool.size - 1 - this.crystals.length >= BOSS.maxAdds) return;
      const a = rand(0, TAU);
      const r = e.radius + 50;
      this.pt.x = e.x + Math.cos(a) * r;
      this.pt.y = e.y + Math.sin(a) * r;
      this.clamp(this.pt, def.radius);
      this.enemies.spawn(def, this.pt.x, this.pt.y, 1);
    }
    this.events.onBurst(e.x, e.y, this.auraColor, 16, 200, 0.5, 1);
  }

  /* ------------------------ fragmentos de luz ------------------------ */

  private updateGems(dt: number, e: Enemy): void {
    const g = this.cfg.gems!;
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
    const g = this.cfg.gems!;
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

  /* ------------------------------ cristales ------------------------------ */

  /** Vida de un cristal: unos segundos de DPS (el medido sobre el jefe si ya existe; si no, una estimación acotada por `hpMax`). */
  private crystalHp(): number {
    const c = this.cfg.crystals!;
    const dps = this.bossDps > 0 ? this.bossDps : this.hordeDps;
    return Math.round(clamp(dps * c.secs, c.hpMin, c.hpMax));
  }

  private spawnCrystals(n: number): void {
    const c = this.cfg.crystals!;
    const def: EnemyDef = {
      id: CRYSTAL_ID,
      nameKey: 'e_crystal',
      hp: 1,
      speed: 0,
      dmg: 0,
      radius: c.radius,
      xp: 4,
      eyeColor: 0xe8fbff,
      tint: 0x6fd8ff,
      scale: c.radius / 10.5,
      shape: 'spiky',
      behavior: 'mini',
    };
    const hp = this.crystalHp();
    const base = rand(0, TAU);
    for (let i = 0; i < n; i++) {
      let a = base + (i / n) * TAU;
      let x = this.cx + Math.cos(a) * this.radius * c.ring;
      let y = this.cy + Math.sin(a) * this.radius * c.ring;
      // Nunca nace encima del jugador.
      if (Math.hypot(x - this.player.x, y - this.player.y) < 90) {
        a += 0.35;
        x = this.cx + Math.cos(a) * this.radius * c.ring;
        y = this.cy + Math.sin(a) * this.radius * c.ring;
      }
      const e = this.enemies.spawn(def, x, y, 1);
      e.maxHp = e.hp = hp;
      e.dmg = 0;
      e.speed = 0;
      // El enemigo es invisible: el cristal se dibuja aparte para que brille y se lea de lejos.
      e.body.alpha = 0;
      this.crystals.push({ e, x, y, ...this.makeCrystalView(c.radius) });
      this.events.onBurst(x, y, 0x8ff0ff, 12, 140, 0.5, 1.1);
    }
  }

  private makeCrystalView(r: number): { view: Container; glow: Sprite; bar: Graphics } {
    const view = new Container();
    const glow = new Sprite({ texture: this.tex.glow, anchor: 0.5, blendMode: 'add', tint: 0x6fd8ff });
    glow.scale.set((r * 4.5) / 60);
    const body = new Graphics();
    const h = r * 1.5;
    body.poly([0, -h, r, 0, 0, h, -r, 0]).fill({ color: 0x9fefff }).stroke({ color: 0xffffff, width: 2 });
    body.poly([0, -h, r, 0, 0, 0]).fill({ color: 0xffffff, alpha: 0.55 });
    const bar = new Graphics();
    view.addChild(glow, body, bar);
    this.crystalLayer.addChild(view);
    return { view, glow, bar };
  }

  private clearCrystals(): void {
    for (const c of this.crystals) {
      this.enemies.kill(c.e);
      c.view.destroy({ children: true });
    }
    this.crystals.length = 0;
  }

  /** Los cristales no se mueven (el empuje de las armas se anula) y vuelven a crecer cuando el núcleo se cierra. */
  private updateCrystals(): void {
    for (const c of this.crystals) {
      c.e.x = c.x;
      c.e.y = c.y;
      c.e.kx = c.e.ky = 0;
    }
    if (this.crystalsDown && this.exposed <= 0 && this.act !== 'roar') {
      this.crystalsDown = false;
      this.spawnCrystals(this.cfg.crystals!.count[this.phase - 1]!);
    }
  }

  /* ------------------------------ visual ------------------------------ */

  private syncVisuals(e: Enemy): void {
    const open = this.exposed > 0;
    const eyes = colorOf(this.cfg.look.eyes);
    e.eyes.tint = open ? CORE_COLOR : eyes;
    e.eyes.scale.set(open ? 2.6 + Math.sin(this.age * 14) * 0.25 : 1.7);
    if (this.lightR > 0) {
      // En la sombra solo se adivinan sus ojos: el cuerpo aparece dentro del radio de luz.
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      this.vis = clamp(1 - (d - this.lightR) / this.cfg.dark!.feather, 0, 1);
      e.shadow.alpha = 0.04 + 0.96 * this.vis;
      e.eyes.alpha = 0.55 + 0.45 * this.vis;
      this.darkG.position.set(this.player.x, this.player.y);
    }
    const st = this.cfg.gems ? this.stacks / this.cfg.gems.maxStacks : 0;
    this.aura.tint = this.mirrorColor || this.auraColor;
    this.aura.position.set(e.x, e.y);
    this.aura.scale.set((e.radius * (2.6 + this.stacks * 0.12)) / 60);
    this.aura.alpha = (0.15 + st * 0.6) * (this.lightR > 0 ? 0.3 + 0.7 * this.vis : 1) + (this.mirrorColor && this.act === 'windup' ? 0.35 : 0);
    this.core.visible = open;
    if (open) {
      this.core.position.set(e.x, e.y);
      this.core.scale.set((e.radius * 1.5) / 60 + Math.sin(this.age * 14) * 0.05);
      this.core.alpha = 0.9;
    }
    if (this.act !== 'windup' && this.act !== 'roar') e.body.scale.set(this.scaleNow());
    this.syncCrystals();
  }

  private syncCrystals(): void {
    const h = this.cfg.crystals ? this.cfg.crystals.radius * 1.5 : 0;
    for (const c of this.crystals) {
      c.view.position.set(c.x, c.y);
      c.view.scale.set(1 + Math.sin(this.age * 5 + c.x) * 0.06);
      c.glow.alpha = 0.55 + Math.sin(this.age * 4 + c.y) * 0.15 + (c.e.flash > 0 ? 0.4 : 0);
      const f = clamp(c.e.hp / c.e.maxHp, 0, 1);
      c.bar.clear().rect(-18, h + 8, 36, 4).fill({ color: 0x0a0a14, alpha: 0.7 }).rect(-18, h + 8, 36 * f, 4).fill({ color: 0x8ff0ff });
    }
  }

  private drawArena(): void {
    const g = this.arena;
    const r = this.radius;
    const color = colorOf(this.cfg.look.aura);
    g.clear();
    g.rect(this.cx - 3000, this.cy - 3000, 6000, 6000).fill({ color: 0x05040a, alpha: 0.78 });
    g.circle(this.cx, this.cy, r).cut();
    g.circle(this.cx, this.cy, r).stroke({ color, width: 5, alpha: 0.9 });
    g.circle(this.cx, this.cy, r - 9).stroke({ color, width: 2, alpha: 0.3 });
  }

  /** Oscuridad centrada en el jugador: opaca fuera del radio de luz y con un borde degradado de `feather` píxeles. */
  private drawDark(r: number): void {
    this.darkDrawn = r;
    const feather = this.cfg.dark!.feather;
    const g = this.darkG;
    const steps = 8;
    g.clear();
    g.rect(-6000, -6000, 12000, 12000).fill({ color: 0x020108, alpha: 0.94 });
    g.circle(0, 0, r + feather).cut();
    const w = feather / steps;
    for (let i = 0; i < steps; i++) {
      const mid = r + w * (i + 0.5);
      g.circle(0, 0, mid).stroke({ color: 0x020108, width: w + 1, alpha: 0.94 * ((i + 1) / steps) });
    }
  }
}
