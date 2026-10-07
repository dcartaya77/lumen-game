import { createPressGuard } from '@/game/core/PressGuard';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { gameBus, useRun } from '@/state/run';

const guard = createPressGuard(300);

/** Dash del duelo contra el jefe: solo existe mientras dura el combate; el anillo muestra la recarga. */
export function DashButton() {
  const dash = useRun((s) => s.hud.dash);
  if (!dash.on) return null;
  const ready = dash.ready >= 1;
  return (
    <button
      className={ready ? 'dash-btn' : 'dash-btn cooling'}
      style={{ ['--p' as string]: dash.ready }}
      aria-label={t('dash')}
      // Solo pointerdown: el click emulado de un toque no repite la acción.
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (guard.accept()) gameBus.emit('dash', undefined);
      }}
      onClick={(e) => e.preventDefault()}
    >
      ⚡
      {!tg.available && <i>␣</i>}
    </button>
  );
}
