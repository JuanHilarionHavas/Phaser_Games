# Penalty Shooter — Marcador + Fixes de Lógica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un marcador visual de 5 tiros (BarraPuntos + Z amarilla/roja), pasar botón y flecha a sus assets, y arreglar la lógica de gol (afuera por dirección, travesaño, comentarios) dando agencia con un *tell* del arquero.

**Architecture:** Juego Phaser 3.60 en `proyecto/` (index.html con `window.GAME_CONFIG` + CSS + JS de UI; `main.js` con la clase `PenaltyScene`). El marcador, botón y flecha son DOM `position:absolute` dentro de `#game-container` (mismo patrón que el botón/flecha actuales). La lógica vive en `main.js`.

**Tech Stack:** HTML/CSS/JS vanilla, Phaser 3.60 (CDN). Spec: [docs/superpowers/specs/2026-06-02-penalty-marcador-y-logica-design.md](../specs/2026-06-02-penalty-marcador-y-logica-design.md).

**Verificación (sin test runner):** servidor local + chrome-devtools MCP.
- Servidor: `python -m http.server 8002 --directory "d:\Camello\Havas Trabajo\Phaser_Games\penalty-shooter-game\proyecto"` (background).
- Inspección: `new_page`/`navigate_page` a `http://localhost:8002/`, `take_screenshot`, `evaluate_script`, `list_console_messages` (sin errores tras cada tarea).
- Para forzar resultados deterministas se manipula `window.GAME_CONFIG` y `window.__penaltyScene` en runtime.

> **Commits:** los pasos incluyen `git commit` (patrón del skill). Confirmar con el usuario antes de commitear/pushear; el repo es `Phaser_Games` (rama `main`). Commits selectivos: solo `penalty-shooter-game/` y `docs/`.

---

## File Structure

| Archivo | Responsabilidad | Cambio |
|---|---|---|
| `penalty-shooter-game/proyecto/index.html` | UI (HTML+CSS), `GAME_CONFIG`, JS de UI | Modificar: marcador, botón/flecha, config |
| `penalty-shooter-game/proyecto/main.js` | Lógica `PenaltyScene` | Modificar: integración marcador, tell del arquero |
| `assets/images/*` | Assets (ya existen) | Sin cambios |

Rutas relativas a `Havas Trabajo/Phaser_Games/`.

---

## Task 1: Marcador visual (BarraPuntos + Z's)

**Files:** Modify `penalty-shooter-game/proyecto/index.html`, `penalty-shooter-game/proyecto/main.js`

- [ ] **Step 1: Quitar el `#ui-bar` de texto del HTML**

En `index.html`, eliminar este bloque completo (está antes de `#game-container`):
```html
  <div id="ui-bar">
    <div id="ui-shot" class="ui-cell">
      <span class="ui-label">Tiro</span>
      <span id="shot-counter">1/5</span>
    </div>
    <div id="ui-score" class="ui-cell">
      <span class="ui-label">Goles</span>
      <span id="score-value">0</span>
    </div>
  </div>
```

- [ ] **Step 2: Añadir el marcador dentro de `#game-container`**

En `index.html`, dentro de `<div id="game-container">`, justo después de `<div id="feedback-message"></div>`, añadir:
```html
    <div id="scoreboard">
      <div class="score-slot"><img class="score-icon" alt=""></div>
      <div class="score-slot"><img class="score-icon" alt=""></div>
      <div class="score-slot"><img class="score-icon" alt=""></div>
      <div class="score-slot"><img class="score-icon" alt=""></div>
      <div class="score-slot"><img class="score-icon" alt=""></div>
    </div>
```

- [ ] **Step 3: Añadir el CSS del marcador**

