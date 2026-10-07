import { useState } from 'react';
import { MINI_TYPES, RARITY_KEYS, type TalismanRarity } from '@/data/minibosses';
import { t } from '@/i18n';
import { gameBus } from '@/state/run';
import { useApp } from '@/state/store';

/** Herramientas de balance en partida (solo con el modo debug): invocar minijefes y forzar el duelo del jefe. */
export function DebugBar() {
  const [rarity, setRarity] = useState<TalismanRarity | null>(null);
  const campaign = useApp((s) => s.runCampaign !== null);
  const next = () => setRarity((r) => (r === null ? 0 : r === 3 ? null : ((r + 1) as TalismanRarity)));

  return (
    <div className="debug-bar">
      {campaign && (
        <>
          <button className="btn" onClick={() => gameBus.emit('debugDuel', { build: 'weak' })}>
            ⚔ Duelo · flojo
          </button>
          <button className="btn" onClick={() => gameBus.emit('debugDuel', { build: 'strong' })}>
            ⚔ Duelo · fuerte
          </button>
        </>
      )}
      {MINI_TYPES.map((type) => (
        <button key={type} className="btn" onClick={() => gameBus.emit('debugMini', { type, rarity })}>
          ☠ {t(`mb_${type}`)}
        </button>
      ))}
      <button className="btn" onClick={next}>
        ◆ {rarity === null ? '?' : t(RARITY_KEYS[rarity])}
      </button>
    </div>
  );
}
