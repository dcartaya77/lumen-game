import { useEffect } from 'react';
import { META_UPGRADES } from '@/data/meta';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function ShopScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const buy = useApp((s) => s.buyUpgrade);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!profile) return null;

  return (
    <div className="screen">
      <ScreenHeader title={t('shop')} sparks={profile.sparks} />
      <div className="stack scrollable">
        {META_UPGRADES.map((u) => {
          const level = profile.upgrades[u.id] ?? 0;
          const max = level >= u.maxLevel;
          const cost = max ? 0 : u.cost[level]!;
          const afford = profile.sparks >= cost;
          return (
            <button
              key={u.id}
              className="shop-item"
              style={{ ['--c' as string]: hex(u.color) }}
              disabled={max || !afford}
              onClick={() => buy(u.id)}
            >
              <span className="upgrade-icon" />
              <span className="upgrade-body" style={{ flex: 1 }}>
                <span className="upgrade-name">{t(u.nameKey)}</span>
                <span className="upgrade-desc">{t(u.descKey)}</span>
                <span className="upgrade-pips">
                  {Array.from({ length: u.maxLevel }, (_, i) => (
                    <i key={i} className={i < level ? 'on' : ''} />
                  ))}
                </span>
              </span>
              <span className={max ? 'shop-price max' : 'shop-price'}>
                {max ? t('max_tag') : (
                  <>
                    <span className="spark-icon" />
                    {cost}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
