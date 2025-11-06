# Runner Game - Phaser 3

Juego runner configurable con dos modos de juego: multicarril (lanes) y salto (runner).

## Descripción

Runner Game es un juego desarrollado en Phaser 3.85.2 que ofrece dos modos de juego completamente configurables:
- **Modo Lanes (Multicarril)**: El jugador cambia entre 3 carriles para esquivar obstáculos
- **Modo Runner (Salto)**: El jugador salta sobre obstáculos en un solo carril con física de gravedad

## Características Principales

### Dual Game Mode System
- **Lanes Mode**: Sistema de 3 carriles con cambio vertical
- **Runner Mode**: Sistema de salto con física completa (gravedad, doble salto opcional)

### Sistema de Obstáculos Avanzado
- Hasta 2 tipos de obstáculos configurables independientemente
- Obstáculos animados o estáticos
- Velocidad individual por obstáculo
- Frecuencia de aparición personalizable (spawnWeight)
- Posición Y independiente para cada obstáculo en modo runner

### Sistema de Parallax Background
- Dos capas de fondo con velocidades diferentes
- Completamente configurable (velocidad, escala, offset)

### Sistema de Puntuación
- Suma puntos al esquivar obstáculos exitosamente
- Resta puntos por colisiones
- Funciona en ambos modos de juego

### Características Adicionales
- Líneas de salida y meta configurables
- Temporizador con límite de tiempo
- Conteo regresivo inicial
- Múltiples tamaños de canvas (300x600, 300x250, 320x480, 728x90, 970x250)
- Sistema de assets unificado con basePath

## Estructura de Archivos

```
runner-game/
├── Proyecto/
│   ├── assets/           # Carpeta de assets del juego
│   │   ├── player.png    # Sprite sheet del jugador (10 frames)
│   │   ├── obstacle.png  # Sprite sheet obstáculo 1 (7 frames)
│   │   ├── obstacle2.png # Sprite sheet obstáculo 2 (6 frames)
│   │   ├── landscape.png # Background capa 1 (cielo/estadio)
│   │   ├── track.png     # Background capa 2 (pista)
│   │   ├── start.png     # Línea de salida (288×599)
│   │   └── goal.png      # Línea de meta (288×599)
│   ├── index.html        # Versión principal (300x600)
│   ├── index-300x250.html
│   ├── index-320x480.html
│   ├── index-728x90.html
│   ├── index-970x250.html
│   ├── main.js           # Lógica del juego (Preloader y Play scenes)
│   └── README.md
└── gwd_template/         # Plantilla para Google Web Designer
```

## Configuración Completa

### Game Mode
```javascript
gameMode: 'lanes'  // 'lanes' = multicarril, 'runner' = salto
```

### Player Configuration
```javascript
player: {
  frameWidth: 204.6,     // Ancho de cada frame
  frameHeight: 199,      // Alto del sprite sheet
  frames: 10,            // Número de frames
  scale: 0.5,            // Escala del player
  animationKey: 'run',   // Key de la animación
  frameRate: 16,         // Velocidad de animación (FPS)
  startX: 60             // Posición X inicial
}
```

### Lanes Configuration (modo 'lanes')
```javascript
lanes: {
  count: 3,                      // Número de carriles
  positions: [370, 420, 480]     // Posiciones Y de cada carril
}
```

### Jump Configuration (modo 'runner')
```javascript
jump: {
  enabled: true,             // Permitir salto
  playerY: 400,              // Posición Y del player en el suelo
  jumpVelocity: -700,        // Velocidad inicial del salto
  gravity: 1500,             // Gravedad aplicada
  jumpKey: 'SPACE',          // Tecla para saltar
  allowDoubleJump: false     // Permitir doble salto
}
```

### Parallax Background
```javascript
background: {
  landscape: {
    key: 'landscape',
    path: 'landscape.png',
    scrollSpeed: 0.7,        // Velocidad lenta (fondo)
    displayHeight: 300,
    offsetY: 0
  },
  track: {
    key: 'track',
    path: 'track.png',
    scrollSpeed: 3.3,        // Velocidad rápida (primer plano)
    displayHeight: 300,
    offsetY: 300
  }
}
```

