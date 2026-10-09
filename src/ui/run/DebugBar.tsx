import { useState } from 'react';
import { BOSS, bossIdFor, bossNameKey, type BossId } from '@/data/bosses';
import { MINI_TYPES, RARITY_KEYS, type TalismanRarity } from '@/data/minibosses';
import { t } from '@/i18n';
import { gameBus } from '@/state/run';
import { bossPace, resetBossPace, setBossPace } from '@/state/debug';
import { useApp } from '@/state/store';

const BOSS_IDS = Object.keys(BOSS.types) as BossId[];

/** Herramientas de balance en partida (solo con el modo debug): invocar minijefes y forzar el duelo de cualquier jefe. */
export function DebugBar() {
  const [rarity, setRarity] = useState<TalismanRarity | null>(null);
  const night = useApp((s) => s.runCampaign?.night ?? null);
  const [pick, setPick] = useState<BossId | null>(null);
  const boss = pick ?? (night !== null ? bossIdFor(night) : null) ?? 'devourer';
  const next = () => setRarity((r) => (r === null ? 0 : r === 3 ? null : ((r + 1) as TalismanRarity)));
  const nextBoss = () => setPick(BOSS_IDS[(BOSS_IDS.indexOf(boss) + 1) % BOSS_IDS.length]!);
  const [pace, setPace] = useState(bossPace);
  const nudge = (k: 'move' | 'attack', d: number) => {
    setBossPace(k === 'move' ? { move: pace.move + d } : { attack: pace.attack + d });
    setPace(bossPace());
  };
  const resetPace = () => {
    resetBossPace();
    setPace(bossPace());
  };

  return (
    <div className="debug-bar">
      {night !== null && (
        <>
          <div className="debug-pace">
            <button className="btn" onClick={() => nudge('move', -0.05)}>
              −
            </button>
            <span className="pill">🏃 mov ×{pace.move.toFixed(2)}</span>
            <button className="btn" onClick={() => nudge('move', 0.05)}>
              +
            </button>
          </div>
          <div className="debug-pace">
            <button className="btn" onClick={() => nudge('attack', -0.05)}>
              −
            </button>
            <span className="pill">⏱ ataques ×{pace.attack.toFixed(2)}</span>
            <button className="btn" onClick={() => nudge('attack', 0.05)}>
              +
            </button>
            <button className="btn" onClick={resetPace}>
              ×1
            </button>
          </div>
          <button className="btn" onClick={nextBoss}>
            👑 {t(bossNameKey(boss))}
          </button>
          <button className="btn" onClick={() => gameBus.emit('debugDuel', { build: 'weak', boss })}>
            ⚔ Duelo · flojo
          </button>
          <button className="btn" onClick={() => gameBus.emit('debugDuel', { build: 'strong', boss })}>
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
