// === Preloader Scene ===
class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }
  preload() {
    this.load.setBaseURL('./');
    this.load.setPath('assets/');
    this.load.image('volume-icon', 'ui/volume-icon.png');
    this.load.image('volume-icon_off', 'ui/volume-icon_off.png');
    this.load.audio('theme-song', 'audio/fat-caps-audionatix.mp3');
    this.load.audio('whoosh', 'audio/whoosh.mp3');
    this.load.audio('card-flip', 'audio/card-flip.mp3');
    this.load.audio('card-match', 'audio/card-match.mp3');
    this.load.audio('card-mismatch', 'audio/card-mismatch.mp3');
    this.load.audio('card-slide', 'audio/card-slide.mp3');
    this.load.audio('victory', 'audio/victory.mp3');
    this.load.image('background');
    this.load.image('card-back', 'cards/card-back.png');
    for (let i = 0; i < 6; i++) this.load.image(`card-${i}`, `cards/card-${i}.png`);
    this.load.image('heart', 'ui/heart.png');
  }
  create() {
    this.scene.start('Play');
  }
}

// === Función de creación de carta ===
function createCard({ scene, x, y, frontTexture, cardName, width, height }) {
  width = width || 98; height = height || 128;
  let isFlipping = false, rotation = { y: 0 };
  const back = 'card-back';
  const card = scene.add.plane(x, y, back)
    .setName(cardName)
    .setInteractive()
    .setScale(width / 99, height / 128);
  card.displayWidth = width;
  card.displayHeight = height;
  card.modelRotationY = 180;

  const flip = (cb) => {
    if (isFlipping) return;
    isFlipping = true;
    scene.sound.play('card-flip', { volume: 0.7 });
    scene.tweens.add({
      targets: rotation,
      y: rotation.y === 180 ? 0 : 180,
      ease: Phaser.Math.Easing.Expo.Out,
      duration: 500,
      onStart: () => {
        scene.tweens.chain({
          targets: card,
          tweens: [
            { duration: 200, scaleX: card.scaleX * 1.1, scaleY: card.scaleY * 1.1 },
            { duration: 300, scaleX: card.scaleX, scaleY: card.scaleY }
          ],
          ease: 'Expo.InOut'
        });
      },
      onUpdate: () => {
        card.rotateY = 180 + rotation.y;
        const rot = Math.floor(card.rotateY) % 360;
        card.setTexture((rot >= 0 && rot <= 90) || (rot >= 270) ? frontTexture : back);
      },
      onComplete: () => {
        isFlipping = false;
        if (cb) cb();
      }
    });
  };

  const destroy = () => {
    scene.tweens.add({
      targets: card,
      y: card.y - 1000,
      ease: 'Elastic.In',
      duration: 500,
      onComplete: () => card.destroy()
    });
  };

  return { gameObject: card, flip, destroy, cardName };
}

// === Play Scene ===
class Play extends Phaser.Scene {
  cardNames = ['card-0', 'card-1', 'card-2', 'card-3', 'card-4', 'card-5'];
  cards = []; cardOpened = null; canMove = false;
  lives = 7; timeLeft = 60; hearts = [];

  constructor() { super('Play'); }

  init() {
    this.cameras.main.fadeIn(500);
    this.lives = 7;
    this.volumeButton();
  }

  create() {
    this.startGame();
  }

  volumeButton() {
    const icon = this.add.image(25, 25, 'volume-icon').setInteractive();
    icon.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    icon.on('pointerout', () => this.input.setDefaultCursor('default'));
    icon.on('pointerdown', () => {
      if (this.sound.volume === 0) {
        this.sound.setVolume(0.6);
        icon.setTexture('volume-icon').setAlpha(1);
      } else {
        this.sound.setVolume(0);
        icon.setTexture('volume-icon_off').setAlpha(0.5);
      }
    });
  }

  getGridLayout() {
    const cols = (this.sys.game.scale.width < 500) ? 3 : 4;
    const rows = Math.ceil((this.cardNames.length * 2) / cols);
    return { cols, rows };
  }

