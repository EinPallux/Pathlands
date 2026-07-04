import type { Simulation } from '../sim/simulation.ts';

// WebAudio engine: a small mixer (master/music/sfx buses) with procedurally
// synthesized SFX and an ambient music bed rendered into a looping buffer
// (ASSET_PIPELINE.md §5). Positional gain/pan from distance to the player.
// All wrapped defensively — if WebAudio is unavailable the game runs silent.

type CueFn = (ctx: AudioContext, dest: AudioNode, t: number) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private intensity = 0;
  private intensityTarget = 0;
  private started = false;
  private cues: Record<string, CueFn> = {};

  volumes = { master: 0.8, music: 0.5, sfx: 0.85 };

  constructor() {
    this.buildCues();
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  async resume(): Promise<void> {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.setupGraph();
      }
      await this.ctx.resume();
    } catch (err) {
      console.warn('[audio] unavailable:', err);
      this.ctx = null;
    }
  }

  private setupGraph(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(ctx.destination);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 500;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicFilter.connect(this.musicBus);
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.volumes.sfx;
    this.sfxBus.connect(this.master);
  }

  startMusic(): void {
    if (!this.ctx || this.started) return;
    this.started = true;
    const buffer = this.renderMusicBuffer(this.ctx);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.musicFilter);
    src.start();
  }

  setVolumes(v: Partial<AudioEngine['volumes']>): void {
    Object.assign(this.volumes, v);
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
  }

  /** Consume one tick of events and play cues, panned by distance to player. */
  consume(sim: Simulation, px: number, py: number): void {
    if (!this.ctx) return;
    let combat = 0;
    for (const s of sim.events.sfx.all) this.play(s.cue, s.x ?? px, s.y ?? py, px, py, s.gain ?? 1);
    for (const hit of sim.events.hit.all) {
      combat = 1;
      if (hit.result !== 'evaded') this.play('sfx_hit', hit.x, hit.y, px, py, hit.result === 'crit' ? 1.2 : 0.8);
    }
    for (const d of sim.events.died.all) {
      combat = 1;
      this.play(d.rank === 'boss' ? 'sfx_boss_death' : 'sfx_enemy_death', d.x, d.y, px, py, 1);
    }
    this.intensityTarget = combat;
  }

  update(dt: number): void {
    if (!this.ctx) return;
    this.intensity += (this.intensityTarget - this.intensity) * Math.min(1, dt * 1.5);
    this.intensityTarget *= 0.94; // decays unless refreshed by combat
    const cutoff = 400 + this.intensity * 2600;
    this.musicFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.2);
  }

  private play(cue: string, x: number, y: number, px: number, py: number, gain: number): void {
    if (!this.ctx) return;
    const fn = this.cues[cue] ?? this.cues.sfx_hit;
    if (!fn) return;
    const dist = Math.hypot(x - px, y - py);
    const distGain = Math.max(0.05, 1 - dist / 40) * gain;
    if (distGain <= 0.02) return;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (x - px) / 24));
    const g = this.ctx.createGain();
    g.gain.value = distGain;
    panner.connect(g);
    g.connect(this.sfxBus);
    fn(this.ctx, panner, this.ctx.currentTime);
  }

  // ---- Synthesis toolkit ----
  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(ctx: AudioContext, dest: AudioNode, t: number, dur: number, freq: number, gain: number): void {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur);
  }

  private buildCues(): void {
    this.cues = {
      sfx_hit: (c, d, t) => {
        this.noise(c, d, t, 0.12, 1200, 0.5);
        this.tone(c, d, t, 180, 0.1, 'square', 0.2, 90);
      },
      sfx_cleave: (c, d, t) => {
        this.noise(c, d, t, 0.18, 2600, 0.35);
        this.tone(c, d, t, 240, 0.14, 'sawtooth', 0.18, 120);
      },
      sfx_slam: (c, d, t) => {
        this.noise(c, d, t, 0.22, 800, 0.6);
        this.tone(c, d, t, 120, 0.25, 'square', 0.4, 50);
      },
      sfx_whirl: (c, d, t) => this.tone(c, d, t, 300, 0.3, 'sawtooth', 0.25, 500),
      sfx_warcry: (c, d, t) => this.tone(c, d, t, 160, 0.5, 'sawtooth', 0.3, 220),
      sfx_sunder: (c, d, t) => {
        this.noise(c, d, t, 0.4, 500, 0.6);
        this.tone(c, d, t, 90, 0.4, 'square', 0.4, 40);
      },
      sfx_bulwark: (c, d, t) => this.tone(c, d, t, 220, 0.3, 'sine', 0.3, 330),
      sfx_claw: (c, d, t) => this.noise(c, d, t, 0.1, 2000, 0.4),
      sfx_bite: (c, d, t) => this.noise(c, d, t, 0.07, 3000, 0.35),
      sfx_smash: (c, d, t) => this.tone(c, d, t, 100, 0.28, 'square', 0.45, 45),
      sfx_firebolt: (c, d, t) => this.tone(c, d, t, 500, 0.25, 'sawtooth', 0.25, 180),
      sfx_projectile_impact: (c, d, t) => this.noise(c, d, t, 0.14, 1400, 0.4),
      sfx_enemy_death: (c, d, t) => {
        this.noise(c, d, t, 0.25, 700, 0.5);
        this.tone(c, d, t, 200, 0.2, 'sawtooth', 0.2, 60);
      },
      sfx_boss_death: (c, d, t) => {
        this.noise(c, d, t, 0.8, 400, 0.6);
        this.tone(c, d, t, 80, 0.9, 'square', 0.5, 30);
      },
      sfx_boss_intro: (c, d, t) => this.tone(c, d, t, 70, 1.2, 'sawtooth', 0.5, 120),
      sfx_boss_phase: (c, d, t) => this.tone(c, d, t, 110, 0.6, 'square', 0.45, 200),
      sfx_levelup: (c, d, t) => {
        this.tone(c, d, t, 440, 0.15, 'sine', 0.3, 660);
        this.tone(c, d, t + 0.12, 660, 0.25, 'sine', 0.3, 880);
      },
      sfx_gold: (c, d, t) => this.tone(c, d, t, 900, 0.08, 'triangle', 0.2, 1300),
      sfx_pickup_common: (c, d, t) => this.tone(c, d, t, 500, 0.08, 'triangle', 0.18, 700),
      sfx_pickup_magic: (c, d, t) => this.tone(c, d, t, 600, 0.12, 'triangle', 0.22, 900),
      sfx_pickup_rare: (c, d, t) => this.tone(c, d, t, 700, 0.16, 'sine', 0.25, 1100),
      sfx_pickup_unique: (c, d, t) => {
        this.tone(c, d, t, 500, 0.3, 'sine', 0.3, 1000);
        this.tone(c, d, t + 0.1, 800, 0.3, 'sine', 0.25, 1400);
      },
      sfx_dodge: (c, d, t) => this.noise(c, d, t, 0.14, 1800, 0.3),
      sfx_potion: (c, d, t) => this.tone(c, d, t, 400, 0.2, 'sine', 0.25, 800),
      sfx_waypoint: (c, d, t) => this.tone(c, d, t, 300, 0.5, 'sine', 0.3, 600),
      sfx_shrine: (c, d, t) => this.tone(c, d, t, 350, 0.5, 'triangle', 0.3, 700),
      sfx_respawn: (c, d, t) => this.tone(c, d, t, 200, 0.6, 'sine', 0.25, 400),
      sfx_player_death: (c, d, t) => this.tone(c, d, t, 300, 0.9, 'sawtooth', 0.4, 60),
    };
  }

  /** Render a looping ambient bed: a slow dark minor drone. */
  private renderMusicBuffer(ctx: AudioContext): AudioBuffer {
    const dur = 16;
    const rate = ctx.sampleRate;
    const n = dur * rate;
    const buf = ctx.createBuffer(2, n, rate);
    const roots = [55, 82.41, 110, 164.81]; // A1, E2, A2, E3 — open fifths
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / rate;
        let s = 0;
        for (let k = 0; k < roots.length; k++) {
          const detune = ch === 0 ? 1 : 1.004;
          const trem = 0.6 + 0.4 * Math.sin(t * (0.1 + k * 0.03) * Math.PI * 2 + k);
          s += Math.sin(t * roots[k]! * detune * Math.PI * 2) * trem * (0.12 / (k + 1));
        }
        // A slow swell.
        s *= 0.6 + 0.4 * Math.sin((t / dur) * Math.PI * 2);
        data[i] = s * 0.6;
      }
    }
    return buf;
  }
}
