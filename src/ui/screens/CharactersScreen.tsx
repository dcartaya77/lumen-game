import { useEffect } from 'react';
import { CHARACTERS } from '@/data/characters';
import { WEAPON_BY_ID } from '@/data/weapons';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function CharactersScreen() {
  const go = useApp((s) => s.go);
  const profile = useApp((s) => s.profile);
  const unlock = useApp((s) => s.unlockCharacter);
  const select = useApp((s) => s.selectCharacter);

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!profile) return null;

  return (
    <div className="screen">
      <ScreenHeader title={t('characters')} sparks={profile.sparks} />
      <div className="stack scrollable">
        {CHARACTERS.map((c) => {
          const owned = profile.unlocked.c.includes(c.id);
          const selected = profile.selected.c === c.id;
          const streakLocked = c.cost === 'streak';
          const affordable = !streakLocked && profile.sparks >= (c.cost as number);
          const weapon = WEAPON_BY_ID[c.weaponId];
          return (
            <div key={c.id} className={selected ? 'char-card selected' : 'char-card'} style={{ ['--c' as string]: hex(c.color) }}>
              <span className="upgrade-icon" />
              <span className="upgrade-body" style={{ flex: 1 }}>
                <span className="upgrade-name">
                  {t(c.nameKey)}
                  {selected && <span className="upgrade-tag">{t('selected_tag')}</span>}
                </span>
                <span className="upgrade-desc">{t(c.descKey)}</span>
                <span className="upgrade-desc">{weapon ? t(weapon.nameKey) : ''}</span>
              </span>
              {owned ? (
                !selected && (
                  <button className="btn" onClick={() => select(c.id)}>
                    {t('select')}
                  </button>
                )
              ) : streakLocked ? (
                <span className="hint">🔥 {t('unlock_streak')}</span>
              ) : (
                <button className="btn" disabled={!affordable} onClick={() => unlock(c.id)}>
                  <span className="spark-icon" /> {c.cost as number}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
