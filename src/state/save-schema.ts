/**
 * Esquema del guardado. Diseñado para CloudStorage de Telegram:
 *   - máx. 1024 claves, valores de hasta 4096 caracteres, claves [A-Za-z0-9_-]{1,128}.
 * Dividimos el estado en "shards" independientes (una clave cada uno) para que
 * ninguno se acerque al límite y para poder escribir solo lo que cambia.
 *
 * Reglas: nombres de campo cortos, ids numéricos o strings breves, nada redundante.
 * Cualquier cambio de forma incrementa SAVE_VERSION y añade una migración.
 */

export const SAVE_VERSION = 1;

/** Perfil: moneda, mejoras permanentes, desbloqueos y ajustes. */
export interface ProfileShard {
  /** Chispas (moneda del juego, sin valor real). */
  sparks: number;
  /** Nivel de cada mejora permanente, por id. */
  upgrades: Record<string, number>;
  /** Ids desbloqueados. c = personajes, m = mapas, s = skins. */
  unlocked: { c: string[]; m: string[]; s: string[] };
  /** Selección actual. */
  selected: { c: string; m: string; skin: Record<string, string> };
  settings: {
    lang: 'es' | 'en';
    sound: boolean;
    music: boolean;
    haptics: boolean;
  };
  /** Tutorial visto. */
  tut: boolean;
  createdAt: number;
}

/** Estadísticas y récords (crece lento, se escribe al final de cada partida). */
export interface StatsShard {
  runs: number;
  wins: number;
  kills: number;
  /** Mejor tiempo de supervivencia en segundos. */
  bestTime: number;
  bestKills: number;
  /** Resumen de la mejor partida para la tarjeta compartible. */
  bestRun: { t: number; k: number; w: string; c: string; at: number } | null;
  /** Logros conseguidos (ids). */
  ach: string[];
  /** Colección vista: enemigos, armas, evoluciones (ids). */
  seen: { e: string[]; w: string[]; ev: string[] };
}

/** Estado diario/semanal: racha, misiones, cofre, ruleta, reto diario. */
export interface DailyShard {
  /** Clave de día "YYYY-MM-DD" (UTC) a la que pertenece este estado. */
  day: string;
  streak: { n: number; last: string; repairedWeek: string };
  /** Misiones del día: id, progreso, reclamada. */
  missions: { id: string; p: number; done: boolean }[];
  chest: { free: boolean; ad: boolean };
  wheel: { free: boolean; ads: number };
  challenge: { done: boolean; best: number };
}

/** Contadores de anuncios y progreso de skins por anuncios. */
export interface AdsShard {
  day: string;
  /** Anuncios vistos hoy (tope global). */
  seen: number;
  /** Timestamp del último anuncio completado. */
  last: number;
  /** Progreso de desbloqueo de skins por anuncios: skinId -> anuncios vistos. */
  skinProgress: Record<string, number>;
  /** Skin en prueba para la siguiente partida. */
  trial: string | null;
}

export interface SaveData {
  v: number;
  /** Marca de tiempo de la última escritura; decide qué copia gana (cloud vs local). */
  updatedAt: number;
  profile: ProfileShard;
  stats: StatsShard;
  daily: DailyShard;
  ads: AdsShard;
}

export type ShardName = 'profile' | 'stats' | 'daily' | 'ads';
export const SHARD_NAMES: readonly ShardName[] = ['profile', 'stats', 'daily', 'ads'];

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createDefaultSave(lang: 'es' | 'en' = 'es'): SaveData {
  const day = todayKey();
  return {
    v: SAVE_VERSION,
    updatedAt: Date.now(),
    profile: {
      sparks: 0,
      upgrades: {},
      unlocked: { c: ['ember'], m: ['forest'], s: [] },
      selected: { c: 'ember', m: 'forest', skin: {} },
      settings: { lang, sound: true, music: true, haptics: true },
      tut: false,
      createdAt: Date.now(),
    },
    stats: {
      runs: 0,
      wins: 0,
      kills: 0,
      bestTime: 0,
      bestKills: 0,
      bestRun: null,
      ach: [],
      seen: { e: [], w: [], ev: [] },
    },
    daily: {
      day,
      streak: { n: 0, last: '', repairedWeek: '' },
      missions: [],
      chest: { free: true, ad: true },
      wheel: { free: true, ads: 0 },
      challenge: { done: false, best: 0 },
    },
    ads: { day, seen: 0, last: 0, skinProgress: {}, trial: null },
  };
}

/**
 * Migraciones secuenciales: cada función lleva un guardado de la versión N a N+1.
 * Trabajan sobre `unknown` porque la forma antigua ya no está tipada.
 */
const migrations: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 -> 2: ejemplo futuro
  // 1: (old) => ({ ...old, v: 2, nuevoCampo: valor }),
};

/** Normaliza cualquier guardado leído: aplica migraciones y rellena campos ausentes. */
export function normalizeSave(raw: unknown, lang: 'es' | 'en'): SaveData {
  const defaults = createDefaultSave(lang);
  if (!raw || typeof raw !== 'object') return defaults;

  let data = raw as Record<string, unknown>;
  let v = typeof data.v === 'number' ? data.v : 1;
  while (v < SAVE_VERSION) {
    const step = migrations[v];
    if (!step) break;
    data = step(data);
    v++;
  }

  // Fusión profunda de dos niveles: suficiente para la forma shard -> campos.
  const merged = { ...defaults, v: SAVE_VERSION } as SaveData;
  for (const shard of SHARD_NAMES) {
    const src = data[shard];
    if (src && typeof src === 'object') {
      (merged as unknown as Record<string, unknown>)[shard] = {
        ...defaults[shard],
        ...(src as Record<string, unknown>),
      };
    }
  }
  if (typeof data.updatedAt === 'number') merged.updatedAt = data.updatedAt;
  return merged;
}
