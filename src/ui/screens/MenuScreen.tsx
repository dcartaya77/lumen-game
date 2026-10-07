import { useEffect } from 'react';
import { dailyChallenge, weeklyEvent } from '@/data/events';
import { CHARACTERS } from '@/data/characters';
import { MAPS } from '@/data/maps';
import { SKIN_BY_ID } from '@/data/skins';
import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { armBoost } from '@/state/adActions';
import { refreshDaily, useApp } from '@/state/store';
import { AdButton } from '@/ui/components/AdButton';
import { NavButton } from '@/ui/components/NavButton';
import { StreakRepair } from '@/ui/components/StreakRepair';

export function MenuScreen() {
  const go = useApp((s) => s.go);
  const startRun = useApp((s) => s.startRun);
  const profile = useApp((s) => s.profile);
  const stats = useApp((s) => s.stats);
  const daily = useApp((s) => s.daily);
  const ads = useApp((s) => s.ads);
  const addSparks = useApp((s) => s.addSparks);
  const toggleMute = useApp((s) => s.toggleMute);
  const muted = !(profile?.settings.sound || profile?.settings.music);

  useEffect(() => {
    refreshDaily();
    tg.backButton.hide();
  }, []);

  const challenge = dailyChallenge();
  const weekly = weeklyEvent();
  const charName = CHARACTERS.find((c) => c.id === profile?.selected.c)?.nameKey ?? 'c_ember';
  const mapName = MAPS.find((m) => m.id === profile?.selected.m)?.nameKey ?? 'map_forest';
  const missionsLeft = daily?.missions.filter((m) => !m.done).length ?? 3;

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="pill">
          <span className="spark-icon" />
          {(profile?.sparks ?? 0).toLocaleString()}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={toggleMute} aria-label={t('sound')}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn" onClick={() => go('settings')} aria-label={t('settings')}>
            ⚙
          </button>
        </div>
      </div>

      <h1 className="title" style={{ fontSize: 44, marginTop: 8 }}>
        {t('app_title')}
      </h1>

      <button className="daily-card" onClick={() => go('daily')}>
        <div className="daily-card-row">
          <span className="daily-card-label">{t('streak')}</span>
          <span className="daily-card-value">🔥 {daily?.streak.n ?? 0}/7</span>
        </div>
        <div className="daily-card-row">
          <span className="daily-card-label">{t('daily_challenge')}</span>
          <span className="daily-card-value">
            {daily?.challenge.done ? '✓' : t('challenge_goal', { t: formatTime(challenge.targetTime) })}
          </span>
        </div>
        <div className="daily-card-row">
          <span className="daily-card-label">{t('missions')}</span>
          <span className="daily-card-value">{missionsLeft} {t('missions_left')}</span>
        </div>
      </button>

      <div className="weekly-banner">
        <span className="weekly-name">{t(weekly.nameKey)}</span>
        <span className="hint">{t(weekly.descKey)} · +{Math.round((weekly.sparkBonus - 1) * 100)}% {t('sparks').toLowerCase()}</span>
      </div>

      <div className="spacer" />

      <StreakRepair />

      <div className="stack">
        <div className="loadout">
          <span>{t(charName)} · {t(mapName)}</span>
        </div>
        {ads?.boost ? (
          <p className="ready-note">▲ {t('boost_ready')}</p>
        ) : (
          <AdButton placement="boost" className="btn btn-block btn-sm" label={t('boost_btn')} onReward={() => armBoost()} />
        )}
        {ads?.trial && SKIN_BY_ID[ads.trial] && (
          <p className="ready-note">★ {t('skin_trial_active', { name: t(SKIN_BY_ID[ads.trial]!.nameKey) })}</p>
        )}
        <button className="btn btn-primary btn-block" onClick={() => startRun('normal')}>
          {t('play')}
        </button>
        <div className="nav-grid">
          <NavButton screen="shop" label={t('shop')} icon="🛒" />
          <NavButton screen="characters" label={t('nav_heroes')} icon="✨" />
          <NavButton screen="skins" label={t('skins')} icon="🎨" />
          <NavButton screen="maps" label={t('maps')} icon="🗺" />
          <NavButton screen="collection" label={t('nav_collection')} icon="📖" />
        </div>
        {(stats?.bestTime ?? 0) > 0 && (
          <p className="hint" style={{ textAlign: 'center' }}>
            {t('best_time')}: {Math.floor(stats!.bestTime / 60)}:{String(Math.floor(stats!.bestTime % 60)).padStart(2, '0')}
          </p>
        )}
        {import.meta.env.DEV && (
          <button className="btn btn-block" onClick={() => addSparks(500)}>
            +500 {t('sparks')} <span className="hint">({t('dev_only')})</span>
          </button>
        )}
      </div>
    </div>
  );
}
