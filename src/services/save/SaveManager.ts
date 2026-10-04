import { createDefaultSave, type SaveData, type ShardName } from '@/state/save-schema';
import type { Analytics, SaveBackend } from '../types';

export interface SaveManagerOptions {
  /** Backends en orden de prioridad; el primero disponible es la fuente principal. */
  backends: SaveBackend[];
  analytics: Analytics;
  lang: () => 'es' | 'en';
  debounceMs?: number;
}

/**
 * Orquesta los backends:
 *  - load(): lee de todos los disponibles y se queda con el `updatedAt` más reciente,
 *    luego repara el resto para que converjan.
 *  - markDirty(shards): acumula cambios y escribe con debounce.
 *  - flush(): escritura inmediata (fin de partida, cierre de la app).
 * La UI nunca habla con los backends directamente.
 */
export class SaveManager {
  private readonly backends: SaveBackend[];
  private readonly analytics: Analytics;
  private readonly lang: () => 'es' | 'en';
  private readonly debounceMs: number;

  private current: SaveData | null = null;
  private dirty = new Set<ShardName>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(opts: SaveManagerOptions) {
    this.backends = opts.backends.filter((b) => b.isAvailable());
    this.analytics = opts.analytics;
    this.lang = opts.lang;
    this.debounceMs = opts.debounceMs ?? 2000;
  }

  get activeBackends(): string[] {
    return this.backends.map((b) => b.id);
  }

  get data(): SaveData {
    if (!this.current) throw new Error('SaveManager.load() must run before accessing data');
    return this.current;
  }

  async load(): Promise<SaveData> {
    const results = await Promise.all(
      this.backends.map(async (b) => ({ backend: b, data: await b.load() })),
    );
    const found = results.filter((r): r is { backend: SaveBackend; data: SaveData } => r.data !== null);
    let chosen: SaveData;
    if (found.length === 0) {
      chosen = createDefaultSave(this.lang());
      this.dirty = new Set(['profile', 'stats', 'daily', 'ads']);
    } else {
      chosen = found.reduce((a, b) => (b.data.updatedAt > a.data.updatedAt ? b : a)).data;
      // Backends que no tenían datos o tenían una copia más antigua: los ponemos al día.
      const stale = results.filter((r) => !r.data || r.data.updatedAt < chosen.updatedAt);
      for (const r of stale) void r.backend.save(chosen).catch(() => undefined);
    }
    this.current = chosen;
    if (this.dirty.size) this.schedule();
    return chosen;
  }

  /**
   * Aplica una mutación sobre el guardado y marca los shards tocados.
   * El mutator recibe el objeto real (mutación in-place) para evitar copias en el bucle de juego.
   */
  update(shards: ShardName | ShardName[], mutator: (data: SaveData) => void): void {
    const data = this.data;
    mutator(data);
    for (const s of Array.isArray(shards) ? shards : [shards]) this.dirty.add(s);
    this.schedule();
  }

  /** Escribe de inmediato lo pendiente. Seguro de llamar varias veces. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.current || this.dirty.size === 0) return this.writing;
    const shards = [...this.dirty];
    this.dirty.clear();
    this.current.updatedAt = Date.now();
    const snapshot = this.current;
    this.writing = this.writing.then(() => this.write(snapshot, shards));
    return this.writing;
  }

  async resetAll(): Promise<void> {
    await Promise.all(this.backends.map((b) => b.clear().catch(() => undefined)));
    this.current = createDefaultSave(this.lang());
    this.dirty = new Set(['profile', 'stats', 'daily', 'ads']);
    await this.flush();
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private async write(data: SaveData, shards: ShardName[]): Promise<void> {
    await Promise.all(
      this.backends.map((b) =>
        b.save(data, shards).catch((err: unknown) => {
          console.warn(`[save:${b.id}] write failed`, err);
          this.analytics.track('save_error', { backend: b.id, reason: String(err) });
          // Reintentar más tarde: volvemos a marcar los shards como sucios.
          for (const s of shards) this.dirty.add(s);
          this.schedule();
        }),
      ),
    );
  }
}
