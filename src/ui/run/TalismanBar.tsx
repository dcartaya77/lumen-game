import { createPressGuard } from '@/game/core/PressGuard';
import { parseTalismanKey, talismanColor } from '@/data/talismans';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { gameBus, useRun } from '@/state/run';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Un solo bloqueo para ambos botones: un gesto nunca gasta dos talismanes. */
const guard = createPressGuard(300);

/** Botones de los talismanes equipados (abajo a la derecha). Cada uno se usa una vez por noche. */
export function TalismanBar() {
  const tal = useRun((s) => s.tal);
  const dash = useRun((s) => s.hud.dash.on);
  if (tal.length === 0) return null;
  return (
    <div className={dash ? 'tal-bar up' : 'tal-bar'}>
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
            // Solo pointerdown: el click emulado que sigue a un toque no hace nada.
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (guard.accept()) gameBus.emit('useTalisman', { slot });
            }}
            onClick={(e) => e.preventDefault()}
          >
            {p.def.icon}
            {!tg.available && <i>{slot + 1}</i>}
          </button>
        );
      })}
    </div>
  );
}
