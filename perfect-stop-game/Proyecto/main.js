// ==========================================
// PERFECT STOP GAME - Main.js
// Carrusel 2D horizontal con target fijo
// ==========================================

let gameConfig;

// ==========================================
// PRELOADER SCENE
// ==========================================
class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('PreloaderScene');
  }

  preload() {
    gameConfig = window.GAME_CONFIG;

    // Barra de progreso
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 100, height / 2 - 15, 200, 30);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xe94560, 1);
      progressBar.fillRect(width / 2 - 95, height / 2 - 10, 190 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    // Cargar imagen de fondo si está configurada
    if (gameConfig.background?.image) {
      this.load.image('background', gameConfig.background.image);
    }

    // Cargar target (sombra)
    this.load.image(gameConfig.target.key, gameConfig.target.path);

    // Cargar todos los spinners
    gameConfig.spinners.forEach(spinner => {
      this.load.image(spinner.key, spinner.path);
    });

    // Manejar errores silenciosamente
    this.load.on('loaderror', (file) => {
      console.warn(`Asset no encontrado: ${file.key}`);
    });
  }

  create() {
    // Filtrar spinners que se cargaron correctamente
    gameConfig._loadedSpinners = gameConfig.spinners.filter(s => {
      return this.textures.exists(s.key) && this.textures.get(s.key).key !== '__MISSING';
    });

    // Si no hay spinners, crear uno fallback
    if (gameConfig._loadedSpinners.length === 0) {
      this.createFallbackSpinner();
      gameConfig._loadedSpinners = [{ key: 'spinner_fallback', scale: 0.3 }];
    }

    // Verificar si el target se cargo
    if (!this.textures.exists(gameConfig.target.key) ||
        this.textures.get(gameConfig.target.key).key === '__MISSING') {
      this.createFallbackTarget();
    }

    this.scene.start('GameScene');
  }

  createFallbackSpinner() {
    const size = 100;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Circulo con estrella
    graphics.fillStyle(0xe94560, 1);
    graphics.fillCircle(size / 2, size / 2, size / 2 - 5);
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.strokeCircle(size / 2, size / 2, size / 2 - 5);

    // Estrella
    graphics.fillStyle(0xffffff, 1);
    const cx = size / 2, cy = size / 2;
    const outerR = 20, innerR = 10;
    const points = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI / 5) - Math.PI / 2;
      points.push(cx + r * Math.cos(angle));
      points.push(cy + r * Math.sin(angle));
    }
    graphics.fillPoints(points, true);

    graphics.generateTexture('spinner_fallback', size, size);
    graphics.destroy();
  }

  createFallbackTarget() {
    const size = 100;
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Sombra/silueta oscura
    graphics.fillStyle(0x000000, 0.4);
    graphics.fillCircle(size / 2, size / 2, size / 2 - 5);

    // Borde sutil
    graphics.lineStyle(2, 0x333333, 0.5);
    graphics.strokeCircle(size / 2, size / 2, size / 2 - 5);

    graphics.generateTexture(gameConfig.target.key, size, size);
    graphics.destroy();
  }
}

