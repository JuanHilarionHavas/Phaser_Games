// Tetley Catcher Game - Versión Mejorada

function randomIngredient() {
  const items = ["orange", "flower", "bad", "orange", "flower"]; // mayor probabilidad de buenos
  return Phaser.Utils.Array.GetRandom(items);
}

class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
    this.score = 0;
    this.timer = 30;
    this.gameOver = false;
  }

  preload() {
    this.load.image("can", "assets/can.png");
    this.load.image("orange", "assets/orange.png");
    this.load.image("flower", "assets/flower.png");
    this.load.image("bad", "assets/bad.png");
    this.load.image("bg", "assets/bg.png");
    this.load.image("button", "assets/ui/button.png");
    this.load.image("explosion", "assets/ui/explosion.png"); // explosion visual
  }

  create() {
    this.bg = this.add.tileSprite(150, 300, 300, 600, "bg").setDepth(0);

    this.can = this.physics.add.image(150, 550, "can")
      .setImmovable()
      .setScale(0.3)
      .setDepth(2);
    this.can.body.allowGravity = false;
    this.can.setCollideWorldBounds(true);

    this.ingredients = this.physics.add.group();

    this.scoreText = this.add.text(10, 10, "Ingredients: 0", {
      fontSize: "16px", fill: "#fff"
    }).setDepth(3);

    this.timerText = this.add.text(200, 10, `Time: ${this.timer}`, {
      fontSize: "16px", fill: "#fff"
    }).setDepth(3);

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this.timer - 1,
      callback: () => {
        this.timer--;
        this.timerText.setText(`Time: ${this.timer}`);
        if (this.timer <= 0) this.endGame();
      }
    });

    this.ingredientEvent = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => {
        if (this.gameOver) return;

        const x = Phaser.Math.Between(20, 280);
        const type = randomIngredient();
        const sprite = this.ingredients.create(x, 0, type);
        sprite.setCircle(16);
        sprite.setData("type", type);
        sprite.setBounce(0.3);

        if (type === "flower") sprite.setScale(0.9);
        if (type === "orange") sprite.setScale(0.8);
        if (type === "bad") sprite.setScale(0.7).setTint(0xff4444);
      }
    });

    this.physics.add.overlap(this.can, this.ingredients, this.catchIngredient, null, this);

    this.input.on("pointermove", (pointer) => {
      this.can.x = Phaser.Math.Clamp(pointer.x, 30, 270);
    });
  }

  update() {
    this.bg.tilePositionX += 0.2;
    this.bg.tilePositionY += 1;
  }

catchIngredient(can, ingredient) {
  const type = ingredient.getData("type");
  const { x, y } = ingredient;

  // Elimina inmediatamente el ingrediente
  ingredient.destroy();

    if (type === "bad") {
        this.score = Math.max(0, this.score - 2);
        this.createScorePop(x, y, "-2");
        this.flashRed();
        this.cameras.main.shake(200, 0.01);
    } else {
        this.score += 1;
        this.createScorePop(x, y, "+1");
    }
  this.scoreText.setText(`Ingredients: ${this.score}`);
}


  createScorePop(x, y, text) {
    const label = this.add.text(x, y, text, {
      fontSize: "18px",
      fill: "#00ff00",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: label,
      y: y - 30,
      alpha: 0,
      duration: 800,
      ease: "Cubic.easeOut",
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

  endGame() {
    this.gameOver = true;
    this.ingredientEvent.remove();
    this.ingredients.clear(true, true);
    this.physics.pause();

    this.add.rectangle(150, 300, 300, 600, 0x000000, 0.6).setDepth(4);
    this.add.text(150, 250, "Time's Up!", {
      fontSize: "24px", fill: "#fff"
    }).setOrigin(0.5).setDepth(5);

    this.add.text(150, 300, `You caught ${this.score} ingredients`, {
      fontSize: "18px", fill: "#fff"
    }).setOrigin(0.5).setDepth(5);

    const btn = this.add.image(150, 360, "button").setInteractive().setDepth(5);
    this.add.text(150, 360, "Learn More", {
      fontSize: "16px", fill: "#000"
    }).setOrigin(0.5).setDepth(6);

    btn.on("pointerdown", () => {
      window.open("https://www.tetley.ca", "_blank");
    });
  }
}
