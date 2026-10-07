import { useState } from 'react';
import type { Loot } from '@/data/loot';
import { t } from '@/i18n';
import { services } from '@/services/container';
import { openChest } from '@/state/adActions';
import { useApp } from '@/state/store';
import { AdButton } from './AdButton';

export function LootList({ loot }: { loot: Loot }) {
  return (
    <div className="loot">
      {loot.sparks > 0 && (
        <span className="pill">
          <span className="spark-icon" /> {t('loot_sparks', { n: loot.sparks })}
        </span>
      )}
      {loot.frags > 0 && <span className="pill">◆ {t('loot_frags', { n: loot.frags })}</span>}
      {loot.boost && <span className="pill">▲ {t('loot_boost')}</span>}
    </div>
  );
}

/** Cofre de la noche: uno gratis al día y un segundo, con mejor botín, a cambio de un anuncio. */
export function ChestPanel() {
  const daily = useApp((s) => s.daily)!;
  const adsOn = services().ads.providerId !== 'none';
  const [loot, setLoot] = useState<Loot | null>(null);
  const show = (l: Loot | null) => {
    if (l) setLoot(l);
  };

  return (
    <div className="panel">
      <div className="panel-title">🎁 {t('chest_title')}</div>
      <div className="stack" style={{ gap: 8 }}>
        {daily.chest.free && (
          <button className="btn btn-primary btn-block" onClick={() => show(openChest('free'))}>
            {t('chest_free')}
          </button>
        )}
        {daily.chest.ad && adsOn && (
          <AdButton placement="chest" label={t('chest_ad')} onReward={() => show(openChest('ad'))} />
        )}
        {!daily.chest.free && (!daily.chest.ad || !adsOn) && (
          <p className="hint" style={{ margin: 0 }}>{t('chest_done')}</p>
        )}
        {loot && <LootList loot={loot} />}
      </div>
    </div>
  );
}
