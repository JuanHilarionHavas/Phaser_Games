let gameConfig;

// === Preloader Scene ===
class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    gameConfig = window.GAME_CONFIG;
    const assets = gameConfig.assets;

    // Configurar rutas base
    this.load.setBaseURL('./');
    this.load.setPath(assets.basePath || './');

    // Cargar background
    if (assets.background) {
      this.load.image(assets.background.key, assets.background.path);
    }

    // Cargar línea de salida
    if (assets.startLine) {
      this.load.image(assets.startLine.key, assets.startLine.path);
    }

    // Cargar línea de meta
    if (assets.finishLine) {
      this.load.image(assets.finishLine.key, assets.finishLine.path);
    }

    // Cargar player sprite sheet
    if (assets.player) {
      this.load.spritesheet(assets.player.key, assets.player.path, {
        frameWidth: gameConfig.player.frameWidth,
        frameHeight: gameConfig.player.frameHeight
      });
    }

    // Cargar obstáculo sprite sheet
    if (assets.obstacle) {
      this.load.spritesheet(assets.obstacle.key, assets.obstacle.path, {
        frameWidth: gameConfig.obstacles.frameWidth || 128.14,
        frameHeight: gameConfig.obstacles.frameHeight || 199
      });
    }
  }

  create() {
    // Crear animación del player (frame 1-9, excluyendo frame 0 que es estar quieto)
    this.anims.create({
      key: gameConfig.player.animationKey,
      frames: this.anims.generateFrameNumbers(gameConfig.assets.player.key, {
        start: 1, // Empezar desde frame 1 (excluir frame 0 de estar quieto)
        end: gameConfig.player.frames - 1
      }),
      frameRate: gameConfig.player.frameRate,
      repeat: -1 // Loop infinito
    });

    // Crear animación del obstáculo (configurable desde config)
    this.anims.create({
      key: gameConfig.obstacles.animationKey || 'obstacle-run',
      frames: this.anims.generateFrameNumbers(gameConfig.assets.obstacle.key, {
        start: gameConfig.obstacles.animationStart || 0,
        end: (gameConfig.obstacles.frames || 7) - 1
      }),
      frameRate: gameConfig.obstacles.animationFrameRate || 10,
      repeat: -1 // Loop infinito
    });

    this.scene.start('Play');
  }
}

// === Play Scene ===
class Play extends Phaser.Scene {
  constructor() {
    super('Play');
  }

  init() {
    this.config = gameConfig;
    this.currentLane = 1; // Carril central (0, 1, 2)
    this.canMove = false; // Iniciar sin movimiento (durante el conteo)
    this.gameStarted = false; // El juego no ha comenzado aún
    this.timeLeft = this.config.timeLimit;
    this.score = this.config.initialScore;
    this.obstacles = [];
    this.bgScrollX = 0;
    this.backgroundPaused = false; // Flag para pausar el scroll del background
    this.timerReachedZero = false; // Flag para saber si el timer ya llegó a 0
    this.isGameOver = false;
    this.hasReachedGoal = false;
    this.isMovingToGoal = false; // Flag para indicar que se está moviendo a la meta
    this.finishLineShown = false; // Flag para controlar si ya se mostró la línea de meta

    // Actualizar UI inicial
    this.updateTimerDisplay();
    this.updateScoreDisplay();

    this.cameras.main.fadeIn(500);
  }

  updateTimerDisplay() {
    const ui = this.config.ui;
    if (ui.useExternalUI && ui.timerSelector) {
      const timerElement = document.querySelector(ui.timerSelector);
      if (timerElement) {
        timerElement.textContent = `${ui.timerLabel} ${this.timeLeft}`;
      }
    }
  }

  updateScoreDisplay() {
    const ui = this.config.ui;
    if (ui.useExternalUI && ui.scoreSelector) {
      const scoreElement = document.querySelector(ui.scoreSelector);
      if (scoreElement) {
        scoreElement.textContent = `${ui.scoreLabel} ${this.score}`;
      }
    }
  }

