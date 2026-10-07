/** Anti doble activación: tras aceptar una pulsación, las siguientes se ignoran durante `lockMs`, sean del botón que sean. */
export function createPressGuard(lockMs = 300, now: () => number = () => performance.now()) {
  let until = -Infinity;
  return {
    accept(): boolean {
      const t = now();
      if (t < until) return false;
      until = t + lockMs;
      return true;
    },
  };
}
