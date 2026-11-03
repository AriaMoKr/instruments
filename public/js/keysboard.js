// The keyboard, to the left of the drum board against the far wall: a desk as the board is (a top
// leaning a little towards the player, a panel at its back leaning back, a sign over it on the wall:
// board.js's Desk, whose functions work on it too) and as the synth is, whose keys it shares
// (synthboard.js layoutKeys). Along the top's front edge its sixty-one keys (keys.js KEYS_COUNT, from
// KEYS_LOWEST); behind them, in a row, its nine drawbars (each a tab in a slot, pushed in at the back
// and pulled out towards the player, keys.js DRAWBARS) and its knobs, the organ's and the electric
// piano's (keys.js KEYS_KNOBS, as large as the synth's dials), each one's name in front of it and its
// section's in front of those, the sections spread across the row; and on the panel a display (the
// sound, the drawbars as an organist writes them, the percussion, the rotary speaker, the octave, the
// knob turned last), the sounds' buttons (ORGAN, E.PIANO, BOTH), the percussion's (PERC, 3RD, FAST),
// the rotary speaker's (FAST), SUSTAIN and the octave's; over them at its right end, nearest the
// board, its jacks (patch.js's keys jacks: its sound and its notes out on a plate, and the rotary
// speaker's speed in). Pure functions with no three.js, as board.js's, so the tests run them in Node:
// where it stands and what is on it (layoutKeyboard), what a ray meets on it (hitKeys: a black key
// over the white ones), where along its slot a drawbar is pulled to (drawbarValue, drawbarAlong,
// tabB), and the part of it to stand back from on a narrow screen (framedKeys).
//
// Coordinates as board.js's: on the top `a` from its left edge (world +x), `b` from its front edge
// up the slope; on the panel `a` likewise, `b` from its foot up its face.
import { jackAt, meetDesk, writeHit } from './board.js';
import { SYNTH, blackKeyAt, buttonAt, dialAt, keyAt, layoutKeys } from './synthboard.js';
import { KEYS_COUNT, KEYS_KNOBS, KEYS_LOWEST, KEYS_SECTIONS, KEYS_SOUNDS, KEYS_SWITCHES } from './keys.js';

/** @typedef {import('./keys.js').KeysKnob} KeysKnob */
/** @typedef {import('./keys.js').KeysSection} KeysSection */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The keyboard's measures, in metres and radians (its keys and knobs are the synth's: SYNTH.key and
 * SYNTH.dial, the bands of names in front of the knobs SYNTH.row's).
 */
