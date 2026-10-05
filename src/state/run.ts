import { create } from 'zustand';
import type { UpgradeOption } from '@/data/types';
import { EventBus } from '@/game/core/EventBus';

export type RunPhase = 'idle' | 'playing' | 'levelup' | 'ended';

export interface Hud {
  time: number;
  kills: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  fps: number;
  boss: { hp: number; maxHp: number } | null;
}

export interface RunResult {
  won: boolean;
  bossKilled: boolean;
  time: number;
  kills: number;
  elitesKilled: number;
  level: number;
  sparks: number;
  weaponIds: string[];
  characterId: string;
  mapId: string;
  /** Se consiguió alguna evolución en la partida. */
  evolved: boolean;
  /** La partida era el reto diario. */
  challenge: boolean;
  /** Si la partida era el reto diario y se superó el objetivo. */
  challengeDone: boolean;
  /** Enemigos vistos en la partida (para la colección). */
  seenEnemies: string[];
}

interface RunState {
  phase: RunPhase;
  hud: Hud;
  choices: UpgradeOption[];
  result: RunResult | null;
  /** Mejoras adquiridas (id -> nivel), para mostrarlas en el HUD. */
  build: { weapons: Record<string, number>; passives: Record<string, number> };
  reset(): void;
}

const emptyHud: Hud = { time: 0, kills: 0, hp: 0, maxHp: 1, level: 1, xp: 0, xpNext: 1, fps: 60, boss: null };

/** Estado de la partida en curso. Solo lo escribe el motor; la UI solo lee. */
export const useRun = create<RunState>((set) => ({
  phase: 'idle',
  hud: emptyHud,
  choices: [],
  result: null,
  build: { weapons: {}, passives: {} },
  reset: () => set({ phase: 'idle', hud: emptyHud, choices: [], result: null, build: { weapons: {}, passives: {} } }),
}));

/** Órdenes de la UI hacia el motor. */
export interface UiToGame extends Record<string, unknown> {
  choose: { id: string };
  pause: boolean;
  quit: undefined;
}

export const gameBus = new EventBus<UiToGame>();
