class PenaltyScene extends Phaser.Scene {

    preload() {
        const CFG = window.GAME_CONFIG;
        const base = CFG.assetsBase;

        this.load.image('bg',     base + CFG.background.image);
        this.load.image('ball',   base + CFG.ball.image);
        this.load.image('shadow', base + CFG.ball.shadow);

        // Arquero: idle + 6 zonas de clavada
        for (let i = 0; i < CFG.keeper.idleFrames; i++) {
            this.load.image('gk_idle_' + i, base + 'gk_idle/' + i + '.png');
        }
        Object.values(CFG.keeper.zoneAnim).forEach(animKey => {
            for (let i = 0; i < CFG.keeper.diveFrames; i++) {
                this.load.image(animKey + '_' + i, base + animKey + '/' + i + '.png');
            }
        });
    }

    buildKeeperAnims() {
        const CFG = this.CFG;
        const idleFrames = [];
        for (let i = 0; i < CFG.keeper.idleFrames; i++) {
            idleFrames.push({ key: 'gk_idle_' + i });
        }
        if (!this.anims.exists('keeper_idle')) {
            this.anims.create({
                key: 'keeper_idle',
                frames: idleFrames,
                frameRate: CFG.keeper.idleFrameRate,
                repeat: -1
            });
        }
        Object.values(CFG.keeper.zoneAnim).forEach(animKey => {
            if (this.anims.exists(animKey)) return;
            const diveFrames = [];
            for (let i = 0; i < CFG.keeper.diveFrames; i++) {
                diveFrames.push({ key: animKey + '_' + i });
            }
            this.anims.create({
                key: animKey,
                frames: diveFrames,
                frameRate: CFG.keeper.diveFrameRate,
                repeat: 0
            });
        });
    }

    create() {
        const CFG = window.GAME_CONFIG;
        this.CFG = CFG;

        this.buildKeeperAnims();

        // ----- Fondo: asset 300x600 único (arco + estadio + pasto con perspectiva) -----
        const bg = CFG.background;
        this.add.image(bg.displayX, bg.displayY, 'bg')
            .setOrigin(bg.originX, bg.originY)
            .setDisplaySize(bg.displayWidth, bg.displayHeight)
            .setDepth(0);

        // ----- Arquero -----
        this.keeper = this.add.sprite(CFG.keeper.position.x, CFG.keeper.position.y, 'gk_idle_0')
            .setOrigin(0.5, 1)
            .setScale(CFG.keeper.scale)
            .setDepth(2);
        this.keeper.play('keeper_idle');

        // ----- Sombra + balón -----
        this.ballShadow = this.add.image(
            CFG.ball.startPos.x,
            CFG.ball.startPos.y + CFG.ball.shadowYOffset,
            'shadow'
        )
            .setScale(CFG.ball.shadowScale)
            .setAlpha(0.55)
            .setDepth(3);

        this.ball = this.add.image(CFG.ball.startPos.x, CFG.ball.startPos.y, 'ball')
            .setOrigin(0.5, 0.5)
            .setScale(CFG.ball.startScale)
            .setDepth(4);

        // ----- Flecha (DOM): se rota vía CSS transform -----
        this.arrowEl = document.querySelector(CFG.ui.arrowSelector);
        if (this.arrowEl) {
            this.arrowEl.classList.remove('hidden');
            this.arrowEl.style.transform = 'rotate(0deg)';
        }

        // ----- Barra de potencia -----
        const pb = CFG.powerBar;
        this.powerBarBg = this.add.rectangle(pb.x, pb.y + pb.h / 2, pb.w, pb.h, pb.bgColor)
            .setStrokeStyle(1, pb.borderColor)
            .setDepth(6);
        this.powerBarFill = this.add.graphics().setDepth(7);
        this.redrawPowerBar(0);

        // ----- DOM refs (botón PATEAR + feedback + UI) -----
        this.feedbackEl    = document.querySelector(CFG.ui.feedbackSelector);
        this.shotCounterEl = document.querySelector(CFG.ui.shotCounterSelector);
        this.scoreEl       = document.querySelector(CFG.ui.scoreSelector);
        this.kickBtnEl     = document.querySelector(CFG.ui.kickBtnSelector);

        // ----- Input del botón PATEAR (DOM) -----
        if (this.kickBtnEl) {
            this.kickBtnEl.textContent = CFG.button.label;
            // Bindeamos listeners al método actual de la escena. El mismo botón puede
            // sobrevivir entre scene.restart(), así que guardamos los handlers para
            // removerlos en shutdown.
            this._kickHandlers = {
                down:   () => this.onPress(),
                up:     () => this.onRelease(),
                leave:  () => this.onRelease(),
                cancel: () => this.onRelease()
            };
            this.kickBtnEl.addEventListener('pointerdown',   this._kickHandlers.down);
            this.kickBtnEl.addEventListener('pointerup',     this._kickHandlers.up);
            this.kickBtnEl.addEventListener('pointerleave',  this._kickHandlers.leave);
            this.kickBtnEl.addEventListener('pointercancel', this._kickHandlers.cancel);
            this.kickBtnEl.disabled = false;
        }
        this.events.on('shutdown', () => {
            if (this.kickBtnEl && this._kickHandlers) {
                this.kickBtnEl.removeEventListener('pointerdown',   this._kickHandlers.down);
                this.kickBtnEl.removeEventListener('pointerup',     this._kickHandlers.up);
                this.kickBtnEl.removeEventListener('pointerleave',  this._kickHandlers.leave);
                this.kickBtnEl.removeEventListener('pointercancel', this._kickHandlers.cancel);
            }
        });

        // ----- Estado inicial -----
        this.state = 'IDLE';
        this.shotsTaken = 0;
        this.score = 0;
        this.arrowAngleDeg = 0;
        this.arrowElapsedMs = 0;
        this.lockedAngleDeg = 0;
        this.power = 0;
        this.chargeStartTime = 0;
        this.keeperZone = null;

        this.updateShotCounterDOM();
        this.updateScoreDOM();

        // ----- Handler JUGAR DE NUEVO -----
        const restartBtn = document.querySelector(CFG.ui.endRestartSelector);
        const endOverlay = document.querySelector(CFG.ui.endOverlaySelector);
        if (restartBtn && !restartBtn._penaltyHooked) {
            restartBtn._penaltyHooked = true;
            restartBtn.addEventListener('click', () => {
                if (endOverlay) endOverlay.style.display = 'none';
                if (this.feedbackEl) this.feedbackEl.classList.remove('visible');
                this.scene.restart();
            });
        }

        window.__penaltyScene = this;
    }

