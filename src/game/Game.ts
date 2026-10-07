import { Application, Container, TilingSprite, type Ticker } from 'pixi.js';
import { INVULN_AFTER_HIT, RUN_DURATION, sparksFor, xpForLevel } from '@/data/balance';
import { BOSS, bossNameKey, colorOf, type BossId } from '@/data/bosses';
import { CHARACTER_BY_ID } from '@/data/characters';
import { ENEMY_BY_ID } from '@/data/enemies';
import { MINI, RARITY_COLORS, RARITY_KEYS, type HintedMini, type MiniType, type TalismanRarity } from '@/data/minibosses';
import type { SkinVisual } from '@/data/skins';
import { parseTalismanKey, rollTalisman } from '@/data/talismans';
import type { RunModifiers, UpgradeOption } from '@/data/types';
import type { WaveConfig } from '@/data/waves';
import { MAP_BY_ID } from '@/data/maps';
import { PASSIVE_BY_ID } from '@/data/passives';
import { WEAPON_BY_ID } from '@/data/weapons';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { debugEnabled } from '@/state/debug';
import { gameBus, useRun, type BossHud, type GiftId, type GiftOption, type MiniHud, type RunResult, type TalHud } from '@/state/run';
import { sfx, type SfxStyle } from './audio/Sfx';
import { Music } from './audio/Music';
import type { Enemy } from './core/entities';
import { DpsMeter } from './core/DpsMeter';
import { clamp, rand } from './core/math';
import { createPressGuard } from './core/PressGuard';
import { Input } from './input/Input';
import { Player, type Modifiers, type WeaponSlot } from './Player';
import { buildTextures, type GameTextures } from './render/textures';
import { Enemies } from './systems/Enemies';
import { BossDuel } from './systems/BossDuel';
import { Fx, type Quality } from './systems/Fx';
import { Hazards } from './systems/Hazards';
import { Minibosses } from './systems/Minibosses';
import { Pickups } from './systems/Pickups';
import { Talismans } from './systems/Talismans';
import { Weapons } from './systems/Weapons';
import { applyUpgrade, availableEvolutions, rollUpgrades } from './Upgrades';

const STEP = 1 / 60;
const MINI_HINT_KEYS = {
  swarm: 'mini_hint_swarm',
  trail: 'mini_hint_trail',
  shield: 'mini_hint_shield',
  teleport: 'mini_hint_teleport',
} as const;
const MAX_STEPS = 4;
/** Re-sorteos de mejoras por partida: uno gratis y hasta dos más con anuncio. */
const FREE_REROLLS = 1;
const AD_REROLLS = 2;

/** Skins que cambian el aspecto de la partida (nunca el daño). null = la de por defecto. */
export interface GameSkins {
  flame: SkinVisual | null;
  death: SkinVisual | null;
  levelup: SkinVisual | null;
  /** Por id de arma (base y evolucionada). */
  weapons: Record<string, SkinVisual>;
}

export interface GameOptions {
  characterId: string;
  mapId: string;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  /** Primera partida: guías sin texto y gemas de regalo cerca del jugador. */
  tutorial: boolean;
  /** Modificadores de partida (reto diario / evento semanal). */
  mods: RunModifiers;
  /** Mods permanentes del jugador (tienda + personaje ya van en `mods` del Player). */
  metaMods: Partial<Modifiers>;
  /** Multiplicador de XP (suerte de tienda + eventos). */
  xpMult: number;
  /** Multiplicador de Chispas (evento semanal + mapa). */
  sparkBonus: number;
  skins: GameSkins;
  /** Impulso inicial: la partida empieza con un nivel extra y su elección de mejora. */
  boost: boolean;
  /** Si es reto diario: segundos objetivo para superarlo. */
  challengeTarget?: number;
  /** Olas, élites y jefe (partida normal, o los de la noche de campaña). */
  waves: WaveConfig;
  /** Noche de campaña (null en el resto de modos) y si es una repetición. */
  night: number | null;
  replay: boolean;
  /** Minijefes de la noche: segundos de aparición, noche y tramo (null = sin minijefes). */
  mini: { times: readonly number[]; night: number; tier: number } | null;
  /** Talismanes equipados (claves `id:rareza`) y aviso al usar uno para que la UI lo gaste del inventario. */
  talismans: { keys: string[]; onUse(key: string): void };
  /** Jefe del duelo que sigue a las olas (null = la noche acaba a los 5 minutos). */
  boss: { id: BossId } | null;
  /** Vida extra (fracción) por duelos perdidos contra jefes. */
  help: number;
}

/**
 * Orquestador de la partida sobre PixiJS 8.
 * Bucle de paso fijo (60 Hz) con hasta 4 pasos por frame para no explotar en móviles lentos.
 * El motor escribe en `useRun`; la UI le habla por `gameBus`. Nunca referencias directas.
 */
export class Game {
  readonly app = new Application();
  private tex!: GameTextures;
  private input!: Input;
  private player!: Player;
  private enemies!: Enemies;
  private weapons!: Weapons;
  private pickups!: Pickups;
  private fx!: Fx;
  private hazards!: Hazards;
  private minibosses!: Minibosses;
  private talismans!: Talismans;
  private readonly dps = new DpsMeter(MINI.dpsWindow);
  /** Talismanes equipados esta noche (cada uno se usa una vez) y callback al gastarlos. */
  private talSlots: TalHud[] = [];
  private onTalismanUse: (key: string) => void = () => undefined;
  /** Talismanes ganados en los cofres de esta partida (claves de inventario). */
  private readonly found: string[] = [];
  private readonly hintsSeen = new Set<HintedMini>();

  // Duelo contra el jefe de la noche: olas -> limpieza -> antesala (regalo) -> intro -> combate -> victoria.
  private duel!: BossDuel;
  private bossId: BossId | null = null;
  private stage: 'off' | 'clearing' | 'gift' | 'intro' | 'fight' | 'won' = 'off';
  private stageT = 0;
  private gifts: GiftOption[] = [];
  private giftShield = 0;
  /** DPS medio de los últimos segundos de olas: fija la vida del jefe. */
  private duelDps = 0;
  private dpsSum = 0;
  private dpsN = 0;
  private dpsNext = 0;
  /** Instante en que empezó a medirse el DPS (el salto de debug lo reinicia). */
  private dpsFrom = 0;
  private winT = 0;
  private dashCd = 0;
  private dashT = 0;
  private dashX = 1;
  private dashY = 0;
  private lastDirX = 1;
  private lastDirY = 0;
  private baseMods!: Modifiers;
  private readonly talGuard = createPressGuard(300);
  private noticeT = 0;