En el `<style>` de `index.html` (p. ej. después de la regla `#feedback-message.miss`), añadir:
```css
    /* ===== Marcador de penaltis (BarraPuntos + Z's) ===== */
    #scoreboard {
      position: absolute;
      top: 92px;                 /* franja oscura bajo el logo (calibrar) */
      left: 50%;
      transform: translateX(-50%);
      width: 210px;
      height: 60px;              /* ratio 349:99 */
      background: url('assets/images/BarraPuntos.png') no-repeat center / 100% 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;                  /* separacion entre casillas (calibrar) */
      padding: 0 16px;           /* margen lateral del container (calibrar) */
      box-sizing: border-box;
      z-index: 6;
      pointer-events: none;
    }
    .score-slot {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .score-icon {
      width: 100%;
      height: 100%;
      object-fit: contain;
      opacity: 0;
      transform: scale(0);
      transition: transform 0.25s cubic-bezier(0.2, 1.3, 0.4, 1), opacity 0.2s ease-out;
    }
    .score-icon.shown {
      opacity: 1;
      transform: scale(1);
    }
```

- [ ] **Step 4: Añadir la API JS del marcador**

En `index.html`, dentro del `<script>` final (antes de `new Phaser.Game(config);`), añadir:
```js
    // ===== API del marcador (Phaser la llama al resolver cada tiro) =====
    (function () {
      const board = document.getElementById('scoreboard');
      const icons = board ? Array.from(board.querySelectorAll('.score-icon')) : [];
      const base = 'assets/images/';
      window.markScoreboard = function (index, isGoal) {
        const icon = icons[index];
        if (!icon) return;
        icon.src = base + (isGoal ? 'Anotado.png' : 'Fallido.png');
        icon.classList.add('shown');
      };
      window.resetScoreboard = function () {
        icons.forEach(function (icon) {
          icon.classList.remove('shown');
          icon.removeAttribute('src');
        });
      };
    })();
```

- [ ] **Step 5: Integrar en `main.js` — marcar la casilla al resolver**

En `main.js`, en `resolveShot`, después de la línea `const outcome = this.determineOutcome(targetX, targetY, band);` añadir:
```js
        if (window.markScoreboard) window.markScoreboard(this.shotsTaken, outcome === 'goal');
```
(Va antes del `if (outcome === 'goal')`. `this.shotsTaken` es 0-based y aún no se incrementó — `nextShot` lo hace después.)

- [ ] **Step 6: Integrar en `main.js` — limpiar el marcador al iniciar**

En `main.js`, en `create()`, después de `this.updateScoreDOM();` (zona de estado inicial), añadir:
```js
        if (window.resetScoreboard) window.resetScoreboard();
```
(Nota: `#ui-bar` ya no existe, así que `updateScoreDOM`/`updateShotCounterDOM` quedan inertes por sus guardas `if (this.scoreEl)` — se dejan sin tocar.)

- [ ] **Step 7: Verificar el marcador en el navegador**

Servidor (background) y `new_page` a `http://localhost:8002/`. Forzar 3 resultados con runtime:
```js
() => { const s = window.__penaltyScene; window.markScoreboard(0, true); window.markScoreboard(1, false); window.markScoreboard(2, true); return 'marked'; }
```
`take_screenshot`. Expected: las casillas 1 y 3 con **Z amarilla**, la 2 con **Z roja**, alineadas sobre las casillas del PNG. Probar `() => window.resetScoreboard()` → casillas vacías. `list_console_messages`: sin errores. (Si los iconos no caen centrados en las casillas, ajustar `gap`/`padding`/`width` del `#scoreboard` — se afina en Task 5.)

- [ ] **Step 8: Commit**

```bash
git add penalty-shooter-game/proyecto/index.html penalty-shooter-game/proyecto/main.js
git commit -m "feat(penalty): marcador visual de 5 tiros (BarraPuntos + Z anotado/fallido)"
```

---

## Task 2: Botón y flecha con assets

**Files:** Modify `penalty-shooter-game/proyecto/index.html`

- [ ] **Step 1: Cambiar la flecha SVG por la imagen**

