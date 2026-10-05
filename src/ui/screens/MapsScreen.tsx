import { useEffect } from 'react';
import { MAPS } from '@/data/maps';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function MapsScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const unlock = useApp((s) => s.unlockMap);
  const select = useApp((s) => s.selectMap);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!profile) return null;

  return (
    <div className="screen">
      <ScreenHeader title={t('maps')} sparks={profile.sparks} />
      <div className="stack scrollable">
        {MAPS.map((m) => {
          const owned = profile.unlocked.m.includes(m.id);
          const selected = profile.selected.m === m.id;
          const affordable = profile.sparks >= m.cost;
          return (
            <div key={m.id} className={selected ? 'char-card selected' : 'char-card'} style={{ ['--c' as string]: hex(m.glow) }}>
              <span className="map-preview" style={{ background: hex(m.ground) }}>
                <i style={{ background: hex(m.motes) }} />
                <i style={{ background: hex(m.motes) }} />
                <i style={{ background: hex(m.motes) }} />
              </span>
              <span className="upgrade-body" style={{ flex: 1 }}>
                <span className="upgrade-name">
                  {t(m.nameKey)}
                  {selected && <span className="upgrade-tag">{t('selected_tag')}</span>}
                </span>
                <span className="upgrade-desc">{t(m.descKey)}</span>
                {m.sparkBonus > 1 && <span className="upgrade-desc">+{Math.round((m.sparkBonus - 1) * 100)}% {t('sparks').toLowerCase()}</span>}
              </span>
              {owned ? (
                !selected && (
                  <button className="btn" onClick={() => select(m.id)}>
                    {t('select')}
                  </button>
                )
              ) : (
                <button className="btn" disabled={!affordable} onClick={() => unlock(m.id)}>
                  <span className="spark-icon" /> {m.cost}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
