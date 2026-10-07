import raw from './balance/campaign.json';
import { BOSS } from './bosses';
import { bossBit } from './campaign';
import { RARITY_COLORS, type TalismanRarity } from './minibosses';
import { pickDistinct } from './pickDistinct';

/** Talismanes del catálogo; uno nuevo = entrada aquí, otra en el JSON (`values`) y una rama en `Talismans.use`. */
export type TalismanId =
  | 'aegis'
  | 'nova'
  | 'frost'
  | 'ember'
  | 'magnet'
  | 'hourglass'
  | 'fury'
  /* Exclusivos de jefe: solo legendarios, efecto propio. */
  | 'devour'
  | 'eclipse'
  | 'reflect'
  | 'carapace'
  | 'dawn';

export interface TalismanDef {
  id: TalismanId;
  nameKey: `tal_${TalismanId}`;
  descKey: `tal_${TalismanId}_desc`;
  icon: string;
  /** Solo se consigue como recompensa de un jefe (no sale de cofres). */
  exclusive?: true;
}

export const TALISMANS: readonly TalismanDef[] = [
  { id: 'aegis', nameKey: 'tal_aegis', descKey: 'tal_aegis_desc', icon: '🛡' },
  { id: 'nova', nameKey: 'tal_nova', descKey: 'tal_nova_desc', icon: '💥' },
  { id: 'frost', nameKey: 'tal_frost', descKey: 'tal_frost_desc', icon: '❄' },
  { id: 'ember', nameKey: 'tal_ember', descKey: 'tal_ember_desc', icon: '❤' },
  { id: 'magnet', nameKey: 'tal_magnet', descKey: 'tal_magnet_desc', icon: '🧲' },
  { id: 'hourglass', nameKey: 'tal_hourglass', descKey: 'tal_hourglass_desc', icon: '⏳' },
  { id: 'fury', nameKey: 'tal_fury', descKey: 'tal_fury_desc', icon: '🔥' },
  { id: 'devour', nameKey: 'tal_devour', descKey: 'tal_devour_desc', icon: '🌟', exclusive: true },
  { id: 'eclipse', nameKey: 'tal_eclipse', descKey: 'tal_eclipse_desc', icon: '🌘', exclusive: true },
  { id: 'reflect', nameKey: 'tal_reflect', descKey: 'tal_reflect_desc', icon: '🪞', exclusive: true },
  { id: 'carapace', nameKey: 'tal_carapace', descKey: 'tal_carapace_desc', icon: '💎', exclusive: true },
  { id: 'dawn', nameKey: 'tal_dawn', descKey: 'tal_dawn_desc', icon: '🌅', exclusive: true },
];

export const TALISMAN_BY_ID: Record<string, TalismanDef> = Object.fromEntries(TALISMANS.map((t) => [t.id, t]));

interface RawTalismans {
  /** Noche del jefe cuya derrota abre la segunda ranura. */
  slot2Boss: number;
  chestPool: TalismanId[];
  challengeRarity: TalismanRarity;
  values: {
    aegis: { seconds: number[] };
    nova: { radius: number[]; damage: number[]; knockback: number };
    frost: { seconds: number[]; bossMult: number };
    /** Fracción de la vida máxima que cura. */
    ember: { heal: number[] };
    /** Atrae todos los fragmentos y multiplica el radio de recogida `seconds` segundos. */
    magnet: { radiusMult: number; seconds: number[] };
    /** `slow` = factor de velocidad de los enemigos mientras dura (menor = más lento). */
    hourglass: { seconds: number[]; slow: number[]; bossMult: number };
    fury: { seconds: number[]; mult: number[] };
    /** Atrae la luz, da XP (fracción del nivel) y cura. */
    devour: { xpFrac: number; heal: number };
    /** Los enemigos corrientes pierden el rumbo `seconds` segundos. */
    eclipse: { seconds: number };
    /** Durante `seconds` los golpes no hieren y estallan en daño (×`mult`, mínimo `min`) en `radius`. */
    reflect: { seconds: number; mult: number; radius: number; min: number };
    /** Barrera que absorbe `frac` de la vida máxima durante `seconds` segundos. */
    carapace: { frac: number; seconds: number };
    /** Elimina a los enemigos corrientes, cura y da escudo. */
    dawn: { heal: number; shield: number };
  };
}

export const TAL = (raw as unknown as { talismans: RawTalismans }).talismans;

/** Clave de inventario: `id:rareza`. */
export type TalismanKey = `${TalismanId}:${TalismanRarity}`;

export function talismanKey(id: TalismanId, rarity: TalismanRarity): TalismanKey {
  return `${id}:${rarity}`;
}

export function parseTalismanKey(key: string): { def: TalismanDef; rarity: TalismanRarity } | null {
  const [id, r] = key.split(':');
  const def = TALISMAN_BY_ID[id ?? ''];
  const rarity = Number(r);
  if (!def || !Number.isInteger(rarity) || rarity < 0 || rarity > 3) return null;
  return { def, rarity: rarity as TalismanRarity };
}