En `index.html`, reemplazar el bloque del `#kick-arrow`:
```html
    <div id="kick-arrow">
      <svg viewBox="0 0 80 140" width="100%" height="100%">
        <polygon points="40,6 74,58 54,58 54,130 26,130 26,58 6,58" fill="#e6ff00" stroke="#111" stroke-width="4"
          stroke-linejoin="round" />
      </svg>
    </div>
```
por:
```html
    <div id="kick-arrow">
      <img src="assets/images/Flecha.png" alt="">
    </div>
```

- [ ] **Step 2: CSS de la flecha (orientarla hacia arriba)**

`Flecha.png` apunta a la derecha (321×88); se rota −90° para que apunte al arco. En `index.html`, reemplazar la regla `#kick-arrow { ... }` existente por:
```css
    #kick-arrow {
      position: absolute;
      left: 50%;
      bottom: 70px;
      width: 120px;
      height: 120px;
      margin-left: -60px;
      transform-origin: 50% 100%;   /* pivote en la base: oscila como pendulo */
      transform: rotate(0deg);       /* JS actualiza con arrowAngleDeg */
      pointer-events: none;
      z-index: 5;
      transition: opacity 0.15s ease-out;
    }
    #kick-arrow img {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 120px;                  /* tamano natural escalado (ratio 321:88) */
      height: auto;
      transform: translate(-50%, -50%) rotate(-90deg);  /* horizontal -> apunta arriba */
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
    }
```
(Mantener la regla `#kick-arrow.hidden { opacity: 0; }` existente.)

- [ ] **Step 3: CSS del botón (usar BotonPatear.png)**

En `index.html`, reemplazar la regla `#kick-btn { ... }` existente por:
```css
    #kick-btn {
      position: absolute;
      left: 50%;
      bottom: 18px;
      transform: translateX(-50%);
      width: 150px;
      height: 73px;                  /* ratio 251:122 */
      background: url('assets/images/BotonPatear.png') no-repeat center / contain;
      background-color: transparent;
      border: none;
      font-size: 0;                  /* oculta el texto "PATEAR" del DOM (el asset ya lo trae) */
      color: transparent;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      z-index: 6;
      transition: transform 0.05s ease-out;
    }
```
(Mantener las reglas `#kick-btn:active, #kick-btn.pressed { transform: translateX(-50%) scale(0.96); }` y `#kick-btn[disabled] { opacity: 0.5; cursor: default; }`.)

- [ ] **Step 4: Verificar botón y flecha**

Recargar `http://localhost:8002/`. `take_screenshot`. Expected: la flecha amarilla apunta hacia arriba (al arco) sobre el botón, y el botón muestra `BotonPatear.png` (sin doble texto). `evaluate_script` para confirmar que oscila:
```js
() => { const a = document.getElementById('kick-arrow'); return a.style.transform; }
```
Expected: un `rotate(<n>deg)` que cambia con el tiempo. Mantener presionado el botón debe cargar la barra (verificar visualmente que sigue jugable). `list_console_messages`: sin errores.

- [ ] **Step 5: Commit**

```bash
git add penalty-shooter-game/proyecto/index.html
git commit -m "feat(penalty): boton y flecha con assets (BotonPatear, Flecha)"
```

---

## Task 3: Fixes de la lógica (config)

**Files:** Modify `penalty-shooter-game/proyecto/index.html`

- [ ] **Step 1: "Afuera" por dirección + travesaño + comentarios**

En `index.html`, en el objeto `shot`, reemplazar:
```js
        landingY: { low: 340, mid: 310, high: 280, over: 250 },
        // Umbral Y que separa filas "low" vs "high" del arquero
        highLowThresholdY: 340,
        saveRadiusX: 35,            // distancia en X para que el portero ataje
        saveRadiusY: 35,            // distancia en Y para que el portero ataje
        directionSpreadX: 140,      // permite que los tiros lleguen a las esquinas del arco
        wideAngleThresholdDeg: 42   // ángulos más allá de ±37° → fuera automático
```
por:
```js
        // Y de llegada por banda. Arco: crossbarY=285..groundY=395.
        //   low 340 (rasante) · mid 310 · high 292 (dentro, con margen sobre 285) · over 250 (afuera)
        landingY: { low: 340, mid: 310, high: 292, over: 250 },
        // Umbral Y que separa filas "low" vs "high" del arquero
        highLowThresholdY: 340,
        saveRadiusX: 35,            // distancia en X para que el portero ataje
        saveRadiusY: 35,            // distancia en Y para que el portero ataje
        directionSpreadX: 175,      // apuntar a los bordes saca el balon fuera del poste (afuera)
        wideAngleThresholdDeg: 36   // |angulo| >= 36 (dentro del rango +/-40 de la flecha) -> afuera
```

