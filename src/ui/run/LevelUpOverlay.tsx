import { t } from '@/i18n';
import { gameBus, useRun } from '@/state/run';
import { AdButton } from '@/ui/components/AdButton';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function LevelUpOverlay() {
  const choices = useRun((s) => s.choices);
  const level = useRun((s) => s.hud.level);
  const rerolls = useRun((s) => s.rerolls);
  const guided = useRun((s) => s.tutorial);

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title">{t('level_up', { n: level })}</h2>
        <p className="hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>
          {t('choose_upgrade')}
        </p>
        <div className="stack">
          {choices.map((c, i) => (
            <button
              key={c.id}
              className={[c.kind === 'evolution' ? 'upgrade upgrade-evo' : 'upgrade', guided && i === 0 ? 'upgrade-guided' : '']
                .filter(Boolean)
                .join(' ')}
              style={{ ['--c' as string]: hex(c.color) }}
              onClick={() => gameBus.emit('choose', { id: c.id })}
            >
              {guided && i === 0 && <span className="tut-tap">👆</span>}
              <span className="upgrade-icon" />
              <span className="upgrade-body">
                <span className="upgrade-name">
                  {t(c.nameKey)}
                  <span className="upgrade-tag">
                    {c.kind === 'evolution'
                      ? t('lv_evolve')
                      : c.level === 1
                        ? t('new_tag')
                        : c.level === c.maxLevel
                          ? t('max_tag')
                          : `${t('level_short')} ${c.level}`}
                  </span>
                </span>
                <span className="upgrade-desc">{c.level === 1 || c.kind === 'passive' ? t(c.descKey) : t(c.note)}</span>
                {c.kind !== 'evolution' && (
                  <span className="upgrade-pips">
                    {Array.from({ length: c.maxLevel }, (_, i) => (
                      <i key={i} className={i < c.level ? 'on' : ''} />
                    ))}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        {guided ? null : rerolls.free > 0 ? (
          <button className="btn btn-block reroll-btn" onClick={() => gameBus.emit('reroll', { via: 'free' })}>
            🎲 {t('reroll_free')}
          </button>
        ) : (
          rerolls.ads > 0 && (
            <AdButton
              placement="reroll"
              className="btn btn-block reroll-btn"
              label={t('reroll')}
              onReward={() => gameBus.emit('reroll', { via: 'ad' })}
            />
          )
        )}
      </div>
    </div>
  );
}
