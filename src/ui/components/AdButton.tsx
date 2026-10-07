import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import type { AdPlacement } from '@/services/types';
import { adAvailability, runAd, trackOffer } from '@/state/adActions';
import { useApp } from '@/state/store';

interface Props {
  placement: AdPlacement;
  label: string;
  /** Se llama SOLO si el SDK confirmó que el anuncio se vio completo. */
  onReward(): void;
  className?: string;
  onBusyChange?(busy: boolean): void;
}

/**
 * Botón de anuncio opcional. Nunca queda "roto": sin proveedor no se muestra;
 * si hay que esperar (separación mínima, SDK cargando) o se alcanzó el tope diario, lo explica.
 */
export function AdButton({ placement, label, onReward, className = 'btn btn-block', onBusyChange }: Props) {
  useApp((s) => s.ads);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const a = adAvailability(placement);
  const ready = a.state === 'ready';

  useEffect(() => {
    if (ready) trackOffer(placement);
  }, [ready, placement]);

  useEffect(() => {
    if (ready || a.state === 'cap' || a.state === 'hidden') return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [ready, a.state]);

  if (a.state === 'hidden') return null;
  if (a.state === 'cap') return <p className="hint ad-note">{t('ad_cap')}</p>;

  const note =
    a.state === 'wait' ? t('ad_cooldown', { s: Math.ceil(a.waitMs / 1000) }) : a.state === 'later' ? t('ad_later') : null;

  const click = async () => {
    if (busy) return;
    setBusy(true);
    onBusyChange?.(true);
    try {
      if (await runAd(placement)) onReward();
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  return (
    <button className={`${className} ad-btn`} disabled={!ready || busy} onClick={click}>
      <span className="ad-play">▶</span>
      <span className="ad-label">
        {label}
        {note && <small>{note}</small>}
      </span>
    </button>
  );
}