    update(time, delta) {
        const CFG = this.CFG;
        if (this.state === 'IDLE') {
            this.arrowElapsedMs += delta;
            const period = CFG.arrow.sweepHalfPeriodMs * 2;
            const t = (this.arrowElapsedMs % period) / period;
            this.arrowAngleDeg = CFG.arrow.angleRangeDeg * Math.sin(t * Math.PI * 2);
            if (this.arrowEl) {
                this.arrowEl.style.transform = 'rotate(' + this.arrowAngleDeg + 'deg)';
            }
        } else if (this.state === 'CHARGING') {
            this.power = Math.min(100, (time - this.chargeStartTime) * CFG.powerBar.chargeRatePerMs);
            this.redrawPowerBar(this.power);
            if (this.power >= 100) this.executeShot();
        }
    }

    onPress() {
        if (this.state !== 'IDLE') return;
        this.state = 'CHARGING';
        this.lockedAngleDeg = this.arrowAngleDeg;
        this.chargeStartTime = this.time.now;
        this.power = 0;
        if (this.kickBtnEl) this.kickBtnEl.classList.add('pressed');
    }

    onRelease() {
        if (this.state !== 'CHARGING') return;
        if (this.kickBtnEl) this.kickBtnEl.classList.remove('pressed');
        this.executeShot();
    }

    redrawPowerBar(power) {
        const pb = this.CFG.powerBar;
        const bands = this.CFG.shot.heightBands;
        const fillH = (power / 100) * pb.h;
        let color = pb.fillLowColor;
        if (power > bands.highMax)      color = pb.fillOverColor;
        else if (power > bands.midMax)  color = pb.fillHighColor;
        else if (power > bands.lowMax)  color = pb.fillMidColor;

        const innerW = pb.w - 4;
        const topY = pb.y + pb.h - fillH;
        const leftX = pb.x - innerW / 2;
        this.powerBarFill.clear();
        if (fillH > 0) {
            this.powerBarFill.fillStyle(color, 1);
            this.powerBarFill.fillRect(leftX, topY, innerW, fillH);
        }
    }

    // Devuelve la zona {row,col} en la que cae el balón
    ballZone(x, y) {
        const CFG = this.CFG;
        const W = CFG.goal.mouthRight - CFG.goal.mouthLeft;
        let col;
        if (x < CFG.goal.mouthLeft + W / 3)        col = 'left';
        else if (x > CFG.goal.mouthRight - W / 3)  col = 'right';
        else                                       col = 'center';
        const row = (y < CFG.shot.highLowThresholdY) ? 'high' : 'low';
        return row + '-' + col;
    }

