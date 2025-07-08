window.onload = function() {
  const config = {
    type: Phaser.AUTO,
    width: 300,
    height: 600,
    transparent: true,
    parent: 'game_container', // renderiza el canvas dentro de #game_container
    scene: { preload, create }
  };
  
  window.game = new Phaser.Game(config);
};

function preload() {
  this.load.image('puzzle', 'img/puzzle_image.png');
  this.load.image('particle', 'img/particle.png');
}

function create() {
  this.boardSize = 3;
  this.areaWidth = 295;
  this.areaHeight = 295;
  this.gapTop = 130;
  this.margin = 2.5;

  const sourceImage = this.textures.get('puzzle').getSourceImage();
  const imgWidth = sourceImage.width;
  const imgHeight = sourceImage.height;

  const sliceW = Math.floor(imgWidth / this.boardSize);
  const sliceH = Math.floor(imgHeight / this.boardSize);

  let frame = 0;
  for (let row = 0; row < this.boardSize; row++) {
    for (let col = 0; col < this.boardSize; col++) {
      if (!(row === this.boardSize - 1 && col === this.boardSize -1)) {
        this.textures.addCanvas(`tile_${frame}`, (() => {
          const canvas = this.textures.createCanvas(`tile_canvas_${frame}`, sliceW, sliceH).getCanvas();
          const ctx = canvas.getContext('2d');
          ctx.drawImage(sourceImage, col * sliceW, row * sliceH, sliceW, sliceH, 0, 0, sliceW, sliceH);
          return canvas;
        })());
        frame++;
      }
    }
  }

  this.tileSize = Math.min(this.areaWidth / this.boardSize, this.areaHeight / this.boardSize);
  this.tileSize = Math.floor(this.tileSize) - this.margin;

  this.offsetX = (this.areaWidth - (this.boardSize * this.tileSize)) / 2 + this.margin;
  this.offsetY = this.gapTop + (this.areaHeight - (this.boardSize * this.tileSize)) / 2 + this.margin;

  this.add.image(
    this.offsetX + (this.boardSize * this.tileSize) / 2,
    this.offsetY + (this.boardSize * this.tileSize) / 2,
    'puzzle'
  ).setAlpha(0.3)
   .setDisplaySize(this.areaWidth, this.areaHeight);

  // Referencias al HTML externo
  const movimientosEl = document.getElementById("movimientos");
  const estadoEl = document.getElementById("estado");

  this.moves = 0;
  movimientosEl.textContent = "Movimientos: 0";
  estadoEl.textContent = "";

  this.createPuzzle = (boardSize, offsetX, offsetY, tileSize) => {
    let totalTiles = boardSize * boardSize;
    this.positions = Phaser.Utils.Array.NumberArray(0, totalTiles - 2);
    this.positions.push(null);

    if (this.tiles) {
      this.tiles.forEach(t => t.destroy());
    }
    this.tiles = [];

    this.moves = 0;
    movimientosEl.textContent = "Movimientos: 0";
    estadoEl.textContent = "";

    this.positions.forEach((value, index) => {
      const row = Math.floor(index / boardSize);
      const col = index % boardSize;
      const x = offsetX + col * tileSize + tileSize / 2;
      const y = offsetY + row * tileSize + tileSize / 2;

      if (value !== null) {

        const tile = this.add.image(x, y, `tile_${value}`)
          .setDisplaySize(tileSize, tileSize)
          .setAlpha(0)
          .setInteractive();

        tile.preFX.addShadow(2, 2, 0.1, 1, 0x000033, 6, 0.7);

        tile.preFX.setPadding(4);
        const fxGlow = tile.preFX.addGlow(0xffffff, 1, 0, false);
        this.input.on('pointerover', () => fxGlow.setActive(true));
        this.input.on('pointerout', () => fxGlow.setActive(false));

        tile.value = value;
        tile.pos = index;
        tile.on('pointerdown', () => tryMove.call(this, tile, tileSize, offsetX, offsetY));
        this.tiles.push(tile);

        this.tweens.add({
          targets: tile,
          alpha: 1,
          duration: 300,
          delay: index * 50
        });
      }
    });

    this.time.delayedCall(2000 + this.tiles.length * 50, () => {
      this.positions = Phaser.Utils.Array.NumberArray(0, totalTiles - 2);
      this.positions.push(null);
      Phaser.Utils.Array.Shuffle(this.positions);

      this.tiles.forEach(tile => {
        let newIndex = this.positions.indexOf(tile.value);
        tile.pos = newIndex;
        const newRow = Math.floor(newIndex / boardSize);
        const newCol = newIndex % boardSize;

        this.tweens.add({
          targets: tile,
          x: offsetX + newCol * tileSize + tileSize / 2,
          y: offsetY + newRow * tileSize + tileSize / 2,
          duration: 300
        });
      });
    });
  }
  this.createPuzzle(this.boardSize, this.offsetX, this.offsetY, this.tileSize);

  this.solvePuzzle = (goodTry = false) => {
    let totalTiles = this.boardSize * this.boardSize;
    this.positions = Phaser.Utils.Array.NumberArray(0, totalTiles - 2);
    this.positions.push(null);

    this.tiles.forEach(tile => {
      let finalIndex = this.positions.indexOf(tile.value);
      tile.pos = finalIndex;
      const row = Math.floor(finalIndex / this.boardSize);
      const col = finalIndex % this.boardSize;
      this.tweens.add({
        targets: tile,
        x: this.offsetX + col * this.tileSize + this.tileSize / 2,
        y: this.offsetY + row * this.tileSize + this.tileSize / 2,
        duration: 300
      });
    });
    this.time.delayedCall(350, () => triggerWin.call(this, goodTry));
  };

  this.checkWin = () => {
    let totalTiles = this.boardSize * this.boardSize;
    const correct = Phaser.Utils.Array.NumberArray(0, totalTiles - 2).concat([null]);
    if (JSON.stringify(this.positions) === JSON.stringify(correct)) {
      triggerWin.call(this, false);
    }
  };

    function triggerWin(goodTry) {
    estadoEl.textContent = goodTry ? "¡Buen intento!" : "¡Ganaste!";

    // Fondo encima con fade
    const fg = this.add.image(
      this.offsetX + (this.boardSize * this.tileSize) / 2,
      this.offsetY + (this.boardSize * this.tileSize) / 2,
      'puzzle'
      ).setAlpha(0)
      .setDisplaySize(this.areaWidth, this.areaHeight);

    this.tweens.add({
      targets: fg,
      alpha: 1,
      duration: 1000
    });

    this.add.particles(150, 0, 'particle', {
      speedY: { min: 100, max: 200 },
      lifespan: 2000,
      quantity: 5,
      scale: { start: 0.2, end: 0 },
      angle: { min: 0, max: 360 },
      frequency: 100,
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(-150, 0, 300, 1) }
    });
  }


  this.triggerWin = triggerWin;
}

function tryMove(tile, tileSize, offsetX, offsetY) {
  const boardSize = Math.sqrt(this.positions.length);
  const blankIndex = this.positions.indexOf(null);
  const tileIndex = tile.pos;

  const r1 = Math.floor(blankIndex / boardSize),
        c1 = blankIndex % boardSize;
  const r2 = Math.floor(tileIndex / boardSize),
        c2 = tileIndex % boardSize;

  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
    this.positions[blankIndex] = tile.value;
    this.positions[tileIndex] = null;
    tile.pos = blankIndex;

    this.moves += 1;
    document.getElementById("movimientos").textContent = "Movimientos: " + this.moves;

    if (this.moves >= 250) {
      this.solvePuzzle(true); // goodTry=true
    }

    this.tweens.add({
      targets: tile,
      x: offsetX + c1 * tileSize + tileSize / 2,
      y: offsetY + r1 * tileSize + tileSize / 2,
      duration: 200,
      onComplete: () => this.checkWin()
    });
  }
}
