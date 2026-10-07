import { todayKey, type AdsShard } from '@/state/save-schema';

/** Topes locales: sin servidor, solo evitan abusos y respetan al jugador. */
export const AD_DAILY_CAP = 15;
export const AD_MIN_GAP_MS = 60_000;
/** Mínimo entre ofertas que aparecen solas (p. ej. revivir), sin que el jugador las pida. */
export const AUTO_OFFER_GAP_MS = 120_000;

export type AdGate =
  | { ok: true }
  | { ok: false; reason: 'cap' }
  | { ok: false; reason: 'cooldown'; waitMs: number }
  | { ok: false; reason: 'provider' };

/** Decide si se puede ofrecer un anuncio ahora (tope diario, separación mínima, SDK listo). */
export function checkAdGate(ads: AdsShard, now: number, providerReady: boolean): AdGate {
  const seen = ads.day === todayKey() ? ads.seen : 0;
  if (seen >= AD_DAILY_CAP) return { ok: false, reason: 'cap' };
  const wait = ads.last + AD_MIN_GAP_MS - now;
  if (wait > 0) return { ok: false, reason: 'cooldown', waitMs: wait };
  if (!providerReady) return { ok: false, reason: 'provider' };
  return { ok: true };
}

let lastAutoOffer = 0;

export function canAutoOffer(now = Date.now()): boolean {
  return now - lastAutoOffer >= AUTO_OFFER_GAP_MS;
}

export function markAutoOffer(now = Date.now()): void {
  lastAutoOffer = now;
}
