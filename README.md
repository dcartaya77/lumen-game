# LUMEN

**Sobrevive a la noche infinita.** LUMEN es un survivor de acción pensado para jugar en el móvil como Mini App de Telegram: controlas una pequeña llama que resiste oleadas de sombras, crece con cada nivel y se enfrenta a jefes cada cinco noches hasta devolver la luz al mundo.

Es un juego solo de cliente (web estática, sin servidor ni base de datos) y de puro entretenimiento: no hay tokens, cripto ni "ganar dinero". Está en español e inglés.

## En qué consiste

Cada partida es una noche. Mueves tu llama con un dedo (joystick flotante que aparece donde tocas) o con WASD / flechas, y tus armas atacan solas. Las sombras que derrotas sueltan fragmentos de luz: al recogerlos subes de nivel y eliges **una de tres mejoras** (arma nueva, mejora de arma o pasiva). Si sobrevives hasta el amanecer, la noche se supera; si caes, ganas Chispas igualmente y vuelves a intentarlo con más fuerza.

### Construir tu llama
- **Hasta 4 armas y 4 pasivas** por partida. Cada arma sube hasta nivel 5.
- **Evoluciones**: un arma al máximo, combinada con la pasiva adecuada, se transforma en su versión definitiva.

| Arma | Qué hace | Evoluciona con | Resultado |
|---|---|---|---|
| Chispa | Lanza chispas al enemigo más cercano | Imán | Tormenta Eléctrica |
| Brasas | Aura ardiente que quema a quien se acerca | Vigor | Hoguera |
| Luces Errantes | Orbes que giran a tu alrededor y empujan | Ligereza | Corona Solar |
| Haz Lunar | Rayo que atraviesa a todos en línea | Fervor | Haz Estelar |
| Luciérnagas | Luces que persiguen a los enemigos | Prisa | Enjambre |
| Onda de Luz | Anillo expansivo que daña y empuja | Corteza | Pulso Solar |

Pasivas: Vigor (vida), Ligereza (velocidad), Fervor (daño), Imán (radio de recogida), Prisa (menos tiempo entre ataques) y Corteza (menos daño recibido).

### Héroes
| Héroe | Estilo | Cómo se consigue |
|---|---|---|
| **Ascua** | La primera llama: equilibrada, dispara chispas | Desde el inicio |
| **Brasa** | Lenta pero incansable: aura ardiente y regeneración | Chispas |
| **Iris** | Orbes giratorios y un imán enorme para la luz | Chispas |
| **Fénix** | La llama que renace: ondas de luz, regeneración y más daño | Racha de 7 días |

Cada héroe empieza con su propia arma y mantiene su identidad: no hay un arma "buena" compartida.

### Enemigos
Sombras, Fuegos Fatuos, Brutos, Motas, Embestidores, Escupidores, Cáscaras (que se rompen en motas) y Errantes, con élites durante la noche. La partida rápida incluye un jefe, **La Tragasombras**, que aparece hacia el minuto 4:15.

## Modos de juego

### Campaña: 25 noches
- Cinco tramos con su propio mapa (Bosque Sombrío, Ruinas Antiguas, Desierto de Cristal, Ciudad Neón y El Vacío) y una dificultad que crece noche a noche.
- **Estrellas** (1 a 3) según las sombras derrotadas.
- **Minijefes** que irrumpen durante la noche, cada uno con su propia mecánica: Gran Embestidor, Rey Escupidor, Invocador de Enjambres, Reptante Corrosivo, Centinela Giratorio (su escudo bloquea un lado) y Espectro Fugaz (se teletransporta).
- **Un jefe cada cinco noches**, con duelo en arena, ataques telegrafiados, fases y un núcleo que se abre para que lo golpees:

| Noche | Jefe | Mecánica |
|---|---|---|
| 5 | El Devorador de Luz | Absorbe los fragmentos de luz y se refuerza si no los recoges tú primero |
| 10 | El Eclipse Voraz | Oscuridad: solo ves cerca de tu llama y él ataca desde la sombra |
| 15 | El Espejo Ladrón | Copia tus armas y te las devuelve |
| 20 | El Coloso de Cristal | Blindado por cristales: hay que romperlos para dañarlo |
| 25 | El Apagaestrellas | Final: mezcla oscuridad, luz robada y cristales |

  La vida de cada jefe se adapta al daño que haces, así que un build flojo puede vencerlo con esfuerzo y uno fuerte no lo trivializa. Durante el duelo dispones de un **dash**.
