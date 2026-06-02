# Flashlight Game ("Detecta al intruso") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la fase de juego del creativo Prosegur "Detecta al intruso": una casa a oscuras donde el cursor actúa de linterna; al iluminar al intruso suena una alarma (flash rojo), se guarda el tiempo y el juego reinicia.

**Architecture:** Patrón del repo (igual que `drag-and-drop-game`): `index.html` con wrapper 300×600, DOM header (logo + cronómetro), `window.GAME_CONFIG` totalmente comentado, módulo de cronómetro en DOM y arranque de Phaser; `main.js` con `PreloaderScene` + `GameScene`. El efecto linterna usa un overlay oscuro a pantalla completa enmascarado por una textura radial invertida (`BitmapMask.invertAlpha`) que sigue al puntero. La detección es por proximidad cursor↔intruso.

**Tech Stack:** HTML/CSS/JS vanilla, Phaser 3.60.0 (CDN jsDelivr). Spec de referencia: [docs/superpowers/specs/2026-06-01-flashlight-game-design.md](../specs/2026-06-01-flashlight-game-design.md).

**Verificación (sin test runner):** cada tarea se valida levantando un servidor local y observando el resultado en el navegador. Comandos usados a lo largo del plan:
- Servidor: en `finder-game/Proyecto/` ejecutar `python -m http.server 8000` (dejar corriendo en background).
- Inspección: abrir `http://localhost:8000/` con el MCP de chrome-devtools (`new_page`/`navigate_page`), tomar `take_screenshot`, y leer estado con `evaluate_script` (ej. `() => !!window.game`).
- Consola de errores: `list_console_messages` debe quedar sin errores rojos tras cada tarea.

> **Commits:** los pasos incluyen `git commit` siguiendo el skill. El repo `Phaser_Games` es git (rama `main`). Confirmar con el usuario antes de commitear durante la ejecución (norma del entorno: no commitear sin pedirlo).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `finder-game/Proyecto/index.html` | Crear. Wrapper 300×600, CSS, DOM header (logo + `#time-display`), `window.GAME_CONFIG` comentado, módulo de cronómetro DOM, init de Phaser. |
| `finder-game/Proyecto/main.js` | Crear. `PreloaderScene` (carga assets) + `GameScene` (fondo, intruso, linterna, detección, alarma, reinicio). |
| `finder-game/Proyecto/assets/*` | Ya existen (`Fondo.png`, `Intruso.png`, `LogoProsegurBlanco.png`, `Fonts/`). No se modifican. |

Todas las rutas son relativas a `Havas Trabajo/Phaser_Games/`.

---

## Task 1: Andamiaje — fondo a pantalla completa + DOM header

**Files:**
- Create: `finder-game/Proyecto/index.html`
- Create: `finder-game/Proyecto/main.js`

- [ ] **Step 1: Crear `index.html` con wrapper, GAME_CONFIG, DOM header e init de Phaser**

Crea `finder-game/Proyecto/index.html` con este contenido completo:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Prosegur - Detecta al intruso</title>
  <style>
    @font-face {
      font-family: 'Poppins';
      src: url('assets/Fonts/Poppins-Regular.ttf') format('truetype');
      font-weight: 400;
    }
    @font-face {
      font-family: 'Poppins';
      src: url('assets/Fonts/Poppins-Bold.ttf') format('truetype');
      font-weight: 700;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background-color: #111;
      font-family: 'Poppins', Arial, sans-serif;
    }

    #game-wrapper {
      position: relative;
      width: 300px;
      height: 600px;
      background-color: #000;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    /* ===== DOM HEADER (logo + tiempo) ===== */
    #dom-header {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      z-index: 100;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      pointer-events: none; /* no bloquear la linterna */
    }

    #logo-container img { height: 26px; width: auto; display: block; }

    #time-display {
      color: #fff;
      font-weight: 700;
      font-size: 16px;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    }

    /* ===== CANVAS PHASER ===== */
    #game-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    #game-container canvas { display: block; }
  </style>
