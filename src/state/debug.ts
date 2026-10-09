import { BOSS, BOSS_PACE } from '@/data/bosses';

const KEY = 'lumen_debug';
const TUNE_KEY = 'lumen_debug_boss';
const BOSS_DEFAULT = { k: BOSS.calibrate.k, exp: BOSS.calibrate.exp };

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

export function bossTuning(): { k: number; exp: number } {
  return { k: BOSS.calibrate.k, exp: BOSS.calibrate.exp };
}

/** Debug: cambia k y el exponente de la vida adaptativa del jefe; se recuerda entre recargas para comparar duelos. */
export function setBossTuning(t: Partial<{ k: number; exp: number }>): void {
  if (!debugEnabled()) return;
  if (t.k !== undefined && t.k > 0) BOSS.calibrate.k = Math.round(t.k);
  if (t.exp !== undefined && t.exp > 0.3 && t.exp <= 1) BOSS.calibrate.exp = Math.round(t.exp * 100) / 100;
  try {
    localStorage.setItem(TUNE_KEY, JSON.stringify({ ...bossTuning(), base: BOSS_DEFAULT }));
  } catch {
    /* sin almacenamiento */
  }
}

export function resetBossTuning(): void {
  BOSS.calibrate.k = BOSS_DEFAULT.k;
  BOSS.calibrate.exp = BOSS_DEFAULT.exp;
  try {
    localStorage.removeItem(TUNE_KEY);
  } catch {
    /* sin almacenamiento */
  }
}

export function bossPace(): { move: number; attack: number } {
  return { move: BOSS_PACE.move, attack: BOSS_PACE.attack };
}

/** Debug: multiplica en vivo el movimiento y el ritmo de ataques del jefe (no se guarda: se pierde al recargar). */
export function setBossPace(p: Partial<{ move: number; attack: number }>): void {
  if (!debugEnabled()) return;
  const fit = (v: number) => Math.round(Math.min(2, Math.max(0.5, v)) * 100) / 100;
  if (p.move !== undefined) BOSS_PACE.move = fit(p.move);
  if (p.attack !== undefined) BOSS_PACE.attack = fit(p.attack);
}

export function resetBossPace(): void {
  BOSS_PACE.move = 1;
  BOSS_PACE.attack = 1;
}

if (debugEnabled()) {
  try {
    const saved = JSON.parse(localStorage.getItem(TUNE_KEY) ?? 'null') as
      | { k: number; exp: number; base: { k: number; exp: number } }
      | null;
    // Si se editaron k/exp en el JSON, el ajuste guardado queda obsoleto y se descarta.
    if (saved && saved.base?.k === BOSS_DEFAULT.k && saved.base?.exp === BOSS_DEFAULT.exp) setBossTuning(saved);
    else if (saved) localStorage.removeItem(TUNE_KEY);
  } catch {
    /* ajuste guardado ilegible: se ignora */
  }
}
