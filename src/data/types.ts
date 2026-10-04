import type { TranslationKey } from '@/i18n';

/** Nota corta que describe qué aporta cada nivel (clave de traducción). */
export type LevelNote = 'lv_new' | 'lv_dmg' | 'lv_count' | 'lv_cd' | 'lv_pierce' | 'lv_size' | 'lv_speed';

export interface WeaponLevel {
  dmg: number;
  /** Segundos entre disparos. */
  cooldown: number;
  count: number;
  speed: number;
  pierce: number;
  /** Multiplicador de tamaño del proyectil/área. */
  size: number;
  note: LevelNote;
}

export type WeaponBehavior = 'projectile';

export interface WeaponDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  behavior: WeaponBehavior;
  color: number;
  /** Alcance de auto-apuntado. */
  range: number;
  levels: readonly WeaponLevel[];
}

export type PassiveStat = 'maxHp' | 'speed' | 'damage' | 'magnet' | 'cooldown' | 'armor' | 'regen';

export interface PassiveDef {
  id: string;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  stat: PassiveStat;
  /** Valor sumado por nivel (multiplicador para stats porcentuales). */
  perLevel: number;
  maxLevel: number;
  color: number;
}

export interface EnemyDef {
  id: string;
  nameKey: TranslationKey;
  hp: number;
  speed: number;
  /** Daño por contacto. */
  dmg: number;
  radius: number;
  xp: number;
  eyeColor: number;
  tint: number;
  scale: number;
}

export interface CharacterDef {
  id: string;
  nameKey: TranslationKey;
  weaponId: string;
  base: {
    maxHp: number;
    speed: number;
    magnet: number;
    armor: number;
    regen: number;
  };
}

export interface UpgradeOption {
  id: string;
  kind: 'weapon' | 'passive';
  nameKey: TranslationKey;
  descKey: TranslationKey;
  note: LevelNote;
  /** Nivel que tendrá tras elegirla (1 = nueva). */
  level: number;
  maxLevel: number;
  color: number;
}
