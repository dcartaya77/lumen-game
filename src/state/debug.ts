const KEY = 'lumen_debug';

/** Siempre activo en desarrollo; en producción solo si se activó con el gesto secreto de Ajustes. */
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setDebug(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: el modo debug simplemente no persiste */
  }
}
