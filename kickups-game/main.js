class KickUpScene extends Phaser.Scene {
    preload() {
        this.load.image('ball', 'assets/images/ball_1.png');
        this.load.image('bg', 'assets/images/bg_game.jpg');
        this.load.image('shadow', 'assets/images/shadow.png');
        this.load.image('audio_icon', 'assets/images/audio_icon.png');
        this.load.audio('tap', 'assets/sounds/tap.mp3');
        this.load.audio('reset_kickup', 'assets/sounds/reset_kickup.mp3');
        // Carrusel de publi
        for (let i = 0; i < 4; i++) {
            this.load.image('publi-' + i, `assets/images/publi-${i}.jpg`);
        }
        // Franjas led
        this.load.image('led_banner', 'assets/images/led_banner.png');
    }

    create() {
        // Background
        this.add.image(150, 300, 'bg').setDisplaySize(300, 600);

        // --- Carrusel de imágenes publi ---
        this.publiImages = [];
        for (let i = 0; i < 4; i++) {
            let img = this.add.image(161, 205, 'publi-' + i).setAlpha(i === 0 ? 1 : 0);
            img.setDisplaySize(300, 168); // cubrir área central
            img.setOrigin(0.5, 0.5);
            img.setScale(0.3);
            img.setDepth(0.5); // debajo de balón y demás
            this.publiImages.push(img);
        }
        this.currentPubli = 0;
        this.time.addEvent({
            delay: 3000,
            loop: true,
            callback: () => {
                let prev = this.currentPubli;
                let next = (this.currentPubli + 1) % this.publiImages.length;
                this.tweens.add({
                    targets: this.publiImages[prev],
                    alpha: 0,
                    duration: 700,
                    onComplete: () => {
                        this.publiImages[prev].setAlpha(0);
                    }
                });
                this.tweens.add({
                    targets: this.publiImages[next],
                    alpha: 1,
                    duration: 700,
                    onStart: () => {
                        this.publiImages[next].setAlpha(0);
                    }
                });
                this.currentPubli = next;
            }
        });

        // --- Franjas led tipo marquee ---
        // Arriba
        this.ledTop = this.add.tileSprite(150, 295, 600, 12, 'led_banner').setDepth(2);
        this.ledTop.setScale(0.5); // solo escala vertical
        // Abajo
        this.ledBottom = this.add.tileSprite(150, 357, 600, 12, 'led_banner').setDepth(2);
        this.ledBottom.setScale(0.5);


        // Audio (solo lógica, UI en DOM)
        this.soundOn = true;
        this.sound.mute = false;
        const volumeBtn = document.getElementById('volume-btn');
        const volumeIcon = document.getElementById('volume-icon');
        const setVolumeIcon = (on) => {
            volumeIcon.src = on ? 'assets/images/volume-icon.png' : 'assets/images/volume-icon_off.png';
        };
        setVolumeIcon(true);
        volumeBtn.onclick = () => {
            this.soundOn = !this.soundOn;
            this.sound.mute = !this.soundOn;
            setVolumeIcon(this.soundOn);
        };

        // Shadow
        this.shadow = this.add.image(150, 580, 'shadow').setOrigin(0.5, 0.5);
        this.shadow.setScale(0.6);
        this.shadow.setDepth(4);

        // Score text
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('kickups_highscore') || '0');
        // Sincronizar score y highscore con el DOM
        const scoreValue = document.getElementById('score-value');
        const highScoreValue = document.getElementById('highscore-value');
        scoreValue.textContent = this.score;
        highScoreValue.textContent = this.highScore;

        // Timer en DOM
        this.timeLeft = 60;
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.textContent = 'Tiempo: ' + this.timeLeft;
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeLeft--;
                if (this.timeLeft > 0) {
                    timerDisplay.textContent = 'Tiempo: ' + this.timeLeft;
                } else {
                    timerDisplay.textContent = '¡Tiempo terminado!';
                    this.ball.disableInteractive();
                    this.timerEvent.remove();
                }
            },
            callbackScope: this,
            loop: true
        });

        // Feedback text for scoring messages
        this.messages = ['good job', 'keep going', 'crack', 'awesome', 'nice hit'];
        // Mensaje en la parte inferior, inicia fuera de pantalla derecha
        this.messageText = this.add.text(350, 480, '', {
            font: '20px Arial',
            fill: '#ffff00',
            fontWeight: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.messageText.setAlpha(0);

        // Piso físico estático
        this.floor = this.matter.add.rectangle(150, 595, 300, 10, { isStatic: true, label: 'floor', friction: 0, restitution: 1 });
        // Pared izquierda
        this.leftWall = this.matter.add.rectangle(0, 300, 10, 1200, { isStatic: true, label: 'leftWall', friction: 0, restitution: 0.66 });
        // Pared derecha
        this.rightWall = this.matter.add.rectangle(300, 300, 10, 1200, { isStatic: true, label: 'rightWall', friction: 0, restitution: 0.66 });

        // Ball setup
        this.ball = this.matter.add.image(150, 100, 'ball');
        this.ball.setScale(0.5);
        // Ajustar hitbox al tamaño y escala
        const ballRadius = (this.ball.width * this.ball.scaleX) / 2;
        this.ball.setCircle(ballRadius);

        this.ball.setFriction(0);
        this.ball.setFrictionAir(0.001);
        this.ball.setBounce(0.92);
        this.ball.setInteractive();
        this.ball.setFixedRotation();
        this.ball.setDepth(5);

        // Shadow follows and escala con Y
        this.ballUpdate = () => {
            this.shadow.x = this.ball.x;
            // Escala de la sombra: más grande si el balón está más arriba
            let minY = 100, maxY = 580;
            let minScale = 0.6, maxScale = 1.2;
            let y = Phaser.Math.Clamp(this.ball.y, minY, maxY);
            let scale = Phaser.Math.Linear(maxScale, minScale, (y - minY) / (maxY - minY));
            this.shadow.setScale(scale);
            this.shadow.y = 580;
            // Si el balón está en contacto constante con el piso y está casi quieto, detenerlo completamente
            // Mejor lógica anti-micro-rebote
            if (
                this.isBallOnFloor &&
                Math.abs(this.ball.body.velocity.y) < 0.15 &&
                Math.abs(this.ball.body.velocity.x) < 0.15 &&
                Math.abs(this.ball.body.angularVelocity) < 0.05
            ) {
                this.ball.setVelocity(0, 0);
                this.ball.setAngularVelocity(0);
                // Centrar exactamente sobre el piso para evitar drift
                this.ball.setPosition(this.ball.x, 595 - (this.ball.displayHeight / 2));
                // Quitar rebote para evitar más micro-rebotes
                this.ball.setBounce(0);
            } else if (this.isBallOnFloor && Math.abs(this.ball.body.velocity.y) < 0.3) {
                // Si está en contacto pero aún con algo de rebote, forzar velocidad X=0 y detener rotación si gira muy lento
                this.ball.setVelocityX(0);
                if (Math.abs(this.ball.body.angularVelocity) < 0.03) {
                    this.ball.setAngularVelocity(0);
                }
                // Restaurar rebote para futuros kicks
                this.ball.setBounce(0.92);
            }
        };
        this.events.on('update', this.ballUpdate);

        // Animación de las franjas led tipo marquee
        this.events.on('update', () => {
            if (this.ledTop && this.ledBottom) {
                this.ledTop.tilePositionX += 0.5; // velocidad marquee
                this.ledBottom.tilePositionX -= 0.5;
            }
        });

        // Bandera para saber si el balón está en contacto con el piso
        this.isBallOnFloor = false;
        this.firstContact = true;
        this.ball.setOnCollide((data) => {
            let bodyA = data.bodyA;
            let bodyB = data.bodyB;
            // Revisar si la colisión es con el piso
            if (bodyA.label === 'floor' || bodyB.label === 'floor') {
                this.isBallOnFloor = true;
                if (this.firstContact) {
                    this.sound.play('reset_kickup', { volume: 0.3 });
                    this.ball.setAngularVelocity(0); // Detener rotación al primer contacto
                    this.firstContact = false;
                }
                this.score = 0;
                document.getElementById('score-value').textContent = this.score;
            }
        });
        // Reiniciar bandera cuando NO está en contacto
        this.matter.world.on('collisionactive', (event) => {
            let found = false;
            event.pairs.forEach(pair => {
                if ((pair.bodyA === this.ball.body && pair.bodyB.label === 'floor') ||
                    (pair.bodyB === this.ball.body && pair.bodyA.label === 'floor')) {
                    found = true;
                }
            });
            this.isBallOnFloor = found;
        });
        this.matter.world.on('collisionend', (event) => {
            event.pairs.forEach(pair => {
                if ((pair.bodyA === this.ball.body && pair.bodyB.label === 'floor') ||
                    (pair.bodyB === this.ball.body && pair.bodyA.label === 'floor')) {
                    this.isBallOnFloor = false;
                }
            });
        });

        // On pointer down kick the ball upwards with a small horizontal force
        this.ball.on('pointerdown', pointer => {
        // Restablecer rebote para permitir rebotes normales
        this.ball.setBounce(0.92);
            // Resetear velocidad X/Y para que el kick sea siempre efectivo
            this.ball.setVelocity(0, 0);
            // Calcular dirección: si el click es a la izquierda, fuerza a la derecha (y viceversa)
            const dx = pointer.worldX - this.ball.x;
            const forceX = -Math.sign(dx) * Math.min(Math.abs(dx) * 0.0035, 0.15); // dirección contraria y limitada
            const forceY = -0.17; // fuerza mayor hacia arriba
            this.ball.applyForce({ x: forceX, y: forceY });
            // Aplicar torque (giro) para efecto realista
            this.ball.setAngularVelocity(-forceX * 2);

            this.score += 1;
            document.getElementById('score-value').textContent = this.score;
            // Actualizar high score
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('kickups_highscore', this.highScore);
                document.getElementById('highscore-value').textContent = this.highScore;
            }
            // Animación del mensaje abajo: entra por derecha, sale por izquierda
            const msg = Phaser.Utils.Array.GetRandom(this.messages);
            this.messageText.setText(msg);
            this.messageText.setAlpha(1);
            this.messageText.x = 350; // fuera de pantalla derecha
            this.tweens.killTweensOf(this.messageText);
            this.tweens.add({
                targets: this.messageText,
                x: 150,
                duration: 350,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.time.delayedCall(700, () => {
                        this.tweens.add({
                            targets: this.messageText,
                            x: -50,
                            alpha: 0,
                            duration: 350,
                            ease: 'Cubic.easeIn',
                            onComplete: () => {
                                this.messageText.setAlpha(0);
                                this.messageText.x = 350;
                            }
                        });
                    });
                }
            });
            this.sound.play('tap', { volume: 0.3 });
            this.firstContact = true;
        });
    }
}

