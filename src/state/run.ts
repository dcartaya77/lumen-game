import { create } from 'zustand';
import type { UpgradeOption } from '@/data/types';
import { EventBus } from '@/game/core/EventBus';

export type RunPhase = 'idle' | 'playing' | 'levelup' | 'dead' | 'ended';

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
  /** Re-sorteos disponibles en este nivel-up: uno gratis por partida y algunos con anuncio. */
  rerolls: { free: number; ads: number };
  result: RunResult | null;
  /** Primera partida: el motor muestra guías sin texto (dedo, flecha, nivel-up guiado). */
  tutorial: boolean;
  /** El jugador ya se ha movido alguna vez. */
  moved: boolean;
  /** Dirección y distancia a la gema más cercana (solo en tutorial). */
  guide: { angle: number; dist: number } | null;
  /** El primer nivel-up guiado ya se resolvió: el tutorial terminó. */
  tutDone: boolean;
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
  rerolls: { free: 0, ads: 0 },
  result: null,
  tutorial: false,
  moved: false,
  guide: null,
  tutDone: false,
  build: { weapons: {}, passives: {} },
  reset: () =>
    set({
      phase: 'idle',
      hud: emptyHud,
      choices: [],
      rerolls: { free: 0, ads: 0 },
      result: null,
      tutorial: false,
      moved: false,
      guide: null,
      tutDone: false,
      build: { weapons: {}, passives: {} },
    }),
}));

/** Órdenes de la UI hacia el motor. */
export interface UiToGame extends Record<string, unknown> {
  choose: { id: string };
  reroll: { via: 'free' | 'ad' };
  /** Tras ver el anuncio de revivir. */
  revive: undefined;
  /** Rechazar o agotar la oferta de revivir: termina la partida. */
  giveup: undefined;
  pause: boolean;
  /** Cambios de sonido/música desde la pausa. */
  audio: { sound: boolean; music: boolean };
  quit: undefined;
}

export const gameBus = new EventBus<UiToGame>();
