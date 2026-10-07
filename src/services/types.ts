import type { SaveData, ShardName } from '@/state/save-schema';

/* ------------------------------------------------------------------ */
/* SaveService                                                         */
/* ------------------------------------------------------------------ */

/**
 * Backend de guardado. Trabaja por shards para que cada implementación
 * decida cómo mapearlos (claves de CloudStorage, una fila por shard en SQL, etc.).
 */
export interface SaveBackend {
  readonly id: 'cloud' | 'local' | 'remote';
  /** true si este backend puede usarse en el entorno actual. */
  isAvailable(): boolean;
  /** Devuelve el guardado completo o null si no hay nada. Nunca lanza. */
  load(): Promise<SaveData | null>;
  /** Escribe solo los shards indicados (o todos si no se indican). */
  save(data: SaveData, shards?: readonly ShardName[]): Promise<void>;
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* AdService                                                           */
/* ------------------------------------------------------------------ */

/** Puntos de anuncio del juego; cada uno con su propia política de cooldown/tope. */
export type AdPlacement =
  | 'revive'
  | 'reroll'
  | 'double_sparks'
  | 'chest'
  | 'boost'
  | 'wheel'
  | 'streak_repair'
  | 'skin_unlock'
  | 'skin_trial';

export type AdOutcome =
  | { status: 'rewarded' }
  | { status: 'skipped' }
  | { status: 'unavailable' }
  | { status: 'error'; reason: string };

export type AdEvent = 'reward' | 'skip' | 'error' | 'start';
export type AdEventHandler = (placement: AdPlacement, outcome: AdOutcome) => void;

export interface AdService {
  readonly providerId: string;
  init(): Promise<void>;
  /** Comprobación rápida (sin red bloqueante) de si se puede ofrecer un anuncio ahora. */
  isReady(placement: AdPlacement): boolean;
  /**
   * Muestra el anuncio. Resuelve SOLO cuando el SDK confirma el resultado.
   * La recompensa se otorga únicamente si `status === 'rewarded'`.
   */
  show(placement: AdPlacement): Promise<AdOutcome>;
  on(event: AdEvent, handler: AdEventHandler): () => void;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export type AnalyticsEvent =
  | 'app_open'
  | 'run_start'
  | 'run_end'
  | 'level_up'
  | 'ad_offered'
  | 'ad_accepted'
  | 'ad_completed'
  | 'ad_abandoned'
  | 'ad_error'
  | 'purchase_upgrade'
  | 'talisman_found'
  | 'talisman_use'
  | 'unlock'
  | 'share'
  | 'save_error';

export interface Analytics {
  track(event: AnalyticsEvent, props?: Record<string, string | number | boolean | null>): void;
  /** Propiedades que viajan con todos los eventos (versión, plataforma, idioma...). */
  setContext(ctx: Record<string, string | number | boolean>): void;
}
