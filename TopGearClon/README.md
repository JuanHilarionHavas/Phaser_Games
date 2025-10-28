# Top Gear Clone - Phaser 3

Juego de carreras pseudo-3D optimizado para rich media ads (300x600 / 320x480) usando Phaser 3.

## Características

- ✅ **Renderizado pseudo-3D** con proyección de perspectiva
- ✅ **Sistema de segmentos** para carretera con curvas y colinas
- ✅ **Parallax backgrounds** (cielo, colinas, árboles)
- ✅ **Física realista** del vehículo con fuerza centrífuga
- ✅ **Tráfico con IA** - Los autos esquivan al jugador y entre ellos
- ✅ **Sprites y decoración** del lado de la carretera
- ✅ **HUD externo** con velocidad y tiempo de vuelta
- ✅ **Configuración por objeto** - Todo configurable desde `GAME_CONFIG`
- ✅ **Responsive** - Adaptable a 300x600 y 320x480
- ✅ **Sin npm** - Todo funciona desde CDN

## Estructura de Archivos

```
TopGearClon/
├── index.html          # HTML principal con configuración GAME_CONFIG
├── main.js             # Lógica del juego (Preloader + MainGame)
├── README.md           # Documentación
└── assets/
    └── images/
        ├── background.png    # Spritesheet de fondos parallax
        └── sprites.png       # Spritesheet de vehículos y decoración
```

## Instalación y Uso

1. **Abrir directamente**: Simplemente abre `index.html` en un navegador moderno
2. **Servidor local** (recomendado para desarrollo):
   ```bash
   # Con Python 3
   python -m http.server 8000

   # Luego visita: http://localhost:8000
   ```

## Controles

- **Flechas arriba/W**: Acelerar
- **Flechas abajo/S**: Frenar
- **Flechas izquierda/A**: Girar izquierda
- **Flechas derecha/D**: Girar derecha

## Configuración

Todo el juego se configura desde `window.GAME_CONFIG` en [index.html](index.html):

### Cambiar Dimensiones del Canvas

```javascript
canvas: {
    width: 300,
    height: 600,
    altWidth: 320,
    altHeight: 480,
    useAlt: false  // Cambiar a true para usar 320x480
}
```

### Ajustar Física del Vehículo

```javascript
player: {
    maxSpeed: 200,           // Velocidad máxima
    acceleration: 40,        // Aceleración
    braking: -200,           // Frenado
    deceleration: -40,       // Desaceleración natural
    offRoadDecel: -100,      // Desaceleración fuera de carretera
    centrifugal: 0.3         // Fuerza centrífuga en curvas
}
```

### Configurar Tráfico

```javascript
traffic: {
    totalCars: 50,           // Número de autos (reducido para rich media)
    minSpeed: 50,            // Velocidad mínima
    maxSpeed: 150,           // Velocidad máxima
    lookahead: 20,           // Segmentos de anticipación para esquivar
    avoidanceSpeed: 0.1      // Velocidad de reacción
}
```

### Personalizar Carretera

```javascript
road: {
    width: 2000,             // Ancho de la carretera
    segmentLength: 200,      // Longitud de cada segmento
    lanes: 3,                // Número de carriles
    curve: {
        easy: 2,
        medium: 4,
        hard: 6
    },
    hill: {
        low: 20,
        medium: 40,
        high: 60
    }
}
```

### Ajustar Cámara y Niebla

```javascript
camera: {
    height: 1000,            // Altura de la cámara
    fieldOfView: 100,        // Campo de visión (grados)
    drawDistance: 300,       // Segmentos visibles
    fogDensity: 5            // Densidad de niebla
}
```

## Arquitectura Técnica

### Sistema de Proyección 3D

El juego usa proyección de perspectiva para convertir coordenadas 3D a 2D:

```javascript
scale = cameraDepth / distancia_z
screen.x = (width/2) + (scale * camera.x * width/2)
screen.y = (height/2) - (scale * camera.y * height/2)
```

### Sistema de Segmentos

La carretera se divide en segmentos que tienen:
- **p1, p2**: Puntos de inicio y fin
- **world**: Coordenadas 3D (x, y, z)
- **camera**: Coordenadas relativas a la cámara
- **screen**: Coordenadas 2D proyectadas
- **curve**: Curvatura del segmento
- **sprites**: Objetos laterales
- **cars**: Vehículos de tráfico

### Física del Vehículo

1. **Aceleración**: `speed = speed + (accel * dt)`
2. **Fuerza centrífuga**: `playerX -= dx * speedPercent * curve * centrifugal`
3. **Penalización fuera de carretera**: Aplica desaceleración extra
4. **Colisiones**: Detección con sprites y tráfico

### IA del Tráfico

Los autos observan 20 segmentos adelante y:
- Esquivan al jugador si va más lento
- Esquivan otros autos más lentos
- Vuelven a la carretera si se salen

### Parallax Backgrounds

Tres capas con diferentes velocidades:
- **Cielo**: 0.001 (más lento)
- **Colinas**: 0.002
- **Árboles**: 0.003 (más rápido)

Crea sensación de profundidad.

## Optimizaciones para Rich Media

1. **Draw Distance limitada**: Solo 300 segmentos visibles
2. **Tráfico reducido**: 50 autos vs 200 del original
3. **Canvas personalizado**: Renderizado optimizado
4. **Fog culling**: Oculta geometría lejana
5. **Back-face culling**: No dibuja segmentos invisibles
6. **Sin assets externos pesados**: Todo en spritesheets

## Diferencias con el Juego Original

| Característica | JavaScript Racer | Este Clone |
|---------------|------------------|------------|
| Framework | Vanilla JS + Canvas | Phaser 3 |
| Configuración | Hardcoded | Objeto GAME_CONFIG |
| HUD | DOM en HTML | DOM externo configurable |
| Tamaño | 1024x768 | 300x600 / 320x480 |
| Tráfico | 200 autos | 50 autos (optimizado) |
| Audio | Incluido | Preparado (sin assets) |

## Próximas Mejoras

- [ ] Sistema de vueltas completo
- [ ] Competidores con nombres y posiciones
- [ ] Sistema de nitro/turbo
- [ ] Efectos de partículas (humo, polvo)
- [ ] Sonidos (motor, derrapes, colisiones)
- [ ] Múltiples circuitos
- [ ] Sistema de daño del vehículo
- [ ] Checkpoints de tiempo

## Créditos

Basado en [javascript-racer](https://github.com/jakesgordon/javascript-racer) de Jake Gordon.

## Licencia

MIT License