</head>
<body>
  <script>
    /**
     * =====================================================
     * CONFIGURACION DEL JUEGO PROSEGUR - DETECTA AL INTRUSO
     * Cada propiedad lleva un comentario en espanol.
     * =====================================================
     */
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
        randomPosition: true,      // true = posicion aleatoria en spawnArea; false = usa fixedPosition
        fixedPosition: { x: 150, y: 330 }, // coordenadas fijas cuando randomPosition = false
        spawnArea: {               // rectangulo donde puede aparecer al azar (interior de la casa)
          xMin: 55,                // limite izquierdo (px)
          xMax: 250,               // limite derecho (px)
          yMin: 140,               // limite superior (px) - debajo de la terraza exterior
          yMax: 520                // limite inferior (px) - encima del jardin
        }
      },

      // ===== LINTERNA (overlay oscuro + mascara radial invertida) =====
      flashlight: {
        radius: 45,                // radio del haz de luz visible en px (igual al detectRadius)
        softness: 0.45,            // suavidad del borde del haz (0 = borde duro, 1 = muy difuso)
        darkness: 0.96,            // opacidad de la oscuridad fuera del haz (1 = negro total)
        color: 0x000000            // color de la oscuridad (hex)
      },

      // ===== DETECCION (por proximidad cursor <-> intruso) =====
      detection: {
        detectRadius: 45           // distancia en px cursor<->intruso para considerarlo "encontrado"
      },

      // ===== ALARMA (efecto al encontrar al intruso) =====
      alarm: {
        flashColor: 0xff0000,      // color del parpadeo de alarma (hex, rojo)
        flashAlpha: 0.45,          // opacidad maxima del parpadeo (0 a 1)
        flashDuration: 250,        // duracion de cada parpadeo en ms
        flashCount: 3,             // numero de parpadeos
        revealHouseOnFound: true   // true = ilumina toda la casa durante la alarma
      },

      // ===== CRONOMETRO (manejado en el DOM) =====
      timer: {
        enabled: true,             // activa/desactiva el cronometro
        selector: "#time-display", // selector del elemento DOM donde se muestra el tiempo
        label: "Tiempo:",          // texto que precede al numero (ej. "Tiempo: 15")
        startOn: "firstMove"       // cuando arranca: "firstMove" (al mover el cursor) | "load" (al cargar)
      },

      // ===== PRODUCCION / FIN DE JUEGO =====
      restartOnFound: true,        // true = reinicia tras encontrarlo (Proyecto); GWD lo pondra en false
      restartDelay: 1200,          // espera en ms antes de reiniciar, tras la alarma
      onFoundCallback: null        // funcion(segundos) opcional - gancho para que el GWD/banner avance
    };
  </script>

  <div id="game-wrapper">
    <div id="dom-header">
      <div id="logo-container">
        <img src="assets/LogoProsegurBlanco.png" alt="Prosegur Alarms">
      </div>
      <div id="time-display">Tiempo: 0</div>
    </div>
    <div id="game-container"></div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
  <script src="main.js"></script>

  <script>
    const cfg = window.GAME_CONFIG;
    const phaserConfig = {
      type: Phaser.AUTO,
      width: cfg.width,
      height: cfg.height,
      parent: 'game-container',
      backgroundColor: '#000000',
      scene: [PreloaderScene, GameScene]
    };
    window.game = new Phaser.Game(phaserConfig);
  </script>
</body>
</html>
```

- [ ] **Step 2: Crear `main.js` con PreloaderScene y GameScene (solo fondo)**

Crea `finder-game/Proyecto/main.js`:

```js
const CFG = window.GAME_CONFIG;

/* =====================================================
 * PRELOADER: carga los assets
 * ===================================================== */
class PreloaderScene extends Phaser.Scene {
  constructor() { super('PreloaderScene'); }

  preload() {
    this.load.setPath(CFG.assetsPath);
    this.load.image(CFG.background.key, CFG.background.path);
    this.load.image(CFG.intruso.key, CFG.intruso.path);
  }

  create() {
    this.scene.start('GameScene');
  }
}

