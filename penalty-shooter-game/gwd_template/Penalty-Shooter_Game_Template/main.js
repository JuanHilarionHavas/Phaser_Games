class PenaltyScene extends Phaser.Scene {

    preload() {
        const CFG = window.gwd.GAME_CONFIG;
        const base = CFG.assetsBase;

        this.load.image('bg', base + CFG.background.image);

        // Balón como spritesheet para animación de rotación
        const bs = CFG.ball.spritesheet;
        this.load.spritesheet('ball', base + CFG.ball.image, {
            frameWidth:  bs.frameWidth,
            frameHeight: bs.frameHeight
        });

        // Arquero: spritesheets (un archivo por animación)
        const ss = CFG.keeper.spritesheets;
        Object.keys(ss).forEach(key => {
            const s = ss[key];
            this.load.spritesheet(key, base + s.file, {
                frameWidth:  s.frameWidth,
                frameHeight: s.frameHeight
            });
        });
    }

    buildKeeperAnims() {
        const CFG = this.CFG;
        const ss = CFG.keeper.spritesheets;

        if (!this.anims.exists('keeper_idle')) {
            this.anims.create({
                key: 'keeper_idle',
                frames: this.anims.generateFrameNumbers('idle', {
                    start: 0, end: ss.idle.frameCount - 1
                }),
                frameRate: CFG.keeper.idleFrameRate,
                repeat: -1
            });
        }

        Object.values(CFG.keeper.zoneAnim).forEach(animKey => {
            if (this.anims.exists(animKey)) return;
            this.anims.create({
                key: animKey,
                frames: this.anims.generateFrameNumbers(animKey, {
                    start: 0, end: ss[animKey].frameCount - 1
                }),
                frameRate: CFG.keeper.diveFrameRate,
                repeat: 0
            });
        });
    }

    buildBallAnim() {
        const bs = this.CFG.ball.spritesheet;
        if (!this.anims.exists('ball_roll')) {
            this.anims.create({
                key: 'ball_roll',
                frames: this.anims.generateFrameNumbers('ball', { start: 0, end: bs.frameCount - 1 }),
                frameRate: this.CFG.ball.rotation.minFrameRate,
                repeat: -1
            });
        }
    }

    create() {
        const CFG = window.gwd.GAME_CONFIG;
        this.CFG = CFG;

        this.buildKeeperAnims();
        this.buildBallAnim();

        // ----- Fondo: asset 300x600 único (arco + estadio + pasto con perspectiva) -----
        const bg = CFG.background;
        this.add.image(bg.displayX, bg.displayY, 'bg')
            .setOrigin(bg.originX, bg.originY)
            .setDisplaySize(bg.displayWidth, bg.displayHeight)
            .setDepth(0);

        // ----- Arquero -----
        this.keeper = this.add.sprite(CFG.keeper.position.x, CFG.keeper.position.y, 'idle', 0)
            .setOrigin(0.5, 1)
            .setScale(CFG.keeper.scale)
            .setDepth(2);
        this.keeper.play('keeper_idle');

        // ----- Motion blur portero: ghost trail (2 copias) -----
        this.keeperGhosts = [];
        const keeperGhostAlphas = [0.2, 0.08];
        for (let i = 0; i < 2; i++) {
            const ghost = this.add.sprite(CFG.keeper.position.x, CFG.keeper.position.y, 'idle', 0)
                .setOrigin(0.5, 1)
                .setScale(CFG.keeper.scale)
                .setAlpha(0)
                .setDepth(1);
            ghost._baseAlpha = keeperGhostAlphas[i];
            this.keeperGhosts.push(ghost);
        }
        this._keeperGhostHistory = [];

        // ----- Balón -----
        this.ball = this.add.sprite(CFG.ball.startPos.x, CFG.ball.startPos.y, 'ball', 0)
            .setOrigin(0.5, 0.5)
            .setScale(CFG.ball.startScale)
            .setDepth(4);

        // ----- Motion blur: ghost trail (3 copias con alpha decreciente) -----
        this.ballGhosts = [];
        const ghostAlphas = [0.25, 0.12, 0.05];
        for (let i = 0; i < 3; i++) {
            const ghost = this.add.sprite(CFG.ball.startPos.x, CFG.ball.startPos.y, 'ball', 0)
                .setOrigin(0.5, 0.5)
                .setScale(CFG.ball.startScale)
                .setAlpha(0)
                .setDepth(3);
            ghost._baseAlpha = ghostAlphas[i];
            this.ballGhosts.push(ghost);
        }
        this._ghostHistory = [];

        // ----- Flecha (DOM): se rota vía CSS transform -----
        this.arrowEl = document.querySelector(CFG.ui.arrowSelector);
        if (this.arrowEl) {
            this.arrowEl.classList.remove('hidden');
            this.arrowEl.style.transform = 'rotate(0deg)';
        }

        // ----- Barra de potencia (segmentada) -----
        this.powerBarFill = this.add.graphics().setDepth(7);
        this.redrawPowerBar(0);

        // ----- DOM refs (botón PATEAR + feedback + UI) -----
        this.feedbackEl = document.querySelector(CFG.ui.feedbackSelector);
        this.kickBtnEl = document.querySelector(CFG.ui.kickBtnSelector);

        // ----- Input del botón PATEAR (DOM) -----
        if (this.kickBtnEl) {
            this.kickBtnEl.textContent = CFG.button.label;
            // Bindeamos listeners al método actual de la escena. El mismo botón puede
            // sobrevivir entre scene.restart(), así que guardamos los handlers para
            // removerlos en shutdown.
            this._kickHandlers = {
                down: () => this.onPress(),
                up: () => this.onRelease(),
                leave: () => this.onRelease(),
                cancel: () => this.onRelease()
            };
            this.kickBtnEl.addEventListener('pointerdown', this._kickHandlers.down);
            this.kickBtnEl.addEventListener('pointerup', this._kickHandlers.up);
            this.kickBtnEl.addEventListener('pointerleave', this._kickHandlers.leave);
            this.kickBtnEl.addEventListener('pointercancel', this._kickHandlers.cancel);
            this.kickBtnEl.disabled = false;
        }
        this.events.once('shutdown', () => {
            if (this.kickBtnEl && this._kickHandlers) {
                this.kickBtnEl.removeEventListener('pointerdown', this._kickHandlers.down);
                this.kickBtnEl.removeEventListener('pointerup', this._kickHandlers.up);
                this.kickBtnEl.removeEventListener('pointerleave', this._kickHandlers.leave);
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

        this.chooseTell();
        this.applyTellShift();

        if (window.resetScoreboard) window.resetScoreboard();

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

        this.createDebug();

        window.__penaltyScene = this;
    }

    // Dibuja ayudas de calibracion (arco logico, cajas de atajada, bandas de altura) si CFG.debug.enabled
    createDebug() {
        const CFG = this.CFG;
        const dbg = CFG.debug;
        if (!dbg || !dbg.enabled) return;
        const g = this.add.graphics().setDepth(30);

        // Arco logico: marco donde el balon cuenta como gol
        if (dbg.showGoalMouth) {
            g.lineStyle(2, 0x33ccff, 0.9);
            g.strokeRect(CFG.goal.mouthLeft, CFG.goal.crossbarY,
                CFG.goal.mouthRight - CFG.goal.mouthLeft, CFG.goal.groundY - CFG.goal.crossbarY);
        }

        // Cajas de atajada de las 6 zonas del arquero (lo que cubre saveRadiusX/Y en cada zona).
        // Son 6 (3 columnas x 2 filas); se solapan por saveRadiusX, por eso se marca el centro + etiqueta.
        if (dbg.showSaveZones) {
            const kh = this.keeper.displayHeight * 0.4; // mismo centro visual que usa determineOutcome
            const rx = CFG.shot.saveRadiusX, ry = CFG.shot.saveRadiusY;
            Object.keys(CFG.keeper.zoneOffsets).forEach((zone) => {
                const off = CFG.keeper.zoneOffsets[zone];
                const kx = CFG.keeper.position.x + off.dx;
                const ky = CFG.keeper.position.y + off.dy - kh;
                const isHigh = zone.indexOf('high') === 0;
                const col = isHigh ? 0xffaa00 : 0x00ddff; // fila alta = naranja, fila baja = cyan
                g.fillStyle(col, 0.06);
                g.fillRect(kx - rx, ky - ry, rx * 2, ry * 2);
                g.lineStyle(1, col, 0.85);
                g.strokeRect(kx - rx, ky - ry, rx * 2, ry * 2);
                g.fillStyle(col, 1);
                g.fillCircle(kx, ky, 3); // centro de la zona: las 6 se ven aunque las cajas se solapen
                this.add.text(kx, ky, zone.replace('-', '\n'), {
                    fontSize: '7px', fontFamily: 'Arial', align: 'center',
                    color: isHigh ? '#ffcc55' : '#66e8ff'
                }).setOrigin(0.5).setDepth(31);
            });
        }

        // Bandas de altura: Y de aterrizaje del balon por potencia (low/mid/high/over)
        if (dbg.showLandingBands) {
            const bands = CFG.shot.landingY;
            Object.keys(bands).forEach((b) => {
                const y = bands[b];
                g.lineStyle(1, 0xff44cc, 0.5);
                g.lineBetween(CFG.goal.mouthLeft, y, CFG.goal.mouthRight, y);
                g.fillStyle(0xff44cc, 0.9);
                [CFG.goal.mouthLeft + 25, 150, CFG.goal.mouthRight - 25].forEach((x) => g.fillCircle(x, y, 3));
            });
        }
    }

    // Elige la zona "tendencia" del arquero para este tiro (el tell)
    chooseTell() {
        const zones = Object.keys(this.CFG.keeper.zoneAnim);
        this.tellZone = Phaser.Utils.Array.GetRandom(zones);
    }

    // Telegrafia visual: el arquero se inclina hacia la columna del tell durante IDLE
    applyTellShift() {
        const CFG = this.CFG;
        if (this._tellTween) { this._tellTween.stop(); this._tellTween = null; }
        if (!CFG.keeper.tellEnabled || !this.tellZone) return;
        const col = this.tellZone.split('-')[1];
        const dir = col === 'left' ? -1 : (col === 'right' ? 1 : 0);
        const targetX = CFG.keeper.position.x + dir * CFG.keeper.tellShiftX;
        this._tellTween = this.tweens.add({ targets: this.keeper, x: targetX, duration: 300, ease: 'Sine.easeOut' });
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

    segmentColor(i, total) {
        // Degradado: verde → amarillo → naranja → rojo
        const t = i / (total - 1);
        let r, g, b;
        if (t < 0.5) {
            // verde (0,204,0) → amarillo (255,220,0)
            const p = t / 0.5;
            r = Math.round(p * 255);
            g = Math.round(204 + p * 16);
            b = 0;
        } else {
            // amarillo (255,220,0) → rojo (255,20,0)
            const p = (t - 0.5) / 0.5;
            r = 255;
            g = Math.round(220 - p * 200);
            b = 0;
        }
        return (r << 16) | (g << 8) | b;
    }

    redrawPowerBar(power) {
        const pb = this.CFG.powerBar;
        const total = pb.segments || 20;
        const gap = pb.segmentGap || 2;
        const segH = (pb.h - gap * (total - 1)) / total;
        const innerW = pb.w - 2;
        const leftX = pb.x - innerW / 2;
        const filledCount = Math.floor((power / 100) * total);

        this.powerBarFill.clear();
        for (let i = 0; i < total; i++) {
            // i=0 es el segmento de arriba (mayor potencia), i=total-1 es el de abajo
            const segY = pb.y + i * (segH + gap);
            const segIndex = total - 1 - i; // invertir para que color verde esté abajo

            if (segIndex < filledCount) {
                this.powerBarFill.fillStyle(this.segmentColor(segIndex, total), 1);
            } else {
                this.powerBarFill.fillStyle(pb.bgColor, 0.6);
            }
            this.powerBarFill.fillRect(leftX, segY, innerW, segH);
        }
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
        let targetX = CFG.background.size.width / 2 + Math.sin(angleRad) * CFG.shot.directionSpreadX;

        // Ángulo extremo → fuera automático (el balón vuela más allá del poste)
        const isWide = Math.abs(this.lockedAngleDeg) >= CFG.shot.wideAngleThresholdDeg;
        if (isWide) {
            targetX = CFG.background.size.width / 2 + Math.sign(this.lockedAngleDeg) * (CFG.background.size.width * 0.62);
        }

        // Potencia → banda y Y de llegada
        const bands = CFG.shot.heightBands;
        const land = CFG.shot.landingY;
        let band, targetY;
        if (isWide) { band = 'wide'; targetY = land.mid; }
        else if (this.power <= bands.lowMax) { band = 'low'; targetY = land.low; }
        else if (this.power <= bands.midMax) { band = 'mid'; targetY = land.mid; }
        else if (this.power <= bands.highMax) { band = 'high'; targetY = land.high; }
        else { band = 'over'; targetY = land.over; }

        // IA del arquero: cumple el tell (zona anticipada) o finta a una zona aleatoria
        const allZones = Object.keys(CFG.keeper.zoneAnim);
        const keeperZone = (CFG.keeper.tellEnabled && Math.random() < CFG.keeper.tellBias)
            ? (this.tellZone || Phaser.Utils.Array.GetRandom(allZones))
            : Phaser.Utils.Array.GetRandom(allZones);
        this.keeperZone = keeperZone;

        // Ocultar flecha DOM
        if (this.arrowEl) this.arrowEl.classList.add('hidden');

        // ===== EFECTO SQUASH AL PATEAR =====
        const squashDur = 50;
        this.tweens.add({
            targets: this.ball,
            scaleX: CFG.ball.startScale * 1.35,
            scaleY: CFG.ball.startScale * 0.65,
            duration: squashDur,
            ease: 'Quad.easeOut',
            yoyo: true,
            onComplete: () => this._launchBall(CFG, targetX, targetY, band, keeperZone, isWide)
        });
    }

    _launchBall(CFG, targetX, targetY, band, keeperZone, isWide) {
        const flightMs = CFG.shot.flightDurationMs;

        // Clavada del arquero al diveTimingPct del vuelo
        this.time.delayedCall(flightMs * CFG.keeper.diveTimingPct, () => {
            this.animateKeeperDive(keeperZone);
        });

        const startX = this.ball.x;
        const startY = this.ball.y;

        // Altura del arco parabólico según banda
        const arcMap = { low: 15, mid: 35, high: 55, over: 70, wide: 30 };
        const arcHeight = arcMap[band] || 30;

        // Inicializar historial de ghost trail
        this._ghostHistory = [];

        const proxy = { t: 0 };
        this.tweens.add({
            targets: proxy,
            t: 1,
            duration: flightMs,
            ease: CFG.ball.flightEase,
            onUpdate: () => {
                const t = proxy.t;
                const linearX = startX + (targetX - startX) * t;
                const linearY = startY + (targetY - startY) * t;
                // Arco parabólico: sube y baja con seno
                const arc = Math.sin(t * Math.PI) * arcHeight;

                // Guardar posición anterior para ghosts
                this._ghostHistory.unshift({ x: this.ball.x, y: this.ball.y, scaleX: this.ball.scaleX, scaleY: this.ball.scaleY });
                if (this._ghostHistory.length > 4) this._ghostHistory.pop();

                this.ball.x = linearX;
                this.ball.y = linearY - arc;

                // Stretch dinámico: estira el balón en dirección del movimiento
                const speed = t < 0.8 ? (1 - t) : 0.2;
                const stretchFactor = 1 + speed * 0.2;
                const baseScale = CFG.ball.startScale + (CFG.ball.endScale - CFG.ball.startScale) * t;
                this.ball.setScale(baseScale * (1 / stretchFactor), baseScale * stretchFactor);

                // Actualizar ghost trail
                this.ballGhosts.forEach((ghost, i) => {
                    const hist = this._ghostHistory[i + 1];
                    if (hist) {
                        ghost.setPosition(hist.x, hist.y);
                        ghost.setScale(hist.scaleX, hist.scaleY);
                        ghost.setAlpha(ghost._baseAlpha * (1 - t * 0.7));
                        ghost.setFrame(this.ball.frame.name);
                    }
                });
            },
            onComplete: () => {
                this.ball.setPosition(targetX, targetY);
                this.ball.setScale(CFG.ball.endScale);
                // Ocultar ghosts
                this.ballGhosts.forEach(g => g.setAlpha(0));
                this._ghostHistory = [];
                this.resolveShot(targetX, targetY, band, keeperZone);
            }
        });

        // ===== ROTACIÓN CON DESACELERACIÓN =====
        const rot = CFG.ball.rotation;
        const powerT = isWide ? 0.5 : (this.power / 100);
        const ballFrameRate = Math.round(rot.minFrameRate + powerT * (rot.maxFrameRate - rot.minFrameRate));
        this.ball.play({ key: 'ball_roll', frameRate: ballFrameRate, repeat: -1 });

        // Desacelerar rotación en el último 40% del vuelo
        this.time.delayedCall(flightMs * 0.6, () => {
            this.tweens.add({
                targets: this.ball.anims,
                timeScale: 0.15,
                duration: flightMs * 0.4,
                ease: 'Sine.easeIn'
            });
        });
    }

    animateKeeperDive(zone) {
        const CFG = this.CFG;
        if (this._tellTween) { this._tellTween.stop(); this._tellTween = null; }
        this.keeper.x = CFG.keeper.position.x; // anular el tell shift: el dive parte del centro logico
        const anim = CFG.keeper.zoneAnim[zone];
        const offset = CFG.keeper.zoneOffsets[zone];
        const targetX = CFG.keeper.position.x + offset.dx;
        const targetY = CFG.keeper.position.y + offset.dy;
        const preShift = CFG.keeper.preShiftX || 0;
        const preShiftMs = CFG.keeper.preShiftDurationMs || 150;

        // Iniciar ghost trail del portero
        this._keeperGhostHistory = [];

        // Rotación según zona: laterales se inclinan, centro no rota
        const [row, col] = zone.split('-');
        let targetAngle = 0;
        if (col === 'left') targetAngle = row === 'high' ? -35 : -15;
        else if (col === 'right') targetAngle = row === 'high' ? 35 : 15;
        const targetRad = Phaser.Math.DegToRad(targetAngle);

        const isHighLateral = row === 'high' && col !== 'center';
        const diveDur = CFG.keeper.diveDuration;

        const updateGhosts = () => {
            this._keeperGhostHistory.unshift({
                x: this.keeper.x,
                y: this.keeper.y,
                rotation: this.keeper.rotation,
                frame: this.keeper.frame.name,
                texture: this.keeper.texture.key
            });
            if (this._keeperGhostHistory.length > 3) this._keeperGhostHistory.pop();

            this.keeperGhosts.forEach((ghost, i) => {
                const hist = this._keeperGhostHistory[i + 1];
                if (hist) {
                    ghost.setPosition(hist.x, hist.y);
                    ghost.setRotation(hist.rotation);
                    ghost.setTexture(hist.texture, hist.frame);
                    ghost.setScale(CFG.keeper.scale);
                    ghost.setAlpha(ghost._baseAlpha);
                }
            });
        };

        const fadeOutGhosts = () => {
            this.keeperGhosts.forEach(g => {
                this.tweens.add({ targets: g, alpha: 0, duration: 150 });
            });
            this._keeperGhostHistory = [];
        };

        const startDive = () => {
            this.keeper.play(anim);
            const diveStartX = this.keeper.x;
            const diveStartY = this.keeper.y;

            if (isHighLateral) {
                // Fase 1: salto + rotación (sin X)
                const jumpPct = CFG.keeper.highJumpPct || 0.45;
                const jumpDur = diveDur * jumpPct;
                const proxy1 = { t: 0 };
                this.tweens.add({
                    targets: proxy1,
                    t: 1,
                    duration: jumpDur,
                    ease: 'Sine.easeOut',
                    onUpdate: () => {
                        updateGhosts();
                        this.keeper.y = diveStartY + (targetY - diveStartY) * proxy1.t;
                        this.keeper.rotation = targetRad * proxy1.t;
                    },
                    onComplete: () => {
                        // Fase 2: desplazamiento X en el aire
                        const airStartX = this.keeper.x;
                        const proxy2 = { t: 0 };
                        this.tweens.add({
                            targets: proxy2,
                            t: 1,
                            duration: diveDur * (1 - jumpPct),
                            ease: 'Power2',
                            onUpdate: () => {
                                updateGhosts();
                                this.keeper.x = airStartX + (targetX - airStartX) * proxy2.t;
                            },
                            onComplete: () => {
                                this.keeper.setPosition(targetX, targetY);
                                this.keeper.rotation = targetRad;
                                fadeOutGhosts();
                            }
                        });
                    }
                });
            } else {
                // Bajos y centro: movimiento simultáneo (como antes)
                const proxy = { t: 0 };
                this.tweens.add({
                    targets: proxy,
                    t: 1,
                    duration: diveDur,
                    ease: 'Power2',
                    onUpdate: () => {
                        updateGhosts();
                        this.keeper.x = diveStartX + (targetX - diveStartX) * proxy.t;
                        this.keeper.y = diveStartY + (targetY - diveStartY) * proxy.t;
                        this.keeper.rotation = targetRad * proxy.t;
                    },
                    onComplete: () => {
                        this.keeper.setPosition(targetX, targetY);
                        this.keeper.rotation = targetRad;
                        fadeOutGhosts();
                    }
                });
            }
        };

        if (preShift > 0) {
            const shiftDir = Math.sign(offset.dx) || 0;
            const preX = CFG.keeper.position.x + shiftDir * preShift;

            this.tweens.add({
                targets: this.keeper,
                x: preX,
                duration: preShiftMs,
                ease: 'Sine.easeOut',
                onComplete: startDive
            });
        } else {
            startDive();
        }
    }

    resolveShot(targetX, targetY, band, keeperZone) {
        const CFG = this.CFG;
        this.ball.anims.timeScale = 1;
        this.ball.stop();

        const outcome = this.determineOutcome(targetX, targetY, band);

        // Marcar la casilla del tiro actual en el marcador (gol = Z amarilla, resto = Z roja)
        if (window.markScoreboard) window.markScoreboard(this.shotsTaken, outcome === 'goal');

        if (outcome === 'goal') {
            this.score += 1;
            this.spawnGoalParticles(targetX, targetY);
        }
        this.showFeedbackDOM(CFG.messages[outcome], outcome);

        this.state = 'RESOLVING';
        this.time.delayedCall(900, () => this.nextShot());
    }

    spawnGoalParticles(x, y) {
        const colors = [0x00ff88, 0xe6ff00, 0xff4444, 0x44aaff, 0xffffff, 0xff9900];
        const count = 24;

        for (let i = 0; i < count; i++) {
            const color = Phaser.Utils.Array.GetRandom(colors);
            const size = Phaser.Math.Between(3, 7);
            const particle = this.add.rectangle(x, y, size, size, color)
                .setDepth(10)
                .setAlpha(1);

            // Dirección aleatoria en abanico hacia abajo (simula caída de confetti)
            const angle = Phaser.Math.FloatBetween(-Math.PI * 0.8, -Math.PI * 0.2);
            const speed = Phaser.Math.Between(80, 220);
            const endX = x + Math.cos(angle) * speed;
            const endY = y + Math.sin(angle) * speed;
            const drift = Phaser.Math.FloatBetween(-30, 30);

            // Vuelo + caída con gravedad simulada
            this.tweens.add({
                targets: particle,
                x: endX + drift,
                y: endY + Phaser.Math.Between(60, 140),
                rotation: Phaser.Math.FloatBetween(-4, 4),
                scaleX: { from: 1, to: Phaser.Math.FloatBetween(0.3, 0.8) },
                scaleY: { from: 1, to: Phaser.Math.FloatBetween(0.2, 0.5) },
                alpha: { from: 1, to: 0 },
                duration: Phaser.Math.Between(600, 1000),
                ease: 'Quad.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    determineOutcome(x, y, band) {
        const CFG = this.CFG;

        // Fuera del arco → miss
        const tol = 8;
        const outsideX = x < CFG.goal.mouthLeft - tol || x > CFG.goal.mouthRight + tol;
        const outsideY = y < CFG.goal.crossbarY - tol || y > CFG.goal.groundY + tol;
        if (band === 'wide' || band === 'over' || outsideX || outsideY) return 'miss';

        // Atajada basada en distancia real entre portero y balón
        const kx = this.keeper.x;
        const ky = this.keeper.y - (this.keeper.displayHeight * 0.4); // centro visual del sprite
        const dx = Math.abs(x - kx);
        const dy = Math.abs(y - ky);
        const saveRX = CFG.shot.saveRadiusX || 35;
        const saveRY = CFG.shot.saveRadiusY || 30;

        if (dx < saveRX && dy < saveRY) return 'save';

        return 'goal';
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
            targets: this.ball,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                this.ball.setPosition(CFG.ball.startPos.x, CFG.ball.startPos.y)
                    .setScale(CFG.ball.startScale)
                    .setFrame(0);
                this.ball.anims.timeScale = 1;
                // Resetear ghosts
                this.ballGhosts.forEach(g => {
                    g.setPosition(CFG.ball.startPos.x, CFG.ball.startPos.y);
                    g.setAlpha(0);
                    g.setScale(CFG.ball.startScale);
                });
                this._ghostHistory = [];

                // Arquero: fade out → reposicionar al centro → fade in
                this.keeperGhosts.forEach(g => g.setAlpha(0));
                this._keeperGhostHistory = [];
                this.keeperZone = null;

                this.tweens.add({
                    targets: this.keeper,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        this.keeper.setPosition(CFG.keeper.position.x, CFG.keeper.position.y);
                        this.keeper.setRotation(0);
                        this.keeper.play('keeper_idle');
                        this.chooseTell();
                        this.applyTellShift();
                        this.tweens.add({
                            targets: this.keeper,
                            alpha: 1,
                            duration: 200
                        });
                    }
                });

                this.power = 0;
                this.redrawPowerBar(0);
                this.arrowElapsedMs = 0;
                if (this.arrowEl) {
                    this.arrowEl.style.transform = 'rotate(0deg)';
                    this.arrowEl.classList.remove('hidden');
                }

                this.tweens.add({ targets: this.ball, alpha: 1, duration: 200 });

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

}
