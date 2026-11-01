// The synth beside the drum board (synthboard.js lays it out, synthkit.js builds it): an analog poly
// synth, made with Web Audio as it is played, with nothing to download, as the poly synths of the
// early 1980s made theirs. Each of its six voices is one oscillator, as a Juno's is: a saw, a pulse
// made from it whose width can move, a square an octave down (the sub) and noise, mixed, through a
// low-pass of 24 dB an octave (two in a row, the second resonant) and an amp, each with its own
// envelope (attack, decay, sustain, release). Harder keys are louder and open the filter more, and
// higher notes open it a little too. One LFO moves every voice's pitch (VIBRATO, and a MIDI
// keyboard's mod wheel), filter (WAH) and pulse width (PWM). After the voices: a drive (a soft clip,
// harder with more in), a chorus (two short delays whose time sways, one to each side), and its level,
// into the mixer's 'synth' channel.
// In poly a note takes a voice of its own: one let go longest ago, else the one held longest; each
// note's pitch drifts a little (a third of DETUNE), as hardware's does. With the Mono switch the
// voices play the one note together, spread apart in pitch by DETUNE (one voice with it at none):
// the last key held sounds, and a key pressed while another is held glides there (GLIDE) without
// starting the envelopes again (legato), as does letting it go back to one still held. Each voice's
// filter sits a little apart from the others'. The voices are made the first time a note plays and
// run from then on, their amps closed between notes. A MIDI keyboard's sustain pedal holds the notes
// let go until it is let go too, and its pitch bend bends them two semitones either way.
// The knobs (0…1 each, as on the panel), Mono, the preset chosen last and the octave the keys play
// in are kept for the next visit (localStorage); a preset sets all the knobs, and Mono, at once.
import { pageStorage } from './sound.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */

/** How many voices: notes at once in poly, and stacked on the one note in mono. */
export const VOICES = 6;

/** The keys on the synth: three octaves and the C above, from LOWEST with the octave at 0. */
export const KEYS = 37;
/** The lowest key's note (MIDI) with the octave at 0: C3; middle C (C4, 60) is its 13th key. */
export const LOWEST = 48;
/** How far the octave buttons move the keys, down and up. */
export const OCTAVES = Object.freeze({ min: -2, max: 2 });

/** @typedef {'osc' | 'lfo' | 'filter' | 'fenv' | 'aenv' | 'out'} Section */

/**
 * The panel's sections, in its two rows, left to right: what each is called on it, and in words.
 * @type {readonly { id: Section, label: string, name: string }[]}
 */
export const SECTIONS = Object.freeze([
  { id: 'osc', label: 'OSCILLATOR', name: 'Oscillator' },
  { id: 'lfo', label: 'LFO', name: 'LFO' },
  { id: 'filter', label: 'FILTER', name: 'Filter' },
  { id: 'fenv', label: 'FILTER ENVELOPE', name: 'Filter envelope' },
  { id: 'aenv', label: 'AMP ENVELOPE', name: 'Amp envelope' },
  { id: 'out', label: 'OUTPUT', name: 'Output' },
]);

/** The knobs as the synth comes: a warm, bright poly sound that speaks at once. */
const DEFAULTS = {
  saw: 0.75, pulse: 0.35, width: 0.35, sub: 0.2, noise: 0, detune: 0.25,
  rate: 0.45, vibrato: 0, wah: 0, pwm: 0.25,
  cutoff: 0.5, resonance: 0.2, amount: 0.4,
  filterAttack: 0.25, filterDecay: 0.55, filterSustain: 0.35, filterRelease: 0.45,
  attack: 0.2, decay: 0.55, sustain: 0.75, release: 0.5,
  glide: 0.15, drive: 0.15, chorus: 0.45, level: 0.7,
};

/** @typedef {keyof typeof DEFAULTS} SynthKnob */
/** The knobs, each 0…1. @typedef {Record<SynthKnob, number>} SynthKnobs */

/** @type {Readonly<SynthKnobs>} */
export const DEFAULT_SYNTH = Object.freeze({ ...DEFAULTS });

/**
 * A knob: its id, its section, what it is called on the panel (short) and in words (the card's
 * slider, under its section's name).
 * @typedef {{ id: SynthKnob, section: Section, label: string, name: string }} KnobSpec
 */

/** The knobs, section by section, in the order the panel and the card show them. @type {readonly KnobSpec[]} */
export const SYNTH_KNOBS = Object.freeze([
  { id: 'saw', section: 'osc', label: 'SAW', name: 'Saw' },
  { id: 'pulse', section: 'osc', label: 'PULSE', name: 'Pulse' },
  { id: 'width', section: 'osc', label: 'WIDTH', name: 'Pulse width' },
  { id: 'sub', section: 'osc', label: 'SUB', name: 'Sub-oscillator' },
  { id: 'noise', section: 'osc', label: 'NOISE', name: 'Noise' },
  { id: 'detune', section: 'osc', label: 'DETUNE', name: 'Detune' },
  { id: 'rate', section: 'lfo', label: 'RATE', name: 'Rate' },
  { id: 'vibrato', section: 'lfo', label: 'VIBRATO', name: 'Vibrato' },
  { id: 'wah', section: 'lfo', label: 'WAH', name: 'Wah' },
  { id: 'pwm', section: 'lfo', label: 'PWM', name: 'Pulse width moved' },
  { id: 'cutoff', section: 'filter', label: 'CUTOFF', name: 'Cutoff' },
  { id: 'resonance', section: 'filter', label: 'RESO', name: 'Resonance' },
  { id: 'amount', section: 'filter', label: 'ENV', name: 'Envelope amount' },
  { id: 'filterAttack', section: 'fenv', label: 'A', name: 'Attack' },
  { id: 'filterDecay', section: 'fenv', label: 'D', name: 'Decay' },
  { id: 'filterSustain', section: 'fenv', label: 'S', name: 'Sustain' },
  { id: 'filterRelease', section: 'fenv', label: 'R', name: 'Release' },
  { id: 'attack', section: 'aenv', label: 'A', name: 'Attack' },
  { id: 'decay', section: 'aenv', label: 'D', name: 'Decay' },
  { id: 'sustain', section: 'aenv', label: 'S', name: 'Sustain' },
  { id: 'release', section: 'aenv', label: 'R', name: 'Release' },
  { id: 'glide', section: 'out', label: 'GLIDE', name: 'Glide' },
  { id: 'drive', section: 'out', label: 'DRIVE', name: 'Drive' },
  { id: 'chorus', section: 'out', label: 'CHORUS', name: 'Chorus' },
  { id: 'level', section: 'out', label: 'LEVEL', name: 'Level' },
]);