- [ ] **Step 2: Verificar "afuera" y travesaño**

Recargar. Forzar un tiro muy abierto a potencia media y comprobar `miss`:
```js
() => {
  const s = window.__penaltyScene;
  s.state = 'CHARGING'; s.lockedAngleDeg = 39; s.power = 40; s.chargeStartTime = s.time.now;
  s.executeShot();
  return 'shot wide';
}
```
Tras ~1.2s, `() => document.getElementById('feedback-message').textContent` → Expected: `¡AFUERA!`. Repetir con `lockedAngleDeg = 5, power = 80` (tiro alto centrado) varias veces → debe poder ser `¡GOL!` o `¡ATAJADA!`, **nunca** `¡AFUERA!` por el travesaño. `list_console_messages`: sin errores.

- [ ] **Step 3: Commit**

```bash
git add penalty-shooter-game/proyecto/index.html
git commit -m "fix(penalty): afuera por direccion, travesano dentro del arco, comentarios"
```

---

## Task 4: Tell del arquero (agencia)

**Files:** Modify `penalty-shooter-game/proyecto/index.html` (config), `penalty-shooter-game/proyecto/main.js`

- [ ] **Step 1: Config del tell (quitar aiBias)**

En `index.html`, en el objeto `keeper`, reemplazar la línea:
```js
        aiBias: 0.45      // probabilidad de leer correctamente la zona del balón
```
por:
```js
        tellEnabled: true,   // el arquero anticipa un lado antes del tiro (telegrafia)
        tellBias: 0.7,       // prob. de cumplir el tell (0.3 = finta)
        tellShiftX: 15       // px que se inclina hacia el lado del tell durante IDLE
```

- [ ] **Step 2: `chooseTell` + `applyTellShift` en `main.js`**

En `main.js`, añadir estos dos métodos a `PenaltyScene` (p. ej. justo después de `create()`):
```js
  chooseTell() {
    const zones = Object.keys(this.CFG.keeper.zoneAnim);
    this.tellZone = Phaser.Utils.Array.GetRandom(zones);
  }

  applyTellShift() {
    const CFG = this.CFG;
    if (!CFG.keeper.tellEnabled || !this.tellZone) return;
    const col = this.tellZone.split('-')[1];
    const dir = col === 'left' ? -1 : (col === 'right' ? 1 : 0);
    const targetX = CFG.keeper.position.x + dir * CFG.keeper.tellShiftX;
    this.tweens.add({ targets: this.keeper, x: targetX, duration: 300, ease: 'Sine.easeOut' });
  }
```

- [ ] **Step 3: Elegir el tell al iniciar y al resetear**

En `main.js`, en `create()`, después de `this.keeperZone = null;` (zona de estado inicial), añadir:
```js
        this.chooseTell();
        this.applyTellShift();
```
En `resetShot()`, dentro del `onComplete` del fade-in del arquero (después de `this.keeper.play('keeper_idle');`), añadir:
```js
                        this.chooseTell();
                        this.applyTellShift();
```

- [ ] **Step 4: Usar el tell en `executeShot` (en vez de aiBias)**