export const talismanColor = (rarity: TalismanRarity): number => RARITY_COLORS[rarity]!;

/** Variables para la descripción traducida de un talismán en una rareza. */
export function talismanDescVars(id: TalismanId, rarity: TalismanRarity): Record<string, string | number> {
  const v = TAL.values;
  switch (id) {
    case 'aegis':
      return { s: v.aegis.seconds[rarity]! };
    case 'nova':
      return { d: v.nova.damage[rarity]!, r: v.nova.radius[rarity]! };
    case 'frost':
      return { s: v.frost.seconds[rarity]! };
    case 'ember':
      return { p: Math.round(v.ember.heal[rarity]! * 100) };
    case 'magnet':
      return { s: v.magnet.seconds[rarity]!, m: v.magnet.radiusMult };
    case 'hourglass':
      return { s: v.hourglass.seconds[rarity]!, p: Math.round((1 - v.hourglass.slow[rarity]!) * 100) };
    case 'fury':
      return { s: v.fury.seconds[rarity]!, m: v.fury.mult[rarity]! };
    case 'devour':
      return { p: Math.round(v.devour.xpFrac * 100), h: Math.round(v.devour.heal * 100) };
    case 'eclipse':
      return { s: v.eclipse.seconds };
    case 'reflect':
      return { s: v.reflect.seconds, m: v.reflect.mult };
    case 'carapace':
      return { p: Math.round(v.carapace.frac * 100), s: v.carapace.seconds };
    case 'dawn':
      return { h: Math.round(v.dawn.heal * 100), s: v.dawn.shield };
  }
}

/** Coherencia del JSON de talismanes (se ejecuta en desarrollo). */
export function validateTalismans(): string[] {
  const errors: string[] = [];
  for (const [id, vals] of Object.entries(TAL.values)) {
    if (!TALISMAN_BY_ID[id]) errors.push(`talismán ${id}: sin entrada en TALISMANS`);
    for (const [name, arr] of Object.entries(vals as Record<string, unknown>)) {
      if (Array.isArray(arr) && arr.length !== 4) errors.push(`talismán ${id}.${name}: hacen falta 4 rarezas`);
    }
  }
  for (const t of TALISMANS) if (!(t.id in TAL.values)) errors.push(`talismán ${t.id}: falta en values`);
  for (const id of TAL.chestPool) {
    if (!TALISMAN_BY_ID[id]) errors.push(`chestPool: ${id} desconocido`);
    else if (TALISMAN_BY_ID[id]!.exclusive) errors.push(`chestPool: ${id} es exclusivo de jefe`);
  }
  for (const [boss, c] of Object.entries(BOSS.types)) {
    if (!TALISMAN_BY_ID[c.reward.talisman]?.exclusive) errors.push(`jefe ${boss}: ${c.reward.talisman} no es un talismán exclusivo`);
  }
  return errors;
}

if (import.meta.env.DEV) {
  const errs = validateTalismans();
  if (errs.length) console.error('[campaign.json talismans]', errs);
}

/** Talismán aleatorio de la rareza dada (cofres y recompensas). */
export function rollTalisman(rarity: TalismanRarity, rnd: () => number = Math.random): TalismanKey {
  const id = TAL.chestPool[Math.floor(rnd() * TAL.chestPool.length)]!;
  return talismanKey(id, rarity);
}

/** Tres talismanes distintos de la misma rareza para elegir (anuncio del cofre); el primero es el sorteado. */
export function talismanChoices(first: TalismanKey, rnd: () => number = Math.random): TalismanKey[] {
  const p = parseTalismanKey(first);
  if (!p) return [first];
  return pickDistinct(TAL.chestPool, 3, p.def.id, rnd).map((id) => talismanKey(id, p.rarity));
}

/** Ranuras disponibles: 1 al inicio y 2 tras derrotar al jefe de `slot2Boss`. */
export function talismanSlots(c: { bosses: number }): number {
  return c.bosses & bossBit(TAL.slot2Boss) ? 2 : 1;
}

/** Talismanes equipados válidos para la próxima noche (con stock y dentro de las ranuras abiertas). */
export function equippedKeys(c: { bosses: number; tal: Record<string, number>; eq: string[] }): string[] {
  return c.eq.filter((k) => (c.tal[k] ?? 0) > 0).slice(0, talismanSlots(c));
}

export function inventoryTotal(c: { tal: Record<string, number> }): number {
  return Object.values(c.tal).reduce((a, n) => a + n, 0);
}

/** Añade un talismán al inventario (máx. 99) y lo equipa solo si queda una ranura libre. */
export function giveTalisman(c: { bosses: number; tal: Record<string, number>; eq: string[] }, key: string): void {
  c.tal[key] = Math.min(99, (c.tal[key] ?? 0) + 1);
  if (!c.eq.includes(key) && c.eq.length < talismanSlots(c)) c.eq.push(key);
}
