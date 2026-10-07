import { useEffect, useRef, useState } from 'react';
import { WHEEL, type Loot } from '@/data/loot';
import { t } from '@/i18n';
import { services } from '@/services/container';
import { spinWheel, wheelAdSpinsLeft } from '@/state/adActions';
import { useApp } from '@/state/store';
import { AdButton } from './AdButton';
import { LootList } from './ChestPanel';

const SEG = 360 / WHEEL.length;
const SPIN_MS = 3400;
const BACKGROUND = `conic-gradient(${WHEEL.map((s, i) => `${s.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(', ')})`;

/** Ruleta de la suerte: 1 giro gratis al día y hasta 3 con anuncio. El resultado ya está decidido al girar. */
export function WheelPanel() {
  const daily = useApp((s) => s.daily)!;
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [prize, setPrize] = useState<Loot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = wheelAdSpinsLeft(daily);
  const adsOn = services().ads.providerId !== 'none';

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const spin = (kind: 'free' | 'ad') => {
    if (spinning) return;
    const r = spinWheel(kind);
    if (!r) return;
    setPrize(null);
    setSpinning(true);
    // Sector `index` bajo el puntero (arriba): la rueda gira -(centro del sector) más vueltas completas.
    setRot((cur) => Math.ceil(cur / 360) * 360 + 360 * 5 - (r.index + 0.5) * SEG);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setPrize(r.prize);
    }, SPIN_MS + 100);
  };

  return (
    <div className="panel">
      <div className="panel-title">🎡 {t('wheel_title')}</div>
      <div className="wheel-wrap">
        <span className="wheel-pointer" />
        <div
          className="wheel"
          style={{
            background: BACKGROUND,
            transform: `rotate(${rot}deg)`,
            transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.1, 1)` : 'none',
          }}
        >
          {WHEEL.map((s, i) => (
            <span key={i} className="wheel-label" style={{ transform: `rotate(${(i + 0.5) * SEG}deg) translateY(-74px)` }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {prize && <LootList loot={prize} />}
        {daily.wheel.free && (
          <button className="btn btn-primary btn-block" disabled={spinning} onClick={() => spin('free')}>
            {t('wheel_free')}
          </button>
        )}
        {left > 0 && adsOn && (
          <div style={{ pointerEvents: spinning ? 'none' : undefined, opacity: spinning ? 0.5 : 1 }}>
            <AdButton placement="wheel" label={t('wheel_ad')} onReward={() => spin('ad')} />
            <p className="hint" style={{ margin: '6px 0 0', textAlign: 'center' }}>{t('wheel_left', { n: left })}</p>
          </div>
        )}
        {!daily.wheel.free && (left === 0 || !adsOn) && <p className="hint" style={{ margin: 0 }}>{t('wheel_none')}</p>}
      </div>
    </div>
  );
}
