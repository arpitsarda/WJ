/**
 * GameEngine - Core game logic (no DOM manipulation)
 * Emits events via callbacks for the UI layer to consume.
 */
class GameEngine {
  constructor(sentenceService, storageManager) {
    this.sentenceService = sentenceService;
    this.storage = storageManager;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.timeRemaining = 180;
    this.totalTime = 180;
    this.currentWordLength = 3;
    this.currentSentence = null;
    this.originalWords = [];
    this.jumbledWords = [];   // words still in the jumbled pool
    this.stagedWords = [];    // words placed in the answer area
    this.isRunning = false;
    this.isPaused = false;
    this.mode = 'easy'; // 'easy', 'hard', 'marathon'
    this.timerInterval = null;
    this.gameOverReason = null;
    this.comboMultiplier = 1;
    this.lastAnswerTime = null;
    this.hintsRemaining = 3;
    this.sentenceService.reset();
  }

  /**
   * Callback hooks - set by App
   */
  onTimerTick = null;      // (timeRemaining, totalTime) => void
  onCorrectAnswer = null;  // (score, comboMultiplier) => void
  onWrongAnswer = null;    // (livesRemaining) => void
  onGameOver = null;       // (score, reason, isNewHighScore, correctAnswer) => void
  onNewSentence = null;    // (jumbledWords, wordCount) => void
  onWordsChanged = null;   // (jumbledWords, stagedWords) => void
  onHintUsed = null;       // (hintsRemaining) => void

  /**
   * Start a new game
   */
  start(mode = 'easy') {
    this.reset();
    this.mode = mode;
    this.isRunning = true;
    this.lastAnswerTime = Date.now();
    this._loadNextSentence();
    if (this.mode !== 'marathon') {
      this._startTimer();
    }
  }

  /**
   * Player taps a word in the jumbled pool (move to staging)
   */
  selectWord(index) {
    if (!this.isRunning || index < 0 || index >= this.jumbledWords.length) return;
    const word = this.jumbledWords.splice(index, 1)[0];
    this.stagedWords.push(word);
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  /**
   * Player taps a word in the staging area (move back to jumbled)
   */
  deselectWord(index) {
    if (!this.isRunning || index < 0 || index >= this.stagedWords.length) return;
    const word = this.stagedWords.splice(index, 1)[0];
    this.jumbledWords.push(word);
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  reorderStagedWords(newOrder) {
    if (!this.isRunning || this.isPaused) return;
    this.stagedWords = newOrder;
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  useHint() {
    if (!this.isRunning || this.isPaused || this.hintsRemaining <= 0) return;
    
    // Check if current staged words match prefix
    let matchLen = 0;
    for (let i = 0; i < this.stagedWords.length; i++) {
      if (this.stagedWords[i] === this.originalWords[i]) {
        matchLen++;
      } else {
        break;
      }
    }

    // Pop incorrect words back to jumbled
    while (this.stagedWords.length > matchLen) {
      const word = this.stagedWords.pop();
      this.jumbledWords.push(word);
    }

    // Find the next required word in jumbled
    if (matchLen < this.originalWords.length) {
      const requiredWord = this.originalWords[matchLen];
      const idx = this.jumbledWords.findIndex(w => w === requiredWord);
      if (idx !== -1) {
        const word = this.jumbledWords.splice(idx, 1)[0];
        this.stagedWords.push(word);
      }
    }

    this.hintsRemaining--;
    if (this.onHintUsed) this.onHintUsed(this.hintsRemaining);
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  /**
   * Submit the current arrangement
   */
  submit() {
    if (!this.isRunning || this.stagedWords.length !== this.originalWords.length) return;

    const playerAnswer = this.stagedWords.join(' ');
    const correctAnswer = this.originalWords.join(' ');

    if (playerAnswer === correctAnswer) {
      const now = Date.now();
      if (now - this.lastAnswerTime <= 6000) {
        this.comboMultiplier++;
      } else {
        this.comboMultiplier = 1;
      }
      this.lastAnswerTime = now;
      this.score += this.comboMultiplier;
      
      // Time boost
      if (this.mode !== 'marathon') {
        const boost = this.currentWordLength - 1;
        this.timeRemaining += boost;
        if (this.timeRemaining > this.totalTime) {
          this.totalTime = this.timeRemaining; // expand bar scale if exceeding
        }
        if (this.onTimerTick) this.onTimerTick(this.timeRemaining, this.totalTime);
      }

      this.currentWordLength++;
      if (this.onCorrectAnswer) this.onCorrectAnswer(this.score, this.comboMultiplier);
      this._loadNextSentence();
    } else {
      this.comboMultiplier = 1;
      if (this.onCorrectAnswer) this.onCorrectAnswer(this.score, this.comboMultiplier); // UI update

      if (this.mode !== 'marathon') {
        this.lives--;
      }
      if (this.onWrongAnswer) this.onWrongAnswer(this.lives);

      if (this.lives <= 0 && this.mode !== 'marathon') {
        this._endGame('lives');
      } else {
        // Move all staged words back to jumbled pool for retry
        this.jumbledWords = [...this.jumbledWords, ...this.stagedWords];
        this.stagedWords = [];
        // Re-shuffle
        this.jumbledWords = this.sentenceService.shuffleWords(this.jumbledWords);
        if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
      }
    }
  }

  /**
   * Skip current sentence (costs nothing, just loads next at same difficulty)
   */
  skip() {
    if (!this.isRunning) return;
    this._loadNextSentence();
  }

  // --- Internal ---

  _loadNextSentence() {
    const sentence = this.sentenceService.getSentence(this.currentWordLength);
    this.currentSentence = sentence;
    this.originalWords = sentence.text.split(' ');
    
    let wordsToJumble = [...this.originalWords];
    if (this.mode === 'hard') {
      const dummyWords = this.sentenceService.getRandomWords(2, this.originalWords);
      wordsToJumble = wordsToJumble.concat(dummyWords);
    }
    
    this.jumbledWords = this.sentenceService.shuffleWords(wordsToJumble);
    this.stagedWords = [];
    if (this.onNewSentence) this.onNewSentence(this.jumbledWords, sentence.wordCount);
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  _startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;
      this.timeRemaining--;
      if (this.onTimerTick) this.onTimerTick(this.timeRemaining, this.totalTime);

      if (this.timeRemaining <= 0) {
        this._endGame('time');
      }
    }, 1000);
  }

  _endGame(reason) {
    this.isRunning = false;
    this.gameOverReason = reason;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const isNewHighScore = this.mode === 'marathon' ? false : this.storage.saveScore(this.score);
    const correctAnswer = this.originalWords.join(' ');
    if (this.onGameOver) this.onGameOver(this.score, reason, isNewHighScore, correctAnswer);
  }

  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
  }
}
