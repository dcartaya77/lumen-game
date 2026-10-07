import { Container, Sprite } from 'pixi.js';
import type { CharacterDef, PassiveStat, WeaponDef } from '@/data/types';
import type { SkinVisual } from '@/data/skins';
import { lighten } from './core/math';
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
  /** Segundos de inmunidad total restantes (talismán Égida). */
  shield = 0;
  facing = 1;

  readonly weapons: WeaponSlot[] = [];
  readonly passives = new Map<string, number>();
  readonly mods: Modifiers = { maxHp: 0, speed: 0, damage: 0, magnet: 0, cooldown: 0, armor: 0, regen: 0 };

  readonly view = new Container();
  private readonly flame: Sprite;
  private readonly core: Sprite;
  private readonly shieldFx: Sprite;
  private readonly glow: Sprite;
  private bob = 0;

  constructor(
    readonly def: CharacterDef,
    tex: GameTextures,
    glowTint = 0xffffff,
    skin: SkinVisual | null = null,
  ) {
    this.hp = def.base.maxHp;
    this.glow = new Sprite({ texture: tex.glow, anchor: 0.5, blendMode: 'add', alpha: 0.9 });
    this.glow.tint = skin ? skin.glow : glowTint;
    const body = skin ? skin.color : 0xffa640;
    this.flame = new Sprite({ texture: tex.flame, anchor: { x: 0.5, y: 0.6 }, tint: body });
    this.core = new Sprite({ texture: tex.flameCore, anchor: { x: 0.5, y: 0.6 }, tint: skin ? lighten(body, 0.7) : 0xfff3c4 });
    this.shieldFx = new Sprite({ texture: tex.ring, anchor: 0.5, blendMode: 'add', tint: 0x8ff0ff, visible: false });
    this.view.addChild(this.glow, this.flame, this.core, this.shieldFx);
    // Mods inherentes del personaje (si los tiene).
    const own = (def as { mods?: Partial<Modifiers> }).mods;
    if (own) for (const k of Object.keys(own) as (keyof Modifiers)[]) this.mods[k] += own[k]!;
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

  /** Sustituye el arma `fromId` por su forma evolucionada conservando la posición del slot. */
  evolveWeapon(fromId: string, into: WeaponDef): void {
    const slot = this.weapons.find((w) => w.def.id === fromId);
    if (!slot) return;
    slot.def = into;
    slot.level = 1;
    slot.cd = 0;
  }

  weaponLevel(id: string): number {
    return this.weapons.find((w) => w.def.id === id)?.level ?? 0;
  }

  /** Aplica daño teniendo en cuenta armadura e invulnerabilidad. Devuelve el daño real. */
  hurt(amount: number): number {
    if (this.invuln > 0 || this.shield > 0) return 0;
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
    this.core.scale.copyFrom(this.flame.scale);
    this.glow.scale.set(1 + Math.sin(this.bob * 0.7) * 0.05);
    this.view.position.set(this.x, this.y);
    this.flame.alpha = this.invuln > 0 && Math.floor(this.bob * 3) % 2 === 0 ? 0.4 : 1;
    this.core.alpha = this.flame.alpha;
    // Escudo de Égida: anillo estable que parpadea en el último segundo para avisar de que acaba.
    const on = this.shield > 0;
    this.shieldFx.visible = on;
    if (on) {
      this.shieldFx.scale.set(0.85 + Math.sin(this.bob * 0.9) * 0.04);
      this.shieldFx.alpha = this.shield < 1 && Math.floor(this.shield * 8) % 2 === 0 ? 0.25 : 0.9;
    }
  }
}
