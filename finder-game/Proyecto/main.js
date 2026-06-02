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
      .setAlpha(this.overlayDarkness())
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
    this.holdTimer = 0;            // tiempo acumulado con la luz sobre el intruso (ms)

    // Ayudas visuales de calibracion (solo si CFG.debug.enabled)
    this.createDebug();

    // Si el intruso esta configurado para moverse, inicia su recorrido
    this.startRoam();

    // Estado del cronometro (arranca segun CFG.timer.startOn)
    this.armTimerStart();
  }

  // Opacidad de oscuridad efectiva (atenuada en modo debug para ver el plano)
  overlayDarkness() {
    return (CFG.debug && CFG.debug.enabled) ? CFG.debug.dimDarkness : CFG.flashlight.darkness;
  }

  // Dibuja ayudas visuales para calibrar (rectangulo del spawnArea y circulo de deteccion)
  createDebug() {
    const dbg = CFG.debug;
    if (!dbg || !dbg.enabled) return;
    if (dbg.showSpawnArea) {
      const a = CFG.intruso.spawnArea;
      this.add.rectangle(a.xMin, a.yMin, a.xMax - a.xMin, a.yMax - a.yMin, 0x00ff66, 0.18)
        .setOrigin(0).setDepth(40).setStrokeStyle(2, 0x00ff66);
    }
    if (dbg.showDetectRadius) {
      this.detectCircle = this.add.circle(this.intruder.x, this.intruder.y, CFG.detection.detectRadius, 0xff3333, 0.12)
        .setStrokeStyle(2, 0xff3333).setDepth(40);
    }
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

  // ===== MOVIMIENTO DEL INTRUSO (si CFG.intruso.moving) =====
  startRoam() {
    if (!CFG.intruso.moving) return;
    this.roamToNextPoint();
  }

  roamToNextPoint() {
    if (this.found) return;
    const a = CFG.intruso.spawnArea;
    const tx = Phaser.Math.Between(a.xMin, a.xMax);
    const ty = Phaser.Math.Between(a.yMin, a.yMax);
    this.intruder.setFlipX(tx < this.intruder.x);   // mira hacia donde camina
    const dist = Phaser.Math.Distance.Between(this.intruder.x, this.intruder.y, tx, ty);
    const dur = Math.max(500, (dist / CFG.intruso.moveSpeed) * 1000);
    this.roamTween = this.tweens.add({
      targets: this.intruder,
      x: tx, y: ty,
      duration: dur,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // pausa breve y sigue al siguiente punto
        this.roamEvent = this.time.delayedCall(CFG.intruso.movePause, () => this.roamToNextPoint());
      }
    });
  }

  stopRoam() {
    if (this.roamTween) { this.roamTween.stop(); this.roamTween = null; }
    if (this.roamEvent) { this.roamEvent.remove(); this.roamEvent = null; }
  }

  update(time, delta) {
    const p = this.input.activePointer;
    // Posicion del haz. En tactil se desfasa hacia arriba para que el dedo no tape la zona iluminada.
    let lx, ly;
    if (p.moveTime === 0) {
      lx = this.W / 2; ly = this.H / 2;            // haz centrado antes del primer movimiento
    } else {
      lx = p.worldX;
      ly = p.worldY + (p.wasTouch ? CFG.flashlight.mobileOffsetY : 0);
    }
    this.light.setPosition(lx, ly);

    // En modo debug el circulo de deteccion sigue al intruso (util si se mueve)
    if (this.detectCircle) this.detectCircle.setPosition(this.intruder.x, this.intruder.y);

    if (this.found || !this.timerStarted) return;

    // La deteccion usa la posicion del HAZ (no la del dedo), para que coincida con lo que se ve.
    // Hay que mantener la luz sobre el intruso (detection.holdTime ms) antes de disparar la alarma.
    const d = Phaser.Math.Distance.Between(lx, ly, this.intruder.x, this.intruder.y);
    if (d < CFG.detection.detectRadius) {
      this.holdTimer += delta;
      if (this.holdTimer >= CFG.detection.holdTime) {
        this.handleFound();
      }
    } else {
      this.holdTimer = 0;          // si la luz sale del intruso, reinicia la cuenta
    }
  }

  handleFound() {
    this.found = true;
    this.stopRoam();              // el intruso se queda quieto durante la alarma
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
    this.holdTimer = 0;
    this.overlay.setAlpha(this.overlayDarkness());
    this.alarmRect.setAlpha(0);
    this.stopRoam();
    this.placeIntruder();
    this.startRoam();

    if (window.resetTimer) window.resetTimer();
    this.armTimerStart();
  }
}
