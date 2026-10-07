import { Application, Container, TilingSprite, type Ticker } from 'pixi.js';
import { INVULN_AFTER_HIT, RUN_DURATION, sparksFor, xpForLevel } from '@/data/balance';
import { CHARACTER_BY_ID } from '@/data/characters';
import { ENEMY_BY_ID } from '@/data/enemies';
import { MINI, RARITY_COLORS, RARITY_KEYS, type TalismanRarity } from '@/data/minibosses';
import type { SkinVisual } from '@/data/skins';
import type { RunModifiers, UpgradeOption } from '@/data/types';
import type { WaveConfig } from '@/data/waves';
import { MAP_BY_ID } from '@/data/maps';
import { WEAPON_BY_ID } from '@/data/weapons';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { debugEnabled } from '@/state/debug';
import { gameBus, useRun, type MiniHud, type RunResult } from '@/state/run';
import { sfx, type SfxStyle } from './audio/Sfx';
import { Music } from './audio/Music';
import type { Enemy } from './core/entities';
import { DpsMeter } from './core/DpsMeter';
import { clamp, rand } from './core/math';
import { Input } from './input/Input';
import { Player, type Modifiers } from './Player';
import { buildTextures, type GameTextures } from './render/textures';
import { Enemies } from './systems/Enemies';
import { Fx, type Quality } from './systems/Fx';
import { Hazards } from './systems/Hazards';
import { Minibosses } from './systems/Minibosses';
import { Pickups } from './systems/Pickups';
import { Weapons } from './systems/Weapons';
import { applyUpgrade, rollUpgrades } from './Upgrades';

const STEP = 1 / 60;
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
  private readonly dps = new DpsMeter(MINI.dpsWindow);
  /** Rareza de los cofres de talismán abiertos en esta partida. */
  private readonly chests: TalismanRarity[] = [];
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
    this.player.hp = this.player.maxHp;
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
    });
    this.minibosses.schedule = opts.mini;
    this.pickups = new Pickups(this.tex, this.player, { onXp: (n) => this.gainXp(n) });
    this.pickups.xpMult = opts.xpMult;
    // Tres gemas de regalo a la vista: recogerlas sube de nivel y enseña el bucle sin texto.
    if (opts.tutorial) for (let i = 0; i < 3; i++) this.pickups.drop(Math.cos(i * 0.7 - 0.7) * 120, Math.sin(i * 0.7 - 0.7) * 120, 4);
    this.input = new Input(host, this.tex.ring, this.tex.dot);

    this.ground = new TilingSprite({ texture: this.tex.ground, width: 10, height: 10 });
    this.world.addChild(
      this.weapons.underLayer,
      this.hazards.layer,
      this.pickups.layer,
      this.minibosses.layer,
      this.enemies.layer,
      this.player.view,
      this.weapons.layer,
      this.fx.layer,
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
      gameBus.on('pause', (p) => (this.paused = p || this.pendingChoices.length > 0)),
    );

    if (import.meta.env.DEV) (window as unknown as { __game?: Game }).__game = this;

    useRun.getState().reset();
    useRun.setState({ tutorial: opts.tutorial });
    this.publishBuild();
    useRun.setState({ phase: 'playing' });
    this.pushHud();
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
    if (this.input.active) {
      p.x += this.input.x * p.speed * dt;
      p.y += this.input.y * p.speed * dt;
      if (!this.moved) {
        this.moved = true;
        useRun.setState({ moved: true });
      }
    }
    if (p.invuln > 0) p.invuln -= dt;
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
    this.enemies.update(dt, this.time);
    this.hazards.update(dt);
    this.weapons.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    if (this.noticeT > 0 && (this.noticeT -= dt) <= 0) useRun.setState({ notice: null });

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.pushHud();
    }
    if (this.time >= RUN_DURATION) this.finish(true);
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
    // El DPS cuenta daño efectivo (sin el sobrante de una muerte) para que la vida adaptativa no se infle.
    this.dps.add(Math.min(amount, Math.max(0, e.hp)), this.time);
    e.hp -= amount;
    e.flash = 0.08;
    const mass = e.def.boss ? 0.05 : e.def.mini ? 0.1 : e.elite ? 0.3 : 1;
    e.kx += nx * kb * mass;
    e.ky += ny * kb * mass;
    this.fx.damage(x, y - 8, amount, e.elite || e.def.boss || e.def.mini ? 0xffd700 : 0xffffff);
    sfx.play('hit', 0.6);
    if (!e.def.mini) this.seenEnemies.add(e.def.id);
    if (e.hp > 0) return;
    this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
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
    const real = this.player.hurt(amount);
    if (real <= 0) return;
    this.player.invuln = INVULN_AFTER_HIT;
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

  private onMiniSpawned(type: 'charger' | 'fan', rarity: TalismanRarity): void {
    this.notify(t('mini_arrives', { name: t(`mb_${type}`) }), RARITY_COLORS[rarity]);
    this.shake = Math.max(this.shake, 6);
    sfx.play('boss');
    this.haptic('medium');
  }

  private onMiniRetreat(type: 'charger' | 'fan', x: number, y: number): void {
    this.notify(t('mini_retreat', { name: t(`mb_${type}`) }), 0x9a93a8);
    this.fx.burst(x, y, 0x9a93a8, 24, 160, 0.6, 1.2);
  }

  private onChestOpened(rarity: TalismanRarity, x: number, y: number): void {
    this.chests.push(rarity);
    const color = RARITY_COLORS[rarity]!;
    this.fx.burst(x, y, color, 40, 260, 0.8, 1.5);
    this.notify(t('mini_chest', { rarity: t(RARITY_KEYS[rarity]) }), color);
    sfx.play('levelup');
    tg.haptic.notify('success');
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
      chests: [...this.chests],
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
      const dx = m.e.x - p.x;
      const dy = m.e.y - p.y;
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
        boss: boss ? { hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
        mini,
        dps: Math.round(this.dps.dps(this.time)),
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
