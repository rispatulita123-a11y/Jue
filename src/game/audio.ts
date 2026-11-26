import type { BirdType, BlockMaterialType } from './types';

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;
  private lastStretchTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 1.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public playStretch(tension: number): void {
    const nowMs = performance.now();
    if (nowMs - this.lastStretchTime < 110) return;
    this.lastStretchTime = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 95 + tension * 120;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq + 22, t + 0.06);

    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  public playLaunch(birdType: BirdType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Elastic rubber twang
    const twang = ctx.createOscillator();
    const twangGain = ctx.createGain();
    twang.type = 'triangle';
    twang.frequency.setValueAtTime(165, t);
    twang.frequency.exponentialRampToValueAtTime(68, t + 0.24);
    twangGain.gain.setValueAtTime(0.24, t);
    twangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    twang.connect(twangGain);
    twangGain.connect(ctx.destination);
    twang.start(t);
    twang.stop(t + 0.27);

    // Bird launch chirp
    const chirp = ctx.createOscillator();
    const chirpGain = ctx.createGain();
    chirp.type = 'sine';
    const f0 = birdType === 'yellow' ? 680 : birdType === 'black' ? 320 : 520;
    chirp.frequency.setValueAtTime(f0, t + 0.03);
    chirp.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + 0.16);
    chirpGain.gain.setValueAtTime(0.14, t + 0.03);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    chirp.connect(chirpGain);
    chirpGain.connect(ctx.destination);
    chirp.start(t + 0.03);
    chirp.stop(t + 0.21);

    // Air whoosh
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, t);
      filter.frequency.exponentialRampToValueAtTime(1400, t + 0.22);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.14, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.28);
    }
  }

  public playAbility(birdType: BirdType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (birdType === 'yellow') {
      // Supersonic dash whip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(1350, t + 0.16);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    } else if (birdType === 'red') {
      // Shockwave pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.25);
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.29);
    } else {
      this.playExplosion();
    }
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Sub-bass boom
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 0.55);
    subGain.gain.setValueAtTime(0.45, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(t);
    sub.stop(t + 0.64);

    // Filtered blast roar
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.7);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.42, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.76);
    }
  }

  public playImpact(
    material: BlockMaterialType | 'pig' | 'ground' | undefined,
    intensity: number,
    destroyed: boolean,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const vol = Math.min(0.32, Math.max(0.04, intensity * 0.25));
    const jitter = 0.92 + Math.random() * 0.16;

    if (material === 'glass') {
      // Crystalline chime / shatter
      const count = destroyed ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime((1650 + i * 520 + Math.random() * 350) * jitter, t + i * 0.018);
        gain.gain.setValueAtTime(vol * 0.55, t + i * 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.018 + (destroyed ? 0.24 : 0.12));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + i * 0.018);
        osc.stop(t + i * 0.018 + 0.26);
      }
      return;
    }

    if (material === 'wood') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240 * jitter, t);
      osc.frequency.exponentialRampToValueAtTime(95, t + (destroyed ? 0.18 : 0.09));
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (destroyed ? 0.2 : 0.11));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
      return;
    }

    // Stone or ground thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    gain.gain.setValueAtTime(vol * 1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    if (destroyed && this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, t);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(vol * 0.7, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.24);
    }
  }

  public playPigPop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Comical pig oink + pop
    const oink = ctx.createOscillator();
    const oinkGain = ctx.createGain();
    oink.type = 'sawtooth';
    oink.frequency.setValueAtTime(220, t);
    oink.frequency.exponentialRampToValueAtTime(380, t + 0.07);
    oink.frequency.exponentialRampToValueAtTime(150, t + 0.16);
    oinkGain.gain.setValueAtTime(0.13, t);
    oinkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    oink.connect(oinkGain);
    oinkGain.connect(ctx.destination);
    oink.start(t);
    oink.stop(t + 0.19);

    const pop = ctx.createOscillator();
    const popGain = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(480, t + 0.08);
    pop.frequency.exponentialRampToValueAtTime(920, t + 0.14);
    popGain.gain.setValueAtTime(0.22, t + 0.08);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    pop.connect(popGain);
    popGain.connect(ctx.destination);
    pop.start(t + 0.08);
    pop.stop(t + 0.17);
  }

  public playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = t + idx * 0.11;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  public playDefeat(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [349.23, 311.13, 277.18, 233.08];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const start = t + idx * 0.16;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }
}
