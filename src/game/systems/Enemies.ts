import { Container, Sprite } from 'pixi.js';
import { CONTACT_DAMAGE_INTERVAL, enemyHpScaleAt, MAX_ENEMIES, maxAliveAt, spawnIntervalAt } from '@/data/balance';
import { ELITE, ENEMY_BY_ID } from '@/data/enemies';
import type { EnemyDef } from '@/data/types';
import { V1_WAVE_CONFIG, segmentAt, type WaveConfig } from '@/data/waves';
import type { Enemy, EnemyShot } from '../core/entities';
import { rand, TAU } from '../core/math';
import { Pool } from '../core/Pool';
import { SpatialHash } from '../core/SpatialHash';
import type { Player } from '../Player';
import type { GameTextures } from '../render/textures';

const ICE_TINT = 0x9fe8ff;
const SLOW_TINT = 0xffd9a0;
const BLIND_TINT = 0xb9a3e8;
/** Cristales del duelo contra el Coloso: enemigos inmóviles que ni hieren ni se cuentan como refuerzos. */
export const CRYSTAL_ID = 'boss_crystal';
/** Factor sobre la distancia al cuadrado con que el apuntado compara los cristales (0,16 = como si estuvieran a 0,4 de distancia). */
const CRYSTAL_AIM = 0.16;

export interface EnemyEvents {
  onPlayerHit(amount: number): void;
  onBossSpawn(e: Enemy): void;
  onEliteSpawn(e: Enemy): void;
}

/**
 * Aparición por olas, comportamientos, separación, disparos enemigos y contacto.
 * El hash se reconstruye cada paso; lo consumen también armas y recogida.
 */
export class Enemies {
  readonly layer = new Container();
  readonly pool: Pool<Enemy>;
  readonly hash = new SpatialHash<Enemy>(48);
  boss: Enemy | null = null;

  private readonly shots: Pool<EnemyShot>;
  private readonly near: Enemy[] = [];
  private spawnTimer = 0;
  private nextId = 1;
  private segmentFrom = -1;
  private eliteIndex = 0;
  private bossSpawned = false;

  /** Multiplicadores de partida (reto diario, evento semanal, noche de campaña). */
  mods = { hp: 1, speed: 1, dmg: 1, spawnRate: 1, cap: 1 };
  /** Olas, élites y jefe de la partida; por defecto las de la partida normal. */
  waveConfig: WaveConfig = V1_WAVE_CONFIG;
  /** false durante la antesala y el duelo: sin hordas normales. */
  spawningEnabled = true;

