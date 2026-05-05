/**
 * WumbleJumble App Controller
 * Manages screen navigation, DOM updates, and game integration.
 */
class App {
  constructor() {
    this.sentenceService = new SentenceService();
    this.storage = new StorageManager();
    this.audio = new AudioManager();
    this.game = new GameEngine(this.sentenceService, this.storage);
    this.currentScreen = 'splash-screen';
    this.init();
  }

  init() {
    // Show username
    document.getElementById('username-display').textContent = this.storage.getUsername();

    // Splash -> Menu after delay
    setTimeout(() => this.showScreen('menu-screen'), 2800);

    // Bind menu buttons
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-highscore').addEventListener('click', () => this.showHighScores());
    document.getElementById('btn-howtoplay').addEventListener('click', () => this.showScreen('howtoplay-screen'));
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.showScreen('leaderboard-screen'));

    // Bind back buttons
    document.getElementById('btn-hs-back').addEventListener('click', () => this.showScreen('menu-screen'));
    document.getElementById('btn-htp-back').addEventListener('click', () => this.showScreen('menu-screen'));
    document.getElementById('btn-lb-back').addEventListener('click', () => this.showScreen('menu-screen'));

    // Bind game over buttons
    document.getElementById('btn-retry').addEventListener('click', () => this.startGame());
    document.getElementById('btn-menu').addEventListener('click', () => {
      this.audio.stopBGM();
      this.showScreen('menu-screen');
    });

    // Bind game controls
    document.getElementById('btn-submit').addEventListener('click', () => this.handleSubmit());
    document.getElementById('btn-skip').addEventListener('click', () => this.handleSkip());

    // Bind mute buttons
    document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
    document.getElementById('btn-mute-game').addEventListener('click', () => this.toggleMute());

