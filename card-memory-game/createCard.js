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
