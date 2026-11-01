// The synth, to the right of the drum board against the far wall: a desk as the board is (a top
// leaning a little towards the player, a panel at its back leaning back, a sign over it on the wall:
// board.js's Desk, whose functions work on it too). Along the top's front edge its keys, thirty-seven
// from a C to a C (synth.js KEYS), the black ones standing over the white; behind them its knobs (the
// dials, as they are called here beside the board's knobs) in two rows, each row's sections spread
// across it, the oscillator, the LFO and the filter at the back and the envelopes and the output in
// front (synth.js SECTIONS), each knob's name under it and its section's under those, where the knobs
// can't hide them; and on the panel a display (what is playing, the octave, the arpeggiator, the knob
// turned last), the presets' buttons in two rows of four (the poly sounds over the mono ones), Mono's
// and the octave's; over those its patch bay (patch.js's synth jacks: its sound, the LFO and the filter
// envelope out on a plate at the left, nearest the board, the pitch, the cutoff and the amp in) and
// the arpeggiator (its clock in, a button for each way it plays, HOLD and RANGE). Pure functions with
// no three.js, as board.js's, so the tests run them in Node: where it stands and what is on it
// (layoutSynth), what a ray meets on it (hitSynth: a black key over the white ones), the key at a
// place on it, and the key a stick's tip or a finger is down in (keyUnder), and how hard it went in
// (keyVelocity).
//
// Coordinates as board.js's: on the top `a` from its left edge (world +x), `b` from its front edge
// up the slope; on the panel `a` likewise, `b` from its foot up its face.
import { heightOver, jackAt, meetDesk, writeHit } from './board.js';
import { ARP_MODES } from './arp.js';
import { KEYS, LOWEST, PRESETS, SECTIONS, SYNTH_KNOBS, isBlack } from './synth.js';

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The synth's measures, in metres and radians.
 */
