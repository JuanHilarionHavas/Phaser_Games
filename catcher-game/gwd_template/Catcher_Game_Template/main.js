function randomIngredient(config) {
  const items = [...config.items.good, ...config.items.bad];
  return Phaser.Utils.Array.GetRandom(items);
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.configData = window.gwd.GAME_CONFIG;
  }

  preload() {
    const cfg = this.configData;
    this.load.spritesheet(cfg.player.spriteSheet, cfg.player.path, {
      frameWidth: cfg.player.frameWidth,
      frameHeight: cfg.player.frameHeight
    });
    this.load.image(cfg.background.key, cfg.background.path);
    [...cfg.items.good, ...cfg.items.bad].forEach(item =>
      this.load.image(item, `${cfg.items.path}${item}.png`)
    );
  }

  create() {
    const cfg = this.configData;
    
    this.score = 0;
    this.timer = this.configData.gameTime;
    this.spawnDelay = this.configData.spawn.initialDelay;
    this.fallSpeed = this.configData.spawn.initialFallSpeed;
    this.gameOver = false;

    // Fondo con parallax
    this.bg = this.add.tileSprite(150, 300, 300, 600, cfg.background.key).setDepth(0);

    // Player
    const p = cfg.player;
    this.player = this.physics.add.sprite(
      p.initialPosition.x || 150,
      p.initialPosition.y || 550,
      p.spriteSheet,
      p.initialFrame
    ).setImmovable()
     .setScale(p.scale)
     .setDepth(2);
    this.player.body.allowGravity = false;
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(this.player.displayWidth, this.player.displayHeight);

    this.createAnimations();

    // Items
    this.items = this.physics.add.group();

    // Score & Timer en el DOM externo
    this.scoreElement = document.querySelector(cfg.ui.scoreSelector);
    this.timerElement = document.querySelector(cfg.ui.timerSelector);
    this.updateScoreText();
    this.updateTimerText();

    // Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this.timer - 1,
      callback: () => {
        this.timer--;
        this.updateTimerText();
        if (this.timer % cfg.spawn.difficultyTimeStep === 0) this.increaseDifficulty();
        if (this.timer <= 0) this.endGame();
      }
    });

    // Spawn de ingredientes
    this.startIngredientEvent();

    // Colisiones
    this.physics.add.overlap(this.player, this.items, this.catchIngredient, null, this);
  }

  updateScoreText() {
    this.scoreElement.textContent = this.configData.ui.scoreText.label + this.score;
  }

  updateTimerText() {
    this.timerElement.textContent = this.configData.ui.timerText.label + this.timer;
  }

  startIngredientEvent() {
    if (this.ingredientEvent) this.ingredientEvent.remove();
    this.ingredientEvent = this.time.addEvent({
      delay: this.spawnDelay,
      loop: true,
      callback: () => {
        if (this.gameOver) return;
        const x = Phaser.Math.Between(20, 280);
        const type = randomIngredient(this.configData);
        const sprite = this.items.create(x, 0, type);
        sprite.body.setSize(sprite.displayWidth * 0.5, sprite.displayHeight * 0.5);
        const radius = 16;
        sprite.body.setCircle(radius);
        sprite.body.setOffset(
          sprite.width / 2 - radius,
          sprite.height / 2 - radius
        );
        sprite.setData("type", type);
        sprite.setBounce(0.3);
        sprite.setVelocityY(this.fallSpeed);
      }
    });
  }

  createAnimations() {
    const cfg = this.configData.player;
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers(cfg.spriteSheet, {
        start: cfg.animations.left.start,
        end: cfg.animations.left.end
      }),
      frameRate: 20,
      repeat: -1
    });
    this.anims.create({
      key: "forward",
      frames: [{ key: cfg.spriteSheet, frame: cfg.animations.forward }],
      frameRate: 20
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers(cfg.spriteSheet, {
        start: cfg.animations.right.start,
        end: cfg.animations.right.end
      }),
      frameRate: 20,
      repeat: -1
    });
  }

  update() {
    const cfg = this.configData;
    const pointer = this.input.activePointer;

    if (pointer.x >= 0 && pointer.x <= this.game.config.width) {
      this.player.x = Phaser.Math.Clamp(
        Phaser.Math.Linear(this.player.x, pointer.x, cfg.player.animations.speed),
        this.player.width * this.player.scaleX / 2,
        this.game.config.width - this.player.width * this.player.scaleX / 2
      );
    }

    const diff = pointer.x - this.player.x;
    this.player.angle = Phaser.Math.Clamp(diff * cfg.player.animations.angleFactor, -10, 10);

    // Parallax background
    this.bg.tilePositionY += cfg.background.parallax.y;
    this.bg.tilePositionX = this.player.x * cfg.background.parallax.x;

    // Animaciones
    if (!this.lastPlayerX) this.lastPlayerX = this.player.x;
    const deltaX = this.player.x - this.lastPlayerX;
    if (deltaX < -0.5) this.player.play("left", true);
    else if (deltaX > 0.5) this.player.play("right", true);
    else this.player.play("forward", true);
    this.lastPlayerX = this.player.x;
  }

  catchIngredient(player, ingredient) {
    const cfg = this.configData;
    const type = ingredient.getData("type");
    const { x, y } = ingredient;
    ingredient.destroy();

    if (cfg.items.bad.includes(type)) {
      this.score = Math.max(0, this.score - cfg.ui.pop.badItems);
      this.createScorePop(x, y, `-${cfg.ui.pop.badItems}`, true);
      this.flashRed();
      this.cameras.main.shake(200, 0.01);
    } else {
      this.score += cfg.ui.pop.goodItems;
      this.createScorePop(x, y, `+${cfg.ui.pop.goodItems}`, false);
    }

    if (this.score % cfg.spawn.difficultyScoreStep === 0 && this.score > 0) {
      this.increaseDifficulty();
    }

    this.updateScoreText();
  }

  createScorePop(x, y, text, isBad = false) {
    const cfg = this.configData.ui.pop;
    const color = isBad ? cfg.colorBad : cfg.colorGood;

    const label = this.add.text(x, y, text, {
      fontFamily: "'Luckiest Guy', cursive",
      fontSize: cfg.fontSize,
      fill: color
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: label,
      y: y + cfg.bounce.y,
      alpha: 0,
      duration: cfg.bounce.duration,
      ease: cfg.bounce.ease,
      onComplete: () => label.destroy()
    });
  }

  flashRed() {
    const flash = this.add.rectangle(150, 300, 300, 600, 0xff0000, 0.4).setDepth(6);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  increaseDifficulty() {
    const s = this.configData.spawn;
    this.spawnDelay = Math.max(s.minDelay, this.spawnDelay - s.decrease);
    this.fallSpeed = Math.min(s.maxFallSpeed, this.fallSpeed + s.increase);
    this.startIngredientEvent();
  }

  endGame() {
    this.gameOver = true;
    this.ingredientEvent.remove();
    this.items.clear(true, true);
    this.physics.pause();

    const cfg = this.configData;
    this.add.rectangle(150, 300, 300, 600, 0xf07000, 0.99).setDepth(4);
    window.finalScore = this.score; // guarda puntaje global
     
     gwd.actions.events.getElementById(cfg.ui.endCallback.finalScoreSelectorId).innerText = this.score
    
    setTimeout(() => {
      gwd.actions.gwdPagedeck.goToPage(
        'pagedeck',
        cfg.ui.endCallback.page,
        cfg.ui.endCallback.type,
        cfg.ui.endCallback.delay_animation,
        'ease-in-out',
        'bottom'
      );
    }, cfg.ui.endCallback.delay);
  }
}
