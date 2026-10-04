import type { ShardName } from '@/state/save-schema';

/** Prefijo común; cumple [A-Za-z0-9_-]. */
export const KEY_PREFIX = 'lumen_';
export const META_KEY = `${KEY_PREFIX}meta`;

/** Límite oficial de CloudStorage por valor (caracteres). */
export const CLOUD_VALUE_LIMIT = 4096;

export function shardKey(shard: ShardName): string {
  return `${KEY_PREFIX}${shard}`;
}