- **Talismanes**: objetos de un solo uso (Égida, Nova, Escarcha, Brasa vital, Imán estelar, Reloj de arena, Furia) con cuatro rarezas, que los minijefes sueltan en cofres y que equipas antes de cada noche (una ranura, y una segunda al vencer al primer jefe). Cada jefe deja además un talismán y una skin exclusivos.
- Un **final** al vencer al Apagaestrellas.

### Partida rápida
Una noche suelta de 5 minutos en el mapa que elijas, ideal para sesiones cortas.

### Retos y rutinas diarias
- **Reto diario**: mismo mapa y modificador para todos los jugadores, con un tiempo objetivo y botón para retar a un amigo.
- **Evento semanal** (Noche de Tormenta, Marea Sombría, Luz Tenue, Noche Maldita) con bonus de Chispas.
- **Misiones diarias** (3 al día) y **logros**.
- **Racha diaria**: premio creciente por jugar cada día; 7 días seguidos desbloquean a Fénix.
- **Cofre de la noche** y **ruleta de la suerte**, con tiradas extra opcionales.

## Progresión
- **Chispas**: la moneda del juego. Se ganan en cada partida y se gastan en la tienda.
- **Mejoras permanentes** (7, de 5 niveles): vida, daño, velocidad, radio de recogida, armadura, regeneración y XP.
- **Mapas** con bonus de Chispas, **héroes** y **32 skins** (llama, armas, efecto de muerte, subida de nivel y marcos de resultados). Algunas se compran, otras se consiguen con anuncios opcionales o derrotando a un jefe.
- **Álbum** con todo lo que has descubierto.

## Telegram y anuncios
- Es una **Mini App de Telegram**: usa el SDK oficial para el tema, el feedback háptico y compartir. El progreso se guarda en CloudStorage de Telegram, con `localStorage` como respaldo. Fuera de Telegram el juego funciona igual en el navegador.
- Los **anuncios son opcionales y siempre los inicia el jugador** (AdsGram como principal, Monetag de respaldo); la recompensa solo se concede si el anuncio se completa, y hay topes diarios y de frecuencia. Sin IDs de anuncios, una build de producción va sin anuncios (en desarrollo se usa un anuncio simulado).

## Tecnología
Vite 8 · React 19 · TypeScript 5.9 (estricto) · Zustand 5 · PixiJS 8. El motor del juego (`src/game/`) es PixiJS sin React y se carga bajo demanda; la interfaz es React y se comunica con él por el estado y eventos. Los datos de contenido (armas, enemigos, héroes, jefes…) y el balance viven en `src/data/` y en JSON (`src/data/balance/`).

## Empezar a desarrollar

Requisitos: Node.js 22.18 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo (accesible por la red local, útil para probar en el móvil)
npm run typecheck  # comprobación de tipos
npm test           # tests unitarios (node:test)
npm run build      # typecheck + build estático en dist/
npm run preview    # sirve dist/
```

Para configurar el bot, los anuncios y las variables de entorno, copia `.env.example` a `.env` y sigue la [guía de despliegue](docs/DEPLOY.md). El resultado de `npm run build` es una web estática que sirve cualquier hosting (Cloudflare Pages, Vercel, Netlify).

En desarrollo el **modo debug** está siempre activo: la barra de partida permite invocar minijefes y saltar a los duelos de jefe; en producción se activa con siete toques sobre la versión en Ajustes.

## Estructura

```
src/
  data/        contenido tipado (armas, héroes, enemigos, jefes, talismanes, skins…)
  data/balance/  balance en JSON: campaña, economía y héroes
  game/        motor PixiJS (jugador, enemigos, armas, jefes, minijefes, audio)
  state/       estado (Zustand) y esquema de guardado versionado
  services/    guardado, anuncios y analítica detrás de interfaces
  platform/    único punto de acceso a Telegram.WebApp
  ui/          pantallas y componentes React
  i18n/        textos en español e inglés
tests/         tests unitarios
docs/          guía de despliegue y roadmap de la v2
```

## Documentación
- [Guía de despliegue](docs/DEPLOY.md): variables de entorno, hosting, BotFather, Mini App y pruebas de anuncios.
- [Roadmap v2](docs/ROADMAP-V2.md): diseño del backend (ranking global, referidos, notificaciones y compras con Stars).
- [AGENTS.md](AGENTS.md): notas de arquitectura y de balance para quien (persona o agente) trabaje en el código.