/* =====================================================
 * GAME: fondo, intruso, linterna, deteccion, alarma
 * ===================================================== */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.W = CFG.width;
    this.H = CFG.height;

    // Fondo de la casa a pantalla completa
    this.bg = this.add.image(0, 0, CFG.background.key).setOrigin(0).setDepth(0);
    this.bg.setDisplaySize(this.W, this.H);
  }
}
```

- [ ] **Step 3: Levantar servidor y verificar render del fondo**

Run (en background, desde `finder-game/Proyecto/`):
```bash
python -m http.server 8000
```
Luego con el MCP de chrome-devtools: `new_page` → `http://localhost:8000/`, `take_screenshot`.

Expected:
- Se ve el plano de la casa (`Fondo.png`) ocupando los 300×600.
- Arriba a la izquierda el logo blanco de Prosegur; arriba a la derecha el texto "Tiempo: 0".
- `evaluate_script` con `() => !!window.game` devuelve `true`.
- `list_console_messages`: sin errores.

- [ ] **Step 4: Commit**

```bash
git add "finder-game/Proyecto/index.html" "finder-game/Proyecto/main.js"
git commit -m "feat(finder-game): andamiaje del juego de linterna (fondo + DOM header)"
```

---

## Task 2: Colocar el intruso (posición aleatoria o fija)

**Files:**
- Modify: `finder-game/Proyecto/main.js` (clase `GameScene`)

- [ ] **Step 1: Añadir `placeIntruder()` y crear el sprite del intruso en `create()`**

En `main.js`, dentro de `GameScene`, añade el sprite del intruso al final de `create()` (después de crear `this.bg`):

```js
    // Intruso (encima del fondo)
    this.intruder = this.add.image(0, 0, CFG.intruso.key)
      .setScale(CFG.intruso.scale)
      .setDepth(1);
    this.placeIntruder();
```

Y añade el método `placeIntruder()` a la clase `GameScene` (después de `create()`):

```js
  placeIntruder() {
    const I = CFG.intruso;
    let x, y;
    if (I.randomPosition) {
      x = Phaser.Math.Between(I.spawnArea.xMin, I.spawnArea.xMax);
      y = Phaser.Math.Between(I.spawnArea.yMin, I.spawnArea.yMax);
    } else {
      x = I.fixedPosition.x;
      y = I.fixedPosition.y;
    }
    this.intruder.setPosition(x, y);
  }
```

- [ ] **Step 2: Verificar posición aleatoria**

Recarga `http://localhost:8000/` con `navigate_page` 3 veces, `take_screenshot` cada vez.

Expected:
- El intruso (ladrón) es visible (aún sin oscuridad) y aparece en una posición distinta cada recarga, siempre dentro del rectángulo `spawnArea` (sin salirse al jardín/terraza).
- `evaluate_script`: `() => ({x: window.game.scene.keys.GameScene.intruder.x, y: window.game.scene.keys.GameScene.intruder.y})` devuelve coords dentro de `[55..250] × [140..520]`.

- [ ] **Step 3: Verificar posición fija**

Con `evaluate_script` cambia temporalmente a modo fijo y reinicia la escena:
```js
() => { window.GAME_CONFIG.intruso.randomPosition = false; window.game.scene.keys.GameScene.scene.restart(); }
```
`take_screenshot`. Expected: el intruso aparece en `{x:150, y:330}` (centro-medio). Luego restablecer:
```js
() => { window.GAME_CONFIG.intruso.randomPosition = true; window.game.scene.keys.GameScene.scene.restart(); }
```

- [ ] **Step 4: Commit**

```bash
git add "finder-game/Proyecto/main.js"
git commit -m "feat(finder-game): intruso con posicion aleatoria o fija"
```

---

## Task 3: Efecto linterna (oscuridad + haz que sigue el cursor)

**Files:**
- Modify: `finder-game/Proyecto/main.js` (clase `GameScene`)

- [ ] **Step 1: Generar la textura radial de la luz**

Añade a `GameScene` el método `createLightTexture()`:

