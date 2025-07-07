// Phaser 3 game using Matter.js physics
const config = {
    type: Phaser.AUTO,
    width: 300,
    height: 600,
    backgroundColor: '#000000',
    parent: 'game-container',
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            enableSleep: true,
            debug: false
        }
    }
};

class KickUpScene extends Phaser.Scene {
    preload() {
        this.load.image('ball', 'images/ball_1.png');
        this.load.image('bg', 'images/bg_game.jpg');
    }

    create() {
        // Background
        this.add.image(150, 300, 'bg').setDisplaySize(300, 600);

        // Score text
        this.score = 0;
        this.scoreText = this.add.text(150, 30, 'Score: 0', {
            font: '20px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Feedback text for scoring messages
        this.messages = ['good job', 'keep going', 'crack', 'awesome', 'nice hit'];
        this.messageText = this.add.text(150, 60, '', {
            font: '18px Arial',
            fill: '#ffff00'
        }).setOrigin(0.5);

        // Enable world bounds so the ball bounces on edges
        this.matter.world.setBounds(0, 0, 300, 600);

        // Ball setup
        this.ball = this.matter.add.image(150, 100, 'ball');
        this.ball.setCircle();
        this.ball.setFriction(0.005);
        this.ball.setFrictionAir(0.001);
        this.ball.setBounce(0.7);
        this.ball.setInteractive();
        this.ball.setFixedRotation();

        // Reset score when the ball touches the ground
        this.ball.setOnCollide(data => {
            const bottom = this.matter.world.walls.bottom;
            if (data.bodyA === bottom || data.bodyB === bottom) {
                this.score = 0;
                this.scoreText.setText('Score: 0');
            }
        });

        // On pointer down kick the ball upwards with a small horizontal force
        this.ball.on('pointerdown', pointer => {
            const forceX = (pointer.worldX - this.ball.x) * 0.0005;
            const forceY = -0.045;
            this.ball.applyForce({ x: forceX, y: forceY });
            this.score += 1;
            this.scoreText.setText('Score: ' + this.score);
            const msg = Phaser.Utils.Array.GetRandom(this.messages);
            this.messageText.setText(msg);
            this.tweens.add({
                targets: this.messageText,
                alpha: { from: 1, to: 0 },
                duration: 800,
                onComplete: () => this.messageText.setAlpha(1)
            });
        });
    }
}

new Phaser.Game(Object.assign(config, { scene: KickUpScene }));