export class Preloader extends Phaser.Scene
{
    constructor()
    {
        super({
            key: 'Preloader'
        });
    }

    preload ()
    {
        this.load.setBaseURL('./');
        this.load.setPath("assets/");

        this.load.image("volume-icon", "ui/volume-icon.png");
        this.load.image("volume-icon_off", "ui/volume-icon_off.png");

        this.load.audio("theme-song", "audio/fat-caps-audionatix.mp3");
        this.load.audio("whoosh", "audio/whoosh.mp3");
        this.load.audio("card-flip", "audio/card-flip.mp3");
        this.load.audio("card-match", "audio/card-match.mp3");
        this.load.audio("card-mismatch", "audio/card-mismatch.mp3");
        this.load.audio("card-slide", "audio/card-slide.mp3");
        this.load.audio("victory", "audio/victory.mp3");
        this.load.image("background");
        this.load.image("card-back", "cards/card-back.png");
        this.load.image("card-0", "cards/card-0.png");
        this.load.image("card-1", "cards/card-1.png");
        this.load.image("card-2", "cards/card-2.png");
        this.load.image("card-3", "cards/card-3.png");
        this.load.image("card-4", "cards/card-4.png");
        this.load.image("card-5", "cards/card-5.png");

        this.load.image("heart", "ui/heart.png");

    }

    create ()
    {
        this.scene.start("Play");
    }
}

export const createCard = ({
    scene,
    x,
    y,
    frontTexture,
    cardName,
    width = 98,    // valores por defecto
    height = 128
}) => {
    let isFlipping = false;
    const rotation = { y: 0 };

    const backTexture = "card-back";

    // Crear carta como plano
    const card = scene.add.plane(x, y, backTexture)
        .setName(cardName)
        .setInteractive();

 
    const scaleX = width / 99;
    const scaleY = height / 128;

    card.setScale(scaleX, scaleY);
    card.displayWidth = width;
    card.displayHeight = height;

    card.modelRotationY = 180;

    const flipCard = (callbackComplete) => {
        if (isFlipping) return;

        scene.add.tween({
            targets: [rotation],
            y: (rotation.y === 180) ? 0 : 180,
            ease: Phaser.Math.Easing.Expo.Out,
            duration: 500,
            onStart: () => {
                isFlipping = true;
                scene.sound.play("card-flip", { volume: 0.7 });

                scene.tweens.chain({
                    targets: card,
                    tweens: [
                        { duration: 200, scale: scaleX * 1.1 },
                        { duration: 300, scale: scaleX }
                    ],
                    ease: Phaser.Math.Easing.Expo.InOut
                });
            },
            onUpdate: () => {
                card.rotateY = 180 + rotation.y;
                const cardRotation = Math.floor(card.rotateY) % 360;

                if ((cardRotation >= 0 && cardRotation <= 90) || (cardRotation >= 270 && cardRotation <= 359)) {
                    card.setTexture(frontTexture);
                } else {
                    card.setTexture(backTexture);
                }
            },
            onComplete: () => {
                isFlipping = false;
                if (callbackComplete) callbackComplete();
            }
        });
    };

    const destroy = () => {
        scene.add.tween({
            targets: [card],
            y: card.y - 1000,
            ease: Phaser.Math.Easing.Elastic.In,
            duration: 500,
            onComplete: () => card.destroy()
        });
    };

    return {
        gameObject: card,
        flip: flipCard,
        destroy,
        cardName
    };
};

export class Play extends Phaser.Scene
{
    // All cards names
    cardNames = ["card-0", "card-1", "card-2", "card-3", "card-4", "card-5"];
    // Cards Game Objects
    cards = [];

    // History of card opened
    cardOpened = undefined;

    // Can play the game
    canMove = false;

    // Game variables
    lives = 0;
    timeLeft = 60;
    timeText = undefined;
    timeEvent = undefined;

    constructor ()
    {
        super({
            key: 'Play'
        });
    }

    init ()
    {
        // Fadein camera
        this.cameras.main.fadeIn(500);
        this.lives = 7;
        this.volumeButton();

        const width = this.sys.game.scale.width;
        const height = this.sys.game.scale.height;

        this.gridConfiguration = {
            x: width * 0.1, // 10% desde la izquierda
            y: height * 0.15, // 15% desde arriba
            paddingX: width * 0.01,
            paddingY: height * 0.015
        };

    }

    create ()
    {
        this.startGame();
       
    }

    restartGame ()
    {
        this.cardOpened = undefined;
        this.cameras.main.fadeOut(200 * this.cards.length);
        this.cards.reverse().map((card, index) => {
            this.add.tween({
                targets: card.gameObject,
                duration: 500,
                y: 1000,
                delay: index * 100,
                onComplete: () => {
                    card.gameObject.destroy();
                }
            })
        });

        this.time.addEvent({
            delay: 200 * this.cards.length,
            callback: () => {
                this.cards = [];
                this.canMove = false;
                this.scene.restart();
                this.sound.play("card-slide", { volume: 0.7 });
            }
        })
    }