```js
  createLightTexture() {
    const f = CFG.flashlight;
    const r = f.radius;
    const size = r * 2;
    if (this.textures.exists('lightTexture')) this.textures.remove('lightTexture');
    const canvasTex = this.textures.createCanvas('lightTexture', size, size);
    const ctx = canvasTex.getContext();
    const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');                       // centro opaco
    grd.addColorStop(Math.max(0, 1 - f.softness), 'rgba(255,255,255,1)'); // zona plena
    grd.addColorStop(1, 'rgba(255,255,255,0)');                      // borde difuso
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    canvasTex.refresh();
  }
```

- [ ] **Step 2: Crear el overlay oscuro y la máscara radial invertida en `create()`**

Al final de `create()` (después de colocar el intruso), añade:

```js
    // Textura de la luz + sprite-mascara (no se dibuja en pantalla, solo enmascara)
    this.createLightTexture();
    this.light = this.make.image({ x: this.W / 2, y: this.H / 2, key: 'lightTexture', add: false });

    // Overlay de oscuridad a pantalla completa
    this.overlay = this.add.rectangle(0, 0, this.W, this.H, CFG.flashlight.color, CFG.flashlight.darkness)
      .setOrigin(0)
      .setDepth(10);

    // Mascara invertida: el overlay se ve donde la luz es transparente; el haz revela el fondo
    const mask = this.light.createBitmapMask();
    mask.invertAlpha = true;
    this.overlay.setMask(mask);
```

- [ ] **Step 3: Hacer que el haz siga el cursor en `update()`**

Añade el método `update()` a `GameScene`:

```js
  update() {
    const p = this.input.activePointer;
    this.light.setPosition(p.worldX, p.worldY);
  }
```

- [ ] **Step 4: Verificar el efecto linterna**

Recarga la página. Con chrome-devtools mueve el cursor: `hover` sobre varias coordenadas del `#game-container` (ej. centro, y donde esté el intruso) y `take_screenshot` tras cada movimiento.

Expected:
- La pantalla está casi negra salvo un círculo de luz con borde suave alrededor del cursor.
- Al mover el cursor, el círculo lo sigue.
- El intruso solo es visible cuando el haz pasa por encima.
- `list_console_messages`: sin errores (verificar especialmente que `BitmapMask` no lanza warnings).

- [ ] **Step 5: Commit**

```bash
git add "finder-game/Proyecto/main.js"
git commit -m "feat(finder-game): efecto linterna con mascara radial invertida"
```

---

## Task 4: Cronómetro en el DOM

**Files:**
- Modify: `finder-game/Proyecto/index.html` (añadir módulo de cronómetro)
- Modify: `finder-game/Proyecto/main.js` (arrancar el timer en el primer movimiento)

- [ ] **Step 1: Añadir el módulo de cronómetro en `index.html`**

En `index.html`, justo **después** del `<div id="game-wrapper">…</div>` y **antes** del `<script src="...phaser...">`, añade:

```html
  <script>
    /* ===== CRONOMETRO (DOM) ===== */
    (function () {
      const t = window.GAME_CONFIG.timer;
      let seconds = 0, intervalId = null, running = false;
      const el = () => document.querySelector(t.selector);
      function render() { const e = el(); if (e) e.textContent = `${t.label} ${seconds}`; }

      window.startTimer = function () {
        if (!t.enabled || running) return;
        running = true;
        intervalId = setInterval(function () { seconds++; render(); }, 1000);
      };
      window.stopTimer = function () {
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        running = false;
      };
      window.resetTimer = function () { seconds = 0; render(); };
      window.getTimerSeconds = function () { return seconds; };

      render(); // muestra "Tiempo: 0" al cargar
    })();
  </script>
```

- [ ] **Step 2: Arrancar el cronómetro desde `GameScene`**

En `main.js`, dentro de `GameScene`, añade al **final de `create()`**:

```js
    // Estado del cronometro
    this.timerStarted = false;
    if (CFG.timer.startOn === 'load') {
      this.timerStarted = true;
      if (window.startTimer) window.startTimer();
    } else {
      // arranca con el primer movimiento del cursor
      this.input.once('pointermove', () => {
        this.timerStarted = true;
        if (window.startTimer) window.startTimer();
      });
    }
```

