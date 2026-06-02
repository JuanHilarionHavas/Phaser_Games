# Flashlight Game ("Detecta al intruso") — Diseño

**Fecha:** 2026-06-01
**Cliente:** Prosegur Alarms
**Ubicación:** `Phaser_Games/finder-game/Proyecto/`
**Formato:** Banner 300×600 (rich media / playable ad)

## 1. Objetivo

Mini-juego de "linterna en la oscuridad": la pantalla muestra el plano de una casa a oscuras y el jugador mueve el cursor (una linterna) para iluminar zonas y encontrar a un intruso escondido. Al iluminar al intruso, suena/parpadea una alarma y el juego se reinicia (o avanza de pantalla en GWD). Refuerza el mensaje de Prosegur de monitoreo y detección 24/7.

## 2. Alcance

**Incluye** solo la **fase de juego** (equivalente a las pantallas `FlashlightGame2` y `FlashlightGame3` del mockup):

- Fondo de la casa oscurecido salvo el haz de la linterna que sigue el cursor.
- Intruso en posición aleatoria dentro de un rango configurable.
- Detección automática por proximidad cursor↔intruso.
- Cronómetro ascendente en el DOM.
- Efecto de alarma (flash rojo) al detectar.
- Reinicio automático + callback para producción (GWD).

**NO incluye** (fuera de alcance):

- Pantalla intro con botón "Jugar ahora" (`FlashlightGame1`).
- Pantalla de resultado "¡Intruso detectado! Tu tiempo fue de…" (`FlashlightGame4`).
- Pantalla final de oferta/CTA "Conoce más" (`FlashlightGame5`).
- Empaquetado GWD (se hará después, en otra iteración; este spec deja los ganchos listos: `restartOnFound` y el callback).

## 3. Assets disponibles

`finder-game/Proyecto/assets/`

| Asset | Dimensiones | Uso |
|---|---|---|
| `Fondo.png` | 600×1200 (retina 2× de 300×600) | Plano cenital de la casa, fondo a pantalla completa |
| `Intruso.png` | 300×300 (PNG transparente) | Ladrón escondido; se escala (~0.18) |
| `LogoProsegurBlanco.png` | 217×59 | Logo en el header (DOM) |
| `Fonts/Poppins-Bold.ttf`, `Poppins-Regular.ttf` | — | Tipografía del DOM (logo/tiempo) |

## 4. Arquitectura

Sigue el patrón del repo (idéntico al `drag-and-drop-game` de Prosegur):

- **`index.html`** — wrapper 300×600, elementos DOM (header con logo + "Tiempo: NN"), el objeto global `window.GAME_CONFIG`, el módulo de cronómetro DOM, y la inicialización de Phaser. Carga Phaser 3.60.0 por CDN (`cdn.jsdelivr.net/npm/phaser@3.60.0`) y `main.js`.
- **`main.js`** — lógica del juego en dos escenas Phaser: `PreloaderScene` (carga assets) y `GameScene` (juego).

Phaser se inicializa con `transparent: false` y el fondo lo aporta la imagen de la casa.

### 4.1 Capas del canvas (orden de profundidad, de abajo a arriba)

1. **Fondo** — `Fondo.png` escalado a 300×600.
2. **Intruso** — `Intruso.png` posicionado aleatoriamente (escala configurable).
3. **Overlay de oscuridad** — rectángulo del color/alpha de `flashlight` a pantalla completa, enmascarado por la linterna (ver 4.2).
4. **Capa de alarma** — rectángulo rojo a pantalla completa, `alpha = 0`, que parpadea al detectar.

### 4.2 Efecto linterna (Enfoque A — máscara radial invertida)

1. En `PreloaderScene`/`create`, generar por código una **textura radial** (`lightTexture`) en un canvas 2D con `createRadialGradient`:
   - centro → blanco `alpha 1`,
   - hasta `radius * (1 - softness)` → blanco `alpha 1`,
   - hasta `radius` → blanco `alpha 0` (borde difuso).
   Tamaño del canvas = `radius * 2`. Registrar con `scene.textures.addCanvas('lightTexture', canvas)`.
2. Crear `lightSprite = scene.add.image(x, y, 'lightTexture')` (no se dibuja en pantalla; se usa como máscara).
3. Crear el `overlay` (rectángulo color `flashlight.color`, `alpha = flashlight.darkness`, a pantalla completa).
4. `const mask = new Phaser.Display.Masks.BitmapMask(scene, lightSprite); mask.invertAlpha = true; overlay.setMask(mask);`
   → El overlay se **muestra** donde `lightSprite` es transparente (zona oscura) y se **oculta** donde es opaco (el haz revela el fondo).
5. En `update()`: `lightSprite.setPosition(pointer.worldX, pointer.worldY)` para que el haz siga el cursor.

