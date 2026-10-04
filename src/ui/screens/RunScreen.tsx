import { useEffect, useRef } from 'react';
import { Game } from '@/game/Game';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { useApp } from '@/state/store';

/** Aloja el canvas de PixiJS. La UI de partida (HUD, level-up) se superpone en React. */
export function RunScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const go = useApp((s) => s.go);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new Game();
    void game.init(host);
    tg.lockGestures(true);
    const leave = () => go('menu');
    tg.backButton.show(leave);
    return () => {
      tg.backButton.hide();
      tg.lockGestures(false);
      game.destroy();
    };
  }, [go]);

  return (
    <>
      <div ref={hostRef} className="canvas-host" />
      <div className="overlay-top">
        {!tg.available ? (
          <button className="btn" onClick={() => go('menu')}>
            ← {t('back')}
          </button>
        ) : (
          <span />
        )}
        <span className="hint" style={{ textAlign: 'right', maxWidth: '60%' }}>
          {t('run_placeholder')}
        </span>
      </div>
    </>
  );
}
