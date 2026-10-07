import { useState } from 'react';
import { ACHIEVEMENTS } from '@/data/achievements';
import { RARITY_COLORS, RARITY_KEYS } from '@/data/minibosses';
import { equippedSkin } from '@/data/skins';
import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import type { RunResult } from '@/state/run';
import { useApp } from '@/state/store';
import { AdButton } from '@/ui/components/AdButton';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

interface Props {
  result: RunResult;
  onContinue(): void;
  onRetry(): void;
  /** Pasar a la siguiente noche de campaña (solo tras superar una). */
  onNext?: () => void;
}

export function ResultsOverlay({ result, onContinue, onRetry, onNext }: Props) {
  const lastAchievements = useApp((s) => s.lastAchievements);
  const lastCampaign = useApp((s) => s.lastCampaign);
  const profile = useApp((s) => s.profile);
  const addSparks = useApp((s) => s.addSparks);
  const [doubled, setDoubled] = useState(false);
  const names = lastAchievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter((a) => a !== undefined);
  const frame = profile ? (equippedSkin(profile, 'frame')?.visual.css ?? '') : '';
  const night = result.night;
  const title = result.won ? (night !== null ? t('night_cleared', { n: night }) : t('victory')) : t('defeat');

  return (
    <div className="overlay">
      <div className={`overlay-card ${frame}`}>
        <h2 className="overlay-title" style={{ color: result.won ? 'var(--lumen-flame-soft)' : 'var(--tg-hint)' }}>
          {title}
        </h2>
        {lastCampaign && (
          <p className="camp-stars" aria-label="stars">
            {'★'.repeat(lastCampaign.stars)}
            <i>{'★'.repeat(3 - lastCampaign.stars)}</i>
          </p>
        )}
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
          {result.challengeDone && (
            <div className="row" style={{ color: 'var(--lumen-flame-soft)' }}>
              <span>{t('challenge_done')}</span>
              <strong>✓</strong>
            </div>
          )}
          {result.chests.length > 0 && (
            <div className="row">
              <span>{t('chests_found')}</span>
              <strong style={{ display: 'flex', gap: 6 }}>
                {result.chests.map((r, i) => (
                  <span key={i} className="chest-dot" style={{ background: hex(RARITY_COLORS[r]!) }} title={t(RARITY_KEYS[r])} />
                ))}
              </strong>
            </div>
          )}
          {lastCampaign?.first && (
            <div className="row achievement-row">
              <span>{t('night_first_clear', { n: lastCampaign.bonus })}</span>
              <strong>★</strong>
            </div>
          )}
          {names.map((a) => (
            <div key={a.id} className="row achievement-row">
              <span>🏅 {t(a.nameKey)}</span>
              <strong>+{a.reward}</strong>
            </div>
          ))}
          <div className="row" style={{ background: 'rgba(255,166,64,0.12)' }}>
            <span>{t('sparks_earned')}</span>
            <strong className="pill">
              <span className="spark-icon" />+{doubled ? result.sparks * 2 : result.sparks}
            </strong>
          </div>
        </div>
        <div className="stack">
          {result.sparks > 0 &&
            (doubled ? (
              <p className="hint" style={{ margin: 0, textAlign: 'center', color: 'var(--lumen-flame-soft)' }}>
                ✓ {t('double_done')}
              </p>
            ) : (
              <AdButton
                placement="double_sparks"
                className="btn btn-block ad-double"
                label={t('double_sparks', { n: result.sparks })}
                onReward={() => {
                  setDoubled(true);
                  addSparks(result.sparks);
                }}
              />
            ))}
          {onNext && (
            <button className="btn btn-primary btn-block" onClick={onNext}>
              {t('night_next')}
            </button>
          )}
          <button className={onNext ? 'btn btn-block' : 'btn btn-primary btn-block'} onClick={onRetry}>
            {t('retry')}
          </button>
          <button
            className="btn btn-block"
            onClick={() => tg.share(tg.appLink(), t('share_text', { t: formatTime(result.time), k: result.kills }))}
          >
            {t('share_challenge')}
          </button>
          <button className="btn btn-block" onClick={onContinue}>
            {t('continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