  private readonly world = new Container();
  private readonly uiLayer = new Container();
  private ground!: TilingSprite;

  private time = 0;
  private kills = 0;
  private elitesKilled = 0;
  private level = 1;
  private xp = 0;
  private xpNext = xpForLevel(1);
  private bossKilled = false;
  private readonly seenEnemies = new Set<string>();
  private accumulator = 0;
  private hudTimer = 0;
  private paused = false;
  private ended = false;
  private destroyed = false;
  /** El jugador ha muerto y la UI decide si ofrece revivir; el motor espera quieto. */
  private dying = false;
  private reviveUsed = false;
  private rerollFree = FREE_REROLLS;
  private rerollAds = AD_REROLLS;
  private skins: GameSkins = { flame: null, death: null, levelup: null, weapons: {} };
  private sfxStyles: Record<string, SfxStyle> = {};
  private trailT = 0;
  private tutorial = false;
  private night: number | null = null;
  private replay = false;
  private moved = false;
  private readonly music = new Music(sfx);
  private onHostDown: (() => void) | null = null;
  private host: HTMLElement | null = null;
  private pendingChoices: UpgradeOption[] = [];
  private unsubscribe: (() => void)[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private readonly killBuffer: Enemy[] = [];

  // Sensación de juego.
  private shake = 0;
  private hitStop = 0;
  private haptics = true;
  private sparkBonus = 1;
  private challengeTarget = 0;
  private mapId = 'forest';

  // Ajuste automático de calidad: media móvil de FPS.
  private fpsAvg = 60;
  private qualityTimer = 0;

  async init(host: HTMLElement, opts: GameOptions): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: '#0b0a14',
      antialias: false,
      resolution: clamp(window.devicePixelRatio || 1, 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    host.appendChild(this.app.canvas);
    const map = MAP_BY_ID[opts.mapId] ?? MAP_BY_ID.forest!;
    this.mapId = map.id;
    this.tex = buildTextures(this.app.renderer, map);
    this.haptics = opts.haptics;
    this.sparkBonus = opts.sparkBonus * map.sparkBonus;
    this.challengeTarget = opts.challengeTarget ?? 0;
    this.skins = opts.skins;
    for (const [id, v] of Object.entries(opts.skins.weapons)) {
      this.sfxStyles[id] = { ...(v.pitch !== undefined ? { pitch: v.pitch } : {}), ...(v.wave ? { wave: v.wave } : {}) };
    }
    sfx.enabled = opts.sound;
    sfx.unlock();
    this.music.enabled = opts.music;
    this.music.start();
    // iOS/Android solo desbloquean el audio con un gesto: el primer toque lo reintenta.
    this.host = host;
    this.onHostDown = () => {
      sfx.unlock();
      this.music.start();
    };
    host.addEventListener('pointerdown', this.onHostDown);
    this.tutorial = opts.tutorial;
    this.night = opts.night;
    this.replay = opts.replay;

    const def = CHARACTER_BY_ID[opts.characterId] ?? CHARACTER_BY_ID.ember!;
    this.player = new Player(def, this.tex, map.glow, opts.skins.flame);
    for (const k of Object.keys(opts.metaMods) as (keyof Modifiers)[]) this.player.mods[k] += opts.metaMods[k]!;
    this.player.mods.damage += opts.mods.playerDamage - 1;
    this.player.mods.maxHp += opts.help;
    this.player.hp = this.player.maxHp;
    this.baseMods = { ...this.player.mods };
    this.player.addWeapon(WEAPON_BY_ID[def.weaponId]!);

    this.fx = new Fx(this.tex.dot);
    // Gama baja (pocos núcleos): empieza con menos partículas; el ajuste por FPS la sube si sobra margen.
    if ((navigator.hardwareConcurrency ?? 8) <= 4) this.fx.quality = 1;
    this.enemies = new Enemies(this.tex, this.player, {
      onPlayerHit: (n) => this.onPlayerHit(n),
      onBossSpawn: () => this.onBossSpawn(),
      onEliteSpawn: () => this.haptic('medium'),
    });
    this.weapons = new Weapons(this.tex, this.player, this.enemies, {
      onEnemyDamaged: (e, n, x, y, kb, nx, ny) => this.onEnemyDamaged(e, n, x, y, kb, nx, ny),
      onHeal: (n) => this.player.heal(n),
      onFire: (id) => this.onFire(id),
      onFx: (x, y, color, count) => this.fx.burst(x, y, color, count, 90, 0.5, 1),
    });
    this.weapons.skins = opts.skins.weapons;
    this.enemies.mods = {
      hp: opts.mods.enemyHp,
      speed: opts.mods.enemySpeed,
      dmg: opts.mods.enemyDmg,
      spawnRate: opts.mods.spawnRate,
      cap: opts.mods.capMult,
    };
    this.enemies.waveConfig = opts.waves;
    this.hazards = new Hazards();
    this.minibosses = new Minibosses(this.tex, this.player, this.enemies, this.hazards, {
      onSpawned: (m) => this.onMiniSpawned(m.type, m.rarity),
      onPlayerHit: (n) => this.onPlayerHit(n),
      onFire: () => sfx.play('beam', 1, { pitch: -4 }),
      onRetreat: (m) => this.onMiniRetreat(m.type, m.e.x, m.e.y),
      onChestOpened: (r, x, y) => this.onChestOpened(r, x, y),
      onBurst: (x, y, color, count, speed, life, scale) => this.fx.burst(x, y, color, count, speed, life, scale),
      onShake: (n) => (this.shake = Math.max(this.shake, n)),
      onHint: (type) => this.miniHint(type),
    });
    this.minibosses.schedule = opts.mini;
    this.talSlots = opts.talismans.keys.filter((k) => parseTalismanKey(k)).map((key) => ({ key, used: false }));
    this.onTalismanUse = opts.talismans.onUse;
    this.pickups = new Pickups(this.tex, this.player, { onXp: (n) => this.gainXp(n) });
    this.pickups.xpMult = opts.xpMult;
    this.talismans = new Talismans(this.tex, this.player, this.enemies, this.pickups, {
      onEnemyDamaged: (e, n, x, y, kb, nx, ny) => this.onEnemyDamaged(e, n, x, y, kb, nx, ny),
      onFx: (x, y, color, count) => this.fx.burst(x, y, color, count, 220, 0.6, 1.2),
      onHeal: (amount) => this.fx.damage(this.player.x, this.player.y - 20, amount, 0x7dffa0),
      onXp: (frac) => this.gainXp(this.xpNext * frac),
      onDawn: () => this.dawn(),
    });
    this.bossId = opts.boss?.id ?? null;
    this.duel = new BossDuel(this.tex, this.player, this.enemies, this.hazards, this.pickups, {
      onPlayerHit: (n) => this.onPlayerHit(n),
      onPhase: (n) => this.onBossPhase(n),
      onGemsSpawned: (first) => {
        if (first) this.notify(t('boss_hint_gems'), 0xffe9a8);
        sfx.play('pickup');
      },
      onAbsorb: (_stacks, x, y) => {
        this.fx.burst(x, y, 0xffd24a, 30, 260, 0.6, 1.4);
        this.shake = Math.max(this.shake, 4);
        sfx.play('hurt', 0.7, { pitch: -6 });
      },
      onExposed: (first) => {
        if (first) this.notify(t('boss_hint_exposed'), 0xffd24a);
        sfx.play('levelup', 0.6);
      },
      onFire: () => sfx.play('beam', 1, { pitch: -4 }),
      onBurst: (x, y, color, count, speed, life, scale) => this.fx.burst(x, y, color, count, speed, life, scale),
      onShake: (n) => (this.shake = Math.max(this.shake, n)),
      gemXp: (frac) => Math.max(1, (this.xpNext * frac) / this.pickups.xpMult),
      onHint: (kind) => this.notify(t(kind === 'dark' ? 'boss_hint_dark' : 'boss_hint_crystals'), 0xffe9a8),
      onMirror: (nameKey, color) => this.notify(t('boss_mirror_copy', { name: t(nameKey) }), color),
    });
    // Tres gemas de regalo a la vista: recogerlas sube de nivel y enseña el bucle sin texto.
    if (opts.tutorial) for (let i = 0; i < 3; i++) this.pickups.drop(Math.cos(i * 0.7 - 0.7) * 120, Math.sin(i * 0.7 - 0.7) * 120, 4);
    this.input = new Input(host, this.tex.ring, this.tex.dot);

    this.ground = new TilingSprite({ texture: this.tex.ground, width: 10, height: 10 });
    this.world.addChild(
      this.duel.layer,
      this.weapons.underLayer,
      this.pickups.layer,
      this.minibosses.layer,
      this.enemies.layer,
      this.player.view,
      this.weapons.layer,
      this.talismans.layer,
      this.fx.layer,
      // La oscuridad del duelo tapa el mundo, pero los avisos de ataque quedan por encima para poder esquivar.
      this.duel.darkLayer,
      this.hazards.layer,
    );
    this.uiLayer.addChild(this.input.view);
    this.app.stage.addChild(this.ground, this.world, this.uiLayer);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(host);
    this.layout();

    this.unsubscribe.push(
      gameBus.on('choose', ({ id }) => this.choose(id)),
      gameBus.on('reroll', ({ via }) => this.reroll(via)),
      gameBus.on('revive', () => this.revive()),
      gameBus.on('giveup', () => this.giveUp()),
      gameBus.on('useTalisman', ({ slot }) => this.useTalisman(slot)),
      gameBus.on('dash', () => this.tryDash()),
      gameBus.on('gift', ({ id }) => this.chooseGift(id)),
      gameBus.on('debugDuel', ({ build, boss }) => this.debugDuel(build, boss)),
      gameBus.on('debugMini', ({ type, rarity }) => {
        if (!debugEnabled() || this.ended) return;
        const { width, height } = this.app.screen;
        const r = rarity ?? (Math.floor(Math.random() * 4) as TalismanRarity);
        this.minibosses.spawn(type, r, this.dps.dps(this.time), Math.hypot(width, height) / 2);
      }),
      gameBus.on('audio', (a) => {
        sfx.enabled = a.sound;
        this.music.enabled = a.music;
        if (a.music) this.music.start();
        else this.music.stop();
      }),
      gameBus.on('pause', (p) => (this.paused = p || this.pendingChoices.length > 0 || this.stage === 'gift')),
    );

    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = this;

    useRun.getState().reset();
    useRun.setState({ tutorial: opts.tutorial, tal: this.talSlots.map((s) => ({ ...s })) });
    this.publishBuild();
    useRun.setState({ phase: 'playing' });
    this.pushHud();
    if (opts.help > 0) this.notify(t('help_bonus', { n: Math.round(opts.help * 100) }), 0xa3d977);
    if (opts.boost) this.grantStartLevel();
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add(this.frame, this);
  }

  /* ---------------------------------------------------------------- */
  /* Bucle                                                             */
  /* ---------------------------------------------------------------- */

  private frame(ticker: Ticker): void {
    const dtMs = Math.min(ticker.deltaMS, 100);
    const dt = dtMs / 1000;
    this.trackFps(ticker.FPS, dt);
    if (this.hitStop > 0) {
      // Hit-stop: congela la simulación unos milisegundos; la cámara sigue temblando.
      this.hitStop -= dt;
    } else if (!this.paused && !this.ended && !this.dying) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.step(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.accumulator = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 18);
    this.music.setDuck(this.paused || this.dying);
    this.render();
  }

  private step(dt: number): void {
    this.time += dt;
    const p = this.player;

    this.input.update();
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashT > 0) {
      // Dash del duelo: desplazamiento corto en línea recta, invulnerable mientras dura.
      const k = BOSS.dash.dist / BOSS.dash.dur;
      p.x += this.dashX * k * dt;
      p.y += this.dashY * k * dt;
      this.dashT -= dt;
      this.fx.burst(p.x, p.y, 0x8ff0ff, 3, 20, 0.35, 0.9);
    } else if (this.input.active) {
      p.x += this.input.x * p.speed * dt;
      p.y += this.input.y * p.speed * dt;
      const m = Math.hypot(this.input.x, this.input.y) || 1;
      this.lastDirX = this.input.x / m;
      this.lastDirY = this.input.y / m;
      if (!this.moved) {
        this.moved = true;
        useRun.setState({ moved: true });
      }
    }
    if (this.duel.mode !== 'idle') this.duel.clamp(p, p.radius);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.shield > 0) p.shield -= dt;
    if (p.furyT > 0) p.furyT -= dt;
    if (p.magnetT > 0) p.magnetT -= dt;
    if (p.reflectT > 0) p.reflectT -= dt;
    if (p.barrierT > 0 && (p.barrierT -= dt) <= 0) p.barrier = 0;
    if (p.regen > 0) p.heal(p.regen * dt);
    const flameSkin = this.skins.flame;
    if (flameSkin?.trail && this.input.active && (this.trailT -= dt) <= 0) {
      this.trailT = 0.05;
      this.fx.burst(p.x, p.y + 8, flameSkin.glow, 4, 25, 0.5, 0.9);
    }

