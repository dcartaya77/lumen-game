# LUMEN: roadmap v2 (solo diseño)

La v1 es 100 % cliente: guarda en CloudStorage/`localStorage`, cuenta anuncios en local y no tiene ranking. La v2 añade un backend pequeño para ranking global, referidos, notificaciones y compras con Stars, sin reescribir el juego. Sigue siendo entretenimiento: nada de tokens, cripto ni premios con valor monetario.

> Los detalles de la API de Telegram (Stars, límites, métodos) están descritos de memoria; confírmalos en la documentación vigente antes de implementar.

## 1. Puntos de extensión que ya existen

| Pieza v1 | Papel en v2 |
| --- | --- |
| `SaveBackend` + `RemoteBackendStub` | Sincroniza los 4 shards con la API (el resto del cliente no cambia) |
| `Analytics` (`ConsoleAnalytics`) | Cola en memoria y envío por lotes (`RemoteAnalytics`) |
| `AdService` (`ymid` ya se envía a Monetag) | Verificación de recompensas en servidor |
| `tg.startParam`, `tg.appLink(startParam)` | Entrada de referidos |
| `dailyChallenge()` con semilla de fecha | Ranking diario comparable sin coordinar nada |
| `SAVE_VERSION` y migraciones | Versionado del esquema también en servidor |

Interfaces nuevas en `services/types.ts`: `LeaderboardService`, `PaymentService`, `ReferralService` y `NotificationPrefs`. Cada una con una implementación vacía en v1, como se hizo con el guardado.

## 2. Backend mínimo

**Propuesta**: Cloudflare Workers + D1 (SQLite) + Durable Object o KV para el ranking, y cron para notificaciones. Encaja con el hosting actual, escala a cero y evita gestionar servidores. Alternativa: Node + Postgres + Redis (sorted sets) si ya hay infraestructura.

**Autenticación.** El cliente envía `Telegram.WebApp.initData` en cada llamada. El servidor valida la firma HMAC con el token del bot, rechaza `auth_date` antiguo (p. ej. > 1 h) y emite una sesión corta (JWT). Nunca se confía en `initDataUnsafe`. El token del bot vive solo en los secretos del backend.

**Tablas**

| Tabla | Contenido |
| --- | --- |
| `users` | `tg_id`, idioma, zona horaria, `created_at`, `notify_optin`, `referred_by` |
| `saves` | `tg_id`, shard (`profile`, `stats`, `daily`, `ads`), JSON, `updated_at`, versión |
| `runs` | resumen verificado de partidas: modo, semilla, tiempo, bajas, nivel, build, versión del juego |
| `leaderboard` | `period` (diario/semanal/global), `tg_id`, puntuación, `run_id` |
| `referrals` | invitador, invitado, estado (pendiente/verificado), premio entregado |
| `purchases` | `sku`, `tg_id`, `charge_id` único, estado, fecha |
| `ad_events` | colocación, proveedor, `ymid`, confirmado por el proveedor |

Cada tabla guarda solo lo necesario: id de Telegram, idioma y nombre visible opcional. Hay que ofrecer borrado de datos.

## 3. Ranking global

- **Tablas**: diario (mismo reto para todos, por la semilla de fecha), semanal (evento semanal) y global (mejor tiempo). Lectura: top 100 más la posición del jugador. Caché de unos segundos.
- **Envío**: al terminar una partida, `POST /runs` con modo, semilla, tiempo, bajas, nivel y build final. El servidor responde con la posición.
- **Anti-trampas proporcional** (casual, sin sobreinvertir):
  1. Validar firma y `auth_date`; limitar por usuario (p. ej. N partidas por hora).
  2. Plausibilidad: tiempo máximo igual a la duración de la partida, bajas por segundo y XP/nivel coherentes con el tiempo, build válida (4 armas + 4 pasivas).
  3. Percentil: las puntuaciones fuera de rango no entran al ranking público y quedan marcadas para revisión.
  4. Mejora posible: RNG sembrado y registro de entradas para repetir la partida en el servidor. Hoy el juego usa `Math.random()`, así que haría falta sembrarlo (trabajo propio, solo si hay trampas reales).
- **Nombres**: mostrar el nombre de Telegram solo con consentimiento; si no, alias generado. Moderar con una lista básica.

## 4. Referidos

