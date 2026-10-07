import { useEffect, useState, type CSSProperties } from 'react';
import { RARITY_KEYS } from '@/data/minibosses';
import { parseTalismanKey, talismanColor, talismanDescVars } from '@/data/talismans';
import { t } from '@/i18n';
import { markAutoOffer } from '@/services/ads/AdPolicy';
import { gameBus, useRun } from '@/state/run';
import { AdButton } from '@/ui/components/AdButton';
import { TalismanIcon } from '@/ui/components/TalismanIcon';

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

function Card({ talKey, onPick }: { talKey: string; onPick?: () => void }) {
  const p = parseTalismanKey(talKey);
  if (!p) return null;
  const style = { '--c': hex(talismanColor(p.rarity)) } as CSSProperties;
  const body = (
    <>
      <TalismanIcon talKey={talKey} />
      <span className="upgrade-body">
        <span className="upgrade-name">
          {t(p.def.nameKey)} · {t(RARITY_KEYS[p.rarity])}
        </span>
        <span className="upgrade-desc">{t(p.def.descKey, talismanDescVars(p.def.id, p.rarity))}</span>
      </span>
    </>
  );
  return onPick ? (
    <button className="upgrade" style={style} onClick={onPick}>
      {body}
    </button>
  ) : (
    <div className="upgrade static" style={style}>
      {body}
    </div>
  );
}

/** Cofre de minijefe: se recibe el talismán sorteado o, tras un anuncio opcional, se elige 1 de 3. */
export function ChestOverlay() {
  const chest = useRun((s) => s.chest);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    markAutoOffer();
  }, []);

  if (!chest) return null;
  const take = (key: string, viaAd: boolean) => gameBus.emit('chest', { key, viaAd });

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h2 className="overlay-title">{t('tal_chest_title')}</h2>
        {picking ? (
          <>
            <p className="hint" style={{ textAlign: 'center', margin: '0 0 14px' }}>
              {t('chest_pick_sub')}
            </p>
            <div className="stack">
              {chest.options.map((k) => (
                <Card key={k} talKey={k} onPick={() => take(k, true)} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="stack" style={{ marginBottom: 14 }}>
              <Card talKey={chest.key} />
            </div>
            <div className="stack">
              <AdButton
                placement="talisman_pick"
                className="btn btn-primary btn-block"
                label={t('chest_pick_btn')}
                onBusyChange={setBusy}
                onReward={() => setPicking(true)}
              />
              <button className="btn btn-block" disabled={busy} onClick={() => take(chest.key, false)}>
                {t('chest_keep')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
