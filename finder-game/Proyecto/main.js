const CFG = window.GAME_CONFIG;

/* =====================================================
 * PRELOADER: carga los assets
 * ===================================================== */
class PreloaderScene extends Phaser.Scene {
  constructor() { super('PreloaderScene'); }

  preload() {
    this.load.setPath(CFG.assetsPath);
    this.load.image(CFG.background.key, CFG.background.path);
    this.load.image(CFG.intruso.key, CFG.intruso.path);
  }

  create() {
    this.scene.start('GameScene');
  }
}

/* =====================================================
 * GAME: fondo, intruso, linterna, deteccion, alarma
 * ===================================================== */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.W = CFG.width;
    this.H = CFG.height;

    // Fondo de la casa a pantalla completa
    this.bg = this.add.image(0, 0, CFG.background.key).setOrigin(0).setDepth(0);
    this.bg.setDisplaySize(this.W, this.H);

    // Intruso (encima del fondo)
    this.intruder = this.add.image(0, 0, CFG.intruso.key)
      .setScale(CFG.intruso.scale)
      .setDepth(1);
    this.placeIntruder();

    // Textura de la luz + sprite-mascara (no se dibuja en pantalla, solo enmascara)
    this.createLightTexture();
    this.light = this.make.image({ x: this.W / 2, y: this.H / 2, key: 'lightTexture', add: false });

    // Overlay de oscuridad a pantalla completa
    // (fillAlpha = 1 y el alpha del objeto controla la oscuridad, para que el tween de
    //  reveal y el setAlpha del reinicio sean consistentes)
    this.overlay = this.add.rectangle(0, 0, this.W, this.H, CFG.flashlight.color, 1)
      .setOrigin(0)
      .setAlpha(CFG.flashlight.darkness)
      .setDepth(10);

    // Mascara invertida: el overlay se ve donde la luz es transparente; el haz revela el fondo
    const mask = this.light.createBitmapMask();
    mask.invertAlpha = true;
    this.overlay.setMask(mask);

    // Capa de alarma (rojo a pantalla completa, invisible hasta detectar)
    this.alarmRect = this.add.rectangle(0, 0, this.W, this.H, CFG.alarm.flashColor, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(20);

    this.found = false;
    this.elapsedSeconds = 0;

    // Estado del cronometro (arranca segun CFG.timer.startOn)
    this.armTimerStart();
  }

  // Arranca el cronometro al cargar o con el primer movimiento del cursor.
  // Hace off() del listener previo para ser idempotente aunque se reinicie con scene.restart().
  armTimerStart() {
    this.input.off('pointermove', this.startTimerOnce, this);
    this.timerStarted = false;
    if (CFG.timer.startOn === 'load') {
      this.timerStarted = true;
      if (window.startTimer) window.startTimer();
    } else {
      this.input.once('pointermove', this.startTimerOnce, this);
    }
  }

  startTimerOnce() {
    this.timerStarted = true;
    if (window.startTimer) window.startTimer();
  }

  createLightTexture() {
    const f = CFG.flashlight;
    const r = f.radius;
    const size = r * 2;
    if (this.textures.exists('lightTexture')) this.textures.remove('lightTexture');
    const canvasTex = this.textures.createCanvas('lightTexture', size, size);
    const ctx = canvasTex.getContext();
    const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');                       // centro opaco
    grd.addColorStop(Math.max(0, 1 - f.softness), 'rgba(255,255,255,1)'); // zona plena
    grd.addColorStop(1, 'rgba(255,255,255,0)');                      // borde difuso
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    canvasTex.refresh();
  }

  placeIntruder() {
    const I = CFG.intruso;
    let x, y;
    if (I.randomPosition) {
      x = Phaser.Math.Between(I.spawnArea.xMin, I.spawnArea.xMax);
      y = Phaser.Math.Between(I.spawnArea.yMin, I.spawnArea.yMax);
    } else {
      x = I.fixedPosition.x;
      y = I.fixedPosition.y;
    }
    this.intruder.setPosition(x, y);
  }

  update() {
    const p = this.input.activePointer;
    // Antes del primer movimiento el puntero esta en (0,0); deja el haz centrado para que no "salte" desde la esquina
    if (p.moveTime === 0) {
      this.light.setPosition(this.W / 2, this.H / 2);
    } else {
      this.light.setPosition(p.worldX, p.worldY);
    }

    if (this.found || !this.timerStarted) return;

    const d = Phaser.Math.Distance.Between(p.worldX, p.worldY, this.intruder.x, this.intruder.y);
    if (d < CFG.detection.detectRadius) {
      this.handleFound();
    }
  }

  handleFound() {
    this.found = true;
    const a = CFG.alarm;

    // Guardar el tiempo (consultable despues, como en los otros juegos)
    this.elapsedSeconds = window.getTimerSeconds ? window.getTimerSeconds() : 0;
    window.tiempoFinal = this.elapsedSeconds;
    if (window.stopTimer) window.stopTimer();

    // Parpadeo rojo de alarma
    this.tweens.add({
      targets: this.alarmRect,
      alpha: { from: 0, to: a.flashAlpha },
      duration: a.flashDuration,
      yoyo: true,
      repeat: a.flashCount - 1
    });

    // Revelar toda la casa durante la alarma
    if (a.revealHouseOnFound) {
      this.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: a.flashDuration * a.flashCount
      });
    }

    // Gancho para produccion (GWD/banner)
    if (typeof CFG.onFoundCallback === 'function') CFG.onFoundCallback(this.elapsedSeconds);
    if (typeof window.onIntrusoEncontrado === 'function') window.onIntrusoEncontrado(this.elapsedSeconds);

    // Reinicio (solo en el Proyecto standalone)
    if (CFG.restartOnFound) {
      this.time.delayedCall(CFG.restartDelay, () => this.restartGame());
    }
  }

  restartGame() {
    this.found = false;
    this.overlay.setAlpha(CFG.flashlight.darkness);
    this.alarmRect.setAlpha(0);
    this.placeIntruder();

    if (window.resetTimer) window.resetTimer();
    this.armTimerStart();
  }
}
