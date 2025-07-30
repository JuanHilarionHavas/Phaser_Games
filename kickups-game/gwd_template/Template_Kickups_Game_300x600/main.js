class KickUpScene extends Phaser.Scene {
    preload() {
        const CFG = window.gwd.GAME_CONFIG;
        // Assets principales
        this.load.image('ball', CFG.assetsBase + CFG.ball.image);
        this.load.image('bg', CFG.assetsBase + CFG.background.image);
        this.load.image('shadow', CFG.assetsBase + CFG.ball.shadow.image);

        this.load.image('volume_icon', CFG.assetsBase + CFG.audio.volumeIcon);
        this.load.image('volume_icon_off', CFG.assetsBase + CFG.audio.volumeIconOff);
        this.load.audio('tap', './tap.mp3');
        this.load.audio('reset_kickup', './reset_kickup.mp3');
        // Carrusel de publi
        CFG.publi.images.forEach((img, i) => {
            this.load.image('publi-' + i, CFG.assetsBase + img.name);
        });
        // Franjas led (soporte para múltiples banners)
        CFG.led_banner.forEach((bannerCfg, i) => {
            this.load.image('led_banner_' + i, CFG.assetsBase + bannerCfg.image);
        });
    }

    create() {
        // Background
        const CFG = window.gwd.GAME_CONFIG;
        this.add.image(CFG.background.size.width/2, CFG.background.size.height/2, 'bg')
            .setDisplaySize(CFG.background.size.width, CFG.background.size.height);

        // --- Carrusel de imágenes publi ---
        this.publiImages = [];
       if (CFG.publi.active !== false) {
         CFG.publi.images.forEach((img, i) => {
           let pub = this.add.image(CFG.publi.position.x, CFG.publi.position.y, 'publi-' + i).setAlpha(i === 0 ? 1 : 0);
           pub.setDisplaySize(CFG.publi.size.width, CFG.publi.size.height);
           pub.setOrigin(0.5, 0.5);
           pub.setScale(CFG.publi.size.scale);
           pub.setDepth(0.5);
           this.publiImages.push(pub);
         });
         this.currentPubli = 0;
         this.time.addEvent({
           delay: CFG.publi.carousel.interval,
           loop: true,
           callback: () => {
             let prev = this.currentPubli;
             let next = (this.currentPubli + 1) % this.publiImages.length;
             this.tweens.add({
               targets: this.publiImages[prev],
               alpha: 0,
               duration: CFG.publi.carousel.fadeDuration,
               onComplete: () => {
                 this.publiImages[prev].setAlpha(0);
               }
             });
             this.tweens.add({
               targets: this.publiImages[next],
               alpha: 1,
               duration: CFG.publi.carousel.fadeDuration,
               onStart: () => {
                 this.publiImages[next].setAlpha(0);
               }
             });
             this.currentPubli = next;
           }
         });
       }
        // --- Franjas led tipo marquee (soporte para múltiples banners) ---
        this.ledBanners = [];
        CFG.led_banner.forEach((bannerCfg, i) => {
          if (bannerCfg.active !== false) {
            const key = 'led_banner_' + i;
            this.load.image(key, CFG.assetsBase + bannerCfg.image); // Preload dinámico si fuera necesario
            const led = this.add.tileSprite(
              bannerCfg.position.x,
              bannerCfg.position.y,
              bannerCfg.size.width,
              bannerCfg.size.height,
              key
            ).setDepth(2);
            led.setScale(bannerCfg.size.scale);
            // Si marqueeSpeed es negativo, la dirección es inversa; si no, usar direction explícito si lo hay
            const direction = (typeof bannerCfg.direction === 'number') ? bannerCfg.direction : (bannerCfg.marqueeSpeed >= 0 ? 1 : -1);
            this.ledBanners.push({ sprite: led, marqueeSpeed: Math.abs(bannerCfg.marqueeSpeed), direction });
          }
        });

      // Audio (solo lógica, UI en DOM)
        this.soundOn = true;
        this.sound.mute = false;
        const volumeBtn = document.querySelector(CFG.ui.volumeBtnSelector);
        const volumeIcon = document.querySelector(CFG.ui.volumeIconSelector);
        const setVolumeIcon = (on) => {
            volumeIcon.children[0].children[0].src = on ? CFG.assetsBase + CFG.audio.volumeIcon : CFG.assetsBase + CFG.audio.volumeIconOff;
        };
        setVolumeIcon(true);
        volumeBtn.onclick = () => {
            this.soundOn = !this.soundOn;
            this.sound.mute = !this.soundOn;
            setVolumeIcon(this.soundOn);
        };

        // Shadow
        this.shadow = this.add.image(CFG.ball.shadow.x, CFG.ball.shadow.y, 'shadow').setOrigin(0.5, 0.5);
        this.shadow.setScale(CFG.ball.shadow.scale);
        this.shadow.setDepth(4);

        // Score text
        this.score = 0;
        this.highScore = 0;
        // Sincronizar score y highscore con el DOM
        const scoreValue = document.querySelector(CFG.ui.scoreSelector);
        const highScoreValue = document.querySelector(CFG.ui.highscoreSelector);
        scoreValue.textContent = this.score;
        highScoreValue.textContent = this.highScore;

        // Timer
        this.timeLeft = CFG.timer.timeLeft; 
        const timerDisplay = document.querySelector(CFG.ui.timerSelector);
        timerDisplay.textContent = this.timeLeft;
        this.timerEvent = this.time.addEvent({
            delay: CFG.timer.delay,
            callback: () => {
                this.timeLeft--;
                if (this.timeLeft > 0) {
                    timerDisplay.textContent = this.timeLeft;
                } else {
                    if (typeof CFG.onGameEnd === 'function') {
                        CFG.onGameEnd.call(this, this.score, this.highScore);
                    }
                }
            },
            callbackScope: this,
            loop: true
        });

        // Feedback text for scoring messages
        this.messages = CFG.messages;
        // Mensaje en la parte inferior, inicia fuera de pantalla derecha
        this.messageText = this.add.text(CFG.messageText.x, CFG.messageText.y, '', {
            font: CFG.messageText.font,
            fill: CFG.messageText.fill,
            fontWeight: CFG.messageText.fontWeight,
            align: CFG.messageText.align
        }).setOrigin(0.5);
        this.messageText.setAlpha(0);

        // Piso físico estático
        this.floor = this.matter.add.rectangle(CFG.background.size.width/2, CFG.floor.y, CFG.background.size.width, CFG.floor.height, { isStatic: true, label: 'floor', friction: CFG.floor.friction, restitution: CFG.floor.restitution });
        // Paredes laterales y suelo
        this.leftWall = this.matter.add.rectangle(-10, CFG.background.size.height/2, 20, CFG.background.size.height*2, { isStatic: true });
        this.rightWall = this.matter.add.rectangle(CFG.background.size.width+10, CFG.background.size.height/2, 20, CFG.background.size.height*2, { isStatic: true });
        this.floorRender = this.add.rectangle(CFG.background.size.width/2, CFG.floor.y, CFG.background.size.width, CFG.floor.height, 0x000000, 0);

        // Ball setup
        this.ball = this.matter.add.image(CFG.ball.position.x, CFG.ball.position.y, 'ball').setCircle();
        this.ball.setScale(CFG.ball.scale);
        // Ajustar hitbox al tamaño y escala
        const ballRadius = (this.ball.width * this.ball.scaleX) / 2;
        this.ball.setCircle(ballRadius);

        this.ball.setFriction(CFG.physics.friction);
        this.ball.setBounce(CFG.physics.restitution);
        this.ball.setDepth(5);

        // Shadow sigue al balón
        this.ball.setInteractive();
        this.ball.setFixedRotation();

        // Shadow follows and escala con Y
        this.ballUpdate = () => {
            this.shadow.x = this.ball.x;
            // Escala de la sombra: ahora fija según CFG.ball.scale
            this.shadow.setScale(CFG.ball.scale);
            this.shadow.y = CFG.ball.shadow.y;
            // Si el balón está en contacto constante con el piso y está casi quieto, detenerlo completamente
            // Mejor lógica anti-micro-rebote
            if (
                this.isBallOnFloor &&
                Math.abs(this.ball.body.velocity.y) < CFG.physics.stopVelocity &&
                Math.abs(this.ball.body.velocity.x) < CFG.physics.stopVelocity &&
                Math.abs(this.ball.body.angularVelocity) < CFG.physics.stopAngularVelocity
            ) {
                this.ball.setVelocity(0, 0);
                this.ball.setAngularVelocity(0);
                // Centrar exactamente sobre el piso para evitar drift
                this.ball.setPosition(this.ball.x, CFG.floor.y - (this.ball.displayHeight / 2));
                // Quitar rebote para evitar más micro-rebotes
                this.ball.setBounce(0);
            } else if (this.isBallOnFloor && Math.abs(this.ball.body.velocity.y) < CFG.physics.stopVelocity) {
                // Si está en contacto pero aún con algo de rebote, forzar velocidad X=0 y detener rotación si gira muy lento
                this.ball.setVelocityX(0);
                if (Math.abs(this.ball.body.angularVelocity) < CFG.physics.stopAngularVelocity) {
                    this.ball.setAngularVelocity(0);
                }
                // Restaurar rebote para futuros kicks
                this.ball.setBounce(CFG.physics.restitution);
            }
        };

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
                    this.sound.play('reset_kickup', { volume: CFG.audio.volume });
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

        // Rebote lateral
        this.matter.world.on('collisionstart', event => {
            event.pairs.forEach(pair => {
                if ((pair.bodyA === this.leftWall && pair.bodyB === this.ball.body) ||
                    (pair.bodyB === this.leftWall && pair.bodyA === this.ball.body)) {
                    this.ball.setVelocityX(Math.abs(this.ball.body.velocity.x) * CFG.physics.wallBounce);
                }
                if ((pair.bodyA === this.rightWall && pair.bodyB === this.ball.body) ||
                    (pair.bodyB === this.rightWall && pair.bodyA === this.ball.body)) {
                    this.ball.setVelocityX(-Math.abs(this.ball.body.velocity.x) * CFG.physics.wallBounce);
                }
            });
        });

        this.ball.on('pointerdown', pointer => {
            this.ball.setBounce(CFG.physics.restitution);
            // Resetear velocidad X/Y para que el kick sea siempre efectivo
            this.ball.setVelocity(0, 0);
            // Calcular dirección: si el click es a la izquierda, fuerza a la derecha (y viceversa)
            const dx = pointer.worldX - this.ball.x;
            const forceX = -Math.sign(dx) * Math.min(Math.abs(dx) * CFG.physics.kick.forceXFactor, CFG.physics.kick.maxForceX); // dirección contraria y limitada
            const forceY = CFG.physics.kick.forceY; // fuerza mayor hacia arriba
            this.ball.applyForce({ x: forceX, y: forceY });
            // Aplicar torque (giro) para efecto realista
            this.ball.setAngularVelocity(-forceX * 2);

            this.score += 1;
            document.querySelector(CFG.ui.scoreSelector).textContent = this.score;
            // Actualizar high score
            if (this.score > this.highScore) {
                this.highScore = this.score;
                document.querySelector(CFG.ui.highscoreSelector).textContent = this.highScore;
            }
            // Animación del mensaje abajo: entra por derecha, sale por izquierda
            const msg = Phaser.Utils.Array.GetRandom(this.messages);
            this.messageText.setText(msg);
            this.messageText.setAlpha(1);
            this.messageText.x = CFG.messageText.x; // fuera de pantalla derecha
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
  
    update(time, delta) {
        this.matter.world.update(time, delta);

        const FIXED_STEP = 1000 / 60;
        let timeBuffer = 0;

        timeBuffer += delta;
        while (timeBuffer >= FIXED_STEP) {
          this.matter.world.step(FIXED_STEP);
          timeBuffer -= FIXED_STEP;
        }

        this.ballUpdate();

        // Movimiento consistente de banners LED tipo marquee usando delta time
        if (this.ledBanners) {
            this.ledBanners.forEach(bannerObj => {
                // marqueeSpeed ahora se interpreta en píxeles/segundo
                bannerObj.sprite.tilePositionX += bannerObj.marqueeSpeed * bannerObj.direction * (delta / 1000);
            });
        }
    }
}

