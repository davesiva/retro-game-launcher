class SnakeGame {
    constructor(canvas, initialSpeed, difficultyLevel, onExitCallback) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onExit = onExitCallback;

        // Game Constants
        this.GRID_SIZE = 15; // 20x20 grid on a 300x300 canvas
        this.TILE_COUNT = this.canvas.width / this.GRID_SIZE;
        this.BASE_SPEED = initialSpeed;
        this.DIFFICULTY = difficultyLevel; // 0=Easy, 1=Med, 2=Hard, 3=Very Hard

        // Game State
        this.snake = [];
        this.food = { x: 0, y: 0 };
        this.dx = 0;
        this.dy = 0;
        this.nextDx = 0;
        this.nextDy = 0;
        this.nextDy = 0;
        this.score = 0;
        this.lives = 3;
        this.highScore = localStorage.getItem('snake-highscore') || 0;
        this.loopId = null;
        this.lastTime = 0;
        this.speed = this.BASE_SPEED;

        this.isPaused = false;
        this.isGameOver = false;
        this.inputProcessed = false; // Prevent 180 turns in one frame

        // Bind Controls
        this.handleInput = this.handleInput.bind(this);
        document.addEventListener('keydown', this.handleInput);

        // Touch Controls Binding (External buttons)
        this.bindTouchControls();

        this.initGame();
        this.startGameLoop();
    }

    initGame() {
        // Start in middle
        const startX = Math.floor(this.TILE_COUNT / 2);
        const startY = Math.floor(this.TILE_COUNT / 2);
        this.snake = [
            { x: startX, y: startY },
            { x: startX, y: startY + 1 },
            { x: startX, y: startY + 2 }
        ];
        this.dx = 0;
        this.dy = -1; // Moving Up initially
        this.nextDx = 0;
        this.nextDy = -1;

        this.score = 0;
        this.lives = 3;
        this.updateScoreDisplay();
        this.placeFood();
        this.isGameOver = false;
        this.isPaused = false;
        this.speed = this.BASE_SPEED;

        // Hide overlay
        document.getElementById('game-overlay').classList.add('hidden');
    }

    bindTouchControls() {
        const btnMap = {
            'btn-up': { dx: 0, dy: -1 },
            'btn-down': { dx: 0, dy: 1 },
            'btn-left': { dx: -1, dy: 0 },
            'btn-right': { dx: 1, dy: 0 }
        };

        for (const [id, dir] of Object.entries(btnMap)) {
            const btn = document.getElementById(id);
            if (btn) {
                // Remove old listeners to prevent duplicates if game restarts
                btn.ontouchstart = null;
                btn.onclick = null;

                btn.ontouchstart = (e) => {
                    e.preventDefault();
                    this.changeDirection(dir.dx, dir.dy);
                };
                btn.onclick = (e) => this.changeDirection(dir.dx, dir.dy);
            }
        }

        // Functional Buttons
        const btnStart = document.getElementById('btn-start');
        btnStart.onclick = () => this.initGame();

        const btnPause = document.getElementById('btn-pause');
        btnPause.onclick = () => this.togglePause();

        // Action Button (Restart if Game Over)
        const btnAction = document.getElementById('btn-action');
        btnAction.onclick = () => {
            if (this.isGameOver) this.initGame();
        };

        // Overlay Menu Buttons
        const btnResume = document.getElementById('menu-resume');
        if (btnResume) btnResume.onclick = () => this.togglePause();

        const btnRestart = document.getElementById('menu-restart');
        if (btnRestart) btnRestart.onclick = () => this.initGame();

        const btnQuit = document.getElementById('menu-quit');
        if (btnQuit) btnQuit.onclick = () => this.onExit();
    }

    handleInput(e) {
        switch (e.key) {
            case 'ArrowUp':
            case '2': // Nokia mapping
            case 'w':
            case 'W':
                this.changeDirection(0, -1);
                break;
            case 'ArrowDown':
            case '8':
            case 's':
            case 'S':
                this.changeDirection(0, 1);
                break;
            case 'ArrowLeft':
            case '4':
            case 'a':
            case 'A':
                this.changeDirection(-1, 0);
                break;
            case 'ArrowRight':
            case '6':
            case 'd':
            case 'D':
                this.changeDirection(1, 0);
                break;
            case ' ':
            case 'Enter':
            case '5':
                if (this.isGameOver) this.initGame();
                else this.togglePause();
                break;
            case 'p':
            case 'P':
                this.togglePause();
                break;
            case 'Escape':
                this.onExit();
                break;
        }
    }

    changeDirection(x, y) {
        if (this.inputProcessed) return; // Only one turn per frame

        // Prevent 180 degree turns
        if (x !== 0 && this.dx !== 0) return;
        if (y !== 0 && this.dy !== 0) return;

        this.nextDx = x;
        this.nextDy = y;
        this.inputProcessed = true;
    }

    placeFood() {
        let valid = false;
        // Margin of 2 to avoid the border (1 pixel border + 0 index)
        const minRange = 1;
        const maxRange = this.TILE_COUNT - 2;

        while (!valid) {
            this.food = {
                x: Math.floor(Math.random() * maxRange) + minRange,
                y: Math.floor(Math.random() * maxRange) + minRange
            };
            // Double check it's not on the border
            if (this.food.x < 1 || this.food.x >= this.TILE_COUNT - 1 ||
                this.food.y < 1 || this.food.y >= this.TILE_COUNT - 1) {
                continue;
            }
            // Check if food spawns on snake body
            valid = !this.snake.some(segment => segment.x === this.food.x && segment.y === this.food.y);
        }
    }

    startGameLoop() {
        const loop = (timestamp) => {
            if (!this.lastTime) this.lastTime = timestamp;
            const elapsed = timestamp - this.lastTime;

            if (elapsed > this.speed) {
                this.update();
                this.draw();
                this.lastTime = timestamp;
            }

            this.loopId = requestAnimationFrame(loop);
        };
        this.loopId = requestAnimationFrame(loop);
    }

    update() {
        if (this.isPaused || this.isGameOver) return;

        // Apply Next Direction
        this.dx = this.nextDx;
        this.dy = this.nextDy;
        this.inputProcessed = false;

        const head = { x: this.snake[0].x + this.dx, y: this.snake[0].y + this.dy };

        // Wrap Around Logic vs Solid Walls
        // Difficulties 0 (Easy) and 1 (Medium) wrap.
        // Difficulties 2 (Hard) and 3 (Very Hard) are solid walls.
        if (this.DIFFICULTY >= 2) {
            // Solid Walls - Collision Check
            if (head.x < 1 || head.x >= this.TILE_COUNT - 1 ||
                head.y < 1 || head.y >= this.TILE_COUNT - 1) {
                this.handleDeath();
                return;
            }
        } else {
            // Wrapping Logic
            if (head.x < 1) head.x = this.TILE_COUNT - 2;
            else if (head.x >= this.TILE_COUNT - 1) head.x = 1;

            if (head.y < 1) head.y = this.TILE_COUNT - 2;
            else if (head.y >= this.TILE_COUNT - 1) head.y = 1;
        }

        // Self Collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.handleDeath();
            return;
        }

        this.snake.unshift(head);

        // Food Collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.updateScoreDisplay();
            this.placeFood();
            // Increase speed slightly
            this.speed = Math.max(50, this.speed * 0.98);
        } else {
            this.snake.pop(); // Remove tail
        }
    }

    draw() {
        // Clear screen with Nokia BG (Matching CSS)
        this.ctx.fillStyle = '#c4d600';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#1f1f1f'; // Dark Pixel Color

        // Draw Border
        if (this.DIFFICULTY >= 2) {
            // Solid Walls (Hard/Very Hard) - Draw 4 continuous lines for clean corners
            const size = this.GRID_SIZE;
            // Same thickness as dots: ~1/3 of grid size
            const thickness = Math.max(2, Math.floor(size / 3));
            const offset = (size - thickness) / 2;

            // Top Long (Start at offset, End at width-offset)
            this.ctx.fillRect(offset, offset, this.canvas.width - offset * 2, thickness);
            // Bottom Long
            this.ctx.fillRect(offset, this.canvas.height - offset - thickness, this.canvas.width - offset * 2, thickness);
            // Left Long (Start at offset, End at height-offset)
            this.ctx.fillRect(offset, offset, thickness, this.canvas.height - offset * 2);
            // Right Long
            this.ctx.fillRect(this.canvas.width - offset - thickness, offset, thickness, this.canvas.height - offset * 2);

        } else {
            // Dotted Walls (Easy/Medium)
            // Top and Bottom
            for (let x = 0; x < this.TILE_COUNT; x++) {
                this.drawBorderPixel(x, 0);
                this.drawBorderPixel(x, this.TILE_COUNT - 1);
            }
            // Left and Right
            for (let y = 0; y < this.TILE_COUNT; y++) {
                this.drawBorderPixel(0, y);
                this.drawBorderPixel(this.TILE_COUNT - 1, y);
            }
        }

        // Draw Food
        this.ctx.fillStyle = '#1f1f1f'; // Ensure consistent color
        const thickness = this.GRID_SIZE - 6;
        const offset = (this.GRID_SIZE - thickness) / 2;
        this.ctx.fillRect(this.food.x * this.GRID_SIZE + offset, this.food.y * this.GRID_SIZE + offset, thickness, thickness);

        // Draw Snake
        this.ctx.fillStyle = '#1f1f1f';
        this.drawSnake();
    }

    drawSnake() {
        const thickness = this.GRID_SIZE - 6; // Thinner by 6 pixels (3 on each side)
        const offset = (this.GRID_SIZE - thickness) / 2;

        for (let i = 0; i < this.snake.length; i++) {
            const segment = this.snake[i];
            const px = segment.x * this.GRID_SIZE;
            const py = segment.y * this.GRID_SIZE;

            // Draw the "hub" (main body part)
            this.ctx.fillRect(px + offset, py + offset, thickness, thickness);

            // Draw connection to the next segment (towards tail) to make it look solid
            if (i < this.snake.length - 1) {
                const next = this.snake[i + 1];

                // Calculate direction to next segment
                const dx = next.x - segment.x;
                const dy = next.y - segment.y;

                // Only connect if they are adjacent (not wrapped around screen)
                if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                    if (dx === 1) { // Next is Right
                        // Start at right edge of hub, go right. Correct.
                        this.ctx.fillRect(px + offset + thickness, py + offset, offset * 2 + 1, thickness);
                    } else if (dx === -1) { // Next is Left
                        // Start at LEFT edge of cell (px) minus offset?
                        // Gap is from (px-offset) to (px+offset).
                        this.ctx.fillRect(px - offset, py + offset, offset * 2 + 1, thickness);
                    } else if (dy === 1) { // Next is Down
                        // Start at bottom edge of hub, go down. Correct.
                        this.ctx.fillRect(px + offset, py + offset + thickness, thickness, offset * 2 + 1);
                    } else if (dy === -1) { // Next is Up
                        // Start at TOP edge of cell (py) minus offset?
                        // Gap is from (py-offset) to (py+offset).
                        this.ctx.fillRect(px + offset, py - offset, thickness, offset * 2 + 1);
                    }
                }
            }
        }
    }

    drawPixel(x, y) {
        // Full solid pixel for snake and food
        const size = this.GRID_SIZE;
        const px = x * this.GRID_SIZE;
        const py = y * this.GRID_SIZE;
        this.ctx.fillRect(px, py, size, size);
    }

    drawBorderLine(x, y, isVertical) {
        const size = this.GRID_SIZE;
        // Same thickness as dots: ~1/3 of grid size
        const thickness = Math.max(2, Math.floor(size / 3));
        const offset = (size - thickness) / 2;

        if (isVertical) {
            // Full height, centered width
            this.ctx.fillRect(x * size + offset, y * size, thickness, size);
        } else {
            // Full width, centered height
            this.ctx.fillRect(x * size, y * size + offset, size, thickness);
        }
    }
    drawBorderPixel(x, y) {
        // Smaller dot for border (thinner look)
        // Center a small square in the grid cell
        const size = this.GRID_SIZE;
        // Make the dots roughly 1/3 of the cell size for that distinctive "dotted line" look
        const dotSize = Math.max(2, Math.floor(size / 3));
        const offset = (size - dotSize) / 2;

        const px = x * size + offset;
        const py = y * size + offset;

        this.ctx.fillRect(px, py, dotSize, dotSize);
    }

    drawBorderSolid(x, y) {
        const size = this.GRID_SIZE;
        this.ctx.fillRect(x * size, y * size, size, size);
    }

    updateScoreDisplay() {
        const scoreEl = document.getElementById('score');
        const hiScoreEl = document.getElementById('high-score');
        const livesEl = document.getElementById('lives-display');

        if (scoreEl) scoreEl.innerText = `Score: ${this.score}`;
        if (livesEl) {
            let hearts = "";
            for (let i = 0; i < this.lives; i++) hearts += "♥";
            livesEl.innerText = `${hearts}`;
        }


        const startHiScale = parseInt(this.highScore);
        if (this.score > startHiScale) {
            this.highScore = this.score;
            localStorage.setItem('snake-highscore', this.highScore);
        }

        if (hiScoreEl) hiScoreEl.innerText = `Hi: ${this.highScore}`;
    }

    handleDeath() {
        this.lives--;
        this.updateScoreDisplay();

        if (this.lives > 0) {
            // Reset Snake Position but keep score/food
            const startX = Math.floor(this.TILE_COUNT / 2);
            const startY = Math.floor(this.TILE_COUNT / 2);
            this.snake = [
                { x: startX, y: startY },
                { x: startX, y: startY + 1 },
                { x: startX, y: startY + 2 }
            ];
            this.dx = 0;
            this.dy = -1;
            this.nextDx = 0;
            this.nextDy = -1;
            this.inputProcessed = false;

            // Brief pause or visual feedback could go here
        } else {
            this.gameOver();
        }
    }

    gameOver() {
        this.isGameOver = true;
        const overlay = document.getElementById('game-overlay');
        overlay.classList.remove('hidden');
        document.getElementById('overlay-msg').innerText = "GAME OVER";

        // Hide Resume, Show Restart/Quit
        document.getElementById('menu-resume').classList.add('hidden');
        document.getElementById('menu-restart').classList.remove('hidden');
        document.getElementById('menu-quit').classList.remove('hidden');
    }

    togglePause() {
        if (this.isGameOver) return;
        this.isPaused = !this.isPaused;
        const overlay = document.getElementById('game-overlay');

        if (this.isPaused) {
            overlay.classList.remove('hidden');
            document.getElementById('overlay-msg').innerText = "PAUSED";

            // Show all options
            document.getElementById('menu-resume').classList.remove('hidden');
            document.getElementById('menu-restart').classList.remove('hidden');
            document.getElementById('menu-quit').classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    destroy() {
        cancelAnimationFrame(this.loopId);
        document.removeEventListener('keydown', this.handleInput);

        // Remove touch listeners (simplified clearing)
        const ids = ['btn-up', 'btn-down', 'btn-left', 'btn-right', 'btn-start', 'btn-pause', 'btn-action'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = null;
                el.ontouchstart = null;
            }
        });
    }
}
