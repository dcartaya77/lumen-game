import { t } from '@/i18n';
import { services } from '@/services/container';
import { canRepairStreak, repairStreak } from '@/state/adActions';
import { useApp } from '@/state/store';
import { AdButton } from './AdButton';

/** Oferta de reparar la racha rota (una vez por semana, con anuncio). */
export function StreakRepair() {
  const daily = useApp((s) => s.daily);
  if (!daily || !canRepairStreak(daily) || services().ads.providerId === 'none') return null;
  return (
    <div className="panel repair-panel">
      <div className="panel-title">💔 {t('streak_broken', { n: daily.streak.n })}</div>
      <AdButton placement="streak_repair" label={t('streak_repair')} onReward={() => repairStreak()} />
      <p className="hint" style={{ margin: '6px 0 0' }}>{t('streak_repair_hint')}</p>
    </div>
  );
}
