const cfg = window.GAME_CONFIG;

function preload() {
  
  this.load.image('puzzle', cfg.assets.puzzle);
  this.load.image('particle', cfg.assets.particle);
  this.load.plugin(
    'rexoutlinepipelineplugin',
    'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexoutlinepipelineplugin.min.js',
    true
  );
}

function create() {
  const {
    selectors: { moves: movesSel, status: statusSel },
    labels: { movesPrefix, winText, tryAgainText },
    boardSize, areaWidth, areaHeight, gapTop, margin,
    initialDelayPerTile, initialShuffleDelay,
    outline, glow,fadeDuration,
    showParticles, particles
  } = cfg;

  const movEl = document.querySelector(movesSel);
  const statEl = document.querySelector(statusSel);

  const source = this.textures.get('puzzle').getSourceImage();
  const sliceW = Math.floor(source.width / boardSize);
  const sliceH = Math.floor(source.height / boardSize);

  for (let r = 0, frame = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (r === boardSize - 1 && c === boardSize - 1) continue;
      const key = `tile_${frame}`;
      const canvasTex = this.textures.createCanvas(key, sliceW, sliceH);
      canvasTex.getContext().drawImage(source, c * sliceW, r * sliceH, sliceW, sliceH, 0, 0, sliceW, sliceH);
      canvasTex.refresh();
      frame++;
    }
  }

  this.tileSize = Math.floor(Math.min(areaWidth, areaHeight) / boardSize) - margin;
  this.offsetX = (areaWidth - boardSize * this.tileSize) / 2 + margin;
  this.offsetY = gapTop + (areaHeight - boardSize * this.tileSize) / 2 + margin;

  this.add.image(
    this.offsetX + (boardSize * this.tileSize) / 2,
    this.offsetY + (boardSize * this.tileSize) / 2,
    'puzzle'
  ).setAlpha(0.3).setDisplaySize(areaWidth, areaHeight);

  this.moves = 0;
  movEl.textContent = `${movesPrefix}: 0`;
  statEl.textContent = '';

  this.createPuzzle = () => {
    const total = boardSize * boardSize;
    this.positions = Phaser.Utils.Array.NumberArray(0, total - 2);
    this.positions.push(null);

    this.tiles?.forEach(t => t.destroy());
    this.tiles = [];
    this.moves = 0;
    movEl.textContent = `${movesPrefix}: 0`;
    statEl.textContent = '';

    this.positions.forEach((v, idx) => {
      if (v === null) return;
      const row = Math.floor(idx / boardSize),
            col = idx % boardSize,
            x = this.offsetX + col * this.tileSize + this.tileSize / 2,
            y = this.offsetY + row * this.tileSize + this.tileSize / 2;
      const tile = this.add.image(x, y, `tile_${v}`)
        .setDisplaySize(this.tileSize, this.tileSize)
        .setInteractive();

      if (outline.enabled) {
        this.plugins.get('rexoutlinepipelineplugin').add(tile, {
          thickness: outline.thickness,
          outlineColor: outline.color,
          quality: outline.quality
        });
      }

      if (glow.enabled) {
        tile.preFX.setPadding(glow.padding);
        const fx = tile.preFX.addGlow(
          glow.color, glow.outerStrength, glow.innerStrength, false
        );
        fx.setActive(false);
        tile.on('pointerover', () => fx.setActive(true));
        tile.on('pointerout', () => fx.setActive(false));
      }

      tile.value = v;
      tile.pos = idx;
      tile.on('pointerdown', () => tryMove.call(this, tile));
      this.tiles.push(tile);

      this.tweens.add({
        targets: tile,
        alpha: 1,
        duration: 300,
        delay: idx * initialDelayPerTile
      });
    });

    this.time.delayedCall(
      initialShuffleDelay + this.tiles.length * initialDelayPerTile,
      () => {
        Phaser.Utils.Array.Shuffle(this.positions);
        this.tiles.forEach(t => {
          const ni = this.positions.indexOf(t.value),
                row = Math.floor(ni / boardSize),
                col = ni % boardSize;
          t.pos = ni;
          this.tweens.add({
            targets: t,
            x: this.offsetX + col * this.tileSize + this.tileSize / 2,
            y: this.offsetY + row * this.tileSize + this.tileSize / 2,
            duration: 300
          });
        });
      }
    );
  };

  this.solvePuzzle = (good) => {
    const total = boardSize * boardSize;
    this.positions = Phaser.Utils.Array.NumberArray(0, total - 2);
    this.positions.push(null);

    this.tiles.forEach(t => {
      const ni = this.positions.indexOf(t.value),
            row = Math.floor(ni / boardSize),
            col = ni % boardSize;
      t.pos = ni;
      this.tweens.add({
        targets: t,
        x: this.offsetX + col * this.tileSize + this.tileSize / 2,
        y: this.offsetY + row * this.tileSize + this.tileSize / 2,
        duration: 300
      });
    });

    this.time.delayedCall(350, () => triggerWin.call(this, good));
  };

  this.checkWin = () => {
    const total = boardSize * boardSize;
    const correct = Phaser.Utils.Array.NumberArray(0, total - 2).concat([null]);
    if (JSON.stringify(this.positions) === JSON.stringify(correct)) {
      triggerWin.call(this, false);
    }
  };

  const triggerWin = (good) => {
    statEl.textContent = good ? tryAgainText : winText;

    const fg = this.add.image(
      this.offsetX + (boardSize * this.tileSize) / 2,
      this.offsetY + (boardSize * this.tileSize) / 2,
      'puzzle'
    ).setAlpha(0).setDisplaySize(areaWidth, areaHeight);

    this.tweens.add({ targets: fg, alpha: 1, duration: fadeDuration });

    if (showParticles) {
      this.add.particles(150, 0, 'particle', particles);
    }
  };

  this.triggerWin = triggerWin;
  this.createPuzzle();
}

function tryMove(tile) {
  const { boardSize, solveMoveLimit, selectors: { moves: movesSel }, labels: { movesPrefix } } = cfg;
  const blank = this.positions.indexOf(null),
        idx = tile.pos,
        r1 = Math.floor(blank / boardSize),
        c1 = blank % boardSize,
        r2 = Math.floor(idx / boardSize),
        c2 = idx % boardSize;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

  this.positions[blank] = tile.value;
  this.positions[idx] = null;
  tile.pos = blank;

  this.moves++;
  document.querySelector(movesSel).textContent = `${movesPrefix}: ${this.moves}`;

  if (this.moves >= solveMoveLimit) {
    this.solvePuzzle(true);
  }

  this.tweens.add({
    targets: tile,
    x: this.offsetX + c1 * this.tileSize + this.tileSize / 2,
    y: this.offsetY + r1 * this.tileSize + this.tileSize / 2,
    duration: 200,
    onComplete: () => this.checkWin()
  });
}