- **Enlace**: `https://t.me/<bot>/<app>?startapp=ref_<tg_id>`; el servidor lee `start_param` de `initData` en el primer inicio de sesión del invitado.
- **Premio** (Chispas y fragmentos, sin valor monetario): se entrega al invitador cuando el invitado completa su primera partida (referido "verificado"), con tope diario y total.
- **Antifraude**: un solo invitador por cuenta, solo cuentas nuevas, el invitador y el invitado no pueden coincidir, y se revisan picos anómalos por invitador.
- **Cliente**: ya existe "Retar a un amigo"; solo cambia el enlace y se añade una pantalla de referidos en Hoy.

## 5. Notificaciones

- **Permiso**: un bot solo puede escribir a quien ha iniciado el bot o ha concedido permiso de escritura; se pide con el diálogo de Telegram en un momento con valor (p. ej. tras la primera racha), nunca al abrir.
- **Mensajes**: racha en peligro, reto diario nuevo y evento semanal. Máximo uno al día, en la franja horaria del jugador, en su idioma, con opción de apagarlo en Ajustes.
- **Envío**: cron + cola; respetar el límite de envío masivo de Telegram (del orden de decenas de mensajes por segundo; verificar) y reintentar con espera. Un `403` (el usuario bloqueó el bot) desactiva sus avisos.
- **Entrada**: webhook (`setWebhook`) para `/start`, parámetros de arranque y bajas.

## 6. Compras con Stars

Los bienes digitales dentro de una Mini App se cobran con **Telegram Stars** (moneda `XTR`); sin pasarela externa ni `provider_token` (verificar términos vigentes).

Flujo:
1. Cliente: `POST /shop/invoice {sku}` (con sesión).
2. Servidor: `createInvoiceLink` en XTR con el `sku` en el payload; devuelve el enlace.
3. Cliente: `Telegram.WebApp.openInvoice(link, cb)`.
4. Bot: recibe `pre_checkout_query`, valida el SKU y responde a tiempo con `answerPreCheckoutQuery`.
5. Bot: recibe `successful_payment`; guarda `telegram_payment_charge_id` (único, para ser idempotente) y concede el ítem en la tabla `purchases` y en el guardado.
6. Cliente: refresca el guardado desde el servidor (nunca concede localmente).
7. Reembolsos: `refundStarPayment` desde un panel de administración.

Catálogo propuesto (cosmético y comodidad, sin ventaja de poder):
- skins sueltas (cualquier rareza, sin pasar por la barra de anuncios);
- pase de skins de temporada;
- "sin anuncios opcionales extra": quita el tope diario de 15 y la espera de 60 s a los ya-pagadores, pero nunca anuncios forzados.

Las Chispas **no** se venden ni se pueden retirar. El precio en Stars lo fija el catálogo del servidor.

## 6.1 Anuncios con verificación

Pasar la concesión de recompensas de anuncio a servidor: AdsGram y Monetag pueden notificar la visualización completada a una URL propia (para Monetag, el `ymid` que ya enviamos; para AdsGram, su URL de recompensa; verificar en sus paneles). Así los topes diarios dejan de depender del cliente.

## 7. Fases

| Fase | Entrega | Criterio de salida |
| --- | --- | --- |
| 1. Base | Auth por `initData`, `RemoteBackendStub` real, analytics remoto, `users`/`saves` | Un jugador abre en otro dispositivo y recupera todo; el guardado local sigue como respaldo |
| 2. Ranking | `runs`, `leaderboard`, pantalla de ranking diario/semanal | Ranking estable con picos controlados y tasa baja de partidas descartadas |
| 3. Social | Referidos + notificaciones + webhook | Referidos verificados sin abuso; baja por opt-out visible |
| 4. Stars | Catálogo, facturas, `purchases`, panel de reembolsos | Compra de extremo a extremo e idempotente; conciliación diaria |

Orden por riesgo: lo cosmético y el ranking primero; el dinero (Stars) al final, con la autoridad del servidor ya probada.

## 8. Riesgos y decisiones abiertas

- **Trampas**: sin servidor autoritativo en v1 hay progreso manipulable. En v2 el servidor decide Chispas, compras y ranking; el guardado remoto debe aceptar solo cambios plausibles (delta máximo por partida).
- **Migración**: al activar el servidor, el primer inicio sube el guardado local; si ya hay uno remoto, gana el de `updatedAt` más reciente (regla actual de `SaveManager`) y se archiva el otro.
- **Privacidad**: datos mínimos, política de privacidad, borrado a petición y nombres opt-in.
- **Coste**: el volumen de escritura del ranking y de las notificaciones decide el plan del proveedor; medirlo en la fase 1.
- **Cumplimiento**: revisar las normas de Telegram y de las tiendas para bienes digitales, y las de AdsGram/Monetag sobre anuncios con compras.