/** The knobs' ids. @type {readonly SynthKnob[]} */
const IDS = SYNTH_KNOBS.map((k) => k.id);

/**
 * A preset: its id, its name, whether it is mono, and its knobs (those not given as the synth comes).
 * @typedef {{ id: string, name: string, mono: boolean, knobs: Partial<SynthKnobs> }} Preset
 */

/** The sounds on the synth, to start from: four poly, then four mono. @type {readonly Preset[]} */
export const PRESETS = Object.freeze([
  {
    id: 'pad', name: 'Pad', mono: false,
    knobs: { saw: 0.6, pulse: 0.55, width: 0.3, sub: 0, detune: 0.35, rate: 0.3, pwm: 0.4, cutoff: 0.55, resonance: 0.15, amount: 0.2, filterAttack: 0.7, filterDecay: 0.7, filterSustain: 0.6, filterRelease: 0.72, attack: 0.72, decay: 0.6, sustain: 0.85, release: 0.74, chorus: 0.65, drive: 0.05, glide: 0 },
  },
  {
    id: 'strings', name: 'Strings', mono: false,
    knobs: { saw: 0.15, pulse: 0.85, width: 0.25, sub: 0, detune: 0.3, rate: 0.36, pwm: 0.55, vibrato: 0.08, cutoff: 0.62, resonance: 0.08, amount: 0.12, filterAttack: 0.58, filterSustain: 0.7, filterRelease: 0.64, attack: 0.58, decay: 0.55, sustain: 0.9, release: 0.64, chorus: 0.8, drive: 0, glide: 0 },
  },
  {
    id: 'brass', name: 'Brass', mono: false,
    knobs: { saw: 0.9, pulse: 0, sub: 0.15, detune: 0.2, vibrato: 0.08, rate: 0.6, pwm: 0, cutoff: 0.36, resonance: 0.18, amount: 0.55, filterAttack: 0.5, filterDecay: 0.5, filterSustain: 0.45, filterRelease: 0.45, attack: 0.43, decay: 0.45, sustain: 0.85, release: 0.45, chorus: 0.25, drive: 0.2, glide: 0 },
  },
  {
    id: 'pluck', name: 'Pluck', mono: false,
    knobs: { saw: 0.7, pulse: 0.35, width: 0.5, sub: 0.1, detune: 0.2, pwm: 0, cutoff: 0.3, resonance: 0.35, amount: 0.62, filterAttack: 0, filterDecay: 0.42, filterSustain: 0, filterRelease: 0.4, attack: 0, decay: 0.55, sustain: 0, release: 0.45, chorus: 0.45, drive: 0.1, glide: 0 },
  },
  {
    id: 'bass', name: 'Fat Bass', mono: true,
    knobs: { saw: 0.85, pulse: 0, sub: 0.8, noise: 0, detune: 0.35, pwm: 0, cutoff: 0.28, resonance: 0.25, amount: 0.45, filterAttack: 0, filterDecay: 0.45, filterSustain: 0.2, filterRelease: 0.3, attack: 0, decay: 0.4, sustain: 0.8, release: 0.3, glide: 0.15, drive: 0.35, chorus: 0 },
  },
  {
    id: 'acid', name: 'Acid', mono: true,
    knobs: { saw: 0.9, pulse: 0, sub: 0, detune: 0, pwm: 0, cutoff: 0.24, resonance: 0.8, amount: 0.66, filterAttack: 0, filterDecay: 0.42, filterSustain: 0, filterRelease: 0.3, attack: 0, decay: 0.5, sustain: 0.75, release: 0.25, glide: 0.18, drive: 0.55, chorus: 0 },
  },
  {
    id: 'wobble', name: 'Wobble', mono: true,
    knobs: { saw: 0.85, pulse: 0, sub: 0.6, detune: 0.3, rate: 0.6, wah: 0.85, pwm: 0, cutoff: 0.45, resonance: 0.55, amount: 0.1, filterAttack: 0, filterSustain: 1, attack: 0.05, decay: 0.5, sustain: 1, release: 0.3, glide: 0.12, drive: 0.4, chorus: 0 },
  },
  {
    id: 'sweep', name: 'Sweep', mono: true,
    knobs: { saw: 0.7, pulse: 0.4, width: 0.4, sub: 0.15, detune: 0.45, rate: 0.35, pwm: 0.3, cutoff: 0.2, resonance: 0.6, amount: 0.75, filterAttack: 0.8, filterDecay: 0.72, filterSustain: 0.7, filterRelease: 0.72, attack: 0.45, decay: 0.6, sustain: 0.9, release: 0.66, chorus: 0.5, drive: 0.1, glide: 0.4 },
  },
]);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ── What the knobs mean ─────────────────────────────────────────────────────

