// Where Is My Coin — tiny WebAudio beeps, no audio files. The context is
// created on the first user gesture, so browsers never block it.

/** Note frequencies (Hz) for the little win arpeggio. */
const WIN_NOTES = [523.25, 659.25, 783.99, 1046.5];

export function createSound(muted) {
  let context = null;
  let isMuted = muted;

  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  /** One short tone: frequency, seconds, wave shape, volume. */
  function tone(freq, seconds, type = 'sine', volume = 0.12) {
    if (isMuted) return;
    const ctx = ensure();
    if (ctx === null) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + seconds);
  }

  return {
    setMuted(value) {
      isMuted = value;
    },
    click() {
      tone(880, 0.04, 'sine', 0.06);
    },
    place() {
      tone(660, 0.09, 'sine', 0.14);
      tone(990, 0.07, 'sine', 0.08);
    },
    error() {
      tone(150, 0.16, 'square', 0.1);
    },
    hint() {
      tone(1174, 0.08, 'sine', 0.1);
      tone(1568, 0.12, 'sine', 0.1);
    },
    win() {
      WIN_NOTES.forEach((freq, index) => {
        window.setTimeout(() => tone(freq, 0.16, 'sine', 0.12), index * 110);
      });
    },
    fail() {
      tone(220, 0.2, 'triangle', 0.12);
      window.setTimeout(() => tone(165, 0.3, 'triangle', 0.12), 180);
    },
  };
}
