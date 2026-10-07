import { useState } from 'react';
import { MINI_TYPES, RARITY_KEYS, type TalismanRarity } from '@/data/minibosses';
import { t } from '@/i18n';
import { gameBus } from '@/state/run';

/** Herramientas de balance en partida (solo con el modo debug): invocar un minijefe de cada tipo. */
export function DebugBar() {
  const [rarity, setRarity] = useState<TalismanRarity | null>(null);
  const next = () => setRarity((r) => (r === null ? 0 : r === 3 ? null : ((r + 1) as TalismanRarity)));

  return (
    <div className="debug-bar">
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
