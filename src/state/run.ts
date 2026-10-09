import { create } from 'zustand';
import type { TalismanRarity, MiniType } from '@/data/minibosses';
import type { BossId } from '@/data/bosses';
import type { TranslationKey } from '@/i18n';
import type { UpgradeOption } from '@/data/types';
import { EventBus } from '@/game/core/EventBus';

export type RunPhase = 'idle' | 'playing' | 'levelup' | 'gift' | 'chest' | 'dead' | 'ended';

/** Cofre de minijefe con la opción de elegir talismán tras un anuncio. */
export interface ChestOffer {
  rarity: TalismanRarity;
  /** Talismán sorteado: es el que se recibe si no se ve el anuncio. */
  key: string;
  /** Tres talismanes (incluye el sorteado) entre los que se elige tras el anuncio. */
  options: string[];
}

/** Regalos de la antesala del jefe. */
export type GiftId = 'heal' | 'weapon' | 'shield';
export interface GiftOption {
  id: GiftId;
  /** Nombre del arma que mejora (solo `weapon`) y si es una evolución; null si no queda nada que mejorar. */
  weaponKey: TranslationKey | null;
  evolve: boolean;
  /** Segundos de escudo (solo `shield`). */
  secs: number;
}

/** Jefe del duelo para el HUD: vida, fase, punto débil abierto y luz absorbida. */
export interface BossHud {
  nameKey: TranslationKey;
  hp: number;
  maxHp: number;
  /** 0 = jefe de la partida rápida (sin fases); 1..3 = fase del duelo. */
  phase: number;
  exposed: boolean;
  stacks: number;
  maxStacks: number;
  /** Fracciones de vida en que cambia de fase (marcas de la barra); [] en la partida rápida. */
  thresholds: readonly number[];
  /** Cristales en pie protegen al jefe (daño muy reducido) y cuántos quedan. */
  armor: boolean;
  crystals: number;
}

/** Datos del duelo para balancear (se muestran solo con el modo debug). */
export interface DuelDebug {
  /** DPS contra las hordas (vida inicial) y DPS medido sobre el jefe (recalibración; 0 hasta medirlo). */
  dps: number;
  bossDps: number;
  hp: number;
  time: number;
}

/** Minijefe activo para el HUD: barra de vida, rareza, tiempo restante y flecha de borde. */
export interface MiniHud {
  /** Clave de traducción del nombre. */
  nameKey: `mb_${MiniType}`;
  hp: number;
  maxHp: number;
  rarity: TalismanRarity;
  timeLeft: number;
  /** Dirección hacia el minijefe y si está fuera de pantalla (para la flecha). */
  angle: number;
  off: boolean;
}

/** Talismán equipado para el HUD: clave de inventario y si ya se usó esta noche. */
export interface TalHud {
  key: string;
  used: boolean;
}

export interface Hud {
  time: number;
  kills: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  fps: number;
  boss: BossHud | null;
  mini: MiniHud | null;
  /** DPS medido del jugador (se muestra en modo debug). */
  dps: number;
  /** Dash del duelo: activo solo contra el jefe; `ready` va de 0 a 1 (1 = listo). */
  dash: { on: boolean; ready: number };
  duel: DuelDebug | null;
  /** Segundos restantes de los efectos de talismán activos en el jugador. */
  buffs: { shield: number; fury: number; magnet: number; reflect: number; barrier: number };
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
  /** Noche de campaña jugada (null fuera de campaña) y si era una repetición. */
  night: number | null;
  replay: boolean;
  /** Claves de los talismanes ganados en los cofres de minijefe de esta partida. */
  found: string[];
  /** De `found`, los que el jugador eligió tras ver el anuncio. */
  foundAd: string[];
  /** Duelo contra el jefe de la noche (null si la partida no llegó a él). */
  duel: DuelResult | null;
}

export interface DuelResult {
  won: boolean;
  /** Segundos de combate contra el jefe. */
  time: number;
  /** DPS medido al empezar y vida del jefe que salió de él. */
  dps: number;
  bossDps: number;
  hp: number;
}

interface RunState {
  phase: RunPhase;
  hud: Hud;
  choices: UpgradeOption[];
  /** Regalos de la antesala (fase `gift`). */
  gifts: GiftOption[];
  /** El anuncio de escudo extra de la antesala ya se cobró. */
  giftAd: boolean;
  /** Cofre pendiente de elegir (fase `chest`). */
  chest: ChestOffer | null;
  /** Dónde se murió (fase `dead`): decide el anuncio de revivir que se ofrece. */
  reviveKind: 'run' | 'boss';
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
  /** Aviso breve en pantalla (llega un minijefe, se retira...). */
  notice: { text: string; color: number; id: number } | null;
  /** Talismanes equipados en esta noche (campaña); `used` cuando ya se gastó el de la noche. */
  tal: TalHud[];
  /** Mejoras adquiridas (id -> nivel), para mostrarlas en el HUD. */
  build: { weapons: Record<string, number>; passives: Record<string, number> };
  reset(): void;
}

const emptyHud: Hud = {
  time: 0,
  kills: 0,
  hp: 0,
  maxHp: 1,
  level: 1,
  xp: 0,
  xpNext: 1,
  fps: 60,
  boss: null,
  mini: null,
  dps: 0,
  dash: { on: false, ready: 1 },
  duel: null,
  buffs: { shield: 0, fury: 0, magnet: 0, reflect: 0, barrier: 0 },
};

/** Estado de la partida en curso. Solo lo escribe el motor; la UI solo lee. */
export const useRun = create<RunState>((set) => ({
  phase: 'idle',
  hud: emptyHud,
  choices: [],
  gifts: [],
  giftAd: false,
  chest: null,
  reviveKind: 'run',
  rerolls: { free: 0, ads: 0 },
  result: null,
  tutorial: false,
  moved: false,
  guide: null,
  tutDone: false,
  notice: null,
  tal: [],
  build: { weapons: {}, passives: {} },
  reset: () =>
    set({
      phase: 'idle',
      hud: emptyHud,
      choices: [],
      gifts: [],
      giftAd: false,
      chest: null,
      reviveKind: 'run',
      rerolls: { free: 0, ads: 0 },
      result: null,
      tutorial: false,
      moved: false,
      guide: null,
      tutDone: false,
      notice: null,
      tal: [],
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
  /** Usa el talismán equipado en la ranura `slot` (0 o 1). */
  useTalisman: { slot: number };
  /** Dash del duelo contra el jefe. */
  dash: undefined;
  /** Regalo elegido en la antesala. */
  gift: { id: GiftId };
  /** Anuncio de escudo extra visto en la antesala. */
  giftAd: undefined;
  /** Talismán que se queda el jugador al abrir el cofre (`viaAd` si lo eligió tras el anuncio). */
  chest: { key: string; viaAd: boolean };
  /** Debug: salta al final de las olas con un build flojo o fuerte para forzar el duelo. */
  debugDuel: { build: 'weak' | 'strong'; boss: BossId };
  /** Debug: invoca un minijefe (rareza null = al azar). */
  debugMini: { type: MiniType; rarity: TalismanRarity | null };
  /** Cambios de sonido/música desde la pausa. */
  audio: { sound: boolean; music: boolean };
  quit: undefined;
}

export const gameBus = new EventBus<UiToGame>();
