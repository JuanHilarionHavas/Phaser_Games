// ============================================================================
// TOP GEAR CLONE - PHASER 3
// Pseudo-3D racing game for rich media ads (300x600 / 320x480)
// ============================================================================

let config;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const Util = {
    toInt: function(obj, def) {
        if (obj !== null) {
            const x = parseInt(obj, 10);
            if (!isNaN(x)) return x;
        }
        return Util.toInt(def, 0);
    },

    toFloat: function(obj, def) {
        if (obj !== null) {
            const x = parseFloat(obj);
            if (!isNaN(x)) return x;
        }
        return Util.toFloat(def, 0.0);
    },

    limit: function(value, min, max) {
        return Math.max(min, Math.min(value, max));
    },

    randomInt: function(min, max) {
        return Math.round(Util.interpolate(min, max, Math.random()));
    },

    randomChoice: function(options) {
        return options[Util.randomInt(0, options.length - 1)];
    },

    percentRemaining: function(n, total) {
        return (n % total) / total;
    },

    accelerate: function(v, accel, dt) {
        return v + (accel * dt);
    },

    interpolate: function(a, b, percent) {
        return a + (b - a) * percent;
    },

    easeIn: function(a, b, percent) {
        return a + (b - a) * Math.pow(percent, 2);
    },

    easeOut: function(a, b, percent) {
        return a + (b - a) * (1 - Math.pow(1 - percent, 2));
    },

    easeInOut: function(a, b, percent) {
        return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
    },

    exponentialFog: function(distance, density) {
        return 1 / (Math.pow(Math.E, (distance * distance * density)));
    },

    increase: function(start, increment, max) {
        let result = start + increment;
        while (result >= max) result -= max;
        while (result < 0) result += max;
        return result;
    },

    project: function(p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    },

    overlap: function(x1, w1, x2, w2, percent) {
        const half = (percent || 1) / 2;
        const min1 = x1 - (w1 * half);
        const max1 = x1 + (w1 * half);
        const min2 = x2 - (w2 * half);
        const max2 = x2 + (w2 * half);
        return !((max1 < min2) || (min1 > max2));
    }
};

// ============================================================================
// PRELOADER SCENE
// ============================================================================

class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        config = window.GAME_CONFIG;

        // Configurar path base
        this.load.setPath(config.assets.basePath);

        // Cargar imágenes
        const images = config.assets.images;
        if (images.background) {
            this.load.image(images.background.key, images.background.path);
        }
        if (images.sprites) {
            this.load.image(images.sprites.key, images.sprites.path);
        }

        // Cargar audio (si existe)
        if (config.assets.audio) {
            Object.values(config.assets.audio).forEach(sound => {
                if (sound.path) {
                    this.load.audio(sound.key, sound.path);
                }
            });
        }

        // Crear barra de carga simple
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            font: '20px Courier',
            fill: '#ffffff'
        }).setOrigin(0.5);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });
    }

    create() {
        this.scene.start('MainGame');
    }
}

// ============================================================================
// MAIN GAME SCENE
// ============================================================================

class MainGame extends Phaser.Scene {
    constructor() {
        super('MainGame');
    }

    init() {
        this.config = config;

        // Configuración de carretera
        this.roadWidth = this.config.road.width;
        this.segmentLength = this.config.road.segmentLength;
        this.rumbleLength = this.config.road.rumbleLength;
        this.lanes = this.config.road.lanes;

        // Configuración de cámara
        this.cameraHeight = this.config.camera.height;
        this.fieldOfView = this.config.camera.fieldOfView;
        this.drawDistance = this.config.camera.drawDistance;
        this.fogDensity = this.config.camera.fogDensity;
        this.cameraDepth = 1 / Math.tan((this.fieldOfView / 2) * Math.PI / 180);

        // Jugador
        this.playerX = 0;
        this.playerZ = (this.cameraHeight * this.cameraDepth);
        this.position = 0;
        this.speed = 0;
        this.maxSpeed = this.config.player.maxSpeed;

        // Parallax
        this.skyOffset = 0;
        this.hillOffset = 0;
        this.treeOffset = 0;

        // Segmentos y tráfico
        this.segments = [];
        this.cars = [];

        // Controles
        this.keyLeft = false;
        this.keyRight = false;
        this.keyFaster = false;
        this.keySlower = false;

        // Tiempos
        this.currentLapTime = 0;
        this.lastLapTime = null;

        // Graphics para renderizado
        this.roadGraphics = null;
        this.spriteContainer = null;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Crear contenedor para fondos parallax
        this.createParallaxBackgrounds();

        // Crear graphics para la carretera
        this.roadGraphics = this.add.graphics();
        this.roadGraphics.setDepth(10);

        // Contenedor para sprites (decoración y tráfico)
        this.spriteContainer = this.add.container(0, 0);
        this.spriteContainer.setDepth(20);

        // Contenedor para el jugador
        this.playerSprite = null;
        this.playerContainer = this.add.container(0, 0);
        this.playerContainer.setDepth(30);

        // Crear cuerpo físico del jugador con Matter.js
        this.createPlayerPhysics();

        // Construir la pista
        this.resetRoad();

        // Configurar controles
        this.setupControls();

        // Configurar colisiones con Matter.js
        this.setupPhysics();

        // Iniciar actualización de HUD
        this.hudTimer = this.time.addEvent({
            delay: this.config.hud.updateFrequency,
            callback: this.updateHUD,
            callbackScope: this,
            loop: true
        });
    }

