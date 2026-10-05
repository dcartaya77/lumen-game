export type SfxName = 'shoot' | 'hit' | 'kill' | 'elite_kill' | 'pickup' | 'levelup' | 'hurt' | 'nova' | 'beam' | 'boss' | 'win' | 'lose';

/**
 * Efectos de sonido sintetizados con Web Audio: cero assets, ~2 KB.
 * Cada efecto es una receta corta (osciladores + envolvente + ruido opcional).
 * Variación aleatoria de tono para que los sonidos repetidos no cansen.
 * Límite de voces simultáneas y "throttle" por nombre para no saturar en hordas.
 */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private readonly maxVoices = 10;
  private readonly lastPlayed = new Map<SfxName, number>();
  private readonly minGap: Partial<Record<SfxName, number>> = { shoot: 0.05, hit: 0.03, kill: 0.04, pickup: 0.04 };

  /** Debe llamarse desde un gesto del usuario (los navegadores bloquean el audio si no). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Búfer de ruido blanco reutilizable para golpes y explosiones.
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  play(name: SfxName, intensity = 1): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gap = this.minGap[name];
    if (gap && now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    if (this.voices >= this.maxVoices && name !== 'levelup' && name !== 'win' && name !== 'lose') return;
    this.lastPlayed.set(name, now);
    const v = 0.9 + Math.random() * 0.2; // variación de tono ±10%
    switch (name) {
      case 'shoot':
        this.tone('triangle', 520 * v, 180 * v, 0.07, 0.08 * intensity);
        break;
      case 'beam':
        this.tone('sawtooth', 220 * v, 880 * v, 0.18, 0.08);
        this.noiseBurst(0.12, 0.05, 1800);
        break;
      case 'nova':
        this.tone('sine', 140 * v, 40, 0.4, 0.2);
        this.noiseBurst(0.3, 0.1, 600);
        break;
      case 'hit':
        this.noiseBurst(0.05, 0.08 * intensity, 2400);
        break;
      case 'kill':
        this.tone('square', 300 * v, 60, 0.12, 0.07);
        this.noiseBurst(0.08, 0.05, 1200);
        break;
      case 'elite_kill':
        this.tone('square', 180, 30, 0.35, 0.2);
        this.noiseBurst(0.35, 0.2, 500);
        break;
      case 'pickup':
        this.tone('sine', 880 * v, 1320 * v, 0.08, 0.05);
        break;
      case 'hurt':
        this.tone('sawtooth', 160, 60, 0.18, 0.18);
        this.noiseBurst(0.12, 0.1, 900);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.14, i * 0.07));
        break;
      case 'boss':
        this.tone('sawtooth', 70, 45, 1.2, 0.25);
        this.noiseBurst(0.8, 0.15, 300);
        break;
      case 'win':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.4, 0.14, i * 0.1));
        break;
      case 'lose':
        [392, 311, 262, 196].forEach((f, i) => this.tone('sine', f, f * 0.97, 0.45, 0.14, i * 0.18));
        break;
    }
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    this.track(osc);
  }

  private noiseBurst(dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    this.track(src);
  }

  private track(node: AudioScheduledSourceNode): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
      node.disconnect();
    };
  }
}

/** Instancia única: el AudioContext se comparte entre partidas. */
export const sfx = new Sfx();
