import { Application, Container, TilingSprite, type Ticker } from 'pixi.js';
import { INVULN_AFTER_HIT, RUN_DURATION, sparksFor, xpForLevel } from '@/data/balance';
import { CHARACTER_BY_ID } from '@/data/characters';
import { ENEMIES } from '@/data/enemies';
import type { UpgradeOption } from '@/data/types';
import { WEAPON_BY_ID } from '@/data/weapons';
import { tg } from '@/platform/telegram';
import { gameBus, useRun, type RunResult } from '@/state/run';
import type { Enemy } from './core/entities';
import { clamp } from './core/math';
import { Input } from './input/Input';
import { Player } from './Player';
import { buildTextures, type GameTextures } from './render/textures';
import { Enemies } from './systems/Enemies';
import { Fx, type Quality } from './systems/Fx';
import { Pickups } from './systems/Pickups';
import { Weapons } from './systems/Weapons';
import { applyUpgrade, rollUpgrades } from './Upgrades';

const STEP = 1 / 60;
const MAX_STEPS = 4;

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

  private readonly world = new Container();
  private readonly uiLayer = new Container();
  private ground!: TilingSprite;

  private time = 0;
  private kills = 0;
  private level = 1;
  private xp = 0;
  private xpNext = xpForLevel(1);
  private accumulator = 0;
  private hudTimer = 0;
  private paused = false;
  private ended = false;
  private destroyed = false;
  private pendingChoices: UpgradeOption[] = [];
  private unsubscribe: (() => void)[] = [];
  private resizeObserver: ResizeObserver | null = null;

  // Ajuste automático de calidad: media móvil de FPS.
  private fpsAvg = 60;
  private qualityTimer = 0;

  async init(host: HTMLElement, characterId: string): Promise<void> {
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
    this.tex = buildTextures(this.app.renderer);

    const def = CHARACTER_BY_ID[characterId] ?? CHARACTER_BY_ID.ember!;
    this.player = new Player(def, this.tex);
    this.player.addWeapon(WEAPON_BY_ID[def.weaponId]!);

    this.fx = new Fx(this.tex.dot);
    this.enemies = new Enemies(this.tex, this.player, { onPlayerHit: (n) => this.onPlayerHit(n) });
    this.weapons = new Weapons(this.tex, this.player, this.enemies, {
      onEnemyDamaged: (e, n, x, y) => this.onEnemyDamaged(e, n, x, y),
    });
    this.pickups = new Pickups(this.tex, this.player, { onXp: (n) => this.gainXp(n) });
    this.input = new Input(host, this.tex.ring, this.tex.dot);

    this.ground = new TilingSprite({ texture: this.tex.ground, width: 10, height: 10 });
    this.world.addChild(this.pickups.layer, this.enemies.layer, this.player.view, this.weapons.layer, this.fx.layer);
    this.uiLayer.addChild(this.input.view);
    this.app.stage.addChild(this.ground, this.world, this.uiLayer);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(host);
    this.layout();

    this.unsubscribe.push(
      gameBus.on('choose', ({ id }) => this.choose(id)),
      gameBus.on('pause', (p) => (this.paused = p || this.pendingChoices.length > 0)),
    );

    useRun.getState().reset();
    this.publishBuild();
    useRun.setState({ phase: 'playing' });
    this.pushHud();
    this.app.ticker.maxFPS = 60;
    this.app.ticker.add(this.frame, this);
  }

  /* ---------------------------------------------------------------- */
  /* Bucle                                                             */
  /* ---------------------------------------------------------------- */

  private frame(ticker: Ticker): void {
    const dtMs = Math.min(ticker.deltaMS, 100);
    this.trackFps(ticker.FPS, dtMs / 1000);
    if (!this.paused && !this.ended) {
      this.accumulator += dtMs / 1000;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.step(STEP);
        this.accumulator -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.accumulator = 0;
    }
    this.render();
  }

  private step(dt: number): void {
    this.time += dt;
    const p = this.player;

    this.input.update();
    if (this.input.active) {
      p.x += this.input.x * p.speed * dt;
      p.y += this.input.y * p.speed * dt;
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.regen > 0) p.heal(p.regen * dt);

    const { width, height } = this.app.screen;
    this.enemies.updateSpawning(dt, this.time, ENEMIES, Math.hypot(width, height) / 2);
    this.enemies.update(dt);
    this.weapons.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);

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
    const cx = Math.round(width / 2 - p.x);
    const cy = Math.round(height / 2 - p.y);
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

  private onEnemyDamaged(e: Enemy, amount: number, x: number, y: number): void {
    e.hp -= amount;
    e.flash = 0.08;
    this.fx.damage(x, y - 8, amount);
    if (e.hp > 0) return;
    this.kills++;
    this.fx.burst(e.x, e.y, e.def.eyeColor, 10, 140, 0.4);
    this.pickups.drop(e.x, e.y, e.def.xp);
    this.enemies.kill(e);
  }

  private onPlayerHit(amount: number): void {
    const real = this.player.hurt(amount);
    if (real <= 0) return;
    this.player.invuln = INVULN_AFTER_HIT;
    this.fx.damage(this.player.x, this.player.y - 20, real, 0xff6b6b);
    tg.haptic.impact('light');
    this.pushHud();
    if (this.player.hp <= 0) this.finish(false);
  }

  private gainXp(amount: number): void {
    this.xp += amount;
    if (this.xp >= this.xpNext && this.pendingChoices.length === 0) this.levelUp();
  }

  private levelUp(): void {
    this.xp -= this.xpNext;
    this.level++;
    this.xpNext = xpForLevel(this.level);
    this.pendingChoices = rollUpgrades(this.player);
    this.paused = true;
    this.fx.burst(this.player.x, this.player.y, 0xffe9a8, 24, 220, 0.6, 1.4);
    tg.haptic.notify('success');
    this.pushHud();
    useRun.setState({ phase: 'levelup', choices: this.pendingChoices });
  }

  private choose(id: string): void {
    const option = this.pendingChoices.find((o) => o.id === id);
    if (!option) return;
    applyUpgrade(this.player, option);
    this.pendingChoices = [];
    this.publishBuild();
    tg.haptic.impact('medium');
    // Si sobró XP para otro nivel, encadenamos otra elección antes de reanudar.
    if (this.xp >= this.xpNext) {
      this.levelUp();
      return;
    }
    this.paused = false;
    useRun.setState({ phase: 'playing', choices: [] });
    this.pushHud();
  }

  private finish(won: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.paused = true;
    const result: RunResult = {
      won,
      time: this.time,
      kills: this.kills,
      level: this.level,
      sparks: sparksFor(this.time, this.kills, won),
      weaponIds: this.player.weapons.map((w) => w.def.id),
      characterId: this.player.def.id,
    };
    if (won) this.fx.burst(this.player.x, this.player.y, 0xfff3c4, 60, 320, 1, 1.6);
    tg.haptic.notify(won ? 'success' : 'error');
    this.pushHud();
    useRun.setState({ phase: 'ended', result });
  }

  /* ---------------------------------------------------------------- */
  /* Puente hacia la UI                                                */
  /* ---------------------------------------------------------------- */

  private pushHud(): void {
    const p = this.player;
    useRun.setState({
      hud: {
        time: this.time,
        kills: this.kills,
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        level: this.level,
        xp: this.xp,
        xpNext: this.xpNext,
        fps: Math.round(this.fpsAvg),
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

  /** Baja la calidad de partículas si los FPS se mantienen bajos; la sube si se recuperan. */
  private trackFps(fps: number, dt: number): void {
    this.fpsAvg += (fps - this.fpsAvg) * Math.min(1, dt * 2);
    this.qualityTimer += dt;
    if (this.qualityTimer < 2) return;
    this.qualityTimer = 0;
    const q = this.fx.quality;
    if (this.fpsAvg < 40 && q > 0) this.fx.quality = (q - 1) as Quality;
    else if (this.fpsAvg > 56 && q < 2) this.fx.quality = (q + 1) as Quality;
  }

  destroy(): void {
    this.destroyed = true;
    for (const u of this.unsubscribe) u();
    this.resizeObserver?.disconnect();
    if (this.app.renderer) {
      this.app.ticker.remove(this.frame, this);
      this.input.destroy();
      this.app.destroy(true, { children: true, texture: true });
    }
  }
}