export const SYNTH = Object.freeze({
  /**
   * The keys: a white key `white` across (`gap` between two), `length` deep, its top `rise` over the
   * top; a black key `black` across and `blackLength` deep, its top `blackRise` over the white keys';
   * how far a key goes down pressed (`travel`); the keys `front` from the top's front edge, and
   * `margin` from its sides.
   */
  key: Object.freeze({ white: 0.04, gap: 0.003, length: 0.13, rise: 0.014, black: 0.024, blackLength: 0.082, blackRise: 0.012, travel: 0.006, front: 0.02, margin: 0.045 }),
  /** The dials: each one's radius and height, `spacing` apart in a section, a row of sections `side` in from the top's sides. */
  dial: Object.freeze({ r: 0.019, h: 0.02, spacing: 0.066, side: 0.03 }),
  /** Under each row of dials their names (`names` deep), and under those their sections' (`titles` deep); `gap` between the rows. */
  row: Object.freeze({ titles: 0.014, names: 0.014, gap: 0.014 }),
  /**
   * The panel: `height` up its face, leaning back `lean`, `thick`; its buttons standing `button` out
   * of it; the jacks (as large as the board's, board.js BOARD.panel.jack) `pitch` apart along `row`.
   */
  panel: Object.freeze({ height: 0.28, lean: 0.35, thick: 0.04, button: 0.007, pitch: 0.062, row: 0.2125 }),
  /** The top's front edge `front` high, leaning back by `tilt`, `thick`; the panel's back `wall` from the wall; `gap` right of the board. */
  front: 0.9, tilt: 0.12, thick: 0.05, wall: 0.08, gap: 0.5,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/** Where each black key sits, from the line between the white keys either side of it, in its own widths (C♯, D♯, F♯, G♯, A♯), as a piano's. */
const BLACK = /** @type {Readonly<Record<number, number>>} */ ({ 1: -0.18, 3: 0.18, 6: -0.24, 8: 0, 10: 0.24 });

/** The sections in the two rows of dials, the front row first. @type {readonly (readonly import('./synth.js').Section[])[]} */
const ROWS = [['fenv', 'aenv', 'out'], ['osc', 'lfo', 'filter']];

/**
 * A key: whether it is black, and its top's place (a0…a1, b0…b1). Its note is the synth's lowest
 * now (synth.js Synth.lowest) and as many semitones up as its index.
 * @typedef {{ black: boolean, a0: number, a1: number, b0: number, b1: number }} SynthKey
 */

/**
 * A dial: the knob it turns (synth.js), its section, its name on the top, and where it is.
 * @typedef {{ id: import('./synth.js').SynthKnob, section: import('./synth.js').Section, label: string, a: number, b: number }} SynthDial
 */

/**
 * A button on the panel: 'preset.<id>' (synth.js PRESETS), 'mono', 'octave.down' or 'octave.up';
 * the arpeggiator's 'arp.<mode>' (arp.js ARP_MODES), 'arp.hold' or 'arp.range'; what is on it, and
 * where.
 * @typedef {{ id: string, label: string, a0: number, a1: number, b0: number, b1: number }} SynthButton
 */

/**
 * What is written on the panel over its buttons and jacks, at (a, b); over a span (a0…a1: the patch
 * bay's, the arpeggiator's) with a line along it either side.
 * @typedef {{ text: string, a: number, b: number, a0?: number, a1?: number }} PanelTitle
 */

/**
 * The synth to the right of the board (board.js layoutBoard), against the far wall: its footprint and
 * its top and panel as a Desk (board.js), its keys (`whites` and `blacks`: which they are, left to
 * right) and the bed they lie on, its dials (in synth.js SYNTH_KNOBS's order) and their sections
 * (each one's place across, and its row), the two rows (the dials' line, the bands under it where
 * their names and their sections' are), the part of the top behind the keys where those are drawn
 * (`deck`); on the panel its display, its buttons, its jacks (as the board's, in patch.js JACKS's
 * order; in the room's list of jacks after the board's, from `jackBase`) and what is written over
 * them; and its sign.
 * @param {{ z1: number }} L the room's layout (room.js layoutRoom)
 * @param {{ x1: number, panel: { jacks: readonly unknown[] } }} B the drum board's (board.js layoutBoard)
 */
export function layoutSynth(L, B) {
  const { key: K, dial: R, row, panel, tilt, front, wall } = SYNTH;
  /** @type {SynthKey[]} */
  const keys = [];
  /** @type {number[]} */
  const whites = [], blacks = [];
  for (let k = 0; k < KEYS; k++) {
    const note = LOWEST + k;
    if (isBlack(note)) {
      const mid = K.margin + whites.length * K.white + BLACK[note % 12] * K.black;
      keys.push({ black: true, a0: mid - K.black / 2, a1: mid + K.black / 2, b0: K.front + K.length - K.blackLength, b1: K.front + K.length });
      blacks.push(k);
    } else {
      const a0 = K.margin + whites.length * K.white;
      keys.push({ black: false, a0, a1: a0 + K.white, b0: K.front, b1: K.front + K.length });
      whites.push(k);
    }
  }
  const width = 2 * K.margin + whites.length * K.white;
  const bed = { a0: K.margin, a1: K.margin + whites.length * K.white, b0: K.front, b1: K.front + K.length };
  // The dials, a row at a time from the front: its sections' names in a band, theirs over it, then
  // the dials; each section's dials `spacing` apart, the sections spread across the row.
  /** @type {SynthDial[]} */
  const dials = [];
  /** @type {{ id: import('./synth.js').Section, label: string, name: string, row: number, a0: number, a1: number }[]} */
  const sections = [];
  /** @type {{ b: number, titles: { b0: number, b1: number }, names: { b0: number, b1: number } }[]} */
  const rows = [];
  let b0 = bed.b1 + 0.02;
  ROWS.forEach((ids, r) => {
    const titles = { b0, b1: b0 + row.titles }, names = { b0: titles.b1, b1: titles.b1 + row.names };
    const b = names.b1 + 0.004 + R.r;
    rows.push({ b, titles, names });
    const n = SYNTH_KNOBS.filter((k) => ids.includes(k.section)).length;
    const space = (width - 2 * R.side - n * R.spacing) / (ids.length - 1);
    let a = R.side;
    for (const id of ids) {
      const s = /** @type {(typeof SECTIONS)[number]} */ (SECTIONS.find((x) => x.id === id));
      const start = a;
      for (const k of SYNTH_KNOBS) {
        if (k.section !== id) continue;
        dials.push({ id: k.id, section: id, label: k.label, a: a + R.spacing / 2, b });
        a += R.spacing;
      }
      sections.push({ id, label: s.label, name: s.name, row: r, a0: start, a1: a });
      a += space;
    }
    b0 = b + R.r + row.gap;
  });
  const order = SYNTH_KNOBS.map((k) => k.id);
  dials.sort((p, q) => order.indexOf(p.id) - order.indexOf(q.id));
  const length = rows[rows.length - 1].b + R.r + 0.02;
  const cos = Math.cos(tilt), sin = Math.sin(tilt), lc = Math.cos(panel.lean), ls = Math.sin(panel.lean);
  // From the wall: the panel's back, its foot at the top's back edge, and the top's front edge.
  const zBack = L.z1 + wall, zFoot = zBack + panel.thick * lc + panel.height * ls, zFront = zFoot + length * cos;
  const x0 = B.x1 + SYNTH.gap, top = front + length * sin;
  // The panel: the display at the left; the presets, the poly ones over the mono ones; at the right
  // Mono and the octave, down and up.
  const right = width - 0.03;
  /** @param {boolean} mono */
  const group = (mono) => PRESETS.filter((p) => p.mono === mono);
  /** @type {SynthButton[]} */
  const buttons = PRESETS.map((p) => {
    const c = group(p.mono).indexOf(p), a0 = 0.36 + c * 0.088;
    return { id: `preset.${p.id}`, label: p.name.toUpperCase(), a0, a1: a0 + 0.08, b0: p.mono ? 0.025 : 0.08, b1: p.mono ? 0.07 : 0.125 };
  });
  buttons.push(
    { id: 'mono', label: 'MONO', a0: right - 0.205, a1: right - 0.125, b0: 0.08, b1: 0.125 },
    { id: 'octave.down', label: '−', a0: right - 0.1, a1: right - 0.055, b0: 0.08, b1: 0.125 },
    { id: 'octave.up', label: '+', a0: right - 0.045, a1: right, b0: 0.08, b1: 0.125 },
  );
  // Over them, along a row: the patch bay at the left, its outs on a plate and then the
  // modulations' ins; the arpeggiator at the right, its clock in, a button for each way it plays,
  // HOLD and RANGE.
  const J = panel.row, pitch = panel.pitch, arp = 0.495;
  /** @type {import('./board.js').BoardJack[]} */
  const jacks = [
    { id: 'synth.out', a: 0.05, b: J, out: true, color: null },
    { id: 'synth.clock', a: 0.45, b: J, out: false, color: null },
    { id: 'synth.lfo', a: 0.05 + pitch, b: J, out: true, color: null },
    { id: 'synth.env', a: 0.05 + 2 * pitch, b: J, out: true, color: null },
    { id: 'synth.pitch', a: 0.06 + 3 * pitch, b: J, out: false, color: null },
    { id: 'synth.cutoff', a: 0.06 + 4 * pitch, b: J, out: false, color: null },
    { id: 'synth.amp', a: 0.06 + 5 * pitch, b: J, out: false, color: null },
  ];
  buttons.push(
    ...ARP_MODES.map((m, i) => ({ id: `arp.${m.id}`, label: m.label, a0: arp + i * 0.07, a1: arp + i * 0.07 + 0.062, b0: J - 0.0225, b1: J + 0.0225 })),
    { id: 'arp.hold', label: 'HOLD', a0: right - 0.15, a1: right - 0.08, b0: J - 0.0225, b1: J + 0.0225 },
    { id: 'arp.range', label: 'RANGE', a0: right - 0.07, a1: right, b0: J - 0.0225, b1: J + 0.0225 },
  );
  const over = panel.height - 0.022, bay = { a0: 0.024, a1: 0.06 + 5 * pitch + 0.026 };
  return {
    x0, x1: x0 + width, zBack, zFront, width, length, tilt, front, top,
    /** @type {[number, number, number]} */
    origin: [x0, front, zFront],
    /** @type {[number, number, number]} */
    up: [0, sin, -cos],
    /** @type {[number, number, number]} */
    normal: [0, cos, sin],
    keys,
    whites,
    blacks,
    bed,
    dials,
    sections,
    rows,
    /** where the dials' names and their sections' are drawn: the top behind the keys */
    deck: { b0: bed.b1 + 0.008, b1: length },
    panel: {
      /** @type {[number, number, number]} */
      origin: [x0, top, zFoot],
      /** @type {[number, number, number]} */
      up: [0, lc, -ls],
      /** @type {[number, number, number]} */
      normal: [0, ls, lc],
      height: panel.height, lean: panel.lean, top: top + panel.height * lc,
      display: { a0: 0.03, a1: 0.33, b0: 0.025, b1: 0.125 },
      buttons,
      jacks,
      /** where its jacks start in the room's list of them (the board's first) */
      jackBase: B.panel.jacks.length,
      /** what is written over the presets, Mono and the octave's, and over the patch bay and the arpeggiator @type {PanelTitle[]} */
      titles: [
        { text: 'PRESETS', a: 0.36 + (3 * 0.088 + 0.08) / 2, b: 0.148 },
        { text: 'MONO', a: right - 0.165, b: 0.148 },
        { text: 'OCTAVE', a: right - 0.05, b: 0.148 },
        { text: 'PATCH', a: (bay.a0 + bay.a1) / 2, b: over, ...bay },
        { text: 'ARPEGGIATOR', a: (0.424 + right) / 2, b: over, a0: 0.424, a1: right },
      ],
    },
    sign: { x0, x1: x0 + width, y0: SYNTH.sign.bottom, y1: SYNTH.sign.top, z: L.z1 + SYNTH.sign.out },
  };
}

/** The synth as layoutSynth lays it out. @typedef {ReturnType<typeof layoutSynth>} SynthDesk */

/**
 * The black key whose top's place (a, b) is in, else -1.
 * @param {SynthDesk} S
 * @param {number} a
 * @param {number} b
 */
export function blackKeyAt(S, a, b) {
  for (const k of S.blacks) {
    const q = S.keys[k];
    if (a >= q.a0 && a <= q.a1 && b >= q.b0 && b <= q.b1) return k;
  }
  return -1;
}

/**
 * The key at (a, b) on the top, as seen from over it: a black key's place first, else the white key
 * there (their gaps included); else -1.
 * @param {SynthDesk} S
 * @param {number} a
 * @param {number} b
 */
export function keyAt(S, a, b) {
  const k = blackKeyAt(S, a, b);
  if (k >= 0) return k;
  const bed = S.bed;
  if (a < bed.a0 || a > bed.a1 || b < bed.b0 || b > bed.b1) return -1;
  return S.whites[Math.min(S.whites.length - 1, Math.floor((a - bed.a0) / SYNTH.key.white))];
}

/**
 * The dial at (a, b) on the top (a little larger than it, to be easier to point at): its index in
 * S.dials, else -1.
 * @param {SynthDesk} S
 * @param {number} a
 * @param {number} b
 */
export function dialAt(S, a, b) {
  const r = SYNTH.dial.r * 1.3;
  for (let d = 0; d < S.dials.length; d++) {
    const n = S.dials[d];
    if ((a - n.a) ** 2 + (b - n.b) ** 2 <= r * r) return d;
  }
  return -1;
}

/**
 * The button at (a, b) on the panel: its index in S.panel.buttons, else -1.
 * @param {SynthDesk} S
 * @param {number} a
 * @param {number} b
 */
export function buttonAt(S, a, b) {
  const buttons = S.panel.buttons;
  for (let i = 0; i < buttons.length; i++) {
    const p = buttons[i];
    if (a >= p.a0 && a <= p.a1 && b >= p.b0 && b <= p.b1) return i;
  }
  return -1;
}

/** Where the last ray met the synth (hitSynth's), kept to write no new object per ray. @type {import('./board.js').DeskHit} */
const MET = { on: '', t: 0, a: 0, b: 0, nx: 0, ny: 0, nz: 0 };

/**
 * What a ray meets on the synth, if nearer than `within` (what it meets in the room otherwise): a
 * black key's top (over the white keys'), a white key's (where its gap is, the one it is beside; u
 * across it and v along it, from its front left), a dial, on the panel a jack (as the board's are,
 * its index in the room's list of them: S.panel.jackBase on) or a button, or the rest of the synth
 * ('synth': its top, its panel, its front, its sides, its sign), written into out as room.js castRay
 * writes a hit, with which key, dial, button and jack (else -1; the board's pad, step key and knob,
 * -1). Whether it met the synth.
 * @param {SynthDesk} S
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {import('./board.js').BandHit} out
 * @param {number} [within]
 */
export function hitSynth(S, ox, oy, oz, dx, dy, dz, out, within = Infinity) {
  const K = SYNTH.key;
  let key = -1, dial = -1, button = -1, jack = -1, kind = 'synth', u = 0, v = 0;
  const [Ox, Oy, Oz] = S.origin, [, Uy, Uz] = S.up, [, Ny, Nz] = S.normal, dn = dy * Ny + dz * Nz;
  if (dn < 0) {
    const rise = K.rise + K.blackRise, s = ((Oy + Ny * rise - oy) * Ny + (Oz + Nz * rise - oz) * Nz) / dn;
    if (s > 0 && s < within) {
      const a = ox + dx * s - Ox, b = (oy + dy * s - Oy) * Uy + (oz + dz * s - Oz) * Uz;
      key = blackKeyAt(S, a, b);
      if (key >= 0) {
        MET.on = 'top';
        MET.t = s;
        MET.a = a;
        MET.b = b;
        MET.nx = 0;
        MET.ny = Ny;
        MET.nz = Nz;
      }
    }
  }
  if (key < 0) {
    if (!meetDesk(S, ox, oy, oz, dx, dy, dz, within, K.rise, MET)) return false;
    if (MET.on === 'top') {
      key = keyAt(S, MET.a, MET.b);
      dial = key < 0 ? dialAt(S, MET.a, MET.b) : -1;
    } else if (MET.on === 'panel') {
      const j = jackAt(S, MET.a, MET.b);
      if (j >= 0) jack = S.panel.jackBase + j;
      else button = buttonAt(S, MET.a, MET.b);
    }
  }
  if (key >= 0) {
    const q = S.keys[key];
    kind = 'key';
    u = clamp((MET.a - q.a0) / (q.a1 - q.a0), 0, 1);
    v = clamp((MET.b - q.b0) / (q.b1 - q.b0), 0, 1);
  } else if (dial >= 0) kind = 'dial';
  else if (jack >= 0) kind = 'jack';
  else if (button >= 0) kind = 'button';
  writeHit(out, MET, kind, ox, oy, oz, dx, dy, dz, u, v);
  out.pad = out.step = out.knob = -1;
  out.jack = jack;
  out.key = key;
  out.dial = dial;
  out.button = button;
  return true;
}

/**
 * The key a tip (a stick's, a finger's) at (x, y, z) is down in: in its place on the top and below
 * its top (a black key's first, standing over the white ones), but not through the top; written into
 * out with the key whose place it is over however high (`over`), how high the tip is over the top
 * (`h`, m) and how high that key's top is (`top`, the white keys' over none); else out.key is -1.
 * @param {SynthDesk} S
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ key: number, over: number, h: number, top: number }} out
 */
export function keyUnder(S, x, y, z, out) {
  const K = SYNTH.key, [Ox, Oy, Oz] = S.origin, [, Uy, Uz] = S.up;
  const h = heightOver(S, x, y, z, 0), a = x - Ox, b = (y - Oy) * Uy + (z - Oz) * Uz;
  const over = keyAt(S, a, b);
  out.over = over;
  out.h = h;
  out.top = over >= 0 && S.keys[over].black ? K.rise + K.blackRise : K.rise;
  out.key = over >= 0 && h >= 0 && h < out.top ? over : -1;
  return out;
}

/**
 * How fast a tip went down into a key (m/s) as a velocity 0…1: a finger presses more slowly than a
 * stick comes down, so a finger's counts for more.
 * @param {number} speed
 * @param {boolean} [finger]
 */
export const keyVelocity = (speed, finger = false) => clamp((speed - (finger ? 0.03 : 0.06)) / (finger ? 0.5 : 1), 0.12, 1);
