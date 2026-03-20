// Global config reference
let gameConfig;

// ============================================
// PRELOADER SCENE
// ============================================
class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload() {
    gameConfig = window.gwd.GAME_CONFIG;
    const basePath = gameConfig.assetsPath;

    // Load background image if configured
    if (gameConfig.background.image && gameConfig.background.imagePath) {
      this.load.image(gameConfig.background.image, basePath + gameConfig.background.imagePath);
    }

    // Load container (plano de casa)
    if (gameConfig.container && gameConfig.container.path) {
      this.load.image(gameConfig.container.key, basePath + gameConfig.container.path);
    }

    // Load drag indicator icon
    if (gameConfig.dragIndicator.enabled) {
      this.load.image(gameConfig.dragIndicator.key, basePath + gameConfig.dragIndicator.path);
    }

    // Load drop zone circles
    this.load.image(gameConfig.dropZones.circleKey, basePath + gameConfig.dropZones.circlePath);

    // Load draggable items as spritesheets (2 frames: idle=0, drag=1)
    for (let i = 0; i < gameConfig.itemCount; i++) {
      const item = gameConfig.items[i];
      if (item && item.spritePath) {
        this.load.spritesheet(item.key, basePath + item.spritePath, {
          frameWidth: item.frameWidth || 80,
          frameHeight: item.frameHeight || 100
        });
      }
    }

    // Handle load errors
    this.load.on('loaderror', (file) => {
      console.warn(`Failed to load: ${file.key}`);
    });
  }

  create() {
    this.createFallbackTextures();
    this.scene.start('GameScene');
  }

  createFallbackTextures() {
    // Fallback for drop zone circle
    if (!this.textures.exists(gameConfig.dropZones.circleKey)) {
      const circleGraphics = this.make.graphics({ x: 0, y: 0 });
      circleGraphics.lineStyle(3, 0xffffff, 0.8);
      circleGraphics.strokeCircle(50, 50, 45);
      circleGraphics.generateTexture(gameConfig.dropZones.circleKey, 100, 100);
      circleGraphics.destroy();
    }

    // Fallback for items (spritesheet with 2 frames: idle=0, drag=1)
    const colors = [0xe53e3e, 0x3182ce, 0x38a169];
    for (let i = 0; i < gameConfig.itemCount; i++) {
      const item = gameConfig.items[i];
      if (item && !this.textures.exists(item.key)) {
        const color = colors[i % colors.length];
        const fw = item.frameWidth || 80;
        const fh = item.frameHeight || 100;

        // Create a spritesheet with 2 frames side by side
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // Frame 0 (left): idle sprite with text placeholder
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(0, 0, fw, fh - 20, 10);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(fw / 2, (fh - 20) / 2, 15);
        graphics.fillStyle(0x333333, 1);
        graphics.fillRect(5, fh - 25, fw - 10, 15);

        // Frame 1 (right): drag sprite (image only)
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(fw, 10, fw, fh - 30, 10);
        graphics.fillStyle(0xffffff, 0.9);
        graphics.fillCircle(fw + fw / 2, 10 + (fh - 30) / 2, 15);

        graphics.generateTexture(item.key, fw * 2, fh);
        graphics.destroy();

        // Add spritesheet frames manually
        this.textures.get(item.key).add(0, 0, 0, 0, fw, fh);
        this.textures.get(item.key).add(1, 0, fw, 0, fw, fh);
      }
    }

    // Fallback for drag indicator
    if (gameConfig.dragIndicator.enabled && !this.textures.exists(gameConfig.dragIndicator.key)) {
      const dragGraphics = this.make.graphics({ x: 0, y: 0 });
      dragGraphics.fillStyle(0x333333, 0.8);
      dragGraphics.fillCircle(30, 30, 25);
      dragGraphics.fillStyle(0xffffff, 1);
      dragGraphics.fillRect(25, 20, 10, 25);
      dragGraphics.generateTexture(gameConfig.dragIndicator.key, 60, 60);
      dragGraphics.destroy();
    }
  }
}

