// The band's settings, which a shared session shares (band.js): every instrument's and module's,
// one a knob, a switch, a choice, a pad's sixteen steps, a step of the sequencer or a cable, each read
// as a plain value (a number, a word, true or false, or none) and set as another set it; and the parts
// they belong to, each shown (main.js) once its settings have been set. One's own stays out of it:
// the volume and mute, the octave the computer's keys play in, the pad the knobs turn, what is held.
import { KNOBS, PADS } from './drums.js';
import { DELAY_KNOBS } from './delay.js';
import { LFO_KNOBS } from './lfo.js';
import { ENVELOPE_KNOBS } from './envelope.js';
import { MIXER_KNOBS } from './mixer.js';
import { FILTER_KNOBS } from './filter.js';
import { REVERB_KNOBS } from './reverb.js';
import { PRESETS, SYNTH_KNOBS } from './synth.js';
import { ARP_MODES, ARP_RANGES } from './arp.js';
import { SEQ_OCTAVES, SEQ_RANGE } from './seq.js';
import { STEPS } from './pattern.js';
import { KEYS_KNOBS, KEYS_SOUNDS, KEYS_SWITCHES } from './keys.js';
import { CHORDS, GUITAR_KNOBS, PEDALS, PICKUPS } from './guitar.js';

/** @typedef {import('./band.js').Plain} Plain */
/** @typedef {import('./band.js').Setting} Setting */
/** @typedef {import('./band.js').Part} Part */

/**
 * The room's instruments and modules.
 * @typedef {{
 *   drums: import('./drums.js').Drums, pattern: import('./pattern.js').Pattern, delay: import('./delay.js').Delay,
 *   synth: import('./synth.js').Synth, seq: import('./seq.js').Seq, rackDelay: import('./delay.js').Delay,
 *   lfo: import('./lfo.js').Lfo, envelope: import('./envelope.js').Adsr, mixer: import('./mixer.js').Mixer,
 *   filter: import('./filter.js').Filter, reverb: import('./reverb.js').Reverb, keys: import('./keys.js').Keys,
 *   guitar: import('./guitar.js').Guitar, patch: import('./patch.js').Patch
 * }} Instruments
 */

/** @type {(v: unknown) => boolean} */
const unit = (v) => typeof v === 'number' && v >= 0 && v <= 1;
/** @type {(v: unknown) => boolean} */
const bool = (v) => typeof v === 'boolean';
/** One of these. @param {readonly unknown[]} ids @returns {(v: unknown) => boolean} */
const oneOf = (ids) => (v) => ids.includes(v);
/** One of these, or none. @param {readonly unknown[]} ids @returns {(v: unknown) => boolean} */
const oneOrNone = (ids) => (v) => v === null || ids.includes(v);
/** A whole number from lo to hi. @param {number} lo @param {number} hi @returns {(v: unknown) => boolean} */
const whole = (lo, hi) => (v) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/**
 * A step of the sequencer as one number: whether it plays, its accent and its slide in its lowest
 * three bits, its note (semitones up from the line's lowest) over them.
 * @param {import('./seq.js').SeqStep} step
 */
export const stepCode = (step) => (step.on ? 1 : 0) | (step.accent ? 2 : 0) | (step.slide ? 4 : 0) | (step.note << 3);

/**
 * The band's settings and parts, read from and set on the instruments; `shown(part)` once a part's
 * settings shared elsewhere have been set here.
 * @param {Instruments} o
 * @param {(part: string) => void} shown
 * @returns {{ settings: Setting[], parts: Part[] }}
 */
