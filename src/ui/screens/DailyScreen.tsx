import { useEffect } from 'react';
import { dailyChallenge, weeklyEvent } from '@/data/events';
import { dailyMissions } from '@/data/missions';
import { MAP_BY_ID } from '@/data/maps';
import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { todayKey } from '@/state/save-schema';
import { useApp } from '@/state/store';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

export function DailyScreen() {
  const go = useApp((s) => s.go);
  const startRun = useApp((s) => s.startRun);
  const daily = useApp((s) => s.daily);
  const stats = useApp((s) => s.stats);
  const claimMission = useApp((s) => s.claimMission);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!daily || !stats) return null;

  const missions = dailyMissions(todayKey());
  const challenge = dailyChallenge();
  const weekly = weeklyEvent();
  const streak = daily.streak;

  return (
    <div className="screen">
      <ScreenHeader title={t('today')} />
      <div className="stack scrollable">
        {/* Racha */}
        <div className="panel">
          <div className="panel-title">🔥 {t('streak')}</div>
          <div className="streak-dots">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={i < Math.min(7, streak.n) ? 'on' : ''}>{i === 6 ? '★' : ''}</i>
            ))}
          </div>
          <p className="hint">{t('streak_hint')}</p>
        </div>

        {/* Misiones */}
        <div className="panel">
          <div className="panel-title">{t('missions')}</div>
          <div className="stack" style={{ gap: 8 }}>
            {missions.map((def) => {
              const m = daily.missions.find((x) => x.id === def.id) ?? { id: def.id, p: 0, done: false };
              const pct = Math.min(100, Math.round((m.p / def.target) * 100));
              return (
                <div key={def.id} className="mission">
                  <div className="mission-info">
                    <span className={m.done ? 'mission-desc done' : 'mission-desc'}>{t(def.descKey)}</span>
                    <span className="mission-bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                  {m.done ? (
                    <span className="mission-check">✓</span>
                  ) : m.p >= def.target ? (
                    <button className="btn mission-claim" onClick={() => claimMission(def.id)}>
                      +{def.reward}
                    </button>
                  ) : (
                    <span className="hint">{m.p}/{def.target}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Reto diario */}
        <div className="panel">
          <div className="panel-title">⚔ {t('daily_challenge')}</div>
          <p className="mission-desc">
            {t('challenge_desc', {
              map: t(MAP_BY_ID[challenge.mapId]?.nameKey ?? 'map_forest'),
              mod: t(challenge.modifier.nameKey),
            })}
          </p>
          <p className="hint">
            {t('challenge_goal', { t: formatTime(challenge.targetTime) })} · +{challenge.reward} {t('sparks').toLowerCase()}
            {daily.challenge.best > 0 && ` · ${t('challenge_best')}: ${formatTime(daily.challenge.best)}`}
          </p>
          {daily.challenge.done ? (
            <p className="mission-check" style={{ textAlign: 'center' }}>✓ {t('challenge_done')}</p>
          ) : (
            <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={() => startRun('challenge')}>
              {t('challenge_play')}
            </button>
          )}
        </div>

        {/* Evento semanal */}
        <div className="panel">
          <div className="panel-title">☄ {t('weekly_event')}</div>
          <p className="mission-desc">{t(weekly.nameKey)}</p>
          <p className="hint">
            {t(weekly.descKey)} · +{Math.round((weekly.sparkBonus - 1) * 100)}% {t('sparks').toLowerCase()}
          </p>
          <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => startRun('weekly')}>
            {t('event_play')}
          </button>
        </div>

        {/* Récords */}
        <div className="panel">
          <div className="panel-title">🏆 {t('records')}</div>
          <div className="row" style={{ minHeight: 44 }}>
            <span className="hint">{t('best_time')}</span>
            <strong>{formatTime(stats.bestTime)}</strong>
          </div>
          <div className="row" style={{ minHeight: 44, marginTop: 6 }}>
            <span className="hint">{t('best_kills')}</span>
            <strong>{stats.bestKills}</strong>
          </div>
          <div className="row" style={{ minHeight: 44, marginTop: 6 }}>
            <span className="hint">{t('runs_wins')}</span>
            <strong>
              {stats.runs} / {stats.wins}
            </strong>
          </div>
          {stats.bestRun && (
            <button
              className="btn btn-block"
              style={{ marginTop: 10 }}
              onClick={() =>
                tg.share(
                  tg.appLink(),
                  t('share_text', { t: formatTime(stats.bestRun!.t), k: stats.bestRun!.k }),
                )
              }
            >
              {t('share_challenge')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

