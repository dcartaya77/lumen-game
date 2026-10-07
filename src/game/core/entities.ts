import type { BitmapText, Container, Sprite } from 'pixi.js';
import type { EnemyDef } from '@/data/types';

/** Entidades de datos planos. Los sprites se asignan una vez por objeto del pool. */

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  /** Velocidad de empuje (knockback), decae sola. */
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  dmg: number;
  xp: number;
  elite: boolean;
  /** Tiempo hasta poder volver a dañar por contacto. */
  contactCd: number;
  /** Flash blanco al recibir daño (segundos restantes). */
  flash: number;
  /** Estado de comportamiento (carga, disparo, deriva). */
  state: number;
  timer: number;
  /** Segundos restantes congelado (Escarcha): sin moverse, atacar ni hacer daño de contacto. */
  freeze: number;
  /** Dirección fijada para embestidas. */
  dirX: number;
  dirY: number;
  seed: number;
  body: Container;
  shadow: Sprite;
  eyes: Sprite;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  radius: number;
  life: number;
  pierce: number;
  knockback: number;
  homing: boolean;
  speed: number;
  /** Enemigos ya golpeados (para perforación). */
  hit: number[];
  sprite: Sprite;
}

export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  sprite: Sprite;
}

export interface Gem {
  x: number;
  y: number;
  value: number;
  pulled: boolean;
  sprite: Sprite;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startScale: number;
  drag: number;
  sprite: Sprite;
}

export interface DamageText {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: BitmapText;
}

/** Visual efímero (haz, segmento de cadena): se desvanece y vuelve al pool. */
export interface Flash {
  life: number;
  maxLife: number;
  sprite: Sprite;
}

/** Anillo de nova en expansión. */
export interface Nova {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  dmg: number;
  knockback: number;
  hit: number[];
  sprite: Sprite;
}
