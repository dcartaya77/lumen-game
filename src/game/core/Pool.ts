/**
 * Pool de objetos sin asignaciones en caliente.
 * `active` es un array compacto: liberar hace swap-remove, así que al iterar
 * y liberar a la vez hay que recorrerlo hacia atrás (ver `releaseAt`).
 */
export class Pool<T> {
  readonly active: T[] = [];
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly onRelease: (item: T) => void,
    prealloc = 0,
  ) {
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }

  acquire(): T {
    const item = this.free.pop() ?? this.factory();
    this.active.push(item);
    return item;
  }

  /** Libera el elemento en la posición `i` de `active` (O(1), altera el orden). */
  releaseAt(i: number): void {
    const item = this.active[i]!;
    const last = this.active.pop()!;
    if (last !== item) this.active[i] = last;
    this.onRelease(item);
    this.free.push(item);
  }

  releaseAll(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.releaseAt(i);
  }

  get size(): number {
    return this.active.length;
  }
}