    executeShot() {
        const CFG = this.CFG;
        this.state = 'SHOOTING';
        if (this.kickBtnEl) {
            this.kickBtnEl.disabled = true;
            this.kickBtnEl.classList.remove('pressed');
        }

        // Dirección → X de llegada
        const angleRad = this.lockedAngleDeg * Math.PI / 180;
        const targetX = CFG.background.size.width / 2 + Math.sin(angleRad) * CFG.shot.directionSpreadX;

        // Potencia → banda y Y de llegada
        const bands = CFG.shot.heightBands;
        const land = CFG.shot.landingY;
        let band, targetY;
        if (this.power <= bands.lowMax)       { band = 'low';  targetY = land.low; }
        else if (this.power <= bands.midMax)  { band = 'mid';  targetY = land.mid; }
        else if (this.power <= bands.highMax) { band = 'high'; targetY = land.high; }
        else                                  { band = 'over'; targetY = land.over; }

        // Zona del balón (salvo que vaya fuera del arco/por encima del travesaño)
        const realBallZone = this.ballZone(targetX, targetY);

        // IA del arquero: con aiBias, acierta la zona real del balón; sino elige
        // una zona al azar (excluyendo over/miss).
        const allZones = Object.keys(CFG.keeper.zoneAnim);
        const keeperZone = (Math.random() < CFG.keeper.aiBias)
            ? realBallZone
            : Phaser.Utils.Array.GetRandom(allZones);
        this.keeperZone = keeperZone;

        // Clavada al diveTimingPct del vuelo
        this.time.delayedCall(CFG.shot.flightDurationMs * CFG.keeper.diveTimingPct, () => {
            this.animateKeeperDive(keeperZone);
        });

        // Tween del balón: x/y con easeOut (llega rápido y desacelera),
        // escala con easeIn (se achica más al final → efecto de lejanía acentuado)
        this.tweens.add({
            targets: this.ball,
            x: targetX,
            y: targetY,
            duration: CFG.shot.flightDurationMs,
            ease: 'Cubic.easeOut',
            onComplete: () => this.resolveShot(targetX, targetY, band, keeperZone)
        });
        this.tweens.add({
            targets: this.ball,
            scaleX: CFG.ball.endScale,
            scaleY: CFG.ball.endScale,
            duration: CFG.shot.flightDurationMs,
            ease: 'Sine.easeIn'
        });

        // Sombra: queda en el piso, se achica y se desvanece progresivamente
        const shadowGroundY = CFG.ball.startPos.y + CFG.ball.shadowYOffset;
        this.tweens.add({
            targets: this.ballShadow,
            x: targetX,
            y: shadowGroundY,
            duration: CFG.shot.flightDurationMs,
            ease: 'Cubic.easeOut'
        });
        this.tweens.add({
            targets: this.ballShadow,
            scaleX: CFG.ball.endScale * 0.55,
            scaleY: CFG.ball.endScale * 0.55,
            alpha: 0.15,
            duration: CFG.shot.flightDurationMs,
            ease: 'Sine.easeIn'
        });

        // Ocultar flecha DOM durante el vuelo
        if (this.arrowEl) this.arrowEl.classList.add('hidden');
    }

    animateKeeperDive(zone) {
        const CFG = this.CFG;
        const anim = CFG.keeper.zoneAnim[zone];
        const off = CFG.keeper.zoneOffsets[zone];
        const targetX = CFG.keeper.position.x + off.dx;
        const targetY = CFG.keeper.position.y + off.dy;
        this.keeperFinalX = targetX;
        this.keeperFinalY = targetY;

        this.keeper.play(anim);
        this.tweens.add({
            targets: this.keeper,
            x: targetX,
            y: targetY,
            duration: CFG.keeper.diveDuration,
            ease: 'Cubic.easeOut'
        });
    }

    resolveShot(targetX, targetY, band, keeperZone) {
        const CFG = this.CFG;
        const outcome = this.determineOutcome(targetX, targetY, band, keeperZone);

        if (outcome === 'goal') this.score += 1;
        this.updateScoreDOM();
        this.showFeedbackDOM(CFG.messages[outcome], outcome);

        this.state = 'RESOLVING';
        this.time.delayedCall(900, () => this.nextShot());
    }

