import { BOSS } from '@/data/bosses';
import { RARITY_COLORS, RARITY_KEYS } from '@/data/minibosses';
import { PASSIVE_BY_ID } from '@/data/passives';
import { WEAPON_BY_ID } from '@/data/weapons';
import { formatTime } from '@/game/core/math';
import { t } from '@/i18n';
import { useRun } from '@/state/run';
import { useApp } from '@/state/store';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Punto del borde de la pantalla donde la flecha apunta a `angle` (radianes desde el centro). */
function edgePoint(angle: number): { x: number; y: number } {
  const margin = 34;
  const hw = window.innerWidth / 2 - margin;
  const hh = window.innerHeight / 2 - margin;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = Math.min(Math.abs(c) < 1e-3 ? Infinity : hw / Math.abs(c), Math.abs(s) < 1e-3 ? Infinity : hh / Math.abs(s));
  return { x: c * r, y: s * r };
}

export function Hud() {
  const hud = useRun((s) => s.hud);
  const build = useRun((s) => s.build);
  const notice = useRun((s) => s.notice);
  const night = useApp((s) => s.runCampaign?.night ?? null);
  const debug = useApp((s) => s.debug);
  const xpPct = Math.min(100, (hud.xp / hud.xpNext) * 100);
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100);
  const mini = hud.mini;
  const arrow = mini?.off ? edgePoint(mini.angle) : null;

  return (
    <>
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
        <div className={hud.boss.exposed ? 'hud-boss exposed' : 'hud-boss'}>
          <span className="hud-boss-name">
            {t(hud.boss.nameKey)}
            {hud.boss.phase > 0 && <small> · {t('boss_phase_short', { n: hud.boss.phase })}</small>}
          </span>
          <div className="hud-boss-bar">
            <div className="hud-boss-fill" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
            {hud.boss.phase > 0 &&
              BOSS.types.devourer.thresholds.map((th) => <i key={th} className="hud-boss-tick" style={{ left: `${th * 100}%` }} />)}
          </div>
          {hud.boss.exposed && <span className="hud-boss-open">{t('boss_exposed')}</span>}
          {hud.boss.maxStacks > 0 && (
            <div className="hud-boss-stacks" aria-label={t('boss_stacks')}>
              {Array.from({ length: hud.boss.maxStacks }, (_, i) => (
                <i key={i} className={i < hud.boss!.stacks ? 'on' : ''} />
              ))}
            </div>
          )}
        </div>
      )}
      {mini && (
        <div className="hud-mini" style={{ ['--c' as string]: hex(RARITY_COLORS[mini.rarity]!) }}>
          <div className="hud-mini-top">
            <span className="hud-mini-name">
              {t(mini.nameKey)} · {t(RARITY_KEYS[mini.rarity])}
            </span>
            <span>{Math.ceil(mini.timeLeft)}s</span>
          </div>
          <div className="hud-boss-bar">
            <div className="hud-mini-fill" style={{ width: `${(mini.hp / mini.maxHp) * 100}%` }} />
          </div>
        </div>
      )}
      {debug && (
        <div className="hud-fps">
          {hud.fps} fps · dps {hud.dps}
          {hud.duel && (
            <>
              <br />
              duelo: dps {hud.duel.dps} → jefe {hud.duel.bossDps} → hp {hud.duel.hp} · {hud.duel.time}s
            </>
          )}
        </div>
      )}
    </div>
    {arrow && mini && (
      <div
        className="mini-arrow"
        aria-hidden
        style={{
          ['--c' as string]: hex(RARITY_COLORS[mini.rarity]!),
          transform: `translate(-50%, -50%) translate(${arrow.x}px, ${arrow.y}px) rotate(${mini.angle}rad)`,
        }}
      >
        <i />
      </div>
    )}
    {notice && (
      <div key={notice.id} className="hud-notice" style={{ color: hex(notice.color) }}>
        {notice.text}
      </div>
    )}
    </>
  );
}