  create() {
    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;

    // Configuración del background
    const bgConfig = this.config.background;
    const bgScale = bgConfig.scale || 1;
    const bgTileWidth = bgConfig.displayWidth || (bgConfig.width * bgScale);
    const bgTileHeight = bgConfig.displayHeight || (bgConfig.height * bgScale);
    const bgOffsetX = bgConfig.offsetX || 0;
    const bgOffsetY = bgConfig.offsetY || 0;

    // Crear background principal para scroll
    // El TileSprite cubre todo el canvas pero usa el tile del tamaño configurado
    this.bg = this.add.tileSprite(
      bgOffsetX,
      (height / 2) + bgOffsetY,
      width,  // Ancho del canvas para cubrir todo
      height, // Alto del canvas para cubrir todo
      'bg'
    )
      .setOrigin(0, 0.5)
      .setTileScale(bgScale, bgScale); // Aplicar escala a los tiles

    // Calcular el centro vertical de la zona de carriles
    const lanePositions = this.config.lanes.positions;
    const laneCenterY = (lanePositions[0] + lanePositions[lanePositions.length - 1]) / 2;

    // Crear línea de salida (visible al inicio)
    const startLineConfig = this.config.startLine || {};
    const startLineX = startLineConfig.x || 30;
    const startLineY = startLineConfig.y || laneCenterY;
    const startLineScale = startLineConfig.scale || 0.5;
    const startLineRotation = startLineConfig.rotation || 0;
    const startLineFlipX = startLineConfig.flipX || false;
    const startLineFlipY = startLineConfig.flipY || false;

    this.startLine = this.add.sprite(startLineX, startLineY, 'start')
      .setScale(startLineScale)
      .setAngle(startLineRotation)
      .setFlipX(startLineFlipX)
      .setFlipY(startLineFlipY)
      .setDepth(1);

    // Crear línea de meta (invisible al inicio, se moverá desde la derecha)
    const finishLineConfig = this.config.finishLine || {};
    const finishLineX = finishLineConfig.x || (width + 100);
    const finishLineY = finishLineConfig.y || laneCenterY;
    const finishLineScale = finishLineConfig.scale || 0.5;
    const finishLineRotation = finishLineConfig.rotation || 0;
    const finishLineFlipX = finishLineConfig.flipX || false;
    const finishLineFlipY = finishLineConfig.flipY || false;

    this.finishLine = this.add.sprite(finishLineX, finishLineY, 'finish')
      .setScale(finishLineScale)
      .setAngle(finishLineRotation)
      .setFlipX(finishLineFlipX)
      .setFlipY(finishLineFlipY)
      .setDepth(1)
      .setVisible(false);

    // Crear player
    const playerY = this.config.lanes.positions[this.currentLane];
    const playerX = this.config.player.startX || 80; // Posición X inicial configurable
    this.player = this.physics.add.sprite(playerX, playerY, gameConfig.assets.player.key)
      .setScale(gameConfig.player.scale)
      .setFrame(0) // Iniciar en frame 0 (quieto)
      .setDepth(10); // Player siempre por encima de los obstáculos

    // NO iniciar la animación aún, esperar al conteo o inicio del juego

    // Grupo de obstáculos
    this.obstaclesGroup = this.physics.add.group();

    // Configurar colisiones (con verificación de carril)
    this.physics.add.overlap(
      this.player,
      this.obstaclesGroup,
      this.hitObstacle,
      this.checkSameLane, // Callback para verificar si están en el mismo carril
      this
    );

    // Configurar controles
    this.setupControls();

    // Verificar si hay conteo regresivo
    if (this.config.countdown?.enabled) {
      this.startCountdown();
    } else {
      this.startGame();
    }
  }

