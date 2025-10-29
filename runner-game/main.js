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

    // Cargar backgrounds (parallax con dos capas)
    const bgConfig = gameConfig.background;
    if (bgConfig.landscape) {
      this.load.image(bgConfig.landscape.key, bgConfig.landscape.path);
    }
    if (bgConfig.track) {
      this.load.image(bgConfig.track.key, bgConfig.track.path);
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

    // Cargar obstáculos dinámicamente desde config
    const obstaclesConfig = gameConfig.obstacles;

    // Cargar obstáculo 1 (solo si está activo)
    if (obstaclesConfig.obstacle1 && obstaclesConfig.obstacle1.active) {
      const obs1 = obstaclesConfig.obstacle1;
      if (obs1.isAnimated) {
        // Cargar como sprite sheet
        this.load.spritesheet(obs1.key, assets.basePath + obs1.path, {
          frameWidth: obs1.frameWidth,
          frameHeight: obs1.frameHeight
        });
      } else {
        // Cargar como imagen estática
        this.load.image(obs1.key, assets.basePath + obs1.path);
      }
    }

    // Cargar obstáculo 2 (solo si está activo)
    if (obstaclesConfig.obstacle2 && obstaclesConfig.obstacle2.active) {
      const obs2 = obstaclesConfig.obstacle2;
      if (obs2.isAnimated) {
        // Cargar como sprite sheet
        this.load.spritesheet(obs2.key, assets.basePath + obs2.path, {
          frameWidth: obs2.frameWidth,
          frameHeight: obs2.frameHeight
        });
      } else {
        // Cargar como imagen estática
        this.load.image(obs2.key, assets.basePath + obs2.path);
      }
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

    // Crear animaciones de obstáculos (solo si están activos y son animados)
    const obstaclesConfig = gameConfig.obstacles;

    // Animación obstáculo 1
    if (obstaclesConfig.obstacle1 && obstaclesConfig.obstacle1.active && obstaclesConfig.obstacle1.isAnimated) {
      const obs1 = obstaclesConfig.obstacle1;
      this.anims.create({
        key: obs1.animationKey,
        frames: this.anims.generateFrameNumbers(obs1.key, {
          start: obs1.animationStart || 0,
          end: obs1.frames - 1
        }),
        frameRate: obs1.animationFrameRate || 10,
        repeat: -1
      });
    }

    // Animación obstáculo 2
    if (obstaclesConfig.obstacle2 && obstaclesConfig.obstacle2.active && obstaclesConfig.obstacle2.isAnimated) {
      const obs2 = obstaclesConfig.obstacle2;
      this.anims.create({
        key: obs2.animationKey,
        frames: this.anims.generateFrameNumbers(obs2.key, {
          start: obs2.animationStart || 0,
          end: obs2.frames - 1
        }),
        frameRate: obs2.animationFrameRate || 10,
        repeat: -1
      });
    }

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
    this.bgLandscapeScrollX = 0; // Scroll del landscape (más lento)
    this.bgTrackScrollX = 0;     // Scroll del track (más rápido)
    this.backgroundPaused = false; // Flag para pausar el scroll del background
    this.timerReachedZero = false; // Flag para saber si el timer ya llegó a 0
    this.isGameOver = false;
    this.hasReachedGoal = false;
    this.isMovingToGoal = false; // Flag para indicar que se está moviendo a la meta
    this.finishLineShown = false; // Flag para controlar si ya se mostró la línea de meta

    // Preparar lista de tipos de obstáculos disponibles (solo los activos)
    this.obstacleTypes = [];
    if (this.config.obstacles.obstacle1 && this.config.obstacles.obstacle1.active) {
      this.obstacleTypes.push(this.config.obstacles.obstacle1);
    }
    if (this.config.obstacles.obstacle2 && this.config.obstacles.obstacle2.active) {
      this.obstacleTypes.push(this.config.obstacles.obstacle2);
    }

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

  // Calcular depth basado en el carril (carril 0 = arriba = menos depth, carril 2 = abajo = más depth)
  getDepthForLane(lane) {
    // Base depth: 10
    // Carril 0 (arriba): depth 8
    // Carril 1 (medio): depth 10
    // Carril 2 (abajo): depth 12
    return 10 + (lane - 1) * 2;
  }

  create() {
    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;

    // Configuración del background con parallax (dos capas)
    const bgConfig = this.config.background;

    // Capa 1: Landscape (fondo - más lento)
    const landscapeConfig = bgConfig.landscape;
    const landscapeScale = landscapeConfig.scale || 1;
    const landscapeOffsetX = landscapeConfig.offsetX || 0;
    const landscapeOffsetY = landscapeConfig.offsetY || 0;

    this.bgLandscape = this.add.tileSprite(
      landscapeOffsetX,
      (height / 2) + landscapeOffsetY,
      width,
      height,
      landscapeConfig.key
    )
      .setOrigin(0, 0.5)
      .setTileScale(landscapeScale, landscapeScale)
      .setDepth(0); // Fondo más atrás

    // Capa 2: Track (pista - más rápido)
    const trackConfig = bgConfig.track;
    const trackScale = trackConfig.scale || 1;
    const trackOffsetX = trackConfig.offsetX || 0;
    const trackOffsetY = trackConfig.offsetY || 0;

    this.bgTrack = this.add.tileSprite(
      trackOffsetX,
      (height / 2) + trackOffsetY,
      width,
      height,
      trackConfig.key
    )
      .setOrigin(0, 0.5)
      .setTileScale(trackScale, trackScale)
      .setDepth(2); // Delante del landscape pero detrás de objetos

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
      .setDepth(5); // Por encima del track (depth 2) pero debajo de jugadores (depth 8-12)

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
      .setDepth(5) // Por encima del track (depth 2) pero debajo de jugadores (depth 8-12)
      .setVisible(false);

    // Crear player
    const playerY = this.config.lanes.positions[this.currentLane];
    const playerX = this.config.player.startX || 80; // Posición X inicial configurable
    this.player = this.physics.add.sprite(playerX, playerY, gameConfig.assets.player.key)
      .setScale(gameConfig.player.scale)
      .setFrame(0) // Iniciar en frame 0 (quieto)
      .setDepth(this.getDepthForLane(this.currentLane)); // Depth dinámico según carril

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

      // Actualizar depth del player según el nuevo carril
      this.player.setDepth(this.getDepthForLane(this.currentLane));

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
    if (this.obstacleTypes.length === 0) return; // No hay obstáculos configurados

    const width = this.sys.game.scale.width;

    // Elegir carril aleatorio
    const lane = Phaser.Math.Between(0, this.config.lanes.count - 1);
    const y = this.config.lanes.positions[lane];

    // Elegir tipo de obstáculo aleatorio de los disponibles
    const obstacleType = Phaser.Utils.Array.GetRandom(this.obstacleTypes);

    // Crear obstáculo según su tipo (animado o estático)
    let obstacle;
    if (obstacleType.isAnimated) {
      // Crear obstáculo animado
      obstacle = this.obstaclesGroup.create(width + 50, y, obstacleType.key)
        .setScale(obstacleType.scale)
        .setDepth(this.getDepthForLane(lane)) // Depth dinámico según carril
        .play(obstacleType.animationKey);
    } else {
      // Crear obstáculo estático (imagen simple)
      obstacle = this.obstaclesGroup.create(width + 50, y, obstacleType.key)
        .setScale(obstacleType.scale)
        .setDepth(this.getDepthForLane(lane)); // Depth dinámico según carril
    }

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

    // Scroll del background con parallax (solo cuando el juego ha comenzado y NO está pausado)
    if (this.gameStarted && !this.backgroundPaused) {
      const bgConfig = this.config.background;

      // Scroll landscape (más lento - efecto parallax de fondo)
      this.bgLandscapeScrollX += bgConfig.landscape.scrollSpeed;
      this.bgLandscape.tilePositionX = this.bgLandscapeScrollX;

      // Scroll track (más rápido - primer plano)
      this.bgTrackScrollX += bgConfig.track.scrollSpeed;
      this.bgTrack.tilePositionX = this.bgTrackScrollX;

      // Velocidad de referencia para líneas y obstáculos (usar velocidad del track)
      const referenceSpeed = bgConfig.track.scrollSpeed;

      // Mover la línea de salida hacia la izquierda (sale de pantalla)
      if (this.startLine && this.startLine.active) {
        this.startLine.x -= referenceSpeed;
        if (this.startLine.x < -100) {
          this.startLine.destroy();
        }
      }

      // Mover la línea de meta hacia la izquierda (igual que la línea de salida, pero NO se destruye)
      if (this.finishLine && this.finishLine.visible) {
        this.finishLine.x -= referenceSpeed;
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
