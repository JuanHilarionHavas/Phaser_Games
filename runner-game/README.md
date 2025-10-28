# Runner Game - Phaser 3

Juego de runner en 3 carriles desarrollado con Phaser 3, optimizado para diferentes tamaños de banners publicitarios.

## Características del Juego

- **3 Carriles**: El jugador puede moverse entre 3 carriles horizontales
- **Controles**: Teclas de flecha (↑/↓) o W/S, y soporte para swipe táctil
- **Duración**: 30 segundos de juego
- **Sistema de Score**:
  - Score inicial: 100 puntos
  - +10 puntos por cada obstáculo evitado
  - -20 puntos por cada colisión
- **Backgrounds**:
  - Background principal con scroll infinito
  - Background final con línea de meta "GOAL" que aparece con tiempo suficiente para completar la animación
- **Animación del Player**: Sprite sheet de 10 frames con animación de correr
- **Animación de Obstáculos**: Sprite sheet de 7 frames con animación configurable
- **Obstáculos**: Spawn aleatorio en los 3 carriles

## Tamaños Disponibles

El juego está optimizado para los siguientes tamaños de ads:

1. **300x600** (Principal) - `index.html`
   - Player scale: 0.5
   - Obstacle scale: 0.4
   - Scroll speed: 3
   - UI completa

2. **320x480** - `index-320x480.html`
   - Player scale: 0.4
   - Obstacle scale: 0.35
   - Scroll speed: 2.5
   - UI compacta

3. **300x250** - `index-300x250.html`
   - Player scale: 0.25
   - Obstacle scale: 0.25
   - Scroll speed: 2
   - UI simplificada (T: / S:)

4. **728x90** (Leaderboard) - `index-728x90.html`
   - Player scale: 0.2
   - Obstacle scale: 0.18
   - Scroll speed: 4
   - UI compacta

5. **970x250** (Billboard) - `index-970x250.html`
   - Player scale: 0.5
   - Obstacle scale: 0.4
   - Scroll speed: 4
   - UI completa

## Estructura de Archivos

```
runner-game/
├── index.html              # 300x600 (principal)
├── index-320x480.html      # 320x480
├── index-300x250.html      # 300x250
├── index-728x90.html       # 728x90
├── index-970x250.html      # 970x250
├── main.js                 # Lógica del juego (compartida)
├── assets/
│   ├── bg.png              # Background principal (1536x672)
│   ├── bg_end.png          # Background final con meta (1536x672)
│   ├── player.png          # Sprite sheet del player (2046x199)
│   └── obstacle.png        # Obstáculo (218x199)
└── README.md
```

## Configuración

Cada archivo HTML contiene su propia configuración en `window.GAME_CONFIG`:

```javascript
window.GAME_CONFIG = {
  timeLimit: 30,              // Duración del juego (segundos)
  initialScore: 100,          // Score inicial
  scoreIncrement: 10,         // Puntos por obstáculo evitado
  scoreDecrement: 20,         // Puntos perdidos por colisión

  player: {
    frameWidth: 204.6,        // Ancho de frame del sprite
    frameHeight: 199,         // Alto del sprite
    frames: 10,               // Número de frames
    scale: 0.5,               // Escala del player
    animationKey: 'run',      // Key de animación
    frameRate: 12             // FPS de animación
  },

  lanes: {
    count: 3,                 // Número de carriles
    positions: [180, 300, 420] // Posiciones Y en píxeles exactos
  },

  background: {
    width: 1536,              // Ancho del background
    height: 672,              // Alto del background
    scrollSpeed: 3            // Velocidad de scroll
  },

  obstacles: {
    scale: 0.4,               // Escala del obstáculo
    minSpawnInterval: 1500,   // Intervalo mínimo (ms)
    maxSpawnInterval: 3000,   // Intervalo máximo (ms)
    speed: 3,                 // Velocidad de movimiento
    frameWidth: 128.14,       // Ancho de frame del sprite (897 / 7)
    frameHeight: 199,         // Alto del sprite sheet
    frames: 7,                // Número de frames
    animationKey: 'obstacle-run', // Key de la animación
    animationFrameRate: 10,   // FPS de animación
    animationStart: 0         // Frame inicial
  },

  goal: {
    offset: 25,               // Distancia desde el borde derecho
    duration: 4000,           // Duración del movimiento a la meta (ms)
    animationDelay: 1000      // Espera después de llegar antes de terminar (ms)
  },

  ui: {
    timerLabel: 'Tiempo:',
    scoreLabel: 'Score:',
    timerSelector: '#timer-display',
    scoreSelector: '#score-display',
    useExternalUI: true       // Usar elementos DOM para UI
  }
};
```

## Controles

- **Teclado**:
  - `↑` / `W`: Mover hacia arriba
  - `↓` / `S`: Mover hacia abajo

- **Táctil**:
  - Swipe arriba: Mover hacia arriba
  - Swipe abajo: Mover hacia abajo

## Desarrollo

Para probar localmente, necesitas servir los archivos a través de un servidor HTTP (debido a CORS):

```bash
# Usando Python 3
python -m http.server 8080

# Luego abrir en el navegador:
# http://localhost:8080/index.html
```

## Assets

- **bg.png**: Background principal con 3 carriles marcados con líneas cyan/azules
- **bg_end.png**: Background final con banner "GOAL" de meta
- **player.png**: Sprite sheet horizontal de 10 frames (personaje corriendo)
- **obstacle.png**: Astronauta con bandera roja (obstáculo)

## Dependencias

- Phaser 3.85.2 (cargado desde CDN de Google)
- No requiere instalación de dependencias adicionales

## Notas de Implementación

- El juego usa física Arcade de Phaser para detección de colisiones
- Las colisiones solo ocurren cuando el player y el obstáculo están en el mismo carril
- El background principal (bg.png) hace scroll durante el juego
- El timer calcula automáticamente cuándo mostrar bg_end.png basándose en goal.duration + goal.animationDelay
- Esto asegura que el juego use exactamente los 30 segundos completos
- Cuando aparece bg_end, el scroll del background se detiene
- El player se mueve automáticamente hacia la meta al aparecer bg_end
- Al llegar a la meta, el player se detiene en el frame 0 (estar quieto)
- La animación de correr usa frames 1-9 (el frame 0 es estar quieto)
- Los obstáculos tienen animación configurable desde el config (frames, frameRate, etc.)
- El timer y score se manejan mediante elementos DOM externos al canvas
- Los obstáculos se generan de forma aleatoria en intervalos configurables
- Los obstáculos dejan de aparecer cuando el player va hacia la meta
- El player siempre se renderiza por encima de los obstáculos (depth: 10 vs 5)
