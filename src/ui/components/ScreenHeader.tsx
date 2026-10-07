import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp, type Screen } from '@/state/store';

interface Props {
  title: string;
  sparks?: number;
  /** Pantalla a la que vuelve la flecha (fuera de Telegram; dentro se usa el BackButton nativo). */
  back?: Screen;
}

export function ScreenHeader({ title, sparks, back = 'menu' }: Props) {
  const go = useApp((s) => s.go);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
      {!tg.available && (
        <button className="back-btn" onClick={() => go(back)} aria-label={t('back')}>
          ←
        </button>
      )}
      <h2 style={{ margin: 0, flex: 1 }}>{title}</h2>
      {sparks !== undefined && (
        <span className="pill">
          <span className="spark-icon" />
          {sparks.toLocaleString()}
        </span>
      )}
    </div>
  );
}
