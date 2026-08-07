/**
 * Original playground SFX via Web Audio — no commercial samples.
 */

export class FrogcrossAudio {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
    this.master = 0.26;
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
  }

  setEnabled(on) {
    this.enabled = on;
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
    this.tone(185, 0.22, "triangle", 0.06, 0.24);
  }
}
