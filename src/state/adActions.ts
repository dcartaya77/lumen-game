import { weekKey } from '@/data/events';
import { rollChest, rollWheel, WHEEL, WHEEL_AD_SPINS_PER_DAY, type Loot } from '@/data/loot';
import { tg } from '@/platform/telegram';
import { checkAdGate } from '@/services/ads/AdPolicy';
import { services } from '@/services/container';
import type { AdPlacement } from '@/services/types';
import { todayKey, yesterdayKey, type DailyShard, type SaveData } from './save-schema';
import { commit, useApp } from './store';

/* ------------------------------------------------------------------ */
/* Disponibilidad y reproducción de anuncios                           */
/* ------------------------------------------------------------------ */

export type AdAvailability =
  | { state: 'ready' }
  /** Sin proveedor (build sin anuncios): la oferta no existe. */
  | { state: 'hidden' }
  | { state: 'wait'; waitMs: number }
  | { state: 'cap' }
  | { state: 'later' };

export function adAvailability(placement: AdPlacement): AdAvailability {
  const { ads, save } = services();
  if (ads.providerId === 'none') return { state: 'hidden' };
  const gate = checkAdGate(save.data.ads, Date.now(), ads.isReady(placement));
  if (gate.ok) return { state: 'ready' };
  if (gate.reason === 'cap') return { state: 'cap' };
  if (gate.reason === 'cooldown') return { state: 'wait', waitMs: gate.waitMs };
  return { state: 'later' };
}

export function trackOffer(placement: AdPlacement): void {
  services().analytics.track('ad_offered', { placement });
}

let showing = false;

/**
 * Muestra un anuncio iniciado por el jugador. Devuelve true SOLO si el SDK confirmó que
 * se vio completo; quien llama entrega entonces la recompensa.
 */
export async function runAd(placement: AdPlacement): Promise<boolean> {
  if (showing) return false;
  const svc = services();
  const app = useApp.getState();
  if (adAvailability(placement).state !== 'ready') {
    app.showToast('ad_toast_none');
    return false;
  }
  showing = true;
  svc.analytics.track('ad_accepted', { placement });
  try {
    const out = await svc.ads.show(placement);
    const now = Date.now();
    if (out.status === 'rewarded') {
      svc.save.update('ads', (d) => {
        if (d.ads.day !== todayKey()) {
          d.ads.day = todayKey();
          d.ads.seen = 0;
        }
        d.ads.seen++;
        d.ads.last = now;
      });
      svc.analytics.track('ad_completed', { placement, provider: svc.ads.providerId });
      void svc.save.flush();
      commit();
      tg.haptic.notify('success');
      return true;
    }
    if (out.status === 'skipped') {
      svc.save.update('ads', (d) => {
        d.ads.last = now;
      });
      svc.analytics.track('ad_abandoned', { placement });
      app.showToast('ad_toast_skipped');
      commit();
      return false;
    }
    svc.analytics.track('ad_error', { placement, reason: out.status === 'error' ? out.reason : 'unavailable' });
    app.showToast(out.status === 'error' ? 'ad_toast_error' : 'ad_toast_none');
    return false;
  } finally {
    showing = false;
  }
}

/* ------------------------------------------------------------------ */
/* Recompensas (se llaman tras un anuncio completado o, si es gratis, directo) */
/* ------------------------------------------------------------------ */

function grant(d: SaveData, loot: Loot): void {
  d.profile.sparks += loot.sparks;
  d.profile.frags += loot.frags;
  if (loot.boost) d.ads.boost = true;
}

/** Cofre de la noche: `free` una vez al día; `ad` es el segundo, con mejor botín. */
export function openChest(kind: 'free' | 'ad'): Loot | null {
  const svc = services();
  if (!svc.save.data.daily.chest[kind]) return null;
  const loot = rollChest(kind === 'ad');
  svc.save.update(['profile', 'daily', 'ads'], (d) => {
    d.daily.chest[kind] = false;
    grant(d, loot);
  });
  svc.analytics.track('unlock', { kind: 'chest', tier: kind });
  void svc.save.flush();
  commit();
  tg.haptic.notify('success');
  return loot;
}

/** Ruleta: 1 giro gratis al día y hasta 3 más con anuncio. El premio se concede al girar. */
export function spinWheel(kind: 'free' | 'ad'): { index: number; prize: Loot } | null {
  const svc = services();
  const w = svc.save.data.daily.wheel;
  if (kind === 'free' ? !w.free : w.ads >= WHEEL_AD_SPINS_PER_DAY) return null;
  const index = rollWheel();
  const prize = WHEEL[index]!.prize;
  svc.save.update(['profile', 'daily', 'ads'], (d) => {
    if (kind === 'free') d.daily.wheel.free = false;
    else d.daily.wheel.ads++;
    grant(d, prize);
  });
  svc.analytics.track('unlock', { kind: 'wheel', tier: kind, index });
  void svc.save.flush();
  commit();
  return { index, prize };
}

export function wheelAdSpinsLeft(daily: DailyShard): number {
  return Math.max(0, WHEEL_AD_SPINS_PER_DAY - daily.wheel.ads);
}

/** La racha se rompe si el último día jugado es anterior a ayer. */
export function streakBroken(daily: DailyShard): boolean {
  const s = daily.streak;
  return s.n > 0 && s.last !== '' && s.last < yesterdayKey();
}

/** Reparar la racha con anuncio: una vez por semana. */
export function canRepairStreak(daily: DailyShard): boolean {
  return streakBroken(daily) && daily.streak.repairedWeek !== weekKey();
}

export function repairStreak(): boolean {
  const svc = services();
  if (!canRepairStreak(svc.save.data.daily)) return false;
  svc.save.update('daily', (d) => {
    // Como si hubiera jugado ayer: la siguiente partida continúa la racha.
    d.daily.streak.last = yesterdayKey();
    d.daily.streak.repairedWeek = weekKey();
  });
  svc.analytics.track('unlock', { kind: 'streak_repair' });
  void svc.save.flush();
  commit();
  useApp.getState().showToast('streak_repaired');
  return true;
}

/** Impulso inicial: la próxima partida empieza con +1 nivel. */
export function armBoost(): boolean {
  const svc = services();
  if (svc.save.data.ads.boost) return false;
  svc.save.update('ads', (d) => {
    d.ads.boost = true;
  });
  commit();
  return true;
}
