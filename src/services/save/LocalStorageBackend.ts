import { normalizeSave, SHARD_NAMES, type SaveData, type ShardName } from '@/state/save-schema';
import type { SaveBackend } from '../types';
import { META_KEY, shardKey } from './keys';
import { deserializeSave, serializeSave } from './serialize';

/** Respaldo local: mismo formato de claves que CloudStorage para poder copiar entre ambos. */
export class LocalStorageBackend implements SaveBackend {
  readonly id = 'local' as const;
  constructor(private readonly lang: () => 'es' | 'en') {}

  isAvailable(): boolean {
    try {
      const k = '__lumen_probe';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  async load(): Promise<SaveData | null> {
    try {
      const entries: Record<string, string | undefined> = { [META_KEY]: localStorage.getItem(META_KEY) ?? undefined };
      for (const s of SHARD_NAMES) entries[shardKey(s)] = localStorage.getItem(shardKey(s)) ?? undefined;
      const raw = deserializeSave(entries);
      return raw ? normalizeSave(raw, this.lang()) : null;
    } catch {
      return null;
    }
  }

  async save(data: SaveData, shards?: readonly ShardName[]): Promise<void> {
    const { entries } = serializeSave(data, shards);
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }

  async clear(): Promise<void> {
    localStorage.removeItem(META_KEY);
    for (const s of SHARD_NAMES) localStorage.removeItem(shardKey(s));
  }
}