### Obstacles Configuration
```javascript
obstacles: {
  minSpawnInterval: 1000,    // Tiempo mínimo entre spawns (ms)
  maxSpawnInterval: 2500,    // Tiempo máximo entre spawns (ms)

  obstacle1: {
    active: true,            // Usar este obstáculo
    key: 'obstacle1',
    path: 'obstacle.png',    // Path relativo a basePath
    isAnimated: true,        // Obstáculo animado
    scale: 0.4,
    speed: 3,                // Velocidad individual
    groundY: 400,            // Posición Y en modo runner
    spawnWeight: 3,          // Frecuencia de aparición
    frameWidth: 128.14,
    frameHeight: 199,
    frames: 7,
    animationKey: 'obstacle1-run',
    animationFrameRate: 10
  },

  obstacle2: {
    active: true,
    key: 'obstacle2',
    path: 'obstacle2.png',
    isAnimated: true,
    scale: 0.4,
    speed: 4,                // Más rápido que obstacle1
    groundY: 300,            // Diferente altura en runner
    spawnWeight: 2,          // Aparece menos frecuentemente
    frameWidth: 119.33,
    frameHeight: 199,
    frames: 6,
    animationKey: 'obstacle2-run',
    animationFrameRate: 10
  }
}
```

### Start/Finish Lines
```javascript
startLine: {
  active: true,              // Mostrar línea de salida
  x: 160,                    // Posición X
  y: 240,                    // Posición Y (centro vertical)
  scale: 1.2,                // Escala manual
  scaleToHeight: false       // false = usar scale, true = ajustar a alto
}

finishLine: {
  active: true,              // Mostrar línea de meta
  x: 140,                    // Posición X (fija, no se mueve)
  y: 240,
  scale: 1.2,
  showAtTime: 2              // Mostrar cuando queden X segundos
}
```

### Assets System
```javascript
assets: {
  basePath: 'assets/',       // Carpeta base (aplicado globalmente)
  player: {
    key: 'player',
    path: 'player.png'       // Path relativo a basePath
  }
  // Los obstáculos se cargan desde obstacles.obstacle1/obstacle2
  // Los backgrounds se cargan desde background.landscape/track
}
```

### Score System
```javascript
initialScore: 100,           // Score inicial
scoreIncrement: 10,          // Puntos por esquivar obstáculo
scoreDecrement: 20           // Puntos perdidos por colisión
```

## Controles

### Modo Lanes (Multicarril)
- **Flecha Arriba / W**: Cambiar al carril superior
- **Flecha Abajo / S**: Cambiar al carril inferior
- **Swipe Up/Down**: Cambiar carriles (móvil/táctil)

### Modo Runner (Salto)
- **Espacio / Flecha Arriba / W**: Saltar
- **Click/Tap**: Saltar
- Si `allowDoubleJump: true`, permite saltar dos veces seguidas

## Modos de Juego

### Lanes Mode
- 3 carriles verticales
- Cambio instantáneo entre carriles
- Obstáculos spawneados aleatoriamente en cualquier carril
- Colisión solo si player y obstáculo están en el mismo carril

### Runner Mode
- 1 solo carril
- Sistema de salto con física (gravedad)
- Cada obstáculo puede tener su propia altura (groundY)
- Colisión física basada en overlap de sprites

## Tamaños de Canvas Soportados

| Archivo | Dimensiones | Uso Típico |
|---------|-------------|------------|
| index.html | 300x600 | Mobile portrait, rich media |
| index-300x250.html | 300x250 | Medium rectangle |
| index-320x480.html | 320x480 | Mobile interstitial |
| index-728x90.html | 728x90 | Leaderboard banner |
| index-970x250.html | 970x250 | Billboard banner |

Cada tamaño tiene valores optimizados para:
- Escala del player y obstáculos
- Posiciones de carriles
- Parámetros de salto (si aplica)
- Velocidades de scroll
- Tamaño de fuentes y UI

