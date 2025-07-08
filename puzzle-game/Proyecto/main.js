window.onload = function() {
  const config = {
    type: Phaser.AUTO,
    width: 300,
    height: 600,
    backgroundColor: '#222',
    scene: { preload, create }
  };
  
  window.game = new Phaser.Game(config);
};

function preload() {
  this.load.spritesheet('tiles', 'img/tiles_spritesheet.png', {
    frameWidth: 128,
    frameHeight: 128
  });
  this.load.image('background', 'img/background.jpg');
  this.load.image('particle', 'img/particle.png');
}

function create() {
  const boardSize = 3;
  const areaWidth = 300;
  const areaHeight = 300;
  const gapTop = 200;
  const margin = 0;

  let tileSize = Math.min(
    areaWidth / boardSize,
    areaHeight / boardSize
  );
  tileSize = Math.floor(tileSize) - margin;

  const offsetX = (areaWidth - (boardSize * tileSize)) / 2 + margin;
  const offsetY = gapTop + (areaHeight - (boardSize * tileSize)) / 2 + margin;

  this.add.image(150, 300, 'background')
    .setDisplaySize(300, 600)
    .setAlpha(0.3);

  this.tiles = [];
  this.moves = 0;
  this.movesText = this.add.text(150, 450, 'Movimientos: 0', {
    font: '20px Arial',
    fill: '#fff'
  }).setOrigin(0.5);

  // Iniciar con los tiles ordenados
  this.positions = Phaser.Utils.Array.NumberArray(0, boardSize * boardSize - 2);
  this.positions.push(null);

  this.positions.forEach((value, index) => {
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    const x = offsetX + col * tileSize + tileSize / 2;
    const y = offsetY + row * tileSize + tileSize / 2;

    if (value !== null) {
      const tile = this.add.sprite(x, y, 'tiles', value)
        .setDisplaySize(tileSize * 0.8, tileSize * 0.8)
        .setAlpha(0)
        .setInteractive();
      tile.value = value;
      tile.pos = index;
      tile.on('pointerdown', () => tryMove.call(this, tile, tileSize, offsetX, offsetY));
      this.tiles.push(tile);

      this.tweens.add({
        targets: tile,
        displayWidth: tileSize,
        displayHeight: tileSize,
        alpha: 1,
        duration: 300,
        delay: index * 50
      });
    }
  });

  // Luego del efecto inicial, desordenar
  this.time.delayedCall(2500 + this.tiles.length * 50, () => {
    this.positions = Phaser.Utils.Array.NumberArray(0, boardSize * boardSize - 2);
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

  this.solvePuzzle = () => {
    this.positions = Phaser.Utils.Array.NumberArray(0, boardSize * boardSize - 2);
    this.positions.push(null);

    this.tiles.forEach(tile => {
      let finalIndex = this.positions.indexOf(tile.value);
      tile.pos = finalIndex;
      const row = Math.floor(finalIndex / boardSize);
      const col = finalIndex % boardSize;
      this.tweens.add({
        targets: tile,
        x: offsetX + col * tileSize + tileSize / 2,
        y: offsetY + row * tileSize + tileSize / 2,
        duration: 300
      });
    });
    this.time.delayedCall(350, () => triggerWin.call(this));
  };

  this.checkWin = () => {
    const correct = Phaser.Utils.Array.NumberArray(0, boardSize * boardSize - 2).concat([null]);
    if (JSON.stringify(this.positions) === JSON.stringify(correct)) {
      triggerWin.call(this);
    }
  };

  function triggerWin() {
    this.add.text(150, 50, '¡Ganaste!', {
      font: '28px Arial',
      fill: '#fff'
    }).setOrigin(0.5);

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
  const boardSize = 3;
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
    this.movesText.setText('Movimientos: ' + this.moves);

    this.tweens.add({
      targets: tile,
      x: offsetX + c1 * tileSize + tileSize / 2,
      y: offsetY + r1 * tileSize + tileSize / 2,
      duration: 200,
      onComplete: () => this.checkWin()
    });
  }
}
