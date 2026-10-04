import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { useRun } from '@/state/run';

export function Hud() {
  const hud = useRun((s) => s.hud);
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
        <div className="hud-time">{formatTime(hud.time)}</div>
        <div className="hud-kills">
          <span className="hud-skull" /> {hud.kills}
        </div>
      </div>
      {import.meta.env.DEV && <div className="hud-fps">{hud.fps} fps</div>}
    </div>
  );
}