    getGridLayout() {
        const width = this.sys.game.scale.width;
        const height = this.sys.game.scale.height;

        let cols = 4; // default
        if (width < 500) {
            cols = 3;
        } else if (width < 800) {
            cols = 4;
        }

        const totalPairs = this.cardNames.length;
        const totalCards = totalPairs * 2;
        const rows = Math.ceil(totalCards / cols);

        return { cols, rows };
    }

    createGridCards () {
    const { cols, rows } = this.getGridLayout();

    const width = this.sys.game.scale.width;
    const height = this.sys.game.scale.height;

    // 🟥 Reservar espacio arriba para corazones y HUD
    const hudHeight = 80;
    const availableHeight = height - hudHeight;

    // 🟩 MÁXIMA área para cartas: 99%
    const usableWidth = width * 1;
    const usableHeight = availableHeight * 0.99;

    // ⚠️ Solo 1% de espacio total para padding entre todas las cartas
    const totalPaddingX = usableWidth * 0.1;
    const totalPaddingY = usableHeight * 0.1;

    const cardWidth = (usableWidth - totalPaddingX) / cols;
    const cardHeight = (usableHeight - totalPaddingY) / rows;

    const paddingX = totalPaddingX / (cols + 1);
    const paddingY = totalPaddingY / (rows + 1);

    const offsetTop = hudHeight + 5; // margen mínimo desde arriba

    const gridCardNames = Phaser.Utils.Array.Shuffle([...this.cardNames, ...this.cardNames]);

    return gridCardNames.map((name, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        const x = paddingX + col * (cardWidth + paddingX) + cardWidth / 2;
        const y = offsetTop + paddingY + row * (cardHeight + paddingY) + cardHeight / 2;

        const newCard = createCard({
            scene: this,
            x: x,
            y: -1000,
            frontTexture: name,
            cardName: name,
            width: cardWidth,
            height: cardHeight
        });

        this.add.tween({
            targets: newCard.gameObject,
            duration: 800,
            delay: index * 100,
            y: y
        });

        return newCard;
    });
    }
    createHearts ()
    {
        return Array.from(new Array(this.lives)).map((el, index) => {
            const positionInX = this.sys.game.scale.width / 7
            const heart = this.add.image(positionInX, 65, "heart")
                .setScale(2)

            this.add.tween({
                targets: heart,
                ease: Phaser.Math.Easing.Expo.InOut,
                duration: 1000,
                delay: 1000 + index * 200,
                x: positionInX + 35 * index // marginLeft + spaceBetween * index
            });
            return heart;
        });
    }

    volumeButton ()
    {
        const volumeIcon = this.add.image(25, 25, "volume-icon").setName("volume-icon");
        volumeIcon.setInteractive();

        // Mouse enter
        volumeIcon.on(Phaser.Input.Events.POINTER_OVER, () => {
            this.input.setDefaultCursor("pointer");
        });
        // Mouse leave
        volumeIcon.on(Phaser.Input.Events.POINTER_OUT, () => {
            this.input.setDefaultCursor("default");
        });


        volumeIcon.on(Phaser.Input.Events.POINTER_DOWN, () => {
            if (this.sound.volume === 0) {
                this.sound.setVolume(0.6);
                volumeIcon.setTexture("volume-icon");
                volumeIcon.setAlpha(1);
            } else {
                this.sound.setVolume(0);
                volumeIcon.setTexture("volume-icon_off");
                volumeIcon.setAlpha(.5)
            }
        });
    }

