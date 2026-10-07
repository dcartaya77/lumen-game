const loading = new Map<string, Promise<void>>();

/**
 * Inyecta un script externo una sola vez y resuelve cuando carga.
 * Falla (sin lanzar más tarde) si la red lo bloquea; el llamador decide el fallback.
 */
export function loadScript(src: string, attrs: Record<string, string> = {}, timeoutMs = 8000): Promise<void> {
  const cached = loading.get(src);
  if (cached) return cached;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const timer = setTimeout(() => {
      el.remove();
      reject(new Error(`timeout loading ${src}`));
    }, timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      el.remove();
      reject(new Error(`failed loading ${src}`));
    };
    document.head.appendChild(el);
  });
  loading.set(src, p);
  p.catch(() => loading.delete(src));
  return p;
}
