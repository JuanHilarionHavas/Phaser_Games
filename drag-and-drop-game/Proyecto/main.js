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

    // Load container
    this.load.image(gameConfig.container.key, basePath + gameConfig.container.path);

    // Load progress bar icon
    this.load.image(gameConfig.progressBar.iconKey, basePath + gameConfig.progressBar.iconPath);

    // Load draggable items
    const itemCount = gameConfig.itemCount;
    for (let i = 0; i < itemCount; i++) {
      const item = gameConfig.items[i];
      if (item) {
        this.load.image(item.key, basePath + item.path);
      }
    }

    // Handle load errors - create fallback textures
    this.load.on('loaderror', (file) => {
      console.warn(`Failed to load: ${file.key}`);
    });
  }

  create() {
    // Create fallback textures for missing assets
    this.createFallbackTextures();

    // Start game scene
    this.scene.start('GameScene');
  }

  createFallbackTextures() {
    const itemCount = gameConfig.itemCount;

    // Fallback for container
    if (!this.textures.exists(gameConfig.container.key)) {
      const containerGraphics = this.make.graphics({ x: 0, y: 0 });
      containerGraphics.fillStyle(0x4a90d9, 1);
      containerGraphics.fillRoundedRect(0, 0, 100, 100, 16);
      containerGraphics.lineStyle(3, 0x2c5282);
      containerGraphics.strokeRoundedRect(0, 0, 100, 100, 16);
      // Draw a plus sign
      containerGraphics.fillStyle(0xffffff, 0.5);
      containerGraphics.fillRect(45, 20, 10, 60);
      containerGraphics.fillRect(20, 45, 60, 10);
      containerGraphics.generateTexture(gameConfig.container.key, 100, 100);
      containerGraphics.destroy();
    }

    // Fallback for progress icon
    if (!this.textures.exists(gameConfig.progressBar.iconKey)) {
      const iconGraphics = this.make.graphics({ x: 0, y: 0 });
      iconGraphics.fillStyle(0x48bb78, 1);
      iconGraphics.fillCircle(15, 15, 15);
      iconGraphics.fillStyle(0xffffff, 1);
      // Checkmark
      iconGraphics.lineStyle(3, 0xffffff);
      iconGraphics.beginPath();
      iconGraphics.moveTo(8, 15);
      iconGraphics.lineTo(13, 20);
      iconGraphics.lineTo(22, 10);
      iconGraphics.strokePath();
      iconGraphics.generateTexture(gameConfig.progressBar.iconKey, 30, 30);
      iconGraphics.destroy();
    }

    // Fallback for items
    const colors = [0xe53e3e, 0xdd6b20, 0xd69e2e, 0x38a169, 0x3182ce, 0x805ad5];
    for (let i = 0; i < itemCount; i++) {
      const item = gameConfig.items[i];
      if (item && !this.textures.exists(item.key)) {
        const itemGraphics = this.make.graphics({ x: 0, y: 0 });
        const color = colors[i % colors.length];
        itemGraphics.fillStyle(color, 1);
        itemGraphics.fillRoundedRect(0, 0, 50, 50, 8);
        itemGraphics.fillStyle(0xffffff, 0.9);
        itemGraphics.fillRoundedRect(5, 5, 40, 40, 6);
        itemGraphics.fillStyle(color, 1);
        // Draw number
        itemGraphics.fillCircle(25, 25, 12);
        itemGraphics.generateTexture(item.key, 50, 50);
        itemGraphics.destroy();
      }
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
    this.timeLeft = gameConfig.timer.timeLimit;
    this.gameOver = false;
    this.items = [];
    this.progressIcons = [];
    this.timerText = null;
    this.timerEvent = null;
  }

  create() {
    const width = gameConfig.width;
    const height = gameConfig.height;

    // Create background
    this.createBackground();

    // Create progress bar with title
    this.createProgressBar();

    // Create timer display
    if (gameConfig.timer.enabled && gameConfig.timer.display) {
      this.createTimerDisplay();
    }

    // Create container (drop zone)
    this.createContainer();

    // Create draggable items
    this.createDraggableItems();

    // Setup drag events
    this.setupDragEvents();

    // Start timer if enabled
    if (gameConfig.timer.enabled) {
      this.startTimer();
    }

    // Animate items entry
    this.animateItemsEntry();
  }

  createBackground() {
    if (gameConfig.background.image && this.textures.exists(gameConfig.background.image)) {
      const bgScale = gameConfig.background.scale || 1;
      this.add.image(gameConfig.width / 2, gameConfig.height / 2, gameConfig.background.image)
        .setScale(bgScale);
    }
  }

  createProgressBar() {
    const pb = gameConfig.progressBar;
    const centerX = gameConfig.width / 2;

    // Title
    this.add.text(centerX, pb.titleY, pb.title, {
      font: pb.titleFont,
      fill: pb.titleColor
    }).setOrigin(0.5);

    // Calculate total width for centering
    const totalWidth = (this.totalItems - 1) * pb.spacing;
    const startX = centerX - totalWidth / 2;

    // Create progress icons
    for (let i = 0; i < this.totalItems; i++) {
      const icon = this.add.image(startX + i * pb.spacing, pb.y, pb.iconKey)
        .setScale(pb.iconScale)
        .setAlpha(pb.emptyAlpha);

      // Apply empty tint if configured
      if (pb.emptyTint !== undefined) {
        icon.setTint(pb.emptyTint);
      }

      this.progressIcons.push(icon);
    }
  }

  createTimerDisplay() {
    const timerOffsetY = gameConfig.timer.offsetY !== undefined ? gameConfig.timer.offsetY : 30;
    const timerY = gameConfig.progressBar.y + timerOffsetY;
    this.timerText = this.add.text(gameConfig.width / 2, timerY, this.formatTime(this.timeLeft), {
      font: '16px Arial',
      fill: '#333333'
    }).setOrigin(0.5);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeLeft--;

        if (this.timerText) {
          this.timerText.setText(this.formatTime(this.timeLeft));

          // Warning effect
          if (this.timeLeft <= gameConfig.timer.warningTime) {
            this.timerText.setFill('#e53e3e');
            this.tweens.add({
              targets: this.timerText,
              scale: 1.2,
              duration: 100,
              yoyo: true
            });
          }
        }

        if (this.timeLeft <= 0) {
          this.endGame(false);
        }
      },
      callbackScope: this,
      loop: true
    });
  }

  createContainer() {
    const containerCfg = gameConfig.container;
    const width = gameConfig.width;
    const height = gameConfig.height;

    // Calculate container position based on layout
    let containerX = width / 2;
    let containerY = height / 2;

    // Apply configurable offsetY (default values per layout if not specified)
    const offsetY = containerCfg.offsetY !== undefined ? containerCfg.offsetY : 50;

    switch (gameConfig.layout) {
      case 'top-bottom':
        containerY = height / 2 + offsetY;
        break;
      case 'left-right':
        containerY = height / 2 + offsetY;
        break;
      case 'left-bottom':
      default:
        containerX = width / 2 + 40;
        containerY = height / 2 + offsetY;
        break;
    }

    this.container = this.add.image(containerX, containerY, containerCfg.key)
      .setScale(containerCfg.scale);

    // Store drop zone info
    this.dropZone = {
      x: containerX,
      y: containerY,
      radius: containerCfg.dropZoneRadius
    };
  }

  createDraggableItems() {
    const positions = this.calculateItemPositions();

    for (let i = 0; i < this.totalItems; i++) {
      const itemConfig = gameConfig.items[i];
      const pos = positions[i];
      const itemScale = itemConfig.scale || 1;

      // Create item container (group sprite + text)
      const item = this.add.image(pos.startX, pos.startY, itemConfig.key)
        .setInteractive({ draggable: true })
        .setData('index', i)
        .setData('originalX', pos.x)
        .setData('originalY', pos.y)
        .setData('originalScale', itemScale)
        .setData('title', itemConfig.title)
        .setAlpha(0)
        .setScale(itemScale * 0.8);

      // Create title text above item (controlled by titleActive config)
      let title = null;
      let titleOffsetY = 0;
      const titleStyle = gameConfig.ui.itemTitle || {};
      const titleActive = titleStyle.active !== false; // Default true

      if (titleActive && itemConfig.title) {
        titleOffsetY = titleStyle.offsetY !== undefined ? titleStyle.offsetY : -50;
        const fontStyle = titleStyle.fontStyle || 'normal';
        const fontSize = titleStyle.fontSize || '12px';
        const fontFamily = titleStyle.fontFamily || 'Arial';
        const maxWidth = titleStyle.maxWidth || 80;
        const textAlign = titleStyle.align || 'center';

        title = this.add.text(pos.startX, pos.startY + titleOffsetY, itemConfig.title, {
          font: `${fontStyle} ${fontSize} ${fontFamily}`,
          fill: titleStyle.color || '#333333',
          align: textAlign,
          wordWrap: { width: maxWidth, useAdvancedWrap: true },
          fixedWidth: maxWidth
        }).setOrigin(0.5, 1).setAlpha(0);
      }

      item.setData('titleText', title);
      item.setData('titleOffsetY', titleOffsetY);
      this.items.push(item);
    }
  }

  calculateItemPositions() {
    const positions = [];
    const width = gameConfig.width;
    const height = gameConfig.height;
    const halfItems = Math.ceil(this.totalItems / 2);
    const otherHalf = this.totalItems - halfItems;

    // Get layout spacing config with defaults
    const ls = gameConfig.layoutSpacing || {};
    const itemsTop = ls.itemsTop || 150;
    const itemsBottom = ls.itemsBottom || 80;
    const itemsLeft = ls.itemsLeft || 50;
    const itemsRight = ls.itemsRight || 50;
    const itemGap = ls.itemGap || 90;

    switch (gameConfig.layout) {
      case 'left-bottom':
        // Left side items (vertical) - positioned to not overlap with container
        const leftStartY = itemsTop;
        for (let i = 0; i < halfItems; i++) {
          positions.push({
            x: itemsLeft,
            y: leftStartY + i * itemGap,
            startX: -50,
            startY: leftStartY + i * itemGap
          });
        }
        // Bottom items (horizontal)
        const bottomSpacingLB = (width - 40) / otherHalf;
        for (let i = 0; i < otherHalf; i++) {
          positions.push({
            x: 20 + (i + 0.5) * bottomSpacingLB,
            y: height - itemsBottom,
            startX: 20 + (i + 0.5) * bottomSpacingLB,
            startY: height + 50
          });
        }
        break;

      case 'top-bottom':
        // Top items (horizontal) - spread evenly across width
        const topSpacing = (width - 40) / halfItems;
        for (let i = 0; i < halfItems; i++) {
          positions.push({
            x: 20 + (i + 0.5) * topSpacing,
            y: itemsTop,
            startX: 20 + (i + 0.5) * topSpacing,
            startY: -50
          });
        }
        // Bottom items (horizontal)
        const bottomSpacing = (width - 40) / otherHalf;
        for (let i = 0; i < otherHalf; i++) {
          positions.push({
            x: 20 + (i + 0.5) * bottomSpacing,
            y: height - itemsBottom,
            startX: 20 + (i + 0.5) * bottomSpacing,
            startY: height + 50
          });
        }
        break;

      case 'left-right':
        // Left side items (vertical)
        const verticalStartY = itemsTop;
        for (let i = 0; i < halfItems; i++) {
          positions.push({
            x: itemsLeft,
            y: verticalStartY + i * itemGap,
            startX: -50,
            startY: verticalStartY + i * itemGap
          });
        }
        // Right side items (vertical)
        for (let i = 0; i < otherHalf; i++) {
          positions.push({
            x: width - itemsRight,
            y: verticalStartY + i * itemGap,
            startX: width + 50,
            startY: verticalStartY + i * itemGap
          });
        }
        break;

      default:
        // Default to top-bottom
        return this.calculateItemPositions.call({ ...this, gameConfig: { ...gameConfig, layout: 'top-bottom' } });
    }

    return positions;
  }

  animateItemsEntry() {
    const anim = gameConfig.animations.itemEntry;

    this.items.forEach((item, index) => {
      const titleText = item.getData('titleText');
      const finalX = item.getData('originalX');
      const finalY = item.getData('originalY');
      const itemScale = item.getData('originalScale') || 1;
      const titleOffsetY = item.getData('titleOffsetY') || 35;

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

      if (titleText) {
        this.tweens.add({
          targets: titleText,
          x: finalX,
          y: finalY + titleOffsetY,
          alpha: 1,
          duration: anim.duration,
          ease: anim.ease,
          delay: index * anim.stagger
        });
      }
    });
  }

  setupDragEvents() {
    const dragAnim = gameConfig.animations.drag;

    this.input.on('dragstart', (pointer, gameObject) => {
      if (this.gameOver) return;

      // Bring to top
      this.children.bringToTop(gameObject);

      // Scale and alpha effect (relative to item's original scale)
      const itemScale = gameObject.getData('originalScale') || 1;
      this.tweens.add({
        targets: gameObject,
        scale: itemScale * dragAnim.scale,
        alpha: dragAnim.alpha,
        duration: 100
      });

      // Hide title while dragging
      const titleText = gameObject.getData('titleText');
      if (titleText) {
        titleText.setAlpha(0);
      }
    });

    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
      if (this.gameOver) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on('dragend', (pointer, gameObject) => {
      if (this.gameOver) return;

      const titleText = gameObject.getData('titleText');

      // Check if dropped in container
      const distance = Phaser.Math.Distance.Between(
        gameObject.x, gameObject.y,
        this.dropZone.x, this.dropZone.y
      );

      if (distance <= this.dropZone.radius) {
        // Successful drop
        this.handleSuccessfulDrop(gameObject);
      } else {
        // Return to original position
        this.returnToOriginalPosition(gameObject);
      }
    });
  }

  handleSuccessfulDrop(item) {
    const dropAnim = gameConfig.animations.dropSuccess;
    const titleText = item.getData('titleText');

    // Disable interaction
    item.disableInteractive();

    // Animate item to container center and fade out
    this.tweens.add({
      targets: item,
      x: this.dropZone.x,
      y: this.dropZone.y,
      scale: 0.3,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        item.destroy();
        if (titleText) titleText.destroy();
      }
    });

    // Container bounce effect
    this.tweens.add({
      targets: this.container,
      scale: dropAnim.scaleBounce,
      duration: dropAnim.duration,
      yoyo: true,
      ease: 'Bounce.easeOut'
    });

    // Create particles
    this.createDropParticles();

    // Update progress
    this.droppedCount++;
    this.updateProgressBar();

    // Check win condition
    if (this.droppedCount >= this.totalItems) {
      this.time.delayedCall(500, () => {
        this.endGame(true);
      });
    }
  }

  returnToOriginalPosition(item) {
    const originalX = item.getData('originalX');
    const originalY = item.getData('originalY');
    const itemScale = item.getData('originalScale') || 1;
    const titleOffsetY = item.getData('titleOffsetY') || 35;
    const titleText = item.getData('titleText');

    this.tweens.add({
      targets: item,
      x: originalX,
      y: originalY,
      scale: itemScale,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    if (titleText) {
      this.tweens.add({
        targets: titleText,
        x: originalX,
        y: originalY + titleOffsetY,
        alpha: 1,
        duration: 300,
        ease: 'Back.easeOut'
      });
    }
  }

  createDropParticles() {
    const particleCount = gameConfig.animations.dropSuccess.particleCount;
    const colors = [0xe53e3e, 0xdd6b20, 0xd69e2e, 0x38a169, 0x3182ce, 0x805ad5];

    for (let i = 0; i < particleCount; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 30 + Math.random() * 20;

      const particle = this.add.circle(
        this.dropZone.x,
        this.dropZone.y,
        4 + Math.random() * 4,
        color
      );

      this.tweens.add({
        targets: particle,
        x: this.dropZone.x + Math.cos(angle) * radius,
        y: this.dropZone.y + Math.sin(angle) * radius,
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  updateProgressBar() {
    const pb = gameConfig.progressBar;
    if (this.droppedCount > 0 && this.progressIcons[this.droppedCount - 1]) {
      const icon = this.progressIcons[this.droppedCount - 1];

      // Set alpha permanently (no yoyo)
      icon.setAlpha(pb.filledAlpha);

      // Apply filled tint (green) if configured
      if (pb.filledTint !== undefined) {
        icon.setTint(pb.filledTint);
      } else {
        icon.clearTint();
      }

      // Scale bounce animation (yoyo for scale only)
      this.tweens.add({
        targets: icon,
        scale: pb.iconScale * 1.3,
        duration: 200,
        yoyo: true,
        ease: 'Bounce.easeOut'
      });
    }
  }

  endGame(win) {
    if (this.gameOver) return;
    this.gameOver = true;

    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.destroy();
    }

    // Disable all items
    this.items.forEach(item => {
      if (item.active) {
        item.disableInteractive();
      }
    });

    // Display result message
    const message = win ? gameConfig.ui.winText : gameConfig.ui.loseText;
    const color = win ? '#38a169' : '#e53e3e';

    const resultText = this.add.text(
      gameConfig.width / 2,
      gameConfig.height / 2,
      message,
      {
        font: 'bold 24px Arial',
        fill: color,
        stroke: '#ffffff',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: resultText,
      alpha: 1,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Callback
    if (gameConfig.ui.endGameCallback && typeof gameConfig.ui.endGameCallback === 'function') {
      this.time.delayedCall(1000, () => {
        gameConfig.ui.endGameCallback(win);
      });
    }
  }

  update(time, delta) {
    // Game loop logic if needed
  }
}