/** An oscillator's level for its knob: its square, as the ear hears it about evenly. @param {number} k */
export const levelOf = (k) => clamp(k, 0, 1) ** 2;
/** The pulse's width (of the wave) for its knob: a square (a half) at 0, down to a twentieth at 1. @param {number} k */
export const pulseDuty = (k) => 0.5 - 0.45 * clamp(k, 0, 1);
/** DETUNE: in mono, how far the outer voices are either side of the note, in cents (in poly a note drifts a third of it). @param {number} k */
export const detuneCents = (k) => 30 * clamp(k, 0, 1);
/** The LFO's rate in Hz: from once in 12 seconds to 20 a second. @param {number} k */
export const lfoHz = (k) => 0.08 * 2 ** (8 * clamp(k, 0, 1));
/** Vibrato, as far as the pitch goes either way, in cents. @param {number} k */
export const vibratoCents = (k) => 60 * clamp(k, 0, 1) ** 2;
/** Wah, as far as the cutoff goes either way, in cents (three octaves at most). @param {number} k */
export const wahCents = (k) => 3600 * clamp(k, 0, 1) ** 2;
/** PWM, as far as the pulse's width goes either way (of the wave). @param {number} k */
export const pwmDepth = (k) => 0.21 * clamp(k, 0, 1);
/** The cutoff in Hz: from 30 Hz to about 18 kHz, an octave every ninth of a turn or so. @param {number} k */
export const cutoffHz = (k) => 30 * 2 ** (9.2 * clamp(k, 0, 1));
/** The resonance as the second filter's Q, in dB (as Web Audio takes a low-pass's): flat to a squeal. @param {number} k */
export const resonanceDb = (k) => 26 * clamp(k, 0, 1);
/** How far the filter's envelope opens it, in octaves. @param {number} k */
export const envOctaves = (k) => 6 * clamp(k, 0, 1);
/** An attack, in seconds: a thousandth to eight. @param {number} k */
export const attackSeconds = (k) => 0.001 * 2 ** (13 * clamp(k, 0, 1));
/** A decay or a release, in seconds: five thousandths to ten. @param {number} k */
export const decaySeconds = (k) => 0.005 * 2 ** (11 * clamp(k, 0, 1));
/** The glide in mono, in seconds: none at 0, a second and a half at most. @param {number} k */
export const glideSeconds = (k) => (k <= 0 ? 0 : 0.02 + 1.5 * clamp(k, 0, 1) ** 2);
/** The drive: how much louder the voices go into the soft clip. @param {number} k */
export const driveGain = (k) => 1 + 9 * clamp(k, 0, 1) ** 2;
/** The chorus: how loud each side's swaying delay is beside what goes in. @param {number} k */
export const chorusMix = (k) => 0.55 * clamp(k, 0, 1);
/** The synth's level into the mixer. @param {number} k */
export const synthLevel = (k) => 1.2 * clamp(k, 0, 1) ** 2;
/** A note's loudness for a velocity 0…1: never quite silent. @param {number} v */
export const velocityLevel = (v) => 0.2 + 0.8 * clamp(v, 0, 1);

/**
 * A knob's name in words standing alone: an envelope's with which envelope it is, the LFO's rate as
 * such ('Filter envelope attack', 'LFO rate', 'Cutoff').
 * @param {SynthKnob} id
 */
export function knobName(id) {
  const k = SYNTH_KNOBS.find((x) => x.id === id);
  if (!k) return String(id);
  if (k.section === 'fenv' || k.section === 'aenv') return `${SECTIONS.find((s) => s.id === k.section)?.name} ${k.name.toLowerCase()}`;
  return id === 'rate' ? 'LFO rate' : k.name;
}

