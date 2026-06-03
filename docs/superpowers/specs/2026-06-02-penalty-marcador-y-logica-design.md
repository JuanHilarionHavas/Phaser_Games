# Penalty Shooter — Marcador visual + arreglos de la lógica de gol

**Fecha:** 2026-06-02
**Cliente/Campaña:** Drive Them Crazy (Puma)
**Ubicación:** `Phaser_Games/penalty-shooter-game/proyecto/`
**Formato:** Banner vertical (canvas 300×600, Phaser 3.60)

## 1. Objetivo

Dos entregables sobre el juego de penaltis existente:
1. **Marcador visual** de los 5 tiros: un container con 5 casillas que se llenan con un icono de "gol" o "errado" a medida que se juega.
2. **Arreglar la lógica de gol** (bugs reales) y **dar agencia** al jugador mediante un *tell* del arquero, además de pasar el botón y la flecha a sus assets.

## 2. Alcance

**Incluye:**
- Marcador `#scoreboard` en DOM, superpuesto sobre el canvas, alimentado por la lógica del juego.
- Botón `BotonPatear.png` y flecha `Flecha.png` (reemplazan el botón CSS y el SVG actuales).
- Fixes de lógica: "afuera" por dirección, travesaño frágil, comentarios desactualizados.
- Agencia: *tell* del arquero (anticipa un lado antes del tiro).

**NO incluye:**
- Logo "DRIVE THEM CRAZY" y cinta inferior → **ya vienen en `bg_field.png`** (no se tocan).
- Empaque GWD (el `gwd_template/Penalty-Shooter_Game_Template/` actual está mal copiado con assets del finder; se aborda en otra tarea).
- Marcadores de texto "Tiro/Goles" → se eliminan (el `#ui-bar` de texto desaparece; el marcador visual lo sustituye).

## 3. Assets (existentes en `assets/images/`)

| Asset | Dim | Uso |
|---|---|---|
| `BarraPuntos.png` | 349×99 | Container del marcador (5 casillas) |
| `Anotado.png` | 56×55 | Icono **gol** (Z amarilla) |
| `Fallido.png` | 56×55 | Icono **errado** (Z roja) — atajada **o** afuera |
| `BotonPatear.png` | 251×122 | Botón PATEAR |
| `Flecha.png` | 321×88 | Flecha de dirección |
| `bg_field.png` | 300×600 | Fondo (ya incluye logo arriba y cinta al pie) |

## 4. Diseño

### 4.1 Layout
El campo sigue en el canvas 300×600. Los elementos de UI van en DOM, `position:absolute` **dentro de `#game-container`** (igual que el botón y la flecha hoy). Se elimina el `#ui-bar` de texto que vivía fuera del canvas.

```
#game-container (300×600, position:relative)
  canvas (bg_field: logo arriba + arco + campo + cinta al pie)
  #scoreboard      (absolute, top ~95px, centrado)   ← NUEVO
  #feedback-message (existente)
  #kick-arrow → <img Flecha.png> (existente, ahora con asset)
  #kick-btn   → fondo BotonPatear.png (existente, ahora con asset)
  #end-overlay (existente)
```

### 4.2 Marcador (`#scoreboard`)
- Contenedor con `background: url(assets/images/BarraPuntos.png)` (relación 349:99), ancho ~210px (alto ~59px), centrado en la franja oscura bajo el logo.
- Dentro, **5 slots** (`.score-slot`) alineados sobre las casillas del PNG (flexbox con padding/gap calibrado visualmente). Cada slot contiene un `<img class="score-icon">` inicialmente vacío/oculto.
- **API DOM** (en `index.html`, junto al resto del JS de UI):
  - `window.markScoreboard(index, isGoal)` — pone `Anotado.png` (isGoal) o `Fallido.png` en el slot `index` (0-based) y lo muestra con una animación *pop* (scale 0→1).
  - `window.resetScoreboard()` — limpia los 5 slots (oculta todos los iconos).
- **Integración con el juego** (`main.js`):
  - En `resolveShot`, tras calcular `outcome`: `window.markScoreboard(this.shotsTaken, outcome === 'goal')`. (`this.shotsTaken` es 0-based para el tiro en curso, antes de `nextShot`).
  - En `create()` (arranque y `scene.restart`): `window.resetScoreboard()`.
- Asume `totalShots === 5` (coincide con las 5 casillas del asset). Si cambiara, habría que rehacer el asset; se documenta.

### 4.3 Botón y flecha con assets
- `#kick-btn`: quitar fondo/borde CSS amarillo y usar `background: url(BotonPatear.png)` (contain, sin texto, ya que el asset trae "PATEAR"). Mantener id, listeners (`onPress`/`onRelease`) y estado `disabled`/`pressed` intactos.
- `#kick-arrow`: reemplazar el `<svg>` por `<img src="assets/images/Flecha.png">`. La rotación CSS (`transform: rotate()`) y `transform-origin` existentes siguen aplicando igual. Ajustar `width/height` al ratio 321:88.

