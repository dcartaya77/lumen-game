# LUMEN: guía de despliegue

Juego estático (sin servidor ni base de datos). Hay que publicar la carpeta `dist/` en HTTPS, crear un bot, apuntar su Mini App a esa URL y, opcionalmente, conectar anuncios.

> Los nombres exactos de los menús de BotFather y de los paneles de AdsGram/Monetag pueden cambiar. Ante una diferencia, manda la documentación oficial ([Mini Apps](https://core.telegram.org/bots/webapps), [AdsGram](https://docs.adsgram.ai/), [Monetag](https://docs.monetag.com/)).

## 1. Variables de entorno

Se leen al compilar (`VITE_*`); copia `.env.example` a `.env` en local o defínelas en el panel del hosting.

| Variable | Para qué | Obligatoria |
| --- | --- | --- |
| `VITE_BOT_USERNAME` | Usuario del bot sin `@`; construye el enlace de "Retar a un amigo" | Sí |
| `VITE_APP_SHORT_NAME` | Nombre corto de la Mini App creada con `/newapp` (enlace `t.me/bot/nombre`). Vacío = enlace al bot | No |
| `VITE_ADSGRAM_BLOCK_ID` | ID del bloque "Reward" de AdsGram | No |
| `VITE_ADSGRAM_DEBUG` | `true` = banners de prueba de AdsGram. Solo staging | No |
| `VITE_MONETAG_ZONE_ID` / `VITE_MONETAG_SDK_URL` | Zona principal y URL del `sdk.js` de Monetag (respaldo) | No |
| `VITE_ADS_PROVIDER` | `auto` (por defecto), `mock` (anuncio simulado de 1,5 s) o `none` | No |

Sin IDs de anuncios, una build de producción muestra el juego sin ofertas de anuncio (todo sigue siendo jugable). En desarrollo (`npm run dev`) se usa el anuncio simulado.

## 2. Compilar y revisar en local

```bash
npm install
npm run build      # typecheck + dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

Tamaño de arranque: unos 100 KB gzip (`index` + `react`). PixiJS (~100 KB gzip) se descarga al empezar la primera partida y se precarga cuando el menú está ocioso.

## 3. Hosting estático

Cualquiera sirve; la URL debe ser **HTTPS**. Los tres comparten ajustes:

| Ajuste | Valor |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node | 22 (LTS) |
| Variables | las de la sección 1 |

- **Cloudflare Pages**: Workers & Pages → Create → Pages → conectar el repositorio.
- **Vercel**: Add New → Project → importar; detecta Vite solo.
- **Netlify**: Add new site → Import from Git.

Las cabeceras de caché ya están en `public/_headers` (Cloudflare y Netlify) y `vercel.json` (Vercel): `index.html` sin caché y `assets/` inmutables, para que cada despliegue llegue a los jugadores sin versiones viejas atascadas en el cliente de Telegram. La app usa rutas relativas (`base: './'`), así que funciona en la raíz o en un subdirectorio.

No añadas `X-Frame-Options: DENY` ni un `frame-ancestors` que excluya a Telegram: Telegram Web carga la Mini App en un iframe. Si quieres endurecerlo, incluye como mínimo `https://web.telegram.org` y prueba en Telegram Web antes de publicar.

## 4. Crear el bot (BotFather)

1. En Telegram abre [@BotFather](https://t.me/BotFather) y envía `/newbot`.
2. Nombre visible (p. ej. `LUMEN`) y usuario único acabado en `bot` (p. ej. `lumen_game_bot`).
3. Copia ese usuario en `VITE_BOT_USERNAME`.
4. Guarda el token del bot fuera del repositorio. Esta versión no lo usa (no hay servidor); se necesitará en la v2.
5. Opcionales: `/setdescription`, `/setabouttext`, `/setuserpic`.

## 5. Configurar la Mini App

Elige una o combina varias:

**A. Mini App principal (recomendada).** Aparece el botón "Abrir app" en el perfil del bot y puede salir en la tienda de Mini Apps de Telegram.
1. `/mybots` → tu bot → **Bot Settings** → **Configure Mini App** → **Enable Mini App**.
2. Pega la URL HTTPS del despliegue.
3. Enlace directo: `https://t.me/<bot>?startapp` (admite `&mode=compact` o `&mode=fullscreen`).

**B. Mini App con enlace directo.**
1. `/newapp` → elige el bot → título, descripción, imagen 640×360, GIF opcional, URL HTTPS y **nombre corto**.
2. Enlace: `https://t.me/<bot>/<nombre_corto>`.
3. Pon el nombre corto en `VITE_APP_SHORT_NAME` y vuelve a compilar: los enlaces compartidos abrirán el juego directamente.

**C. Botón de menú** (junto al campo de escritura): Bot Settings → **Menu Button** → URL del despliegue.

## 6. Probar dentro de Telegram

La Mini App solo se comporta del todo dentro del cliente. Mientras desarrollas, expón el servidor local con un túnel HTTPS:

```bash
npm run dev                                   # o npm run preview tras build
cloudflared tunnel --url http://localhost:5173  # o: ngrok http 5173
```

Usa la URL `https://…` del túnel como URL de la Mini App (Configure Mini App o `/newapp`). Vite ya admite los dominios `trycloudflare.com` y `ngrok`.

Lista de comprobación en móvil y en escritorio:

- [ ] Abre a pantalla completa (`expand`), con tema claro y oscuro.
- [ ] Márgenes seguros correctos (muesca, barra inferior).
- [ ] Botón atrás de Telegram: sale de las pantallas y pausa en partida.
- [ ] Deslizar hacia abajo **no** cierra la app durante la partida.
- [ ] Vibración háptica en nivel-up, élites y jefe.
- [ ] Guardado: juega, ciérrala, ábrela desde otro dispositivo y comprueba que el progreso está (CloudStorage). Ajustes muestra "Nube de Telegram".
- [ ] "Retar a un amigo" abre el selector de chats con el enlace y el texto.
- [ ] Idioma: español con Telegram en español, inglés en el resto.

## 7. AdsGram (anuncio principal)

1. Regístrate como publisher en <https://partner.adsgram.ai/registration>.
2. Añade tu Mini App (enlace del bot/Mini App) y espera la aprobación si el panel la exige.
3. Crea un bloque de formato **Reward** y copia su **Block ID**.
4. Ponlo en `VITE_ADSGRAM_BLOCK_ID` en el hosting y vuelve a desplegar.
5. Para validar sin esperar a que haya campañas, despliega una build de staging con `VITE_ADSGRAM_DEBUG=true` (banners de prueba). **Quítalo en producción.**

**Monetag (respaldo opcional).** Crea la zona de Mini Apps en su panel, copia la zona principal (no una subzona) en `VITE_MONETAG_ZONE_ID` y la URL del SDK en `VITE_MONETAG_SDK_URL`. Si AdsGram no tiene anuncio, el juego prueba con Monetag; si el jugador cierra un anuncio a medias, no se salta a otro.

## 8. Probar los anuncios

El juego solo concede recompensa cuando el SDK confirma que el anuncio se vio entero. Topes locales: máximo 15 al día, 60 s entre anuncios y 120 s entre ofertas automáticas (revivir).

| Punto | Cómo probarlo | Esperado |
| --- | --- | --- |
| Revivir | Muere en una partida | Cuenta atrás de 5 s; tras el anuncio, 50 % de vida y explosión; una vez por partida |
| Re-sorteo | Sube de nivel | 1 gratis; después, botón de anuncio (hasta 2 más) |
| x2 Chispas | Termina la partida | Suma de nuevo las Chispas de esa partida, una vez |
| Cofre | Pantalla "Hoy" | Gratis una vez; segundo cofre con anuncio |
| Ruleta | Pantalla "Hoy" | 1 gratis + 3 con anuncio |
| Impulso inicial | Menú | Próxima partida empieza con +1 nivel |
| Reparar racha | Racha rota (último día jugado anterior a ayer) | Una vez por semana |
| Skins | Skins → skin épica/legendaria | La barra suma 1 por anuncio; al llenarse se desbloquea |
| Prueba de skin | Skin legendaria sin tener | Una partida con ella; solo una pendiente a la vez |

Qué vigilar:

- Cierra el anuncio antes de tiempo: no debe haber recompensa y debe salir el aviso de "mira el anuncio completo".
- Sin conexión o sin campaña: el botón se oculta o muestra "vuelve en un momento"; nunca queda roto.
- Consola del navegador (o `eruda`/inspector remoto): eventos `[analytics]` `ad_offered`, `ad_accepted`, `ad_completed`, `ad_abandoned`, `ad_error`.
- Para forzar los flujos sin red usa `VITE_ADS_PROVIDER=mock` en staging.
- Siempre valida el flujo final **dentro de Telegram**, no solo en el navegador.

## 9. Antes de publicar

- [ ] `VITE_ADSGRAM_DEBUG` vacío y `VITE_ADS_PROVIDER` sin `mock`.
- [ ] `npm run build` sin errores; el despliegue sirve `index.html` sin caché.
- [ ] Probado en un Android de gama baja (60 fps con el ajuste automático de partículas) y en iOS.
- [ ] Textos del bot y de la Mini App sin lenguaje de "ganar dinero": las Chispas y fragmentos son solo del juego, no se pueden retirar ni vender.
- [ ] Política de privacidad enlazada si tu red de anuncios la exige: los SDK de anuncios pueden recoger datos del dispositivo aunque el juego no guarde nada propio.

## 10. Problemas frecuentes

| Síntoma | Causa probable |
| --- | --- |
| Pantalla en blanco en Telegram | URL no HTTPS, build sin desplegar o cabecera que bloquea el iframe |
| Cambios que no aparecen | `index.html` cacheado: revisa `_headers`/`vercel.json`; cierra y reabre la Mini App |
| El progreso no se sincroniza | Cliente con versión de la API < 6.9: usa `localStorage` y no hay sincronización entre dispositivos |
| No salen anuncios | Falta `VITE_ADSGRAM_BLOCK_ID` (tras añadirlo hay que recompilar), bloque no aprobado o tope/espera local activos |
| El túnel responde "Blocked request" | Dominio del túnel no incluido en `server.allowedHosts` de `vite.config.ts` |
