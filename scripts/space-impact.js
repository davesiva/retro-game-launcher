class SpaceImpactGame {
    constructor(canvasId, callbacks) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.callbacks = callbacks || {};

        // Game State
        this.isActive = false;
        this.isPaused = false;
        this.score = 0;
        this.lives = 3;
        this.killedCount = 0;
        this.phase = 'patrol';
        this.lastTime = 0;
        this.animationFrameId = null;

        // Entities
        this.player = {
            x: 20,
            y: this.canvas.height / 2,
            width: 25,
            height: 12,
            speed: 3
        };

        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.debris = [];
        this.terrain = [];

        this.lastFireTime = 0;
        this.fireRate = 250;

        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2000;

        this.terrainSpawnTimer = 0;
        this.terrainSpawnRate = 1200;

        this.boss = null;

        // Inputs
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false
        };

        this.bindEvents();
        this.bindTouchControls();
    }

    bindEvents() {
        const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape', 'Enter'];

        this.handleKeyDown = (e) => {
            if (!this.isActive) return;
            if (gameKeys.includes(e.code)) {
                e.preventDefault();
                if (e.code === 'Space' || e.code === 'Enter') this.togglePause();
                else if (e.code === 'Escape') this.callbacks.onGameExit();
                else this.keys[e.code] = true;
            }
        };

        this.handleKeyUp = (e) => {
            if (!this.isActive) return;
            if (gameKeys.includes(e.code)) {
                e.preventDefault();
                this.keys[e.code] = false;
            }
        };

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    bindTouchControls() {
        const touchMap = {
            'btn-up': 'ArrowUp',
            'btn-down': 'ArrowDown',
            'btn-left': 'ArrowLeft',
            'btn-right': 'ArrowRight'
        };

        for (const [id, key] of Object.entries(touchMap)) {
            const btn = document.getElementById(id);
            if (btn) {
                btn.ontouchstart = null;
                btn.ontouchend = null;
                btn.onmousedown = null;
                btn.onmouseup = null;
                btn.onclick = null;

                const start = (e) => {
                    if (e.cancelable) e.preventDefault();
                    this.keys[key] = true;
                };
                const end = (e) => {
                    if (e.cancelable) e.preventDefault();
                    this.keys[key] = false;
                };

                btn.ontouchstart = start;
                btn.ontouchend = end;
                btn.onmousedown = start;
                btn.onmouseup = end;
            }
        }

        const btnPause = document.getElementById('btn-pause');
        if (btnPause) btnPause.onclick = () => this.togglePause();

        const btnStart = document.getElementById('btn-start');
        if (btnStart) btnStart.onclick = () => { if (this.isActive) this.togglePause(); };

        const btnAction = document.getElementById('btn-action');
        if (btnAction) {
            btnAction.onclick = () => { if (this.isActive) this.togglePause(); };
        }

        const btnRestart = document.getElementById('si-menu-restart');
        if (btnRestart) btnRestart.onclick = () => this.start();

        const btnQuit = document.getElementById('si-menu-quit');
        if (btnQuit) btnQuit.onclick = () => {
            if (this.callbacks.onGameExit) this.callbacks.onGameExit();
        };
    }

    start() {
        this.stop(); // Ensure any existing loop is cancelled
        this.reset();
        this.isActive = true;
        this.isPaused = false;
        this.lastTime = performance.now();

        const overlay = document.getElementById('si-game-overlay');
        if (overlay) overlay.classList.add('hidden');

        this.requestLoop();
    }

    stop() {
        this.isActive = false;
        cancelAnimationFrame(this.animationFrameId);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const overlay = document.getElementById('si-game-overlay');
        const msg = document.getElementById('si-overlay-msg');

        if (this.isPaused) {
            overlay.classList.remove('hidden');
            msg.innerText = "PAUSED";
            document.getElementById('si-menu-restart').innerText = "Restart";
        } else {
            overlay.classList.add('hidden');
            this.lastTime = performance.now();
            this.requestLoop();
        }
    }

    reset() {
        this.score = 0;
        this.lives = 3;
        this.killedCount = 0;
        this.phase = 'patrol';
        this.enemySpawnRate = 2000;

        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.debris = [];
        this.terrain = [];
        this.boss = null;

        // Init Initial Terrain - Mounds
        for (let i = 0; i < 6; i++) {
            this.spawnTerrain(i * 60 + 20);
        }

        this.player.y = this.canvas.height / 2;
        this.player.x = 20;
        this.updateUI();
    }

    updateUI() {
        const scoreEl = document.getElementById('si-score');
        const livesEl = document.getElementById('si-lives');

        if (scoreEl) scoreEl.innerText = `${this.score}`;

        if (livesEl) {
            let hearts = '';
            for (let i = 0; i < this.lives; i++) hearts += '♥';
            livesEl.innerText = hearts;
        }
    }

    requestLoop() {
        if (!this.isActive) return;
        this.animationFrameId = requestAnimationFrame(t => this.loop(t));
    }

    loop(timestamp) {
        if (!this.isActive) return;
        if (this.isPaused) return;

        let dt = timestamp - this.lastTime;
        // Cap dt to prevent massive jumps on lag/tab switch
        if (dt > 50) dt = 50;

        this.lastTime = timestamp;

        this.update(dt);
        this.draw();
        this.requestLoop();
    }

    update(dt) {
        // Delta Time Factor (Normalize to ~60fps)
        const timeScale = dt / 16.67;

        // Player Move
        if (this.keys.ArrowUp) this.player.y -= this.player.speed * timeScale;
        if (this.keys.ArrowDown) this.player.y += this.player.speed * timeScale;
        if (this.keys.ArrowLeft) this.player.x -= this.player.speed * timeScale;
        if (this.keys.ArrowRight) this.player.x += this.player.speed * timeScale;

        this.player.x = Math.max(0, Math.min(this.player.x, this.canvas.width - this.player.width));
        this.player.y = Math.max(0, Math.min(this.player.y, this.canvas.height - this.player.height - 35));

        // Auto Fire
        if (performance.now() - this.lastFireTime > this.fireRate) {
            this.bullets.push({
                x: this.player.x + this.player.width,
                y: this.player.y + this.player.height / 2 - 1,
                w: 6, h: 2,
                speed: 6 // Base speed
            });
            this.lastFireTime = performance.now();
        }

        this.updatePhases(dt);
        this.updateTerrain(dt, timeScale);

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            b.x += b.speed * timeScale;
            if (b.x > this.canvas.width) this.bullets.splice(i, 1);
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            let b = this.enemyBullets[i];
            b.x += b.vx * timeScale;
            b.y += b.vy * timeScale;

            if (b.x < 0 || b.y < 0 || b.y > this.canvas.height) {
                this.enemyBullets.splice(i, 1);
                continue;
            }

            if (this.checkBoxCollision(b, this.player)) {
                this.handlePlayerHit();
                this.enemyBullets.splice(i, 1);
            }
        }

        // Update Boss
        if (this.boss) {
            this.updateBoss(dt, timeScale);
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.x -= e.speed * timeScale;
            e.y += Math.sin(e.x * 0.05 + e.offset) * 0.5 * timeScale;

            if (this.checkBoxCollision(this.player, e)) {
                this.handlePlayerHit();
                this.enemies.splice(i, 1);
                continue;
            }

            let hit = false;
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                if (this.checkBoxCollision(this.bullets[j], e)) {
                    this.killEnemy(e);
                    this.bullets.splice(j, 1);
                    this.enemies.splice(i, 1);
                    hit = true;
                    break;
                }
            }

            if (!hit && e.x + e.w < 0) this.enemies.splice(i, 1);
        }

        // Update Debris
        for (let i = this.debris.length - 1; i >= 0; i--) {
            let d = this.debris[i];

            d.vy += 0.08 * timeScale; // Gravity
            d.x += d.vx * timeScale;
            d.y += d.vy * timeScale;
            d.rot += d.rotSpeed * timeScale;
            d.life -= 1 * timeScale;

            // TERRAIN COLLISION (Mounds)
            let onGround = false;
            for (let t of this.terrain) {
                const cx = t.x + t.w / 2;
                const cy = t.y + t.h;
                const radius = t.w / 2;

                if (d.x >= t.x && d.x <= t.x + t.w) {
                    const distX = d.x - cx;
                    const moundHeight = Math.sqrt(Math.max(0, radius * radius - distX * distX));
                    const moundTopY = cy - moundHeight;

                    if (d.y + d.size / 2 >= moundTopY && d.y - d.size / 2 <= cy) {
                        d.y = moundTopY - d.size / 2;

                        const slope = -distX / moundHeight;
                        d.vx += slope * 0.1 * timeScale;

                        d.vy *= -0.3;
                        d.vx *= 0.9;

                        d.x -= 0.5 * timeScale;
                        onGround = true;
                    }
                }
            }

            // Screen Bounds
            if (d.x <= 0 || d.x >= this.canvas.width) d.vx *= -1;
            if (d.y > this.canvas.height + 10) d.life = 0;

            if (d.life <= 0) this.debris.splice(i, 1);
        }
    }

    updateTerrain(dt, timeScale) {
        // Move Terrain
        for (let i = this.terrain.length - 1; i >= 0; i--) {
            let t = this.terrain[i];
            t.x -= 0.5 * timeScale;
            if (t.x + t.w < 0) this.terrain.splice(i, 1);
        }

        // Spawn Terrain
        this.terrainSpawnTimer += dt;
        if (this.terrainSpawnTimer > this.terrainSpawnRate) {
            this.spawnTerrain();
            this.terrainSpawnTimer = 0;
        }
    }

    spawnTerrain(overrideX) {
        const w = 40 + Math.random() * 40;
        const h = w / 2; // Semicircle
        const x = overrideX !== undefined ? overrideX : this.canvas.width;

        this.terrain.push({
            x: x,
            y: this.canvas.height - h, // Top Y
            w: w,
            h: h
        });
    }

    updatePhases(dt) {
        if (this.phase === 'boss_fight') return;
        if (this.killedCount >= 50 && this.phase !== 'boss_warning' && this.phase !== 'boss_fight') {
            this.phase = 'boss_warning';
            this.enemies = [];
            setTimeout(() => this.spawnBoss(), 2000);
            return;
        } else if (this.killedCount >= 20 && this.phase === 'patrol') {
            this.phase = 'assault';
            this.enemySpawnRate = 1000;
        }
        if (this.phase === 'boss_warning') return;

        this.enemySpawnTimer += dt;
        if (this.enemySpawnTimer > this.enemySpawnRate) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }
    }

    spawnEnemy() {
        const type = Math.random() > 0.6 ? 'bug' : 'scout';
        const speedMult = this.phase === 'assault' ? 1.5 : 1.0;
        this.enemies.push({
            x: this.canvas.width,
            y: Math.random() * (this.canvas.height - 100) + 20,
            w: 22, h: 16,
            speed: (Math.random() * 1.5 + 1.5) * speedMult, // Base speed
            type: type,
            offset: Math.random() * 10
        });
    }

    spawnBoss() {
        this.phase = 'boss_fight';
        this.boss = {
            x: this.canvas.width + 50,
            y: this.canvas.height / 2 - 40,
            w: 80, h: 80,
            hp: 20,
            maxHp: 20,
            vy: 1, // Base Vy
            state: 'entering',
            attackTimer: 0
        };
    }

    updateBoss(dt, timeScale) {
        const boss = this.boss;
        if (!boss) return;
        if (boss.state === 'entering') {
            boss.x -= 0.5 * timeScale;
            if (boss.x < this.canvas.width - 100) boss.state = 'idle';
        } else {
            boss.y += boss.vy * timeScale;
            if (boss.y < 10 || boss.y > this.canvas.height - boss.h - 50) boss.vy *= -1;

            boss.attackTimer += dt;
            if (boss.attackTimer > 2000) {
                this.bossAttack();
                boss.attackTimer = 0;
            }
        }
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            if (this.checkBoxCollision(b, boss)) {
                boss.hp--;
                this.bullets.splice(i, 1);
                this.createDebris(b.x, b.y, 2);
                if (boss.hp <= 0) this.killBoss();
            }
        }
        if (this.checkBoxCollision(this.player, boss)) {
            this.handlePlayerHit();
        }
    }

    bossAttack() {
        const startY = this.boss.y + this.boss.h / 2;
        const startX = this.boss.x;
        const angles = [-0.2, 0, 0.2];
        angles.forEach(angle => {
            this.enemyBullets.push({
                x: startX,
                y: startY,
                vx: -4 * Math.cos(angle), // Base velocity
                vy: 4 * Math.sin(angle),
                w: 6, h: 6
            });
        });
    }

    killBoss() {
        this.score += 5000;
        this.updateUI();
        for (let k = 0; k < 20; k++) {
            this.createDebris(
                this.boss.x + Math.random() * this.boss.w,
                this.boss.y + Math.random() * this.boss.h,
                150 + Math.random() * 50
            );
        }
        this.boss = null;
        this.phase = 'victory';
        setTimeout(() => this.showVictory(), 2000);
    }

    showVictory() {
        this.isActive = false;
        const overlay = document.getElementById('si-game-overlay');
        const msg = document.getElementById('si-overlay-msg');
        if (overlay && msg) {
            overlay.classList.remove('hidden');
            msg.innerText = "MISSION CLEAR";
            document.getElementById('si-menu-restart').innerText = "Play Again";
        }
        if (this.callbacks.onGameOver) this.callbacks.onGameOver("VICTORY", this.score);
    }

    killEnemy(enemy) {
        this.score += 50;
        this.killedCount++;
        this.updateUI();
        this.createDebris(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    }

    createDebris(x, y, life = 120) {
        for (let k = 0; k < 6; k++) {
            this.debris.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                rot: 0,
                rotSpeed: (Math.random() - 0.5),
                life: life,
                size: Math.random() * 4 + 2
            });
        }
    }

    handlePlayerHit() {
        this.lives--;
        this.updateUI();
        if (this.lives <= 0) {
            this.gameOver();
        } else {
            this.enemies = [];
            this.bullets = [];
            this.enemyBullets = [];
            this.player.x = 20;
            this.player.y = this.canvas.height / 2;
        }
    }

    checkBoxCollision(a, b) {
        const aw = a.w || a.width;
        const ah = a.h || a.height;
        const bw = b.w || b.width;
        const bh = b.h || b.height;
        const pad = 2;
        return (a.x + pad < b.x + bw - pad && a.x + aw - pad > b.x + pad && a.y + pad < b.y + bh - pad && a.y + ah - pad > b.y + pad);
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#c7f0d8';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#43523d';

        this.drawTerrain();
        this.drawJet(this.player.x, this.player.y);

        for (let b of this.bullets) this.ctx.fillRect(b.x, b.y, b.w, b.h);
        for (let b of this.enemyBullets) {
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        if (this.boss) this.drawBoss(this.boss);
        for (let e of this.enemies) {
            if (e.type === 'bug') this.drawBug(e.x, e.y);
            else this.drawScout(e.x, e.y);
        }
        for (let d of this.debris) {
            this.ctx.save();
            this.ctx.translate(d.x, d.y);
            this.ctx.rotate(d.rot);
            this.ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
            this.ctx.restore();
        }
    }

    drawTerrain() {
        this.ctx.strokeStyle = '#43523d';
        this.ctx.lineWidth = 1.5;

        for (let t of this.terrain) {
            const cx = t.x + t.w / 2;
            const cy = t.y + t.h;
            const r = t.w / 2;

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r, Math.PI, 0);
            this.ctx.stroke();
        }
    }

    drawJet(x, y) {
        const ctx = this.ctx;
        const S = 2;
        const p = (dx, dy) => ctx.fillRect(x + dx * S, y + dy * S, S, S);
        const rect = (dx, dy, w, h) => ctx.fillRect(x + dx * S, y + dy * S, w * S, h * S);

        rect(4, 2, 6, 3);
        rect(10, 3, 2, 1);
        p(3, 1); p(3, 5);
        rect(0, 0, 3, 2);
        rect(0, 5, 3, 2);
        p(3, 2); p(3, 4);
    }

    drawBoss(b) {
        const ctx = this.ctx;
        const x = b.x;
        const y = b.y;

        ctx.beginPath();
        ctx.moveTo(x + 20, y);
        ctx.lineTo(x + 70, y + 20);
        ctx.lineTo(x + 80, y + 40);
        ctx.lineTo(x + 70, y + 60);
        ctx.lineTo(x + 20, y + 80);
        ctx.lineTo(x, y + 60);
        ctx.lineTo(x + 10, y + 40);
        ctx.lineTo(x, y + 20);
        ctx.lineTo(x + 20, y);
        ctx.fill();

        ctx.clearRect(x + 30, y + 20, 10, 10);
        ctx.clearRect(x + 30, y + 50, 10, 10);
        ctx.clearRect(x + 50, y + 35, 15, 10);
    }

    drawBug(x, y) {
        const ctx = this.ctx;
        ctx.fillRect(x + 6, y + 4, 12, 8);
        ctx.fillRect(x, y + 5, 4, 6);
        ctx.fillRect(x - 2, y + 4, 2, 2);
        ctx.fillRect(x - 2, y + 10, 2, 2);
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 12, y); ctx.lineTo(x + 16, y + 4); ctx.stroke();
        ctx.moveTo(x + 10, y + 12); ctx.lineTo(x + 12, y + 16); ctx.lineTo(x + 16, y + 12); ctx.stroke();
        ctx.clearRect(x + 2, y + 6, 1, 1);
        ctx.clearRect(x + 2, y + 9, 1, 1);
    }

    drawScout(x, y) {
        const ctx = this.ctx;
        ctx.beginPath(); ctx.ellipse(x + 10, y + 8, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 10, y + 6, 4, Math.PI, 0); ctx.fill();
        ctx.clearRect(x + 4, y + 8, 2, 2); ctx.clearRect(x + 14, y + 8, 2, 2); ctx.clearRect(x + 9, y + 9, 2, 2);
    }

    gameOver() {
        this.isActive = false;
        const overlay = document.getElementById('si-game-overlay');
        const msg = document.getElementById('si-overlay-msg');
        if (overlay && msg) {
            overlay.classList.remove('hidden');
            msg.innerText = "GAME OVER";
            document.getElementById('si-menu-restart').innerText = "Restart";
        }
        if (this.callbacks.onGameOver) this.callbacks.onGameOver("GAME OVER", this.score);
    }

    destroy() {
        this.stop();
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        ['btn-up', 'btn-down', 'btn-left', 'btn-right', 'btn- pause', 'btn-start', 'btn-action'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.ontouchstart = null;
                btn.ontouchend = null;
                btn.onmousedown = null;
                btn.onmouseup = null;
                btn.onclick = null;
            }
        });
    }
}
