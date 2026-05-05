/**
 * StorageManager - handles localStorage persistence for high scores and username
 */
class StorageManager {
  constructor() {
    this.HIGH_SCORES_KEY = 'wj_high_scores';
    this.USERNAME_KEY = 'wj_username';
    this.MAX_SCORES = 10;
  }

  /**
   * Get or create guest username
   */
  getUsername() {
    let username = localStorage.getItem(this.USERNAME_KEY);
    if (!username) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      username = `Guest${randomNum}`;
      localStorage.setItem(this.USERNAME_KEY, username);
    }
    return username;
  }

  /**
   * Get all high scores sorted descending
   */
  getHighScores() {
    try {
      const data = localStorage.getItem(this.HIGH_SCORES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save a new score. Returns true if it's a new high score.
   */
  saveScore(score) {
    const scores = this.getHighScores();
    const entry = {
      score: score,
      username: this.getUsername(),
      date: new Date().toISOString(),
      id: Date.now()
    };

    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);

    // Keep only top N
    const trimmed = scores.slice(0, this.MAX_SCORES);
    localStorage.setItem(this.HIGH_SCORES_KEY, JSON.stringify(trimmed));

    // Check if this score is the new #1
    return trimmed[0].id === entry.id;
  }

  /**
   * Get the current best score value
   */
  getBestScore() {
    const scores = this.getHighScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  /**
   * Clear all high scores
   */
  clearScores() {
    localStorage.removeItem(this.HIGH_SCORES_KEY);
  }
}
