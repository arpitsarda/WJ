/**
 * WumbleJumble Sentence Dataset
 * Moral / meaningful / positive sentences organized by word count.
 * 5 sentences per word-length from 3 to 12 words (50 sentences).
 */
const SENTENCES = [
  // 3-word sentences
  { id: 1, text: "Love conquers everything", wordCount: 3 },
  { id: 2, text: "Kindness costs nothing", wordCount: 3 },
  { id: 3, text: "Dreams come true", wordCount: 3 },
  { id: 4, text: "Knowledge is power", wordCount: 3 },
  { id: 5, text: "Practice makes perfect", wordCount: 3 },

  // 4-word sentences
  { id: 6, text: "Believe in your dreams", wordCount: 4 },
  { id: 7, text: "Courage starts with hope", wordCount: 4 },
  { id: 8, text: "Every moment matters greatly", wordCount: 4 },
  { id: 9, text: "Happiness comes from within", wordCount: 4 },
  { id: 10, text: "Unity creates lasting strength", wordCount: 4 },

  // 5-word sentences
  { id: 11, text: "Hard work brings great rewards", wordCount: 5 },
  { id: 12, text: "Every day is a gift", wordCount: 5 },
  { id: 13, text: "Kindness makes the world better", wordCount: 5 },
  { id: 14, text: "True strength comes from within", wordCount: 5 },
  { id: 15, text: "Never give up on yourself", wordCount: 5 },

  // 6-word sentences
  { id: 16, text: "Your attitude determines your life direction", wordCount: 6 },
  { id: 17, text: "Small acts create big positive changes", wordCount: 6 },
  { id: 18, text: "Together we can achieve anything great", wordCount: 6 },
  { id: 19, text: "A grateful heart attracts more blessings", wordCount: 6 },
  { id: 20, text: "Every challenge makes you grow stronger", wordCount: 6 },

  // 7-word sentences
  { id: 21, text: "The journey of learning never truly ends", wordCount: 7 },
  { id: 22, text: "Every sunrise brings a brand new chance", wordCount: 7 },
  { id: 23, text: "You are stronger than you truly believe", wordCount: 7 },
  { id: 24, text: "Success is the sum of small efforts", wordCount: 7 },
  { id: 25, text: "A kind heart is a warm shelter", wordCount: 7 },

  // 8-word sentences
  { id: 26, text: "A kind word can heal a wounded heart", wordCount: 8 },
  { id: 27, text: "What you do today shapes your bright tomorrow", wordCount: 8 },
  { id: 28, text: "In the middle of difficulty lies great opportunity", wordCount: 8 },
  { id: 29, text: "Your positive energy can transform the entire world", wordCount: 8 },
  { id: 30, text: "Believe in the power of your own journey", wordCount: 8 },

  // 9-word sentences
  { id: 31, text: "Every great achievement begins with the decision to try", wordCount: 9 },
  { id: 32, text: "You have the power to create your own happiness", wordCount: 9 },
  { id: 33, text: "When you believe in yourself anything becomes truly possible", wordCount: 9 },
  { id: 34, text: "The world needs more people who spread genuine kindness", wordCount: 9 },
  { id: 35, text: "Life is beautiful when you choose to see goodness", wordCount: 9 },

  // 10-word sentences
  { id: 36, text: "You are never too old to set a new goal", wordCount: 10 },
  { id: 37, text: "In a world where you can be anything choose kindness", wordCount: 10 },
  { id: 38, text: "The greatest glory in living lies not in never falling", wordCount: 10 },
  { id: 39, text: "What we achieve inwardly will change our outer reality forever", wordCount: 10 },
  { id: 40, text: "Do not wait for the perfect moment just take one", wordCount: 10 },

  // 11-word sentences
  { id: 41, text: "Life is not about waiting for the storm to pass by", wordCount: 11 },
  { id: 42, text: "The best way to find yourself is to serve other people", wordCount: 11 },
  { id: 43, text: "A person who never made a mistake never tried anything new", wordCount: 11 },
  { id: 44, text: "Be the reason someone smiles today and feels hope for tomorrow", wordCount: 11 },
  { id: 45, text: "The only impossible journey is the one you never begin walking", wordCount: 11 },

  // 12-word sentences
  { id: 46, text: "Your time is limited so do not waste it living someone else life", wordCount: 12 },
  { id: 47, text: "The future belongs to those who believe in the beauty of dreams", wordCount: 12 },
  { id: 48, text: "It is during our darkest moments that we must focus to see light", wordCount: 12 },
  { id: 49, text: "Happiness is not something you postpone for the future it is something you design", wordCount: 12 },
  { id: 50, text: "The only person you are destined to become is the person you decide", wordCount: 12 }
];

/**
 * SentenceService - manages sentence retrieval and shuffling
 */
class SentenceService {
  constructor() {
    this.sentencesByLength = {};
    this.usedIds = new Set();
    this._organize();
  }

  _organize() {
    SENTENCES.forEach(s => {
      if (!this.sentencesByLength[s.wordCount]) {
        this.sentencesByLength[s.wordCount] = [];
      }
      this.sentencesByLength[s.wordCount].push(s);
    });
  }

  /**
   * Get a sentence for the given word count.
   * Falls back to nearest available length if exact match unavailable.
   */
  getSentence(targetWordCount) {
    // Try exact match first
    let candidates = this._getCandidates(targetWordCount);
    if (candidates.length > 0) {
      return this._pickRandom(candidates);
    }

    // Search nearby lengths (prefer longer, then shorter)
    for (let offset = 1; offset <= 15; offset++) {
      candidates = this._getCandidates(targetWordCount + offset);
      if (candidates.length > 0) return this._pickRandom(candidates);
      candidates = this._getCandidates(targetWordCount - offset);
      if (candidates.length > 0) return this._pickRandom(candidates);
    }

    // If all used, reset and try again
    this.usedIds.clear();
    return this.getSentence(targetWordCount);
  }

  _getCandidates(wordCount) {
    const pool = this.sentencesByLength[wordCount] || [];
    return pool.filter(s => !this.usedIds.has(s.id));
  }

  _pickRandom(candidates) {
    const sentence = candidates[Math.floor(Math.random() * candidates.length)];
    this.usedIds.add(sentence.id);
    return sentence;
  }

  /**
   * Shuffle an array of words using Fisher-Yates algorithm.
   * Ensures the shuffled order is different from original.
   */
  shuffleWords(words) {
    let shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // If shuffle produced same order, swap first two
    if (shuffled.join(' ') === words.join(' ') && shuffled.length > 1) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    return shuffled;
  }

  reset() {
    this.usedIds.clear();
  }
}