## Sistema de Spawn Weight

El `spawnWeight` controla la frecuencia relativa de aparición de cada obstáculo:

```javascript
// Ejemplo:
obstacle1: { spawnWeight: 1 }  // 33% de probabilidad
obstacle2: { spawnWeight: 2 }  // 67% de probabilidad
// Total weight = 3

// Otros ejemplos:
spawnWeight: 0.5  // Mitad de frecuencia
spawnWeight: 3    // Triple frecuencia
spawnWeight: 0    // Nunca aparece (usar active: false en su lugar)
```

## Desarrollo

### Requisitos
- Navegador moderno con soporte WebGL
- Phaser 3.85.2 (cargado desde CDN)

### Instalación Local
1. Clonar el repositorio
2. Abrir cualquier archivo `index*.html` en un navegador
3. O usar un servidor local:
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js
   npx http-server
   ```

### Personalización

#### Cambiar Modo de Juego
```javascript
gameMode: 'lanes'   // Multicarril
gameMode: 'runner'  // Salto
```

#### Ajustar Dificultad
```javascript
// Más difícil:
obstacles: {
  minSpawnInterval: 800,   // Obstáculos más frecuentes
  maxSpawnInterval: 1500,
  speed: 5                 // Más rápidos
}

// Más fácil:
obstacles: {
  minSpawnInterval: 2000,  // Obstáculos menos frecuentes
  maxSpawnInterval: 4000,
  speed: 2                 // Más lentos
}
```

#### Cambiar Assets
1. Reemplazar archivos en carpeta `assets/`
2. Actualizar dimensiones en configuración si es necesario:
```javascript
player: {
  frameWidth: X,  // Ancho del nuevo sprite / número de frames
  frameHeight: Y, // Alto del nuevo sprite
  frames: N       // Número de frames en el sprite sheet
}
```

## Adaptación para Google Web Designer

La carpeta `gwd_template/` contiene una plantilla base para integrar el juego en Google Web Designer. Para adaptar:

1. Copiar archivos de `Proyecto/` a la plantilla GWD
2. Ajustar rutas de assets según estructura GWD
3. Integrar con componentes GWD (clicks, timers, eventos)
4. Configurar polite loading para optimizar carga

## Notas Técnicas

### Asset Loading
- Todos los assets usan un `basePath` global (`assets/`)
- Los paths en la configuración son relativos al basePath
- No usar `../` en los paths, solo nombres de archivo

### Colisiones
- **Lanes mode**: Basado en carril (lane-based)
- **Runner mode**: Basado en física (overlap-based)

### Profundidad (Depth)
- **Lanes mode**: Depth dinámico según carril (8, 10, 12)
- **Runner mode**: Depth fijo (10)
- Backgrounds: 0 (landscape), 2 (track)
- Lines: 5 (encima del track)

### Performance
- Sprites reutilizables mediante grupos de física
- Destrucción automática de obstáculos fuera de pantalla
- Optimización de animaciones con frameRate

## Troubleshooting

### Los obstáculos no aparecen
- Verificar que `active: true` en obstacle1/obstacle2
- Revisar `minSpawnInterval` y `maxSpawnInterval`
- Comprobar rutas de assets en consola del navegador

### El score no aumenta
- Verificar que los obstáculos pasan la posición X del player
- En modo lanes, asegurarse de cambiar de carril
- En modo runner, asegurarse de saltar sobre obstáculos

### El player no salta (modo runner)
- Verificar `gameMode: 'runner'`
- Comprobar `jump.enabled: true`
- Revisar parámetros de `jumpVelocity` y `gravity`

### Assets no cargan
- Verificar que `assets.basePath` es correcto
- Comprobar que los archivos existen en la carpeta assets
- No usar `../` en los paths, solo nombres de archivo

## Créditos

- Framework: Phaser 3.85.2
- Desarrollado para: Havas Trabajo

## Licencia

Uso interno de Havas.
