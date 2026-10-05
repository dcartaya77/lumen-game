import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '@/data/achievements';
import { CHARACTERS } from '@/data/characters';
import { ENEMIES } from '@/data/enemies';
import { WEAPONS } from '@/data/weapons';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';
import { ScreenHeader } from '@/ui/components/ScreenHeader';

type Tab = 'weapons' | 'enemies' | 'characters';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function CollectionScreen() {
  const go = useApp((s) => s.go);
  const stats = useApp((s) => s.stats);
  const profile = useApp((s) => s.profile);
  const [tab, setTab] = useState<Tab>('weapons');

  useEffect(() => {
    tg.backButton.show(() => go('menu'));
    return () => tg.backButton.hide();
  }, [go]);

  if (!stats || !profile) return null;

  const sections: Record<Tab, { id: string; nameKey: Parameters<typeof t>[0]; color: number; got: boolean }[]> = {
    weapons: WEAPONS.map((w) => ({
      id: w.id,
      nameKey: w.nameKey,
      color: w.color,
      got: w.evolved ? stats.seen.ev.includes(w.id) : stats.seen.w.includes(w.id),
    })),
    enemies: ENEMIES.map((e) => ({ id: e.id, nameKey: e.nameKey, color: e.eyeColor, got: stats.seen.e.includes(e.id) })),
    characters: CHARACTERS.map((c) => ({ id: c.id, nameKey: c.nameKey, color: c.color, got: profile.unlocked.c.includes(c.id) })),
  };
  const items = sections[tab];
  const totalWeapons = sections.weapons.filter((i) => i.got).length;
  const totalEnemies = sections.enemies.filter((i) => i.got).length;
  const totalChars = sections.characters.filter((i) => i.got).length;
  const totalPct = Math.round(
    ((totalWeapons + totalEnemies + totalChars + stats.ach.length) /
      (WEAPONS.length + ENEMIES.length + CHARACTERS.length + ACHIEVEMENTS.length)) *
      100,
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('collection')} />
      <p className="hint">
        {t('completion', { n: totalPct })} · {stats.ach.length}/{ACHIEVEMENTS.length} {t('achievements').toLowerCase()}
      </p>
      <div className="tabs">
        {(['weapons', 'enemies', 'characters'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>
            {sections[k].filter((i) => i.got).length}/{sections[k].length} {t(`tab_${k}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
      <div className="collection-grid scrollable">
        {items.map((item) => (
          <div key={item.id} className={item.got ? 'cell got' : 'cell'}>
            <span className="cell-dot" style={{ background: item.got ? hex(item.color) : undefined }} />
            <span className="cell-name">{item.got ? t(item.nameKey) : '???'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