Resultado: círculo de luz con borde suave sobre fondo casi negro, configurable vía `flashlight.radius`, `softness`, `darkness`, `color`. Coincide con el mockup.

### 4.3 Posición del intruso (aleatoria o fija)

En `create()`, según `intruso.randomPosition`:

- `true` → posición al azar dentro de `intruso.spawnArea` (rectángulo `xMin/xMax/yMin/yMax`), ajustado al **interior** de la casa (sin jardín perimetral ni terraza exterior).
- `false` → posición fija en `intruso.fixedPosition` (`{x, y}`).

```js
const I = CFG.intruso;
let x, y;
if (I.randomPosition) {
  x = Phaser.Math.Between(I.spawnArea.xMin, I.spawnArea.xMax);
  y = Phaser.Math.Between(I.spawnArea.yMin, I.spawnArea.yMax);
} else {
  ({ x, y } = I.fixedPosition);
}
```

El `spawnArea` por defecto se ajusta al interior visible de `Fondo.png` (excluye el jardín de los bordes/esquinas y la terraza superior). Se calibrará visualmente al ver el primer render.

### 4.4 Detección

En `update()`, mientras el juego esté activo:

```js
const d = Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, intruso.x, intruso.y);
if (d < CFG.detection.detectRadius) this.onFound();
```

`onFound()` corre **una sola vez** (flag `this.found`).

### 4.5 Secuencia al encontrar al intruso (`onFound`)

1. Marcar `this.found = true` y detener detección.
2. Guardar el tiempo: `this.elapsedSeconds = window.getTimerSeconds()`; exponerlo en `window.tiempoFinal`.
3. Detener el cronómetro DOM: `window.stopTimer()`.
4. **Alarma:** tween del rectángulo rojo `alpha 0 → flashAlpha`, `yoyo`, `repeat = flashCount - 1`, duración `flashDuration`.
5. Si `alarm.revealHouseOnFound`: tween del `overlay.alpha → 0` (se ve toda la casa con el intruso) durante el flash.
6. Disparar callback de producción: `if (typeof CFG.onFoundCallback === 'function') CFG.onFoundCallback(this.elapsedSeconds)` y `if (window.onIntrusoEncontrado) window.onIntrusoEncontrado(this.elapsedSeconds)`.
7. Si `CFG.restartOnFound === true` (Proyecto standalone): tras un pequeño delay (`alarm` total + margen), reposicionar al intruso al azar, restaurar `overlay.alpha = darkness`, `window.resetTimer()`, `this.found = false`, y reanudar (el cronómetro vuelve a arrancar en el siguiente movimiento del cursor).
   Si `restartOnFound === false` (GWD): no reinicia; el callback se encarga de avanzar de pantalla.

## 5. Cronómetro (DOM)

El cronómetro vive en el DOM (no en Phaser), siguiendo el patrón de `runner`/`kickups`.

- **Referencia configurable:** `timer.selector` (ej. `"#time-display"`) y `timer.label` (ej. `"Tiempo:"`). El módulo del `index.html` lee el elemento con `document.querySelector(CFG.timer.selector)`.
- **API global** (consumida por Phaser):
  - `window.startTimer()` — arranca el conteo (idempotente).
  - `window.stopTimer()` — detiene y fija el valor.
  - `window.resetTimer()` — vuelve a 0 (y rearma el inicio en el siguiente movimiento).
  - `window.getTimerSeconds()` — devuelve los segundos transcurridos.
- **Inicio:** `timer.startOn = "firstMove"` → arranca con el primer `mousemove`/`pointermove` sobre el juego (configurable a `"load"` para arrancar al cargar).
- **Variable consultable del resultado:** al detener, el valor final se guarda en `window.tiempoFinal` (segundos, entero) **y** en `this.elapsedSeconds` de la escena, y se pasa al callback. Así se puede consultar después igual que el score/highscore de los otros juegos.
- **Render:** el display muestra `${label} ${segundos}` (ej. "Tiempo: 15"), formateado por el módulo DOM.

## 6. Comunicación Phaser ↔ DOM

| Dirección | Mecanismo |
|---|---|
| Phaser → DOM (timer) | `window.startTimer()`, `window.stopTimer()`, `window.resetTimer()`, `window.getTimerSeconds()` |
| Phaser → exterior (hallazgo) | `CFG.onFoundCallback(segundos)` + `window.onIntrusoEncontrado(segundos)` + `window.tiempoFinal` |
| DOM → Phaser | No necesario en esta fase (no hay botón "Jugar"; el juego arranca solo) |

## 7. `GAME_CONFIG` (objeto de configuración completo)

**Convención:** cada propiedad lleva un comentario en español a su lado explicando qué hace, para poder ajustar el juego sin leer el código.

