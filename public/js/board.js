// The drum board: a stand against the middle of the far wall, its top leaning a little towards the
// player. Along the top's front edge sixteen step keys, four to each column of pads (the pattern of
// the pad the knobs turn, pattern.js); behind them drums.js's twelve pads in their rows and columns
// (row 0 nearest); behind those a strip with the knobs (pitch, decay, tone) of the pad last played
// and what they are set to; and at the back a panel, leaning back as a desk's does, with the clock
// (its RUN button, its TEMPO knob and display, its outs ×1, ÷2 and ÷4), the drums' jacks (their
// clock in, and an out for each pad, as the pads lie) and the delay (its in, and its TIME, FEEDBACK
// and LEVEL knobs), for cables between them (patch.js). Pure functions with no three.js, as
// room.js's, so the tests run them in Node: where it stands and what is on it (layoutBoard), what a
// ray meets on it (hitBoard), where one may walk round it (clampBoard, boardBlocks), where to stand
// to play it (boardFront on a screen: as far back as all of it needs to be in view, clear of the card
// over it; boardStand in VR: at arm's length), and when a stick's tip, or a finger, comes down on a
// pad or a step key (strikeAt). Its shape, a desk (a top, a panel at its back, a sign over it), is
// the synth's too (synthboard.js): the functions here that take a Desk work on either.
//
// Coordinates as room.js's. On the top, `a` runs from its left edge to the right (world +x) and `b`
// from its front edge up the slope, away from the player; its normal leans towards the player. On the
// panel, `a` likewise and `b` from its foot (the top's back edge) up its face.
import { EYE } from './room.js';
import { COLUMNS, KNOBS, PADS, ROWS } from './drums.js';
import { CLOCK_OUTS } from './clock.js';
import { DELAY_KNOBS } from './delay.js';
import { STEPS } from './pattern.js';

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The board's measures, in metres and radians: the pads (`pad` square, `gap` apart, `margin` in
 * from the top's sides, their faces, and the step keys', `rise` over it), the strip behind them
 * `strip` deep with the knobs (`knob`: each one's radius and height, `spacing` apart, the last
 * `inset` from the right edge), the top's front edge `front` high, leaning back by `tilt`, `thick`,
 * the panel's back `wall` from the far wall, and how near a head comes to it, `keep`.
 */
