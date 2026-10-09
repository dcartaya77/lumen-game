import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN_NIGHTS } from '@/data/campaign';
import type { Game } from '@/game/Game';
import { t } from '@/i18n';
import { tg } from '@/platform/telegram';
import { services } from '@/services/container';
import { gameBus, useRun } from '@/state/run';
import { runOptionsFor } from '@/state/runOptions';
import { useApp } from '@/state/store';
import { Hud } from '@/ui/run/Hud';
import { DebugBar } from '@/ui/run/DebugBar';
import { DashButton } from '@/ui/run/DashButton';
import { ChestOverlay } from '@/ui/run/ChestOverlay';
import { GiftOverlay } from '@/ui/run/GiftOverlay';
import { LevelUpOverlay } from '@/ui/run/LevelUpOverlay';
import { ResultsOverlay } from '@/ui/run/ResultsOverlay';
import { ReviveOverlay } from '@/ui/run/ReviveOverlay';
import { Tutorial } from '@/ui/run/Tutorial';
import { TalismanBar } from '@/ui/run/TalismanBar';

/** Aloja el canvas de PixiJS y superpone HUD y overlays. Remontar `runKey` reinicia la partida. */
export function RunScreen() {
  const hostRef = useRef<HTMLDivElement>(null);
  const go = useApp((s) => s.go);
  const startRun = useApp((s) => s.startRun);
  const beginNight = useApp((s) => s.beginNight);
  const finishRun = useApp((s) => s.finishRun);
  const completeTutorial = useApp((s) => s.completeTutorial);
  const toggleSetting = useApp((s) => s.toggleSetting);
  const settings = useApp((s) => s.profile?.settings);
  const runMode = useApp((s) => s.runMode);
  const runCampaign = useApp((s) => s.runCampaign);
  const debug = useApp((s) => s.debug);
  const campaignNext = useApp((s) => s.campaign?.next ?? 1);
  const phase = useRun((s) => s.phase);
  const result = useRun((s) => s.result);
  const tutDone = useRun((s) => s.tutDone);
  const [runKey, setRunKey] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let game: Game | null = null;
    let cancelled = false;
    // PixiJS va en su propio chunk: se descarga al empezar (o ya precargado desde el menú).
    void import('@/game/Game').then(({ Game: GameClass }) => {
      if (cancelled) return;
      game = new GameClass();
      const { runBoosts, runCampaign: camp } = useApp.getState();
      void game.init(host, runOptionsFor(services().save.data, runMode, runBoosts, camp));
    });
    tg.lockGestures(true);
    setPaused(false);
    return () => {
      cancelled = true;
      tg.lockGestures(false);
      game?.destroy();
      useRun.getState().reset();
    };
    // Las opciones se leen al arrancar la partida; cambiarlas aplica a la siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  useEffect(() => {
    if (tutDone) completeTutorial();
  }, [tutDone, completeTutorial]);

  useEffect(() => {
    if (settings) gameBus.emit('audio', { sound: settings.sound, music: settings.music });
  }, [settings?.sound, settings?.music]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Teclado (escritorio): 1 y 2 usan los talismanes equipados.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === '1' || e.key === '2') gameBus.emit('useTalisman', { slot: Number(e.key) - 1 });
      else if (e.code === 'Space' || e.code === 'ShiftLeft') {
        e.preventDefault();
        gameBus.emit('dash', undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
      {phase === 'idle' && <span className="run-loading spark-icon" />}
      <Hud />
      <Tutorial />
      {debug && phase === 'playing' && !paused && <DebugBar />}
      {phase === 'playing' && !paused && <TalismanBar />}
      {phase === 'playing' && !paused && <DashButton />}
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
            {settings && (
              <div className="audio-row">
                <button
                  className={settings.sound ? 'btn' : 'btn off'}
                  onClick={() => toggleSetting('sound')}
                  aria-label={t('sound')}
                >
                  {settings.sound ? '🔊' : '🔇'}
                </button>
                <button
                  className={settings.music ? 'btn' : 'btn off'}
                  onClick={() => toggleSetting('music')}
                  aria-label={t('music')}
                >
                  🎵
                </button>
              </div>
            )}
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
      {phase === 'gift' && <GiftOverlay />}
      {phase === 'chest' && <ChestOverlay />}
      {phase === 'dead' && <ReviveOverlay />}
      {phase === 'ended' && result && (
        <ResultsOverlay
          result={result}
          onContinue={() => go(runMode === 'campaign' ? 'campaign' : 'menu')}
          onRetry={() => {
            if (runMode === 'campaign' && runCampaign) beginNight(runCampaign.night);
            else startRun(runMode);
            setRunKey((k) => k + 1);
          }}
          {...(result.won && runCampaign && runCampaign.night < CAMPAIGN_NIGHTS && campaignNext > runCampaign.night
            ? {
                onNext: () => {
                  beginNight(runCampaign.night + 1);
                  setRunKey((k) => k + 1);
                },
              }
            : {})}
          {...(result.won && result.duel?.won && runCampaign?.night === CAMPAIGN_NIGHTS ? { onEnding: () => go('ending') } : {})}
        />
      )}
    </>
  );
}