```js
window.GAME_CONFIG = {
  width: 300,                  // ancho del juego en px (canvas y wrapper)
  height: 600,                 // alto del juego en px (canvas y wrapper)
  assetsPath: "assets/",       // carpeta base de los assets

  // ===== FONDO (plano de la casa) =====
  background: {
    key: "fondo",              // nombre interno de la textura en Phaser
    path: "Fondo.png"          // archivo del fondo (relativo a assetsPath)
  },

  // ===== INTRUSO =====
  intruso: {
    key: "intruso",            // nombre interno de la textura en Phaser
    path: "Intruso.png",       // archivo del intruso (relativo a assetsPath)
    scale: 0.18,               // escala del sprite (0.18 sobre el asset de 300px ~54px)
    randomPosition: true,                  // true = aleatorio en spawnArea; false = usa fixedPosition
    fixedPosition: { x: 150, y: 330 },     // coords usadas cuando randomPosition = false
    spawnArea: { xMin: 55, xMax: 250, yMin: 140, yMax: 520 } // interior de la casa (sin exterior)
  },

  // Linterna (Enfoque A: overlay + máscara radial invertida)
  flashlight: {
    radius: 45,       // radio del haz visible (px) — igual al detectRadius
    softness: 0.45,   // suavidad del borde (0 = duro, 1 = muy difuso)
    darkness: 0.96,   // opacidad de la oscuridad (1 = negro total)
    color: 0x000000   // color de la oscuridad
  },

  // Detección por proximidad
  detection: {
    detectRadius: 45  // distancia cursor↔intruso para considerarlo "encontrado" (px)
  },

  // Alarma al detectar
  alarm: {
    flashColor: 0xff0000,      // color del parpadeo de alarma (hex, rojo)
    flashAlpha: 0.45,          // opacidad máxima del parpadeo (0 a 1)
    flashDuration: 250,        // ms por parpadeo
    flashCount: 3,             // número de parpadeos
    revealHouseOnFound: true   // ilumina toda la casa durante la alarma
  },

  // Cronómetro (DOM)
  timer: {
    enabled: true,             // activa/desactiva el cronómetro
    selector: "#time-display", // selector del elemento DOM donde se muestra el tiempo
    label: "Tiempo:",          // texto que precede al número (ej. "Tiempo: 15")
    startOn: "firstMove"       // cuándo arranca: "firstMove" (al mover el cursor) | "load" (al cargar)
  },

  // Producción
  restartOnFound: true,        // true en Proyecto; GWD lo pondrá en false
  restartDelay: 1200,          // ms antes de reiniciar tras la alarma
  onFoundCallback: null        // function(segundos) — gancho para GWD/banner
};
```

## 8. Layout del DOM (`index.html`)

- `#game-wrapper` (300×600, `overflow: hidden`, fondo negro).
- `#dom-header` (absolute, top): a la izquierda `LogoProsegurBlanco.png`, a la derecha `#time-display` ("Tiempo: 0"). Tipografía Poppins. `pointer-events: none` para no bloquear la linterna.
- `#game-container` (canvas Phaser, 100%).

## 9. Criterios de aceptación

1. Al cargar, la casa aparece a oscuras salvo el haz de la linterna, que sigue el cursor con borde suave.
2. Con `randomPosition: true`, el intruso aparece en una posición distinta (aleatoria, dentro del rango interior) en cada recarga; con `randomPosition: false`, aparece siempre en `fixedPosition`.
3. Al acercar el centro de la linterna al intruso (< `detectRadius`), se dispara la detección automáticamente (sin clic).
4. La detección produce el flash rojo de alarma (`flashCount` parpadeos) y, si está activo, revela la casa completa.
5. El cronómetro arranca con el primer movimiento, sube de 1 en 1 segundo, se muestra en `#time-display`, y se detiene al encontrar al intruso.
6. El tiempo final queda consultable en `window.tiempoFinal` y se pasa al callback.
7. En el Proyecto (`restartOnFound: true`), el juego se reinicia con el intruso en nueva posición y el cronómetro en 0.
8. Todos los parámetros (radio/suavidad/oscuridad de la luz, rango del intruso, detección, alarma, timer) se controlan desde `window.GAME_CONFIG`.

## 10. Riesgos / notas

- **`BitmapMask` + `invertAlpha`** requiere `Phaser.AUTO` con WebGL (es el caso por defecto). En Canvas2D el `invertAlpha` puede no aplicar; documentar que el banner se sirve en navegadores con WebGL (estándar en DV360).
- El `pointer` en escritorio es el mouse; en móvil el haz seguirá el dedo mientras se toca. Para banners táctiles considerar seguir `pointer` en `pointermove` aunque no haya "hover" (validar en QA; fuera del alcance de esta fase si el target es desktop).
- Mantener el spec sincronizado con el futuro empaque GWD (`restartOnFound: false` + callback que avanza de pantalla).