export const BOARD = Object.freeze({
  pad: 0.18, gap: 0.03, margin: 0.05, rise: 0.012, strip: 0.14,
  knob: Object.freeze({ r: 0.032, h: 0.028, spacing: 0.15, inset: 0.07 }),
  /** The step keys: `depth` deep, `front` from the top's front edge, `gap` apart in a column's four. */
  step: Object.freeze({ depth: 0.06, front: 0.03, gap: 0.008 }),
  /**
   * The panel: `height` up its face, leaning back `lean` from upright, `thick`; its jacks' nuts `jack`
   * across, `pitch` apart.
   */
  panel: Object.freeze({ height: 0.25, lean: 0.35, thick: 0.04, jack: 0.014, pitch: 0.062 }),
  front: 0.9, tilt: 0.25, thick: 0.05, wall: 0.08, keep: 0.25,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/**
 * A knob on the board: a pad's on the top (`part` 'drum', the pad the knobs turn), the clock's
 * tempo or one of the delay's on the panel; `a`, `b` where it is on the top or the panel (`on`).
 * @typedef {{ part: 'drum', name: import('./drums.js').Knob, on: 'top', a: number, b: number }
 *   | { part: 'clock', name: 'tempo', on: 'panel', a: number, b: number }
 *   | { part: 'delay', name: import('./delay.js').DelayKnob, on: 'panel', a: number, b: number }} BoardKnob
 */

/**
 * A jack on the panel (patch.js's id): where, whether an output (on a dark plate, as a modular
 * synth's are marked), and its pad's colour, if a pad's.
 * @typedef {{ id: string, a: number, b: number, out: boolean, color: string | null }} BoardJack
 */

/** @typedef {{ a0: number, a1: number, b0: number, b1: number }} Area */

/**
 * A desk: the drum board's shape, and the synth's (synthboard.js layoutSynth). Its footprint (x0…x1,
 * zBack at the wall's side to zFront); its top, leaning `tilt` towards the player (`origin` its front
 * left corner, `up` along it away from the player, `normal` out of it; `width` across, `length` up
 * the slope; its front edge `front` high, its back `top`); its panel, from the top's back edge up
 * (`origin` its left end, `up` its face, `normal` out of it, `height`, leaning back `lean`, its top
 * edge `top` high); and the sign over it on the wall (x0…x1, y0…y1 at z).
 * @typedef {object} Desk
 * @property {number} x0
 * @property {number} x1
 * @property {number} zBack
 * @property {number} zFront
 * @property {number} width
 * @property {number} length
 * @property {number} tilt
 * @property {number} front
 * @property {number} top
 * @property {[number, number, number]} origin
 * @property {[number, number, number]} up
 * @property {[number, number, number]} normal
 * @property {{ origin: [number, number, number], up: [number, number, number], normal: [number, number, number], height: number, lean: number, top: number }} panel
 * @property {{ x0: number, x1: number, y0: number, y1: number, z: number }} sign
 */

/**
 * Where a ray meets a desk (meetDesk): on its top, its panel, its front, its sign or a side ('' none),
 * how far along the ray, where on the top or the panel (a across, b up it), and the way out of it.
 * @typedef {{ on: '' | 'top' | 'panel' | 'front' | 'sign' | 'side', t: number, a: number, b: number, nx: number, ny: number, nz: number }} DeskHit
 */

/** How far a stick's tip, or a finger, comes back up off a pad before it can strike again. */
export const REARM = 0.012;

/**
 * The board against the middle of the far wall: its footprint (x0…x1, zBack at the wall's side to
 * zFront), its top (`origin` its front left corner, `up` along it away from the player, `normal`
 * out of it; `width` across, `length` up the slope; its front edge `front` high, its back `top`),
 * each step key's place on it and each pad's (a0…a1, b0…b1), the strip's span (b0…b1) and its
 * display's (a0…a1, b0…b1, where the pad's name is shown); the panel (its foot at the top's back
 * edge: `origin` its left end, `up` its face, `normal` out of it, `height`, its top edge `top` high,
 * and on it its sections, the clock's display, the RUN button and the jacks); every knob, the pad's
 * three on the strip first; and the sign over it on the wall (x0…x1, y0…y1 at z), at eye height,
 * where a level gaze finds it (a TV's dot, which can't look down).
 * @param {{ z1: number }} L the room's layout (room.js layoutRoom)
 */
export function layoutBoard(L) {
  const { pad, gap, margin, strip, tilt, front, wall, knob, step, panel } = BOARD;
  const width = 2 * margin + COLUMNS * pad + (COLUMNS - 1) * gap;
  const padsB0 = step.front + step.depth + 0.04;
  const stripB0 = padsB0 + ROWS * pad + (ROWS - 1) * gap + 0.04;
  const length = stripB0 + strip + 0.03;
  const cos = Math.cos(tilt), sin = Math.sin(tilt), lc = Math.cos(panel.lean), ls = Math.sin(panel.lean);
  // From the wall: the panel's back, its foot at the top's back edge, and the top's front edge.
  const zBack = L.z1 + wall, zFoot = zBack + panel.thick * lc + panel.height * ls, zFront = zFoot + length * cos;
  const x0 = -width / 2, top = front + length * sin;
  const pads = PADS.map((p) => {
    const a0 = margin + p.col * (pad + gap), b0 = padsB0 + p.row * (pad + gap);
    return { a0, a1: a0 + pad, b0, b1: b0 + pad };
  });
  // The step keys, a column's worth over each column of pads.
  const per = STEPS / COLUMNS, key = (pad - (per - 1) * step.gap) / per;
  const steps = Array.from({ length: STEPS }, (_, i) => {
    const a0 = margin + Math.floor(i / per) * (pad + gap) + (i % per) * (key + step.gap);
    return { a0, a1: a0 + key, b0: step.front, b1: step.front + step.depth };
  });
  // The panel, in three sections: the clock (RUN, TEMPO, its display under them, its outs in a
  // column), the drums (their clock in, by the clock's outs; the pads' outs as the pads lie) and the
  // delay (its in, by the pads' outs; its knobs under it).
  const row = (/** @type {number} */ r) => 0.045 + r * panel.pitch;
  /** @type {BoardJack[]} */
  const jacks = [
    ...CLOCK_OUTS.map((o, k) => ({ id: o.id, a: 0.235, b: row(CLOCK_OUTS.length - 1 - k), out: true, color: null })),
    { id: 'drums.clock', a: 0.325, b: row(2), out: false, color: null },
    ...PADS.map((p) => ({ id: `pad.${p.id}`, a: 0.4 + p.col * panel.pitch, b: row(p.row), out: true, color: p.color })),
    { id: 'delay.in', a: 0.68, b: row(2), out: false, color: null },
  ];
  // The pad's knobs to the back of the strip, what they are and are set to in front of them (kit.js),
  // where a knob can't hide them from the player.
  /** @type {BoardKnob[]} */
  const knobs = [
    ...KNOBS.map((name, k) => /** @type {BoardKnob} */ ({ part: 'drum', name, on: 'top', a: width - knob.inset - (KNOBS.length - 1 - k) * knob.spacing, b: stripB0 + strip - knob.r - 0.018 })),
    { part: 'clock', name: 'tempo', on: 'panel', a: 0.155, b: 0.15 },
    ...DELAY_KNOBS.map((name, k) => /** @type {BoardKnob} */ ({ part: 'delay', name, on: 'panel', a: 0.69 + k * 0.08, b: 0.07 })),
  ];
  const firstKnob = knobs[0]?.a ?? width;
  return {
    x0, x1: width / 2, zBack, zFront, width, length, tilt, front, top,
    /** @type {[number, number, number]} */
    origin: [x0, front, zFront],
    /** @type {[number, number, number]} */
    up: [0, sin, -cos],
    /** @type {[number, number, number]} */
    normal: [0, cos, sin],
    steps,
    pads,
    knobs,
    strip: { b0: stripB0, b1: stripB0 + strip },
    display: { a0: margin, a1: firstKnob - knob.r - 0.05, b0: stripB0 + 0.012, b1: stripB0 + strip - 0.012 },
    panel: {
      /** @type {[number, number, number]} */
      origin: [x0, top, zFoot],
      /** @type {[number, number, number]} */
      up: [0, lc, -ls],
      /** @type {[number, number, number]} */
      normal: [0, ls, lc],
      height: panel.height, lean: panel.lean, top: top + panel.height * lc,
      sections: [
        { name: 'Clock', a0: 0.015, a1: 0.27 },
        { name: 'Drums', a0: 0.285, a1: 0.625 },
        { name: 'Delay', a0: 0.64, a1: width - 0.015 },
      ],
      /** @type {Area} where the tempo is shown */
      display: { a0: 0.03, a1: 0.195, b0: 0.022, b1: 0.088 },
      /** @type {Area} */
      run: { a0: 0.034, a1: 0.088, b0: 0.128, b1: 0.172 },
      jacks,
    },
    sign: { x0, x1: width / 2, y0: BOARD.sign.bottom, y1: BOARD.sign.top, z: L.z1 + BOARD.sign.out },
  };
}

/** The board as layoutBoard lays it out. @typedef {ReturnType<typeof layoutBoard>} Board */

/**
 * The point `a` across the top, `b` up it and `h` out of it, in the world, written into out.
 * @param {Desk} B
 * @param {number} a
 * @param {number} b
 * @param {number} [h]
 * @param {[number, number, number]} [out]
 */
export function boardPoint(B, a, b, h = 0, out = [0, 0, 0]) {
  const [ox, oy, oz] = B.origin, [, uy, uz] = B.up, [, ny, nz] = B.normal;
  out[0] = ox + a;
  out[1] = oy + uy * b + ny * h;
  out[2] = oz + uz * b + nz * h;
  return out;
}

/**
 * The point `a` across the panel, `b` up its face and `h` out of it, in the world, written into out.
 * @param {Desk} B
 * @param {number} a
 * @param {number} b
 * @param {number} [h]
 * @param {[number, number, number]} [out]
 */
export function panelPoint(B, a, b, h = 0, out = [0, 0, 0]) {
  const P = B.panel, [ox, oy, oz] = P.origin, [, uy, uz] = P.up, [, ny, nz] = P.normal;
  out[0] = ox + a;
  out[1] = oy + uy * b + ny * h;
  out[2] = oz + uz * b + nz * h;
  return out;
}

/**
 * Which of `areas` (a0…a1, b0…b1) (a, b) is in, else -1: the board's pads and step keys, the rack's
 * keys (rackboard.js).
 * @param {readonly Area[]} areas
 * @param {number} a
 * @param {number} b
 */
export function areaAt(areas, a, b) {
  for (let i = 0; i < areas.length; i++) {
    const p = areas[i];
    if (a >= p.a0 && a <= p.a1 && b >= p.b0 && b <= p.b1) return i;
  }
  return -1;
}

/**
 * The pad at (a, b) on the top, else -1.
 * @param {Board} B
 * @param {number} a
 * @param {number} b
 */
export const padAt = (B, a, b) => areaAt(B.pads, a, b);

/**
 * The step key at (a, b) on the top, else -1.
 * @param {Board} B
 * @param {number} a
 * @param {number} b
 */
export const stepAt = (B, a, b) => areaAt(B.steps, a, b);

/**
 * The knob at (a, b) on the top, or on the panel (a little larger than it, to be easier to point
 * at): its index in B.knobs, else -1.
 * @param {Board} B
 * @param {number} a
 * @param {number} b
 * @param {'top' | 'panel'} [on]
 */
export function knobAt(B, a, b, on = 'top') {
  const r = BOARD.knob.r * 1.25;
  for (let k = 0; k < B.knobs.length; k++) {
    const n = B.knobs[k];
    if (n.on === on && (a - n.a) ** 2 + (b - n.b) ** 2 <= r * r) return k;
  }
  return -1;
}

/**
 * The jack at (a, b) on the panel (its nut, half as large again), else -1: the board's, or the
 * synth's (synthboard.js), whose are as large.
 * @param {{ panel: { jacks: readonly { a: number, b: number }[] } }} B
 * @param {number} a
 * @param {number} b
 */
export function jackAt(B, a, b) {
  const r = BOARD.panel.jack * 1.5, jacks = B.panel.jacks;
  for (let j = 0; j < jacks.length; j++) {
    if ((a - jacks[j].a) ** 2 + (b - jacks[j].b) ** 2 <= r * r) return j;
  }
  return -1;
}

/**
 * What room.js castRay writes, with the board's: which pad, step key, knob (B.knobs) and jack (the
 * room's: B.panel.jacks, then the synth's, the rack's and the keyboard's); the synth's
 * (synthboard.js): which key, dial and button; the rack's (rackboard.js): which of the sequencer's
 * steps (`seq`: its key, its accent's or its slide's) and which of its knobs or panel's buttons
 * (`rack`); the keyboard's (keysboard.js): which key, drawbar, knob or panel's button (`keys`, by
 * the hit's kind); and the guitar's (guitarboard.js): which string, chord button, knob or place of
 * its pickup switch (`guitar`, by the hit's kind); any desk's jack in `jack`; each else -1.
 * @typedef {import('./room.js').RoomHit & { pad: number, step: number, knob: number, jack: number, key: number, dial: number, button: number, seq: number, rack: number, keys: number, guitar: number }} BandHit
 */

/**
 * Where a ray first meets a desk, if nearer than `within`: its top (coming down on it, a plane `rise`
 * over it), its panel (facing the player), its front (under the top's front edge), its sign on the
 * wall, or its sides (under the top as it rises, then the panel's as it rises further). Written into
 * `at`; whether it met it.
 * @param {Desk} D
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} within
 * @param {number} rise
 * @param {DeskHit} at
 */
export function meetDesk(D, ox, oy, oz, dx, dy, dz, within, rise, at) {
  at.on = '';
  at.t = within;
  at.a = at.b = at.nx = at.ny = at.nz = 0;
  const [Ox, Oy, Oz] = D.origin, [, Uy, Uz] = D.up, [, Ny, Nz] = D.normal;
  const dn = dy * Ny + dz * Nz;
  if (dn < 0) {
    const s = ((Oy + Ny * rise - oy) * Ny + (Oz + Nz * rise - oz) * Nz) / dn;
    if (s > 0 && s < at.t) {
      const a = ox + dx * s - Ox, b = (oy + dy * s - Oy) * Uy + (oz + dz * s - Oz) * Uz;
      if (a >= 0 && a <= D.width && b >= 0 && b <= D.length) {
        at.on = 'top';
        at.t = s;
        at.a = a;
        at.b = b;
        at.ny = Ny;
        at.nz = Nz;
      }
    }
  }
  const P = D.panel, [Px, Py, Pz] = P.origin, [, Qy, Qz] = P.up, [, My, Mz] = P.normal;
  const dm = dy * My + dz * Mz;
  if (dm < 0) {
    const s = ((Py - oy) * My + (Pz - oz) * Mz) / dm;
    if (s > 0 && s < at.t) {
      const a = ox + dx * s - Px, b = (oy + dy * s - Py) * Qy + (oz + dz * s - Pz) * Qz;
      if (a >= 0 && a <= D.width && b >= 0 && b <= P.height) {
        at.on = 'panel';
        at.t = s;
        at.a = a;
        at.b = b;
        at.nx = 0;
        at.ny = My;
        at.nz = Mz;
      }
    }
  }
  if (dz < 0) {
    facing(D.zFront, D.x0, D.x1, 0, D.front, 'front', ox, oy, oz, dx, dy, dz, at);
    facing(D.sign.z, D.sign.x0, D.sign.x1, D.sign.y0, D.sign.y1, 'sign', ox, oy, oz, dx, dy, dz, at);
  }
  const zFoot = P.origin[2], steep = Math.cos(P.lean) / Math.sin(P.lean);
  for (let side = -1; side <= 1; side += 2) {
    if (dx * side >= 0) continue;
    const s = ((side < 0 ? D.x0 : D.x1) - ox) / dx;
    const y = oy + dy * s, z = oz + dz * s;
    const high = z >= zFoot ? D.front + (D.zFront - z) * Math.tan(D.tilt) : Math.min(P.top, D.top + (zFoot - z) * steep);
    if (s > 0 && s < at.t && z >= D.zBack && z <= D.zFront && y >= 0 && y <= high) {
      at.on = 'side';
      at.t = s;
      at.a = at.b = 0;
      at.nx = side;
      at.ny = at.nz = 0;
    }
  }
  return at.on !== '';
}

/**
 * A ray meeting a rectangle facing the player (+z) at z, x0…x1 across and y0…y1 up, nearer than
 * what `at` holds: written into it as `on`.
 * @param {number} z
 * @param {number} x0
 * @param {number} x1
 * @param {number} y0
 * @param {number} y1
 * @param {'front' | 'sign'} on
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {DeskHit} at
 */
function facing(z, x0, x1, y0, y1, on, ox, oy, oz, dx, dy, dz, at) {
  const s = (z - oz) / dz;
  const x = ox + dx * s, y = oy + dy * s;
  if (!(s > 0 && s < at.t && x >= x0 && x <= x1 && y >= y0 && y <= y1)) return;
  at.on = on;
  at.t = s;
  at.a = at.b = at.nx = at.ny = 0;
  at.nz = 1;
}

/** Where the last ray met the board (hitBoard's), kept to write no new object per ray. @type {DeskHit} */
const MET = { on: '', t: 0, a: 0, b: 0, nx: 0, ny: 0, nz: 0 };

/**
 * What a ray meets on the board, if nearer than `within` (what it meets in the room otherwise): a
 * pad or a step key (their faces, `rise` over the top; u, v where on it, from its front left), a knob,
 * on the panel a jack, a knob or the RUN button ('run'), or the rest of the board ('board': its top,
 * its panel, its front, its sides, and its sign on the wall), written into out as room.js castRay
 * writes a hit. Whether it met the board.
 * @param {Board} B
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {BandHit} out
 * @param {number} [within]
 */
export function hitBoard(B, ox, oy, oz, dx, dy, dz, out, within = Infinity) {
  if (!meetDesk(B, ox, oy, oz, dx, dy, dz, within, BOARD.rise, MET)) return false;
  let kind = 'board', pad = -1, step = -1, knob = -1, jack = -1, u = 0, v = 0;
  const { a, b } = MET;
  if (MET.on === 'top') {
    pad = padAt(B, a, b);
    step = pad < 0 ? stepAt(B, a, b) : -1;
    knob = pad < 0 && step < 0 ? knobAt(B, a, b) : -1;
    const on = pad >= 0 ? B.pads[pad] : step >= 0 ? B.steps[step] : null;
    if (on) {
      kind = pad >= 0 ? 'pad' : 'step';
      u = (a - on.a0) / (on.a1 - on.a0);
      v = (b - on.b0) / (on.b1 - on.b0);
    } else if (knob >= 0) kind = 'knob';
  } else if (MET.on === 'panel') {
    const run = B.panel.run;
    jack = jackAt(B, a, b);
    knob = jack < 0 ? knobAt(B, a, b, 'panel') : -1;
    kind = jack >= 0 ? 'jack' : knob >= 0 ? 'knob' : a >= run.a0 && a <= run.a1 && b >= run.b0 && b <= run.b1 ? 'run' : 'board';
  }
  writeHit(out, MET, kind, ox, oy, oz, dx, dy, dz, u, v);
  out.pad = pad;
  out.step = step;
  out.knob = knob;
  out.jack = jack;
  out.key = out.dial = out.button = out.seq = out.rack = out.keys = out.guitar = -1;
  return true;
}

/**
 * A desk's hit written into out as room.js castRay writes one, of `kind`, `u`, `v` where on what it
 * is (the rest of a band's hit, which pad or key, is the caller's).
 * @param {import('./room.js').RoomHit} out
 * @param {DeskHit} at
 * @param {string} kind
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} u
 * @param {number} v
 */
export function writeHit(out, at, kind, ox, oy, oz, dx, dy, dz, u, v) {
  out.t = at.t;
  out.kind = kind;
  out.x = ox + dx * at.t;
  out.y = oy + dy * at.t;
  out.z = oz + dz * at.t;
  out.nx = at.nx;
  out.ny = at.ny;
  out.nz = at.nz;
  out.u = u;
  out.v = v;
  out.walkable = false;
  out.piece = -1;
}

/**
 * Whether (x, z) is too near the board (a desk) to stand at: on it, or within `keep` of its front or
 * sides.
 * @param {Desk} B
 * @param {number} x
 * @param {number} z
 */
export function boardBlocks(B, x, z) {
  const k = BOARD.keep - 1e-9;
  return x > B.x0 - k && x < B.x1 + k && z < B.zFront + k;
}

/**
 * The nearest place to (x, z) a head coming from (fx, fz) may be, round the board (a desk): `keep`
 * from its front or its sides, the side it came from, sliding along it. Writes { x, z } into out.
 * @param {Desk} B
 * @param {number} fx
 * @param {number} fz
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number }} [out]
 */
export function clampBoard(B, fx, fz, x, z, out = { x: 0, z: 0 }) {
  const k = BOARD.keep, X0 = B.x0 - k, X1 = B.x1 + k, Z = B.zFront + k;
  if (x > X0 && x < X1 && z < Z) {
    if (fz >= Z - 1e-6) z = Z;
    else if (fx <= X0 + 1e-6) x = X0;
    else if (fx >= X1 - 1e-6) x = X1;
    else {
      // Somehow on it (put there): out the nearest way.
      const d = [Z - z, x - X0, X1 - x];
      const m = Math.min(...d);
      if (m === d[0]) z = Z;
      else if (m === d[1]) x = X0;
      else x = X1;
    }
  }
  out.x = x;
  out.z = z;
  return out;
}

/**
 * A part of the view something on the page covers (the card, a button), in the view's terms: from
 * x0 to x1 across and y0 to y1 up, each -1…1.
 * @typedef {{ x0: number, x1: number, y0: number, y1: number }} Rect
 */

/**
 * Where (px, py, pz) is in a view from (x, EYE, z) turned `yaw` (left) and `pitch` (up), `tx` and
 * `ty` the tangents of its half-widths: [across, up] -1…1 at its edges, or null behind it.
 * @param {number} px
 * @param {number} py
 * @param {number} pz
 * @param {number} x
 * @param {number} z
 * @param {number} yaw
 * @param {number} pitch
 * @param {number} tx
 * @param {number} ty
 * @returns {[number, number] | null}
 */
export function inView(px, py, pz, x, z, yaw, pitch, tx, ty) {
  const dx = px - x, dy = py - EYE, dz = pz - z;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const across = dx * cy - dz * sy, back = dx * sy + dz * cy;
  const up = dy * cp + back * sp, ahead = dy * sp - back * cp;
  return ahead > 0 ? [across / (ahead * tx), up / (ahead * ty)] : null;
}

/** How far clear of what covers the view the board's outline stays (in the view's terms). */
const CLEAR = 0.03;
/**
 * How far aside of the board one may stand to play it on a screen, its middle beside what covers
 * the view (a TV's card, down to its foot), in metres.
 */
const ASIDE = 1.6;

/**
 * Whether the point p is inside the convex outline (its points in order round it).
 * @param {[number, number][]} outline
 * @param {[number, number]} p
 */
function within(outline, [x, y]) {
  let sign = 0;
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
    const s = Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    if (!s) continue;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * The convex hull of some points, in order round it (Andrew's monotone chain).
 * @param {[number, number][]} points
 * @returns {[number, number][]}
 */
function hull(points) {
  const p = [...points].sort((m, n) => m[0] - n[0] || m[1] - n[1]);
  /** @type {(o: [number, number], a: [number, number], b: [number, number]) => number} */
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  /** @type {[number, number][]} */
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * The board's outline (a desk's), what stands `h` out of it (the knobs) included: points along the
 * top's front edge, up its right side and the panel's, along the panel's top edge, and down the left
 * sides.
 * @param {Desk} B
 * @param {number} [n] points along each edge
 * @param {number} [h]
 */
export function boardOutline(B, n = 16, h = BOARD.knob.h) {
  const W = B.width, D = B.length, H = B.panel.height;
  /** @type {((f: number) => [number, number, number])[]} */
  const edges = [
    (f) => boardPoint(B, f * W, 0, h),
    (f) => boardPoint(B, W, f * D, h),
    (f) => panelPoint(B, W, f * H, h),
    (f) => panelPoint(B, (1 - f) * W, H, h),
    (f) => panelPoint(B, 0, (1 - f) * H, h),
    (f) => boardPoint(B, 0, (1 - f) * D, h),
  ];
  return edges.flatMap((edge) => Array.from({ length: n }, (_, i) => edge(i / n)));
}

/**
 * Where to stand to play the board on a screen: in front of it, as near as `keep` allows but far
 * enough back that all of it (boardOutline: the top and the panel) is in the view (a view `fov`
 * degrees high, `aspect` wide for 1 high, from EYE), within `fill` of its edges and clear of what the
 * page shows over it (`over`: the card, the buttons). Facing it, looking down at the middle of it in
 * the middle of the view; where something covers that, with the board beside it, or below or above
 * it: at each distance, the first of those that fits. For any desk, what stands out of it `h` high,
 * and only where one may stand (`free`: not at another desk).
 * @param {Desk} B
 * @param {{ fov?: number, aspect?: number, fill?: number, over?: Rect[], h?: number, free?: (x: number, z: number) => boolean }} [o]
 */
export function boardFront(B, { fov = 70, aspect = 16 / 9, fill = 0.88, over = [], h = BOARD.knob.h, free = () => true } = {}) {
  const ty = Math.tan((fov * Math.PI) / 360), tx = ty * aspect;
  const outline = boardOutline(B, 16, h);
  // Its middle: halfway between the top's front edge and the panel's top edge.
  const front = boardPoint(B, B.width / 2, 0), back = panelPoint(B, B.width / 2, B.panel.height);
  const c = [front[0], (front[1] + back[1]) / 2, (front[2] + back[2]) / 2];
  const x = (B.x0 + B.x1) / 2;
  // Where in the view the top's middle goes: the middle, else beside, below or above what covers it.
  /** @type {[number, number][]} */
  const aims = [[0, 0]];
  for (const r of over) aims.push([(r.x1 + 1) / 2, 0], [(r.x0 - 1) / 2, 0], [0, (r.y0 - 1) / 2], [0, (r.y1 + 1) / 2]);
  // Up or down in the view by looking higher or lower, across it by stepping aside (ASIDE at most),
  // so that the board's edges stay level in the view.
  /** @param {number} z @param {[number, number]} aim */
  const place = (z, [mx, my]) => {
    const pitch = -Math.atan2(EYE - c[1], z - c[2]) - Math.atan(my * ty);
    const ahead = (c[1] - EYE) * Math.sin(pitch) - (c[2] - z) * Math.cos(pitch);
    return { x: x - mx * tx * ahead, z, yaw: 0, pitch };
  };
  /** @param {{ x: number, z: number, yaw: number, pitch: number }} at */
  const fits = (at) => {
    if (Math.abs(at.x - x) > ASIDE || !free(at.x, at.z)) return false;
    /** @type {[number, number][]} */
    const seen = [];
    for (const [px, py, pz] of outline) {
      const v = inView(px, py, pz, at.x, at.z, at.yaw, at.pitch, tx, ty);
      if (!v || Math.abs(v[0]) > fill || Math.abs(v[1]) > fill) return false;
      if (over.some((r) => v[0] > r.x0 - CLEAR && v[0] < r.x1 + CLEAR && v[1] > r.y0 - CLEAR && v[1] < r.y1 + CLEAR)) return false;
      seen.push(v);
    }
    // Nor anything over the view inside the outline (as its hull, the top and the panel meeting at
    // an angle): a corner of it within.
    if (!over.length) return true;
    const shape = hull(seen);
    return over.every((r) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].every((p) => !within(shape, /** @type {[number, number]} */ (p))));
  };
  for (let d = BOARD.keep; d < 3; d += 0.02) {
    for (const aim of aims) {
      const at = place(B.zFront + d, aim);
      if (fits(at)) return at;
    }
  }
  return place(B.zFront + 3, aims[0]);
}

/**
 * Where to stand to play the board in VR: the head a little back from its front edge, the step keys
 * and the pads in reach of a stick (the panel's jacks and knobs are pointed at), facing it. For any
 * desk, `back` from its front edge, across at x.
 * @param {Desk} B
 * @param {number} [back]
 * @param {number} [x]
 */
export function boardStand(B, back = 0.27, x = (B.x0 + B.x1) / 2) {
  return { x, z: B.zFront + back, yaw: 0 };
}

/**
 * How far the point (x, y, z) is out of the pads' faces (below them: < 0); for any desk, out of a
 * plane `rise` over its top.
 * @param {Desk} B
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [rise]
 */
export function heightOver(B, x, y, z, rise = BOARD.rise) {
  const [, Oy, Oz] = B.origin, [, Ny, Nz] = B.normal;
  return (y - Oy) * Ny + (z - Oz) * Nz - rise;
}

/**
 * A tip (a stick's, a finger's) that went from (fx, fy, fz) to (tx, ty, tz) in `dt` seconds: if it
 * came down through a pad's face, which pad and how fast it was going into it (m/s), or through a
 * step key's, which key, written into out; else out.pad and out.step are -1. Where it crossed, not
 * where it ended, says which.
 * @param {Board} B
 * @param {number} fx
 * @param {number} fy
 * @param {number} fz
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @param {number} dt
 * @param {{ pad: number, step: number, speed: number }} out
 */
export function strikeAt(B, fx, fy, fz, tx, ty, tz, dt, out) {
  out.pad = out.step = -1;
  out.speed = 0;
  const hf = heightOver(B, fx, fy, fz), ht = heightOver(B, tx, ty, tz);
  if (!(hf > 0 && ht <= 0)) return out;
  const f = hf / (hf - ht);
  const x = fx + (tx - fx) * f, y = fy + (ty - fy) * f, z = fz + (tz - fz) * f;
  const [Ox, Oy, Oz] = B.origin, [, Uy, Uz] = B.up;
  const a = x - Ox, b = (y - Oy) * Uy + (z - Oz) * Uz;
  out.pad = padAt(B, a, b);
  if (out.pad < 0) out.step = stepAt(B, a, b);
  if (out.pad >= 0 || out.step >= 0) out.speed = (hf - ht) / Math.max(dt, 1e-3);
  return out;
}

/**
 * A strike's speed into a pad (m/s) as a velocity 0…1: a stick moves faster than a finger, so a
 * finger's counts for more.
 * @param {number} speed
 * @param {boolean} [finger]
 */
export const strikeVelocity = (speed, finger = false) => clamp((speed - (finger ? 0.1 : 0.2)) / (finger ? 1.4 : 2.3), 0.06, 1);
