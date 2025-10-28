// Road Fighter - Phaser 3 Game
class RoadFighterGame extends Phaser.Scene {
    constructor() {
        super({ key: 'RoadFighterGame' });

        // Game variables
        this.player = null;
        this.cursors = null;
        this.enemies = null;
        this.fuelItems = null;

        // Game stats
        this.fuel = 100;
        this.score = 0;
        this.speed = 0;
        this.maxSpeed = 400;
        this.distance = 0;
        this.targetDistance = 5000; // Meta del nivel

        // Road scroll speed
        this.roadSpeed = 0;
        this.baseRoadSpeed = 2;

        // UI Elements
        this.fuelText = null;
        this.scoreText = null;
        this.speedText = null;
        this.distanceText = null;

        // Game state
        this.gameOver = false;
        this.gameWon = false;

        // Road lines
        this.roadLines = [];

        // Enemy spawn timer
        this.enemySpawnTimer = 0;
        this.enemySpawnDelay = 1500;

        // Fuel spawn timer
        this.fuelSpawnTimer = 0;
        this.fuelSpawnDelay = 3000;
    }

    preload() {
        // Nota: En un proyecto real, cargarías sprites aquí
        // Por ahora usaremos gráficos generados con Phaser
    }

    create() {
        // Configuración del mundo
        this.physics.world.setBounds(0, 0, 800, 600);

        // Crear carretera
        this.createRoad();

        // Crear jugador
        this.createPlayer();

        // Crear grupos
        this.enemies = this.physics.add.group();
        this.fuelItems = this.physics.add.group();

        // Controles
        this.cursors = this.input.keyboard.createCursorKeys();

        // Colisiones
        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.player, this.fuelItems, this.collectFuel, null, this);

        // UI
        this.createUI();

