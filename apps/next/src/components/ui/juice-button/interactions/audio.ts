/**
 * Audio manager for juice button sounds
 * Uses Web Audio API directly for simple sound generation
 */
class AudioManager {
  private audioContext: AudioContext | null = null;
  private initialized = false;
  private masterVolume = 1.0;

  /**
   * Initialize audio manager
   */
  initialize() {
    if (this.initialized) return;
    if (typeof window === "undefined") return;

    // Create AudioContext
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.initialized = true;
  }

  /**
   * Ensure audio context is running (handles browser autoplay policies)
   */
  private async ensureAudioContext() {
    if (!this.audioContext) {
      this.initialize();
    }

    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Play a beep sound with given frequency and duration
   */
  private async playBeep(frequency: number, duration: number, volume: number = 0.3) {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    // Envelope for smoother sound
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  /**
   * Play a chord (multiple frequencies)
   */
  private async playChord(frequencies: number[], duration: number, volume: number = 0.3) {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;

    frequencies.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.value = freq;
      oscillator.type = "sine";

      // Slightly stagger the start times for a richer sound
      const startDelay = index * 0.01;
      const adjustedVolume = (volume / frequencies.length) * this.masterVolume;

      gainNode.gain.setValueAtTime(0, now + startDelay);
      gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + startDelay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + startDelay + duration);

      oscillator.start(now + startDelay);
      oscillator.stop(now + startDelay + duration);
    });
  }

  /**
   * Play a "punch" sound with square wave for harder edge
   */
  private async playPunch(frequency: number, duration: number, volume: number = 0.3) {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "square"; // Square wave for harder sound

    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  /**
   * Play a "crystal" sound with multiple harmonics
   */
  private async playCrystal(baseFreq: number, duration: number, volume: number = 0.3) {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    // Play fundamental and harmonics
    const harmonics = [baseFreq, baseFreq * 2, baseFreq * 3, baseFreq * 4];

    harmonics.forEach((freq, index) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.frequency.value = freq;
      oscillator.type = "sine";

      const adjustedVolume = (volume / (index + 1)) * this.masterVolume;

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(adjustedVolume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    });
  }

  /**
   * Play a sound by key
   */
  async play(key: string, volume?: number) {
    this.initialize();

    const vol = volume ?? 0.3;

    // Map sound keys to frequencies and patterns
    switch (key) {
      case "click":
        // Default - clean sine wave
        await this.playBeep(800, 0.05, vol);
        break;
      case "soft":
        // Neomorphism - gentle, rounded
        await this.playBeep(600, 0.08, vol * 0.8);
        break;
      case "punch":
        // Neo-brutalist - aggressive, punchy
        await this.playPunch(300, 0.05, vol * 1.2);
        break;
      case "crystal":
        // Glassmorphism - shimmery with harmonics
        await this.playCrystal(1000, 0.12, vol * 0.7);
        break;
      case "success":
        // C major chord (C-E-G) - celebratory
        await this.playChord([523, 659, 784], 0.2, vol);
        break;
      case "error":
        // Low, warning tone
        await this.playBeep(250, 0.12, vol);
        break;
      case "loading":
        // Gentle oscillating tone
        await this.playBeep(440, 0.3, vol * 0.5);
        break;
      default:
        console.warn(`Sound "${key}" not found`);
    }
  }

  /**
   * Stop a sound by key (no-op for Web Audio API as sounds auto-stop)
   */
  stop(_key: string) {
    // Individual sounds auto-stop with Web Audio API
    // No-op for compatibility
  }

  /**
   * Set master volume
   */
  setGlobalVolume(volume: number) {
    this.masterVolume = volume;
  }

  /**
   * Stop all sounds (no-op as sounds auto-stop)
   */
  stopAll() {
    // Sounds auto-stop with Web Audio API
    // No-op for compatibility
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
export const audioManager = new AudioManager();

/**
 * Hook to play juice button sounds
 */
export function useJuiceAudio() {
  // Initialize on first use
  if (typeof window !== "undefined" && !audioManager["initialized"]) {
    audioManager.initialize();
  }

  return {
    playSound: (key: string, volume?: number) => audioManager.play(key, volume),
    stopSound: (key: string) => audioManager.stop(key),
    stopAll: () => audioManager.stopAll(),
  };
}

/**
 * Play a sound based on button variant
 */
export function playButtonSound(
  variant: string,
  soundEffect: string,
  volume: number = 0.5
) {
  // Map variants to specific sounds
  const soundMap: Record<string, string> = {
    success: "success",
    destructive: "error",
    loading: "loading",
  };

  const soundKey = soundMap[variant] || soundEffect;
  audioManager.play(soundKey, volume);
}