- [ ] **Step 3: Verificar el cronómetro**

Recarga la página. `take_screenshot` (debe mostrar "Tiempo: 0"). Mueve el cursor con `hover`, espera ~3s (`wait_for`), `take_screenshot`.

Expected:
- Antes de mover el cursor: "Tiempo: 0".
- Tras mover y esperar: el número sube (ej. "Tiempo: 3").
- `evaluate_script`: `() => window.getTimerSeconds()` devuelve un entero creciente.

- [ ] **Step 4: Commit**

```bash
git add "finder-game/Proyecto/index.html" "finder-game/Proyecto/main.js"
git commit -m "feat(finder-game): cronometro ascendente en el DOM"
```

---

## Task 5: Detección, alarma, fin de juego y reinicio

**Files:**
- Modify: `finder-game/Proyecto/main.js` (clase `GameScene`)

- [ ] **Step 1: Crear el rectángulo de alarma e inicializar el flag `found`**

En `create()`, **antes** del bloque del cronómetro, añade:

```js
    // Capa de alarma (rojo a pantalla completa, invisible hasta detectar)
    this.alarmRect = this.add.rectangle(0, 0, this.W, this.H, CFG.alarm.flashColor, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(20);

    this.found = false;
    this.elapsedSeconds = 0;
```

- [ ] **Step 2: Añadir la detección por proximidad en `update()`**

Reemplaza el método `update()` por esta versión completa:

```js
  update() {
    const p = this.input.activePointer;
    this.light.setPosition(p.worldX, p.worldY);

    if (this.found || !this.timerStarted) return;

    const d = Phaser.Math.Distance.Between(p.worldX, p.worldY, this.intruder.x, this.intruder.y);
    if (d < CFG.detection.detectRadius) {
      this.handleFound();
    }
  }
```

- [ ] **Step 3: Añadir `handleFound()` (alarma + guardar tiempo + callback + reinicio)**

Añade a `GameScene`:

```js
  handleFound() {
    this.found = true;
    const a = CFG.alarm;

    // Guardar el tiempo (consultable despues, como en los otros juegos)
    this.elapsedSeconds = window.getTimerSeconds ? window.getTimerSeconds() : 0;
    window.tiempoFinal = this.elapsedSeconds;
    if (window.stopTimer) window.stopTimer();

    // Parpadeo rojo de alarma
    this.tweens.add({
      targets: this.alarmRect,
      alpha: { from: 0, to: a.flashAlpha },
      duration: a.flashDuration,
      yoyo: true,
      repeat: a.flashCount - 1
    });

    // Revelar toda la casa durante la alarma
    if (a.revealHouseOnFound) {
      this.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: a.flashDuration * a.flashCount
      });
    }

    // Gancho para produccion (GWD/banner)
    if (typeof CFG.onFoundCallback === 'function') CFG.onFoundCallback(this.elapsedSeconds);
    if (typeof window.onIntrusoEncontrado === 'function') window.onIntrusoEncontrado(this.elapsedSeconds);

    // Reinicio (solo en el Proyecto standalone)
    if (CFG.restartOnFound) {
      this.time.delayedCall(CFG.restartDelay, () => this.restartGame());
    }
  }
```

- [ ] **Step 4: Añadir `restartGame()`**

Añade a `GameScene`:

```js
  restartGame() {
    this.found = false;
    this.overlay.setAlpha(CFG.flashlight.darkness);
    this.alarmRect.setAlpha(0);
    this.placeIntruder();

    if (window.resetTimer) window.resetTimer();
    this.timerStarted = (CFG.timer.startOn === 'load');
    if (this.timerStarted && window.startTimer) {
      window.startTimer();
    } else {
      this.input.once('pointermove', () => {
        this.timerStarted = true;
        if (window.startTimer) window.startTimer();
      });
    }
  }
```

- [ ] **Step 5: Verificar el ciclo completo**

