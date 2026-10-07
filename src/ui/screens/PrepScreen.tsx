import { useEffect } from 'react';
import { RARITY_KEYS } from '@/data/minibosses';
import { equippedKeys, parseTalismanKey, TAL, talismanColor, talismanDescVars, talismanSlots } from '@/data/talismans';
import { t } from '@/i18n';
import { useApp } from '@/state/store';
import { toggleEquip } from '@/state/talismanActions';
import { ScreenHeader } from '@/ui/components/ScreenHeader';
import { TalismanIcon } from '@/ui/components/TalismanIcon';
import { tg } from '@/platform/telegram';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Antes de una noche de campaña: elegir qué talismanes del inventario se llevan (solo si hay alguno). */
export function PrepScreen() {
  const go = useApp((s) => s.go);
  const startRun = useApp((s) => s.startRun);
  const campaign = useApp((s) => s.campaign);
  const night = useApp((s) => s.prepNight);

  useEffect(() => {
    tg.backButton.show(() => go('campaign'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!campaign || night === null) return null;

  const slots = talismanSlots(campaign.next);
  const eq = equippedKeys(campaign);
  const entries = Object.entries(campaign.tal)
    .map(([key, n]) => ({ key, n, p: parseTalismanKey(key) }))
    .filter((e) => e.p !== null && e.n > 0)
    .sort((a, b) => b.p!.rarity - a.p!.rarity || a.p!.def.id.localeCompare(b.p!.def.id));

  return (
    <div className="screen">
      <ScreenHeader title={t('prep_title')} back="campaign" />
      <p className="hint" style={{ margin: '0 0 8px' }}>
        {t('prep_sub', { n: night })} · {t('prep_slots', { a: eq.length, b: slots })}
      </p>
      <div className="stack scrollable">
        {entries.map(({ key, n, p }) => {
          const on = eq.includes(key);
          const full = !on && eq.length >= slots && slots > 1;
          return (
            <button
              key={key}
              className={on ? 'shop-item tal-on' : 'shop-item'}
              style={{ ['--c' as string]: hex(talismanColor(p!.rarity)) }}
              disabled={full}
              onClick={() => {
                tg.haptic.select();
                toggleEquip(key);
              }}
            >
              <TalismanIcon talKey={key} />
              <span className="upgrade-body" style={{ flex: 1 }}>
                <span className="upgrade-name">
                  {t(p!.def.nameKey)} · {t(RARITY_KEYS[p!.rarity])}
                </span>
                <span className="upgrade-desc">{t(p!.def.descKey, talismanDescVars(p!.def.id, p!.rarity))}</span>
                <span className="upgrade-desc">{t('tal_owned', { n })}</span>
              </span>
              {on && <span className="shop-price max">{t('prep_equipped')}</span>}
            </button>
          );
        })}
        {slots < 2 && <p className="hint">{t('prep_slot_locked', { n: TAL.slot2AfterNight })}</p>}
        <p className="hint">{t('prep_hint')}</p>
      </div>
      <div className="panel camp-detail">
        <button className="btn btn-primary btn-block" onClick={() => startRun('campaign', night)}>
          {t('prep_start', { n: night })}
        </button>
      </div>
    </div>
  );
}
