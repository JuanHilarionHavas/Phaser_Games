function randomIngredient(config) {
  const items = [...config.items.good, ...config.items.bad];
  return Phaser.Utils.Array.GetRandom(items);
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
        
    this.configData = window.gwd.GAME_CONFIG;
    this.score = 0;
    this.timer = 30;
    this.spawnDelay = this.configData.spawn.initialDelay;
    this.fallSpeed = this.configData.spawn.initialFallSpeed;
    this.gameOver = false;
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

    // Fondo
    this.bg = this.add.tileSprite(150, 300, 300, 600, cfg.background.key).setDepth(0);

    // Player
    const p = cfg.player;
    this.player = this.physics.add.sprite(p.initialPosition.x || 150, p.initialPosition.y || 550, p.spriteSheet, p.initialFrame)
      .setImmovable()
      .setScale(p.scale)
      .setDepth(2);
    this.player.body.allowGravity = false;
    this.player.setCollideWorldBounds(true);

    this.createAnimations();

    // Ingredientes
    this.items = this.physics.add.group();

    // UI
    this.scoreText = this.add.text(cfg.ui.scoreText.x, cfg.ui.scoreText.y, cfg.ui.scoreText.label + this.score, {
      fontSize: cfg.ui.font, fill: cfg.ui.color, fontFamily: cfg.ui.fontFamily
    }).setDepth(3);

    this.timerText = this.add.text(cfg.ui.timerText.x, cfg.ui.timerText.y, cfg.ui.timerText.label + this.timer, {
      fontSize: cfg.ui.font, fill: cfg.ui.color, fontFamily: cfg.ui.fontFamily
    }).setDepth(3);

    // Timer
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this.timer - 1,
      callback: () => {
        this.timer--;
        this.timerText.setText(cfg.ui.timerText.label + this.timer);
        if (this.timer % cfg.spawn.difficultyTimeStep === 0) this.increaseDifficulty();
        if (this.timer <= 0) this.endGame();
      }
    });

    // ⚡ Aquí es donde arranca el spawn de ingredientes:
    this.startIngredientEvent();

    // Colisiones
    this.physics.add.overlap(this.player, this.items, this.catchIngredient, null, this);
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
        sprite.setCircle(16);
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
      frameRate: 10,
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
      frameRate: 10,
      repeat: -1
    });
  }

  update() {
    const cfg = this.configData;
    const px = this.input.activePointer.x;
    if (px) {
      this.player.x = Phaser.Math.Linear(this.player.x, px, 0.1);
      const diff = px - this.player.x;
      this.player.angle = Phaser.Math.Clamp(diff * 0.1, -10, 10);
    }

    this.bg.tilePositionY += cfg.background.parallax.y;
    this.bg.tilePositionX = this.player.x * cfg.background.parallax.x;

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

    this.scoreText.setText(cfg.ui.scoreText.label + this.score);
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
    this.add.rectangle(150, 300, 300, 600, 0x000000, 0.6).setDepth(4);
    this.add.text(cfg.ui.endTitle.x, cfg.ui.endTitle.y + cfg.ui.endTitle.offsetY, cfg.ui.endTitle.text, {
      fontSize: cfg.ui.endTitle.fontSize,
      fontFamily: cfg.ui.endTitle.fontFamily,
      fill: cfg.ui.color
    }).setOrigin(0.5).setDepth(5);

    this.add.text(cfg.ui.endText.x, cfg.ui.endText.y + cfg.ui.endText.offsetY + 30, cfg.ui.endText.text + this.score, {
      fontSize: cfg.ui.endText.fontSize,
      fontFamily: cfg.ui.endText.fontFamily,
      fill: cfg.ui.color
    }).setOrigin(0.5).setDepth(5);
    
    setTimeout(() => {
      gwd.actions.gwdPagedeck.goToPage('pagedeck', cfg.ui.endCallback.page, cfg.ui.endCallback.type, cfg.ui.endCallback.delay, 'ease-in-out', 'bottom')
    }, cfg.ui.endCallback.delay);     
  }
}