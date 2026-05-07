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
    document.getElementById('btn-play').addEventListener('click', () => this.showModal('modal-difficulty'));
    document.getElementById('btn-marathon').addEventListener('click', () => this.startGame('marathon'));
    document.getElementById('btn-highscore').addEventListener('click', () => this.showHighScores());
    document.getElementById('btn-howtoplay').addEventListener('click', () => this.showScreen('howtoplay-screen'));
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.showScreen('leaderboard-screen'));

    // Bind back buttons
    document.getElementById('btn-hs-back').addEventListener('click', () => this.showScreen('menu-screen'));
    document.getElementById('btn-htp-back').addEventListener('click', () => this.showScreen('menu-screen'));
    document.getElementById('btn-lb-back').addEventListener('click', () => this.showScreen('menu-screen'));

    // Bind game over buttons
    document.getElementById('btn-retry').addEventListener('click', () => this.startGame(this.game.mode));
    document.getElementById('btn-menu').addEventListener('click', () => {
      this.audio.stopBGM();
      this.showScreen('menu-screen');
    });

    // Bind game controls
    document.getElementById('btn-submit').addEventListener('click', () => this.handleSubmit());
    document.getElementById('btn-skip').addEventListener('click', () => this.handleSkip());
    document.getElementById('btn-hint').addEventListener('click', () => {
      this.audio.playTap();
      this.game.useHint();
    });
    document.getElementById('btn-game-back').addEventListener('click', () => {
      this.audio.playTap();
      this.game.pause();
      this.showModal('modal-pause');
    });

    // Bind modals
    document.getElementById('btn-diff-easy').addEventListener('click', () => { this.hideModal('modal-difficulty'); this.startGame('easy'); });
    document.getElementById('btn-diff-hard').addEventListener('click', () => { this.hideModal('modal-difficulty'); this.startGame('hard'); });
    document.getElementById('btn-diff-cancel').addEventListener('click', () => { this.audio.playTap(); this.hideModal('modal-difficulty'); });
    
    document.getElementById('btn-pause-resume').addEventListener('click', () => {
      this.audio.playTap();
      this.hideModal('modal-pause');
      this.game.resume();
    });
    document.getElementById('btn-pause-quit').addEventListener('click', () => {
      this.audio.playTap();
      this.hideModal('modal-pause');
      this.game.destroy();
      this.audio.stopBGM();
      this.showScreen('menu-screen');
    });

    // Bind mute buttons
    document.getElementById('btn-mute').addEventListener('click', () => this.toggleMute());
    document.getElementById('btn-mute-game').addEventListener('click', () => this.toggleMute());

    // Setup game callbacks
    this.game.onTimerTick = (t, maxT) => this.updateTimer(t, maxT);
    this.game.onCorrectAnswer = (s, c) => this.handleCorrect(s, c);
    this.game.onWrongAnswer = (l) => this.handleWrong(l);
    this.game.onGameOver = (s, r, h, c) => this.handleGameOver(s, r, h, c);
    this.game.onNewSentence = (w, c) => this.renderNewSentence(w, c);
    this.game.onWordsChanged = (j, s) => this.renderWords(j, s);
    this.game.onHintUsed = (rem) => {
      const btn = document.getElementById('btn-hint');
      btn.textContent = `💡 HINT (${rem})`;
      if (rem <= 0) btn.disabled = true;
    };

    // Initialize Sortable for drag and drop
    if (typeof Sortable !== 'undefined') {
      new Sortable(document.getElementById('staged-tiles'), {
        animation: 150,
        ghostClass: 'sortable-ghost',
        filter: '.staged-placeholder',
        onEnd: () => {
          const tiles = document.querySelectorAll('#staged-tiles .word-tile');
          const newOrder = Array.from(tiles).map(t => t.textContent);
          this.game.reorderStagedWords(newOrder);
        }
      });
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ===== Screen & Modal Navigation =====
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    this.currentScreen = screenId;
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  // ===== Game Flow =====
  startGame(mode = 'easy') {
    // Init audio on first user interaction
    this.audio.init();
    this.audio.resume();
    this.audio.startBGM();

    this.showScreen('game-screen');

    // Reset UI
    document.getElementById('game-score').textContent = '0';
    document.getElementById('game-combo').style.display = 'none';
    document.getElementById('game-timer').textContent = mode === 'marathon' ? '∞' : '180';
    document.getElementById('game-timer').className = 'game-timer-value';
    
    // Hint button
    const hintBtn = document.getElementById('btn-hint');
    hintBtn.textContent = '💡 HINT (3)';
    hintBtn.disabled = false;
    hintBtn.style.display = mode === 'marathon' ? 'none' : 'block';
    
    // Hide/Show UI for marathon mode
    const timerContainer = document.querySelector('.game-timer');
    const livesContainer = document.querySelector('.game-lives');
    if (mode === 'marathon') {
      timerContainer.style.opacity = '0.3';
      livesContainer.style.opacity = '0.3';
    } else {
      timerContainer.style.opacity = '1';
      livesContainer.style.opacity = '1';
    }

    const barFill = document.getElementById('timer-bar-fill');
    barFill.style.width = '100%';
    barFill.className = 'game-timer-bar-fill';
    this.renderLives(3);
    document.getElementById('btn-submit').disabled = true;

    this.game.start(mode);
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
  updateTimer(timeRemaining, totalTime) {
    if (this.game.mode === 'marathon') return;
    const timerEl = document.getElementById('game-timer');
    const barFill = document.getElementById('timer-bar-fill');
    timerEl.textContent = timeRemaining;
    barFill.style.width = (timeRemaining / totalTime * 100) + '%';

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

  handleCorrect(score, combo) {
    this.audio.playCorrect();
    const scoreEl = document.getElementById('game-score');
    scoreEl.textContent = score;
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth; // force reflow
    scoreEl.classList.add('score-pop');

    const comboEl = document.getElementById('game-combo');
    if (combo > 1) {
      comboEl.textContent = `${combo}x COMBO!`;
      comboEl.style.display = 'block';
    } else {
      comboEl.style.display = 'none';
    }

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

  handleGameOver(score, reason, isNewHighScore, correctAnswer) {
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

    const correctAnswerEl = document.getElementById('gameover-correct-answer');
    if (correctAnswer) {
      correctAnswerEl.innerHTML = `Correct Answer:<br><span>${correctAnswer}</span>`;
      correctAnswerEl.style.display = 'block';
    } else {
      correctAnswerEl.style.display = 'none';
    }

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
    const requiredLength = this.game.originalWords ? this.game.originalWords.length : 0;
    const allPlaced = stagedWords.length === requiredLength;
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