    determineOutcome(x, y, band, keeperZone) {
        const CFG = this.CFG;

        // Validación del arco: el balón debe caer DENTRO del rectángulo del arco
        // (horizontal: mouthLeft..mouthRight, vertical: crossbarY..groundY).
        // Tolerancia de 8px en los bordes para que un tiro al palo cuente como adentro.
        const tol = 8;
        const outsideX = x < CFG.goal.mouthLeft - tol || x > CFG.goal.mouthRight + tol;
        const outsideY = y < CFG.goal.crossbarY - tol || y > CFG.goal.groundY + tol;
        if (band === 'over' || outsideX || outsideY) return 'miss';

        // Atajada: sólo si el arquero eligió la MISMA fila (high/low) que el balón
        // Y además: misma columna exacta, o columna adyacente + arquero físicamente cerca
        const ballZone = this.ballZone(x, y);
        const [kRow, kCol] = keeperZone.split('-');
        const [bRow, bCol] = ballZone.split('-');

        // Si el arquero está en la fila equivocada (ej: eligió low y el balón fue high)
        // NO puede atajar, incluso si la X coincide.
        if (kRow !== bRow) return 'goal';

        // Misma fila + misma columna → save seguro
        if (kCol === bCol) return 'save';

        // Misma fila + columna adyacente: save sólo si el arquero quedó cerca en X
        if (this.columnsAdjacent(kCol, bCol)) {
            const kx = CFG.keeper.position.x + CFG.keeper.zoneOffsets[keeperZone].dx;
            if (Math.abs(x - kx) < CFG.shot.saveRadiusX) return 'save';
        }

        return 'goal';
    }

    columnsAdjacent(a, b) {
        const order = { left: 0, center: 1, right: 2 };
        return Math.abs(order[a] - order[b]) === 1;
    }

    showFeedbackDOM(msg, outcome) {
        if (!this.feedbackEl) return;
        this.feedbackEl.textContent = msg;
        this.feedbackEl.className = 'visible ' + outcome;
        clearTimeout(this._fbTimeout);
        this._fbTimeout = setTimeout(() => {
            if (this.feedbackEl) this.feedbackEl.classList.remove('visible');
        }, this.CFG.messageDurationMs);
    }

    nextShot() {
        this.shotsTaken += 1;
        if (this.shotsTaken >= this.CFG.shot.totalShots) {
            this.gameOver();
        } else {
            this.resetShot();
        }
    }

    resetShot() {
        const CFG = this.CFG;
        this.state = 'RESETTING';

        this.tweens.add({
            targets: [this.ball, this.ballShadow],
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.ball.setPosition(CFG.ball.startPos.x, CFG.ball.startPos.y)
                    .setScale(CFG.ball.startScale);
                this.ballShadow.setPosition(CFG.ball.startPos.x, CFG.ball.startPos.y + CFG.ball.shadowYOffset)
                    .setScale(CFG.ball.shadowScale);

                // Arquero vuelve a idle en su posición original
                this.keeper.setPosition(CFG.keeper.position.x, CFG.keeper.position.y);
                this.keeper.play('keeper_idle');
                this.keeperFinalX = CFG.keeper.position.x;
                this.keeperFinalY = CFG.keeper.position.y;
                this.keeperZone = null;

                this.power = 0;
                this.redrawPowerBar(0);
                this.arrowElapsedMs = 0;
                if (this.arrowEl) {
                    this.arrowEl.style.transform = 'rotate(0deg)';
                    this.arrowEl.classList.remove('hidden');
                }

                this.tweens.add({ targets: this.ball,       alpha: 1,    duration: 200 });
                this.tweens.add({ targets: this.ballShadow, alpha: 0.55, duration: 200 });

                this.updateShotCounterDOM();

                this.time.delayedCall(250, () => {
                    if (this.kickBtnEl) this.kickBtnEl.disabled = false;
                    this.state = 'IDLE';
                });
            }
        });
    }

    gameOver() {
        this.state = 'GAME_OVER';
        if (this.kickBtnEl) this.kickBtnEl.disabled = true;
        if (typeof this.CFG.onGameEnd === 'function') {
            this.CFG.onGameEnd.call(this, this.score, this.CFG.shot.totalShots);
        }
    }

    updateShotCounterDOM() {
        if (!this.shotCounterEl) return;
        const current = Math.min(this.shotsTaken + 1, this.CFG.shot.totalShots);
        this.shotCounterEl.textContent = current + '/' + this.CFG.shot.totalShots;
    }

    updateScoreDOM() {
        if (this.scoreEl) this.scoreEl.textContent = this.score;
    }
}
