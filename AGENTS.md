# LUMEN — notas para agentes

Survivor de acción para Telegram Mini Apps. Solo cliente (web estática), sin backend ni base de datos.
Puro entretenimiento: nada de tokens, cripto ni "ganar dinero".

## Comandos
- `npm run dev` — dev server (Vite, `--host` para probar en móvil por LAN).
- `npm run typecheck` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- `npm run build` — typecheck + build estático en `dist/` (Cloudflare Pages/Vercel/Netlify).
- `npm run preview` — sirve `dist/`.

## Stack
- Vite 8 (Rolldown: `manualChunks` debe ser función) + React 19 + TS 5.9 + Zustand 5 + PixiJS 8 (`await app.init()`).
- Telegram: script oficial `telegram-web-app.js` en `index.html`; tipos propios en `src/platform/telegram-types.ts`.
  Fuera de Telegram todo es no-op (`tg.available === false`) para desarrollar en navegador.

## Arquitectura
- `src/platform/telegram.ts` — único punto de acceso a `Telegram.WebApp`.
- `src/services/types.ts` — interfaces `SaveBackend`, `AdService`, `Analytics`. `container.ts` compone implementaciones.
- `src/services/save/` — `SaveManager` (debounce 2 s, flush al ocultar/cerrar, merge por `updatedAt`) sobre
  `CloudStorageBackend` (principal) + `LocalStorageBackend` (respaldo) + `RemoteBackendStub` (v2).
- `src/state/save-schema.ts` — esquema versionado en 4 shards (`profile`, `stats`, `daily`, `ads`) + `meta`.
  Límites CloudStorage: 1024 claves, 4096 chars/valor, claves `[A-Za-z0-9_-]`. Nunca superar 4096 por shard.
- `src/state/store.ts` — Zustand; la UI muta el guardado solo vía acciones del store (`services().save.update`).
- `src/game/` — PixiJS, sin React. Se comunica con la UI por el store/eventos, nunca por referencias directas.
- `src/i18n/` — `t('clave')`, diccionarios es/en; `es.ts` define el tipo de claves.

## Convenciones
- Contenido (armas, enemigos, personajes…) como datos tipados en `src/data/`, no hardcodeado en sistemas.
- Anuncios siempre iniciados por el jugador; recompensa solo con `status: 'rewarded'`.
- Commit por hito, sin push.
