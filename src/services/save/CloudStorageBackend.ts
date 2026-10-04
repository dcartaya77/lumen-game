import { tg } from '@/platform/telegram';
import type { TgCloudStorage } from '@/platform/telegram-types';
import { normalizeSave, SHARD_NAMES, type SaveData, type ShardName } from '@/state/save-schema';
import type { SaveBackend } from '../types';
import { META_KEY, shardKey } from './keys';
import { deserializeSave, serializeSave } from './serialize';

/**
 * Telegram.WebApp.CloudStorage (Bot API 6.9+). Sincroniza entre dispositivos del mismo usuario.
 * Límites oficiales: 1024 claves, valores de 0-4096 caracteres. Usamos 5 claves en total.
 * La API es de callbacks; aquí se promisifica y se aplica un timeout para no colgar el arranque.
 */
export class CloudStorageBackend implements SaveBackend {
  readonly id = 'cloud' as const;
  private readonly timeoutMs = 4000;

  constructor(private readonly lang: () => 'es' | 'en') {}

  private get cs(): TgCloudStorage | null {
    return tg.cloudStorage;
  }

  isAvailable(): boolean {
    return this.cs !== null;
  }

  async load(): Promise<SaveData | null> {
    const cs = this.cs;
    if (!cs) return null;
    const keys = [META_KEY, ...SHARD_NAMES.map(shardKey)];
    try {
      const entries = await this.withTimeout<Record<string, string>>(
        (cb) => void cs.getItems(keys, cb),
      );
      const raw = deserializeSave(entries);
      return raw ? normalizeSave(raw, this.lang()) : null;
    } catch (err) {
      console.warn('[save:cloud] load failed', err);
      return null;
    }
  }

  async save(data: SaveData, shards?: readonly ShardName[]): Promise<void> {
    const cs = this.cs;
    if (!cs) return;
    const { entries, oversized } = serializeSave(data, shards);
    if (oversized.length) {
      // No escribimos shards que exceden el límite: CloudStorage los rechazaría y perderíamos el meta.
      console.error('[save:cloud] shard(s) exceed 4096 chars, skipped:', oversized);
      for (const s of oversized) delete entries[shardKey(s)];
    }
    // Escribimos shards primero y meta al final: si algo falla a medias, el meta antiguo sigue siendo coherente.
    const metaValue = entries[META_KEY]!;
    delete entries[META_KEY];
    await Promise.all(
      Object.entries(entries).map(([k, v]) => this.withTimeout<boolean>((cb) => void cs.setItem(k, v, cb))),
    );
    await this.withTimeout<boolean>((cb) => void cs.setItem(META_KEY, metaValue, cb));
  }

  async clear(): Promise<void> {
    const cs = this.cs;
    if (!cs) return;
    await this.withTimeout<boolean>((cb) => void cs.removeItems([META_KEY, ...SHARD_NAMES.map(shardKey)], cb));
  }

  private withTimeout<T>(run: (cb: (err: string | null, result?: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('cloud storage timeout')), this.timeoutMs);
      try {
        run((err, result) => {
          clearTimeout(timer);
          if (err) reject(new Error(err));
          else resolve(result as T);
        });
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    });
  }
}