    // Setup game callbacks
    this.game.onTimerTick = (t) => this.updateTimer(t);
    this.game.onCorrectAnswer = (s) => this.handleCorrect(s);
    this.game.onWrongAnswer = (l) => this.handleWrong(l);
    this.game.onGameOver = (s, r, h) => this.handleGameOver(s, r, h);
    this.game.onNewSentence = (w, c) => this.renderNewSentence(w, c);
    this.game.onWordsChanged = (j, s) => this.renderWords(j, s);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ===== Screen Navigation =====
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    this.currentScreen = screenId;
  }

  // ===== Game Flow =====
  startGame() {
    // Init audio on first user interaction
    this.audio.init();
    this.audio.resume();
    this.audio.startBGM();

    this.showScreen('game-screen');

    // Reset UI
    document.getElementById('game-score').textContent = '0';
    document.getElementById('game-timer').textContent = '60';
    document.getElementById('game-timer').className = 'game-timer-value';
    const barFill = document.getElementById('timer-bar-fill');
    barFill.style.width = '100%';
    barFill.className = 'game-timer-bar-fill';
    this.renderLives(3);
    document.getElementById('btn-submit').disabled = true;

    this.game.start();
  }

  handleSubmit() {
    if (!this.game.isRunning) return;
    this.audio.playTap();
    this.game.submit();
  }

  handleSkip() {
    if (!this.game.isRunning) return;
    this.audio.playTap();
    this.game.skip();
  }

  // ===== Game Callbacks =====
  updateTimer(timeRemaining) {
    const timerEl = document.getElementById('game-timer');
    const barFill = document.getElementById('timer-bar-fill');
    timerEl.textContent = timeRemaining;
    barFill.style.width = (timeRemaining / 60 * 100) + '%';

    // Color transitions
    timerEl.className = 'game-timer-value';
    barFill.className = 'game-timer-bar-fill';
    if (timeRemaining <= 10) {
      timerEl.classList.add('danger');
      barFill.classList.add('danger');
      this.audio.playCountdownTick();
    } else if (timeRemaining <= 20) {
      timerEl.classList.add('warning');
      barFill.classList.add('warning');
    }
  }

  handleCorrect(score) {
    this.audio.playCorrect();
    const scoreEl = document.getElementById('game-score');
    scoreEl.textContent = score;
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth; // force reflow
    scoreEl.classList.add('score-pop');

    // Green flash
    this.flashOverlay('correct');
  }

  handleWrong(livesRemaining) {
    this.audio.playWrong();
    this.renderLives(livesRemaining);
    this.flashOverlay('wrong');

    // Shake the staged area
    const staged = document.getElementById('staged-tiles');
    staged.style.animation = 'heartShake 0.4s ease';
    setTimeout(() => staged.style.animation = '', 400);
  }

  handleGameOver(score, reason, isNewHighScore) {
    this.audio.stopBGM();

    const titleEl = document.getElementById('gameover-title');
    if (reason === 'time') {
      titleEl.textContent = "⏱️ TIME'S UP!";
      titleEl.className = 'gameover-title time-up';
    } else {
      titleEl.textContent = '💀 NO LIVES LEFT!';
      titleEl.className = 'gameover-title no-lives';
    }

    document.getElementById('gameover-score').textContent = score;
    document.getElementById('gameover-best').textContent = this.storage.getBestScore();

    const badge = document.getElementById('new-highscore-badge');
    badge.style.display = isNewHighScore ? 'block' : 'none';

    this.showScreen('gameover-screen');
  }

  // ===== Word Rendering =====
  renderNewSentence(jumbledWords, wordCount) {
    document.getElementById('word-count-display').textContent = wordCount;
  }

  renderWords(jumbledWords, stagedWords) {
    // Render jumbled tiles
    const jumbledContainer = document.getElementById('jumbled-tiles');
    jumbledContainer.innerHTML = '';
    jumbledWords.forEach((word, i) => {
      const tile = document.createElement('button');
      tile.className = 'word-tile';
      tile.textContent = word;
      tile.style.animationDelay = (i * 0.05) + 's';
      tile.addEventListener('click', () => {
        this.audio.playTap();
        this.game.selectWord(i);
      });
      jumbledContainer.appendChild(tile);
    });

    // Render staged tiles
    const stagedContainer = document.getElementById('staged-tiles');
    // Keep the placeholder span
    const placeholder = stagedContainer.querySelector('.staged-placeholder');
    stagedContainer.innerHTML = '';
    if (placeholder) stagedContainer.appendChild(placeholder);

    if (stagedWords.length > 0) {
      stagedContainer.classList.add('has-words');
    } else {
      stagedContainer.classList.remove('has-words');
    }

    stagedWords.forEach((word, i) => {
      const tile = document.createElement('button');
      tile.className = 'word-tile staged-word';
      tile.textContent = word;
      tile.addEventListener('click', () => {
        this.audio.playTap();
        this.game.deselectWord(i);
      });
      stagedContainer.appendChild(tile);
    });

    // Enable/disable submit
    const allPlaced = stagedWords.length > 0 && jumbledWords.length === 0;
    document.getElementById('btn-submit').disabled = !allPlaced;
  }

  renderLives(count) {
    const container = document.getElementById('game-lives');
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      heart.textContent = '❤️';
      if (i >= count) {
        heart.classList.add('lost');
      }
      // Animate lost heart
      if (i === count) {
        heart.classList.add('shake');
        setTimeout(() => heart.classList.remove('shake'), 400);
      }
      container.appendChild(heart);
    }
  }

  flashOverlay(type) {
    const el = document.getElementById('flash-' + type);
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 300);
  }

  // ===== High Scores =====
  showHighScores() {
    const scores = this.storage.getHighScores();
    const list = document.getElementById('score-list');
    list.innerHTML = '';

    if (scores.length === 0) {
      list.innerHTML = '<div class="no-scores">No scores yet. Play a game!</div>';
    } else {
      scores.forEach((entry, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const item = document.createElement('div');
        item.className = 'score-item ' + rankClass;
        const date = new Date(entry.date).toLocaleDateString();
        item.innerHTML = `
          <div class="score-rank">#${i + 1}</div>
          <div style="flex:1">
            <div class="score-name">${entry.username}</div>
            <div class="score-date">${date}</div>
          </div>
          <div class="score-value">${entry.score}</div>
        `;
        list.appendChild(item);
      });
    }
    this.showScreen('highscore-screen');
  }

  // ===== Audio Toggle =====
  toggleMute() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    const icon = muted ? '🔇' : '🔊';
    document.getElementById('btn-mute').textContent = icon;
    document.getElementById('btn-mute-game').textContent = icon;
  }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
