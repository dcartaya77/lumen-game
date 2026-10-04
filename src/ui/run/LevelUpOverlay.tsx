import { t } from '@/i18n';
import { gameBus, useRun } from '@/state/run';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function LevelUpOverlay() {
  const choices = useRun((s) => s.choices);
  const level = useRun((s) => s.hud.level);

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title">{t('level_up', { n: level })}</h2>
        <p className="hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>
          {t('choose_upgrade')}
        </p>
        <div className="stack">
          {choices.map((c) => (
            <button
              key={c.id}
              className="upgrade"
              style={{ ['--c' as string]: hex(c.color) }}
              onClick={() => gameBus.emit('choose', { id: c.id })}
            >
              <span className="upgrade-icon" />
              <span className="upgrade-body">
                <span className="upgrade-name">
                  {t(c.nameKey)}
                  <span className="upgrade-tag">
                    {c.level === 1 ? t('new_tag') : c.level === c.maxLevel ? t('max_tag') : `${t('level_short')} ${c.level}`}
                  </span>
                </span>
                <span className="upgrade-desc">{c.level === 1 ? t(c.descKey) : t(c.note)}</span>
                <span className="upgrade-pips">
                  {Array.from({ length: c.maxLevel }, (_, i) => (
                    <i key={i} className={i < c.level ? 'on' : ''} />
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