    startGame ()
    {

        this.timeLeft = 60;

        // WinnerText and GameOverText
        const winnerText = this.add.text(this.sys.game.scale.width / 2, -1000, "YOU WIN",
            { align: "center", strokeThickness: 4, fontSize: 40, fontStyle: "bold", color: "#8c7ae6" }
        ).setOrigin(.5)
            .setDepth(3)
            .setInteractive();

        const gameOverText = this.add.text(this.sys.game.scale.width / 2, -1000,
            "GAME OVER\nClick to restart",
            { align: "center", strokeThickness: 4, fontSize: 40, fontStyle: "bold", color: "#ff0000" }
        )
            .setName("gameOverText")
            .setDepth(3)
            .setOrigin(.5)
            .setInteractive();

        // Start lifes images
        const hearts = this.createHearts();

        this.timeText = this.add.text(this.sys.game.scale.width - 100, 10, `Time: ${this.timeLeft}`, {
            fontSize: "24px", fill: "#ffffff", stroke: "#000", strokeThickness: 3
        }).setOrigin(1, 0);

        this.timeEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.timeLeft -= 1;
                this.timeText.setText(`Time: ${this.timeLeft}`);
                if (this.timeLeft <= 0 && this.cards.length > 0) {
                    this.timeEvent.remove();
                    this.canMove = false;
                    this.sound.play("whoosh", { volume: 1 });
                    this.add.tween({
                        targets: gameOverText,
                        ease: Phaser.Math.Easing.Bounce.Out,
                        y: this.sys.game.scale.height / 2,
                    });
                }
            }
        });

        // Create a grid of cards
        this.cards = this.createGridCards();

        // Start canMove
        this.time.addEvent({
            delay: 200 * this.cards.length,
            callback: () => {
                this.canMove = true;
            }
        });

        // Game Logic
        this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer) => {
            if (this.canMove) {
                const card = this.cards.find(card => card.gameObject.hasFaceAt(pointer.x, pointer.y));
                if (card) {
                    this.input.setDefaultCursor("pointer");
                }
            }
        });
        this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) => {
            if (this.canMove && this.cards.length) {
                const card = this.cards.find(card => card.gameObject.hasFaceAt(pointer.x, pointer.y));

                if (card) {
                    this.canMove = false;

                    // Detect if there is a card opened
                    if (this.cardOpened !== undefined) {
                        // If the card is the same that the opened not do anything
                        if (this.cardOpened.gameObject.x === card.gameObject.x && this.cardOpened.gameObject.y === card.gameObject.y) {
                            this.canMove = true;
                            return false;
                        }

                        card.flip(() => {
                            if (this.cardOpened.cardName === card.cardName) {
                                // ------- Match -------
                                this.sound.play("card-match", { volume: 0.5 });
                                // Destroy card selected and card opened from history
                                this.cardOpened.destroy();
                                card.destroy();

                                // remove card destroyed from array
                                this.cards = this.cards.filter(cardLocal => cardLocal.cardName !== card.cardName);
                                // reset history card opened
                                this.cardOpened = undefined;
                                this.canMove = true;

                            } else {
                                // ------- No match -------
                                this.sound.play("card-mismatch", { volume: 0.5 });
                                this.cameras.main.shake(600, 0.01);
                                // remove life and heart
                                const lastHeart = hearts[hearts.length - 1];
                                this.add.tween({
                                    targets: lastHeart,
                                    ease: Phaser.Math.Easing.Expo.InOut,
                                    duration: 1000,
                                    y: - 1000,
                                    onComplete: () => {
                                        lastHeart.destroy();
                                        hearts.pop();
                                    }
                                });
                                this.lives -= 1;
                                // Flip last card selected and flip the card opened from history and reset history
                                card.flip();
                                this.cardOpened.flip(() => {
                                    this.cardOpened = undefined;
                                    this.canMove = true;

                                });
                            }

                            // Check if the game is over
                            if (this.lives === 0) {
                                // Show Game Over text
                                this.sound.play("whoosh", { volume: 1 });
                                this.add.tween({
                                    targets: gameOverText,
                                    ease: Phaser.Math.Easing.Bounce.Out,
                                    y: this.sys.game.scale.height / 2,
                                });

                                this.canMove = false;
                            }

                            // Check if the game is won
                            if (this.cards.length === 0) {
                                this.sound.play("whoosh", { volume: 1 });
                                this.sound.play("victory");

                                this.add.tween({
                                    targets: winnerText,
                                    ease: Phaser.Math.Easing.Bounce.Out,
                                    y: this.sys.game.scale.height / 2,
                                });
                                this.canMove = false;
                            }
                        });

                    } else if (this.cardOpened === undefined && this.lives > 0 && this.cards.length > 0) {
                        // If there is not a card opened save the card selected
                        card.flip(() => {
                            this.canMove = true;
                        });
                        this.cardOpened = card;
                    }
                }
            }

        });


        // Text events
        winnerText.on(Phaser.Input.Events.POINTER_OVER, () => {
            winnerText.setColor("#FF7F50");
            this.input.setDefaultCursor("pointer");
        });
        winnerText.on(Phaser.Input.Events.POINTER_OUT, () => {
            winnerText.setColor("#8c7ae6");
            this.input.setDefaultCursor("default");
        });
        winnerText.on(Phaser.Input.Events.POINTER_DOWN, () => {
            this.sound.play("whoosh", { volume: 1 });
            this.add.tween({
                targets: winnerText,
                ease: Phaser.Math.Easing.Bounce.InOut,
                y: -1000,
                onComplete: () => {
                    this.restartGame();
                }
            })
        });

        gameOverText.on(Phaser.Input.Events.POINTER_OVER, () => {
            gameOverText.setColor("#FF7F50");
            this.input.setDefaultCursor("pointer");
        });

        gameOverText.on(Phaser.Input.Events.POINTER_OUT, () => {
            gameOverText.setColor("#8c7ae6");
            this.input.setDefaultCursor("default");
        });

        gameOverText.on(Phaser.Input.Events.POINTER_DOWN, () => {
            this.add.tween({
                targets: gameOverText,
                ease: Phaser.Math.Easing.Bounce.InOut,
                y: -1000,
                onComplete: () => {
                    this.restartGame();
                }
            })
        });
    }

}

const config = {
    title: 'Card Memory Game',
    type: Phaser.AUTO,
    backgroundColor: "#192a56",
    width: 549,
    height: 480,
    parent: "phaser-example",
    render: {
        pixelArt: true,
    },
    scene: [
        Preloader,
        Play
    ]
};

new Phaser.Game(config);