/**
 * Synthesizes the authentic Apple iOS iPhone Notification Tone ("Tri-tone")
 * using Web Audio API. Completely offline, zero network requests, instant execution.
 */
class AppleSoundSynthesizer {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Plays the world-famous Apple iPhone "Tri-tone" notification sound:
   * Notes: G#5 (830.6Hz) -> B5 (987.8Hz) -> E6 (1318.5Hz) with natural acoustic decay.
   */
  public playIPhoneChime(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note sequence: [Frequency (Hz), Start offset (s), Duration (s), Max Gain]
      const notes: [number, number, number, number][] = [
        [830.61, 0.00, 0.22, 0.32], // G#5
        [987.77, 0.13, 0.24, 0.35], // B5
        [1318.51, 0.26, 0.45, 0.40], // E6
      ];

      notes.forEach(([freq, offset, duration, maxGain]) => {
        const start = now + offset;
        const stop = start + duration;

        // Primary bell fundamental (Sine wave)
        const fundamental = ctx.createOscillator();
        fundamental.type = 'sine';
        fundamental.frequency.setValueAtTime(freq, start);

        // Harmonic overtone for natural glass/marimba resonance
        const overtone = ctx.createOscillator();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2, start);

        // Primary gain envelope with smooth exponential decay
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, start);
        gainNode.gain.linearRampToValueAtTime(maxGain, start + 0.012);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stop);

        // Overtone gain envelope
        const overtoneGain = ctx.createGain();
        overtoneGain.gain.setValueAtTime(0.0001, start);
        overtoneGain.gain.linearRampToValueAtTime(maxGain * 0.22, start + 0.01);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, stop * 0.7);

        // Audio routing
        fundamental.connect(gainNode);
        overtone.connect(overtoneGain);
        gainNode.connect(ctx.destination);
        overtoneGain.connect(ctx.destination);

        fundamental.start(start);
        overtone.start(start);
        fundamental.stop(stop);
        overtone.stop(stop);
      });
    } catch (e) {
      console.warn('[AppleSound] Unable to play iPhone chime:', e);
    }
  }
}

export const appleSoundSynthesizer = new AppleSoundSynthesizer();
export const playIPhoneNotificationSound = () => appleSoundSynthesizer.playIPhoneChime();
export default playIPhoneNotificationSound;

