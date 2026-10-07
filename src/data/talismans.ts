import raw from './balance/campaign.json';
import { bossBit } from './campaign';
import { RARITY_COLORS, type TalismanRarity } from './minibosses';

/** Talismanes del catálogo inicial; el resto se añade con una entrada aquí y otra en el JSON. */
export type TalismanId = 'aegis' | 'nova' | 'frost';

export interface TalismanDef {
  id: TalismanId;
  nameKey: `tal_${TalismanId}`;
  descKey: `tal_${TalismanId}_desc`;
  icon: string;
}

export const TALISMANS: readonly TalismanDef[] = [
  { id: 'aegis', nameKey: 'tal_aegis', descKey: 'tal_aegis_desc', icon: '🛡' },
  { id: 'nova', nameKey: 'tal_nova', descKey: 'tal_nova_desc', icon: '💥' },
  { id: 'frost', nameKey: 'tal_frost', descKey: 'tal_frost_desc', icon: '❄' },
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
  if (id === 'aegis') return { s: v.aegis.seconds[rarity]! };
  if (id === 'nova') return { d: v.nova.damage[rarity]!, r: v.nova.radius[rarity]! };
  return { s: v.frost.seconds[rarity]! };
}

/** Segundos de efecto (inmunidad o congelación); 0 si el talismán es instantáneo. */
export function talismanSeconds(id: TalismanId, rarity: TalismanRarity): number {
  if (id === 'aegis') return TAL.values.aegis.seconds[rarity]!;
  if (id === 'frost') return TAL.values.frost.seconds[rarity]!;
  return 0;
}

/** Talismán aleatorio de la rareza dada (cofres y recompensas). */
export function rollTalisman(rarity: TalismanRarity, rnd: () => number = Math.random): TalismanKey {
  const id = TAL.chestPool[Math.floor(rnd() * TAL.chestPool.length)]!;
  return talismanKey(id, rarity);
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
