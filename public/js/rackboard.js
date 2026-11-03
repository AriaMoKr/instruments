// The rack, to the right of the synth against the far wall: a case of modules standing beside it, a
// desk as the board and the synth are (a top leaning a little towards the player, a panel at its back
// leaning back, a sign over it on the wall: board.js's Desk, whose functions work on it too), as deep
// as the synth, so that their fronts are in line. On its top the sequencer's sixteen steps (seq.js),
// in fours as the drums' step keys are: for each its number at the front edge, its key (a note, or a
// rest), its accent's and its slide's keys, the name of its note and the knob that sets it, the rows
// named in the margin at the left. On its panel the modules side by side in two rows, as in a case
// of two: in the first the clock's (the room's clock again, nearer the synth: RUN, the tempo's knob
// and its display, its outs ×1, ÷2 and ÷4 on a plate), the sequencer's (its display, its octave's
// buttons, its clock in and its notes out), the delay's (delay.js: its time's knob over its
// feedback's and its level's, its in), the LFO's (lfo.js: its rate's knob over its shape's and its
// depth's, a light by its name, its out on a plate) and the envelope's (envelope.js: its depth's knob
// over its attack's, decay's, sustain's and release's, a light by its name, its clock in, its notes
// in and its out); over it the mixer's (mixer.js: a knob over each of its four ins, its out), the
// filter's (filter.js: its mode's knob, its cutoff's, its resonance's and how far its CUTOFF in moves
// it, in a row; its in, its CUTOFF in and its out), the reverb's (reverb.js: its size's, its
// damping's and its level's knobs, its in) and a blank plate, over the envelope; each module's knob's
// setting under it. As wide as its modules make it, its steps spread across it. Pure functions with
// no three.js, as board.js's, so the tests run them in Node: where it stands and what is on it
// (layoutRack), what a ray meets on it (hitRack), and the key a stick's tip or a finger comes down on
// (rackStrike).
//
// Coordinates as board.js's: on the top `a` from its left edge (world +x), `b` from its front edge
// up the slope; on the panel `a` likewise, `b` from its foot up its face.
import { BOARD, areaAt, heightOver, jackAt, meetDesk, writeHit } from './board.js';
import { RACK_CLOCK_OUTS } from './clock.js';
import { DELAY_KNOBS } from './delay.js';
import { LFO_KNOBS } from './lfo.js';
import { ENVELOPE_KNOBS } from './envelope.js';
import { MIXER_KNOBS } from './mixer.js';
import { FILTER_KNOBS } from './filter.js';
import { REVERB_KNOBS } from './reverb.js';
import { STEPS } from './pattern.js';

/**
 * The rack's measures, in metres and radians.
 */