En `main.js`, en `executeShot`, reemplazar:
```js
        // Zona del balón (salvo que vaya fuera del arco/por encima del travesaño)
        const realBallZone = this.ballZone(targetX, targetY);

        // IA del arquero
        const allZones = Object.keys(CFG.keeper.zoneAnim);
        const keeperZone = (Math.random() < CFG.keeper.aiBias)
            ? realBallZone
            : Phaser.Utils.Array.GetRandom(allZones);
        this.keeperZone = keeperZone;
```
por:
```js
        // IA del arquero: cumple el tell (zona anticipada) o finta a una zona aleatoria
        const allZones = Object.keys(CFG.keeper.zoneAnim);
        const keeperZone = (CFG.keeper.tellEnabled && Math.random() < CFG.keeper.tellBias)
            ? (this.tellZone || Phaser.Utils.Array.GetRandom(allZones))
            : Phaser.Utils.Array.GetRandom(allZones);
        this.keeperZone = keeperZone;
```

- [ ] **Step 5: Verificar el tell**

Recargar. Comprobar que el tell existe y desplaza al arquero:
```js
() => { const s = window.__penaltyScene; return { tellZone: s.tellZone, keeperX: Math.round(s.keeper.x), baseX: s.CFG.keeper.position.x, shift: s.CFG.keeper.tellShiftX }; }
```
Expected: `tellZone` es una zona válida; si su columna es left/right, `keeperX ≈ baseX ∓ 15`; si es center, `≈ baseX`. `take_screenshot` para ver al arquero inclinado a un lado. Verificar que `tellBias` se respeta estadísticamente:
```js
() => { const s = window.__penaltyScene; let hit = 0; for (let i=0;i<200;i++){ const z = (s.CFG.keeper.tellEnabled && Math.random()<s.CFG.keeper.tellBias)?s.tellZone:'rand'; if (z===s.tellZone) hit++; } return hit/200; }
```
Expected: ~0.7. `list_console_messages`: sin errores.

- [ ] **Step 6: Commit**

```bash
git add penalty-shooter-game/proyecto/index.html penalty-shooter-game/proyecto/main.js
git commit -m "feat(penalty): tell del arquero (anticipa lado) para dar agencia"
```

---

## Task 5: Calibración visual y criterios de aceptación

**Files:** Modify `penalty-shooter-game/proyecto/index.html` (solo valores si hace falta)

- [ ] **Step 1: Alinear los iconos del marcador con las casillas del PNG**

Con el marcador lleno (Task 1 Step 7), comparar la posición de las Z's con las casillas dibujadas en `BarraPuntos.png`. Ajustar `#scoreboard` (`width`, `gap`, `padding`, `top`) y `.score-slot` (`width/height`) hasta que cada Z quede centrada en su casilla. Documentar los valores finales.

Expected: las 5 Z's centradas en las 5 casillas.

- [ ] **Step 2: Jugar una partida completa de validación**

Jugar (o forzar) los 5 tiros y verificar el flujo end-to-end: cada resultado pinta su casilla en orden, el `#end-overlay` muestra `score DE 5`, y "JUGAR DE NUEVO" limpia el marcador y reinicia. Verificar con:
```js
() => { return Array.from(document.querySelectorAll('#scoreboard .score-icon')).map(i => i.classList.contains('shown') ? (i.src.includes('Anotado') ? 'gol' : 'fallo') : 'vacio'); }
```

- [ ] **Step 3: Calibrar el balance (tell + afuera)**

Jugar varias veces. Ajustar si hace falta: `tellShiftX` (que el tell sea legible), `tellBias` (que apuntar al contrario premie pero no sea infalible), `directionSpreadX`/`wideAngleThresholdDeg` (que fallar por fuera requiera apuntar claramente a los bordes). Documentar valores finales.

- [ ] **Step 4: Repasar los 8 criterios de aceptación del spec**

Recorrer la sección 6 del spec y confirmar cada criterio en el navegador. Anotar y corregir cualquier desvío.

- [ ] **Step 5: Detener el servidor y commit final (si hubo ajustes)**

```bash
git add penalty-shooter-game/proyecto/index.html
git commit -m "chore(penalty): calibracion de marcador y balance"
```
