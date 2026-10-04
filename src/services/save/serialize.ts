import { SHARD_NAMES, type SaveData, type ShardName } from '@/state/save-schema';
import { CLOUD_VALUE_LIMIT, META_KEY, shardKey } from './keys';

export interface SerializedSave {
  /** key -> JSON string. Incluye META_KEY y una clave por shard. */
  entries: Record<string, string>;
  /** Shards cuyo JSON supera el límite de CloudStorage. */
  oversized: ShardName[];
}

/** Serializa el guardado en claves independientes y detecta shards demasiado grandes. */
export function serializeSave(data: SaveData, shards: readonly ShardName[] = SHARD_NAMES): SerializedSave {
  const entries: Record<string, string> = {
    [META_KEY]: JSON.stringify({ v: data.v, updatedAt: data.updatedAt }),
  };
  const oversized: ShardName[] = [];
  for (const shard of shards) {
    const json = JSON.stringify(data[shard]);
    if (json.length > CLOUD_VALUE_LIMIT) oversized.push(shard);
    entries[shardKey(shard)] = json;
  }
  return { entries, oversized };
}

/** Reconstruye un objeto crudo (sin validar) a partir de claves; null si no hay meta ni shards. */
export function deserializeSave(entries: Record<string, string | undefined>): Record<string, unknown> | null {
  const metaRaw = entries[META_KEY];
  let found = false;
  const out: Record<string, unknown> = {};

  if (metaRaw) {
    const meta = safeParse(metaRaw);
    if (meta && typeof meta === 'object') {
      Object.assign(out, meta);
      found = true;
    }
  }
  for (const shard of SHARD_NAMES) {
    const raw = entries[shardKey(shard)];
    if (!raw) continue;
    const parsed = safeParse(raw);
    if (parsed && typeof parsed === 'object') {
      out[shard] = parsed;
      found = true;
    }
  }
  return found ? out : null;
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
