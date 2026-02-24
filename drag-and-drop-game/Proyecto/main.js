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
    gameConfig = window.GAME_CONFIG;
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

    // Load draggable items
    for (let i = 0; i < gameConfig.itemCount; i++) {
      const item = gameConfig.items[i];
      if (item) {
        this.load.image(item.key, basePath + item.path);
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

    // Fallback for items
    const colors = [0xe53e3e, 0x3182ce, 0x38a169];
    for (let i = 0; i < gameConfig.itemCount; i++) {
      const item = gameConfig.items[i];
      if (item && !this.textures.exists(item.key)) {
        const itemGraphics = this.make.graphics({ x: 0, y: 0 });
        const color = colors[i % colors.length];
        itemGraphics.fillStyle(color, 1);
        itemGraphics.fillRoundedRect(0, 0, 60, 60, 10);
        itemGraphics.fillStyle(0xffffff, 0.9);
        itemGraphics.fillCircle(30, 30, 15);
        itemGraphics.generateTexture(item.key, 60, 60);
        itemGraphics.destroy();
      }
    }

    // Fallback for drag indicator
    if (gameConfig.dragIndicator.enabled && !this.textures.exists(gameConfig.dragIndicator.key)) {
      const dragGraphics = this.make.graphics({ x: 0, y: 0 });
      dragGraphics.fillStyle(0x333333, 0.8);
      dragGraphics.fillCircle(30, 30, 25);
      dragGraphics.fillStyle(0xffffff, 1);
      // Draw hand icon approximation
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
    this.totalItems = gameConfig.itemCount;
    this.gameOver = false;
    this.items = [];
    this.dropZones = [];
    this.dropZoneCircles = [];
    this.dragIndicator = null;
    this.hasStartedDragging = false;
    this.droppedItems = new Set(); // Track which items have been dropped
  }

  create() {
    // Create background color/image
    this.createBackground();

    // Create container (plano de casa)
    this.createContainer();

    // Create drop zone circles (on top of container)
    this.createDropZones();

    // Create draggable items
    this.createDraggableItems();

    // Create drag indicator (on top of items)
    this.createDragIndicator();

    // Setup drag events
    this.setupDragEvents();

    // Animate items entry
    this.animateItemsEntry();
  }

  createBackground() {
    // Background is handled by CSS/HTML (color or image)
    // This method can load a background image if configured
    if (gameConfig.background.image && this.textures.exists(gameConfig.background.image)) {
      const bgScale = gameConfig.background.scale || 1;
      this.add.image(gameConfig.width / 2, gameConfig.height / 2, gameConfig.background.image)
        .setScale(bgScale);
    }
  }

  createContainer() {
    // Create the container (plano de casa)
    const containerCfg = gameConfig.container;
    if (containerCfg && this.textures.exists(containerCfg.key)) {
      const containerY = containerCfg.y || gameConfig.height / 2;
      this.container = this.add.image(gameConfig.width / 2, containerY, containerCfg.key)
        .setScale(containerCfg.scale || 1)
        .setDepth(1);  // Container at depth 1
    }
  }

  createDropZones() {
    const dzConfig = gameConfig.dropZones;

    // Create drop zone for each item based on item's dropZone config
    gameConfig.items.forEach((item, index) => {
      if (!item.dropZone) return;

      const zoneX = item.dropZone.x;
      const zoneY = item.dropZone.y;

      // Create visual circle - at depth 2 to be above container
      const circle = this.add.image(zoneX, zoneY, dzConfig.circleKey)
        .setScale(dzConfig.circleScale)
        .setAlpha(1)
        .setDepth(2);  // Circles above container

      this.dropZoneCircles.push(circle);

      // Store drop zone info
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
      // Use item's individual position (x, y) from config
      const itemX = itemConfig.x !== undefined ? itemConfig.x : 150;
      const itemY = itemConfig.y !== undefined ? itemConfig.y : 160;
      const itemScale = itemConfig.scale || 1;
      const showDescription = itemConfig.showDescription !== false;

      // Create item sprite
      const item = this.add.image(itemX, -50, itemConfig.key)
        .setInteractive({ draggable: true })
        .setData('index', i)
        .setData('originalX', itemX)
        .setData('originalY', itemY)
        .setData('originalScale', itemScale)
        .setData('title', itemConfig.title)
        .setData('description', itemConfig.description)
        .setData('showDescription', showDescription)
        .setAlpha(0)
        .setScale(itemScale * 0.8)
        .setDepth(10);

      this.items.push(item);
    }
  }

  createDragIndicator() {
    if (!gameConfig.dragIndicator.enabled) return;

    const di = gameConfig.dragIndicator;

    // Use x, y directly from config
    const indicatorX = di.x;
    const indicatorY = di.y;

    this.dragIndicator = this.add.image(indicatorX, indicatorY, di.key)
      .setScale(di.scale)
      .setAlpha(0)
      .setDepth(1000);

    // Add subtle animation
    this.tweens.add({
      targets: this.dragIndicator,
      y: indicatorY - 10,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  animateItemsEntry() {
    const anim = gameConfig.animations.itemEntry;

    // Animate items
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

    // Animate drag indicator
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

      // Hide drag indicator on first drag
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

      // Bring to top
      this.children.bringToTop(gameObject);

      // Scale and alpha effect
      const itemScale = gameObject.getData('originalScale') || 1;
      this.tweens.add({
        targets: gameObject,
        scale: itemScale * dragAnim.scale,
        alpha: dragAnim.alpha,
        duration: 100
      });

      // Highlight valid drop zones
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

      // Find matching drop zone
      let matchedZone = null;
      for (const zone of this.dropZones) {
        if (zone.occupied) continue;

        const distance = Phaser.Math.Distance.Between(
          gameObject.x, gameObject.y,
          zone.x, zone.y
        );

        // Check if item matches this zone AND is within drop radius
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

      // Remove highlight
      this.highlightDropZones(false);
    });
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

    // Mark zone as occupied
    zone.occupied = true;
    this.droppedItems.add(itemIndex);

    // Disable interaction
    item.disableInteractive();

    // Animate item to drop zone - use dropScale from config if available
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

    // Hide the circle
    this.tweens.add({
      targets: zone.circle,
      alpha: 0,
      scale: 0,
      duration: 200
    });

    // Create particles
    this.createDropParticles(zone.x, zone.y);

    // Update progress
    this.droppedCount++;

    // Update DOM progress bar
    if (window.updateDOMProgress) {
      window.updateDOMProgress(this.droppedCount - 1);
    }

    // Show info popup only if showDescription is true for this item
    const showDescription = item.getData('showDescription');
    if (showDescription && gameConfig.infoPopup.enabled && window.showInfoPopup) {
      window.showInfoPopup(
        itemConfig.title.replace('\n', ' '),
        itemConfig.description,
        zone.x,
        zone.y
      );
    }

    // Check win condition
    if (this.droppedCount >= this.totalItems) {
      this.time.delayedCall(gameConfig.infoPopup.showDuration + 500, () => {
        this.endGame(true);
      });
    }
  }

  returnToOriginalPosition(item) {
    const originalX = item.getData('originalX');
    const originalY = item.getData('originalY');
    const itemScale = item.getData('originalScale') || 1;

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

    // Callback
    if (gameConfig.ui.endGameCallback && typeof gameConfig.ui.endGameCallback === 'function') {
      this.time.delayedCall(500, () => {
        gameConfig.ui.endGameCallback(win);
      });
    }
  }

  update(time, delta) {
    // Game loop logic if needed
  }
}
