let config;

// === Preloader Scene ===
class Preloader extends Phaser.Scene {
  constructor() { super('Preloader'); }
  preload() {
    config = window.gwd.GAME_CONFIG;
    const assets = config.assets;
    this.load.setBaseURL('./');
    this.load.setPath(assets.basePath || './');
    // UI icons
    //this.load.image('volume-icon', 'volume-icon.png');
    //this.load.image('volume-icon_off', 'volume-icon_off.png');
    // Fondo
    if (assets.background) {
      this.load.image(assets.background.key, assets.background.path);
    }
    // Carta reverso
    if (assets.cardBack) {
      this.load.image(assets.cardBack.key, assets.cardBack.path);
    }
    // Corazón
    if (assets.heart) {
      this.load.image(assets.heart.key, assets.heart.path);
    }
    // Cartas frontales
    const cardCfg = config.card;
    for (let i = 0; i < cardCfg.count; i++) {
      const key = cardCfg.assetBase + i;
      const path = cardCfg.assetPath + cardCfg.assetBase + i + cardCfg.assetExt;
      this.load.image(key, path);
    }
  }
  create() {
    this.scene.start('Play');
  }
}

// === Función de creación de carta ===
function createCard({ scene, x, y, frontTexture, cardName, width, height }) {
  width = width || config.card.width;
  height = height || config.card.height;
  let isFlipping = false, rotation = { y: 0 };
  const back = config.card.backTexture;
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
  constructor() { super('Play'); }

  init() {
    this.config = config;
    // Usar solo la cantidad de pares indicada por 'count'
  this.cardNames = this.config.card.frontTextures.slice(0, this.config.card.count);
    this.cards = [];
    this.cardOpened = null;
    this.canMove = false;
    this.lives = this.config.lives;
    this.timeLeft = this.config.timeLimit;
    this.hearts = [];
    
    // Inicializar el timer en el DOM si está configurado
    this.updateTimerDisplay();
    
    this.cameras.main.fadeIn(500);
    //this.volumeButton();
  }
  
  updateTimerDisplay() {
    const ui = this.config.ui;
    if (ui.useExternalTimer && ui.timerSelector) {
      const timerElement = document.querySelector(ui.timerSelector);
      if (timerElement) {
        timerElement.textContent = `${ui.timerLabel} ${this.timeLeft}`;
      }
    }
  }

  create() {
    // Agregar background si está definido en config
    const bgCfg = this.config.assets && this.config.assets.background;
    if (bgCfg) {
      // El fondo debe estar en el fondo de la escena
      this.backgroundImage = this.add.image(
        this.sys.game.scale.width / 2,
        this.sys.game.scale.height / 2,
        bgCfg.key
      ).setOrigin(0.5, 0.5).setDepth(-10);
      // Escalar para cubrir el canvas
      const scaleX = this.sys.game.scale.width / this.backgroundImage.width;
      const scaleY = this.sys.game.scale.height / this.backgroundImage.height;
      const scale = Math.max(scaleX, scaleY);
      this.backgroundImage.setScale(scale);
    }
    this.startGame();
  }

 /* volumeButton() {
    const icon = this.add.image(this.config.ui.volIconX, this.config.ui.volIconY, 'volume-icon').setInteractive();
    icon.on('pointerover', () => this.input.setDefaultCursor('pointer'));
    icon.on('pointerout', () => this.input.setDefaultCursor('default'));
    icon.on('pointerdown', () => {
      if (this.sound.volume === 0) {
        this.sound.setVolume(this.config.ui.volume);
        icon.setTexture('volume-icon').setAlpha(1);
      } else {
        this.sound.setVolume(0);
        icon.setTexture('volume-icon_off').setAlpha(0.5);
      }
    });
  }*/

  getGridLayout() {
    const cols = this.config.grid.cols;
    const rows = this.config.grid.rows;
    return { cols, rows };
  }

  createGridCards() {
    const { cols, rows } = this.getGridLayout();
    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;
    const ui = this.config.ui || {};
    const hud = ui.hud !== undefined ? ui.hud : 80;
    const padTop = ui.paddingTop || 0;
    const padBottom = ui.paddingBottom || 0;
    const padLeft = ui.paddingLeft || 0;
    const padRight = ui.paddingRight || 0;
    // Área disponible para el grid (descontando HUD y paddings)
    const usableW = width - padLeft - padRight;
    const usableH = (height - hud) * 0.99 - padTop - padBottom;
    const cardW = this.config.card.width;
    const cardH = this.config.card.height;
    // Calcula gap para centrar el grid, puede ser 0 si las cartas ocupan todo
    const totalCardsW = cols * cardW;
    // Permite personalizar el espacio entre cartas desde el config
    const gapX = (typeof this.config.grid.gapX === 'number') ? this.config.grid.gapX : (cols > 1 ? Math.max((usableW - totalCardsW) / (cols - 1), 0) : 0);
    const gapY = (typeof this.config.grid.gapY === 'number') ? this.config.grid.gapY : (rows > 1 ? Math.max((usableH - (rows * cardH)) / (rows - 1), 0) : 0);
    // Offset para centrar el grid completo
    const offsetX = padLeft + (usableW - (totalCardsW + gapX * (cols - 1))) / 2;
    // Alto total del bloque de cartas (todas las filas + gaps entre filas)
    const blockHeight = rows * cardH + (rows - 1) * gapY;
    // Centra el bloque completo en el área jugable (después del HUD)
    const offsetY = hud + padTop + (usableH - blockHeight) / 2;

    console.log(`Card config: ${cardW}x${cardH} | grid: ${cols}x${rows} | gapX: ${gapX} gapY: ${gapY}`);

    const names = Phaser.Utils.Array.Shuffle([...this.cardNames, ...this.cardNames]);
    return names.map((name, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Centrado especial para la última fila si está incompleta
      let x;
      if (row === rows - 1) {
        // Cartas en la última fila
        const cardsInLastRow = names.length - (rows - 1) * cols;
        const totalLastRowW = cardsInLastRow * cardW + (cardsInLastRow - 1) * gapX;
        const offsetLastRowX = padLeft + (usableW - totalLastRowW) / 2;
        x = offsetLastRowX + col * (cardW + gapX) + cardW / 2;
      } else {
        x = offsetX + col * (cardW + gapX) + cardW / 2;
      }
      const y = offsetY + row * (cardH + gapY) + cardH / 2;
      const card = createCard({
        scene: this, x, y,
        frontTexture: name,
        cardName: name,
        width: cardW,
        height: cardH
      });
      // Animación de entrada
      card.gameObject.y = -1000;
      this.add.tween({
        targets: card.gameObject,
        y: y,
        duration: 800,
        delay: i * 100
      });
      return card;
    });
  }

  createHearts() {
    const ui = this.config.ui || {};
    const heartCount = this.lives;
    const spacing = ui.heartSpacing || 35;
    const scale = ui.heartScale || 2;
    const y = ui.heartY || 65;
    const x = ui.heartX || 65;
    const totalWidth = (heartCount - 1) * spacing;
    const centerX = this.sys.game.scale.width / 2;
    const startX = ui.heartX;
    return Array.from({ length: heartCount }).map((_, i) => {
      const x = startX + i * spacing;
      const h = this.add.image(x, y, 'heart').setScale(scale);
      this.tweens.add({
        targets: h, ease: 'Expo.InOut',
        duration: 1000, delay: 1000 + i * 200,
        x: x
      });
      return h;
    });
  }  

  endGame() {
    this.canMove = false;
    if (this.timerEvent) this.timerEvent.paused = true;
    //this.sound.setVolume(0);
    if (typeof this.config.onGameEnd === 'function') {
       this.config.onGameEnd.call(this, this.lives, this.timeLeft);
    }
  }  

  startGame() {
    const ui = this.config.ui;
    this.timeLeft = this.config.timeLimit;
    this.hearts = this.createHearts();

      // Usar elemento DOM externo
      this.timerElement = document.querySelector(ui.timerSelector);
      if (this.timerElement) {
        this.timerElement.textContent = `${ui.timerLabel} ${this.timeLeft}`;
      } else {
        console.warn(`Elemento DOM con selector '${ui.timerSelector}' no encontrado.`);
      }

    this.cards = this.createGridCards();
    this.canMove = true;
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (!this.canMove) return; // Pausa el reloj si el juego terminó
        this.timeLeft--;
        
        // Actualizar el timer (DOM o Phaser según configuración)
        const timerText = `${ui.timerLabel} ${this.timeLeft}`;
        if (this.timerElement) {
          // Actualizar elemento DOM
          this.timerElement.textContent = timerText;
        } else if (this.timeText) {
          // Actualizar texto de Phaser
          this.timeText.setText(timerText);
        }
        
        if (this.timeLeft <= 0) {
          this.endGame();
          this.timerEvent.paused = true;
        }
      },
      callbackScope: this,
      loop: true
    });

    // Lógica de interacción de cartas
    this.input.on('pointerdown', (pointer) => {
      if (!this.canMove || this.cards.length === 0) return;
      const card = this.cards.find(c => {
        const obj = c.gameObject;
        const left = obj.x - obj.displayWidth / 2;
        const right = obj.x + obj.displayWidth / 2;
        const top = obj.y - obj.displayHeight / 2;
        const bottom = obj.y + obj.displayHeight / 2;
        return pointer.x >= left && pointer.x <= right && pointer.y >= top && pointer.y <= bottom;
      });
      if (!card) return;
      this.canMove = false;

      if (this.cardOpened) {
        if (this.cardOpened.cardName === card.cardName) {
          card.flip(() => {
            this.cardOpened.destroy();
            card.destroy();
            this.cards = this.cards.filter(c => c.cardName !== card.cardName);
            this.cardOpened = null;
            this.canMove = true;
            // Comprobación de victoria
            if (this.cards.length === 0) {
              this.endGame();
            }
          });
        } else {
          card.flip(() => {
            this.cameras.main.shake(600, 0.01);
            this.hearts.pop()?.destroy();
            this.lives--;
            this.time.delayedCall(200, () => {
              this.cardOpened.flip();
              card.flip(() => {
                this.cardOpened = null;
                this.canMove = true;
                if (this.lives <= 0) {
                  this.endGame();
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
  }
}