/** @param {number} s seconds */
const seconds = (s) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`);
/** @param {number} hz */
const hertz = (hz) => (hz < 1000 ? `${hz < 1 ? hz.toFixed(2) : hz < 10 ? hz.toFixed(1) : Math.round(hz)} Hz` : `${(hz / 1000).toFixed(1)} kHz`);
/** @param {number} k */
const percent = (k) => `${Math.round(clamp(k, 0, 1) * 100)}%`;

/**
 * How a knob reads, in words: a level or a mix in percent, a time, a rate, a cutoff, a depth.
 * @param {SynthKnob} id
 * @param {number} k
 */
export function synthText(id, k) {
  switch (id) {
    case 'width':
      return `${Math.round(pulseDuty(k) * 100)}%`;
    case 'detune':
      return k <= 0 ? 'none' : `${Math.round(detuneCents(k))} cents`;
    case 'rate':
      return hertz(lfoHz(k));
    case 'vibrato':
      return k <= 0 ? 'none' : `${Math.round(vibratoCents(k))} cents`;
    case 'wah': {
      const o = wahCents(k) / 1200;
      return k <= 0 ? 'none' : `${o < 1 ? o.toFixed(2) : o.toFixed(1)} octaves`;
    }
    case 'pwm':
      return k <= 0 ? 'none' : `${Math.round(pwmDepth(k) * 100)}%`;
    case 'cutoff':
      return hertz(cutoffHz(k));
    case 'amount':
      return k <= 0 ? 'none' : `${envOctaves(k).toFixed(1)} octaves`;
    case 'attack':
    case 'filterAttack':
      return seconds(attackSeconds(k));
    case 'decay':
    case 'release':
    case 'filterDecay':
    case 'filterRelease':
      return seconds(decaySeconds(k));
    case 'glide':
      return k <= 0 ? 'off' : seconds(glideSeconds(k));
    default:
      return percent(k);
  }
}

// ── Notes and keys ──────────────────────────────────────────────────────────

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const SPOKEN = ['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B'];
/** @param {number} n */
const pitchClass = (n) => ((n % 12) + 12) % 12;
/** A note's name and octave (MIDI 60 is C4): 'C♯4'. @param {number} n */
export const noteName = (n) => `${NAMES[pitchClass(n)]}${Math.floor(n / 12) - 1}`;
/** A note as it is said: 'C sharp 4'. @param {number} n */
export const spokenNote = (n) => `${SPOKEN[pitchClass(n)]} ${Math.floor(n / 12) - 1}`;
/** Whether a note is a black key's. @param {number} n */
export const isBlack = (n) => [1, 3, 6, 8, 10].includes(pitchClass(n));
/** A note's frequency, in Hz. @param {number} n */
export const noteHz = (n) => 440 * 2 ** ((n - 69) / 12);

/**
 * The keys of a computer's keyboard that play notes, by where they are (KeyboardEvent.code, whatever
 * the layout): the middle row from A the white keys from C, the row above the black keys between
 * them, as music software has them. Semitones up from the octave's C.
 * @type {Readonly<Record<string, number>>}
 */
export const NOTE_KEYS = Object.freeze({
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
  KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
});

/** The computer's keys that move the octave down and up, as music software has them. */
export const OCTAVE_KEYS = Object.freeze({ down: 'KeyZ', up: 'KeyX' });

/**
 * The note a computer's key plays (its code), the octave as set, else -1: A is middle C (C4) at
 * octave 0.
 * @param {string} code
 * @param {number} [octave]
 */
export const noteForKey = (code, octave = 0) => (Object.hasOwn(NOTE_KEYS, code) ? 60 + 12 * octave + NOTE_KEYS[code] : -1);

// ── The voices ──────────────────────────────────────────────────────────────

/** How loud a voice is at full velocity; in mono each of the stacked voices is a part of it (unrelated waves add as their powers do). */
const VOICE_GAIN = 0.75, MONO_GAIN = 1 / Math.sqrt(VOICES);
/** The oscillators' balance: the pulse and the noise are louder than the saw at a level. */
const BALANCE = Object.freeze({ saw: 1, pulse: 0.8, sub: 0.9, noise: 0.45 });
/** How hard the pulse's comparator is (a steeper edge: more highs, and more aliasing), and how wide the drive's curve reaches. */
const EDGE = 24, DRIVE_REACH = 4;
/** How far a voice's filter sits from the others' (either way, in cents), and how far higher notes open it (per semitone). */
const FILTER_SPREAD = 60, KEY_TRACK = 50;
/** How far a velocity opens the filter from a middling one, in cents (an octave from softest to hardest). */
const VELOCITY_CENTS = 1200;
/** The pitch bend's reach either way, in cents. */
const BEND_CENTS = 200;
/** How long a knob takes to get where it is turned (a time constant, in seconds): no zipper, no lag. */
const EASE = 0.012;

/**
 * A WaveShaper's curve: tanh(k·x) over x from -1 to 1, its ends at ±1.
 * @param {number} k
 * @param {number} [n]
 */
export function tanhCurve(k, n = 1025) {
  const curve = new Float32Array(n), top = Math.tanh(k);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(k * ((2 * i) / (n - 1) - 1)) / top;
  return curve;
}

/**
 * An envelope as it is set on its params, each at base + scale × where it is: from `v0` at `t0`
 * straight up to `peak` at t0 + `attack`, then towards `sustain` of it (a fifth of `decay` its time
 * constant, so nearly there by then); once let go at `t1`, from where it was then towards nothing (a
 * fifth of the release). Where it is at any time is worked out from that, so that a note started
 * again, or let go mid-attack, carries on from there (Web Audio can't say where a param is going, and
 * cancelAndHoldAtTime isn't in every browser). As it is made it was let go long ago.
 */
export class Envelope {
  constructor() {
    this.t0 = 0;
    this.v0 = 0;
    this.peak = 0;
    this.attack = 0.001;
    this.decay = 1;
    this.sustain = 0;
    /** When it was let go: Infinity while held. */
    this.t1 = -Infinity;
    this.v1 = 0;
    this.release = 1;
    this.base = 0;
    this.scale = 1;
  }

  /** Where it is at time t (0…peak). @param {number} t */
  valueAt(t) {
    if (t >= this.t1) return this.v1 === 0 ? 0 : this.v1 * Math.exp(-(t - this.t1) / (this.release / 5));
    if (t <= this.t0) return this.v0;
    if (t < this.t0 + this.attack) return this.v0 + ((this.peak - this.v0) * (t - this.t0)) / this.attack;
    const s = this.sustain * this.peak;
    return s + (this.peak - s) * Math.exp(-(t - this.t0 - this.attack) / (this.decay / 5));
  }

  /** Whether it has been let go (or never started) by time t. @param {number} t */
  released(t) {
    return t >= this.t1;
  }

  /**
   * Starts it at t on `params` (each set to base + scale × where it is), from where it was.
   * @param {AudioParam[]} params
   * @param {number} t
   * @param {number} peak
   * @param {number} attack seconds
   * @param {number} decay seconds
   * @param {number} sustain 0…1, of the peak
   * @param {number} [base]
   * @param {number} [scale]
   */
  start(params, t, peak, attack, decay, sustain, base = 0, scale = 1) {
    const v0 = this.valueAt(t);
    this.t0 = t;
    this.v0 = v0;
    this.peak = peak;
    this.attack = Math.max(attack, 0.001);
    this.decay = Math.max(decay, 0.001);
    this.sustain = clamp(sustain, 0, 1);
    this.t1 = Infinity;
    this.base = base;
    this.scale = scale;
    for (const p of params) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(base + scale * v0, t);
      p.linearRampToValueAtTime(base + scale * peak, t + this.attack);
      p.setTargetAtTime(base + scale * this.sustain * peak, t + this.attack, this.decay / 5);
    }
  }

  /**
   * Lets it go at t on `params`, from where it is, towards nothing over `release` seconds; nothing if
   * it was let go already.
   * @param {AudioParam[]} params
   * @param {number} t
   * @param {number} release
   */
  stop(params, t, release) {
    if (this.released(t)) return;
    const v = this.valueAt(t);
    this.t1 = t;
    this.v1 = v;
    this.release = Math.max(release, 0.001);
    for (const p of params) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(this.base + this.scale * v, t);
      p.setTargetAtTime(this.base, t, this.release / 5);
    }
  }
}

/**
 * A voice's pitch, in cents from A4 (its oscillators' detune; their frequencies stay at A4 and an
 * octave under): from `from` at `t0` towards `to`, a third of the glide its time constant; at once
 * without one.
 */
export class Glide {
  constructor() {
    this.t0 = 0;
    this.from = 0;
    this.to = 0;
    this.tau = 0;
  }

  /** Where it is at time t, in cents. @param {number} t */
  valueAt(t) {
    if (this.tau <= 0) return this.to;
    if (t <= this.t0) return this.from;
    return this.to + (this.from - this.to) * Math.exp(-(t - this.t0) / this.tau);
  }

  /**
   * Goes to `cents` from t on `params`, over `glide` seconds (0: at once).
   * @param {AudioParam[]} params
   * @param {number} t
   * @param {number} cents
   * @param {number} glide
   */
  go(params, t, cents, glide) {
    const from = this.valueAt(t);
    this.t0 = t;
    this.from = from;
    this.to = cents;
    this.tau = glide > 0 ? glide / 3 : 0;
    for (const p of params) {
      p.cancelScheduledValues(t);
      if (this.tau > 0) {
        p.setValueAtTime(from, t);
        p.setTargetAtTime(cents, t, this.tau);
      } else p.setValueAtTime(cents, t);
    }
  }
}

/**
 * A voice: the note it plays (else -1), whether its key is down or the pedal holds it, when it
 * started and was let go, and its nodes.
 * @typedef {object} Voice
 * @property {number} note
 * @property {boolean} gate its key is down
 * @property {boolean} held the sustain pedal holds it, its key let go
 * @property {number} started
 * @property {number} ended when it was let go (-Infinity: never played)
 * @property {number} offset its filter's place from the others', in cents
 * @property {OscillatorNode} saw
 * @property {OscillatorNode} sub
 * @property {Record<'saw' | 'pulse' | 'sub' | 'noise', GainNode>} levels
 * @property {BiquadFilterNode[]} filters
 * @property {AudioParam[]} cutoffs the filters' detune, where the envelope sets them
 * @property {GainNode} amp
 * @property {Envelope} ampEnv
 * @property {Envelope} filterEnv
 * @property {Glide} pitch
 */

/**
 * What the voices share: the LFO and its three depths, the pitch bend, the pulse's width; and after
 * them the drive, the chorus and the level.
 * @typedef {object} Graph
 * @property {OscillatorNode} lfo
 * @property {GainNode} vibrato
 * @property {GainNode} wah
 * @property {GainNode} pwm
 * @property {ConstantSourceNode} bend
 * @property {ConstantSourceNode} width
 * @property {GainNode} pre
 * @property {GainNode} post
 * @property {GainNode[]} wet
 * @property {GainNode} level
 */

export class Synth {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, random?: () => number }} [o] where its settings are kept (localStorage), and the dice for a note's drift
   */
  constructor(sound, { storage = pageStorage(), key = 'synth', random = Math.random } = {}) {
    this.sound = sound;
    /** @type {SynthKnobs} */
    this.knobs = { ...DEFAULT_SYNTH };
    /** The voices on the one note (else a note each). */
    this.mono = false;
    /** The preset chosen last (its id), else null: the knobs as the synth comes. @type {string | null} */
    this.preset = null;
    /** Something changed since that preset (or since as it comes). */
    this.edited = false;
    /** How many octaves from LOWEST the keys play (OCTAVES). */
    this.octave = 0;
    /** The notes whose keys are down now, from anywhere (the keys, the card, a MIDI keyboard). @type {Set<number>} */
    this.down = new Set();
    /** The sustain pedal is down. */
    this.sustain = false;
    /** When the keys down change (to show them). */
    this.onNotes = () => {};
    /** @private the pitch bend, -1…1, and the mod wheel, 0…1 */
    this._bend = 0;
    /** @private */
    this._mod = 0;
    /** @private in mono, the notes held, the last one down last @type {number[]} */
    this._held = [];
    /** @private notes played for a moment, and when each is let go @type {Map<number, ReturnType<typeof setTimeout>>} */
    this._taps = new Map();
    /** @private @type {Graph | null} */
    this._graph = null;
    /** @private @type {Voice[]} */
    this._voices = [];
    /** @private */
    this._random = random;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** The notes sounding now: in poly each voice's, in mono the one, while any is heard. */
  get sounding() {
    const now = this.sound.ctx?.currentTime ?? 0;
    return [...new Set(this._voices.filter((v) => v.note >= 0 && (v.gate || v.held || v.ampEnv.valueAt(now) > 1e-3)).map((v) => v.note))];
  }

  /** The lowest key's note now, with the octave as set. */
  get lowest() {
    return LOWEST + 12 * this.octave;
  }

  /**
   * A key pressed: its note (MIDI) played, `velocity` 0…1 loud, waking the sound: whether it is heard
   * (no Web Audio: not).
   * @param {number} note
   * @param {number} [velocity]
   */
  noteOn(note, velocity = 0.8) {
    if (!Number.isFinite(note)) return false;
    clearTimeout(this._taps.get(note));
    this._taps.delete(note);
    this.down.add(note);
    this.onNotes();
    const ctx = this.sound.wake();
    if (!ctx || !this._build()) return false;
    const t = ctx.currentTime, v = clamp(velocity, 0, 1);
    if (this.mono) {
      const legato = this._held.length > 0 || this._voices.some((x) => x.held);
      this._held = this._held.filter((n) => n !== note);
      this._held.push(note);
      const stack = this.knobs.detune > 0 ? VOICES : 1;
      const glide = legato ? glideSeconds(this.knobs.glide) : 0;
      this._voices.forEach((voice, i) => {
        voice.note = note;
        voice.gate = true;
        voice.held = false;
        this._pitch(voice, t, note, this._spread(i), glide);
        if (!legato && i < stack) this._start(voice, t, v, stack > 1 ? MONO_GAIN : 1);
      });
      return true;
    }
    const voice = this._voices.find((x) => x.note === note && (x.gate || x.held))
      ?? this._free()
      ?? this._voices.reduce((a, b) => (b.started < a.started ? b : a));
    voice.note = note;
    voice.gate = true;
    voice.held = false;
    this._pitch(voice, t, note, ((this._random() * 2 - 1) * detuneCents(this.knobs.detune)) / 3, 0);
    this._start(voice, t, v, 1);
    return true;
  }

  /**
   * A key let go: its note released (with the sustain pedal down, held until the pedal is let go); in
   * mono the last key still held sounds again, gliding there.
   * @param {number} note
   */
  noteOff(note) {
    clearTimeout(this._taps.get(note));
    this._taps.delete(note);
    if (this.down.delete(note)) this.onNotes();
    const ctx = this.sound.ctx;
    if (!ctx || !this._graph) {
      this._held = this._held.filter((n) => n !== note);
      return;
    }
    const t = ctx.currentTime;
    if (this.mono) {
      const was = this._held[this._held.length - 1];
      this._held = this._held.filter((n) => n !== note);
      const top = this._held[this._held.length - 1];
      if (top === undefined) {
        for (const voice of this._voices) this._let(voice, t);
      } else if (top !== was) {
        this._voices.forEach((voice, i) => {
          voice.note = top;
          this._pitch(voice, t, top, this._spread(i), glideSeconds(this.knobs.glide));
        });
      }
      return;
    }
    for (const voice of this._voices) if (voice.note === note && voice.gate) this._let(voice, t);
  }

  /**
   * A note played for a moment (a click, the TV's OK), let go `length` seconds later unless its key
   * is pressed or let go first: whether it is heard.
   * @param {number} note
   * @param {number} [velocity]
   * @param {number} [length] seconds
   */
  tap(note, velocity = 0.8, length = 0.35) {
    const heard = this.noteOn(note, velocity);
    this._taps.set(note, setTimeout(() => this.noteOff(note), length * 1000));
    return heard;
  }

  /** Every note let go, the pedal's too (the page put away, Mono switched). */
  allOff() {
    for (const timer of this._taps.values()) clearTimeout(timer);
    this._taps.clear();
    const had = this.down.size > 0;
    this.down.clear();
    this._held = [];
    if (had) this.onNotes();
    const t = this.sound.ctx?.currentTime ?? 0;
    for (const voice of this._voices) {
      voice.gate = false;
      voice.held = false;
      this._stop(voice, t);
    }
  }

  /** The sustain pedal down, or let go (then the notes it held are released). @param {boolean} on */
  setSustain(on) {
    this.sustain = !!on;
    if (this.sustain) return;
    const t = this.sound.ctx?.currentTime ?? 0;
    for (const voice of this._voices) {
      if (!voice.held) continue;
      voice.held = false;
      if (!voice.gate) this._stop(voice, t);
    }
  }

  /** The pitch bend, -1…1: two semitones down or up. @param {number} v */
  setBend(v) {
    this._bend = Number.isFinite(v) ? clamp(v, -1, 1) : 0;
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    const p = g.bend.offset, t = ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(this._bend * BEND_CENTS, t, 0.005);
  }

  /** The mod wheel, 0…1: more vibrato. @param {number} v */
  setMod(v) {
    this._mod = Number.isFinite(v) ? clamp(v, 0, 1) : 0;
    this._apply('vibrato');
  }

  /**
   * Sets a knob (0…1), heard at once where it can be (a level, the cutoff, the LFO) and from the next
   * note where it can't (an envelope, DETUNE, GLIDE); kept a moment later (a knob turned keeps
   * changing).
   * @param {SynthKnob} id
   * @param {number} value
   */
  setKnob(id, value) {
    if (!IDS.includes(id) || !Number.isFinite(value)) return;
    this.knobs[id] = clamp(value, 0, 1);
    this.edited = true;
    this._apply(id);
    this._saveSoon();
  }

  /** Mono on (the voices on the one note) or off: every note let go first. @param {boolean} on */
  setMono(on) {
    if (!!on === this.mono) return;
    this.allOff();
    this.mono = !!on;
    this.edited = true;
    this._saveSoon();
  }

  /** The octave the keys play in, -2…2 (OCTAVES). @param {number} octave */
  setOctave(octave) {
    if (!Number.isFinite(octave)) return;
    this.octave = clamp(Math.round(octave), OCTAVES.min, OCTAVES.max);
    this._saveSoon();
  }

  /** A preset (its id in PRESETS): its knobs and Mono. Whether there is one by that id. @param {string} id */
  choose(id) {
    const p = PRESETS.find((q) => q.id === id);
    if (!p) return false;
    this._set({ ...DEFAULT_SYNTH, ...p.knobs }, p.mono);
    this.preset = p.id;
    this.edited = false;
    this._saveSoon();
    return true;
  }

  /** The preset after the one chosen last (`by` 1) or before (-1), round the list. @param {number} by */
  step(by) {
    const at = PRESETS.findIndex((p) => p.id === this.preset), n = PRESETS.length;
    const next = at < 0 ? (by > 0 ? 0 : n - 1) : (((at + by) % n) + n) % n;
    this.choose(PRESETS[next].id);
  }

  /** The knobs as the synth comes, in poly. */
  reset() {
    this._set({ ...DEFAULT_SYNTH }, false);
    this.preset = null;
    this.edited = false;
    this._saveSoon();
  }

  /** The sound, in words: the preset (changed), else as it comes, or one's own. */
  get name() {
    const p = PRESETS.find((q) => q.id === this.preset);
    return p ? `${p.name}${this.edited ? ' (changed)' : ''}` : this.edited ? 'Own sound' : 'As it comes';
  }

  /** What is playing, in words: the sound and poly or mono. */
  get title() {
    return `${this.name}, ${this.mono ? 'mono' : 'poly'}`;
  }

  /**
   * Every knob and Mono at once (a preset, as it comes): heard at once.
   * @private
   * @param {SynthKnobs} knobs
   * @param {boolean} mono
   */
  _set(knobs, mono) {
    if (mono !== this.mono) {
      this.allOff();
      this.mono = mono;
    }
    for (const id of IDS) {
      this.knobs[id] = clamp(knobs[id] ?? DEFAULT_SYNTH[id], 0, 1);
      this._apply(id);
    }
  }

  /**
   * In mono, voice i's place either side of the note, in cents: the six spread evenly over DETUNE.
   * @private
   * @param {number} i
   */
  _spread(i) {
    return ((i / (VOICES - 1)) * 2 - 1) * detuneCents(this.knobs.detune);
  }

  /**
   * A voice not playing, the one let go longest ago; else none.
   * @private
   */
  _free() {
    /** @type {Voice | null} */
    let free = null;
    for (const v of this._voices) if (!v.gate && !v.held && (!free || v.ended < free.ended)) free = v;
    return free;
  }

  /**
   * A voice's pitch to `note`, `cents` aside, over `glide` seconds (at once for a voice yet to play).
   * @private
   * @param {Voice} voice
   * @param {number} t
   * @param {number} note
   * @param {number} cents
   * @param {number} glide
   */
  _pitch(voice, t, note, cents, glide) {
    voice.pitch.go([voice.saw.detune, voice.sub.detune], t, (note - 69) * 100 + cents, voice.started > -Infinity ? glide : 0);
  }

  /**
   * A voice's envelopes started at t, from where they are: its amp to the velocity's loudness (times
   * `gain`), its filter from where its note, the velocity and its own place set it.
   * @private
   * @param {Voice} voice
   * @param {number} t
   * @param {number} velocity
   * @param {number} gain
   */
  _start(voice, t, velocity, gain) {
    const k = this.knobs;
    voice.started = t;
    voice.ended = Infinity;
    voice.ampEnv.start([voice.amp.gain], t, velocityLevel(velocity) * VOICE_GAIN * gain, attackSeconds(k.attack), decaySeconds(k.decay), k.sustain);
    const base = (voice.note - 60) * KEY_TRACK + (velocity - 0.6) * VELOCITY_CENTS + voice.offset;
    voice.filterEnv.start(voice.cutoffs, t, 1, attackSeconds(k.filterAttack), decaySeconds(k.filterDecay), k.filterSustain, base, envOctaves(k.amount) * 1200);
  }

  /**
   * A voice's key let go: released, or held by the sustain pedal.
   * @private
   * @param {Voice} voice
   * @param {number} t
   */
  _let(voice, t) {
    voice.gate = false;
    if (this.sustain) voice.held = true;
    else this._stop(voice, t);
  }

  /**
   * A voice released at t: its envelopes towards nothing (nothing if they are already).
   * @private
   * @param {Voice} voice
   * @param {number} t
   */
  _stop(voice, t) {
    if (voice.ampEnv.released(t)) return;
    const k = this.knobs;
    voice.ended = t;
    voice.ampEnv.stop([voice.amp.gain], t, decaySeconds(k.release));
    voice.filterEnv.stop(voice.cutoffs, t, decaySeconds(k.filterRelease));
  }

  /**
   * A knob heard at once where it can be: eased there (a knob turned), or set (the graph made).
   * @private
   * @param {SynthKnob} id
   * @param {boolean} [ease]
   */
  _apply(id, ease = true) {
    const g = this._graph, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    const t = ctx.currentTime, k = this.knobs;
    /** @type {(p: AudioParam, v: number) => void} */
    const to = (p, v) => {
      if (!ease) {
        p.value = v;
        return;
      }
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, EASE);
    };
    switch (id) {
      case 'saw':
      case 'pulse':
      case 'sub':
      case 'noise':
        for (const v of this._voices) to(v.levels[id].gain, levelOf(k[id]) * BALANCE[id]);
        break;
      case 'width':
        to(g.width.offset, 2 * pulseDuty(k.width) - 1);
        break;
      case 'rate':
        to(g.lfo.frequency, lfoHz(k.rate));
        break;
      case 'vibrato':
        to(g.vibrato.gain, vibratoCents(Math.min(1, k.vibrato + this._mod)));
        break;
      case 'wah':
        to(g.wah.gain, wahCents(k.wah));
        break;
      case 'pwm':
        to(g.pwm.gain, 2 * pwmDepth(k.pwm));
        break;
      case 'cutoff': {
        const hz = Math.min(cutoffHz(k.cutoff), ctx.sampleRate * 0.45);
        for (const v of this._voices) for (const f of v.filters) to(f.frequency, hz);
        break;
      }
      case 'resonance':
        for (const v of this._voices) to(v.filters[1].Q, resonanceDb(k.resonance));
        break;
      case 'drive': {
        const d = driveGain(k.drive);
        to(g.pre.gain, d / DRIVE_REACH);
        to(g.post.gain, 1 / Math.sqrt(d));
        break;
      }
      case 'chorus':
        for (const w of g.wet) to(w.gain, chorusMix(k.chorus));
        break;
      case 'level':
        to(g.level.gain, synthLevel(k.level));
        break;
      default:
        break; // an envelope's, the amount, DETUNE, GLIDE: from the next note
    }
  }

  /**
   * The voices and what they share, made the first time a note plays once the sound has woken: the
   * graph, or null where there is no sound.
   * @private
   */
  _build() {
    if (this._graph) return this._graph;
    const ctx = this.sound.ctx, channel = this.sound.channel('synth'), noise = this.sound.noise;
    if (!ctx || !channel || !noise) return null;
    const t = ctx.currentTime;
    // After the voices: a high-pass under hearing (what the envelopes leave of the pulse's offset),
    // the drive, the chorus (a delay to each side beside what went in), the level.
    const bus = ctx.createBiquadFilter();
    bus.type = 'highpass';
    bus.frequency.value = 22;
    bus.Q.value = -3;
    const pre = ctx.createGain(), clip = ctx.createWaveShaper(), post = ctx.createGain();
    clip.curve = tanhCurve(DRIVE_REACH);
    clip.oversample = 'none';
    bus.connect(pre).connect(clip).connect(post);
    const sides = ctx.createChannelMerger(2);
    post.connect(sides, 0, 0);
    post.connect(sides, 0, 1);
    const sway = ctx.createOscillator();
    sway.frequency.value = 0.55;
    sway.start(t);
    const wet = [0.0091, 0.0137].map((time, side) => {
      const d = ctx.createDelay(0.05), depth = ctx.createGain(), w = ctx.createGain();
      d.delayTime.value = time;
      depth.gain.value = side ? -0.0022 : 0.0022;
      sway.connect(depth).connect(d.delayTime);
      post.connect(d).connect(w).connect(sides, 0, side);
      return w;
    });
    const level = ctx.createGain();
    sides.connect(level).connect(channel);
    // What the voices share: the LFO and its depths, the bend, the pulse's width, the noise.
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.start(t);
    const vibrato = ctx.createGain(), wah = ctx.createGain(), pwm = ctx.createGain();
    lfo.connect(vibrato);
    lfo.connect(wah);
    lfo.connect(pwm);
    const bend = ctx.createConstantSource();
    bend.offset.value = this._bend * BEND_CENTS;
    bend.start(t);
    const width = ctx.createConstantSource();
    width.start(t);
    pwm.connect(width.offset);
    const unwidth = ctx.createGain();
    unwidth.gain.value = -1;
    width.connect(unwidth);
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    hiss.start(t);
    const edge = tanhCurve(EDGE);
    for (let i = 0; i < VOICES; i++) {
      const saw = ctx.createOscillator(), sub = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = 440;
      sub.type = 'square';
      sub.frequency.value = 220;
      for (const o of [saw, sub]) {
        vibrato.connect(o.detune);
        bend.connect(o.detune);
        o.start(t);
      }
      // The pulse: the saw past the width's offset, a square wave's edge; the offset that leaves in
      // it (the width's own) taken out after.
      const comparator = ctx.createGain(), edged = ctx.createWaveShaper();
      edged.curve = edge;
      edged.oversample = 'none';
      saw.connect(comparator);
      width.connect(comparator);
      const levels = { saw: ctx.createGain(), pulse: ctx.createGain(), sub: ctx.createGain(), noise: ctx.createGain() };
      saw.connect(levels.saw);
      comparator.connect(edged).connect(levels.pulse);
      unwidth.connect(levels.pulse);
      sub.connect(levels.sub);
      hiss.connect(levels.noise);
      // The filter's coefficients once a render quantum (k-rate), not every sample, for twelve.
      const filters = [-3, 0].map((q) => {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = q;
        for (const p of [f.frequency, f.detune, f.Q, f.gain]) p.automationRate = 'k-rate';
        wah.connect(f.detune);
        return f;
      });
      for (const l of Object.values(levels)) l.connect(filters[0]);
      const amp = ctx.createGain();
      amp.gain.value = 0;
      filters[0].connect(filters[1]).connect(amp).connect(bus);
      this._voices.push({
        note: -1, gate: false, held: false, started: -Infinity, ended: -Infinity,
        offset: ((i / (VOICES - 1)) * 2 - 1) * FILTER_SPREAD, saw, sub, levels, filters,
        cutoffs: filters.map((f) => f.detune), amp,
        ampEnv: new Envelope(), filterEnv: new Envelope(), pitch: new Glide(),
      });
    }
    this._graph = { lfo, vibrato, wah, pwm, bend, width, pre, post, wet, level };
    for (const id of IDS) this._apply(id, false);
    return this._graph;
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (!s || typeof s !== 'object') return;
      for (const id of IDS) if (Number.isFinite(s.knobs?.[id])) this.knobs[id] = clamp(s.knobs[id], 0, 1);
      if (typeof s.mono === 'boolean') this.mono = s.mono;
      if (typeof s.preset === 'string' && PRESETS.some((p) => p.id === s.preset)) this.preset = s.preset;
      if (typeof s.edited === 'boolean') this.edited = s.edited;
      if (Number.isFinite(s.octave)) this.octave = clamp(Math.round(s.octave), OCTAVES.min, OCTAVES.max);
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the knobs, Mono, the preset and the octave now (localStorage). */
  save() {
    clearTimeout(this._saving);
    try {
      this._storage?.setItem(this._key, JSON.stringify({ knobs: this.knobs, mono: this.mono, preset: this.preset, edited: this.edited, octave: this.octave }));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
