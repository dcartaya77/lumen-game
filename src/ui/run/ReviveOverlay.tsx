import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { adAvailability } from '@/state/adActions';
import { canAutoOffer, markAutoOffer } from '@/services/ads/AdPolicy';
import { gameBus, useRun } from '@/state/run';
import { AdButton } from '@/ui/components/AdButton';

const SECONDS = 5;

/**
 * Oferta de revivir tras morir: cuenta atrás de 5 s que se congela mientras se ve el anuncio.
 * En el duelo contra un jefe es otro anuncio (una vez por duelo) y no depende de la separación entre ofertas automáticas.
 */
export function ReviveOverlay() {
  const boss = useRun((s) => s.reviveKind) === 'boss';
  const placement = boss ? 'boss_revive' : 'revive';
  const [offer] = useState(() => adAvailability(placement).state === 'ready' && (boss || canAutoOffer()));
  const [left, setLeft] = useState(SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (offer) markAutoOffer();
    // Sin anuncio disponible no se enseña nada: la partida termina directamente.
    else gameBus.emit('giveup', undefined);
  }, [offer]);

  useEffect(() => {
    if (!offer || busy) return;
    if (left <= 0) {
      gameBus.emit('giveup', undefined);
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [offer, busy, left]);

  if (!offer) return null;

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title">{t('revive_title')}</h2>
        <div className="revive-ring" style={{ ['--p' as string]: left / SECONDS }}>
          <span>{left}</span>
        </div>
        <p className="hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>
          {t(boss ? 'revive_boss_desc' : 'revive_desc')}
        </p>
        <div className="stack">
          <AdButton
            placement={placement}
            className="btn btn-primary btn-block"
            label={t('revive_btn')}
            onBusyChange={setBusy}
            onReward={() => gameBus.emit('revive', undefined)}
          />
          <button className="btn btn-block" disabled={busy} onClick={() => gameBus.emit('giveup', undefined)}>
            {t('revive_decline')}
          </button>
        </div>
      </div>
    </div>
  );
}