  constructor(
    private readonly tex: GameTextures,
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
          id: 0, def: null as unknown as EnemyDef, x: 0, y: 0, kx: 0, ky: 0, hp: 1, maxHp: 1, radius: 10,
          speed: 0, dmg: 0, xp: 1, elite: false, contactCd: 0, flash: 0, state: 0, timer: 0, freeze: 0, slow: 0, slowK: 1, blind: 0,
          dirX: 0, dirY: 0, seed: 0, body, shadow, eyes,
        };
      },
      (e) => (e.body.visible = false),
      120,
    );
    this.shots = new Pool<EnemyShot>(
      () => {
        const sprite = new Sprite({ texture: tex.shot, anchor: 0.5 });
        sprite.visible = false;
        this.layer.addChild(sprite);
        return { x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, sprite };
      },
      (s) => (s.sprite.visible = false),
      24,
    );
  }

  spawn(def: EnemyDef, x: number, y: number, hpScale: number, elite = false): Enemy {
    const e = this.pool.acquire();
    e.id = this.nextId++;
    e.def = def;
    e.x = x;
    e.y = y;
    e.kx = e.ky = 0;
    e.elite = elite;
    e.maxHp = e.hp = Math.round(def.hp * hpScale * this.mods.hp * (elite ? ELITE.hpMult : 1));
    e.radius = def.radius * (elite ? ELITE.scaleMult : 1);
    e.speed = def.speed * rand(0.9, 1.1) * this.mods.speed * (elite ? ELITE.speedMult : 1);
    e.dmg = def.dmg * this.mods.dmg * (elite ? ELITE.dmgMult : 1);
    e.xp = def.xp * (elite ? ELITE.xpMult : 1);
    e.contactCd = 0;
    e.flash = 0;
    e.freeze = 0;
    e.slow = 0;
    e.slowK = 1;
    e.blind = 0;
    e.state = 0;
    e.timer = def.shot ? rand(0.5, def.shot.cooldown) : rand(0, 1);
    e.seed = Math.random() * TAU;
    e.body.visible = true;
    e.body.alpha = 1;
    e.body.scale.set(def.scale * (elite ? ELITE.scaleMult : 1));
    e.body.position.set(x, y);
    e.shadow.texture = def.shape === 'shade' ? this.tex.shadow : this.tex[def.shape];
    e.shadow.tint = def.tint;
    e.shadow.alpha = 1;
    e.eyes.alpha = 1;
    e.eyes.tint = elite ? ELITE.eyeColor : def.eyeColor;
    e.eyes.scale.set(elite ? 1.4 : 1);
    if (def.boss) {
      this.boss = e;
      this.bossSpawned = true;
    }
    return e;
  }

  /** Punto aleatorio en un anillo fuera de pantalla alrededor del jugador. */
  ringPoint(viewRadius: number, out: { x: number; y: number }): void {
    const a = rand(0, TAU);
    const r = viewRadius + rand(40, 120);
    out.x = this.player.x + Math.cos(a) * r;
    out.y = this.player.y + Math.sin(a) * r;
  }

  private readonly pt = { x: 0, y: 0 };

  updateSpawning(dt: number, time: number, viewRadius: number): void {
    if (!this.spawningEnabled) return;
    const cfg = this.waveConfig;
    const seg = segmentAt(time, cfg.waves);
    const hpScale = enemyHpScaleAt(time);

    // Entrada de tramo: grupo de golpe.
    if (seg.from !== this.segmentFrom) {
      this.segmentFrom = seg.from;
      if (seg.burst) {
        const def = ENEMY_BY_ID[seg.burst.id]!;
        this.ringPoint(viewRadius, this.pt);
        for (let i = 0; i < seg.burst.n; i++) {
          this.spawn(def, this.pt.x + rand(-40, 40), this.pt.y + rand(-40, 40), hpScale);
        }
      }
    }
    // Élite por minuto.
    const eliteAt = cfg.eliteTimes[this.eliteIndex];
    if (eliteAt !== undefined && time >= eliteAt) {
      const def = ENEMY_BY_ID[cfg.eliteIds[this.eliteIndex % cfg.eliteIds.length]!]!;
      this.eliteIndex++;
      this.ringPoint(viewRadius, this.pt);
      this.events.onEliteSpawn(this.spawn(def, this.pt.x, this.pt.y, hpScale, true));
    }
    // Jefe.
    if (cfg.bossTime !== null && !this.bossSpawned && time >= cfg.bossTime) {
      this.ringPoint(viewRadius, this.pt);
      this.events.onBossSpawn(this.spawn(ENEMY_BY_ID.devourer!, this.pt.x, this.pt.y, 1));
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.pool.size >= Math.min(MAX_ENEMIES, maxAliveAt(time) * seg.cap * this.mods.cap)) return;
    this.spawnTimer = (spawnIntervalAt(time) * seg.rate) / this.mods.spawnRate;
    let total = 0;
    for (const s of seg.spawn) total += s.w;
    let r = Math.random() * total;
    let id = seg.spawn[0]!.id;
    for (const s of seg.spawn) {
      r -= s.w;
      if (r <= 0) {
        id = s.id;
        break;
      }
    }
    this.ringPoint(viewRadius, this.pt);
    this.spawn(ENEMY_BY_ID[id]!, this.pt.x, this.pt.y, hpScale);
  }

  update(rawDt: number, time: number): void {
    const list = this.pool.active;
    const p = this.player;
    this.hash.clear();
    for (let i = 0; i < list.length; i++) this.hash.insert(list[i]!);

    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      // Reloj de arena: el tiempo propio del enemigo (movimiento, temporizadores y ataques) corre más despacio.
      let dt = rawDt;
      if (e.slow > 0) {
        e.slow -= rawDt;
        dt = rawDt * e.slowK;
        if (e.slow <= 0) e.shadow.tint = e.def.tint;
      }
      let dx = p.x - e.x;
      let dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;

      let mx = 0;
      let my = 0;
      // Congelado: ni se mueve, ni dispara, ni hace daño por contacto; el hielo se ve en su tinte.
      const frozen = e.freeze > 0;
      if (frozen) {
        e.freeze -= rawDt;
        e.shadow.tint = e.freeze > 0 ? ICE_TINT : e.def.tint;
      } else if (e.slow > 0) e.shadow.tint = SLOW_TINT;
      else if (e.blind > 0) e.shadow.tint = BLIND_TINT;
      if (e.blind > 0) {
        e.blind -= rawDt;
        if (e.blind <= 0) e.shadow.tint = e.def.tint;
      }
      switch (frozen ? 'frozen' : e.blind > 0 && !e.def.boss && !e.def.mini ? 'wander' : e.def.behavior) {
        case 'frozen':
          break;
        case 'wander': {
          // Sin rumbo: da vueltas despacio en lugar de perseguir.
          const a = time * 1.3 + e.seed;
          mx = Math.cos(a) * e.speed * 0.5;
          my = Math.sin(a * 1.1) * e.speed * 0.5;
          break;
        }
        case 'chase':
          mx = dx * e.speed;
          my = dy * e.speed;
          break;
        case 'drift': {
          // Zigzag perpendicular a la dirección del jugador.
          const s = Math.sin(time * 3 + e.seed) * 0.9;
          mx = (dx - dy * s) * e.speed;
          my = (dy + dx * s) * e.speed;
          break;
        }
        case 'charge':
          mx = dx * e.speed;
          my = dy * e.speed;
          if (e.state === 0 && d < 190) {
            e.state = 1; // aviso
            e.timer = 0.45;
            e.dirX = dx;
            e.dirY = dy;
          } else if (e.state === 1) {
            mx = my = 0;
            e.timer -= dt;
            e.body.scale.set(e.def.scale * (e.elite ? ELITE.scaleMult : 1) * (1 + Math.sin(e.timer * 40) * 0.08));
            if (e.timer <= 0) {
              e.state = 2;
              e.timer = 0.5;
              e.dirX = dx;
              e.dirY = dy;
              e.body.scale.set(e.def.scale * (e.elite ? ELITE.scaleMult : 1));
            }
          } else if (e.state === 2) {
            mx = e.dirX * e.speed * 5;
            my = e.dirY * e.speed * 5;
            e.timer -= dt;
            if (e.timer <= 0) {
              e.state = 3;
              e.timer = 1.2; // recuperación
            }
          } else if (e.state === 3) {
            mx = dx * e.speed * 0.4;
            my = dy * e.speed * 0.4;
            e.timer -= dt;
            if (e.timer <= 0) e.state = 0;
          }
          break;
        case 'ranged': {
          const keep = e.def.shot!.keepDistance;
          const k = d > keep + 30 ? 1 : d < keep - 30 ? -0.7 : 0;
          mx = dx * e.speed * k;
          my = dy * e.speed * k;
          e.timer -= dt;
          if (e.timer <= 0 && d < keep + 160) {
            e.timer = e.def.shot!.cooldown;
            this.shoot(e, dx, dy);
          }
          break;
        }
        case 'mini':
          // Se mueve y ataca desde Minibosses; aquí solo contacto, separación y empuje.
          break;
        case 'boss': {
          // Alterna persecución lenta con embestidas telegrafiadas.
          e.timer -= dt;
          if (e.state === 0) {
            mx = dx * e.speed;
            my = dy * e.speed;
            if (e.timer <= 0) {
              e.state = 1;
              e.timer = 0.8;
              e.dirX = dx;
              e.dirY = dy;
            }
          } else if (e.state === 1) {
            e.body.scale.set(e.def.scale * (1 + Math.sin(e.timer * 30) * 0.05));
            if (e.timer <= 0) {
              e.state = 2;
              e.timer = 0.7;
              e.dirX = dx;
              e.dirY = dy;
              e.body.scale.set(e.def.scale);
            }
          } else if (e.state === 2) {
            mx = e.dirX * e.speed * 4.5;
            my = e.dirY * e.speed * 4.5;
            if (e.timer <= 0) {
              e.state = 0;
              e.timer = 3.5;
            }
          }
          break;
        }
      }

      // Separación: empuja lejos de vecinos solapados para que no se apilen.
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
      const sepForce = e.def.boss || e.def.mini ? 0 : 40;
      e.x += (mx + sx * sepForce + e.kx) * dt;
      e.y += (my + sy * sepForce + e.ky) * dt;
      // El empuje decae rápido; el jefe apenas lo nota.
      const decay = Math.max(0, 1 - dt * (e.def.boss ? 30 : e.def.mini ? 20 : 8));
      e.kx *= decay;
      e.ky *= decay;

      // Contacto con el jugador.
      e.contactCd -= dt;
      if (!frozen && e.dmg > 0 && d < e.radius + p.radius && e.contactCd <= 0) {
        e.contactCd = CONTACT_DAMAGE_INTERVAL;
        this.events.onPlayerHit(e.dmg);
      }

      if (e.flash > 0) {
        e.flash -= rawDt;
        e.shadow.tint = e.flash > 0 ? 0xffffff : e.def.tint;
      }
      e.body.position.set(e.x, e.y);
      e.eyes.x = dx * 2;
    }
    this.updateShots(rawDt);
  }

  /** Proyectil enemigo genérico (abanico de minijefes); reutiliza el pool de disparos. */
  fireShot(x: number, y: number, vx: number, vy: number, dmg: number, scale = 1): void {
    const s = this.shots.acquire();
    s.x = x;
    s.y = y;
    s.vx = vx;
    s.vy = vy;
    s.dmg = dmg;
    s.life = 4;
    s.sprite.visible = true;
    s.sprite.scale.set(scale);
    s.sprite.position.set(x, y);
  }

  private shoot(e: Enemy, dx: number, dy: number): void {
    const s = this.shots.acquire();
    const shot = e.def.shot!;
    s.x = e.x;
    s.y = e.y;
    s.vx = dx * shot.speed;
    s.vy = dy * shot.speed;
    s.dmg = shot.dmg * (e.elite ? ELITE.dmgMult : 1);
    s.life = 4;
    s.sprite.visible = true;
    s.sprite.scale.set(e.elite ? 1.6 : 1);
    s.sprite.position.set(s.x, s.y);
  }

  private updateShots(dt: number): void {
    const p = this.player;
    const list = this.shots.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i]!;
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.sprite.position.set(s.x, s.y);
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const r = p.radius + 5;
      if (dx * dx + dy * dy < r * r) {
        this.events.onPlayerHit(s.dmg);
        this.shots.releaseAt(i);
      } else if (s.life <= 0) this.shots.releaseAt(i);
    }
  }

  /**
   * Enemigo activo más cercano dentro de `range` (ignorando `exclude`), o null. Los cristales del Coloso cuentan como
   * más cercanos de lo que están para que el apuntado automático los elija antes que al jefe blindado.
   */
  nearest(x: number, y: number, range: number, exclude?: number[]): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range * range;
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]!;
      if (e.hp <= 0 || (exclude && exclude.includes(e.id))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const raw = dx * dx + dy * dy;
      if (raw >= range * range) continue;
      const d = e.def.id === CRYSTAL_ID ? raw * CRYSTAL_AIM : raw;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Elimina al enemigo por referencia. Para usar fuera de bucles de iteración. */
  kill(e: Enemy): void {
    if (e === this.boss) this.boss = null;
    const i = this.pool.active.indexOf(e);
    if (i >= 0) this.pool.releaseAt(i);
  }

  /** Mata a todos los enemigos normales en un radio (revivir / victoria). Devuelve la lista. */
  killAround(x: number, y: number, radius: number, out: Enemy[]): void {
    out.length = 0;
    const list = this.pool.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]!;
      if (e.def.boss || e.def.mini || e.def.id === CRYSTAL_ID) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        out.push(e);
        this.pool.releaseAt(i);
      }
    }
  }

  /** Ralentiza a todos los enemigos vivos (`k` = factor de velocidad); los jefes finales aguantan `bossMult` del tiempo. */
  slowAll(seconds: number, k: number, bossMult: number): number {
    let n = 0;
    for (const e of this.pool.active) {
      if (e.hp <= 0) continue;
      e.slow = seconds * (e.def.boss ? bossMult : 1);
      e.slowK = k;
      n++;
    }
    return n;
  }

  /** Cega a los enemigos corrientes (no a jefes, minijefes ni cristales): vagan sin rumbo `seconds` segundos. */
  blindAll(seconds: number): number {
    let n = 0;
    for (const e of this.pool.active) {
      if (e.hp <= 0 || e.def.boss || e.def.mini || e.def.id === CRYSTAL_ID) continue;
      e.blind = seconds;
      n++;
    }
    return n;
  }

  /** Factor de tiempo propio de un enemigo: lo usan los sistemas que mueven jefes y minijefes por su cuenta. */
  speedFactor(e: Enemy): number {
    return e.slow > 0 ? e.slowK : 1;
  }

  /** Congela a todos los enemigos vivos; los jefes finales aguantan `bossMult` del tiempo. */
  freezeAll(seconds: number, bossMult: number): number {
    let n = 0;
    for (const e of this.pool.active) {
      if (e.hp <= 0) continue;
      e.freeze = seconds * (e.def.boss ? bossMult : 1);
      n++;
    }
    return n;
  }

  /** Debug: tras saltar en el tiempo, da por pasados los élites, el jefe y el estallido del tramo actual. */
  skipTo(time: number): void {
    const cfg = this.waveConfig;
    this.eliteIndex = cfg.eliteTimes.filter((t) => t <= time).length;
    this.segmentFrom = segmentAt(time, cfg.waves).from;
    if (cfg.bossTime !== null && cfg.bossTime <= time) this.bossSpawned = true;
  }

  /** Quita los proyectiles enemigos en vuelo (cambios de fase del jefe). */
  clearShots(): void {
    this.shots.releaseAll();
  }

  clear(): void {
    this.pool.releaseAll();
    this.shots.releaseAll();
    this.boss = null;
  }
}