    const { width, height } = this.app.screen;
    const viewRadius = Math.hypot(width, height) / 2;
    this.enemies.updateSpawning(dt, this.time, viewRadius);
    this.minibosses.update(dt, this.time, viewRadius, this.dps.dps(this.time));
    this.duel.update(dt);
    this.enemies.update(dt, this.time);
    this.hazards.update(dt);
    this.weapons.update(dt);
    this.talismans.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    if (this.noticeT > 0 && (this.noticeT -= dt) <= 0) useRun.setState({ notice: null });

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.pushHud();
    }
    this.updateStage(dt);
  }

  private render(): void {
    const p = this.player;
    p.animate(STEP, this.input.active, this.input.x);
    const { width, height } = this.app.screen;
    const sx = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const sy = this.shake > 0 ? rand(-this.shake, this.shake) : 0;
    const cx = Math.round(width / 2 - p.x + sx);
    const cy = Math.round(height / 2 - p.y + sy);
    this.world.position.set(cx, cy);
    this.ground.tilePosition.set(cx, cy);
  }

  private layout(): void {
    const { width, height } = this.app.screen;
    this.ground.width = width;
    this.ground.height = height;
  }

  /* ---------------------------------------------------------------- */
  /* Eventos de juego                                                  */
  /* ---------------------------------------------------------------- */

  private onEnemyDamaged(e: Enemy, amount: number, x: number, y: number, kb: number, nx: number, ny: number): void {
    if (e.def.boss && this.duel.mode !== 'idle') {
      // Intro del duelo: inmune; con el núcleo abierto recibe daño bonificado.
      const k = this.duel.damageMult();
      if (k <= 0) return;
      this.duel.noteDamage(amount);
      amount *= k;
    } else if (this.duel.mode !== 'idle' && this.duel.isCrystal(e)) this.duel.noteDamage(amount);
    // El escudo giratorio de un minijefe bloquea casi todo el daño que viene del lado que cubre.
    let blocked = false;
    if (e.def.mini) {
      const k = this.minibosses.damageMult(e);
      if (k < 1) {
        amount *= k;
        blocked = true;
        this.miniHint('shield');
        this.fx.burst(x, y, 0xdfe6ee, 3, 120, 0.25, 0.8);
      }
    }
    // El DPS cuenta daño efectivo (sin el sobrante de una muerte) para que la vida adaptativa no se infle.
    this.dps.add(Math.min(amount, Math.max(0, e.hp)), this.time);
    e.hp -= amount;
    e.flash = 0.08;
    const mass = e.def.boss ? 0.05 : e.def.mini ? 0.1 : e.elite ? 0.3 : 1;
    e.kx += nx * kb * mass;
    e.ky += ny * kb * mass;
    this.fx.damage(x, y - 8, amount, blocked ? 0x9aa3b5 : e.elite || e.def.boss || e.def.mini ? 0xffd700 : 0xffffff);
    sfx.play('hit', blocked ? 0.2 : 0.6);
    if (!e.def.mini) this.seenEnemies.add(e.def.id);
    if (e.hp > 0) return;
    this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    // Cristal del Coloso: no cuenta como baja ni suelta nada; al romper el último cae la armadura del jefe.
    if (this.duel.mode !== 'idle' && this.duel.isCrystal(e)) {
      this.duel.onCrystalBroken(e);
      this.enemies.kill(e);
      this.hitStop = Math.max(this.hitStop, 0.06);
      sfx.play('elite_kill', 0.7);
      return;
    }
    this.kills++;
    const big = e.elite || e.def.boss || e.def.mini;
    const ds = this.skins.death;
    const k = ds?.particles ?? 1;
    this.fx.burst(
      e.x,
      e.y,
      ds ? ds.color : e.elite ? 0xffd700 : e.def.eyeColor,
      Math.round((big ? 40 : 10) * k),
      big ? 260 : 140,
      big ? 0.7 : 0.4,
      big ? 1.6 : 1,
    );
    if (ds) this.fx.burst(e.x, e.y, ds.glow, Math.round((big ? 16 : 4) * k), 90, 0.6, 1.2);
    if (e.def.boss) {
      this.bossKilled = true;
      this.pickups.drop(e.x, e.y, e.xp);
      this.hitStop = 0.12;
      this.shake = 14;
      sfx.play('elite_kill');
      this.haptic('heavy');
      this.elitesKilled++;
      if (this.duel.mode !== 'idle') this.onBossDown();
    } else if (e.def.mini) {
      // Minijefe: mucha XP, cofre con su rareza en el suelo y una celebración con su color.
      this.elitesKilled++;
      const m = this.minibosses.onKilled(e);
      for (let i = 0; i < 6; i++) this.pickups.drop(e.x + rand(-24, 24), e.y + rand(-24, 24), Math.ceil(e.xp / 6));
      if (m) {
        const color = RARITY_COLORS[m.rarity]!;
        this.fx.burst(e.x, e.y, color, 50, 300, 0.9, 1.7);
        this.notify(t('mini_defeated', { name: t(e.def.nameKey) }), color);
      }
      this.hitStop = 0.08;
      this.shake = 9;
      sfx.play('elite_kill');
      this.haptic('heavy');
    } else if (e.elite) {
      this.elitesKilled++;
      // Las élites reparten su XP en varias gemas grandes.
      for (let i = 0; i < 5; i++) this.pickups.drop(e.x + rand(-20, 20), e.y + rand(-20, 20), Math.ceil(e.xp / 5));
      this.hitStop = 0.07;
      this.shake = 8;
      sfx.play('elite_kill');
      this.haptic('heavy');
    } else {
      this.pickups.drop(e.x, e.y, e.xp);
      this.shake = Math.max(this.shake, 1.5);
      sfx.play('kill');
    }
    if (e.def.onDeath) {
      const def = ENEMY_BY_ID[e.def.onDeath.id]!;
      for (let i = 0; i < e.def.onDeath.n; i++) {
        const a = (i / e.def.onDeath.n) * Math.PI * 2;
        this.enemies.spawn(def, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, 1);
      }
    }
    this.enemies.kill(e);
  }

  private onPlayerHit(amount: number): void {
    const p = this.player;
    // Espejo roto: el golpe no hiere y estalla en daño a los enemigos cercanos.
    if (p.reflectT > 0 && p.invuln <= 0 && p.shield <= 0) {
      p.invuln = 0.3;
      this.talismans.reflect(amount);
      this.shake = Math.max(this.shake, 4);
      sfx.play('nova', 0.6, { pitch: 5 });
      return;
    }
    const real = this.player.hurt(amount);
    if (real <= 0) return;
    this.player.invuln = this.duel.mode !== 'idle' ? BOSS.invulnAfterHit : INVULN_AFTER_HIT;
    this.fx.damage(this.player.x, this.player.y - 20, real, 0xff6b6b);
    this.shake = Math.max(this.shake, 5);
    sfx.play('hurt');
    this.haptic('light');
    this.pushHud();
    if (this.player.hp <= 0) this.finish(false);
  }

  private onFire(weaponId: string): void {
    const b = WEAPON_BY_ID[weaponId]!.behavior;
    const style = this.sfxStyles[weaponId];
    if (b === 'beam' || b === 'chain') sfx.play('beam', 1, style);
    else if (b === 'nova') {
      sfx.play('nova', 1, style);
      this.shake = Math.max(this.shake, 4);
    } else sfx.play('shoot', 1, style);
  }

  /** Aviso breve sobre el HUD (se apaga solo en ~2,4 s de juego). */
  private notify(text: string, color = 0xffffff): void {
    this.noticeT = 2.4;
    useRun.setState({ notice: { text, color, id: Date.now() } });
  }

  /** Explica una mecánica nueva de minijefe la primera vez que aparece en la partida. */
  private miniHint(type: HintedMini): void {
    if (this.hintsSeen.has(type)) return;
    this.hintsSeen.add(type);
    this.notify(t(MINI_HINT_KEYS[type]), 0xffe9a8);
  }

  private onMiniSpawned(type: MiniType, rarity: TalismanRarity): void {
    this.notify(t('mini_arrives', { name: t(`mb_${type}`) }), RARITY_COLORS[rarity]);
    this.shake = Math.max(this.shake, 6);
    sfx.play('boss');
    this.haptic('medium');
  }

  private onMiniRetreat(type: MiniType, x: number, y: number): void {
    this.notify(t('mini_retreat', { name: t(`mb_${type}`) }), 0x9a93a8);
    this.fx.burst(x, y, 0x9a93a8, 24, 160, 0.6, 1.2);
  }

  private onChestOpened(rarity: TalismanRarity, x: number, y: number): void {
    const key = rollTalisman(rarity);
    this.found.push(key);
    const color = RARITY_COLORS[rarity]!;
    this.fx.burst(x, y, color, 40, 260, 0.8, 1.5);
    this.notify(t('tal_found', { name: t(parseTalismanKey(key)!.def.nameKey), rarity: t(RARITY_KEYS[rarity]) }), color);
    sfx.play('levelup');
    tg.haptic.notify('success');
  }

  /** Gasta el talismán equipado en la ranura: Égida, Nova o Escarcha. Uno por noche y talismán. */
  private useTalisman(slot: number): void {
    const s = this.talSlots[slot];
    if (!s || s.used || this.paused || this.ended || this.dying) return;
    const parsed = parseTalismanKey(s.key);
    if (!parsed) return;
    if (!this.talGuard.accept()) return;
    s.used = true;
    this.onTalismanUse(s.key);
    this.talismans.use(parsed.def.id, parsed.rarity);
    const color = RARITY_COLORS[parsed.rarity]!;
    this.notify(t(parsed.def.nameKey), color);
    this.shake = Math.max(this.shake, parsed.def.id === 'nova' ? 9 : parsed.def.id === 'dawn' ? 12 : 5);
    sfx.play('nova', 1, { pitch: parsed.def.id === 'frost' ? 6 : parsed.def.id === 'aegis' ? 3 : 0 });
    this.haptic('heavy');
    useRun.setState({ tal: this.talSlots.map((x) => ({ ...x })) });
  }

  private onBossSpawn(): void {
    this.shake = 10;
    sfx.play('boss');
    this.haptic('heavy');
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    sfx.play('pickup');
    if (this.xp >= this.xpNext && this.pendingChoices.length === 0) this.levelUp();
  }

  private levelUp(): void {
    this.xp -= this.xpNext;
    this.level++;
    this.xpNext = xpForLevel(this.level);
    this.levelUpFeedback();
    this.offerChoices();
  }

  /** Nivel extra del impulso inicial: no consume XP, solo da una elección más. */
  private grantStartLevel(): void {
    this.level++;
    this.xpNext = xpForLevel(this.level);
    this.levelUpFeedback();
    this.offerChoices();
  }

  private levelUpFeedback(): void {
    const ls = this.skins.levelup;
    const k = ls?.particles ?? 1;
    this.fx.burst(this.player.x, this.player.y, ls ? ls.color : 0xffe9a8, Math.round(24 * k), 220, 0.6, 1.4);
    if (ls) this.fx.burst(this.player.x, this.player.y, ls.glow, Math.round(16 * k), 300, 0.8, 1.1);
    sfx.play('levelup');
    tg.haptic.notify('success');
    this.pushHud();
  }

  private offerChoices(): void {
    const choices = rollUpgrades(this.player);
    // Todo al máximo: el nivel sube sin pausa y sin ofrecer nada.
    if (choices.length === 0) {
      if (this.xp >= this.xpNext) this.levelUp();
      return;
    }
    this.pendingChoices = choices;
    this.paused = true;
    useRun.setState({ phase: 'levelup', choices, rerolls: { free: this.rerollFree, ads: this.rerollAds } });
  }

  private reroll(via: 'free' | 'ad'): void {
    if (this.pendingChoices.length === 0) return;
    if (via === 'free') {
      if (this.rerollFree <= 0) return;
      this.rerollFree--;
    } else {
      if (this.rerollAds <= 0) return;
      this.rerollAds--;
    }
    // Una evolución disponible se conserva; el resto se evita repetir si el pool lo permite.
    const shown = this.pendingChoices.filter((o) => o.kind !== 'evolution').map((o) => o.id);
    const fresh = rollUpgrades(this.player, 3, shown);
    const any = rollUpgrades(this.player);
    const choices = fresh.length >= any.length ? fresh : any;
    this.pendingChoices = choices;
    sfx.play('pickup');
    this.haptic('light');
    useRun.setState({ choices, rerolls: { free: this.rerollFree, ads: this.rerollAds } });
  }

  private choose(id: string): void {
    const option = this.pendingChoices.find((o) => o.id === id);
    if (!option) return;
    applyUpgrade(this.player, option);
    this.pendingChoices = [];
    this.publishBuild();
    this.haptic('medium');
    // El tutorial acaba con el primer nivel-up resuelto después de moverse.
    if (this.tutorial && this.moved) {
      this.tutorial = false;
      useRun.setState({ tutorial: false, tutDone: true, guide: null });
    }
    if (option.kind === 'evolution') {
      this.weapons.syncVisuals();
      this.fx.burst(this.player.x, this.player.y, option.color, 50, 300, 0.9, 1.8);
      this.shake = 8;
    }
    // Si sobró XP para otro nivel, encadenamos otra elección antes de reanudar.
    if (this.xp >= this.xpNext) {
      this.levelUp();
      if (this.pendingChoices.length > 0) return;
    }
    this.paused = false;
    useRun.setState({ phase: 'playing', choices: [] });
    this.pushHud();
  }

  /* ---------------------------------------------------------------- */
  /* Duelo contra el jefe                                              */
  /* ---------------------------------------------------------------- */

  private updateStage(dt: number): void {
    switch (this.stage) {
      case 'off':
        if (this.bossId) this.sampleDps();
        if (this.time >= RUN_DURATION) {
          if (this.bossId) this.beginClearing();
          else this.finish(true);
        }
        break;
      case 'clearing':
        this.stageT -= dt;
        if (this.stageT <= 0 && this.pendingChoices.length === 0) this.openGift();
        break;
      case 'intro':
        // Al terminar la entrada del jefe, el escudo del regalo empieza a contar.
        if (this.duel.mode === 'fight') {
          this.stage = 'fight';
          if (this.giftShield > 0) {
            this.player.shield = Math.max(this.player.shield, this.giftShield);
            this.giftShield = 0;
          }
        }
        break;
      case 'won':
        this.winT -= dt;
        if (this.winT <= 0) this.finish(true);
        break;
      case 'gift':
      case 'fight':
        break;
    }
  }

  /** Media del DPS de los últimos segundos de olas (solo ventanas completas del medidor). */
  private sampleDps(): void {
    const from = Math.max(RUN_DURATION - BOSS.dpsSampleSecs, this.dpsFrom + MINI.dpsWindow);
    if (this.time < from || this.time < this.dpsNext) return;
    this.dpsNext = this.time + 1;
    this.dpsSum += this.dps.dps(this.time);
    this.dpsN++;
  }

  /** Fin de las olas: se retiran las hordas y los minijefes y se recogen los últimos fragmentos. */
  private beginClearing(): void {
    this.stage = 'clearing';
    this.stageT = BOSS.clearTime;
    this.duelDps = this.dpsN > 0 ? this.dpsSum / this.dpsN : this.dps.dps(this.time);
    this.enemies.spawningEnabled = false;
    this.minibosses.schedule = null;
    this.minibosses.dismiss();
    this.enemies.killAround(this.player.x, this.player.y, 4000, this.killBuffer);
    for (const e of this.killBuffer) this.fx.burst(e.x, e.y, e.def.eyeColor, 6, 160, 0.5);
    this.enemies.clearShots();
    this.hazards.clear();
    this.pickups.pullAll();
    this.fx.burst(this.player.x, this.player.y, 0xfff3c4, 40, 300, 0.9, 1.5);
    this.shake = 6;
    sfx.play('nova');
    this.notify(t('boss_clear'), 0xffe9a8);
  }

  /** Talismán Amanecer: los enemigos corrientes de toda la pantalla se disuelven en luz (sueltan su XP). */
  private dawn(): void {
    const p = this.player;
    this.enemies.killAround(p.x, p.y, 4000, this.killBuffer);
    for (const e of this.killBuffer) {
      this.kills++;
      this.fx.burst(e.x, e.y, 0xfff3c4, 6, 160, 0.5);
      this.pickups.drop(e.x, e.y, e.xp);
    }
    this.enemies.clearShots();
  }

  private upgradableWeapon(): WeaponSlot | undefined {
    return this.player.weapons.filter((s) => !s.def.evolved && s.level < s.def.levels.length).sort((a, b) => b.level - a.level)[0];
  }

  private buildGifts(): GiftOption[] {
    const evo = availableEvolutions(this.player)[0];
    const slot = evo ? undefined : this.upgradableWeapon();
    return [
      { id: 'heal', weaponKey: null, evolve: false, secs: 0 },
      { id: 'weapon', weaponKey: evo ? evo.nameKey : (slot?.def.nameKey ?? null), evolve: evo !== undefined, secs: 0 },
      { id: 'shield', weaponKey: null, evolve: false, secs: BOSS.gifts.shieldSecs },
    ];
  }

  /** Antesala: el motor se detiene y la UI ofrece 3 regalos. */
  private openGift(): void {
    this.stage = 'gift';
    this.gifts = this.buildGifts();
    this.paused = true;
    useRun.setState({ phase: 'gift', gifts: this.gifts });
    this.pushHud();
  }

  private chooseGift(id: GiftId): void {
    if (this.stage !== 'gift') return;
    const gift = this.gifts.find((g) => g.id === id);
    if (!gift || (id === 'weapon' && !gift.weaponKey)) return;
    const p = this.player;
    if (id === 'heal') {
      p.hp = p.maxHp;
      this.fx.burst(p.x, p.y, 0x7dffa0, 30, 220, 0.7, 1.4);
    } else if (id === 'weapon') {
      const evo = availableEvolutions(p)[0];
      if (evo) {
        applyUpgrade(p, evo);
        this.weapons.syncVisuals();
      } else {
        const slot = this.upgradableWeapon();
        if (slot) p.addWeapon(slot.def);
      }
      this.publishBuild();
      this.fx.burst(p.x, p.y, 0xffe9a8, 40, 260, 0.8, 1.6);
    } else {
      this.giftShield = gift.secs;
    }
    sfx.play('levelup');
    this.haptic('medium');
    this.gifts = [];
    this.paused = false;
    useRun.setState({ phase: 'playing', gifts: [] });
    this.startDuel();
  }

  private startDuel(): void {
    if (!this.bossId) return;
    this.stage = 'intro';
    this.duel.start(this.bossId, this.duelDps, this.enemies.mods.hp, this.player.x, this.player.y);
    this.notify(t(bossNameKey(this.bossId)), colorOf(BOSS.types[this.bossId].look.aura));
    this.shake = 10;
    sfx.play('boss');
    this.haptic('heavy');
    this.pushHud();
  }

  private onBossPhase(n: number): void {
    this.notify(t('boss_phase', { n }), this.bossId ? colorOf(BOSS.types[this.bossId].look.aura) : 0xb06bff);
    sfx.play('boss');
    this.haptic('heavy');
  }

  /** El jefe cae: se limpian los refuerzos y, tras unos segundos de celebración, termina la noche. */
  private onBossDown(): void {
    this.stage = 'won';
    this.winT = 2.4;
    this.duel.onDefeated();
    this.enemies.killAround(this.player.x, this.player.y, 4000, this.killBuffer);
    for (const e of this.killBuffer) this.fx.burst(e.x, e.y, e.def.eyeColor, 6, 160, 0.5);
    this.fx.burst(this.player.x, this.player.y, 0xffe9a8, 60, 340, 1, 1.8);
    this.notify(t('boss_down', { name: t(bossNameKey(this.bossId ?? 'devourer')) }), 0xffd24a);
    this.pushHud();
  }

  private tryDash(): void {
    if (this.stage !== 'intro' && this.stage !== 'fight') return;
    if (this.paused || this.ended || this.dying || this.dashCd > 0 || this.dashT > 0) return;
    const p = this.player;
    const moving = this.input.active;
    const m = moving ? Math.hypot(this.input.x, this.input.y) || 1 : 1;
    this.dashX = moving ? this.input.x / m : this.lastDirX;
    this.dashY = moving ? this.input.y / m : this.lastDirY;
    this.dashT = BOSS.dash.dur;
    this.dashCd = BOSS.dash.cooldown;
    p.invuln = Math.max(p.invuln, BOSS.dash.iframes);
    this.fx.burst(p.x, p.y, 0x8ff0ff, 14, 160, 0.4, 1.1);
    sfx.play('shoot', 1, { pitch: 8 });
    this.haptic('light');
  }

  /**
   * Debug: salta a los últimos segundos de olas con un build flojo o fuerte. El DPS se mide peleando contra las hordas
   * con ese build, igual que en una partida real, y al llegar a los 5:00 empieza la antesala.
   */
  private debugDuel(build: 'weak' | 'strong', boss: BossId): void {
    if (!debugEnabled() || this.ended || this.stage !== 'off' || this.night === null) return;
    this.bossId = boss;
    this.enemies.clear();
    this.minibosses.dismiss();
    this.minibosses.schedule = null;
    this.hazards.clear();
    this.pickups.clear();
    this.applyDebugBuild(build);
    this.time = RUN_DURATION - BOSS.dpsSampleSecs;
    this.dps.reset();
    this.dpsFrom = this.time;
    this.dpsSum = 0;
    this.dpsN = 0;
    this.dpsNext = 0;
    this.enemies.skipTo(this.time);
    this.publishBuild();
    this.pushHud();
  }

  private applyDebugBuild(build: 'weak' | 'strong'): void {
    const p = this.player;
    p.weapons.length = 0;
    p.passives.clear();
    Object.assign(p.mods, this.baseMods);
    if (build === 'weak') {
      p.addWeapon(WEAPON_BY_ID[p.def.weaponId]!);
    } else {
      // "Fuerte" = lo que se ve a los 5 minutos de una buena partida: 2 evoluciones, 2 armas a nivel 4 y pasivas a medias.
      for (const id of ['storm', 'bonfire']) p.addWeapon(WEAPON_BY_ID[id]!);
      for (const id of ['beam', 'fireflies']) for (let i = 0; i < 4; i++) p.addWeapon(WEAPON_BY_ID[id]!);
      for (const [id, n] of [['might', 3], ['haste', 2], ['swift', 1], ['vigor', 2]] as const) {
        const def = PASSIVE_BY_ID[id]!;
        for (let i = 0; i < n; i++) p.addPassive(def.id, def.stat, def.perLevel);
      }
    }
    this.weapons.syncVisuals();
    p.hp = p.maxHp;
  }

  private finish(won: boolean, final = false): void {
    if (this.ended) return;
    // Primera muerte: la UI puede ofrecer revivir; hasta que decida el motor queda quieto.
    if (!won && !final && !this.reviveUsed) {
      if (this.dying) return;
      this.dying = true;
      this.paused = true;
      this.pushHud();
      useRun.setState({ phase: 'dead' });
      return;
    }
    this.dying = false;
    this.ended = true;
    this.paused = true;
    const evolved = this.player.weapons.some((w) => w.def.evolved);
    const result: RunResult = {
      won,
      bossKilled: this.bossKilled,
      time: this.time,
      kills: this.kills,
      elitesKilled: this.elitesKilled,
      level: this.level,
      sparks: Math.round(sparksFor(this.time, this.kills, won, this.bossKilled) * this.sparkBonus),
      weaponIds: this.player.weapons.map((w) => w.def.id),
      characterId: this.player.def.id,
      mapId: MAP_BY_ID[this.mapId] ? this.mapId : 'forest',
      evolved,
      challenge: this.challengeTarget > 0,
      challengeDone: this.challengeTarget > 0 && (won || this.time >= this.challengeTarget),
      seenEnemies: [...this.seenEnemies],
      night: this.night,
      replay: this.replay,
      found: [...this.found],
      duel:
        this.duel.maxHp > 0
          ? { won, time: Math.round(this.duel.elapsed * 10) / 10, dps: Math.round(this.duelDps), bossDps: Math.round(this.duel.bossDps), hp: this.duel.maxHp }
          : null,
    };
    if (won) {
      this.enemies.killAround(this.player.x, this.player.y, 2000, this.killBuffer);
      for (const e of this.killBuffer) this.fx.burst(e.x, e.y, e.def.eyeColor, 6, 160, 0.5);
      this.fx.burst(this.player.x, this.player.y, 0xfff3c4, 60, 320, 1, 1.6);
      this.shake = 10;
    }
    sfx.play(won ? 'win' : 'lose');
    this.music.stop();
    tg.haptic.notify(won ? 'success' : 'error');
    this.pushHud();
    useRun.setState({ phase: 'ended', result });
  }

  /* ---------------------------------------------------------------- */
  /* Revivir                                                           */
  /* ---------------------------------------------------------------- */

  /** Tras el anuncio: 50% de vida, invulnerabilidad breve y una explosión que limpia el entorno. */
  private revive(): void {
    if (!this.dying || this.reviveUsed) return;
    this.dying = false;
    this.reviveUsed = true;
    const p = this.player;
    p.hp = Math.max(1, Math.ceil(p.maxHp * 0.5));
    p.invuln = 3;
    this.enemies.killAround(p.x, p.y, 280, this.killBuffer);
    for (const e of this.killBuffer) this.fx.burst(e.x, e.y, e.def.eyeColor, 6, 160, 0.5);
    this.fx.burst(p.x, p.y, 0xfff3c4, 70, 380, 1, 1.8);
    this.shake = 12;
    sfx.play('nova');
    tg.haptic.notify('success');
    this.paused = false;
    this.pushHud();
    useRun.setState({ phase: 'playing' });
  }

  private giveUp(): void {
    if (this.dying) this.finish(false, true);
  }

  /* ---------------------------------------------------------------- */
  /* Puente hacia la UI                                                */
  /* ---------------------------------------------------------------- */

  private pushHud(): void {
    const p = this.player;
    const boss = this.enemies.boss;
    this.music.setIntensity(boss ? 1 : (this.time / RUN_DURATION) * 0.7);
    let guide: { angle: number; dist: number } | null = null;
    if (this.tutorial && this.moved) {
      const g = this.pickups.nearest(p.x, p.y);
      if (g) guide = { angle: Math.atan2(g.y - p.y, g.x - p.x), dist: Math.hypot(g.x - p.x, g.y - p.y) };
    }
    let mini: MiniHud | null = null;
    const m = this.minibosses.current;
    if (m) {
      // Mientras viaja oculto, la flecha apunta a su destino.
      const f = this.minibosses.focus(m);
      const dx = f.x - p.x;
      const dy = f.y - p.y;
      const { width, height } = this.app.screen;
      mini = {
        nameKey: `mb_${m.type}`,
        hp: Math.max(0, Math.ceil(m.e.hp)),
        maxHp: m.e.maxHp,
        rarity: m.rarity,
        timeLeft: Math.max(0, MINI.timeLimit - m.age),
        angle: Math.atan2(dy, dx),
        off: Math.abs(dx) > width / 2 - 24 || Math.abs(dy) > height / 2 - 24,
      };
    }
    let bossHud: BossHud | null = null;
    if (boss) {
      bossHud =
        this.duel.mode !== 'idle'
          ? this.duel.hud(boss)
          : { nameKey: 'boss_name', hp: Math.max(0, boss.hp), maxHp: boss.maxHp, phase: 0, exposed: false, stacks: 0, maxStacks: 0, thresholds: [], armor: false, crystals: 0 };
    }
    const duelOn = this.stage === 'intro' || this.stage === 'fight';
    useRun.setState({
      guide,
      hud: {
        time: this.time,
        kills: this.kills,
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        level: this.level,
        xp: this.xp,
        xpNext: this.xpNext,
        fps: Math.round(this.fpsAvg),
        boss: bossHud,
        mini,
        dps: Math.round(this.dps.dps(this.time)),
        dash: { on: duelOn, ready: this.dashCd > 0 ? 1 - this.dashCd / BOSS.dash.cooldown : 1 },
        buffs: {
          shield: Math.max(0, Math.round(p.shield * 10) / 10),
          fury: Math.max(0, Math.round(p.furyT * 10) / 10),
          magnet: Math.max(0, Math.round(p.magnetT * 10) / 10),
          reflect: Math.max(0, Math.round(p.reflectT * 10) / 10),
          barrier: p.barrier > 0 ? Math.max(0, Math.round(p.barrierT * 10) / 10) : 0,
        },
        duel:
          this.duel.maxHp > 0
            ? { dps: Math.round(this.duelDps), bossDps: Math.round(this.duel.bossDps), hp: this.duel.maxHp, time: Math.round(this.duel.elapsed * 10) / 10 }
            : null,
      },
    });
  }

  private publishBuild(): void {
    useRun.setState({
      build: {
        weapons: Object.fromEntries(this.player.weapons.map((w) => [w.def.id, w.level])),
        passives: Object.fromEntries(this.player.passives),
      },
    });
  }

  private haptic(style: 'light' | 'medium' | 'heavy'): void {
    if (this.haptics) tg.haptic.impact(style);
  }

  /** Baja la calidad de partículas si los FPS se mantienen bajos; la sube si se recuperan. */
  private trackFps(fps: number, dt: number): void {
    this.fpsAvg += (fps - this.fpsAvg) * Math.min(1, dt * 2);
    this.qualityTimer += dt;
    if (this.qualityTimer < 2) return;
    this.qualityTimer = 0;
    const q = this.fx.quality;
    if (this.fpsAvg < 45 && q > 0) this.fx.quality = (q - 1) as Quality;
    else if (this.fpsAvg > 56 && q < 2) this.fx.quality = (q + 1) as Quality;
  }

  destroy(): void {
    this.destroyed = true;
    for (const u of this.unsubscribe) u();
    this.music.stop();
    if (this.host && this.onHostDown) this.host.removeEventListener('pointerdown', this.onHostDown);
    this.resizeObserver?.disconnect();
    if (this.app.renderer) {
      this.app.ticker.remove(this.frame, this);
      this.input.destroy();
      this.app.destroy(true, { children: true, texture: true });
    }
  }
}