        // Instrucciones iniciales
        this.showInstructions();
    }

    createRoad() {
        // Fondo de carretera (gris oscuro)
        this.add.rectangle(400, 300, 600, 600, 0x444444).setDepth(-2);

        // Bordes de carretera (verde)
        this.add.rectangle(100, 300, 20, 600, 0x00aa00).setDepth(-1);
        this.add.rectangle(700, 300, 20, 600, 0x00aa00).setDepth(-1);

        // Líneas divisorias de carril (amarillas)
        for (let i = 0; i < 8; i++) {
            const line1 = this.add.rectangle(300, i * 150, 8, 80, 0xffff00);
            const line2 = this.add.rectangle(500, i * 150 - 75, 8, 80, 0xffff00);
            this.roadLines.push(line1, line2);
        }
    }

    createPlayer() {
        // Crear coche del jugador (rectángulo azul con detalles)
        this.player = this.add.container(400, 500);

        // Cuerpo del coche
        const body = this.add.rectangle(0, 0, 40, 70, 0x0066ff);
        // Ventana
        const window1 = this.add.rectangle(0, -15, 30, 15, 0x4499ff);
        // Parachoques
        const bumper1 = this.add.rectangle(0, -35, 40, 5, 0xcccccc);
        const bumper2 = this.add.rectangle(0, 35, 40, 5, 0xcccccc);
        // Ruedas
        const wheel1 = this.add.rectangle(-20, -20, 8, 15, 0x222222);
        const wheel2 = this.add.rectangle(20, -20, 8, 15, 0x222222);
        const wheel3 = this.add.rectangle(-20, 20, 8, 15, 0x222222);
        const wheel4 = this.add.rectangle(20, 20, 8, 15, 0x222222);

        this.player.add([body, window1, bumper1, bumper2, wheel1, wheel2, wheel3, wheel4]);

        // Física
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setSize(40, 70);
    }

    createEnemy(x, y, color, speed) {
        const enemy = this.add.container(x, y);

        // Diferentes colores para diferentes coches
        const body = this.add.rectangle(0, 0, 40, 60, color);
        const window1 = this.add.rectangle(0, 10, 30, 15, 0x333333);
        const bumper = this.add.rectangle(0, 30, 40, 5, 0x888888);

        enemy.add([body, window1, bumper]);

        this.physics.add.existing(enemy);
        enemy.body.setSize(40, 60);
        enemy.body.setVelocityY(speed);

        // Guardar velocidad original
        enemy.enemySpeed = speed;

        this.enemies.add(enemy);

        return enemy;
    }

    createFuelItem(x, y) {
        const fuel = this.add.container(x, y);

        // Ícono de combustible (letra F en un círculo)
        const circle = this.add.circle(0, 0, 15, 0xff0000);
        const text = this.add.text(0, 0, 'F', {
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        fuel.add([circle, text]);

        this.physics.add.existing(fuel);
        fuel.body.setSize(30, 30);
        fuel.body.setVelocityY(this.roadSpeed + this.baseRoadSpeed * 50);

        this.fuelItems.add(fuel);

        return fuel;
    }

    createUI() {
        // Fondo del panel de UI
        this.add.rectangle(400, 30, 800, 60, 0x000000, 0.7).setDepth(100);

        // Textos de UI
        this.fuelText = this.add.text(20, 20, 'FUEL: 100', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#00ff00'
        }).setDepth(101);

        this.scoreText = this.add.text(200, 20, 'SCORE: 0', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffffff'
        }).setDepth(101);

        this.speedText = this.add.text(400, 20, 'SPEED: 0 km/h', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#ffff00'
        }).setDepth(101);

        this.distanceText = this.add.text(620, 20, 'DIST: 0/5000m', {
            fontSize: '18px',
            fontFamily: 'Courier New',
            color: '#00ffff'
        }).setDepth(101);
    }

    showInstructions() {
        const instructions = this.add.text(400, 300,
            'ROAD FIGHTER\n\n' +
            'Flechas: Mover\n' +
            'Arriba: Acelerar\n' +
            'Abajo: Frenar\n\n' +
            'Recoge combustible (F)\n' +
            'Evita choques\n' +
            'Llega a 5000m!\n\n' +
            'Presiona ESPACIO para empezar',
            {
                fontSize: '20px',
                fontFamily: 'Courier New',
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 20, y: 20 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(200);

        this.input.keyboard.once('keydown-SPACE', () => {
            instructions.destroy();
        });
    }

    update(time, delta) {
        if (this.gameOver || this.gameWon) {
            return;
        }

        // Control del jugador
        this.handlePlayerInput();

        // Actualizar velocidad de carretera
        this.roadSpeed = this.baseRoadSpeed * (this.speed / 10);

        // Animar líneas de carretera
        this.updateRoadLines();

        // Spawn de enemigos
        this.spawnEnemies(time);

        // Spawn de combustible
        this.spawnFuel(time);

        // Actualizar enemigos
        this.updateEnemies();

        // Actualizar items de combustible
        this.updateFuelItems();

        // Consumir combustible
        this.consumeFuel(delta);

        // Actualizar distancia
        this.updateDistance(delta);

        // Actualizar UI
        this.updateUI();

        // Verificar condiciones de victoria/derrota
        this.checkGameConditions();
    }

    handlePlayerInput() {
        const acceleration = 0.5;
        const deceleration = 0.3;
        const turnSpeed = 5;

        // Aceleración
        if (this.cursors.up.isDown) {
            this.speed = Math.min(this.speed + acceleration, this.maxSpeed);
        } else if (this.cursors.down.isDown) {
            this.speed = Math.max(this.speed - deceleration * 2, 0);
        } else {
            // Desaceleración natural
            this.speed = Math.max(this.speed - deceleration, 0);
        }

        // Movimiento lateral (solo si hay velocidad)
        if (this.speed > 0) {
            if (this.cursors.left.isDown) {
                this.player.x -= turnSpeed;
            } else if (this.cursors.right.isDown) {
                this.player.x += turnSpeed;
            }
        }

        // Mantener en los límites de la carretera
        this.player.x = Phaser.Math.Clamp(this.player.x, 120, 680);
    }

    updateRoadLines() {
        this.roadLines.forEach(line => {
            line.y += this.roadSpeed;

            // Resetear línea cuando sale de pantalla
            if (line.y > 650) {
                line.y = -50;
            }
        });
    }

    spawnEnemies(time) {
        if (time > this.enemySpawnTimer) {
            // Carriles disponibles
            const lanes = [200, 300, 400, 500, 600];
            const lane = Phaser.Utils.Array.GetRandom(lanes);

            // Colores variados
            const colors = [0xff0000, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff];
            const color = Phaser.Utils.Array.GetRandom(colors);

            // Velocidad aleatoria (más lento que el jugador)
            const enemySpeed = Phaser.Math.Between(100, 200);

            this.createEnemy(lane, -50, color, enemySpeed);

            // Próximo spawn (más rápido a mayor velocidad)
            this.enemySpawnTimer = time + Math.max(800, this.enemySpawnDelay - this.speed);
        }
    }

    spawnFuel(time) {
        if (time > this.fuelSpawnTimer) {
            const lanes = [200, 300, 400, 500, 600];
            const lane = Phaser.Utils.Array.GetRandom(lanes);

            this.createFuelItem(lane, -30);

            this.fuelSpawnTimer = time + this.fuelSpawnDelay;
        }
    }

    updateEnemies() {
        this.enemies.children.entries.forEach(enemy => {
            // Ajustar velocidad relativa al jugador
            enemy.body.setVelocityY(enemy.enemySpeed - this.roadSpeed);

            // Eliminar si sale de pantalla
            if (enemy.y > 650 || enemy.y < -100) {
                enemy.destroy();
                // Puntos por adelantar un coche
                if (enemy.y > 650) {
                    this.score += 10;
                }
            }
        });
    }

    updateFuelItems() {
        this.fuelItems.children.entries.forEach(fuel => {
            fuel.body.setVelocityY(200 - this.roadSpeed);

            // Eliminar si sale de pantalla
            if (fuel.y > 650) {
                fuel.destroy();
            }
        });
    }

    consumeFuel(delta) {
        // Consumir más combustible a mayor velocidad
        const fuelConsumption = (0.01 + this.speed / 20000) * delta / 16;
        this.fuel = Math.max(0, this.fuel - fuelConsumption);
    }

    updateDistance(delta) {
        // La distancia aumenta con la velocidad
        this.distance += (this.speed / 1000) * delta / 16;
    }

    updateUI() {
        this.fuelText.setText(`FUEL: ${Math.floor(this.fuel)}`);
        this.fuelText.setColor(this.fuel < 20 ? '#ff0000' : '#00ff00');

        this.scoreText.setText(`SCORE: ${this.score}`);
        this.speedText.setText(`SPEED: ${Math.floor(this.speed)} km/h`);
        this.distanceText.setText(`DIST: ${Math.floor(this.distance)}/${this.targetDistance}m`);
    }

    hitEnemy(player, enemy) {
        // Colisión con enemigo
        enemy.destroy();

        // Penalización
        this.fuel = Math.max(0, this.fuel - 20);
        this.speed = Math.max(0, this.speed - 100);

        // Efecto visual
        this.cameras.main.shake(200, 0.01);

        // Sonido de choque (visual feedback)
        this.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2
        });
    }

    collectFuel(player, fuelItem) {
        fuelItem.destroy();

        // Añadir combustible
        this.fuel = Math.min(100, this.fuel + 30);
        this.score += 50;

        // Efecto visual
        this.tweens.add({
            targets: this.fuelText,
            scale: 1.5,
            duration: 100,
            yoyo: true
        });
    }

    checkGameConditions() {
        // Game Over por falta de combustible
        if (this.fuel <= 0) {
            this.triggerGameOver('SIN COMBUSTIBLE!\nGAME OVER');
        }

        // Victoria por completar la distancia
        if (this.distance >= this.targetDistance) {
            this.triggerVictory();
        }
    }

    triggerGameOver(message) {
        this.gameOver = true;

        const gameOverText = this.add.text(400, 300,
            message + '\n\nPuntuación: ' + this.score + '\n\nPresiona R para reiniciar',
            {
                fontSize: '24px',
                fontFamily: 'Courier New',
                color: '#ff0000',
                backgroundColor: '#000000',
                padding: { x: 20, y: 20 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(200);

        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });
    }

    triggerVictory() {
        this.gameWon = true;

        const bonus = Math.floor(this.fuel * 10);
        this.score += bonus;

        const victoryText = this.add.text(400, 300,
            '¡NIVEL COMPLETADO!\n\n' +
            'Puntuación: ' + (this.score - bonus) + '\n' +
            'Bonus Combustible: ' + bonus + '\n' +
            'TOTAL: ' + this.score + '\n\n' +
            'Presiona R para jugar de nuevo',
            {
                fontSize: '24px',
                fontFamily: 'Courier New',
                color: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 20, y: 20 },
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(200);

        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });
    }
}

// Configuración del juego
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#222222',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: RoadFighterGame
};

// Iniciar el juego
const game = new Phaser.Game(config);