# LUMEN — notas para agentes

Survivor de acción para Telegram Mini Apps. Solo cliente (web estática), sin backend ni base de datos.
Puro entretenimiento: nada de tokens, cripto ni "ganar dinero".

## Comandos
- `npm run dev` — dev server (Vite, `--host` para probar en móvil por LAN).
- `npm run typecheck` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- `npm run build` — typecheck + build estático en `dist/` (Cloudflare Pages/Vercel/Netlify).
- `npm run preview` — sirve `dist/`.
- Despliegue, BotFather y pruebas de anuncios: `docs/DEPLOY.md`.
- Diseño de la v2 con backend (ranking, referidos, notificaciones, Stars): `docs/ROADMAP-V2.md`.

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
- `src/state/adActions.ts` / `skinActions.ts` — recompensas (cofre, ruleta, racha, impulso) y skins; publican con `commit()`.
  El anuncio lo lanza `ui/components/AdButton` (`runAd`) y solo con `rewarded` llama a `onReward`. Política (tope diario 15,
  60 s entre anuncios, 120 s entre ofertas automáticas) en `services/ads/AdPolicy.ts`.
- Impulso inicial y skin de prueba se consumen en `startRun` (`runBoosts`), no en el efecto de RunScreen (StrictMode).
- `src/game/` — PixiJS, sin React. Se comunica con la UI por el store/eventos, nunca por referencias directas.
  Se carga con `import('@/game/Game')` (chunk propio, precargado en idle desde `store.boot`); no importarlo estáticamente.
  No añadir `manualChunks` para pixi: el helper de precarga de Vite lo arrastraría al arranque.
- Campaña (v1.1): balance en `src/data/balance/campaign.json`, cargado y validado por `data/campaign.ts` (`planNight`).
  Progreso en el shard `campaign` (`next`, `stars` de 25 dígitos, `bosses` bitmask, `tal` inventario `id:rareza`→cantidad, `eq` equipo). `Enemies.waveConfig` recibe las olas de cada noche.
  Modo debug (siempre en DEV; en producción, 7 toques en la versión de Ajustes): `state/debug.ts`.
- Minijefes (v1.1): config en `minibosses` de campaign.json + `data/minibosses.ts`; `game/systems/Minibosses.ts`
  (máquina de estados por tipo: chase → windup/aviso → strike → recover), `Hazards.ts` (avisos con pooling) y `core/DpsMeter.ts`
  (vida adaptativa = clamp(DPS × k, mín, máx)). Tipo nuevo = entrada en el JSON + `MINI_TYPES` + rama en `Minibosses`.
  Debug en partida: botones para invocarlos (`ui/run/DebugBar.tsx`) y DPS medido en el HUD.
- Talismanes (v1.1): solo campaña, consumibles (se gastan al usarlos; 1 uso por talismán y noche). Datos/balance en `data/talismans.ts` +
  bloque `talismans` de campaign.json (ranuras: 1, y 2 al superar la noche `slot2AfterNight`). Inventario `campaign.tal`, equipo `campaign.eq`
  (SAVE_VERSION 4). Acciones en `state/talismanActions.ts` (`addTalisman`/`consumeTalisman`/`toggleEquip`); `store.beginNight(n)` pasa por
  `PrepScreen` solo si hay inventario. El motor recibe `opts.talismans {keys, onUse}`, efectos en `game/systems/Talismans.ts`
  (Égida = `Player.shield`, Nova = daño en área, Escarcha = `Enemies.freezeAll`; jefes finales ×`bossMult`, minijefes no). Botones/teclas 1-2 vía
  `useRun.tal` + evento `useTalisman`. Cofre de minijefe → `rollTalisman(rareza)` → `RunResult.found` → inventario en `finishRun` (auto-equipa
  si hay ranura libre). Reto diario superado → talismán `TAL.challengeRarity` (`lastReward`). Tipo nuevo = entrada en `TALISMANS` + JSON + rama en `Talismans.use`.
- **Pendiente para el hito 7 de la v1.1 (balance)**: revisar la economía de Chispas de la campaña (~355 por victoria es demasiado;
  ver `sparks`, `firstClear` y `replay` en campaign.json) y comprobar que las noches 5 y 10 son pasables sin comprar mejoras permanentes.
- Tutorial (primera partida, `profile.tut`): estado en `useRun` (`tutorial/moved/guide/tutDone`), UI en `ui/run/Tutorial.tsx`.
- Música procedural en `game/audio/Music.ts` sobre el contexto de `Sfx`; ajustes `sound`/`music` también desde pausa y menú.
- `src/i18n/` — `t('clave')`, diccionarios es/en; `es.ts` define el tipo de claves.

## Convenciones
- Contenido (armas, enemigos, personajes…) como datos tipados en `src/data/`, no hardcodeado en sistemas.
- Anuncios siempre iniciados por el jugador; recompensa solo con `status: 'rewarded'`.
- Commit por hito, sin push.
