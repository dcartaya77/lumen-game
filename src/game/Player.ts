import { Container, Sprite } from 'pixi.js';
import type { CharacterDef, PassiveStat, WeaponDef } from '@/data/types';
import type { GameTextures } from './render/textures';

export interface WeaponSlot {
  def: WeaponDef;
  level: number;
  /** Tiempo restante hasta el próximo disparo. */
  cd: number;
}

/** Multiplicadores/bonos acumulados de pasivas; se aplican sobre la base del personaje. */
export interface Modifiers {
  maxHp: number;
  speed: number;
  damage: number;
  magnet: number;
  cooldown: number;
  armor: number;
  regen: number;
}

export class Player {
  x = 0;
  y = 0;
  hp: number;
  radius = 12;
  /** Segundos de invulnerabilidad tras un golpe. */
  invuln = 0;
  facing = 1;

  readonly weapons: WeaponSlot[] = [];
  readonly passives = new Map<string, number>();
  readonly mods: Modifiers = { maxHp: 0, speed: 0, damage: 0, magnet: 0, cooldown: 0, armor: 0, regen: 0 };

  readonly view = new Container();
  private readonly flame: Sprite;
  private readonly glow: Sprite;
  private bob = 0;

  constructor(
    readonly def: CharacterDef,
    tex: GameTextures,
  ) {
    this.hp = def.base.maxHp;
    this.glow = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', alpha: 0.9 });
    this.flame = new Sprite({ texture: tex.flame, anchor: { x: 0.5, y: 0.6 } });
    this.view.addChild(this.glow, this.flame);
  }

  get maxHp(): number {
    return Math.round(this.def.base.maxHp * (1 + this.mods.maxHp));
  }
  get speed(): number {
    return this.def.base.speed * (1 + this.mods.speed);
  }
  get damageMult(): number {
    return 1 + this.mods.damage;
  }
  get magnetRadius(): number {
    return this.def.base.magnet * (1 + this.mods.magnet);
  }
  /** Multiplicador de cadencia (menor = más rápido), con suelo del 40%. */
  get cooldownMult(): number {
    return Math.max(0.4, 1 - this.mods.cooldown);
  }
  get armor(): number {
    return this.def.base.armor + this.mods.armor;
  }
  get regen(): number {
    return this.def.base.regen + this.mods.regen;
  }

  addPassive(id: string, stat: PassiveStat, perLevel: number): number {
    const level = (this.passives.get(id) ?? 0) + 1;
    this.passives.set(id, level);
    const prevMax = this.maxHp;
    this.mods[stat] += perLevel;
    // Subir vida máxima también cura la diferencia: la mejora se nota al instante.
    if (stat === 'maxHp') this.hp += this.maxHp - prevMax;
    return level;
  }

  addWeapon(def: WeaponDef): number {
    const slot = this.weapons.find((w) => w.def.id === def.id);
    if (slot) return ++slot.level;
    this.weapons.push({ def, level: 1, cd: 0.2 });
    return 1;
  }

  weaponLevel(id: string): number {
    return this.weapons.find((w) => w.def.id === id)?.level ?? 0;
  }

  /** Aplica daño teniendo en cuenta armadura e invulnerabilidad. Devuelve el daño real. */
  hurt(amount: number): number {
    if (this.invuln > 0) return 0;
    const real = Math.max(1, amount - this.armor);
    this.hp = Math.max(0, this.hp - real);
    return real;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  animate(dt: number, moving: boolean, dirX: number): void {
    this.bob += dt * (moving ? 14 : 7);
    if (dirX !== 0) this.facing = dirX > 0 ? 1 : -1;
    this.flame.scale.set(this.facing * (1 + Math.sin(this.bob) * 0.05), 1 + Math.cos(this.bob * 1.3) * 0.06);
    this.glow.scale.set(1 + Math.sin(this.bob * 0.7) * 0.05);
    this.view.position.set(this.x, this.y);
    this.flame.alpha = this.invuln > 0 && Math.floor(this.bob * 3) % 2 === 0 ? 0.4 : 1;
  }
}