  createGridCards() {
    const { cols, rows } = this.getGridLayout();
    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;
    const hud = 80;
    const usableW = width;
    const usableH = (height - hud) * 0.99;
    const padXtotal = usableW * 0.1;
    const padYtotal = usableH * 0.1;
    const cardW = (usableW - padXtotal) / cols;
    const cardH = (usableH - padYtotal) / rows;
    const padX = padXtotal / (cols + 1);
    const padY = padYtotal / (rows + 1);
    const offsetY = hud + 5;

    console.log(`Card dimensions: ${cardW}x${cardH} (Aspect ratio: ${(cardW / cardH).toFixed(2)})`);

    const names = Phaser.Utils.Array.Shuffle([...this.cardNames, ...this.cardNames]);
    return names.map((name, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padX + col * (cardW + padX) + cardW / 2;
      const startY = -1000;
      const card = createCard({
        scene: this, x, y: startY,
        frontTexture: name,
        cardName: name,
        width: cardW,
        height: cardH
      });

      this.add.tween({
        targets: card.gameObject,
        y: offsetY + padY + row * (cardH + padY) + cardH / 2,
        duration: 800,
        delay: i * 100
      });
      return card;
    });
  }

  createHearts() {
    return Array.from({ length: this.lives }).map((_, i) => {
      const startX = this.sys.game.scale.width / 7 + i * 35;
      const h = this.add.image(startX, 65, 'heart').setScale(2);
      this.tweens.add({
        targets: h, ease: 'Expo.InOut',
        duration: 1000, delay: 1000 + i * 200,
        x: startX
      });
      return h;
    });
  }

  endGame(win, winnerText, gameOverText) {
    this.canMove = false;
    const txt = win ? winnerText : gameOverText;
    this.sound.play('whoosh');
    this.tweens.add({
      targets: txt,
      ease: 'Bounce.Out',
      y: this.sys.game.scale.height / 2
    });
  }  

  startGame() {
    this.timeLeft = 60;
    this.hearts = this.createHearts();

    const winnerText = this.add.text(
      this.sys.game.scale.width / 2, -1000,
      'YOU WIN',
      { fontSize: '40px', stroke: '#000', strokeThickness: 4, color: '#8c7ae6', align: 'center' }
    ).setOrigin(0.5).setDepth(3).setInteractive();

    const gameOverText = this.add.text(
      this.sys.game.scale.width / 2, -1000,
      'GAME OVER\nClick to restart',
      { fontSize: '40px', stroke: '#000', strokeThickness: 4, color: '#ff0000', align: 'center' }
    ).setOrigin(0.5).setDepth(3).setInteractive();

    this.timeText = this.add.text(
      this.sys.game.scale.width - 100, 10,
      `Time: ${this.timeLeft}`,
      { fontSize: '24px', fill: '#fff', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(1, 0);

    this.time.addEvent({ loop: true, delay: 1000, callback: () => {
      this.timeLeft--;
      this.timeText.setText(`Time: ${this.timeLeft}`);
      if (this.timeLeft <= 0) {
        this.endGame(false, winnerText, gameOverText);
      }
    }});

    this.cards = this.createGridCards();
    this.time.delayedCall(200 * this.cards.length, () => (this.canMove = true));

    this.input.on('pointerdown', (pointer) => {
      if (!this.canMove || this.cards.length === 0) return;
      const card = this.cards.find(c => c.gameObject.hasFaceAt(pointer.x, pointer.y));
      if (!card) return;
      this.canMove = false;

      if (this.cardOpened) {
        if (this.cardOpened.cardName === card.cardName) {
          card.flip(() => {
            this.sound.play('card-match', {volume: 0.3});
            this.cardOpened.destroy();
            card.destroy();
            this.cards = this.cards.filter(c => c.cardName !== card.cardName);
            this.cardOpened = null;
            this.canMove = true;
            if (this.cards.length === 0) {
              this.endGame(true, winnerText, gameOverText);
            }
          });
        } else {
          card.flip(() => {
            this.sound.play('card-mismatch', {volume: 0.3});
            this.cameras.main.shake(600, 0.01);
            this.hearts.pop()?.destroy();
            this.lives--;

            this.time.delayedCall(200, () => {
              this.cardOpened.flip();
              card.flip(() => {
                this.cardOpened = null;
                this.canMove = true;
                if (this.lives <= 0) {
                  this.endGame(false, winnerText, gameOverText);
                }
              });
            });
          });
        }
      } else {
        card.flip(() => (this.canMove = true));
        this.cardOpened = card;
      }
    });

    [winnerText, gameOverText].forEach(text => {
      text.on('pointerover', () => this.input.setDefaultCursor('pointer'));
      text.on('pointerout', () => this.input.setDefaultCursor('default'));
      text.on('pointerdown', () => {
        this.sound.play('whoosh');
        this.tweens.add({
          targets: text,
          ease: 'Bounce.InOut',
          y: -1000,
          onComplete: () => this.scene.restart()
        });
      });
    });
  }
}