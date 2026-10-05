import type { EnemyDef } from './types';

export const ENEMIES: readonly EnemyDef[] = [
  // Básico: persigue.
  {
    id: 'shade', nameKey: 'e_shade', hp: 18, speed: 72, dmg: 8, radius: 11, xp: 1,
    eyeColor: 0xff4d6d, tint: 0xffffff, scale: 1, shape: 'shade', behavior: 'chase',
  },
  // Rápido y frágil.
  {
    id: 'wisp', nameKey: 'e_wisp', hp: 9, speed: 135, dmg: 5, radius: 8, xp: 1,
    eyeColor: 0x8ff0ff, tint: 0xa8c4ff, scale: 0.8, shape: 'spiky', behavior: 'chase',
  },
  // Lento y tanque.
  {
    id: 'brute', nameKey: 'e_brute', hp: 90, speed: 42, dmg: 18, radius: 18, xp: 4,
    eyeColor: 0xffa640, tint: 0x9b8cff, scale: 1.7, shape: 'blob', behavior: 'chase',
  },
  // Mota: diminuta, en enjambres.
  {
    id: 'mote', nameKey: 'e_mote', hp: 4, speed: 110, dmg: 3, radius: 6, xp: 1,
    eyeColor: 0xffffff, tint: 0x777799, scale: 0.55, shape: 'shade', behavior: 'chase',
  },
  // Embestidor: acelera en línea recta cuando se acerca.
  {
    id: 'charger', nameKey: 'e_charger', hp: 35, speed: 60, dmg: 14, radius: 12, xp: 3,
    eyeColor: 0xff9f2e, tint: 0xff9f9f, scale: 1.1, shape: 'spiky', behavior: 'charge',
  },
  // Escupidor: mantiene distancia y dispara.
  {
    id: 'spitter', nameKey: 'e_spitter', hp: 28, speed: 55, dmg: 6, radius: 11, xp: 3,
    eyeColor: 0xa3ff8f, tint: 0x8fd0a0, scale: 1.05, shape: 'blob', behavior: 'ranged',
    shot: { cooldown: 2.6, speed: 150, dmg: 9, keepDistance: 220 },
  },
  // Cáscara: al morir libera motas.
  {
    id: 'husk', nameKey: 'e_husk', hp: 40, speed: 50, dmg: 10, radius: 14, xp: 3,
    eyeColor: 0xc78bff, tint: 0xcfb0ff, scale: 1.3, shape: 'blob', behavior: 'chase',
    onDeath: { id: 'mote', n: 4 },
  },
  // Errante: zigzaguea, difícil de apuntar.
  {
    id: 'drifter', nameKey: 'e_drifter', hp: 22, speed: 95, dmg: 8, radius: 10, xp: 2,
    eyeColor: 0xffffff, tint: 0xffe9a8, scale: 0.95, shape: 'spiky', behavior: 'drift',
  },
  // Jefe final: La Devoradora.
  {
    id: 'devourer', nameKey: 'e_devourer', hp: 2600, speed: 58, dmg: 30, radius: 44, xp: 40,
    eyeColor: 0xff2e5b, tint: 0x5b3a8a, scale: 4.2, shape: 'blob', behavior: 'boss', boss: true,
    onDeath: { id: 'mote', n: 12 },
  },
];

export const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/** Modificadores de élite: aparecen cada minuto. */
export const ELITE = { hpMult: 9, scaleMult: 1.55, dmgMult: 1.6, xpMult: 6, speedMult: 0.9, eyeColor: 0xffd700 };