  startCountdown() {
    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;
    const countdownConfig = this.config.countdown;
    let countdownValue = countdownConfig.duration || 3;

    // Crear texto de conteo regresivo
    const textStyle = countdownConfig.textStyle || {
      fontSize: '72px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8
    };

    this.countdownText = this.add.text(width / 2, height / 2, countdownValue.toString(), textStyle)
      .setOrigin(0.5)
      .setDepth(100);

    // Animar conteo regresivo
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        countdownValue--;

        if (countdownValue > 0) {
          this.countdownText.setText(countdownValue.toString());
          // Efecto de escala
          this.countdownText.setScale(1.5);
          this.tweens.add({
            targets: this.countdownText,
            scale: 1,
            duration: 500,
            ease: 'Back.out'
          });
        } else {
          // Mostrar "GO!" o "¡VAMOS!"
          this.countdownText.setText('GO!');
          this.countdownText.setScale(1.5);
          this.tweens.add({
            targets: this.countdownText,
            scale: 1,
            alpha: 0,
            duration: 500,
            ease: 'Back.out',
            onComplete: () => {
              this.countdownText.destroy();
              this.startGame();
            }
          });
          countdownTimer.remove();
        }
      },
      callbackScope: this,
      loop: true
    });
  }

  startGame() {
    // Activar el juego
    this.gameStarted = true;
    this.canMove = true;

    // Iniciar animación del player (empezar a correr)
    this.player.play(this.config.player.animationKey);

    // Iniciar timer del juego
    this.startGameTimer();

    // Iniciar spawn de obstáculos
    this.scheduleNextObstacle();
  }

  setupControls() {
    // Controles de teclado
    this.input.keyboard.on('keydown-UP', () => this.changeLane(-1));
    this.input.keyboard.on('keydown-DOWN', () => this.changeLane(1));
    this.input.keyboard.on('keydown-W', () => this.changeLane(-1));
    this.input.keyboard.on('keydown-S', () => this.changeLane(1));

    // Controles táctiles (swipe)
    this.input.on('pointerdown', (pointer) => {
      this.swipeStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer) => {
      if (this.swipeStartY !== undefined) {
        const deltaY = pointer.y - this.swipeStartY;
        const swipeThreshold = 30;

        if (deltaY < -swipeThreshold) {
          // Swipe arriba
          this.changeLane(-1);
        } else if (deltaY > swipeThreshold) {
          // Swipe abajo
          this.changeLane(1);
        }

        this.swipeStartY = undefined;
      }
    });
  }

  changeLane(direction) {
    if (!this.canMove || this.isGameOver) return;

    const newLane = Phaser.Math.Clamp(this.currentLane + direction, 0, this.config.lanes.count - 1);

    if (newLane !== this.currentLane) {
      this.currentLane = newLane;
      const targetY = this.config.lanes.positions[this.currentLane];

      // Animar movimiento del player
      this.tweens.add({
        targets: this.player,
        y: targetY,
        duration: 200,
        ease: 'Power2'
      });
    }
  }

  startGameTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.isGameOver) return;

        this.timeLeft--;
        this.updateTimerDisplay();

        // Mostrar línea de meta cuando quede el tiempo configurado
        const showFinishTime = this.config.finishLine?.showAtTime || 5;
        if (this.timeLeft <= showFinishTime && !this.finishLineShown) {
          this.showFinishLine();
        }

        // Calcular cuándo iniciar el movimiento final hacia la meta
        // Solo necesitamos el tiempo de movimiento, NO el animationDelay
        const goalDuration = (this.config.goal?.duration || 1000) / 1000; // Convertir a segundos
        const totalGoalTime = Math.ceil(goalDuration);

        if (this.timeLeft <= totalGoalTime && !this.isMovingToGoal) {
          this.moveToGoal();
        }

        if (this.timeLeft <= 0) {
          // Pausar el timer en 0
          this.timeLeft = 0;
          this.updateTimerDisplay();
          this.timerEvent.paused = true; // Detener el timer

          // Pausar el scroll del background
          this.backgroundPaused = true;

          // Marcar que el timer llegó a 0
          this.timerReachedZero = true;

          // Cuando el timer llega a 0, verificar si ya llegó a la meta
          if (this.hasReachedGoal) {
            // Ya está en la meta, iniciar el animationDelay
            const goalAnimationDelay = this.config.goal?.animationDelay || 1000;
            this.time.delayedCall(goalAnimationDelay, () => {
              this.endGame(true); // Victoria
            });
          } else if (!this.isMovingToGoal) {
            // No está en la meta, terminar inmediatamente
            this.endGame(true);
          }
          // Si está moviendose pero no ha llegado, el callback se ejecutará desde moveToGoal
        }
      },
      callbackScope: this,
      loop: true
    });
  }

  showFinishLine() {
    this.finishLineShown = true;

    // Simplemente hacer visible la línea de meta en su posición fija
    this.finishLine.setVisible(true);

    // La línea de meta permanece completamente fija (setScrollFactor(0) aplicado en create)
  }

  moveToGoal() {
    // Iniciar movimiento del player hacia la meta
    this.isMovingToGoal = true;
    this.canMove = false; // Deshabilitar controles de cambio de carril

    // Usar configuración para posición y duración del movimiento a la meta
    const goalConfig = this.config.goal || {};
    const goalDuration = goalConfig.duration || 1000; // Duración del movimiento en ms

    // Calcular posición final X
    let goalX;
    if (goalConfig.playerFinalX !== null && goalConfig.playerFinalX !== undefined) {
      goalX = goalConfig.playerFinalX; // Usar posición X configurada
    } else {
      const goalOffset = goalConfig.offset || 35;
      goalX = this.sys.game.scale.width - goalOffset; // Calcular con offset
    }

    // Calcular posición final Y
    let goalY;
    if (goalConfig.playerFinalY !== null && goalConfig.playerFinalY !== undefined) {
      goalY = goalConfig.playerFinalY; // Usar posición Y configurada
    } else {
      goalY = this.player.y; // Mantener la Y actual del carril
    }

    this.tweens.add({
      targets: this.player,
      x: goalX,
      y: goalY,
      duration: goalDuration,
      ease: 'Linear',
      onComplete: () => {
        // Al llegar a la meta, detener animación y mostrar frame 0 (quieto)
        this.player.stop(); // Detener la animación
        this.player.setFrame(0); // Poner frame 0 (estar quieto)
        this.hasReachedGoal = true;

        // Verificar si el timer ya llegó a 0
        if (this.timerReachedZero) {
          // El timer ya llegó a 0, iniciar el animationDelay ahora
          const goalAnimationDelay = this.config.goal?.animationDelay || 1000;
          this.time.delayedCall(goalAnimationDelay, () => {
            this.endGame(true); // Victoria
          });
        }
        // Si el timer no ha llegado a 0, el callback se ejecutará desde startGameTimer
      }
    });
  }

  scheduleNextObstacle() {
    if (this.isGameOver || this.isMovingToGoal) return; // No spawear más obstáculos si va a la meta

    const delay = Phaser.Math.Between(
      this.config.obstacles.minSpawnInterval,
      this.config.obstacles.maxSpawnInterval
    );

    this.time.delayedCall(delay, () => {
      this.spawnObstacle();
      this.scheduleNextObstacle();
    }, [], this);
  }

  spawnObstacle() {
    if (this.isGameOver || this.isMovingToGoal) return; // No spawear si va a la meta

    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;

    // Elegir carril aleatorio
    const lane = Phaser.Math.Between(0, this.config.lanes.count - 1);
    const y = this.config.lanes.positions[lane];

    // Crear obstáculo con animación
    const obstacle = this.obstaclesGroup.create(width + 50, y, gameConfig.assets.obstacle.key)
      .setScale(this.config.obstacles.scale)
      .setDepth(5) // Obstáculos debajo del player (depth < 10)
      .play(this.config.obstacles.animationKey || 'obstacle-run'); // Reproducir animación

    obstacle.lane = lane;
    obstacle.passed = false; // Para trackear si ya pasó el player

    this.obstacles.push(obstacle);
  }

  checkSameLane(player, obstacle) {
    // Solo colisiona si el player y el obstáculo están en el mismo carril
    return this.currentLane === obstacle.lane;
  }

  hitObstacle(player, obstacle) {
    if (obstacle.hitAlready) return; // Evitar múltiples hits

    obstacle.hitAlready = true;

    // Reducir score
    this.score = Math.max(0, this.score - this.config.scoreDecrement);
    this.updateScoreDisplay();

    // Efecto visual
    this.cameras.main.shake(300, 0.01);

    // Feedback visual en el obstáculo
    this.tweens.add({
      targets: obstacle,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        obstacle.destroy();
        const index = this.obstacles.indexOf(obstacle);
        if (index > -1) {
          this.obstacles.splice(index, 1);
        }
      }
    });
  }

  update() {
    if (this.isGameOver) return;

    // Scroll del background (solo cuando el juego ha comenzado y NO está pausado)
    if (this.gameStarted && !this.backgroundPaused) {
      this.bgScrollX += this.config.background.scrollSpeed;
      this.bg.tilePositionX = this.bgScrollX;

      // Mover la línea de salida hacia la izquierda (sale de pantalla)
      if (this.startLine && this.startLine.active) {
        this.startLine.x -= this.config.background.scrollSpeed;
        if (this.startLine.x < -100) {
          this.startLine.destroy();
        }
      }

      // Mover la línea de meta hacia la izquierda (igual que la línea de salida, pero NO se destruye)
      if (this.finishLine && this.finishLine.visible) {
        this.finishLine.x -= this.config.background.scrollSpeed;
      }
    }

    // Mover obstáculos (solo cuando el juego ha comenzado y NO está pausado)
    if (this.gameStarted && !this.backgroundPaused) {
      this.obstacles.forEach(obstacle => {
        if (obstacle.active) {
          obstacle.x -= this.config.obstacles.speed;

          // Incrementar score si el player pasó el obstáculo sin colisión (solo si están en el mismo carril)
          if (!obstacle.passed && obstacle.x < this.player.x && !obstacle.hitAlready && obstacle.lane === this.currentLane) {
            obstacle.passed = true;
            this.score += this.config.scoreIncrement;
            this.updateScoreDisplay();
          }

          // Destruir si sale de pantalla
          if (obstacle.x < -100) {
            obstacle.destroy();
            const index = this.obstacles.indexOf(obstacle);
            if (index > -1) {
              this.obstacles.splice(index, 1);
            }
          }
        }
      });
    }
  }

  endGame(win = false) {
    if (this.isGameOver) return;

    this.isGameOver = true;
    this.canMove = false;

    // Detener timer
    if (this.timerEvent) {
      this.timerEvent.paused = true;
    }

    // Ejecutar callback de fin de juego
    if (this.config.endGameCallback) {
      this.config.endGameCallback({
        win: win,
        score: this.score,
        scene: this
      });
    }
  }
}
