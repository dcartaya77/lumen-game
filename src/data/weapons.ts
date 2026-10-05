import type { LevelNote, WeaponDef, WeaponLevel } from './types';

export const MAX_WEAPONS = 4;
export const MAX_PASSIVES = 4;

type L = Partial<WeaponLevel> & { note: LevelNote };

/** Construye 5 niveles aplicando parches sucesivos sobre el nivel 1. */
function levels(base: Omit<WeaponLevel, 'note'>, patches: L[]): WeaponLevel[] {
  const out: WeaponLevel[] = [{ ...base, note: 'lv_new' }];
  for (const p of patches) out.push({ ...out[out.length - 1]!, ...p });
  return out;
}

/** Una forma evolucionada tiene un único nivel. */
function evolved(level: Omit<WeaponLevel, 'note'>): WeaponLevel[] {
  return [{ ...level, note: 'lv_evolve' }];
}

export const WEAPONS: readonly WeaponDef[] = [
  // 1. Chispa: proyectil al más cercano. + Imán => Tormenta Eléctrica (cadena).
  {
    id: 'spark',
    nameKey: 'w_spark',
    descKey: 'w_spark_desc',
    behavior: 'projectile',
    color: 0xffe9a8,
    range: 420,
    knockback: 60,
    evolution: { into: 'storm', requires: 'lodestone' },
    levels: levels({ dmg: 12, cooldown: 0.85, count: 1, speed: 520, pierce: 1, size: 1, duration: 1 }, [
      { count: 2, note: 'lv_count' },
      { dmg: 17, cooldown: 0.75, note: 'lv_dmg' },
      { count: 3, pierce: 2, note: 'lv_pierce' },
      { dmg: 24, cooldown: 0.6, size: 1.25, note: 'lv_cd' },
    ]),
  },
  {
    id: 'storm',
    nameKey: 'w_storm',
    descKey: 'w_storm_desc',
    behavior: 'chain',
    color: 0x9fd8ff,
    range: 460,
    knockback: 90,
    evolved: true,
    levels: evolved({ dmg: 30, cooldown: 0.55, count: 6, speed: 170, pierce: 1, size: 1, duration: 1 }),
  },

  // 2. Brasas: aura de daño. + Vigor => Hoguera (más grande y cura).
  {
    id: 'embers',
    nameKey: 'w_embers',
    descKey: 'w_embers_desc',
    behavior: 'aura',
    color: 0xff7a3d,
    range: 0,
    knockback: 20,
    evolution: { into: 'bonfire', requires: 'vigor' },
    levels: levels({ dmg: 5, cooldown: 0.5, count: 1, speed: 0, pierce: 0, size: 1, duration: 0 }, [
      { size: 1.2, note: 'lv_size' },
      { dmg: 7, note: 'lv_dmg' },
      { cooldown: 0.38, size: 1.35, note: 'lv_cd' },
      { dmg: 10, size: 1.55, note: 'lv_dmg' },
    ]),
  },
  {
    id: 'bonfire',
    nameKey: 'w_bonfire',
    descKey: 'w_bonfire_desc',
    behavior: 'aura',
    color: 0xffb347,
    range: 0,
    knockback: 40,
    evolved: true,
    levels: evolved({ dmg: 16, cooldown: 0.33, count: 1, speed: 0, pierce: 0, size: 2.1, duration: 0 }),
  },

  // 3. Luces errantes: orbes en órbita. + Ligereza => Corona Solar.
  {
    id: 'orbs',
    nameKey: 'w_orbs',
    descKey: 'w_orbs_desc',
    behavior: 'orbit',
    color: 0xc78bff,
    range: 0,
    knockback: 140,
    evolution: { into: 'corona', requires: 'swift' },
    levels: levels({ dmg: 9, cooldown: 0.35, count: 1, speed: 2.6, pierce: 0, size: 1, duration: 0 }, [
      { count: 2, note: 'lv_count' },
      { dmg: 13, speed: 3.1, note: 'lv_dmg' },
      { count: 3, size: 1.2, note: 'lv_count' },
      { dmg: 18, speed: 3.6, size: 1.35, note: 'lv_speed' },
    ]),
  },
  {
    id: 'corona',
    nameKey: 'w_corona',
    descKey: 'w_corona_desc',
    behavior: 'orbit',
    color: 0xfff3c4,
    range: 0,
    knockback: 200,
    evolved: true,
    levels: evolved({ dmg: 26, cooldown: 0.25, count: 6, speed: 4.2, pierce: 0, size: 1.5, duration: 0 }),
  },

  // 4. Haz lunar: rayo perforante hacia el enemigo más cercano. + Fervor => Haz Estelar.
  {
    id: 'beam',
    nameKey: 'w_beam',
    descKey: 'w_beam_desc',
    behavior: 'beam',
    color: 0x8ff0ff,
    range: 520,
    knockback: 30,
    evolution: { into: 'starbeam', requires: 'might' },
    levels: levels({ dmg: 18, cooldown: 1.4, count: 1, speed: 380, pierce: 99, size: 1, duration: 0.18 }, [
      { dmg: 24, note: 'lv_dmg' },
      { speed: 480, size: 1.3, note: 'lv_size' },
      { cooldown: 1.1, note: 'lv_cd' },
      { dmg: 36, count: 2, note: 'lv_count' },
    ]),
  },
  {
    id: 'starbeam',
    nameKey: 'w_starbeam',
    descKey: 'w_starbeam_desc',
    behavior: 'beam',
    color: 0xffffff,
    range: 600,
    knockback: 60,
    evolved: true,
    levels: evolved({ dmg: 48, cooldown: 0.8, count: 3, speed: 600, pierce: 99, size: 2, duration: 0.25 }),
  },

  // 5. Luciérnagas: proyectiles teledirigidos. + Prisa => Enjambre.
  {
    id: 'fireflies',
    nameKey: 'w_fireflies',
    descKey: 'w_fireflies_desc',
    behavior: 'homing',
    color: 0xa3ff8f,
    range: 480,
    knockback: 40,
    evolution: { into: 'swarm', requires: 'haste' },
    levels: levels({ dmg: 8, cooldown: 1.2, count: 2, speed: 260, pierce: 1, size: 1, duration: 2.5 }, [
      { count: 3, note: 'lv_count' },
      { dmg: 12, speed: 300, note: 'lv_dmg' },
      { count: 4, cooldown: 1.0, note: 'lv_count' },
      { dmg: 16, pierce: 2, note: 'lv_pierce' },
    ]),
  },
  {
    id: 'swarm',
    nameKey: 'w_swarm',
    descKey: 'w_swarm_desc',
    behavior: 'homing',
    color: 0xd4ff8f,
    range: 560,
    knockback: 60,
    evolved: true,
    levels: evolved({ dmg: 20, cooldown: 0.55, count: 5, speed: 360, pierce: 3, size: 1.2, duration: 3 }),
  },

  // 6. Onda de luz: anillo expansivo que empuja. + Corteza => Pulso Solar.
  {
    id: 'nova',
    nameKey: 'w_nova',
    descKey: 'w_nova_desc',
    behavior: 'nova',
    color: 0xffd38a,
    range: 0,
    knockback: 380,
    evolution: { into: 'pulse', requires: 'bark' },
    levels: levels({ dmg: 14, cooldown: 2.4, count: 1, speed: 420, pierce: 0, size: 1, duration: 0.45 }, [
      { dmg: 20, note: 'lv_dmg' },
      { size: 1.3, note: 'lv_size' },
      { cooldown: 1.9, note: 'lv_cd' },
      { dmg: 30, size: 1.6, note: 'lv_dmg' },
    ]),
  },
  {
    id: 'pulse',
    nameKey: 'w_pulse',
    descKey: 'w_pulse_desc',
    behavior: 'nova',
    color: 0xffffff,
    range: 0,
    knockback: 520,
    evolved: true,
    levels: evolved({ dmg: 55, cooldown: 1.3, count: 2, speed: 520, pierce: 0, size: 2, duration: 0.5 }),
  },
];

export const WEAPON_BY_ID: Record<string, WeaponDef> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const BASE_WEAPONS = WEAPONS.filter((w) => !w.evolved);
