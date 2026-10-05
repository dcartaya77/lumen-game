import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import type { RunResult } from '@/state/run';

interface Props {
  result: RunResult;
  onContinue(): void;
  onRetry(): void;
}

export function ResultsOverlay({ result, onContinue, onRetry }: Props) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title" style={{ color: result.won ? 'var(--lumen-flame-soft)' : 'var(--tg-hint)' }}>
          {result.won ? t('victory') : t('defeat')}
        </h2>
        <div className="stack" style={{ margin: '16px 0' }}>
          <div className="row">
            <span>{t('time_survived')}</span>
            <strong>{formatTime(result.time)}</strong>
          </div>
          <div className="row">
            <span>{t('enemies_defeated')}</span>
            <strong>{result.kills}</strong>
          </div>
          <div className="row">
            <span>{t('level_reached')}</span>
            <strong>{result.level}</strong>
          </div>
          {result.bossKilled && (
            <div className="row" style={{ color: '#ff2e5b' }}>
              <span>{t('boss_defeated')}</span>
              <strong>★</strong>
            </div>
          )}
          <div className="row" style={{ background: 'rgba(255,166,64,0.12)' }}>
            <span>{t('sparks_earned')}</span>
            <strong className="pill">
              <span className="spark-icon" />+{result.sparks}
            </strong>
          </div>
        </div>
        <div className="stack">
          <button className="btn btn-primary btn-block" onClick={onRetry}>
            {t('retry')}
          </button>
          <button className="btn btn-block" onClick={onContinue}>
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