export const RACK = Object.freeze({
  /** The steps across the top: `pitch` apart, `group` more between fours, from `left` (the rows' names are in the margin there) to `right` from its right edge. */
  step: Object.freeze({ pitch: 0.048, group: 0.02, left: 0.065, right: 0.025 }),
  /** Its keys: `width` across, a step's `deep` and an accent's or a slide's `small`, their caps `rise` over the top. */
  key: Object.freeze({ width: 0.04, deep: 0.064, small: 0.038, rise: 0.01 }),
  /** The notes' knobs (`r`, `h`), and on the panel the tempo's (`tempo` its radius) and the other modules' (`module`), those in a row `pitch` apart. */
  knob: Object.freeze({ r: 0.0145, h: 0.018, tempo: 0.022, module: 0.015, pitch: 0.047 }),
  /** Where a module's knob's setting is written, under it: `w` across, `h` high, its middle `below` the knob's edge. */
  setting: Object.freeze({ w: 0.044, h: 0.011, below: 0.0115 }),
  /** The panel: `height` up its face, its first row `row` of it, the second over it; leaning back `lean`, `thick`; its buttons standing `button` out of it. */
  panel: Object.freeze({ height: 0.46, row: 0.28, lean: 0.35, thick: 0.04, button: 0.007 }),
  /** The top's front edge `front` high, leaning back by `tilt`, `thick`; the panel's back at least `wall` from the wall; `gap` right of the synth. */
  front: 0.9, tilt: 0.12, thick: 0.05, wall: 0.015, gap: 0.06,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/** The rows of keys on the top, from the front: a step's (playing or resting), its accent's, its slide's; a ray's hit kind on each. */
export const SEQ_ROWS = Object.freeze(/** @type {const} */ (['seq', 'accent', 'slide']));

/** A row of keys. @typedef {(typeof SEQ_ROWS)[number]} SeqRow */

/**
 * A knob on the rack: a step's note on the top, or on the panel the clock's tempo, or one of the
 * delay's, the LFO's, the envelope's, the mixer's, the filter's or the reverb's (`name` which); where
 * it is.
 * @typedef {{ part: 'note', step: number, on: 'top', a: number, b: number }
 *   | { part: 'tempo', step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'delay', name: import('./delay.js').DelayKnob, step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'lfo', name: import('./lfo.js').LfoKnob, step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'envelope', name: import('./envelope.js').EnvelopeKnob, step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'mixer', name: import('./mixer.js').MixerKnob, step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'filter', name: import('./filter.js').FilterKnob, step: -1, on: 'panel', a: number, b: number }
 *   | { part: 'reverb', name: import('./reverb.js').ReverbKnob, step: -1, on: 'panel', a: number, b: number }} RackKnob
 */

/** A knob of a module on the panel (not the notes' or the tempo's). @typedef {Extract<RackKnob, { name: string }>} ModuleKnob */

/**
 * A button on the panel: 'run' (the clock's), 'octave.down' or 'octave.up' (the sequencer's); what
 * is on it, and where.
 * @typedef {{ id: string, label: string, a0: number, a1: number, b0: number, b1: number }} RackButton
 */

/**
 * A module in the case: its id, its name over it, and its plate's span across the panel and up it
 * (its row's).
 * @typedef {{ id: 'clock' | 'seq' | 'delay' | 'lfo' | 'envelope' | 'mixer' | 'filter' | 'reverb', name: string, a0: number, a1: number, b0: number, b1: number }} RackModule
 */

/** Whether a knob on the rack is a module's on the panel (not a step's note's, nor the tempo's). @param {RackKnob} n @returns {n is ModuleKnob} */
export const isModuleKnob = (n) => n.part !== 'note' && n.part !== 'tempo';

/** A knob's radius: a step's note's, the tempo's, or a module's on the panel. @param {RackKnob} n */
export const knobRadius = (n) => (n.part === 'note' ? RACK.knob.r : n.part === 'tempo' ? RACK.knob.tempo : RACK.knob.module);

/**
 * The rack to the right of the synth (synthboard.js layoutSynth), against the far wall: its footprint
 * and its top and panel as a Desk (board.js), as deep as the synth; on its top the steps' keys, row
 * by row (SEQ_ROWS: `keys`, a row's sixteen after the one before's), the band of their numbers at the
 * front, the band of their notes' names behind the keys, the rows' names at the left, and the knobs
 * (each step's note, then on the panel the tempo's, the delay's, the LFO's, the envelope's, the
 * mixer's, the filter's and the reverb's); on the panel its modules in their rows, a blank plate,
 * their displays, its buttons, its jacks (as the board's, in patch.js JACKS's order, its rows' left to
 * right; in the room's list of jacks after the synth's, from `jackBase`), where the modules' knobs'
 * settings are written, the LFO's and the envelope's lights, and what else is written on it; and its
 * sign.
 * @param {{ z1: number }} L the room's layout (room.js layoutRoom)
 * @param {{ x1: number, length: number, zFront: number, panel: { jackBase: number, jacks: readonly unknown[] } }} S the synth's (synthboard.js layoutSynth)
 */
export function layoutRack(L, S) {
  const { step: C, key: K, knob: N, panel, tilt, front } = RACK;
  /** Where step s's key starts across the top. @param {number} s */
  const across = (s) => C.left + s * C.pitch + Math.floor(s / 4) * C.group;
  const width = across(STEPS - 1) + K.width + C.right;
  // From the front edge: the steps' numbers, their keys, the accents' and the slides', the names of
  // their notes, and their knobs.
  const numbers = { b0: 0.016, b1: 0.036 };
  const rows = [{ b0: 0.044, b1: 0.044 + K.deep }];
  rows.push({ b0: rows[0].b1 + 0.016, b1: rows[0].b1 + 0.016 + K.small });
  rows.push({ b0: rows[1].b1 + 0.012, b1: rows[1].b1 + 0.012 + K.small });
  const names = { b0: rows[2].b1 + 0.014, b1: rows[2].b1 + 0.036 };
  const knobB = names.b1 + 0.008 + N.r;
  const length = Math.max(S.length, knobB + N.r + 0.02);
  const keys = rows.flatMap((row) => Array.from({ length: STEPS }, (_, s) => ({ a0: across(s), a1: across(s) + K.width, b0: row.b0, b1: row.b1 })));
  /** @type {RackKnob[]} */
  const knobs = Array.from({ length: STEPS }, (_, s) => /** @type {RackKnob} */ ({ part: 'note', step: s, on: 'top', a: across(s) + K.width / 2, b: knobB }));
  knobs.push({ part: 'tempo', step: -1, on: 'panel', a: 0.062, b: 0.122 });
  const cos = Math.cos(tilt), sin = Math.sin(tilt), lc = Math.cos(panel.lean), ls = Math.sin(panel.lean);
  // From the front, in line with the synth's: the top's front edge, its back edge at the panel's
  // foot, and the panel's back.
  const zFront = S.zFront, zFoot = zFront - length * cos, zBack = zFoot - panel.thick * lc - panel.height * ls;
  const x0 = S.x1 + RACK.gap, top = front + length * sin;
  // The panel's rows: the first from its foot, the second over it to its top edge; a plate a little
  // in from its row's edges.
  const R1 = { b0: 0.006, b1: panel.row - 0.006 }, R2 = { b0: panel.row + 0.006, b1: panel.height - 0.006 };
  // In the first, the clock's module at the left, nearest the synth, then the sequencer's, the
  // delay's, the LFO's and the envelope's; in the second, the mixer's, the filter's, the reverb's and
  // a blank plate over the envelope. Along their feet the jacks, the outs on plates.
  /** @type {RackModule[]} */
  const modules = [
    { id: 'clock', name: 'CLOCK', a0: 0.01, a1: 0.198, ...R1 },
    { id: 'seq', name: 'SEQUENCER', a0: 0.204, a1: 0.5, ...R1 },
    { id: 'delay', name: 'DELAY', a0: 0.506, a1: 0.603, ...R1 },
    { id: 'lfo', name: 'LFO', a0: 0.609, a1: 0.702, ...R1 },
    { id: 'envelope', name: 'ENVELOPE', a0: 0.708, a1: width - 0.01, ...R1 },
    { id: 'mixer', name: 'MIXER', a0: 0.01, a1: 0.326, ...R2 },
    { id: 'filter', name: 'FILTER', a0: 0.332, a1: 0.532, ...R2 },
    { id: 'reverb', name: 'REVERB', a0: 0.538, a1: 0.702, ...R2 },
  ];
  const blanks = [{ a0: 0.708, a1: width - 0.01, ...R2 }];
  // The delay's and the LFO's knobs: the first in the middle of its module, the other two side by
  // side under it; the envelope's depth likewise over its other four. The filter's and the reverb's,
  // in the shorter row, side by side; the mixer's each over its in, a jack's pitch apart.
  const mid = (/** @type {number} */ m) => (modules[m].a0 + modules[m].a1) / 2;
  const delayA = mid(2), lfoA = mid(3), envA = mid(4), filterA = mid(6), reverbA = mid(7), SIDE = 0.0235;
  const E = modules[4], M = modules[5], F = modules[6], JP = BOARD.panel.pitch, END = 0.034;
  /** @param {number} a @param {number} k */
  const place = (a, k) => ({ a: a + (k === 0 ? 0 : k === 1 ? -SIDE : SIDE), b: k === 0 ? 0.196 : 0.118 });
  /** @param {number} a @param {number} k @param {number} count */
  const inRow = (a, k, count) => ({ a: a + (k - (count - 1) / 2) * N.pitch, b: panel.row + 0.104 });
  for (const [k, name] of DELAY_KNOBS.entries()) knobs.push({ part: 'delay', name, step: -1, on: 'panel', ...place(delayA, k) });
  for (const [k, name] of LFO_KNOBS.entries()) knobs.push({ part: 'lfo', name, step: -1, on: 'panel', ...place(lfoA, k) });
  for (const [k, name] of ENVELOPE_KNOBS.entries()) {
    knobs.push({ part: 'envelope', name, step: -1, on: 'panel', ...(name === 'depth' ? { a: envA, b: 0.196 } : { a: envA + (k - 1.5) * N.pitch, b: 0.118 }) });
  }
  for (const [k, name] of MIXER_KNOBS.entries()) knobs.push({ part: 'mixer', name, step: -1, on: 'panel', a: M.a0 + END + k * JP, b: panel.row + 0.104 });
  for (const [k, name] of FILTER_KNOBS.entries()) knobs.push({ part: 'filter', name, step: -1, on: 'panel', ...inRow(filterA, k, FILTER_KNOBS.length) });
  for (const [k, name] of REVERB_KNOBS.entries()) knobs.push({ part: 'reverb', name, step: -1, on: 'panel', ...inRow(reverbA, k, REVERB_KNOBS.length) });
  // Under each of them, where its setting is written.
  const { w: SW, h: SH, below } = RACK.setting;
  const settings = knobs.flatMap((n, k) => {
    if (!isModuleKnob(n)) return [];
    const b = n.b - RACK.knob.module - below;
    return [{ k, a0: n.a - SW / 2, a1: n.a + SW / 2, b0: b - SH / 2, b1: b + SH / 2 }];
  });
  const J = 0.042, J2 = panel.row + J;
  /** @type {import('./board.js').BoardJack[]} */
  const jacks = [
    ...RACK_CLOCK_OUTS.map((o, k) => ({ id: o.id, a: 0.042 + k * 0.062, b: J, out: true, color: null })),
    { id: 'seq.clock', a: 0.236, b: J, out: false, color: null },
    { id: 'seq.notes', a: 0.458, b: J, out: true, color: null },
    { id: 'rackdelay.in', a: delayA, b: J, out: false, color: null },
    { id: 'lfo.out', a: lfoA, b: J, out: true, color: null },
    { id: 'env.clock', a: E.a0 + END, b: J, out: false, color: null },
    { id: 'env.notes', a: envA, b: J, out: false, color: null },
    { id: 'env.out', a: E.a1 - END, b: J, out: true, color: null },
    ...MIXER_KNOBS.map((name, k) => ({ id: `mixer.${name}`, a: M.a0 + END + k * JP, b: J2, out: false, color: null })),
    { id: 'mixer.out', a: M.a0 + END + MIXER_KNOBS.length * JP, b: J2, out: true, color: null },
    { id: 'filter.in', a: F.a0 + 0.038, b: J2, out: false, color: null },
    { id: 'filter.cutoff', a: filterA, b: J2, out: false, color: null },
    { id: 'filter.out', a: F.a1 - 0.038, b: J2, out: true, color: null },
    { id: 'reverb.in', a: reverbA, b: J2, out: false, color: null },
  ];
  /** @type {RackButton[]} */
  const buttons = [
    { id: 'run', label: 'RUN', a0: 0.118, a1: 0.178, b0: 0.1, b1: 0.146 },
    { id: 'octave.down', label: '−', a0: 0.218, a1: 0.262, b0: 0.1, b1: 0.14 },
    { id: 'octave.up', label: '+', a0: 0.27, a1: 0.314, b0: 0.1, b1: 0.14 },
  ];
  return {
    x0, x1: x0 + width, zBack, zFront, width, length, tilt, front, top,
    /** @type {[number, number, number]} */
    origin: [x0, front, zFront],
    /** @type {[number, number, number]} */
    up: [0, sin, -cos],
    /** @type {[number, number, number]} */
    normal: [0, cos, sin],
    /** each step's keys, SEQ_ROWS's rows one after another: row r's key for step s is keys[r * STEPS + s] */
    keys,
    numbers,
    names,
    /** the rows' names in the margin at the left, each at the middle of its row (the notes' at their knobs') */
    labels: [
      { text: 'STEP', b: (rows[0].b0 + rows[0].b1) / 2 },
      { text: 'ACCENT', b: (rows[1].b0 + rows[1].b1) / 2 },
      { text: 'SLIDE', b: (rows[2].b0 + rows[2].b1) / 2 },
      { text: 'NOTE', b: knobB },
    ],
    knobs,
    panel: {
      /** @type {[number, number, number]} */
      origin: [x0, top, zFoot],
      /** @type {[number, number, number]} */
      up: [0, lc, -ls],
      /** @type {[number, number, number]} */
      normal: [0, ls, lc],
      height: panel.height, lean: panel.lean, top: top + panel.height * lc,
      modules,
      /** the plates where no module is yet */
      blanks,
      /** the clock's display (its tempo) and the sequencer's (its step, its octave, the note set last) */
      displays: {
        clock: { a0: 0.024, a1: 0.184, b0: 0.178, b1: 0.232 },
        seq: { a0: 0.218, a1: 0.486, b0: 0.168, b1: 0.232 },
      },
      buttons,
      jacks,
      /** where its jacks start in the room's list of them (the board's, then the synth's, first) */
      jackBase: S.panel.jackBase + S.panel.jacks.length,
      /** where each of the modules' knobs' settings is written (`k` the knob's index in knobs) */
      settings,
      /** the LFO's light and the envelope's, each by its name: where its middle is */
      lights: { lfo: { a: lfoA + 0.028, b: R1.b1 - 0.02 }, envelope: { a: envA + 0.046, b: R1.b1 - 0.02 } },
      /** what is written on it besides: the modules' names (near the top of each), the tempo's knob's and the octave's buttons' @type {import('./synthboard.js').PanelTitle[]} */
      titles: [
        ...modules.map((m) => ({ text: m.name, a: (m.a0 + m.a1) / 2, b: m.b1 - 0.02 })),
        { text: 'TEMPO', a: 0.062, b: 0.088 },
        { text: 'OCTAVE', a: 0.266, b: 0.152 },
      ],
    },
    sign: { x0, x1: x0 + width, y0: RACK.sign.bottom, y1: RACK.sign.top, z: L.z1 + RACK.sign.out },
  };
}

/** The rack as layoutRack lays it out. @typedef {ReturnType<typeof layoutRack>} RackDesk */

/**
 * The key at (a, b) on the top: its index in R.keys (row r's key for step s is r * STEPS + s), else -1.
 * @param {RackDesk} R
 * @param {number} a
 * @param {number} b
 */
export const rackKeyAt = (R, a, b) => areaAt(R.keys, a, b);

/**
 * The knob at (a, b) on the top or on the panel (`on`): a step's note's (anywhere across its column,
 * to be easier to point at between them, and a little over and under it) or one on the panel (a
 * little larger than it): its index in R.knobs, else -1.
 * @param {RackDesk} R
 * @param {number} a
 * @param {number} b
 * @param {'top' | 'panel'} [on]
 */
export function rackKnobAt(R, a, b, on = 'top') {
  const half = RACK.step.pitch / 2;
  for (let k = 0; k < R.knobs.length; k++) {
    const n = R.knobs[k];
    if (n.on !== on) continue;
    if (n.part === 'note' ? Math.abs(a - n.a) <= half && Math.abs(b - n.b) <= RACK.knob.r * 1.4 : (a - n.a) ** 2 + (b - n.b) ** 2 <= (knobRadius(n) * 1.25) ** 2) return k;
  }
  return -1;
}

/**
 * The button at (a, b) on the panel: its index in R.panel.buttons, else -1.
 * @param {RackDesk} R
 * @param {number} a
 * @param {number} b
 */
export const rackButtonAt = (R, a, b) => areaAt(R.panel.buttons, a, b);

/** Where the last ray met the rack (hitRack's), kept to write no new object per ray. @type {import('./board.js').DeskHit} */
const MET = { on: '', t: 0, a: 0, b: 0, nx: 0, ny: 0, nz: 0 };

/**
 * What a ray meets on the rack, if nearer than `within` (what it meets in the room otherwise): a key
 * (its row's kind, SEQ_ROWS, and `seq` its step; u, v where on it, from its front left), a knob
 * ('rackknob', `rack` its index in R.knobs), on the panel a jack (as the board's are, its index in the
 * room's list of them: R.panel.jackBase on), a knob (the tempo's or a module's) or a button
 * ('rackbutton', `rack` its index in R.panel.buttons), or the rest of the rack ('rack': its top, its
 * panel, its front, its sides, its sign), written into out as room.js castRay writes a hit (the
 * board's and the synth's pad, step key, knob, key, dial and button -1). Whether it met the rack.
 * @param {RackDesk} R
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {import('./board.js').BandHit} out
 * @param {number} [within]
 */
export function hitRack(R, ox, oy, oz, dx, dy, dz, out, within = Infinity) {
  if (!meetDesk(R, ox, oy, oz, dx, dy, dz, within, RACK.key.rise, MET)) return false;
  let kind = 'rack', seq = -1, rack = -1, jack = -1, u = 0, v = 0;
  const { a, b } = MET;
  if (MET.on === 'top') {
    const key = rackKeyAt(R, a, b);
    if (key >= 0) {
      const q = R.keys[key];
      kind = SEQ_ROWS[Math.floor(key / STEPS)];
      seq = key % STEPS;
      u = (a - q.a0) / (q.a1 - q.a0);
      v = (b - q.b0) / (q.b1 - q.b0);
    } else {
      rack = rackKnobAt(R, a, b);
      if (rack >= 0) kind = 'rackknob';
    }
  } else if (MET.on === 'panel') {
    const j = jackAt(R, a, b);
    if (j >= 0) {
      jack = R.panel.jackBase + j;
      kind = 'jack';
    } else {
      rack = rackKnobAt(R, a, b, 'panel');
      if (rack >= 0) kind = 'rackknob';
      else {
        rack = rackButtonAt(R, a, b);
        if (rack >= 0) kind = 'rackbutton';
      }
    }
  }
  writeHit(out, MET, kind, ox, oy, oz, dx, dy, dz, u, v);
  out.pad = out.step = out.knob = out.key = out.dial = out.button = out.keys = out.guitar = -1;
  out.jack = jack;
  out.seq = seq;
  out.rack = rack;
  return true;
}

/**
 * A tip (a stick's, a finger's) that went from (fx, fy, fz) to (tx, ty, tz): if it came down through
 * a key's cap, which (its index in R.keys), else -1. Where it crossed, not where it ended, says which.
 * @param {RackDesk} R
 * @param {number} fx
 * @param {number} fy
 * @param {number} fz
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 */
export function rackStrike(R, fx, fy, fz, tx, ty, tz) {
  const rise = RACK.key.rise, hf = heightOver(R, fx, fy, fz, rise), ht = heightOver(R, tx, ty, tz, rise);
  if (!(hf > 0 && ht <= 0)) return -1;
  const f = hf / (hf - ht);
  const x = fx + (tx - fx) * f, y = fy + (ty - fy) * f, z = fz + (tz - fz) * f;
  const [Ox, Oy, Oz] = R.origin, [, Uy, Uz] = R.up;
  return rackKeyAt(R, x - Ox, (y - Oy) * Uy + (z - Oz) * Uz);
}
