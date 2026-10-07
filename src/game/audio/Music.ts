import type { Sfx } from './Sfx';

type Chord = { root: number; tones: readonly number[] };

/** Am - F - C - G: cuatro compases de 8 pasos. Frecuencias de la fundamental en Hz. */
const CHORDS: readonly Chord[] = [
  { root: 110, tones: [0, 3, 7, 12, 15, 19] },
  { root: 87.31, tones: [0, 4, 7, 12, 16, 19] },
  { root: 130.81, tones: [0, 4, 7, 12, 16, 19] },
  { root: 98, tones: [0, 4, 7, 12, 14, 19] },
];
const ARP = [0, 2, 4, 5, 4, 2, 3, 1];

const hz = (root: number, semis: number) => root * 2 ** (semis / 12);

/**
 * Música ambiental procedural con Web Audio (sin assets): pad lento + arpegio suave.
 * La intensidad (0..1) acelera el pulso y añade un latido grave; en pausa baja el volumen.
 * Programa las notas con antelación corta para no depender de la precisión de los timers.
 */
export class Music {
  enabled = true;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer: number | null = null;
  private next = 0;
  private step = 0;
  private intensity = 0;
  private ducked = false;

  constructor(private readonly sfx: Sfx) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (!this.enabled || this.timer !== null) return;
    const a = this.sfx.audio();
    if (!a) return;
    this.ctx = a.ctx;
    this.out = a.ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, a.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(this.level(), a.ctx.currentTime + 2);
    this.out.connect(a.master);
    this.next = a.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.pump(), 100);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const out = this.out;
    const ctx = this.ctx;
    this.out = null;
    if (!out || !ctx) return;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    window.setTimeout(() => out.disconnect(), 800);
  }

  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  setDuck(ducked: boolean): void {
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.2);
  }

  private level(): number {
    return this.ducked ? 0.05 : 0.2;
  }

  private stepLen(): number {
    return 0.5 - this.intensity * 0.14;
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      if (ctx) this.next = Math.max(this.next, ctx.currentTime);
      return;
    }
    while (this.next < ctx.currentTime + 0.25) {
      this.playStep(this.next, this.step);
      this.next += this.stepLen();
      this.step++;
    }
  }

  private playStep(t: number, i: number): void {
    const chord = CHORDS[Math.floor(i / 8) % CHORDS.length]!;
    const s = i % 8;
    const len = this.stepLen();
    if (s === 0) {
      this.note('triangle', hz(chord.root, 0), t, len * 8, 0.5, 0.8);
      this.note('sine', hz(chord.root, 7), t, len * 8, 0.3, 0.8);
    }
    const tone = chord.tones[ARP[s]!]!;
    this.note('sine', hz(chord.root * 2, tone), t, len * 1.6, 0.22, 0.02);
    if (this.intensity > 0.45 && s % 2 === 0) this.note('sine', hz(chord.root / 2, 0), t, 0.18, 0.5, 0.005);
  }

  private note(type: OscillatorType, freq: number, t: number, dur: number, gain: number, attack: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.out!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => g.disconnect();
  }
}
