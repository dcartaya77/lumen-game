export interface Positioned {
  x: number;
  y: number;
}

/**
 * Hash espacial uniforme. Se reconstruye cada paso (clear + insert): con ≤200
 * enemigos es más barato que mantenerlo incremental. `query` devuelve los
 * candidatos de las celdas que tocan el círculo; el filtrado fino lo hace el llamador.
 */
export class SpatialHash<T extends Positioned> {
  private readonly cells = new Map<number, T[]>();
  private readonly inv: number;

  constructor(cellSize = 64) {
    this.inv = 1 / cellSize;
  }

  clear(): void {
    for (const list of this.cells.values()) list.length = 0;
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x * this.inv), Math.floor(item.y * this.inv));
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(item);
  }

  /** Rellena `out` con los candidatos cercanos y devuelve la cuenta. No asigna memoria. */
  query(x: number, y: number, radius: number, out: T[]): number {
    out.length = 0;
    const x0 = Math.floor((x - radius) * this.inv);
    const x1 = Math.floor((x + radius) * this.inv);
    const y0 = Math.floor((y - radius) * this.inv);
    const y1 = Math.floor((y + radius) * this.inv);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (list) for (let i = 0; i < list.length; i++) out.push(list[i]!);
      }
    }
    return out.length;
  }

  private key(cx: number, cy: number): number {
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }
}
