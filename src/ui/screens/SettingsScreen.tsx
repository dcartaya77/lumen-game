import { useEffect } from 'react';
import { t, type Lang } from '@/i18n';
import { tg } from '@/platform/telegram';
import { services } from '@/services/container';
import { useApp } from '@/state/store';

export function SettingsScreen() {
  const go = useApp((s) => s.go);
  const lang = useApp((s) => s.lang);
  const settings = useApp((s) => s.profile?.settings);
  const setLanguage = useApp((s) => s.setLanguage);
  const toggle = useApp((s) => s.toggleSetting);
  const reset = useApp((s) => s.resetProgress);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!settings) return null;
  const backends = services().save.activeBackends;

  const Toggle = ({ k, label }: { k: 'sound' | 'music' | 'haptics'; label: string }) => (
    <button className="row" onClick={() => toggle(k)}>
      <span>{label}</span>
      <strong style={{ color: settings[k] ? 'var(--tg-accent)' : 'var(--tg-hint)' }}>
        {settings[k] ? t('on') : t('off')}
      </strong>
    </button>
  );

  return (
    <div className="screen">
      <h2 style={{ margin: '8px 0 16px' }}>{t('settings')}</h2>
      <div className="stack">
        <div className="row">
          <span>{t('language')}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['es', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                className="btn"
                style={{
                  minHeight: 40,
                  padding: '0 14px',
                  background: lang === l ? 'var(--tg-button)' : 'transparent',
                  color: lang === l ? 'var(--tg-button-text)' : 'inherit',
                }}
                onClick={() => setLanguage(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Toggle k="sound" label={t('sound')} />
        <Toggle k="music" label={t('music')} />
        <Toggle k="haptics" label={t('haptics')} />

        <div className="row">
          <span>{t('save_backends')}</span>
          <span className="hint">
            {backends.map((b) => (b === 'cloud' ? t('save_cloud') : t('save_local'))).join(' + ')}
          </span>
        </div>
      </div>

      <div className="spacer" />

      <button
        className="btn btn-danger btn-block"
        onClick={async () => {
          const ok = tg.raw
            ? await new Promise<boolean>((r) => tg.raw!.showConfirm(t('reset_confirm'), r))
            : window.confirm(t('reset_confirm'));
          if (ok) {
            await reset();
            tg.haptic.notify('warning');
          }
        }}
      >
        {t('reset_save')}
      </button>
      {!tg.available && (
        <button className="btn btn-block" style={{ marginTop: 12 }} onClick={() => go('menu')}>
          {t('back')}
        </button>
      )}
    </div>
  );
}
