import { giveTalisman, parseTalismanKey, talismanSlots } from '@/data/talismans';
import { services } from '@/services/container';
import { commit } from './store';

export function addTalisman(key: string, via: string): void {
  if (!parseTalismanKey(key)) return;
  const svc = services();
  svc.save.update('campaign', (d) => {
    giveTalisman(d.campaign, key);
  });
  svc.analytics.track('talisman_found', { key, via });
  void svc.save.flush();
  commit();
}

/** Gasta un talismán al usarlo; si se agota, sale también del equipo. */
export function consumeTalisman(key: string): void {
  const svc = services();
  svc.save.update('campaign', (d) => {
    const left = (d.campaign.tal[key] ?? 0) - 1;
    if (left > 0) d.campaign.tal[key] = left;
    else {
      delete d.campaign.tal[key];
      d.campaign.eq = d.campaign.eq.filter((k) => k !== key);
    }
  });
  svc.analytics.track('talisman_use', { key });
  void svc.save.flush();
  commit();
}

/** Equipa o desequipa un talismán del inventario (pantalla de preparación). */
export function toggleEquip(key: string): void {
  const svc = services();
  svc.save.update('campaign', (d) => {
    const c = d.campaign;
    if (c.eq.includes(key)) c.eq = c.eq.filter((k) => k !== key);
    else if ((c.tal[key] ?? 0) > 0) {
      const slots = talismanSlots(c);
      // Con una sola ranura, elegir otro talismán lo sustituye.
      if (c.eq.length < slots) c.eq = [...c.eq, key];
      else if (slots === 1) c.eq = [key];
    }
  });
  commit();
}
