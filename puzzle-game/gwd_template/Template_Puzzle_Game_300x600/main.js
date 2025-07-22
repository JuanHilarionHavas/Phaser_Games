let cfg;

function preload() {
  cfg = window.gwd.GAME_CONFIG;
  this.load.image('puzzle', cfg.assets.puzzle);
  this.load.plugin(
    'rexoutlinepipelineplugin',
    'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexoutlinepipelineplugin.min.js',
    true
  );
}

function create() {
  const {
    selectors: { moves: movesSel },
    boardSize, areaWidth, areaHeight, gapTop, margin,
    initialDelayPerTile, initialShuffleDelay,
    outline, glow, solveMoveLimit,
    endCallback
  } = cfg;
  
  // Desactiva glow solo en móvil
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    glow.enabled = false;
  }

  const movEl = document.querySelector(movesSel);
  movEl.innerText = "0";

  // Corta imagen puzzle en tiles robusto para móviles
  const source = this.textures.get('puzzle').getSourceImage();
  const sliceW = Math.floor(source.width / boardSize);
  const sliceH = Math.floor(source.height / boardSize);

  let frame = 0;
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (r === boardSize - 1 && c === boardSize - 1) continue;
      const key = `tile_${frame}`;

      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }

      const canvasTex = this.textures.createCanvas(key, sliceW, sliceH);
      const ctx = canvasTex.context;

      // Limpieza robusta para móviles
      ctx.clearRect(0, 0, sliceW, sliceH);

      // Asegura composición normal
      ctx.globalCompositeOperation = 'source-over';

      // Relleno opaco blanco
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceW, sliceH);

      // Dibuja el slice
      ctx.drawImage(
        source,
        c * sliceW, r * sliceH,
        sliceW, sliceH,
        0, 0,
        sliceW, sliceH
      );

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

  this.createPuzzle = () => {
    const total = boardSize * boardSize;
    this.positions = Phaser.Utils.Array.NumberArray(0, total - 2);
    this.positions.push(null);

    this.tiles?.forEach(t => t.destroy());
    this.tiles = [];
    this.moves = 0;
    movEl.innerText = `0`;

    this.positions.forEach((v, idx) => {
      if (v === null) return;
      const row = Math.floor(idx / boardSize),
            col = idx % boardSize,
            x = this.offsetX + col * this.tileSize + this.tileSize / 2,
            y = this.offsetY + row * this.tileSize + this.tileSize / 2;

      const tile = this.add.image(x, y, `tile_${v}`)
        .setDisplaySize(this.tileSize, this.tileSize)
        .setInteractive()
        .setAlpha(1);

      if (outline.enabled) {
        this.plugins.get('rexoutlinepipelineplugin').add(tile, {
          thickness: outline.thickness,
          outlineColor: outline.color,
          quality: outline.quality
        });
      }
      if (glow.enabled) {
        tile.preFX.setPadding(glow.padding);
        const fx = tile.preFX.addGlow(glow.color, glow.outerStrength, glow.innerStrength, false);
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

    this.time.delayedCall(initialShuffleDelay + this.tiles.length * initialDelayPerTile, () => {
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
    });
  };

  this.solvePuzzle = () => {
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

    gwd.actions.events.getElementById(cfg.id_finalScore).innerText = this.moves;

    setTimeout(() => {
      gwd.actions.gwdPagedeck.goToPage(
        'pagedeck',
        endCallback.page,
        endCallback.type,
        endCallback.delay_animation,
        'ease-in-out',
        'bottom'
      );
    }, endCallback.delay);
  };

  this.checkWin = () => {
    const total = boardSize * boardSize;
    const correct = Phaser.Utils.Array.NumberArray(0, total - 2).concat([null]);
    if (JSON.stringify(this.positions) === JSON.stringify(correct)) {
      this.solvePuzzle();
    }
  };

  this.createPuzzle();
}

function tryMove(tile) {
  const { boardSize, solveMoveLimit, selectors: { moves: movesSel }} = cfg;
  const blank = this.positions.indexOf(null),
        idx = tile.pos,
        r1 = Math.floor(blank / boardSize), c1 = blank % boardSize,
        r2 = Math.floor(idx / boardSize), c2 = idx % boardSize;

  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

  this.positions[blank] = tile.value;
  this.positions[idx] = null;
  tile.pos = blank;

  this.moves++;
  document.querySelector(movesSel).innerText = `${this.moves}`;

  if (this.moves >= solveMoveLimit) {
    this.solvePuzzle();
    return;
  }

  this.tweens.add({
    targets: tile,
    x: this.offsetX + c1 * this.tileSize + this.tileSize / 2,
    y: this.offsetY + r1 * this.tileSize + this.tileSize / 2,
    duration: 200,
    onComplete: () => this.checkWin()
  });
}
