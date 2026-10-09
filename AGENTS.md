# LUMEN — notas para agentes

Survivor de acción para Telegram Mini Apps. Solo cliente (web estática), sin backend ni base de datos.
Puro entretenimiento: nada de tokens, cripto ni "ganar dinero".

## Comandos
- `npm run dev` — dev server (Vite, `--host` para probar en móvil por LAN).
- `npm run typecheck` — `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- `npm test` — tests unitarios con `node:test` en `tests/` (sin dependencias; Node ≥ 22.18 ejecuta TS directamente). Solo se pueden probar módulos sin alias `@/` ni JSON.
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
  (vida adaptativa = clamp(DPS × k, mín, máx)). Seis tipos (charger, fan, swarm, trail, shield, teleport); cada tramo de la campaña tiene su pool en `minibosses.pools`
  y `data/miniPick.ts` (puro, con tests) rota por él sin repetir el tipo anterior. `Hazards` también guarda zonas persistentes (`zone`/`zoneHit`: aviso rojo y luego daño).
  El escudo bloquea según dónde está el jugador (`Minibosses.damageMult`, lo aplica `Game.onEnemyDamaged`); el teletransportador se esconde 6000 px lejos mientras viaja
  (`focus(m)` da su destino a la flecha del HUD). Tipo nuevo = entrada en el JSON (tipos y pools) + `MINI_TYPES` + `LOOK` + rama en `Minibosses` (+ aviso en `MINI_HINT_KEYS` si hace falta).
  Debug en partida: botones para invocarlos (`ui/run/DebugBar.tsx`) y DPS medido en el HUD.
- Talismanes (v1.1): solo campaña, consumibles (se gastan al usarlos; 1 uso por talismán y noche). Datos/balance en `data/talismans.ts` +
  bloque `talismans` de campaign.json (ranuras: 1, y 2 al derrotar al jefe de la noche `slot2Boss`; sale del bit de `campaign.bosses`, no de `next`). Inventario `campaign.tal`, equipo `campaign.eq`
  (SAVE_VERSION 5; la migración 4→5 da el bit del jefe 5 a quien ya tenía la ranura con el valor viejo, `next > 10`). Acciones en `state/talismanActions.ts` (`addTalisman`/`consumeTalisman`/`toggleEquip`); `store.beginNight(n)` pasa por
  `PrepScreen` solo si hay inventario. El motor recibe `opts.talismans {keys, onUse}`, efectos en `game/systems/Talismans.ts`
  (Égida = `Player.shield`, Nova = daño en área, Escarcha = `Enemies.freezeAll`, Brasa vital = curar, Imán estelar = `Pickups.pullAll` + `Player.magnetT`,
  Reloj de arena = `Enemies.slowAll` (tiempo propio por enemigo; `speedFactor` para Minibosses/Boss), Furia = `Player.furyT` → `attackSpeed` en `Weapons`; jefes finales ×`bossMult`, minijefes no). Botones/teclas 1-2 vía
  `useRun.tal` + evento `useTalisman`. Cofre de minijefe → `rollTalisman(rareza)` → `RunResult.found` → inventario en `finishRun` (auto-equipa
  si hay ranura libre). Reto diario superado → talismán `TAL.challengeRarity` (`lastReward`). Tipo nuevo = entrada en `TALISMANS` + JSON + rama en `Talismans.use`.
  Los botones de la UI (talismanes y dash) usan solo `pointerdown` + `game/core/PressGuard.ts` (bloqueo de 300 ms compartido); el motor repite el guard en `useTalisman`.
  Exclusivos de jefe (hito 5b, `exclusive: true`, solo legendarios, no salen de cofres; los da el jefe en `bosses.types[id].reward.talisman`): Devorador estelar (luz + curar + XP), Eclipse (`Enemies.blindAll`: los corrientes vagan, `blind`/'wander'),
  Fragmento de espejo (`Player.reflectT` + `Talismans.reflect`, lo dispara `Game.onPlayerHit`), Coraza de cristal (`Player.barrier/barrierT`, absorbe en `hurt`) y Amanecer (`events.onDawn` → `Game.dawn` mata a los corrientes). Valores en `talismans.values` del JSON.
- Jefes (v1.1, hito 4): bloque `bosses` de campaign.json + `data/bosses.ts` (`bossIdFor(noche)`); sin entrada en `byNight` la noche acaba a los 5:00 como siempre. Flujo en `Game.updateStage`:
  olas → `clearing` (se retiran hordas y minijefes) → `gift` (antesala, 3 regalos, `GiftOverlay`) → `intro` → `fight` → `won` → `finish(true)`. La vida inicial sale del DPS medio de las
  últimas `dpsSampleSecs` de olas y a los `calibrate.at` s de combate se recalibra con el daño real al jefe (conserva la fracción de vida). Vida = `k × DPS^exp` (`calibrate.k`/`exp`)
  entre `hp.min` y `hp.max`: con `exp < 1` un build fuerte acorta el duelo y uno flojo lo alarga. k y exp se tocan desde el panel debug de Campaña (persisten en localStorage). `game/systems/BossDuel.ts` (`BossDuel`) lleva arena, ataques
  telegrafiados, fases y núcleo expuesto (`exposedMult`), todo dirigido por `bosses.types[id]` (JSON). Ataques: `charge`/`chain`/`pulse`/`fan`/`beam`/`laser`/`rain` y `mirror` (copia el siguiente arma del jugador:
  proyectil→abanico, área/orbe→círculo, rayo→rayo). Mecánicas por fase (`phases[i].mech`): `gems` (Devorador: absorbe fragmentos de luz y se refuerza), `dark` (Eclipse: oscuridad, solo se ve el radio de la llama y
  el jefe hace `blink` a la sombra; `darkLayer` va sobre el mundo y los avisos de `Hazards` por encima) y `crystals` (Coloso: cristales inmóviles con armadura ×`armorMult` hasta romperlos todos, luego `coreSecs` expuesto y reaparecen;
  vida = DPS×`secs` entre `hpMin`/`hpMax`, estimada con el DPS de hordas y recalibrada con el jefe; `Enemies.nearest` los prioriza al apuntar; `CRYSTAL_ID`). `kMult` alarga/acorta un jefe sin tocar `calibrate`. Dash solo en el duelo (`BOSS.dash`, botón + Espacio).
  Jefes: noche 5 Devorador de Luz, 10 Eclipse Voraz, 15 Espejo Ladrón, 20 Coloso de Cristal, 25 Apagaestrellas (final: oscuridad + luz + cristales; `ending` en la fase de pantallas).
  Victoria: `finishRun` marca el bit del jefe (abre la ranura 2 la primera vez) y da recompensas (`BOSS.rewards`): la primera vez Chispas + talismán exclusivo legendario; al rejugar Chispas menores, un talismán raro con `chance` y el exclusivo con `exclusiveChance`;
  la skin exclusiva (`unlock: { type: 'boss', night }`) se entrega en la primera victoria si aún no se tiene. Noche 25 ganada → botón "Ver el amanecer" (`EndingScreen`, también desde el mapa de campaña). Perder suma `campaign.bl` (vida extra en el siguiente intento).
  Debug: selector de jefe + botones "Duelo flojo/fuerte" en la barra de partida (saltan a los últimos 30 s de olas con ese build) y el HUD/resultados muestran DPS de hordas → DPS al jefe → vida y duración.
  Medir sin depender del FPS (pestaña oculta = FPS bajos): `__game.app.ticker.stop()` y llamar `__game.step(1/60)` en bucle (con `xpNext` enorme y `player.invuln = 1e9` para congelar el build; el bot debe ir al cristal por el lado opuesto al jefe).
  Duración ideal medida (flojo/fuerte): Devorador 88/42 s, Eclipse 91/45, Espejo 82/43, Coloso 101/46, Apagaestrellas 140/65. Si cambias k/exp o suelos `hp.min`, el suelo manda en builds flojos (revisa `hp.min` antes que `kMult`).
  Jefe nuevo = entrada en `bosses.types` (+ `byNight`, `BossId`, nombre i18n `boss_<id>`, skin y talismán exclusivos); si trae una mecánica nueva, rama en `BossDuel`.
- Anuncios de campaña (v1.1, hito 6; siempre iniciados por el jugador vía `AdButton`/`runAd`, mismos topes que la v1): `talisman_pick` (cofre de minijefe: fase `chest`,
  `ChestOverlay`; el motor solo la abre si `opts.canOfferPick()` = anuncio listo + hueco de oferta automática, si no entrega el sorteado; `talismanChoices` da 3 de la misma rareza),
  `boss_shield` (antesala: `giftAd` suma `BOSS.gifts.adShieldSecs` al escudo), `boss_revive` (una vez por duelo, aparte del revivir de las olas: `Game.duelReviveUsed`,
  `BossDuel.calm()`; `useRun.reviveKind` elige el anuncio en `ReviveOverlay`) y `boss_double` (Resultados: duplica Chispas de la noche + recompensa del jefe).
  Analítica: eventos `ad_*` por placement y `talisman_found` con `via: 'ad_pick'`.
- **Pendiente para el hito 7 de la v1.1 (balance)**: revisar la economía de Chispas de la campaña (~355 por victoria es demasiado;
  ver `sparks`, `firstClear` y `replay` en campaign.json) y comprobar que las noches 5 y 10 son pasables sin comprar mejoras permanentes.
  Revisar también `boss_double`: duplica Chispas de la noche + recompensa del jefe (medido: +380 en la noche 5, +910 en la 25, sin contar el bono de primera vez) y puede inflar el total.
  Opciones a valorar: duplicar solo la recompensa del jefe, limitar el duplicado con un tope, o bajar la base de Chispas por victoria.
  Antes de tocar números: tabla de precios (mejoras 14.780 + personajes 1.300 + mapas 1.500 = 17.580; con skins de Chispas 19.680) y modelo de ingresos (jugador de 2★: la 1ª pasada de 25 noches rinde ~21.500 Chispas y se compra todo hacia la noche 22-24; de 3★, hacia la 20-21), con 3 opciones de economía propuestas al usuario.
  También en el hito 7: legibilidad del Eclipse con poco brillo (avisos con contorno fuerte fuera del radio de luz) y duración real de los duelos con esquivas reales (Coloso y Apagaestrellas ≤ ~120 s; el ideal medido del Apagaestrellas flojo ya es 140 s y el del Coloso 101 s).
  Aplazado a la v2 (solo documentado en `docs/ROADMAP-V2.md`): tarjeta de victoria por jefe y modo Noche Eterna. Nombres de jefes fijados: Devorador de Luz, Eclipse Voraz, Espejo Ladrón, Coloso de Cristal, Apagaestrellas.
- Tutorial (primera partida, `profile.tut`): estado en `useRun` (`tutorial/moved/guide/tutDone`), UI en `ui/run/Tutorial.tsx`.
- Música procedural en `game/audio/Music.ts` sobre el contexto de `Sfx`; ajustes `sound`/`music` también desde pausa y menú.
- `src/i18n/` — `t('clave')`, diccionarios es/en; `es.ts` define el tipo de claves.

## Convenciones
- Contenido (armas, enemigos, personajes…) como datos tipados en `src/data/`, no hardcodeado en sistemas.
- Anuncios siempre iniciados por el jugador; recompensa solo con `status: 'rewarded'`.
- Commit por hito, sin push.