export function bandParts({ drums, pattern, delay, synth, seq, rackDelay, lfo, envelope, mixer, filter, reverb, keys, guitar, patch }, shown) {
  /** @type {Setting[]} */
  const settings = [];
  /** @type {Part[]} */
  const parts = [];
  /**
   * A part: its index, for its settings. `then`, what is done before it is shown.
   * @param {string} id
   * @param {(get: (name: string) => unknown) => void} [then]
   */
  const part = (id, then) => {
    parts.push({
      id,
      done: (get) => {
        then?.(get);
        shown(id);
      },
    });
    return parts.length - 1;
  };
  /**
   * @param {number} p
   * @param {string} name
   * @param {() => Plain} read
   * @param {(v: Plain) => void} write
   * @param {(v: unknown) => boolean} valid
   */
  const add = (p, name, read, write, valid) => settings.push({ name, part: p, read, write, valid });
  /**
   * A module's knobs, each 0…1.
   * @template {string} K
   * @param {string} id
   * @param {readonly K[]} names
   * @param {{ knobs: Readonly<Record<K, number>>, setKnob: (name: K, value: number) => void }} m
   */
  const knobs = (id, names, m) => {
    const p = part(id);
    for (const k of names) add(p, `${id}.${k}`, () => m.knobs[k], (v) => m.setKnob(k, /** @type {number} */ (v)), unit);
  };

  // The drums: each pad's knobs, and then its steps (a bit each, the first lowest).
  const pads = part('drums');
  PADS.forEach((pad, i) => {
    for (const k of KNOBS) add(pads, `drums.${pad.id}.${k}`, () => drums.knobs[i][k], (v) => drums.setKnob(i, k, /** @type {number} */ (v)), unit);
  });
  const steps = part('pattern');
  PADS.forEach((pad, i) => {
    add(
      steps,
      `pattern.${pad.id}`,
      () => {
        let bits = 0;
        for (let s = 0; s < STEPS; s++) if (pattern.has(i, s)) bits |= 1 << s;
        return bits;
      },
      (v) => {
        for (let s = 0; s < STEPS; s++) pattern.set(i, s, ((/** @type {number} */ (v) >> s) & 1) === 1);
      },
      whole(0, 2 ** STEPS - 1),
    );
  });
  knobs('delay', DELAY_KNOBS, delay);

  // The synth: its knobs, Mono and its arpeggiator; then what its sound is called (a preset, changed),
  // set once its knobs are, which say it was changed as they are set.
  const sy = part('synth', (get) => {
    const preset = get('synth.preset'), edited = get('synth.edited');
    synth.setPreset(oneOrNone(PRESETS.map((x) => x.id))(preset) ? /** @type {string | null} */ (preset) : synth.preset, typeof edited === 'boolean' ? edited : synth.edited);
  });
  for (const { id } of SYNTH_KNOBS) add(sy, `synth.${id}`, () => synth.knobs[id], (v) => synth.setKnob(id, /** @type {number} */ (v)), unit);
  add(sy, 'synth.mono', () => synth.mono, (v) => synth.setMono(!!v), bool);
  add(sy, 'synth.arp', () => synth.arp.mode, (v) => synth.setArp(/** @type {string | null} */ (v)), oneOrNone(ARP_MODES.map((m) => m.id)));
  add(sy, 'synth.hold', () => synth.arp.hold, (v) => synth.setHold(!!v), bool);
  add(sy, 'synth.range', () => synth.arp.range, (v) => synth.setRange(/** @type {number} */ (v)), oneOf(ARP_RANGES));
  add(sy, 'synth.preset', () => synth.preset, () => {}, oneOrNone(PRESETS.map((x) => x.id)));
  add(sy, 'synth.edited', () => synth.edited, () => {}, bool);

  // The rack: the sequencer's steps (a number each, stepCode) and its octave; its modules' knobs.
  const sq = part('seq');
  for (let s = 0; s < STEPS; s++) {
    add(
      sq,
      `seq.${s + 1}`,
      () => stepCode(seq.steps[s]),
      (v) => {
        const c = /** @type {number} */ (v);
        seq.setStep(s, (c & 1) === 1, c >> 3, (c & 2) === 2, (c & 4) === 4);
      },
      whole(0, (SEQ_RANGE << 3) | 7),
    );
  }
  add(sq, 'seq.octave', () => seq.octave, (v) => seq.setOctave(/** @type {number} */ (v)), whole(SEQ_OCTAVES.min, SEQ_OCTAVES.max));
  knobs('rackdelay', DELAY_KNOBS, rackDelay);
  knobs('lfo', LFO_KNOBS, lfo);
  knobs('env', ENVELOPE_KNOBS, envelope);
  knobs('mixer', MIXER_KNOBS, mixer);
  knobs('filter', FILTER_KNOBS, filter);
  knobs('reverb', REVERB_KNOBS, reverb);

  // The keyboard: its drawbars and knobs, its switches, and what it plays.
  const ky = part('keys');
  for (const { id } of KEYS_KNOBS) add(ky, `keys.${id}`, () => keys.knobs[id], (v) => keys.setKnob(id, /** @type {number} */ (v)), unit);
  for (const { id } of KEYS_SWITCHES) add(ky, `keys.switch.${id}`, () => keys.switches[id], (v) => keys.setSwitch(id, !!v), bool);
  add(ky, 'keys.sound', () => keys.choice, (v) => keys.choose(/** @type {string} */ (v)), oneOf(KEYS_SOUNDS.map((x) => x.id)));

  // The guitar: its knobs, its amp's and its pedals', each pedal on or off, its pickup and its chord.
  const gt = part('guitar');
  for (const { id } of GUITAR_KNOBS) add(gt, `guitar.${id}`, () => guitar.knobs[id], (v) => guitar.setKnob(id, /** @type {number} */ (v)), unit);
  for (const { id } of PEDALS) add(gt, `guitar.pedal.${id}`, () => guitar.pedals[id], (v) => guitar.setPedal(id, !!v), bool);
  add(gt, 'guitar.pickup', () => guitar.pickup, (v) => guitar.setPickup(/** @type {string} */ (v)), oneOf(PICKUPS.map((x) => x.id)));
  add(gt, 'guitar.chord', () => guitar.chord, (v) => guitar.choose(/** @type {string | null} */ (v)), oneOrNone(CHORDS.map((c) => c.id)));

  // The cables: each input's, all set at once in the jacks' order (patch.js adopt), so that every
  // page comes to the same patch. A cable that can't be plugged here is left out.
  /** @type {Map<string, (v: unknown) => boolean>} */
  const plugs = new Map();
  const cables = part('patch', (get) => {
    patch.adopt((input) => {
      const v = get(`patch.${input}`);
      return plugs.get(input)?.(v) ? /** @type {string | null} */ (v) : undefined;
    });
  });
  for (const j of patch.jacks) {
    if (j.dir !== 'in') continue;
    /** @type {(v: unknown) => boolean} */
    const valid = (v) => {
      if (v === null) return true;
      const out = typeof v === 'string' ? patch.jack(v) : undefined;
      return !!out && out.dir === 'out' && out.kind === j.kind;
    };
    plugs.set(j.id, valid);
    add(cables, `patch.${j.id}`, () => patch.source(j.id), () => {}, valid);
  }
  return { settings, parts };
}
