/**
 * AudioManager - Web Audio API based sound generation
 * All sounds are synthesized programmatically, no audio files needed.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmNodes = [];
    this.bgmGain = null;
    this.isBgmPlaying = false;
    this.isMuted = false;
    this.isInitialized = false;
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  init() {
    if (this.isInitialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  /**
   * Resume audio context if suspended (browser autoplay policy)
   */
  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Correct answer - ascending two-note chime
   */
  playCorrect() {
    if (!this._canPlay()) return;
    this._playTone(523.25, 0.12, 'sine', 0.35, 0);
    this._playTone(659.25, 0.12, 'sine', 0.35, 0.1);
    this._playTone(783.99, 0.2, 'sine', 0.3, 0.2);
  }

  /**
   * Wrong answer - descending dissonant buzz
   */
  playWrong() {
    if (!this._canPlay()) return;
    this._playTone(350, 0.15, 'sawtooth', 0.15, 0);
    this._playTone(250, 0.15, 'sawtooth', 0.15, 0.1);
    this._playTone(180, 0.25, 'sawtooth', 0.12, 0.2);
  }

  /**
   * Countdown tick - short beep
   */
  playCountdownTick() {
    if (!this._canPlay()) return;
    this._playTone(880, 0.06, 'square', 0.1, 0);
  }

  /**
   * Word tile tap sound - subtle click
   */
  playTap() {
    if (!this._canPlay()) return;
    this._playTone(1200, 0.03, 'sine', 0.08, 0);
  }

  /**
   * Start ambient background music loop
   */
  startBGM() {
    if (!this._canPlay() || this.isBgmPlaying) return;
    this.isBgmPlaying = true;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.08;
    this.bgmGain.connect(this.masterGain);

    // Deep bass drone
    this._createBGMOsc(55, 'sine', 0.6);
    // Low pad
    this._createBGMOsc(110, 'triangle', 0.25);
    // Mid atmosphere
    this._createBGMOsc(165, 'sine', 0.12);
    // High shimmer with LFO
    this._createBGMShimmer(330, 0.08);
  }

  _createBGMOsc(freq, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start();
    this.bgmNodes.push(osc, gain);
  }

  _createBGMShimmer(freq, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol;

    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = vol * 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    gain.connect(this.bgmGain);

    osc.start();
    lfo.start();
    this.bgmNodes.push(osc, gain, lfo, lfoGain);
  }

  /**
   * Stop background music
   */
  stopBGM() {
    this.bgmNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) { /* already stopped */ }
    });
    this.bgmNodes = [];
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
    this.isBgmPlaying = false;
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
    }
    return this.isMuted;
  }

  // --- Internal ---

  _canPlay() {
    return this.isInitialized && this.ctx && !this.isMuted;
  }

  _playTone(freq, duration, type, volume, delay = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(this.masterGain);
    const t = this.ctx.currentTime + delay;
    osc.start(t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.stop(t + duration + 0.05);
  }
}
