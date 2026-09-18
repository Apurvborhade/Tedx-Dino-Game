// ════════════════════════════════════════════════════════════════════════════
// Audio.ts — Web Audio synthesizer: jump, hit, milestone, transition
// ════════════════════════════════════════════════════════════════════════════

import { AUDIO_CONFIG } from '../config';
import { safeGetItem, safeSetItem } from './storage';

const MUTE_KEY = 'kalachakra.muted';

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted: boolean;
  private initialized = false;

  constructor() {
    this._muted = safeGetItem(MUTE_KEY) === 'true' || AUDIO_CONFIG.DEFAULT_MUTED;
  }

  /** Call on first user gesture */
  init(): void {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : AUDIO_CONFIG.MASTER_GAIN;
      this.masterGain.connect(this.ctx.destination);
      this.ctx.resume();
      this.initialized = true;
    } catch {
      // Audio unavailable — game runs silently
      this.ctx = null;
    }
  }

  /** Resume on visibility change */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  toggleMute(): void {
    this._muted = !this._muted;
    safeSetItem(MUTE_KEY, String(this._muted));
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : AUDIO_CONFIG.MASTER_GAIN;
    }
  }

  /** Square osc, 420→760 Hz over 90ms */
  playJump(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(760, now + 0.09);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.008);
    gain.gain.linearRampToValueAtTime(0, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /** Sawtooth 220→60 Hz over 320ms + noise burst */
  playHit(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Sawtooth sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.32);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.32);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);

    // Noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.linearRampToValueAtTime(0, now + 0.06);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.07);
  }

  /** Two square blips: 880Hz then 1320Hz */
  playMilestone(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = i === 0 ? 880 : 1320;
      const start = now + i * 0.095;
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.linearRampToValueAtTime(0, start + 0.055);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.06);
    }
  }

  /** Single triangle blip 660Hz */
  playSpeedUp(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Triangle sweep 300→900Hz over 700ms through lowpass */
  playTransition(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.7);

    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  destroy(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
