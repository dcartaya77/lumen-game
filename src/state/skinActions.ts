import { isSkinOwned, isTrialable, SKIN_BY_ID, skinSlot } from '@/data/skins';
import { tg } from '@/platform/telegram';
import { services } from '@/services/container';
import { commit, useApp } from './store';

/** Compra con Chispas o fragmentos. Las skins por anuncios se desbloquean con `addSkinAd`. */
export function buySkin(id: string): boolean {
  const svc = services();
  const skin = SKIN_BY_ID[id];
  const p = svc.save.data.profile;
  if (!skin || isSkinOwned(p, skin)) return false;
  const u = skin.unlock;
  if (u.type === 'sparks' && p.sparks < u.cost) return false;
  if (u.type === 'frags' && p.frags < u.cost) return false;
  if (u.type !== 'sparks' && u.type !== 'frags') return false;
  svc.save.update('profile', (d) => {
    if (u.type === 'sparks') d.profile.sparks -= u.cost;
    else d.profile.frags -= u.cost;
    d.profile.unlocked.s.push(id);
    d.profile.selected.skin[skinSlot(skin)] = id;
  });
  svc.analytics.track('unlock', { kind: 'skin', id, via: u.type });
  void svc.save.flush();
  commit();
  tg.haptic.notify('success');
  return true;
}

export function equipSkin(id: string): void {
  const svc = services();
  const skin = SKIN_BY_ID[id];
  if (!skin || !isSkinOwned(svc.save.data.profile, skin)) return;
  svc.save.update('profile', (d) => {
    d.profile.selected.skin[skinSlot(skin)] = id;
  });
  tg.haptic.select();
  commit();
}

/** Suma un anuncio visto a la barra de la skin; al llegar al total queda desbloqueada y equipada. */
export function addSkinAd(id: string): { progress: number; unlocked: boolean } | null {
  const svc = services();
  const skin = SKIN_BY_ID[id];
  if (!skin || skin.unlock.type !== 'ads' || isSkinOwned(svc.save.data.profile, skin)) return null;
  const need = skin.unlock.count;
  let progress = 0;
  let unlocked = false;
  svc.save.update(['ads', 'profile'], (d) => {
    progress = (d.ads.skinProgress[id] ?? 0) + 1;
    d.ads.skinProgress[id] = progress;
    if (progress >= need) {
      unlocked = true;
      d.profile.unlocked.s.push(id);
      d.profile.selected.skin[skinSlot(skin)] = id;
    }
  });
  if (unlocked) {
    svc.analytics.track('unlock', { kind: 'skin', id, via: 'ads' });
    useApp.getState().showToast('skin_unlocked');
  }
  void svc.save.flush();
  commit();
  return { progress, unlocked };
}

/** Prueba de una skin legendaria durante UNA partida (una prueba por skin). */
export function armTrial(id: string): boolean {
  const svc = services();
  const skin = SKIN_BY_ID[id];
  const d = svc.save.data;
  if (!skin || !isTrialable(skin) || isSkinOwned(d.profile, skin) || d.ads.trialed.includes(id) || d.ads.trial) return false;
  svc.save.update('ads', (data) => {
    data.ads.trial = id;
    data.ads.trialed.push(id);
  });
  svc.analytics.track('unlock', { kind: 'skin_trial', id });
  commit();
  return true;
}
