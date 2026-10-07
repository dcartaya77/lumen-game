import { useEffect, useRef, useState } from 'react';
import { Game } from '@/game/Game';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { services } from '@/services/container';
import { gameBus, useRun } from '@/state/run';
import { runOptionsFor } from '@/state/runOptions';
import { useApp } from '@/state/store';
import { Hud } from '@/ui/run/Hud';
import { LevelUpOverlay } from '@/ui/run/LevelUpOverlay';
import { ResultsOverlay } from '@/ui/run/ResultsOverlay';
import { ReviveOverlay } from '@/ui/run/ReviveOverlay';

/** Aloja el canvas de PixiJS y superpone HUD y overlays. Remontar `runKey` reinicia la partida. */
export function RunScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const go = useApp((s) => s.go);
  const startRun = useApp((s) => s.startRun);
  const finishRun = useApp((s) => s.finishRun);
  const runMode = useApp((s) => s.runMode);
  const phase = useRun((s) => s.phase);
  const result = useRun((s) => s.result);
  const [runKey, setRunKey] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const game = new Game();
    void game.init(host, runOptionsFor(services().save.data, runMode, useApp.getState().runBoosts));
    tg.lockGestures(true);
    setPaused(false);
    return () => {
      tg.lockGestures(false);
      game.destroy();
      useRun.getState().reset();
    };
    // Las opciones se leen al arrancar la partida; cambiarlas aplica a la siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  // Botón atrás de Telegram: pausa en vez de salir de golpe (solo mientras se juega).
  useEffect(() => {
    tg.backButton.show(() => {
      if (useRun.getState().phase === 'playing') setPaused(true);
    });
    return () => tg.backButton.hide();
  }, []);

  // Pausa real del motor; durante nivel-up/fin el motor ya está detenido.
  useEffect(() => {
    gameBus.emit('pause', paused);
  }, [paused]);

  // Registrar el resultado una sola vez por partida.
  const recorded = useRef<object | null>(null);
  useEffect(() => {
    if (phase === 'ended' && result && recorded.current !== result) {
      recorded.current = result;
      finishRun(result);
    }
  }, [phase, result, finishRun]);

  return (
    <>
      <div ref={hostRef} className="canvas-host" />
      <Hud />
      {phase === 'playing' && !paused && (
        <button className="pause-btn" onClick={() => setPaused(true)} aria-label={t('paused')}>
          ❚❚
        </button>
      )}
      {paused && phase === 'playing' && (
        <div className="overlay">
          <div className="overlay-card">
            <h2 className="overlay-title">{t('paused')}</h2>
            {!tg.available && <p className="hint" style={{ textAlign: 'center' }}>{t('keyboard_hint')}</p>}
            <div className="stack" style={{ marginTop: 16 }}>
              <button className="btn btn-primary btn-block" onClick={() => setPaused(false)}>
                {t('resume')}
              </button>
              <button className="btn btn-danger btn-block" onClick={() => go('menu')}>
                {t('quit_run')}
              </button>
            </div>
          </div>
        </div>
      )}
      {phase === 'levelup' && <LevelUpOverlay />}
      {phase === 'dead' && <ReviveOverlay />}
      {phase === 'ended' && result && (
        <ResultsOverlay
          result={result}
          onContinue={() => go('menu')}
          onRetry={() => {
            startRun(runMode);
            setRunKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
