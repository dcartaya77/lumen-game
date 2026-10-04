import type { BitmapText, Container, Sprite } from 'pixi.js';
import type { EnemyDef } from '@/data/types';

/** Entidades de datos planos. Los sprites se asignan una vez por objeto del pool. */

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  /** Tiempo hasta poder volver a dañar por contacto. */
  contactCd: number;
  /** Flash blanco al recibir daño (segundos restantes). */
  flash: number;
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
  /** Enemigos ya golpeados (para perforación). */
  hit: number[];
  sprite: Sprite;
}

export interface Gem {
  x: number;
  y: number;
  value: number;
  /** true cuando el imán ya la atrajo: acelera hacia el jugador sin volver atrás. */
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
