import { parseTalismanKey, talismanColor } from '@/data/talismans';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { gameBus, useRun } from '@/state/run';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Botones de los talismanes equipados (abajo a la derecha). Cada uno se usa una vez por noche. */
export function TalismanBar() {
  const tal = useRun((s) => s.tal);
  if (tal.length === 0) return null;
  return (
    <div className="tal-bar">
      {tal.map((s, slot) => {
        const p = parseTalismanKey(s.key);
        if (!p) return null;
        return (
          <button
            key={s.key}
            className={s.used ? 'tal-btn used' : 'tal-btn'}
            style={{ ['--rc' as string]: hex(talismanColor(p.rarity)) }}
            disabled={s.used}
            aria-label={t(p.def.nameKey)}
            onClick={() => gameBus.emit('useTalisman', { slot })}
          >
            {p.def.icon}
            {!tg.available && <i>{slot + 1}</i>}
          </button>
        );
      })}
    </div>
  );
}