// ============================================
// GAME SCENE
// ============================================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  init() {
    this.droppedCount = 0;
    this.goodItemCount = gameConfig.items.filter(item => !item.isBadItem).length;
    this.totalItems = gameConfig.itemCount;
    this.gameOver = false;
    this.items = [];
    this.dropZones = [];
    this.dropZoneCircles = [];
    this.dragIndicator = null;
    this.hasStartedDragging = false;
    this.droppedItems = new Set();
    this.redFlashOverlay = null;
  }

  create() {
    this.createBackground();
    this.createContainer();
    this.createDropZones();
    this.createDraggableItems();
    this.createDragIndicator();
    this.createRedFlashOverlay();
    this.setupDragEvents();
    this.animateItemsEntry();
  }

  createBackground() {
    if (gameConfig.background.image && this.textures.exists(gameConfig.background.image)) {
      const bgScale = gameConfig.background.scale || 1;
      this.add.image(gameConfig.width / 2, gameConfig.height / 2, gameConfig.background.image)
        .setScale(bgScale);
    } else if (gameConfig.background.color) {
      // Draw solid color background rectangle
      const colorInt = Phaser.Display.Color.HexStringToColor(gameConfig.background.color).color;
      this.add.rectangle(gameConfig.width / 2, gameConfig.height / 2, gameConfig.width, gameConfig.height, colorInt)
        .setDepth(0);
    }
  }

  createContainer() {
    const containerCfg = gameConfig.container;
    if (containerCfg && this.textures.exists(containerCfg.key)) {
      const containerY = containerCfg.y || gameConfig.height / 2;
      this.container = this.add.image(gameConfig.width / 2, containerY, containerCfg.key)
        .setScale(containerCfg.scale || 1)
        .setDepth(1);
    }
  }

  createDropZones() {
    const dzConfig = gameConfig.dropZones;

    // Create drop zone only for good items (skip bad items)
    gameConfig.items.forEach((item, index) => {
      if (!item.dropZone) return;
      if (item.isBadItem) return;

      const zoneX = item.dropZone.x;
      const zoneY = item.dropZone.y;

      const circle = this.add.image(zoneX, zoneY, dzConfig.circleKey)
        .setScale(dzConfig.circleScale)
        .setAlpha(1)
        .setDepth(2);

      this.dropZoneCircles.push(circle);

      this.dropZones.push({
        x: zoneX,
        y: zoneY,
        radius: dzConfig.dropRadius,
        itemIndex: index,
        occupied: false,
        circle: circle
      });
    });
  }

  createDraggableItems() {
    for (let i = 0; i < this.totalItems; i++) {
      const itemConfig = gameConfig.items[i];
      const itemX = itemConfig.x !== undefined ? itemConfig.x : 150;
      const itemY = itemConfig.y !== undefined ? itemConfig.y : 160;
      const itemScale = itemConfig.scale || 1;
      const showDescription = itemConfig.showDescription !== false;
      const isBadItem = itemConfig.isBadItem === true;

      const item = this.add.sprite(itemX, -50, itemConfig.key, 0)
        .setInteractive({ draggable: true })
        .setData('index', i)
        .setData('key', itemConfig.key)
        .setData('originalX', itemX)
        .setData('originalY', itemY)
        .setData('originalScale', itemScale)
        .setData('title', itemConfig.title)
        .setData('description', itemConfig.description)
        .setData('showDescription', showDescription)
        .setData('isBadItem', isBadItem)
        .setAlpha(0)
        .setScale(itemScale * 0.8)
        .setDepth(10);

      this.items.push(item);
    }
  }

  createDragIndicator() {
    if (!gameConfig.dragIndicator.enabled) return;

    const di = gameConfig.dragIndicator;
    const indicatorX = di.x;
    const indicatorY = di.y;

    this.dragIndicator = this.add.image(indicatorX, indicatorY, di.key)
      .setScale(di.scale)
      .setAlpha(0)
      .setDepth(1000);

    this.tweens.add({
      targets: this.dragIndicator,
      y: indicatorY - 10,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createRedFlashOverlay() {
    if (gameConfig.badItemEffect && gameConfig.badItemEffect.enabled) {
      this.redFlashOverlay = this.add.rectangle(
        gameConfig.width / 2,
        gameConfig.height / 2,
        gameConfig.width,
        gameConfig.height,
        gameConfig.badItemEffect.flashColor || 0xff0000
      )
        .setAlpha(0)
        .setDepth(2000);
    }
  }

  flashRedScreen() {
    if (!this.redFlashOverlay || !gameConfig.badItemEffect) return;

    const effect = gameConfig.badItemEffect;
    const flashCount = effect.flashCount || 2;
    const flashDuration = effect.flashDuration || 300;
    const flashAlpha = effect.flashAlpha || 0.5;

    this.tweens.add({
      targets: this.redFlashOverlay,
      alpha: flashAlpha,
      duration: flashDuration / 2,
      yoyo: true,
      repeat: flashCount - 1,
      ease: 'Sine.easeInOut'
    });
  }

  animateItemsEntry() {
    const anim = gameConfig.animations.itemEntry;

    this.items.forEach((item, index) => {
      const finalX = item.getData('originalX');
      const finalY = item.getData('originalY');
      const itemScale = item.getData('originalScale') || 1;

      this.tweens.add({
        targets: item,
        x: finalX,
        y: finalY,
        alpha: 1,
        scale: itemScale,
        duration: anim.duration,
        ease: anim.ease,
        delay: index * anim.stagger
      });
    });

    if (this.dragIndicator) {
      this.tweens.add({
        targets: this.dragIndicator,
        alpha: 1,
        duration: 300,
        delay: (this.totalItems * anim.stagger) + 200
      });
    }
  }

  setupDragEvents() {
    const dragAnim = gameConfig.animations.drag;

    this.input.on('dragstart', (pointer, gameObject) => {
      if (this.gameOver) return;

      if (!this.hasStartedDragging && this.dragIndicator) {
        this.hasStartedDragging = true;
        this.tweens.add({
          targets: this.dragIndicator,
          alpha: 0,
          scale: 0.5,
          duration: 200,
          onComplete: () => {
            this.dragIndicator.destroy();
            this.dragIndicator = null;
          }
        });
      }

      // SWAP TO DRAG FRAME (frame 1 = right side, image only)
      gameObject.setFrame(1);

      this.children.bringToTop(gameObject);

      const itemScale = gameObject.getData('originalScale') || 1;
      this.tweens.add({
        targets: gameObject,
        scale: itemScale * dragAnim.scale,
        alpha: dragAnim.alpha,
        duration: 100
      });

      this.highlightDropZones(true);
    });

    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (this.gameOver) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on('dragend', (pointer, gameObject) => {
      if (this.gameOver) return;

      const itemIndex = gameObject.getData('index');
      const isBadItem = gameObject.getData('isBadItem');

      const isOnContainer = this.isOverContainer(gameObject.x, gameObject.y);

      // Handle BAD ITEM dropped on container
      if (isBadItem && isOnContainer) {
        this.handleBadItemDrop(gameObject);
        this.highlightDropZones(false);
        return;
      }

      // Find matching drop zone for GOOD items
      let matchedZone = null;
      for (const zone of this.dropZones) {
        if (zone.occupied) continue;

        const distance = Phaser.Math.Distance.Between(
          gameObject.x, gameObject.y,
          zone.x, zone.y
        );

        if (distance <= zone.radius && zone.itemIndex === itemIndex) {
          matchedZone = zone;
          break;
        }
      }

      if (matchedZone) {
        this.handleSuccessfulDrop(gameObject, matchedZone);
      } else {
        this.returnToOriginalPosition(gameObject);
      }

      this.highlightDropZones(false);
    });
  }

  isOverContainer(x, y) {
    if (!this.container) return false;
    const containerBounds = this.container.getBounds();
    return containerBounds.contains(x, y);
  }

  handleBadItemDrop(item) {
    this.flashRedScreen();
    this.returnToOriginalPosition(item);
  }

  highlightDropZones(highlight) {
    this.dropZoneCircles.forEach((circle, index) => {
      const zone = this.dropZones[index];
      if (zone.occupied) return;

      if (highlight) {
        this.tweens.add({
          targets: circle,
          scale: gameConfig.dropZones.circleScale * 1.15,
          alpha: 1,
          duration: 200
        });
      } else {
        this.tweens.add({
          targets: circle,
          scale: gameConfig.dropZones.circleScale,
          alpha: 0.9,
          duration: 200
        });
      }
    });
  }

  handleSuccessfulDrop(item, zone) {
    const itemIndex = item.getData('index');
    const itemConfig = gameConfig.items[itemIndex];

    zone.occupied = true;
    this.droppedItems.add(itemIndex);

    item.disableInteractive();

    const dropScale = itemConfig.dropScale !== undefined ? itemConfig.dropScale : 0.7;
    this.tweens.add({
      targets: item,
      x: zone.x,
      y: zone.y,
      scale: dropScale,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: zone.circle,
      alpha: 0,
      scale: 0,
      duration: 200
    });

    this.createDropParticles(zone.x, zone.y);

    this.droppedCount++;

    // Update DOM progress bar
    if (window.updateDOMProgress) {
      window.updateDOMProgress(this.droppedCount - 1);
    }

    // Show info popup
    const showDescription = item.getData('showDescription');
    if (showDescription && gameConfig.infoPopup.enabled && window.showInfoPopup) {
      window.showInfoPopup(
        itemConfig.title.replace('\n', ' '),
        itemConfig.description,
        zone.x,
        zone.y
      );
    }

    // Check win condition - only good items count
    if (this.droppedCount >= this.goodItemCount) {
      this.time.delayedCall(gameConfig.infoPopup.showDuration + 500, () => {
        this.endGame(true);
      });
    }
  }

  returnToOriginalPosition(item) {
    const originalX = item.getData('originalX');
    const originalY = item.getData('originalY');
    const itemScale = item.getData('originalScale') || 1;

    // SWAP BACK TO IDLE FRAME (frame 0 = left side with name)
    item.setFrame(0);

    this.tweens.add({
      targets: item,
      x: originalX,
      y: originalY,
      scale: itemScale,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });
  }

  createDropParticles(x, y) {
    const particleCount = gameConfig.animations.dropSuccess.particleCount;
    const colors = [0xffd000, 0x333333, 0xffffff];

    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 25 + Math.random() * 15;

      const particle = this.add.circle(x, y, 3 + Math.random() * 3, color);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        alpha: 0,
        scale: 0,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  endGame(win) {
    if (this.gameOver) return;
    this.gameOver = true;

    // Disable all remaining items
    this.items.forEach(item => {
      if (item.active) {
        item.disableInteractive();
      }
    });

    const endCfg = gameConfig.endGameCallback;
    if (endCfg) {
      // Set final score in the End_Page element
      if (endCfg.finalScoreSelectorId) {
        const scoreEl = document.getElementById(endCfg.finalScoreSelectorId);
        if (scoreEl) {
          scoreEl.innerText = this.droppedCount;
        }
      }

      // Navigate to End_Page via GWD pagedeck
      setTimeout(() => {
        if (typeof gwd !== 'undefined' && gwd.actions && gwd.actions.gwdPagedeck) {
          gwd.actions.gwdPagedeck.goToPage(
            'pagedeck',
            endCfg.page,
            endCfg.type || 'none',
            endCfg.delay_animation || 1000,
            'ease-in-out',
            'bottom'
          );
        }
      }, endCfg.delay || 0);
    }
  }

  update(time, delta) {
    // Game loop logic if needed
  }
}