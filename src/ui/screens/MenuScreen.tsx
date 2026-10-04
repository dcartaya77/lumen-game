import { useEffect } from 'react';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';

export function MenuScreen() {
  const go = useApp((s) => s.go);
  const sparks = useApp((s) => s.profile?.sparks ?? 0);
  const addSparks = useApp((s) => s.addSparks);

  useEffect(() => tg.backButton.hide(), []);

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="pill">
          <span className="spark-icon" />
          {sparks.toLocaleString()}
        </span>
        <button className="btn" onClick={() => go('settings')} aria-label={t('settings')}>
          ⚙
        </button>
      </div>

      <div className="spacer" />
      <h1 className="title">{t('app_title')}</h1>
      <p className="tagline">{t('app_tagline')}</p>
      <div className="spacer" />

      <div className="stack">
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            tg.haptic.impact('medium');
            go('run');
          }}
        >
          {t('play')}
        </button>
        {import.meta.env.DEV && (
          <button className="btn btn-block" onClick={() => addSparks(25)}>
            +25 {t('sparks')} <span className="hint">({t('dev_only')})</span>
          </button>
        )}
      </div>
    </div>
  );
}
