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
    this.timeRemaining = 60;
    this.totalTime = 60;
    this.currentWordLength = 3;
    this.currentSentence = null;
    this.originalWords = [];
    this.jumbledWords = [];   // words still in the jumbled pool
    this.stagedWords = [];    // words placed in the answer area
    this.isRunning = false;
    this.isPaused = false;
    this.timerInterval = null;
    this.gameOverReason = null;
    this.sentenceService.reset();
  }

  /**
   * Callback hooks - set by App
   */
  onTimerTick = null;      // (timeRemaining) => void
  onCorrectAnswer = null;  // (score) => void
  onWrongAnswer = null;    // (livesRemaining) => void
  onGameOver = null;       // (score, reason, isNewHighScore) => void
  onNewSentence = null;    // (jumbledWords, wordCount) => void
  onWordsChanged = null;   // (jumbledWords, stagedWords) => void

  /**
   * Start a new game
   */
  start() {
    this.reset();
    this.isRunning = true;
    this._loadNextSentence();
    this._startTimer();
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

  /**
   * Submit the current arrangement
   */
  submit() {
    if (!this.isRunning || this.stagedWords.length === 0 || this.jumbledWords.length > 0) return;

    const playerAnswer = this.stagedWords.join(' ');
    const correctAnswer = this.originalWords.join(' ');

    if (playerAnswer === correctAnswer) {
      this.score++;
      this.currentWordLength++;
      if (this.onCorrectAnswer) this.onCorrectAnswer(this.score);
      this._loadNextSentence();
    } else {
      this.lives--;
      if (this.onWrongAnswer) this.onWrongAnswer(this.lives);

      if (this.lives <= 0) {
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
    this.jumbledWords = this.sentenceService.shuffleWords([...this.originalWords]);
    this.stagedWords = [];
    if (this.onNewSentence) this.onNewSentence(this.jumbledWords, sentence.wordCount);
    if (this.onWordsChanged) this.onWordsChanged(this.jumbledWords, this.stagedWords);
  }

  _startTimer() {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.onTimerTick) this.onTimerTick(this.timeRemaining);

      if (this.timeRemaining <= 0) {
        this._endGame('time');
      }
    }, 1000);
  }

  _endGame(reason) {
    this.isRunning = false;
    this.gameOverReason = reason;
    clearInterval(this.timerInterval);
    this.timerInterval = null;

    const isNewHighScore = this.storage.saveScore(this.score);
    if (this.onGameOver) this.onGameOver(this.score, reason, isNewHighScore);
  }

  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.isRunning = false;
  }
}