export const KEYBOARD = Object.freeze({
  /**
   * The drawbars: each one's tab `tab` across and `grip` deep, standing `h` out of the top, `spacing`
   * apart; its slot `slot` long, from pushed in (0) at its back end to pulled out (8) at its front.
   */
  drawbar: Object.freeze({ tab: 0.024, grip: 0.026, h: 0.016, spacing: 0.04, slot: 0.12 }),
  /**
   * The panel: `height` up its face, leaning back `lean`, `thick`; its buttons standing `button` out
   * of it; its jacks (as large as the board's, board.js BOARD.panel.jack) `pitch` apart along `row`.
   */
  panel: Object.freeze({ height: 0.24, lean: 0.35, thick: 0.04, button: 0.007, pitch: 0.062, row: 0.165 }),
  /** The top's front edge `front` high, leaning back by `tilt`, `thick`; the panel's back `wall` from the wall; `gap` left of the board. */
  front: 0.9, tilt: 0.12, thick: 0.05, wall: 0.08, gap: 0.5,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/**
 * A drawbar: the knob it is (keys.js), its name, where across it is and its slot (b0…b1).
 * @typedef {{ id: KeysKnob, label: string, a: number, b0: number, b1: number }} Drawbar
 */

/**
 * A knob on the top: the knob it turns (keys.js), its section, its name on the top, and where it is.
 * @typedef {{ id: KeysKnob, section: KeysSection, label: string, a: number, b: number }} KeysDial
 */

/**
 * A button on the panel: 'sound.<id>' (keys.js KEYS_SOUNDS), 'switch.<id>' (KEYS_SWITCHES), 'sustain',
 * 'octave.down' or 'octave.up'; what is on it, and where.
 * @typedef {{ id: string, label: string, a0: number, a1: number, b0: number, b1: number }} KeysButton
 */

/**
 * The keyboard to the left of the board (board.js layoutBoard), against the far wall: its footprint
 * and its top and panel as a Desk (board.js), its keys (synthboard.js layoutKeys: `whites` and
 * `blacks`, and the bed they lie on), its drawbars and its knobs (in keys.js KEYS_KNOBS's order) and
 * their sections (each one's place across), the row they are in (the bands in front of it where their
 * names and their sections' are, and its span up the top, b0…b1, the drawbars' slots), the part of the
 * top behind the keys where those are drawn (`deck`); on the panel its display, its buttons, its jacks
 * (as the board's, in patch.js JACKS's order; in the room's list of jacks after the rack's, from
 * `jackBase`) and what is written over them; and its sign.
 * @param {{ z1: number }} L the room's layout (room.js layoutRoom)
 * @param {{ x0: number }} B the drum board's (board.js layoutBoard)
 * @param {{ panel: { jackBase: number, jacks: readonly unknown[] } }} rack the rack's (rackboard.js layoutRack), whose jacks come before its
 */
export function layoutKeyboard(L, B, rack) {
  const { drawbar: D, panel, tilt, front, wall } = KEYBOARD, R = SYNTH.dial, band = SYNTH.row;
  const { keys, whites, blacks, bed, width } = layoutKeys(KEYS_LOWEST, KEYS_COUNT);
  // Behind the keys, the sections' names in a band, the drawbars' and the knobs' over it, then the
  // drawbars' slots with the knobs halfway up them; each section's drawbars or knobs `spacing` apart,
  // the sections spread across the row.
  const titles = { b0: bed.b1 + 0.02, b1: bed.b1 + 0.02 + band.titles };
  const names = { b0: titles.b1, b1: titles.b1 + band.names };
  const b0 = names.b1 + 0.006, b1 = b0 + D.slot, mid = (b0 + b1) / 2;
  /** @param {KeysSection} id */
  const pitch = (id) => (id === 'drawbars' ? D.spacing : R.spacing);
  const used = KEYS_SECTIONS.reduce((sum, s) => sum + KEYS_KNOBS.filter((k) => k.section === s.id).length * pitch(s.id), 0);
  const space = (width - 2 * R.side - used) / (KEYS_SECTIONS.length - 1);
  /** @type {Drawbar[]} */
  const drawbars = [];
  /** @type {KeysDial[]} */
  const dials = [];
  /** @type {{ id: KeysSection, label: string, name: string, a0: number, a1: number }[]} */
  const sections = [];
  let a = R.side;
  for (const s of KEYS_SECTIONS) {
    const start = a, p = pitch(s.id);
    for (const k of KEYS_KNOBS) {
      if (k.section !== s.id) continue;
      if (s.id === 'drawbars') drawbars.push({ id: k.id, label: k.label, a: a + p / 2, b0, b1 });
      else dials.push({ id: k.id, section: s.id, label: k.label, a: a + p / 2, b: mid });
      a += p;
    }
    sections.push({ id: s.id, label: s.label, name: s.name, a0: start, a1: a });
    a += space;
  }
  const length = b1 + 0.02;
  const cos = Math.cos(tilt), sin = Math.sin(tilt), lc = Math.cos(panel.lean), ls = Math.sin(panel.lean);
  // From the wall: the panel's back, its foot at the top's back edge, and the top's front edge.
  const zBack = L.z1 + wall, zFoot = zBack + panel.thick * lc + panel.height * ls, zFront = zFoot + length * cos;
  const x1 = B.x0 - KEYBOARD.gap, x0 = x1 - width, top = front + length * sin;
  // The panel: the display at the left, then the buttons in a row, a group at a time, each group's
  // name over it: the sounds, the percussion, the rotary speaker, SUSTAIN (its own name), the octave.
  /** @type {KeysButton[]} */
  const buttons = [];
  /** @type {import('./synthboard.js').PanelTitle[]} */
  const over = [];
  let x = 0.37;
  /**
   * @param {string} text the group's name ('' none)
   * @param {{ id: string, label: string, w?: number }[]} group
   */
  const put = (text, group) => {
    const start = x;
    for (const g of group) {
      const w = g.w ?? 0.08;
      buttons.push({ id: g.id, label: g.label, a0: x, a1: x + w, b0: 0.035, b1: 0.08 });
      x += w + 0.008;
    }
    if (text) over.push({ text, a: (start + x - 0.008) / 2, b: 0.103 });
    x += 0.042;
  };
  put('SOUND', KEYS_SOUNDS.map((s) => ({ id: `sound.${s.id}`, label: s.label })));
  put('PERCUSSION', KEYS_SWITCHES.filter((s) => s.id !== 'rotaryFast').map((s) => ({ id: `switch.${s.id}`, label: s.label })));
  put('ROTARY', [{ id: 'switch.rotaryFast', label: 'FAST' }]);
  put('', [{ id: 'sustain', label: 'SUSTAIN' }]);
  put('OCTAVE', [{ id: 'octave.down', label: '−', w: 0.045 }, { id: 'octave.up', label: '+', w: 0.045 }]);
  // Over them at the right end, nearest the board, its jacks along a row: its outs on a plate, its
  // sound's at the end, then its notes'; then the rotary speaker's speed in.
  const J = panel.row, end = width - 0.05;
  /** @type {import('./board.js').BoardJack[]} */
  const jacks = [
    { id: 'keys.out', a: end, b: J, out: true, color: null },
    { id: 'keys.notes', a: end - panel.pitch, b: J, out: true, color: null },
    { id: 'keys.rotary', a: end - 2 * panel.pitch - 0.01, b: J, out: false, color: null },
  ];
  const bay = { a0: end - 2 * panel.pitch - 0.036, a1: width - 0.024 };
  over.push({ text: 'PATCH', a: (bay.a0 + bay.a1) / 2, b: panel.height - 0.022, ...bay });
  return {
    x0, x1, zBack, zFront, width, length, tilt, front, top,
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
    drawbars,
    dials,
    sections,
    /** the row of drawbars and knobs: the bands in front of it (their sections' names, theirs), its span up the top, its middle */
    row: { titles, names, b0, b1, b: mid },
    /** where the names and the drawbars' slots are drawn: the top behind the keys */
    deck: { b0: bed.b1 + 0.008, b1: length },
    panel: {
      /** @type {[number, number, number]} */
      origin: [x0, top, zFoot],
      /** @type {[number, number, number]} */
      up: [0, lc, -ls],
      /** @type {[number, number, number]} */
      normal: [0, ls, lc],
      height: panel.height, lean: panel.lean, top: top + panel.height * lc,
      display: { a0: 0.03, a1: 0.33, b0: 0.022, b1: 0.122 },
      buttons,
      jacks,
      /** where its jacks start in the room's list of them (the board's, the synth's and the rack's first) */
      jackBase: rack.panel.jackBase + rack.panel.jacks.length,
      /** what is written over the buttons' groups, and over its jacks */
      titles: over,
    },
    sign: { x0, x1, y0: KEYBOARD.sign.bottom, y1: KEYBOARD.sign.top, z: L.z1 + KEYBOARD.sign.out },
  };
}

/** The keyboard as layoutKeyboard lays it out. @typedef {ReturnType<typeof layoutKeyboard>} KeysDesk */

/**
 * The drawbar at (a, b) on the top (its whole lane across, a little past its slot's ends): its index
 * in K.drawbars, else -1.
 * @param {KeysDesk} K
 * @param {number} a
 * @param {number} b
 */
export function drawbarAt(K, a, b) {
  const { spacing } = KEYBOARD.drawbar, r = K.row;
  if (b < r.b0 - 0.006 || b > r.b1 + 0.006) return -1;
  for (let i = 0; i < K.drawbars.length; i++) if (Math.abs(a - K.drawbars[i].a) <= spacing / 2) return i;
  return -1;
}

/**
 * How far out a drawbar is (0…1, pushed in to pulled out) with its tab's middle at b up the top.
 * @param {KeysDesk} K
 * @param {number} b
 */
export function drawbarValue(K, b) {
  const { grip, slot } = KEYBOARD.drawbar;
  return clamp((K.row.b1 - grip / 2 - b) / (slot - grip), 0, 1);
}

/**
 * Where a drawbar's tab's middle is up the top (b) pulled out to `value` (0…1).
 * @param {KeysDesk} K
 * @param {number} value
 */
export function tabB(K, value) {
  const { grip, slot } = KEYBOARD.drawbar;
  return K.row.b1 - grip / 2 - clamp(value, 0, 1) * (slot - grip);
}

/**
 * How far out a drawbar dragged by a ray is (drawbarValue's, where the ray meets the plane of the tabs'
 * tops), else NaN: a ray that meets it nowhere ahead.
 * @param {KeysDesk} K
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 */
export function drawbarAlong(K, ox, oy, oz, dx, dy, dz) {
  const [, Oy, Oz] = K.origin, [, Uy, Uz] = K.up, [, Ny, Nz] = K.normal, h = KEYBOARD.drawbar.h;
  const dn = dy * Ny + dz * Nz;
  if (Math.abs(dn) < 1e-9) return NaN;
  const s = ((Oy + Ny * h - oy) * Ny + (Oz + Nz * h - oz) * Nz) / dn;
  if (!(s > 0)) return NaN;
  return drawbarValue(K, (oy + dy * s - Oy) * Uy + (oz + dz * s - Oz) * Uz);
}

/** Where the last ray met the keyboard (hitKeys's), kept to write no new object per ray. @type {import('./board.js').DeskHit} */
const MET = { on: '', t: 0, a: 0, b: 0, nx: 0, ny: 0, nz: 0 };

/**
 * What a ray meets on the keyboard, if nearer than `within` (what it meets in the room otherwise): a
 * black key's top (over the white keys'), a white key's ('note': where its gap is, the one it is
 * beside; u across it and v along it, from its front left), a drawbar's lane ('drawbar': v how far out
 * a press there pulls it), a knob ('keysknob'), on the panel a jack ('jack', as the board's are: `jack`
 * its index in the room's list of them, K.panel.jackBase on) or a button ('keysbutton'), or the rest
 * of the keyboard ('keys': its top, its panel, its front, its sides, its sign), written into out as
 * room.js castRay writes a hit, with `keys` which key, drawbar, knob or button it is (its index in
 * K.keys, K.drawbars, K.dials or K.panel.buttons; else -1, and the other desks' -1). Whether it met
 * the keyboard.
 * @param {KeysDesk} K
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {import('./board.js').BandHit} out
 * @param {number} [within]
 */
export function hitKeys(K, ox, oy, oz, dx, dy, dz, out, within = Infinity) {
  const S = SYNTH.key;
  let kind = 'keys', index = -1, jack = -1, u = 0, v = 0;
  const [Ox, Oy, Oz] = K.origin, [, Uy, Uz] = K.up, [, Ny, Nz] = K.normal, dn = dy * Ny + dz * Nz;
  if (dn < 0) {
    const rise = S.rise + S.blackRise, s = ((Oy + Ny * rise - oy) * Ny + (Oz + Nz * rise - oz) * Nz) / dn;
    if (s > 0 && s < within) {
      const a = ox + dx * s - Ox, b = (oy + dy * s - Oy) * Uy + (oz + dz * s - Oz) * Uz;
      index = blackKeyAt(K, a, b);
      if (index >= 0) {
        kind = 'note';
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
  if (index < 0) {
    if (!meetDesk(K, ox, oy, oz, dx, dy, dz, within, S.rise, MET)) return false;
    if (MET.on === 'top') {
      if ((index = keyAt(K, MET.a, MET.b)) >= 0) kind = 'note';
      else if ((index = drawbarAt(K, MET.a, MET.b)) >= 0) kind = 'drawbar';
      else if ((index = dialAt(K, MET.a, MET.b)) >= 0) kind = 'keysknob';
    } else if (MET.on === 'panel') {
      const j = jackAt(K, MET.a, MET.b);
      if (j >= 0) {
        kind = 'jack';
        jack = K.panel.jackBase + j;
      } else if ((index = buttonAt(K, MET.a, MET.b)) >= 0) kind = 'keysbutton';
    }
  }
  if (kind === 'note') {
    const q = K.keys[index];
    u = clamp((MET.a - q.a0) / (q.a1 - q.a0), 0, 1);
    v = clamp((MET.b - q.b0) / (q.b1 - q.b0), 0, 1);
  } else if (kind === 'drawbar') v = drawbarValue(K, MET.b);
  writeHit(out, MET, kind, ox, oy, oz, dx, dy, dz, u, v);
  out.pad = out.step = out.knob = out.key = out.dial = out.button = out.seq = out.rack = out.guitar = -1;
  out.jack = jack;
  out.keys = index;
  return true;
}

/**
 * The part of the keyboard from its key for note `from` to its key for `to` as a desk of its own (its
 * top and its panel as wide as those keys), for board.js boardFront to frame on a screen too narrow
 * for all of it.
 * @param {KeysDesk} K
 * @param {number} from
 * @param {number} to
 */
export function framedKeys(K, from, to) {
  const first = K.keys[clamp(from - KEYS_LOWEST, 0, KEYS_COUNT - 1)], last = K.keys[clamp(to - KEYS_LOWEST, 0, KEYS_COUNT - 1)];
  const a0 = first.a0, a1 = last.a1, P = K.panel;
  return {
    ...K,
    x0: K.x0 + a0, x1: K.x0 + a1, width: a1 - a0,
    /** @type {[number, number, number]} */
    origin: [K.origin[0] + a0, K.origin[1], K.origin[2]],
    panel: { ...P, origin: /** @type {[number, number, number]} */ ([P.origin[0] + a0, P.origin[1], P.origin[2]]) },
  };
}