// ==========================================
// GAME SCENE
// ==========================================
class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // Calcula la velocidad basada en el nivel de dificultad (1-10)
  getBaseSpeed() {
    const speedLevel = Phaser.Math.Clamp(gameConfig.difficulty.speed || 5, 1, 10);
    return 100 + (speedLevel - 1) * 100; // 100 a 1000 px/s
  }

  init() {
    this.isMoving = true;
    this.gameEnded = false;
    this.debugMode = false;

    // Sistema de intentos
    this.maxAttempts = gameConfig.difficulty.maxAttempts || 3;
    this.currentAttempt = 1;

    // Velocidad (se mantiene constante, solo cambia direccion aleatoria)
    this.baseSpeed = this.getBaseSpeed();
    this.speed = Phaser.Math.RND.pick([1, -1]) * this.baseSpeed;

    // Spinners en el carrusel
    this.spinnerSprites = [];

    // Posicion inicial aleatoria del carrusel
    this.carouselOffset = Phaser.Math.Between(0, gameConfig.carousel.totalWidth);
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;

    // Crear fondo
    this.createBackground(centerX);

    // Crear el target (sombra fija)
    this.createTarget();

    // Crear los spinners del carrusel
    this.createSpinners();

    // Crear UI
    this.createUI(centerX, height);

    // Configurar controles
    this.setupControls();

    // Debug toggle (tecla D)
    this.input.keyboard.on('keydown-D', () => {
      this.debugMode = !this.debugMode;
      document.getElementById('debug-info').classList.toggle('visible', this.debugMode);
    });
  }

  createBackground(centerX) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Si hay imagen de fondo configurada y cargada, usarla
    if (gameConfig.background?.image && this.textures.exists('background')) {
      const bg = this.add.image(width / 2, height / 2, 'background');
      bg.setDisplaySize(width, height);
      bg.setDepth(0);
    }
    // Si no hay imagen, el color de fondo ya está configurado en el config de Phaser
  }

  createTarget() {
    const targetCfg = gameConfig.target;

    // El target es la sombra fija en el centro
    this.target = this.add.image(targetCfg.x, targetCfg.y, targetCfg.key);
    this.target.setScale(targetCfg.scale);
    this.target.setDepth(5);

    // Flechas indicadoras arriba y abajo del target
    const markerGraphics = this.add.graphics();
    markerGraphics.fillStyle(0x00ff00, 0.8);

    // Flecha superior
    const arrowY1 = targetCfg.y - 60;
    markerGraphics.fillTriangle(
      targetCfg.x, arrowY1 + 15,
      targetCfg.x - 10, arrowY1,
      targetCfg.x + 10, arrowY1
    );

    // Flecha inferior
    const arrowY2 = targetCfg.y + 60;
    markerGraphics.fillTriangle(
      targetCfg.x, arrowY2 - 15,
      targetCfg.x - 10, arrowY2,
      targetCfg.x + 10, arrowY2
    );

    markerGraphics.setDepth(4);

    // Glow pulsante en el target
    this.targetGlow = this.add.rectangle(
      targetCfg.x, targetCfg.y,
      80, 80,
      0x00ff00, 0
    ).setDepth(3);

    this.tweens.add({
      targets: this.targetGlow,
      alpha: { from: 0, to: 0.15 },
      duration: 600,
      yoyo: true,
      repeat: -1
    });
  }

  createSpinners() {
    const carousel = gameConfig.carousel;
    const spinners = gameConfig._loadedSpinners;
    const numSpinners = spinners.length;
    const spacing = carousel.spacing;

    // Crear cada spinner
    for (let i = 0; i < numSpinners; i++) {
      const spinnerCfg = spinners[i];
      const sprite = this.add.image(0, carousel.centerY, spinnerCfg.key);
      sprite.setScale(spinnerCfg.scale);
      sprite.setDepth(10);
      sprite.baseIndex = i; // Indice base para calcular posicion

      this.spinnerSprites.push(sprite);
    }

    // Actualizar posiciones iniciales
    this.updateSpinnerPositions();
  }

  updateSpinnerPositions() {
    const width = this.cameras.main.width;
    const carousel = gameConfig.carousel;
    const spacing = carousel.spacing;
    const numSpinners = this.spinnerSprites.length;
    const totalWidth = numSpinners * spacing;

    this.spinnerSprites.forEach((sprite, index) => {
      // Calcular posicion X base
      let x = (index * spacing) + this.carouselOffset;

      // Wrap around: si sale por la derecha, entra por la izquierda y viceversa
      x = ((x % totalWidth) + totalWidth) % totalWidth;

      // Centrar el carrusel en la pantalla
      // Mapear de [0, totalWidth] a [-totalWidth/2 + centerX, totalWidth/2 + centerX]
      x = x - totalWidth / 2 + width / 2;

      // Si queda muy fuera, hacer wrap adicional
      if (x < -spacing) x += totalWidth;
      if (x > width + spacing) x -= totalWidth;

      sprite.x = x;
    });
  }

  createUI(centerX, height) {
    // Texto de resultado
    this.resultText = this.add.text(centerX, gameConfig.ui.resultY, '', {
      fontFamily: gameConfig.ui.fontFamily,
      fontSize: gameConfig.ui.fontSize,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    // Texto de porcentaje
    this.percentText = this.add.text(centerX, gameConfig.ui.resultY + 45, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#cccccc',
      align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    // Instruccion
    this.instructionText = this.add.text(centerX, height - 50, 'Alinea a pikachu con su sombra', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5).setDepth(5);

    // Texto de intentos
    this.attemptsText = this.add.text(centerX, 30, `Intento ${this.currentAttempt} de ${this.maxAttempts}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5).setDepth(20);

    // Medidor de precision
    this.createPrecisionMeter(centerX);
  }

  createPrecisionMeter(centerX) {
    const meterCfg = gameConfig.effects.lose;
    const meterY = meterCfg.meterY;

    this.meterContainer = this.add.container(centerX, meterY);
    this.meterContainer.setAlpha(0);
    this.meterContainer.setDepth(15);

    // Fondo de la barra
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 1);
    bg.fillRoundedRect(-meterCfg.meterWidth / 2, -meterCfg.meterHeight / 2,
                       meterCfg.meterWidth, meterCfg.meterHeight, 5);
    this.meterContainer.add(bg);

    // Barra de relleno (se llenara segun el porcentaje)
    this.meterFill = this.add.graphics();
    this.meterContainer.add(this.meterFill);
  }

  setupControls() {
    // Obtener IDs desde config (con fallback a IDs por defecto)
    const stopBtnId = gameConfig.controls?.stopBtnId || 'stop-btn';
    const restartBtnId = gameConfig.controls?.restartBtnId || 'restart-btn';

    const stopBtn = document.getElementById(stopBtnId);
    const restartBtn = document.getElementById(restartBtnId);

    // Guardar referencia para uso en otros metodos
    this.stopBtnId = stopBtnId;

    if (stopBtn) {
      stopBtn.disabled = false;
      stopBtn.onclick = () => {
        if (!this.gameEnded && this.isMoving) {
          this.stopCarousel();
          stopBtn.disabled = true;
        }
      };
    }

    if (restartBtn) {
      restartBtn.onclick = () => {
        const btn = document.getElementById(this.stopBtnId);
        if (btn) btn.disabled = false;
        this.scene.restart();
      };
    }

    // Teclas
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!this.gameEnded && this.isMoving) {
        this.stopCarousel();
        const btn = document.getElementById(this.stopBtnId);
        if (btn) btn.disabled = true;
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      if (!this.gameEnded && this.isMoving) {
        this.stopCarousel();
        const btn = document.getElementById(this.stopBtnId);
        if (btn) btn.disabled = true;
      }
    });

    this.input.keyboard.on('keydown-R', () => {
      const btn = document.getElementById(this.stopBtnId);
      if (btn) btn.disabled = false;
      this.scene.restart();
    });
  }

  update(time, delta) {
    if (!this.isMoving) return;

    const deltaSeconds = delta / 1000;

    // Mover el carrusel
    this.carouselOffset += this.speed * deltaSeconds;

    // Actualizar posiciones
    this.updateSpinnerPositions();

    // Debug
    if (this.debugMode) {
      const nearest = this.findMainSpinner();
      document.getElementById('dbg-target').textContent = gameConfig.target.x.toFixed(0) + 'px';
      document.getElementById('dbg-current').textContent = nearest.sprite.x.toFixed(0) + 'px';
      document.getElementById('dbg-diff').textContent = nearest.diff.toFixed(1) + 'px';
    }
  }

  findMainSpinner() {
    const targetX = gameConfig.target.x;
    const refIndex = gameConfig.difficulty.referenceSpinner;

    // Si referenceSpinner es -1 o 'all', buscar el mas cercano de todos
    if (refIndex === -1 || refIndex === 'all') {
      let nearest = null;
      let smallestDiff = Infinity;

      this.spinnerSprites.forEach(sprite => {
        const diff = Math.abs(sprite.x - targetX);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          nearest = { sprite, diff, offsetX: sprite.x - targetX };
        }
      });

      return nearest;
    }

    // Si es un indice especifico, usar ese spinner
    const index = Math.min(refIndex, this.spinnerSprites.length - 1);
    const mainSpinner = this.spinnerSprites[index];
    const diff = Math.abs(mainSpinner.x - targetX);
    const offsetX = mainSpinner.x - targetX;

    return { sprite: mainSpinner, diff, offsetX };
  }

  stopCarousel() {
    this.isMoving = false;
    this.gameEnded = true;

    // Ocultar instruccion
    this.tweens.add({
      targets: this.instructionText,
      alpha: 0,
      duration: 200
    });

    // Encontrar spinner mas cercano al target
    const nearest = this.findMainSpinner();
    const diff = nearest.diff;

    // Calcular porcentaje
    const maxDiff = gameConfig.carousel.spacing / 2;
    const normalizedDiff = Math.min(diff, maxDiff);
    const rawPercent = 100 * (1 - normalizedDiff / maxDiff);
    const curvedPercent = 100 * Math.pow(1 - normalizedDiff / maxDiff, gameConfig.difficulty.curveExponent);
    const finalPercent = Phaser.Math.Clamp(curvedPercent, 0, 100);

    // Victoria?
    const isWin = diff <= gameConfig.difficulty.tolerancePx;

    if (isWin) {
      this.showWinEffect(finalPercent, nearest);
    } else {
      this.showLoseEffect(finalPercent, diff, nearest);
    }
  }

  showWinEffect(percent, nearest) {
    const winCfg = gameConfig.effects.win;
    const centerX = this.cameras.main.width / 2;

    // Texto victoria
    this.resultText.setText(gameConfig.ui.winText);
    this.resultText.setColor('#00ff00');
    this.tweens.add({
      targets: this.resultText,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 300,
      ease: 'Back.easeOut'
    });

    // Porcentaje
    this.percentText.setText(percent.toFixed(1) + '% de precision');
    this.tweens.add({
      targets: this.percentText,
      alpha: 1,
      duration: 300,
      delay: 200
    });

    // Glow en el spinner ganador
    const glow = this.add.image(nearest.sprite.x, nearest.sprite.y, nearest.sprite.texture.key);
    glow.setScale(nearest.sprite.scale * 1.3);
    glow.setTint(winCfg.glowColor);
    glow.setAlpha(0);
    glow.setDepth(nearest.sprite.depth - 1);

    this.tweens.add({
      targets: glow,
      alpha: 0.6,
      scale: nearest.sprite.scale * 1.5,
      duration: 400,
      yoyo: true,
      repeat: 2
    });

    // Pop del sprite
    this.tweens.add({
      targets: nearest.sprite,
      scale: nearest.sprite.scale * winCfg.popScale,
      duration: winCfg.popDuration,
      yoyo: true
    });

    // Target glow
    this.tweens.killTweensOf(this.targetGlow);
    this.tweens.add({
      targets: this.targetGlow,
      alpha: 0.5,
      duration: 200,
      yoyo: true,
      repeat: 3
    });

    // Shake
    this.cameras.main.shake(winCfg.shakeDuration, winCfg.shakeIntensity);

    // Confetti
    this.createConfetti(nearest.sprite.x, nearest.sprite.y, winCfg);

    // Flash
    this.flashScreen(0x00ff00, 0.2, 300);
  }

  showLoseEffect(percent, diff, nearest) {
    const loseCfg = gameConfig.effects.lose;

    // Verificar si quedan intentos
    const hasMoreAttempts = this.currentAttempt < this.maxAttempts;

    // Texto
    if (hasMoreAttempts) {
      this.resultText.setText(gameConfig.ui.loseText);
    } else {
      this.resultText.setText('GAME OVER');
    }
    this.resultText.setColor('#e94560');
    this.tweens.add({
      targets: this.resultText,
      alpha: 1,
      duration: 300
    });

    // Porcentaje
    this.percentText.setText(percent.toFixed(1) + '% de precision');
    this.tweens.add({
      targets: this.percentText,
      alpha: 1,
      duration: 300,
      delay: 200
    });

    // Shake
    this.cameras.main.shake(loseCfg.shakeDuration, loseCfg.shakeIntensity);

    // Flash
    this.flashScreen(0xe94560, 0.15, 200);

    // Medidor
    this.showPrecisionMeter(percent);

    // Si quedan intentos, preparar el siguiente
    if (hasMoreAttempts) {
      this.time.delayedCall(1500, () => {
        this.startNextAttempt();
      });
    }
  }

  startNextAttempt() {
    this.currentAttempt++;

    // Ocultar resultados anteriores
    this.tweens.add({
      targets: [this.resultText, this.percentText, this.meterContainer],
      alpha: 0,
      duration: 300
    });

    // Actualizar texto de intentos
    this.attemptsText.setText(`Intento ${this.currentAttempt} de ${this.maxAttempts}`);

    // Misma velocidad, solo cambia direccion
    this.speed = Phaser.Math.RND.pick([1, -1]) * this.baseSpeed;

    // Reactivar movimiento
    this.isMoving = true;
    this.gameEnded = false;

    // Rehabilitar boton STOP
    const stopBtn = document.getElementById(this.stopBtnId);
    if (stopBtn) stopBtn.disabled = false;

    // Mostrar instruccion
    this.tweens.add({
      targets: this.instructionText,
      alpha: 1,
      duration: 300
    });
  }

  showPrecisionMeter(percent) {
    const loseCfg = gameConfig.effects.lose;

    // Llenar barra segun el porcentaje
    const fillWidth = (percent / 100) * loseCfg.meterWidth;
    const fillColor = this.getColorForPercent(percent);

    this.meterFill.clear();
    this.meterFill.fillStyle(fillColor, 1);
    this.meterFill.fillRoundedRect(
      -loseCfg.meterWidth / 2,
      -loseCfg.meterHeight / 2,
      fillWidth,
      loseCfg.meterHeight,
      5
    );

    // Animar entrada
    this.meterContainer.y = loseCfg.meterY + 30;
    this.tweens.add({
      targets: this.meterContainer,
      alpha: 1,
      y: loseCfg.meterY,
      duration: 400,
      ease: 'Back.easeOut'
    });
  }

  createConfetti(x, y, winCfg) {
    const colors = [0xe94560, 0xffd700, 0x00ff00, 0x00bfff, 0xff69b4, 0xffffff];

    for (let i = 0; i < winCfg.particleCount; i++) {
      const size = Phaser.Math.Between(3, 8);
      const isCircle = Math.random() > 0.5;

      let particle;
      if (isCircle) {
        particle = this.add.circle(x, y, size, Phaser.Utils.Array.GetRandom(colors));
      } else {
        particle = this.add.rectangle(x, y, size, size * 1.5, Phaser.Utils.Array.GetRandom(colors));
      }
      particle.setDepth(25);

      const angle = Phaser.Math.Between(0, 360);
      const distance = Phaser.Math.Between(60, 150);
      const destX = x + Math.cos(Phaser.Math.DegToRad(angle)) * distance;
      const destY = y + Math.sin(Phaser.Math.DegToRad(angle)) * distance;

      this.tweens.add({
        targets: particle,
        x: destX,
        y: destY + Phaser.Math.Between(20, 50),
        alpha: 0,
        scale: { from: 1, to: 0.1 },
        angle: Phaser.Math.Between(-180, 180),
        duration: winCfg.particleDuration + Phaser.Math.Between(0, 300),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  flashScreen(color, alpha, duration) {
    const flash = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      color,
      alpha
    ).setDepth(30);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: duration,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    });
  }

  getColorForPercent(percent) {
    if (percent >= 95) return 0x00ff00;
    if (percent >= 85) return 0x7fff00;
    if (percent >= 70) return 0xadff2f;
    if (percent >= 55) return 0xffd700;
    if (percent >= 40) return 0xffa500;
    if (percent >= 25) return 0xff6347;
    return 0xe94560;
  }
}
