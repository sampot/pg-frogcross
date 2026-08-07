/**
 * Original playground SFX + procedural BGM via Web Audio — no samples / commercial tunes.
 */

/** @param {number} midi */
function midiHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** 16-step (8th-note) loop — original bouncy crossing theme in C. */
const BASS = [36, 36, 43, 41, 36, 38, 43, 41, 36, 36, 41, 38, 36, 43, 45, 43];
const LEAD = [60, 64, 67, 72, 67, 64, 62, 60, 64, 67, 71, 72, 67, 64, 65, 67];
const PAD = [
  [60, 64, 67],
  [57, 60, 64],
  [55, 59, 62],
  [53, 57, 60],
];

export class FrogcrossAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.26;
    this.bgmGainLevel = 0.32;
    this.bpm = 112;

    this.bgmPlaying = false;
    this.bgmStart = 0;
    this.nextStep = 0;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.bgmTimer = null;
    /** @type {GainNode | null} */
    this.bgmBus = null;
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && !this.bgmBus) {
      this.bgmBus = this.ctx.createGain();
      this.bgmBus.gain.value = 0.0001;
      this.bgmBus.connect(this.ctx.destination);
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stopBgm();
  }

  /**
   * @param {number} [bpm]
   */
  startBgm(bpm = 112) {
    this.stopBgm();
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus) return;

    this.bpm = bpm;
    this.bgmPlaying = true;
    this.bgmStart = ctx.currentTime + 0.06;
    this.nextStep = 0;
    this.bgmBus.gain.cancelScheduledValues(ctx.currentTime);
    this.bgmBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.bgmBus.gain.exponentialRampToValueAtTime(
      this.bgmGainLevel * this.master,
      ctx.currentTime + 0.25,
    );
    this.scheduleBgm();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer != null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    const ctx = this.ctx;
    if (ctx && this.bgmBus) {
      const g = this.bgmBus.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(0.0001, g.value), ctx.currentTime);
      g.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    }
  }

  scheduleBgm() {
    if (!this.bgmPlaying || !this.enabled) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const stepDur = 60 / this.bpm / 2; // 8th notes
    const horizon = ctx.currentTime + 0.3;
    while (this.bgmStart + this.nextStep * stepDur < horizon) {
      const t = this.bgmStart + this.nextStep * stepDur;
      this.voiceStep(this.nextStep, t, stepDur);
      this.nextStep += 1;
    }
    this.bgmTimer = setTimeout(() => this.scheduleBgm(), 45);
  }

  /**
   * @param {number} step
   * @param {number} t
   * @param {number} stepDur
   */
  voiceStep(step, t, stepDur) {
    const i = step % 16;
    const bar = Math.floor(step / 16) % 4;

    // soft kick on quarters
    if (i % 2 === 0) this.kick(t, i % 4 === 0 ? 0.07 : 0.045);
    // light hat on offs
    if (i % 2 === 1) this.hat(t, 0.018);

    const bass = BASS[i];
    this.bass(midiHz(bass), t, stepDur * 0.9);

    if (i % 4 === 0) {
      const chord = PAD[bar % PAD.length];
      for (const n of chord) this.pad(midiHz(n), t, stepDur * 3.6);
    }

    // lead every step, quieter on offs
    const leadGain = i % 2 === 0 ? 0.055 : 0.032;
    this.lead(midiHz(LEAD[i]), t, stepDur * 0.75, leadGain);
  }

  /**
   * @param {number} t
   * @param {number} gain
   */
  kick(t, gain) {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * @param {number} t
   * @param {number} gain
   */
  hat(t, gain) {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;
    const bufLen = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = buf;
    filter.type = "highpass";
    filter.frequency.value = 6000;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + 0.05);
  }

  /**
   * @param {number} freq
   * @param {number} t
   * @param {number} dur
   */
  bass(freq, t, dur) {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * @param {number} freq
   * @param {number} t
   * @param {number} dur
   */
  pad(freq, t, dur) {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * @param {number} freq
   * @param {number} t
   * @param {number} dur
   * @param {number} gain
   */
  lead(freq, t, dur, gain) {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * @param {number} freq
   * @param {number} dur
   * @param {OscillatorType} [type]
   * @param {number} [gain]
   * @param {number} [when]
   */
  tone(freq, dur, type = "square", gain = 0.12, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * this.master, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  start() {
    this.tone(330, 0.07, "square", 0.1);
    this.tone(440, 0.09, "triangle", 0.09, 0.06);
    this.tone(554, 0.12, "sine", 0.08, 0.12);
  }

  hop() {
    this.tone(420 + Math.random() * 40, 0.05, "square", 0.08);
    this.tone(280, 0.04, "triangle", 0.05, 0.03);
  }

  home() {
    this.tone(523, 0.08, "square", 0.11);
    this.tone(659, 0.1, "triangle", 0.1, 0.08);
    this.tone(784, 0.14, "sine", 0.09, 0.16);
  }

  splash() {
    this.tone(180, 0.08, "sawtooth", 0.07);
    this.tone(120, 0.14, "triangle", 0.06, 0.05);
    this.tone(90, 0.18, "sine", 0.05, 0.1);
  }

  crunch() {
    this.tone(140, 0.07, "square", 0.1);
    this.tone(90, 0.16, "sawtooth", 0.08, 0.05);
  }

  level() {
    this.tone(392, 0.08, "square", 0.1);
    this.tone(494, 0.08, "triangle", 0.09, 0.08);
    this.tone(587, 0.1, "sine", 0.09, 0.16);
    this.tone(784, 0.16, "square", 0.08, 0.26);
  }

  lose() {
    this.tone(330, 0.12, "triangle", 0.08);
    this.tone(247, 0.16, "sine", 0.07, 0.12);
    this.tone(220, 0.22, "triangle", 0.06, 0.24);
  }
}
