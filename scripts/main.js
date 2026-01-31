class GameLauncher {
    constructor() {
        this.dashboard = document.getElementById('dashboard');
        this.difficultyScreen = document.getElementById('difficulty-screen');
        this.snakeContainer = document.getElementById('snake-game');

        this.currentGame = null;
        this.pendingGameType = null;

        this.startBtn = document.getElementById('btn-start');

        // Difficulty Settings (Time in ms per frame)
        this.difficulties = [
            { label: 'EASY', speed: 150 },
            { label: 'MED', speed: 125 },
            { label: 'HARD', speed: 80 }
        ];

        this.init();
    }

    init() {
        // Setup Launcher Buttons (Initial Game Selection)
        document.querySelectorAll('.game-btn:not(.level-btn)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gameType = e.target.dataset.game;
                this.showDifficultySelect(gameType);
            });
        });

        // Setup Level Selection Buttons
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const levelIndex = parseInt(e.target.dataset.level);
                this.launchGame(levelIndex);
            });
        });

        // Setup 'Start' button
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                if (this.dashboard.classList.contains('active')) {
                    this.showDifficultySelect('snake');
                }
            });
        }
    }

    showDifficultySelect(gameType) {
        if (!gameType) return;
        this.pendingGameType = gameType;

        this.dashboard.classList.add('hidden');
        this.dashboard.classList.remove('active');

        this.difficultyScreen.classList.remove('hidden');
        this.difficultyScreen.classList.add('active');
    }

    launchGame(difficultyIndex) {
        // Hide Difficulty Screen
        this.difficultyScreen.classList.add('hidden');
        this.difficultyScreen.classList.remove('active');

        if (this.pendingGameType === 'snake') {
            this.snakeContainer.classList.remove('hidden');
            this.snakeContainer.classList.add('active');

            // Initialize Snake Game
            if (typeof SnakeGame !== 'undefined') {
                const speed = this.difficulties[difficultyIndex].speed;
                this.currentGame = new SnakeGame(
                    document.getElementById('game-canvas'),
                    speed,
                    this.onGameExit.bind(this)
                );
            } else {
                console.error("SnakeGame class not found!");
            }
        }
    }

    onGameExit() {
        if (this.currentGame) {
            this.currentGame.destroy();
            this.currentGame = null;
        }

        this.snakeContainer.classList.add('hidden');
        this.snakeContainer.classList.remove('active');

        this.dashboard.classList.remove('hidden');
        this.dashboard.classList.add('active');
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    new GameLauncher();
});
