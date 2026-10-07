import { PASSIVE_BY_ID } from '@/data/passives';
import { WEAPON_BY_ID } from '@/data/weapons';
import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { useRun } from '@/state/run';
import { useApp } from '@/state/store';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function Hud() {
  const hud = useRun((s) => s.hud);
  const build = useRun((s) => s.build);
  const night = useApp((s) => s.runCampaign?.night ?? null);
  const xpPct = Math.min(100, (hud.xp / hud.xpNext) * 100);
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);

  return (
    <div className="hud">
      <div className="hud-xp">
        <div className="hud-xp-fill" style={{ width: `${xpPct}%` }} />
        <span className="hud-level">
          {t('level_short')} {hud.level}
        </span>
      </div>
      <div className="hud-row">
        <div className="hud-hp">
          <div className="hud-hp-fill" style={{ width: `${hpPct}%` }} />
          <span>
            {hud.hp}/{hud.maxHp}
          </span>
        </div>
        <div className="hud-time">
          {formatTime(hud.time)}
          {night !== null && <small className="hud-night">{t('campaign_night', { n: night })}</small>}
        </div>
        <div className="hud-kills">
          <span className="hud-skull" /> {hud.kills}
        </div>
      </div>
      <div className="hud-build">
        {Object.entries(build.weapons).map(([id, lv]) => (
          <span key={id} className="hud-chip" style={{ ['--c' as string]: hex(WEAPON_BY_ID[id]?.color ?? 0xffffff) }}>
            {WEAPON_BY_ID[id]?.evolved ? '★' : lv}
          </span>
        ))}
        {Object.entries(build.passives).map(([id, lv]) => (
          <span
            key={id}
            className="hud-chip hud-chip-passive"
            style={{ ['--c' as string]: hex(PASSIVE_BY_ID[id]?.color ?? 0xffffff) }}
          >
            {lv}
          </span>
        ))}
      </div>
      {hud.boss && (
        <div className="hud-boss">
          <span className="hud-boss-name">{t('boss_name')}</span>
          <div className="hud-boss-bar">
            <div className="hud-boss-fill" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
          </div>
        </div>
      )}
      {import.meta.env.DEV && <div className="hud-fps">{hud.fps} fps</div>}
    </div>
  );
}