    createPlayerPhysics() {
        // Crear un cuerpo físico invisible para el jugador
        const physicsCfg = this.config.physics;

        // El cuerpo físico es un rectángulo que representa el auto
        // Dimensiones aproximadas del sprite del jugador
        const playerWidth = 40;
        const playerHeight = 60;

        this.playerBody = this.matter.add.rectangle(
            0, 0, // Posición será actualizada cada frame
            playerWidth,
            playerHeight,
            {
                friction: physicsCfg.friction,
                frictionAir: physicsCfg.frictionAir,
                mass: physicsCfg.mass,
                inertia: physicsCfg.inertia,
                restitution: physicsCfg.restitution,
                label: 'player',
                collisionFilter: physicsCfg.collisionFilter,
                isSensor: false // Colisiones reales
            }
        );

        // Hacer el cuerpo invisible (solo para físicas)
        this.playerBody.render.visible = false;
    }

    setupPhysics() {
        // Listener para colisiones del jugador
        this.matter.world.on('collisionstart', (event) => {
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;

                // Verificar si el jugador colisionó con un auto
                if ((bodyA.label === 'player' && bodyB.label === 'traffic') ||
                    (bodyA.label === 'traffic' && bodyB.label === 'player')) {
                    this.handleCarCollision(bodyA, bodyB);
                }
            });
        });
    }

    handleCarCollision(bodyA, bodyB) {
        // Reducir velocidad por colisión
        const speedReduction = 0.5; // Reducir velocidad al 50%
        this.speed *= speedReduction;

        // Efecto visual de impacto (opcional)
        this.cameras.main.shake(100, 0.005);
    }

    createParallaxBackgrounds() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const coords = this.config.assets.spriteCoords;

        // El horizonte donde la carretera desaparece visualmente está alrededor del 35-40% del canvas
        // Esto coincide con el punto de fuga de la proyección pseudo-3D
        const horizonY = height * 0.38; // Línea de horizonte más arriba para mejor efecto

        // Cielo: desde arriba hasta justo debajo del horizonte (con un poco de overlap)
        const skyHeight = horizonY + height * 0.08; // Sky se extiende un poco más allá del horizonte

        // Colinas: altura proporcional, terminan justo en el horizonte
        const hillHeight = height * 0.20;
        const hillsY = horizonY - hillHeight * 0.5; // Centradas en el horizonte

        // Árboles: más pequeños, justo en el horizonte
        const treeHeight = height * 0.18;
        const treesY = horizonY - treeHeight * 0.4; // Base en el horizonte

        // Capa de cielo - de arriba hacia el horizonte
        this.skyLayer1 = this.add.image(0, 0, 'background').setOrigin(0, 0).setDepth(1);
        this.skyLayer1.setCrop(coords.SKY.x, coords.SKY.y, coords.SKY.w / 2, coords.SKY.h);
        this.skyLayer1.setDisplaySize(width, skyHeight);

        this.skyLayer2 = this.add.image(width, 0, 'background').setOrigin(0, 0).setDepth(1);
        this.skyLayer2.setCrop(coords.SKY.x, coords.SKY.y, coords.SKY.w / 2, coords.SKY.h);
        this.skyLayer2.setDisplaySize(width, skyHeight);

        // Capa de colinas - cruzan el horizonte naturalmente
        this.hillLayer1 = this.add.image(0, hillsY, 'background').setOrigin(0, 0).setDepth(2);
        this.hillLayer1.setCrop(coords.HILLS.x, coords.HILLS.y, coords.HILLS.w / 2, coords.HILLS.h);
        this.hillLayer1.setDisplaySize(width, hillHeight);

        this.hillLayer2 = this.add.image(width, hillsY, 'background').setOrigin(0, 0).setDepth(2);
        this.hillLayer2.setCrop(coords.HILLS.x, coords.HILLS.y, coords.HILLS.w / 2, coords.HILLS.h);
        this.hillLayer2.setDisplaySize(width, hillHeight);

        // Capa de árboles - en el horizonte, transición natural a la carretera
        this.treeLayer1 = this.add.image(0, treesY, 'background').setOrigin(0, 0).setDepth(3);
        this.treeLayer1.setCrop(coords.TREES.x, coords.TREES.y, coords.TREES.w / 2, coords.TREES.h);
        this.treeLayer1.setDisplaySize(width, treeHeight);

        this.treeLayer2 = this.add.image(width, treesY, 'background').setOrigin(0, 0).setDepth(3);
        this.treeLayer2.setCrop(coords.TREES.x, coords.TREES.y, coords.TREES.w / 2, coords.TREES.h);
        this.treeLayer2.setDisplaySize(width, treeHeight);
    }

    setupControls() {
        // Teclas de dirección y WASD
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyW = this.input.keyboard.addKey('W');
        this.keyA = this.input.keyboard.addKey('A');
        this.keyS = this.input.keyboard.addKey('S');
        this.keyD = this.input.keyboard.addKey('D');
    }

    update(time, delta) {
        const dt = delta / 1000; // Convertir a segundos

        // Actualizar controles
        this.keyLeft = this.cursors.left.isDown || this.keyA.isDown;
        this.keyRight = this.cursors.right.isDown || this.keyD.isDown;
        this.keyFaster = this.cursors.up.isDown || this.keyW.isDown;
        this.keySlower = this.cursors.down.isDown || this.keyS.isDown;

        // Actualizar física
        this.updatePhysics(dt);

        // Actualizar tráfico
        this.updateCars(dt);

        // Actualizar parallax
        this.updateParallax();

        // Renderizar
        this.render();
    }

    updatePhysics(dt) {
        const playerSegment = this.findSegment(this.position + this.playerZ);
        const speedPercent = this.speed / this.maxSpeed;
        const dx = dt * 2 * speedPercent;
        const startPosition = this.position;

        // Actualizar posición usando Matter.js para suavidad
        const smoothing = 0.85; // Factor de suavizado (0-1)
        const targetPosition = Util.increase(this.position, dt * this.speed, this.trackLength);
        this.position = this.position + (targetPosition - this.position) * smoothing;

        // Movimiento lateral con interpolación suave
        let targetPlayerX = this.playerX;
        if (this.keyLeft) {
            targetPlayerX = this.playerX - dx;
        } else if (this.keyRight) {
            targetPlayerX = this.playerX + dx;
        }

        // Fuerza centrífuga
        targetPlayerX = targetPlayerX - (dx * speedPercent * playerSegment.curve * this.config.player.centrifugal);

        // Aplicar suavizado al movimiento lateral
        const lateralSmoothing = 0.75;
        this.playerX = this.playerX + (targetPlayerX - this.playerX) * lateralSmoothing;

        // Aceleración/Frenado con curvas de aceleración más suaves
        let targetSpeed = this.speed;
        if (this.keyFaster) {
            targetSpeed = Util.accelerate(this.speed, this.config.player.acceleration, dt);
        } else if (this.keySlower) {
            targetSpeed = Util.accelerate(this.speed, this.config.player.braking, dt);
        } else {
            targetSpeed = Util.accelerate(this.speed, this.config.player.deceleration, dt);
        }

        // Aplicar fricción de Matter.js
        const friction = this.config.physics.friction;
        this.speed = this.speed + (targetSpeed - this.speed) * friction;

        // Penalización fuera de carretera
        if ((this.playerX < -1) || (this.playerX > 1)) {
            if (this.speed > this.config.player.offRoadLimit) {
                this.speed = Util.accelerate(this.speed, this.config.player.offRoadDecel, dt);
            }

            // Colisión con sprites laterales
            for (let n = 0; n < playerSegment.sprites.length; n++) {
                const sprite = playerSegment.sprites[n];
                const spriteW = sprite.source.w * this.config.sprites.scale;
                const playerW = this.config.assets.spriteCoords.PLAYER_STRAIGHT.w * this.config.sprites.scale;

                if (Util.overlap(this.playerX, playerW, sprite.offset + spriteW / 2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
                    this.speed = this.maxSpeed / 5;
                    this.position = Util.increase(playerSegment.p1.world.z, -this.playerZ, this.trackLength);
                    break;
                }
            }
        }

        // Actualizar posición del cuerpo físico del jugador
        const width = this.cameras.main.width;
        const screenX = (width / 2) + (this.playerX * width * 0.3);
        const screenY = this.cameras.main.height - 80;
        this.matter.body.setPosition(this.playerBody, { x: screenX, y: screenY });

        // Limitar posición y velocidad
        this.playerX = Util.limit(this.playerX, -3, 3);
        this.speed = Util.limit(this.speed, 0, this.maxSpeed);

        // Actualizar offsets de parallax
        this.skyOffset = Util.increase(this.skyOffset, this.config.parallax.skySpeed * playerSegment.curve * (this.position - startPosition) / this.segmentLength, 1);
        this.hillOffset = Util.increase(this.hillOffset, this.config.parallax.hillSpeed * playerSegment.curve * (this.position - startPosition) / this.segmentLength, 1);
        this.treeOffset = Util.increase(this.treeOffset, this.config.parallax.treeSpeed * playerSegment.curve * (this.position - startPosition) / this.segmentLength, 1);

        // Actualizar tiempo de vuelta
        if (this.position > this.playerZ) {
            if (this.currentLapTime && (startPosition < this.playerZ)) {
                this.lastLapTime = this.currentLapTime;
                this.currentLapTime = 0;
            } else {
                this.currentLapTime += dt;
            }
        }
    }

    updateCars(dt) {
        for (let n = 0; n < this.cars.length; n++) {
            const car = this.cars[n];
            const oldSegment = this.findSegment(car.z);

            car.offset = car.offset + this.updateCarOffset(car, oldSegment);
            car.z = Util.increase(car.z, dt * car.speed, this.trackLength);
            car.percent = Util.percentRemaining(car.z, this.segmentLength);

            const newSegment = this.findSegment(car.z);
            if (oldSegment !== newSegment) {
                const index = oldSegment.cars.indexOf(car);
                oldSegment.cars.splice(index, 1);
                newSegment.cars.push(car);
            }
        }
    }

    updateCarOffset(car, carSegment) {
        const playerSegment = this.findSegment(this.position + this.playerZ);
        const lookahead = this.config.traffic.lookahead;
        const carW = car.sprite.w * this.config.sprites.scale;
        const playerW = this.config.assets.spriteCoords.PLAYER_STRAIGHT.w * this.config.sprites.scale;

        // Optimización: no procesar autos muy lejos del jugador
        if ((carSegment.index - playerSegment.index) > this.drawDistance) {
            return 0;
        }

        // Esquivar al jugador y otros autos
        for (let i = 1; i < lookahead; i++) {
            const segment = this.segments[(carSegment.index + i) % this.segments.length];

            // Esquivar jugador
            if ((segment === playerSegment) && (car.speed > this.speed) &&
                (Util.overlap(this.playerX, playerW, car.offset, carW, 1.2))) {
                let dir;
                if (this.playerX > 0.5) dir = -1;
                else if (this.playerX < -0.5) dir = 1;
                else dir = (car.offset > this.playerX) ? 1 : -1;
                return dir * 1 / i * (car.speed - this.speed) / this.maxSpeed;
            }

            // Esquivar otros autos
            for (let j = 0; j < segment.cars.length; j++) {
                const otherCar = segment.cars[j];
                const otherCarW = otherCar.sprite.w * this.config.sprites.scale;

                if ((car.speed > otherCar.speed) && Util.overlap(car.offset, carW, otherCar.offset, otherCarW, 1.2)) {
                    let dir;
                    if (otherCar.offset > 0.5) dir = -1;
                    else if (otherCar.offset < -0.5) dir = 1;
                    else dir = (car.offset > otherCar.offset) ? 1 : -1;
                    return dir * 1 / i * (car.speed - otherCar.speed) / this.maxSpeed;
                }
            }
        }

        // Volver a la carretera si está fuera
        if (car.offset < -0.9) return 0.1;
        else if (car.offset > 0.9) return -0.1;
        else return 0;
    }

    updateParallax() {
        const width = this.cameras.main.width;

        // Actualizar cielo
        const skyScroll = this.skyOffset * width;
        this.skyLayer1.x = -skyScroll;
        this.skyLayer2.x = width - skyScroll;
        if (this.skyLayer1.x < -width) this.skyLayer1.x = width;
        if (this.skyLayer2.x < -width) this.skyLayer2.x = width;

        // Actualizar colinas
        const hillScroll = this.hillOffset * width;
        this.hillLayer1.x = -hillScroll;
        this.hillLayer2.x = width - hillScroll;
        if (this.hillLayer1.x < -width) this.hillLayer1.x = width;
        if (this.hillLayer2.x < -width) this.hillLayer2.x = width;

        // Actualizar árboles
        const treeScroll = this.treeOffset * width;
        this.treeLayer1.x = -treeScroll;
        this.treeLayer2.x = width - treeScroll;
        if (this.treeLayer1.x < -width) this.treeLayer1.x = width;
        if (this.treeLayer2.x < -width) this.treeLayer2.x = width;
    }

    render() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const baseSegment = this.findSegment(this.position);
        const basePercent = Util.percentRemaining(this.position, this.segmentLength);
        const playerSegment = this.findSegment(this.position + this.playerZ);
        const playerPercent = Util.percentRemaining(this.position + this.playerZ, this.segmentLength);
        const playerY = Util.interpolate(playerSegment.p1.world.y, playerSegment.p2.world.y, playerPercent);

        let maxy = height;
        let x = 0;
        let dx = -(baseSegment.curve * basePercent);

        // Limpiar graphics
        this.roadGraphics.clear();

        // Limpiar sprites del contenedor
        this.spriteContainer.removeAll(true);
        this.playerContainer.removeAll(true);

        // Array para ordenar sprites por profundidad
        const renderQueue = [];

        // Dibujar segmentos de carretera
        for (let n = 0; n < this.drawDistance; n++) {
            const segment = this.segments[(baseSegment.index + n) % this.segments.length];
            segment.looped = segment.index < baseSegment.index;
            segment.fog = Util.exponentialFog(n / this.drawDistance, this.fogDensity);
            segment.clip = maxy;

            Util.project(segment.p1, (this.playerX * this.roadWidth) - x, playerY + this.cameraHeight,
                        this.position - (segment.looped ? this.trackLength : 0), this.cameraDepth, width, height, this.roadWidth);
            Util.project(segment.p2, (this.playerX * this.roadWidth) - x - dx, playerY + this.cameraHeight,
                        this.position - (segment.looped ? this.trackLength : 0), this.cameraDepth, width, height, this.roadWidth);

            x = x + dx;
            dx = dx + segment.curve;

            // Culling
            if ((segment.p1.camera.z <= this.cameraDepth) ||
                (segment.p2.screen.y >= segment.p1.screen.y) ||
                (segment.p2.screen.y >= maxy)) {
                continue;
            }

            this.renderSegment(segment);
            maxy = segment.p1.screen.y;

            // Agregar sprites del segmento a la cola de renderizado
            if (segment === playerSegment) {
                renderQueue.push({ type: 'player', segment: segment, percent: playerPercent });
            }

            // Agregar autos del segmento
            for (let i = 0; i < segment.cars.length; i++) {
                renderQueue.push({ type: 'car', car: segment.cars[i], segment: segment });
            }

            // Agregar decoración del segmento
            for (let i = 0; i < segment.sprites.length; i++) {
                renderQueue.push({ type: 'sprite', sprite: segment.sprites[i], segment: segment });
            }
        }

        // Renderizar sprites en orden (de atrás hacia adelante ya están en orden)
        renderQueue.reverse().forEach(item => {
            if (item.type === 'player') {
                this.renderPlayer(item.segment, item.percent);
            } else if (item.type === 'car') {
                this.renderCar(item.car, item.segment);
            } else if (item.type === 'sprite') {
                this.renderSprite(item.sprite, item.segment);
            }
        });
    }

    renderSegment(segment) {
        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;
        const color = segment.color;
        const width = this.cameras.main.width;

        const r1 = this.rumbleWidth(p1.w);
        const r2 = this.rumbleWidth(p2.w);
        const l1 = this.laneMarkerWidth(p1.w);
        const l2 = this.laneMarkerWidth(p2.w);

        // Convertir colores hex a number
        const grassColor = Phaser.Display.Color.HexStringToColor(color.grass).color;
        const rumbleColor = Phaser.Display.Color.HexStringToColor(color.rumble).color;
        const roadColor = Phaser.Display.Color.HexStringToColor(color.road).color;
        const laneColor = color.lane ? Phaser.Display.Color.HexStringToColor(color.lane).color : null;

        // Césped
        this.roadGraphics.fillStyle(grassColor, 1);
        this.roadGraphics.fillRect(0, p2.y, width, p1.y - p2.y);

        // Rumble strips
        this.polygon(p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumbleColor);
        this.polygon(p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumbleColor);

        // Carretera
        this.polygon(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, roadColor);

        // Líneas de carril
        if (laneColor) {
            const lanew1 = p1.w * 2 / this.lanes;
            const lanew2 = p2.w * 2 / this.lanes;
            let lanex1 = p1.x - p1.w + lanew1;
            let lanex2 = p2.x - p2.w + lanew2;

            for (let lane = 1; lane < this.lanes; lane++) {
                this.polygon(lanex1 - l1 / 2, p1.y, lanex1 + l1 / 2, p1.y,
                           lanex2 + l2 / 2, p2.y, lanex2 - l2 / 2, p2.y, laneColor);
                lanex1 += lanew1;
                lanex2 += lanew2;
            }
        }

        // Niebla
        if (segment.fog < 1) {
            const fogColor = Phaser.Display.Color.HexStringToColor(this.config.colors.fog).color;
            this.roadGraphics.fillStyle(fogColor, 1 - segment.fog);
            this.roadGraphics.fillRect(0, p1.y, width, p2.y - p1.y);
        }
    }

    renderCar(car, segment) {
        const width = this.cameras.main.width;

        const spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
        const spriteX = Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, car.percent) +
                      (spriteScale * car.offset * this.roadWidth * width / 2);
        const spriteY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, car.percent);

        // Actualizar posición del cuerpo físico del auto
        if (car.physicsBody && spriteY > 0 && spriteY < this.cameras.main.height) {
            this.matter.body.setPosition(car.physicsBody, { x: spriteX, y: spriteY });
        }

        this.drawSprite(car.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
    }

    renderSprite(sprite, segment) {
        const width = this.cameras.main.width;

        const spriteScale = segment.p1.screen.scale;
        const spriteX = segment.p1.screen.x + (spriteScale * sprite.offset * this.roadWidth * width / 2);
        const spriteY = segment.p1.screen.y;

        this.drawSprite(sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
    }

    renderPlayer(playerSegment, playerPercent) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const speedPercent = this.speed / this.maxSpeed;
        const bounce = (1.5 * Math.random() * speedPercent) * Util.randomChoice([-1, 1]);

        let sprite;
        const steer = this.speed * (this.keyLeft ? -1 : this.keyRight ? 1 : 0);
        const updown = playerSegment.p2.world.y - playerSegment.p1.world.y;

        // Seleccionar sprite según dirección
        const coords = this.config.assets.spriteCoords;
        if (steer < 0) {
            sprite = updown > 0 ? coords.PLAYER_UPHILL_LEFT : coords.PLAYER_LEFT;
        } else if (steer > 0) {
            sprite = updown > 0 ? coords.PLAYER_UPHILL_RIGHT : coords.PLAYER_RIGHT;
        } else {
            sprite = updown > 0 ? coords.PLAYER_UPHILL_STRAIGHT : coords.PLAYER_STRAIGHT;
        }

        // Crear el sprite directamente sin drawSprite para tener control total
        const spriteScale = 2.5; // Escala fija para el jugador
        const destW = sprite.w * spriteScale;
        const destH = sprite.h * spriteScale;
        const destX = (width / 2) - (destW / 2);
        const destY = height - destH - 30 + bounce; // 30px desde el bottom

        const img = this.add.image(destX, destY, 'sprites').setOrigin(0, 0);
        img.setCrop(sprite.x, sprite.y, sprite.w, sprite.h);
        img.setDisplaySize(destW, destH);
        this.playerContainer.add(img);
    }

    drawSprite(sprite, scale, destX, destY, offsetX, offsetY, clipY) {
        const width = this.cameras.main.width;

        const destW = (sprite.w * scale * width / 2) * (this.config.sprites.scale * this.roadWidth);
        const destH = (sprite.h * scale * width / 2) * (this.config.sprites.scale * this.roadWidth);

        destX = destX + (destW * (offsetX || 0));
        destY = destY + (destH * (offsetY || 0));

        const clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;

        if (clipH < destH) {
            const img = this.add.image(destX, destY, 'sprites').setOrigin(0, 0);
            img.setCrop(sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h * clipH / destH));
            img.setDisplaySize(destW, destH - clipH);
            this.spriteContainer.add(img);
        }
    }

    polygon(x1, y1, x2, y2, x3, y3, x4, y4, color) {
        this.roadGraphics.fillStyle(color, 1);
        this.roadGraphics.beginPath();
        this.roadGraphics.moveTo(x1, y1);
        this.roadGraphics.lineTo(x2, y2);
        this.roadGraphics.lineTo(x3, y3);
        this.roadGraphics.lineTo(x4, y4);
        this.roadGraphics.closePath();
        this.roadGraphics.fillPath();
    }

    rumbleWidth(projectedRoadWidth) {
        return projectedRoadWidth / Math.max(6, 2 * this.lanes);
    }

    laneMarkerWidth(projectedRoadWidth) {
        return projectedRoadWidth / Math.max(32, 8 * this.lanes);
    }

    // ========================================================================
    // CONSTRUCCIÓN DE LA PISTA
    // ========================================================================

    resetRoad() {
        this.segments = [];

        // Construir circuito similar al ejemplo
        this.addStraight(this.config.road.length.short);
        this.addLowRollingHills();
        this.addSCurves();
        this.addCurve(this.config.road.length.medium, this.config.road.curve.medium, this.config.road.hill.low);
        this.addBumps();
        this.addLowRollingHills();
        this.addCurve(this.config.road.length.long * 2, this.config.road.curve.medium, this.config.road.hill.medium);
        this.addStraight();
        this.addHill(this.config.road.length.medium, this.config.road.hill.high);
        this.addSCurves();
        this.addCurve(this.config.road.length.long, -this.config.road.curve.medium, this.config.road.hill.none);
        this.addHill(this.config.road.length.long, this.config.road.hill.high);
        this.addCurve(this.config.road.length.long, this.config.road.curve.medium, -this.config.road.hill.low);
        this.addBumps();
        this.addHill(this.config.road.length.long, -this.config.road.hill.medium);
        this.addStraight();
        this.addSCurves();
        this.addDownhillToEnd();

        this.resetSprites();
        this.resetCars();

        // Marcar inicio y fin
        const startIndex = this.findSegment(this.playerZ).index + 2;
        this.segments[startIndex].color = this.config.colors.start;
        this.segments[startIndex + 1].color = this.config.colors.start;

        for (let n = 0; n < this.rumbleLength; n++) {
            this.segments[this.segments.length - 1 - n].color = this.config.colors.finish;
        }

        this.trackLength = this.segments.length * this.segmentLength;
    }

    lastY() {
        return (this.segments.length === 0) ? 0 : this.segments[this.segments.length - 1].p2.world.y;
    }

    addSegment(curve, y) {
        const n = this.segments.length;
        this.segments.push({
            index: n,
            p1: { world: { y: this.lastY(), z: n * this.segmentLength }, camera: {}, screen: {} },
            p2: { world: { y: y, z: (n + 1) * this.segmentLength }, camera: {}, screen: {} },
            curve: curve,
            sprites: [],
            cars: [],
            color: Math.floor(n / this.rumbleLength) % 2 ? this.config.colors.dark : this.config.colors.light
        });
    }

    addRoad(enter, hold, leave, curve, y) {
        const startY = this.lastY();
        const endY = startY + (Util.toInt(y, 0) * this.segmentLength);
        const total = enter + hold + leave;

        for (let n = 0; n < enter; n++) {
            this.addSegment(Util.easeIn(0, curve, n / enter), Util.easeInOut(startY, endY, n / total));
        }
        for (let n = 0; n < hold; n++) {
            this.addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
        }
        for (let n = 0; n < leave; n++) {
            this.addSegment(Util.easeInOut(curve, 0, n / leave), Util.easeInOut(startY, endY, (enter + hold + n) / total));
        }
    }

    addStraight(num) {
        num = num || this.config.road.length.medium;
        this.addRoad(num, num, num, 0, 0);
    }

    addHill(num, height) {
        num = num || this.config.road.length.medium;
        height = height || this.config.road.hill.medium;
        this.addRoad(num, num, num, 0, height);
    }

    addCurve(num, curve, height) {
        num = num || this.config.road.length.medium;
        curve = curve || this.config.road.curve.medium;
        height = height || this.config.road.hill.none;
        this.addRoad(num, num, num, curve, height);
    }

    addLowRollingHills(num, height) {
        num = num || this.config.road.length.short;
        height = height || this.config.road.hill.low;
        this.addRoad(num, num, num, 0, height / 2);
        this.addRoad(num, num, num, 0, -height);
        this.addRoad(num, num, num, this.config.road.curve.easy, height);
        this.addRoad(num, num, num, 0, 0);
        this.addRoad(num, num, num, -this.config.road.curve.easy, height / 2);
        this.addRoad(num, num, num, 0, 0);
    }

    addSCurves() {
        this.addRoad(this.config.road.length.medium, this.config.road.length.medium, this.config.road.length.medium,
                    -this.config.road.curve.easy, this.config.road.hill.none);
        this.addRoad(this.config.road.length.medium, this.config.road.length.medium, this.config.road.length.medium,
                    this.config.road.curve.medium, this.config.road.hill.medium);
        this.addRoad(this.config.road.length.medium, this.config.road.length.medium, this.config.road.length.medium,
                    this.config.road.curve.easy, -this.config.road.hill.low);
        this.addRoad(this.config.road.length.medium, this.config.road.length.medium, this.config.road.length.medium,
                    -this.config.road.curve.easy, this.config.road.hill.medium);
        this.addRoad(this.config.road.length.medium, this.config.road.length.medium, this.config.road.length.medium,
                    -this.config.road.curve.medium, -this.config.road.hill.medium);
    }

    addBumps() {
        this.addRoad(10, 10, 10, 0, 5);
        this.addRoad(10, 10, 10, 0, -2);
        this.addRoad(10, 10, 10, 0, -5);
        this.addRoad(10, 10, 10, 0, 8);
        this.addRoad(10, 10, 10, 0, 5);
        this.addRoad(10, 10, 10, 0, -7);
        this.addRoad(10, 10, 10, 0, 5);
        this.addRoad(10, 10, 10, 0, -2);
    }

    addDownhillToEnd(num) {
        num = num || 200;
        this.addRoad(num, num, num, -this.config.road.curve.easy, -this.lastY() / this.segmentLength);
    }

    addSprite(n, sprite, offset) {
        this.segments[n].sprites.push({ source: sprite, offset: offset });
    }

    resetSprites() {
        const coords = this.config.assets.spriteCoords;

        // Vallas cada 20 segmentos al inicio
        const billboards = [
            coords.BILLBOARD07, coords.BILLBOARD06, coords.BILLBOARD08, coords.BILLBOARD09,
            coords.BILLBOARD01, coords.BILLBOARD02, coords.BILLBOARD03, coords.BILLBOARD04, coords.BILLBOARD05
        ];

        for (let i = 0; i < billboards.length; i++) {
            this.addSprite(20 + i * 20, billboards[i], -1);
        }

        // Árboles al inicio (reducidos para performance)
        for (let n = 10; n < 200; n += 10) {
            this.addSprite(n, coords.PALM_TREE, 0.5 + Math.random() * 0.5);
            this.addSprite(n, coords.PALM_TREE, 1 + Math.random() * 2);
        }

        // Plantas variadas (reducidas)
        const plants = [coords.TREE1, coords.TREE2, coords.BUSH1, coords.BUSH2, coords.CACTUS, coords.PALM_TREE];
        for (let n = 200; n < this.segments.length; n += 10) {
            this.addSprite(n, Util.randomChoice(plants), Util.randomChoice([1, -1]) * (2 + Math.random() * 3));
        }
    }

    resetCars() {
        this.cars = [];

        // Limpiar cuerpos físicos anteriores si existen
        if (this.trafficBodies) {
            this.trafficBodies.forEach(body => {
                this.matter.world.remove(body);
            });
        }
        this.trafficBodies = [];

        const coords = this.config.assets.spriteCoords;
        const carSprites = [coords.CAR01, coords.CAR02, coords.CAR03, coords.CAR04, coords.SEMI, coords.TRUCK];

        for (let n = 0; n < this.config.traffic.totalCars; n++) {
            const offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
            const z = Math.floor(Math.random() * this.segments.length) * this.segmentLength;
            const sprite = Util.randomChoice(carSprites);
            const speed = this.config.traffic.minSpeed +
                         Math.random() * (this.config.traffic.maxSpeed - this.config.traffic.minSpeed);

            // Crear cuerpo físico para el auto (invisible, solo para colisiones)
            const carBody = this.matter.add.rectangle(
                0, 0, // Posición será actualizada cada frame
                35, 45, // Dimensiones aproximadas del auto
                {
                    friction: 0.1,
                    frictionAir: 0.01,
                    mass: 0.8,
                    inertia: Infinity,
                    restitution: 0.3,
                    label: 'traffic',
                    collisionFilter: {
                        category: 0x0002,
                        mask: 0x0001 // Colisiona con jugador
                    },
                    isSensor: false
                }
            );
            carBody.render.visible = false;

            const car = {
                offset: offset,
                z: z,
                sprite: sprite,
                speed: speed,
                percent: 0,
                physicsBody: carBody
            };

            const segment = this.findSegment(car.z);
            segment.cars.push(car);
            this.cars.push(car);
            this.trafficBodies.push(carBody);
        }
    }

    findSegment(z) {
        return this.segments[Math.floor(z / this.segmentLength) % this.segments.length];
    }

    updateHUD() {
        const hudCfg = this.config.hud;

        // Actualizar velocidad (en mph simulado)
        const speedMph = Math.round(this.speed / this.maxSpeed * 200);
        const speedElement = document.querySelector(hudCfg.speedSelector);
        if (speedElement) {
            speedElement.textContent = `${hudCfg.speedLabel}: ${speedMph}`;
        }

        // Actualizar tiempo
        const lapTimeElement = document.querySelector(hudCfg.lapTimeSelector);
        if (lapTimeElement) {
            const minutes = Math.floor(this.currentLapTime / 60);
            const seconds = Math.floor(this.currentLapTime - (minutes * 60));
            const tenths = Math.floor(10 * (this.currentLapTime - Math.floor(this.currentLapTime)));
            const timeStr = minutes > 0 ?
                `${minutes}.${seconds < 10 ? '0' : ''}${seconds}.${tenths}` :
                `${seconds}.${tenths}`;
            lapTimeElement.textContent = `${hudCfg.lapTimeLabel}: ${timeStr}`;
        }
    }
}
