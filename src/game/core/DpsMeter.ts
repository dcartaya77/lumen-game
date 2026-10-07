/** Mide el daño por segundo del jugador en una ventana deslizante (cubos de 0,5 s). */
export class DpsMeter {
  private readonly buckets: Float32Array;
  private readonly stamps: Float32Array;
  private readonly size: number;

  constructor(
    private readonly window = 15,
    private readonly bucketLen = 0.5,
  ) {
    this.size = Math.ceil(window / bucketLen) + 1;
    this.buckets = new Float32Array(this.size);
    this.stamps = new Float32Array(this.size).fill(-1);
  }

  add(amount: number, time: number): void {
    const idx = Math.floor(time / this.bucketLen);
    const slot = idx % this.size;
    if (this.stamps[slot] !== idx) {
      this.stamps[slot] = idx;
      this.buckets[slot] = 0;
    }
    this.buckets[slot]! += amount;
  }

  /** DPS medio de la ventana; 0 si aún no hay datos suficientes (menos de 5 s de partida). */
  dps(time: number): number {
    const span = Math.min(this.window, time);
    if (span < 5) return 0;
    const now = Math.floor(time / this.bucketLen);
    let sum = 0;
    for (let i = 0; i < this.size; i++) {
      const idx = this.stamps[i]!;
      if (idx >= 0 && now - idx <= this.window / this.bucketLen) sum += this.buckets[i]!;
    }
    return sum / span;
  }

  reset(): void {
    this.buckets.fill(0);
    this.stamps.fill(-1);
  }
}