### 4.4 Fixes de la lógica de gol

**(a) "Afuera" por dirección** — hoy imposible (`wideAngleThresholdDeg=42` > `angleRangeDeg=40`, y `directionSpreadX=140` nunca saca el balón de los postes). Cambios en `index.html`:
- `shot.directionSpreadX`: 140 → **175** (apuntar cerca de los extremos saca el balón fuera del poste; `determineOutcome` lo detecta vía `outsideX`).
- `shot.wideAngleThresholdDeg`: 42 → **36** (dentro del rango ±40 de la flecha; respaldo de "muy abierto = afuera").
- Calibrar visualmente para que apuntar al centro/medio entre y apuntar a los bordes extremos falle.

**(b) Travesaño frágil** — `landingY.high=280` queda por encima de `crossbarY=285` y solo se salva por la tolerancia. Cambio:
- `shot.landingY.high`: 280 → **292** (dentro del arco con margen claro sobre 285).

**(c) Comentarios** — corregir en `index.html` los comentarios desactualizados de `landingY` (decían 390/350/300/250) y de `wideAngleThresholdDeg` (decía "±37°").

**(d) Agencia: *tell* del arquero.** Reemplaza el modelo actual (`aiBias`: leer la zona real del balón tras el tiro) por un compromiso **anticipado y visible**:
- Al inicio de cada tiro (`create` y `resetShot`), `chooseTell()` elige `this.tellZone` (una de las 6 zonas; la columna determina el lado visible del tell).
- **Tell visual**: durante `IDLE`, el arquero se desplaza ~`keeper.tellShiftX` (±15px) hacia la columna del tell (un leve "peso" hacia ese lado), señalando hacia dónde tenderá a tirarse.
- En `executeShot`, la zona a la que se lanza:
  ```js
  keeperZone = (Math.random() < CFG.keeper.tellBias) ? this.tellZone
                                                     : Phaser.Utils.Array.GetRandom(allZones);
  ```
  Con `tellBias ≈ 0.7`: el arquero cumple el tell el 70% (apuntar al lado contrario suele ser gol), pero el 30% finta (apuntar al contrario no es seguro al 100%).
- La **atajada sigue resolviéndose por distancia real** (`determineOutcome`, sin cambios): el arquero se compromete a una zona, y si el balón pasa dentro del radio de save, ataja.
- Config nuevo en `keeper`: `tellBias: 0.7`, `tellShiftX: 15`, `tellEnabled: true`. Se retira el uso de `aiBias` (se deja comentado/eliminado).

## 5. Resumen de cambios de config (`index.html`)

```js
shot: {
  directionSpreadX: 175,        // (era 140) ahora apuntar a los bordes manda fuera del poste
  wideAngleThresholdDeg: 36,    // (era 42) dentro del rango de la flecha; "muy abierto = afuera"
  landingY: { low: 340, mid: 310, high: 292, over: 250 }, // high 280→292 (dentro del arco)
  // ...resto igual; comentarios corregidos
},
keeper: {
  // aiBias eliminado (modelo viejo: leer zona real)
  tellEnabled: true,  // el arquero anticipa un lado antes del tiro
  tellBias: 0.7,      // prob. de cumplir el tell (0.3 = finta)
  tellShiftX: 15,     // px que se inclina hacia el lado del tell durante IDLE
  // ...resto igual
}
```

## 6. Criterios de aceptación

1. El marcador (BarraPuntos) aparece superpuesto en la franja superior; al inicio las 5 casillas están vacías.
2. Cada tiro resuelto pinta su casilla: **gol → Z amarilla**, **atajada o afuera → Z roja**, con animación pop, en orden (tiro 1 → casilla 1…).
3. Al "JUGAR DE NUEVO" el marcador se limpia (5 casillas vacías).
4. El botón usa `BotonPatear.png` y la flecha `Flecha.png`; el botón sigue cargando potencia y la flecha sigue oscilando/rotando igual.
5. Apuntar a los bordes extremos puede mandar el balón **afuera** (antes era imposible).
6. Ningún tiro potente válido se cuenta como "afuera" por el travesaño (high entra).
7. El arquero muestra un *tell* (se inclina a un lado) antes del tiro y se lanza a ese lado ~70% de las veces; apuntar al lado contrario aumenta los goles, pero no es infalible (30% finta).
8. El comportamiento es configurable desde `window.GAME_CONFIG` y los comentarios reflejan los valores reales.

## 7. Riesgos / notas

- **Alineación de los 5 slots** sobre las casillas del PNG: se calibra visualmente con screenshots; depende del padding/gap exactos del asset.
- El *tell* cambia el balance: hay que calibrar `tellBias`/`tellShiftX` para que sea legible pero no trivial.
- `markScoreboard` usa `this.shotsTaken` (0-based, tiro en curso) — verificar que se llama **antes** de `nextShot` (que lo incrementa).
- Mantener intactos los listeners del botón y el manejo de `shutdown`/`restart` ya existentes.
