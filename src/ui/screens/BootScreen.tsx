import { useEffect } from 'react';
import { t } from '@/i18n';
import { useApp } from '@/state/store';

export function BootScreen() {
  const boot = useApp((s) => s.boot);
  const error = useApp((s) => s.bootError);

  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <h1 className="title">{t('app_title')}</h1>
      <p className="tagline">{error ? error : t('loading')}</p>
    </div>
  );
}
