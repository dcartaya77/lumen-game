import type { SaveData, ShardName } from '@/state/save-schema';
import type { SaveBackend } from '../types';

/**
 * Esqueleto para la v2 con servidor propio. Mismo contrato que los demás backends:
 * basta con implementar load/save contra la API (validando initData en el servidor)
 * y activarlo en el ServiceContainer. Hoy está deshabilitado.
 */
export class RemoteBackendStub implements SaveBackend {
  readonly id = 'remote' as const;

  isAvailable(): boolean {
    return false;
  }

  async load(): Promise<SaveData | null> {
    return null;
  }

  async save(_data: SaveData, _shards?: readonly ShardName[]): Promise<void> {
    /* v2: POST /save con initData y los shards modificados */
  }

  async clear(): Promise<void> {
    /* v2 */
  }
}