Recarga. Para detección determinista, fija al intruso y léelo:
```js
() => { window.GAME_CONFIG.intruso.randomPosition = false; window.GAME_CONFIG.intruso.fixedPosition = {x:150,y:330}; window.game.scene.keys.GameScene.scene.restart(); }
```
Mueve el cursor (`hover`) hasta `(150, 330)` dentro del canvas para arrancar el timer y entrar en el rango. `take_screenshot` durante el flash.

Expected:
- Al acercar la linterna al intruso, la pantalla parpadea en rojo `flashCount` veces y se revela toda la casa.
- `evaluate_script`: `() => window.tiempoFinal` devuelve un entero ≥ 0.
- Tras `restartDelay` (~1.2s), `take_screenshot`: la casa vuelve a oscuras, el intruso reaparece y "Tiempo: 0".
- Verificar callback: `() => { window.onIntrusoEncontrado = s => window.__cbSeg = s; }` antes de detectar; tras detectar `() => window.__cbSeg` devuelve el número de segundos.
- `list_console_messages`: sin errores.

- [ ] **Step 6: Commit**

```bash
git add "finder-game/Proyecto/main.js"
git commit -m "feat(finder-game): deteccion por proximidad, alarma roja, callback y reinicio"
```

---

## Task 6: Calibración visual y repaso de criterios de aceptación

**Files:**
- Modify: `finder-game/Proyecto/index.html` (solo valores de `GAME_CONFIG` si hace falta ajustar)

- [ ] **Step 1: Calibrar el `spawnArea` al interior real de la casa**

Con el juego en modo aleatorio, ejecuta varias recargas y `take_screenshot`. Si algún intruso cae sobre una pared exterior, el jardín o la terraza, ajusta `intruso.spawnArea` (`xMin/xMax/yMin/yMax`) en `GAME_CONFIG` hasta que todas las posiciones queden dentro de habitaciones. Documenta los valores finales.

Expected: 5 recargas seguidas → el intruso siempre dentro del interior habitable.

- [ ] **Step 2: Calibrar la linterna y la detección**

Verifica que `flashlight.radius` (haz visible) y `detection.detectRadius` siguen iguales (45) y que la sensación de "lo veo justo cuando lo detecto" es correcta. Si el haz se siente muy pequeño/grande, ajusta `radius` y `detectRadius` juntos. Ajusta `softness`/`darkness` si el borde o la oscuridad no coinciden con el mockup.

Expected: experiencia coherente con `FlashlightGame2`/`FlashlightGame3` del mockup.

- [ ] **Step 3: Repasar los 8 criterios de aceptación del spec**

Recorre uno a uno los criterios de la sección 9 del spec y confírmalos en el navegador:
1. Casa a oscuras + haz que sigue el cursor con borde suave.
2. Intruso aleatorio distinto por recarga (y fijo si `randomPosition:false`).
3. Detección automática al iluminar (`< detectRadius`, sin clic).
4. Flash rojo `flashCount` veces + reveal de la casa.
5. Cronómetro arranca al primer movimiento, sube de 1 en 1, se muestra en `#time-display`, se detiene al encontrar.
6. `window.tiempoFinal` queda con el tiempo y se pasa al callback.
7. Con `restartOnFound:true` reinicia con intruso nuevo y timer en 0.
8. Todos los parámetros se controlan desde `window.GAME_CONFIG`.

Expected: los 8 se cumplen. Anotar cualquier desviación y corregirla antes de cerrar.

- [ ] **Step 4: Detener el servidor y commit final**

Detén el `python -m http.server` (background). Commit si hubo ajustes de calibración:

```bash
git add "finder-game/Proyecto/index.html"
git commit -m "chore(finder-game): calibracion de spawnArea/linterna y repaso de aceptacion"
```

---

## Notas para la fase GWD (fuera de este plan)

- Empaquetar en Google Web Designer reutilizando este `main.js`/`GAME_CONFIG`.
- Poner `restartOnFound: false` y definir `onFoundCallback` (o `window.onIntrusoEncontrado`) para avanzar a la siguiente pantalla del banner.
- Validar `BitmapMask.invertAlpha` en el render WebGL del entorno DV360.
