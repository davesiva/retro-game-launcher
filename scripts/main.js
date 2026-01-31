class GameLauncher {
    constructor() {
        this.dashboard = document.getElementById('dashboard');
        this.snakeContainer = document.getElementById('snake-game');
        this.currentGame = null;

        this.startBtn = document.getElementById('btn-start');

        this.init();
    }

    init() {
        // Setup Launcher Buttons (Click to play immediately)
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gameType = e.target.dataset.game;
                this.launchGame(gameType);
            });
        });

        // Setup 'Start' button to launch selected game if one is highlighted (Simulated selection)
        // For now, if they are on dashboard and hit start, we launch Snake since it's the only one.
        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => {
                if (this.dashboard.classList.contains('active') && this.selectedGame) {
                    this.launchGame(this.selectedGame);
                }
            });
        }
    }

    launchGame(gameType) {
        if (gameType === 'snake') {
            this.dashboard.classList.add('hidden');
            this.dashboard.classList.remove('active');

            this.snakeContainer.classList.remove('hidden');
            this.snakeContainer.classList.add('active');

            // Initialize Snake Game (Global Class)
            if (typeof SnakeGame !== 'undefined') {
                this.currentGame = new SnakeGame(
                    document.getElementById('game-canvas'),
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
