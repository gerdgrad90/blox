import { SurfaceType } from './types';

/**
 * Procedural Web Audio Synth for Blox World
 * Generates classic Roblox-style "Oof!", coin chimes, jump boings, and fanfares without external audio files.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // Check saved mute preference
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('blox_muted') === 'true';
    }
  }

  private initCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('blox_muted', String(this.muted));
    }
    return this.muted;
  }

  public playFootstep(surface: SurfaceType = 'stone', isCrouching: boolean = false) {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const volScale = isCrouching ? 0.42 : 1.0;

    if (surface === 'wood') {
      // Hollow wooden plank knock + resonant low thud
      const osc = ctx.createOscillator();
      const bodyOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const pitchJitter = 0.92 + Math.random() * 0.16;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(72 * pitchJitter, now + 0.085);

      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(115 * pitchJitter, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(48, now + 0.1);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280 * pitchJitter, now);
      filter.Q.setValueAtTime(2.4, now);

      gain.gain.setValueAtTime(0.11 * volScale, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);

      osc.connect(filter);
      bodyOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      bodyOsc.start(now);
      osc.stop(now + 0.11);
      bodyOsc.stop(now + 0.11);
    } else if (surface === 'grass') {
      // Soft leafy/turf rustle + muted earth thump
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1100 + Math.random() * 450, now);
      bandpass.Q.setValueAtTime(0.9, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.004, now);
      noiseGain.gain.linearRampToValueAtTime(0.075 * volScale, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noise.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.125);

      // Soft soil thump underneath
      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      thump.frequency.setValueAtTime(85 + Math.random() * 15, now);
      thump.frequency.exponentialRampToValueAtTime(38, now + 0.07);
      thumpGain.gain.setValueAtTime(0.045 * volScale, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thump.start(now);
      thump.stop(now + 0.08);
    } else {
      // Stone / concrete: crisp hard tap + filtered grit click
      const noise = ctx.createBufferSource();
      noise.buffer = this.getNoiseBuffer(ctx);

      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'bandpass';
      highFilter.frequency.setValueAtTime(1750 + Math.random() * 400, now);
      highFilter.Q.setValueAtTime(2.6, now);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.09 * volScale, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

      noise.connect(highFilter);
      highFilter.connect(clickGain);
      clickGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.055);

      const heelOsc = ctx.createOscillator();
      const heelGain = ctx.createGain();
      heelOsc.type = 'triangle';
      heelOsc.frequency.setValueAtTime(145 + Math.random() * 25, now);
      heelOsc.frequency.exponentialRampToValueAtTime(52, now + 0.06);
      heelGain.gain.setValueAtTime(0.07 * volScale, now);
      heelGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      heelOsc.connect(heelGain);
      heelGain.connect(ctx.destination);
      heelOsc.start(now);
      heelOsc.stop(now + 0.07);
    }
  }

  public playJump() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  public playSuperJump() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  }

  public playPortalShoot(kind: 'blue' | 'orange') {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const isBlue = kind === 'blue';

    // Harmonic dual-oscillator plasma shot sweep
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isBlue ? 1400 : 950, now);
    filter.frequency.exponentialRampToValueAtTime(isBlue ? 360 : 240, now + 0.24);
    filter.Q.setValueAtTime(2.6, now);

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(isBlue ? 880 : 620, now);
    osc1.frequency.exponentialRampToValueAtTime(isBlue ? 210 : 145, now + 0.24);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(isBlue ? 1320 : 930, now);
    osc2.frequency.exponentialRampToValueAtTime(isBlue ? 540 : 380, now + 0.18);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.27);
    osc2.stop(now + 0.27);
  }

  public playPortalWarp() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Interdimensional warp shimmer + deep whoosh
    const freqs = [240, 360, 540];
    freqs.forEach((base, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 2.2, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(base * 0.85, now + 0.34);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.18 : 0.1, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  /**
   * Iconic Roblox "OOF!" sound procedural recreation:
   * Quick pitch descent with formant vowel resonance.
   */
  public playOof() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, ctx.currentTime);
    filter.Q.setValueAtTime(3.5, ctx.currentTime);

    // Pitch descent
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(260, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.22);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(280, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(105, ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.24);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.24);
    osc2.stop(ctx.currentTime + 0.24);
  }

  public playCoin() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.14, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.16);
    });
  }

  public playGem() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [659.25, 880, 1318.51, 1760].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  public playCheckpoint() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);

      gain.gain.setValueAtTime(0.16, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.3);
    });
  }

  public playSwordSlash() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  public playPlaceBlock() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }

  public playSpeedCoil() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  public playGravityCoil() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  public playVictory() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Classic celebratory fanfare
    const chords = [
      { f: 523.25, d: 0.15, t: 0 },
      { f: 523.25, d: 0.15, t: 0.16 },
      { f: 523.25, d: 0.15, t: 0.32 },
      { f: 659.25, d: 0.3, t: 0.48 },
      { f: 587.33, d: 0.15, t: 0.8 },
      { f: 659.25, d: 0.15, t: 0.96 },
      { f: 783.99, d: 0.6, t: 1.12 },
    ];
    chords.forEach(({ f, d, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

  public playAchievement() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Classic Roblox Badge fanfare arpeggio: C5 -> E5 -> G5 -> C6 with sparkle
    const notes = [
      { f: 523.25, d: 0.12, t: 0.0, vol: 0.22 },
      { f: 659.25, d: 0.12, t: 0.09, vol: 0.24 },
      { f: 783.99, d: 0.14, t: 0.18, vol: 0.26 },
      { f: 1046.5, d: 0.45, t: 0.28, vol: 0.32 },
      { f: 2093.0, d: 0.5, t: 0.30, vol: 0.12 }, // Shimmer harmonic
    ];

    notes.forEach(({ f, d, t, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(vol, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

  public playPollenPop() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = 600 + Math.random() * 200;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }

  public playHoneyConvert() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [587.33, 739.99, 880.0, 1174.66].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      gain.gain.setValueAtTime(0.18, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.2);
    });
  }

  public playBeeBuzz() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  }

  public playHatchBee() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.25);
    });
  }

  // ==========================================
  // ROBLOX DOORS HORROR SOUND SYNTHESIS
  // ==========================================

  public playFloorCreak() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    const base = 75 + Math.random() * 45;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * 0.72, now + 0.09);
    osc.frequency.linearRampToValueAtTime(base * 0.95, now + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(260, now);
    filter.Q.setValueAtTime(5.5, now);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playDoorOpen() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Brass handle latch click
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(920, now);
    latchOsc.frequency.exponentialRampToValueAtTime(240, now + 0.05);
    latchGain.gain.setValueAtTime(0.16, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.06);

    // 2. Heavy wooden door hinge creak & thud
    const creakOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const creakGain = ctx.createGain();
    creakOsc.type = 'sawtooth';
    creakOsc.frequency.setValueAtTime(140, now + 0.05);
    creakOsc.frequency.linearRampToValueAtTime(85, now + 0.28);
    creakOsc.frequency.linearRampToValueAtTime(115, now + 0.48);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now + 0.05);

    creakGain.gain.setValueAtTime(0.18, now + 0.05);
    creakGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    creakOsc.connect(filter);
    filter.connect(creakGain);
    creakGain.connect(ctx.destination);
    creakOsc.start(now + 0.05);
    creakOsc.stop(now + 0.53);
  }

  public playLightFlicker() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.setValueAtTime(1950, now + 0.04);
    osc.frequency.setValueAtTime(90, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playRushRoar() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(62, now);
    osc1.frequency.linearRampToValueAtTime(135, now + 0.6);
    osc1.frequency.linearRampToValueAtTime(48, now + 1.4);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(93, now);
    osc2.frequency.linearRampToValueAtTime(195, now + 0.6);
    osc2.frequency.linearRampToValueAtTime(55, now + 1.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.46);
    osc2.stop(now + 1.46);
  }

  public playRushApproach() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const buzz = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(44, now);
    sub.frequency.exponentialRampToValueAtTime(108, now + 1.15);

    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(75, now);
    buzz.frequency.exponentialRampToValueAtTime(185, now + 1.15);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.linearRampToValueAtTime(980, now + 1.15);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.85);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    sub.connect(filter);
    buzz.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    sub.start(now);
    buzz.start(now);
    sub.stop(now + 1.22);
    buzz.stop(now + 1.22);
  }

  public playScreechPsst() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // High frequency whisper "Psst!"
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.18);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.setValueAtTime(4.0, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playScreechRepel() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.32);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playEyesHum() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [185, 233.08, 311.13].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  public playClosetHide() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playFigureHeartbeat() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 68 : 54, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.16);
      gain.gain.setValueAtTime(0.24, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.19);
    });
  }

  public playElevatorClose() {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Heavy metallic gate slam + motor descent
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.9);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.96);
  }

  public playEmoteSound(emoteId: string) {
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (emoteId === 'wave') {
      // Friendly two-note chime
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.11, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.23);
      });
    } else if (emoteId === 'dance') {
      // Upbeat disco arpeggio
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.085);
        gain.gain.setValueAtTime(0.12, now + idx * 0.085);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.085 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.085);
        osc.stop(now + idx * 0.085 + 0.21);
      });
    } else if (emoteId === 'laugh') {
      // Playful staccato "ha-ha-ha" bounce
      [587.33, 493.88, 523.25, 440].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + idx * 0.11 + 0.06);
        gain.gain.setValueAtTime(0.13, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.11);
      });
    } else if (emoteId === 'cheer') {
      // Celebratory major chord fanfare
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.11, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.34);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.35);
      });
    } else if (emoteId === 'salute') {
      // Crisp fifth interval snap
      [392, 587.33].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.19);
      });
    } else if (emoteId === 'flip') {
      // Acrobatics whoosh sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.55);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (emoteId === 'thumbs_up') {
      // Bright approving major triad chime (C5 -> G5 -> C6)
      [523.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.065);
        gain.gain.setValueAtTime(0.12, now + idx * 0.065);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.065);
        osc.stop(now + idx * 0.065 + 0.25);
      });
    } else if (emoteId === 'peace') {
      // Twin-note shimmering harmony (D5 -> F#5 -> A5)
      [587.33, 739.99, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.12, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.26);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.27);
      });
    }
  }
}

export const sound = new SoundSystem();
