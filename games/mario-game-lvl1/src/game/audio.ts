/* Synthesized chiptune audio — no external assets, all WebAudio. */

const MUTE_KEY = "spp-muted";

/** midi note number -> frequency */
const n = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  /** Must be called from a user gesture. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1;
    this.sfxGain.connect(this.master);
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ---------------- helpers ---------------- */

  private tone(
    freq0: number,
    freq1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = 0,
    dest?: AudioNode
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, when = 0, lowpass = 4000) {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  }

  private seq(notes: number[], step: number, type: OscillatorType, vol: number, when = 0) {
    notes.forEach((m, i) => this.tone(n(m), n(m), step * 0.9, type, vol, when + i * step));
  }

  /* ---------------- SFX ---------------- */

  jump() {
    this.tone(300, 620, 0.14, "square", 0.11);
  }
  coin() {
    this.tone(987, 987, 0.06, "square", 0.09);
    this.tone(1318, 1318, 0.28, "square", 0.09, 0.06);
  }
  stomp() {
    this.tone(260, 70, 0.12, "square", 0.14);
    this.noise(0.08, 0.1, 0, 1800);
  }
  bump() {
    this.tone(120, 90, 0.08, "square", 0.12);
  }
  brick() {
    this.noise(0.18, 0.16, 0, 2600);
    this.tone(320, 90, 0.14, "square", 0.1);
  }
  powerupAppear() {
    this.tone(200, 720, 0.32, "square", 0.09);
  }
  powerup() {
    this.seq([72, 76, 79, 84], 0.07, "square", 0.1);
    this.seq([60, 64, 67, 72], 0.07, "triangle", 0.12);
  }
  oneUp() {
    this.seq([76, 79, 84, 88, 91], 0.08, "square", 0.1);
  }
  death() {
    this.seq([71, 67, 64, 60, 55, 48], 0.12, "square", 0.11);
  }
  flag() {
    for (let i = 0; i < 12; i++) this.tone(1300 - i * 90, 1200 - i * 90, 0.06, "square", 0.06, i * 0.06);
  }
  victory() {
    this.seq([67, 67, 67, 72, 76, 79, 84, 88], 0.11, "square", 0.11, 0.1);
    this.seq([55, 55, 55, 60, 64, 67, 72, 76], 0.11, "triangle", 0.1, 0.1);
  }
  pause() {
    this.tone(660, 660, 0.07, "square", 0.08);
    this.tone(440, 440, 0.09, "square", 0.08, 0.08);
  }
  select() {
    this.tone(800, 800, 0.06, "square", 0.08);
    this.tone(1000, 1000, 0.08, "square", 0.08, 0.05);
  }
  tick() {
    this.tone(1100, 1100, 0.04, "square", 0.05);
  }
  growShrink() {
    this.tone(500, 180, 0.18, "square", 0.1);
  }

  /* ---------------- Music (original looping tune) ---------------- */

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicGain) return;
    const stepDur = 60 / 138 / 2; // 8th notes at 138bpm
    // cheerful original 32-step loop (A section + B section)
    const melody = [
      76, 79, 84, 79, 86, 84, 79, 76,
      77, 81, 86, 81, 88, 86, 81, 77,
      74, 77, 81, 77, 84, 81, 77, 74,
      72, 76, 81, 79, 77, 74, 72, 67,
    ];
    const bass = [48, 48, 50, 50, 53, 53, 55, 55, 45, 45, 48, 48, 43, 43, 55, 55];
    while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
      const s = this.step % 32;
      const t = this.nextNoteTime - this.ctx.currentTime;
      // melody (square)
      if (melody[s] > 0) {
        const m = melody[s];
        this.musicNote(n(m), t, stepDur * 0.92, "square", 0.045);
        this.musicNote(n(m + 12), t, stepDur * 0.92, "triangle", 0.03);
      }
      // bass on every other 8th
      if (s % 2 === 0) {
        const b = bass[(s / 2) % 16];
        this.musicNote(n(b), t, stepDur * 1.8, "triangle", 0.075);
      }
      // hi-hat
      if (s % 2 === 1) this.musicNoise(t, 0.012, 6000);
      this.nextNoteTime += stepDur;
      this.step++;
    }
  }

  private musicNote(freq: number, when: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private musicNoise(when: number, dur: number, lowpass: number) {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t);
  }
}
