// The drum board in 3D (board.js lays it out, drums.js says what is on it): its stand, top and panel,
// lit as the room is (scene.js's bake, once, into vertex colours); the step keys along its front
// edge, lit in the colour of the pad the knobs turn where its pattern plays (pattern.js), the step
// playing lit up as the clock goes round; the pads' faces with their keys and names on one canvas,
// lit up in their colours when played (their vertex colours, written only while one glows), a ring
// round the pad the knobs turn; the knobs, the pad's three on the strip and the panel's (the tempo,
// the delay's three); the strip with that pad's name and its knobs' settings, and on the panel the
// tempo and the delay's settings (canvases, each redrawn when they change, at most ten times a
// second), over its face (one canvas, drawn once: its sections, its jacks and what they are); the RUN
// button, its light lit while the clock runs and brighter on each beat; the cables between the
// jacks, each in its colour with a plug at either end (made again when the patch changes), and the
// one being carried, from its jack to wherever it is pointed (moved each frame, in place); and its
// sign on the wall over it. In VR a stick in each hand that holds a controller, near the board, whose
// tip comes down on a pad to play it (board.js strikeAt), as hard as it was going, or on a step key
// to set it; a hand without a controller plays with its forefinger. Per frame nothing is allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, REARM, boardPoint, heightOver, panelPoint, strikeAt, strikeVelocity } from './board.js';
import { COLUMNS, PADS, ROWS, keyLabel, knobText } from './drums.js';
import { STEPS } from './pattern.js';
import { JACKS } from './patch.js';
import { TEMPO } from './clock.js';
import { DEFAULT_DELAY, delaySteps } from './delay.js';
import { GOLD, SANS, SERIF } from './textures.js';

/** @typedef {import('./board.js').Board} Board */
/** @typedef {import('./drums.js').Knobs} Knobs */
/** @typedef {import('./delay.js').DelayKnobs} DelayKnobs */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */
/** A cable to draw: the jacks it joins (their indices in B.panel.jacks) and its colour. @typedef {{ from: number, to: number, color: string }} DrawnCable */

/** @param {string} hex @returns {[number, number, number]} linear */
export const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** @param {number[]} v @param {number} k @returns {[number, number, number]} */
export const times = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

const WOOD = lin('#3b2a1d'), TOP = lin('#23211f'), RIM = lin('#151413'), CAP = lin('#4a4540');
/** How much brighter than its rubber a pad lights up at full glow, in its colour. */
const BOOST = 3;
/** A stick: from just behind the hand to its tip, along the controller's aim (-z). */
export const STICK = Object.freeze({ back: 0.04, tip: 0.36 });
/** The pads' atlas: a cell each, this many pixels square. */
const CELL = 256;
/** How far the RUN button stands out of the panel. */
const BUTTON = 0.008;
/** What a hand's reticle shows on near the board (or the synth: its dials and buttons), where its laser is a stick. */
const AIMED = new Set(['knob', 'jack', 'run', 'step', 'dial', 'button']);
/**
 * A cable: its radius, its plug's length out of the panel and radius, how far it hangs (`sag`, and
 * `sagPer` metre between its ends, to `sagMax`), and how far the one carried reaches from its jack;
 * and how finely it is drawn.
 */
const CABLE = { r: 0.0042, plug: 0.032, plugR: 0.0068, sag: 0.03, sagPer: 0.2, sagMax: 0.12, reach: 0.9 };
const SEGMENTS = 20, SIDES = 8;
const COS = Float32Array.from({ length: SIDES }, (_, k) => Math.cos((k / SIDES) * 2 * Math.PI));
const SIN = Float32Array.from({ length: SIDES }, (_, k) => Math.sin((k / SIDES) * 2 * Math.PI));
/** Vertices of a cable: its tube, and a plug (two rings and their caps' middles) at either end. */
const CABLE_VERTICES = (SEGMENTS + 1) * SIDES + 2 * (2 * SIDES + 2);
/** RUN's light: off, lit while the clock runs, and as bright as a beat makes it (linear). */
const LED = { off: lin('#2a1d18'), on: lin('#36c766'), beat: lin('#dcffe6') };
/** The step keys' atlas: a cell each, this many pixels across and high (a key's shape). */
const KEY = { w: 64, h: 96 };

/** @param {number} w @param {number} h */
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** @param {HTMLCanvasElement} c */
export const context = (c) => /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));

/**
 * Sets the largest font, from `size` px down, in which `text` fits `width`.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} width
 * @param {number} size
 * @param {string} [weight]
 */
export function fit(g, text, width, size, weight = '600') {
  for (let s = size; s >= 10; s--) {
    g.font = `${weight} ${s}px ${SANS}`;
    if (g.measureText(text).width <= width) return;
  }
}

/** Where pad i's cell is in the atlas, as [u0, v0, u1, v1] (the farthest row at the top). @param {number} i */
function cell(i) {
  const p = PADS[i];
  const x = p.col * CELL, y = (ROWS - 1 - p.row) * CELL, W = COLUMNS * CELL, H = ROWS * CELL;
  return [x / W, 1 - (y + CELL) / H, (x + CELL) / W, 1 - y / H];
}

/** The pads' faces, on one canvas: dark rubber, edged in the pad's colour, its key large and its name. */
function padAtlas() {
  const c = canvas(COLUMNS * CELL, ROWS * CELL), g = context(c);
  for (const p of PADS) {
    const x = p.col * CELL, y = (ROWS - 1 - p.row) * CELL, m = CELL / 2;
    const grad = g.createRadialGradient(x + m, y + m, 8, x + m, y + m, CELL * 0.72);
    grad.addColorStop(0, '#4b4844');
    grad.addColorStop(1, '#2c2a27');
    g.fillStyle = grad;
    g.fillRect(x, y, CELL, CELL);
    g.globalAlpha = 0.8;
    g.strokeStyle = p.color;
    g.lineWidth = 6;
    g.strokeRect(x + 12, y + 12, CELL - 24, CELL - 24);
    g.globalAlpha = 1;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = p.color;
    g.font = `700 96px ${SANS}`;
    g.fillText(keyLabel(p.key), x + m, y + CELL * 0.42);
    g.fillStyle = '#efe5cf';
    fit(g, p.name, CELL - 40, 36);
    g.fillText(p.name, x + m, y + CELL * 0.78);
  }
  return c;
}

/**
 * The step keys' caps, on one canvas: pale (their vertex colours make them dark, or a pad's colour),
 * each with its number, the first of each beat marked under it.
 */
function keyAtlas() {
  const c = canvas(STEPS * KEY.w, KEY.h), g = context(c);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let s = 0; s < STEPS; s++) {
    const x = s * KEY.w;
    g.fillStyle = '#ece6da';
    g.fillRect(x, 0, KEY.w, KEY.h);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(x, 0, 4, KEY.h);
    g.fillRect(x + KEY.w - 4, 0, 4, KEY.h);
    g.fillStyle = '#26221e';
    g.font = `600 28px ${SANS}`;
    g.fillText(String(s + 1), x + KEY.w / 2, KEY.h * 0.62);
    if (s % 4 === 0) g.fillRect(x + KEY.w / 2 - 12, KEY.h * 0.84, 24, 5);
  }
  return c;
}

/**
 * The panel's face, drawn once: its three sections named across the top with a line between each;
 * the outputs on dark plates, as a modular synth marks them; each jack's nut and hole (a pad's ringed
 * in its colour) with what it is under it (patch.js's label; the pads' are known by their colours,
 * laid out as the pads are); and over each knob, and over RUN, its name.
 * @param {Board} B
 */
function panelFace(B) {
  const P = B.panel, W = B.width, H = P.height;
  const c = canvas(1536, Math.round((1536 * H) / W)), g = context(c), k = c.width / W;
  const x = (/** @type {number} */ a) => a * k, y = (/** @type {number} */ b) => (H - b) * k;
  g.fillStyle = '#26231f';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [n, s] of P.sections.entries()) {
    g.fillStyle = GOLD;
    g.font = `600 ${Math.round(0.016 * k)}px ${SANS}`;
    g.fillText(s.name.toUpperCase(), x((s.a0 + s.a1) / 2), y(0.228));
    if (!n) continue;
    g.strokeStyle = 'rgba(224,187,114,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(s.a0 - 0.0075), y(0.012));
    g.lineTo(x(s.a0 - 0.0075), y(H - 0.012));
    g.stroke();
  }
  // The outputs' plates: round the clock's outs, and round the pads'.
  for (const prefix of ['clock.', 'pad.']) {
    const outs = P.jacks.filter((j) => j.id.startsWith(prefix));
    const a0 = Math.min(...outs.map((j) => j.a)) - 0.026, a1 = Math.max(...outs.map((j) => j.a)) + 0.026;
    const b0 = Math.min(...outs.map((j) => j.b)) - 0.036, b1 = Math.max(...outs.map((j) => j.b)) + 0.024;
    g.fillStyle = '#121110';
    g.strokeStyle = 'rgba(239,229,207,0.28)';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(x(a0), y(b1), x(a1) - x(a0), y(b0) - y(b1), 0.006 * k);
    g.fill();
    g.stroke();
  }
  const r = BOARD.panel.jack * k;
  for (const j of P.jacks) {
    const cx = x(j.a), cy = y(j.b);
    if (j.color) {
      g.fillStyle = j.color;
      g.beginPath();
      g.arc(cx, cy, r * 1.32, 0, 2 * Math.PI);
      g.fill();
    }
    const nut = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    nut.addColorStop(0, '#e4ded2');
    nut.addColorStop(1, '#8d877d');
    g.fillStyle = nut;
    g.beginPath();
    g.arc(cx, cy, r, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = '#060505';
    g.beginPath();
    g.arc(cx, cy, r * 0.45, 0, 2 * Math.PI);
    g.fill();
    if (j.color) continue;
    g.fillStyle = '#efe5cf';
    g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
    g.fillText(JACKS.find((J) => J.id === j.id)?.label ?? '', cx, y(j.b - BOARD.panel.jack - 0.011));
  }
  g.fillStyle = GOLD;
  g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
  for (const n of B.knobs) {
    if (n.on === 'panel') g.fillText(n.name.toUpperCase(), x(n.a), y(n.b + BOARD.knob.r + 0.013));
  }
  g.fillText('RUN', x((P.run.a0 + P.run.a1) / 2), y(P.run.b1 + 0.013));
  return c;
}

/**
 * The sign over an instrument: its name in gold on a dark plate edged in gold ("Drums" over the
 * board), and what it is.
 * @param {number} w
 * @param {number} h
 * @param {string} [name]
 * @param {string} [words]
 */
export function signPlate(w, h, name = 'Drums', words = 'twelve analog pads') {
  const c = canvas(w, h), g = context(c);
  g.fillStyle = '#1d1b19';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = GOLD;
  g.lineWidth = 6;
  g.strokeRect(16, 16, w - 32, h - 32);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = GOLD;
  g.font = `600 ${Math.round(h * 0.42)}px ${SERIF}`;
  g.fillText(name, w / 2, h * 0.44);
  g.fillStyle = '#efe5cf';
  fit(g, words, w - 96, Math.round(h * 0.12), '500');
  g.fillText(words, w / 2, h * 0.76);
  return c;
}

/** @param {HTMLCanvasElement} c @param {number} anisotropy */
export function texture(c, anisotropy) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

/**
 * Writes a ring of SIDES vertices `r` round (x, y, z), square to the way (tx, ty, tz) (a unit
 * vector), into pos from vertex `at`: the vertex after it.
 * @param {Float32Array} pos
 * @param {number} at
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @param {number} r
 */
function ring(pos, at, x, y, z, tx, ty, tz, r) {
  // Across: square to the way and to up (or, going up, to x); and square to both.
  let sx = -tz, sy = 0, sz = tx, l = Math.hypot(sx, sz);
  if (l < 1e-4) {
    sx = 0;
    sy = tz;
    sz = -ty;
    l = Math.hypot(sy, sz);
  }
  sx /= l;
  sy /= l;
  sz /= l;
  const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx;
  for (let k = 0; k < SIDES; k++) {
    const c = COS[k] * r, s = SIN[k] * r, i = (at + k) * 3;
    pos[i] = x + sx * c + ux * s;
    pos[i + 1] = y + sy * c + uy * s;
    pos[i + 2] = z + sz * c + uz * s;
  }
  return at + SIDES;
}

/**
 * A cable's path, sampled at SEGMENTS + 1 points into out: from p, leaving along n, to q, coming in
 * along -m, hanging lower between them the further apart they are; kept off the board's top and in
 * front of its panel.
 * @param {Board} B
 * @param {number[] | Float32Array} p
 * @param {number[] | Float32Array} n
 * @param {number[] | Float32Array} q
 * @param {number[] | Float32Array} m
 * @param {Float32Array} out
 */
function hang(B, p, n, q, m, out) {
  const sag = Math.min(CABLE.sagMax, CABLE.sag + CABLE.sagPer * Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
  const k = 0.06;
  const ax = p[0] + n[0] * k, ay = p[1] + n[1] * k - sag, az = p[2] + n[2] * k;
  const bx = q[0] + m[0] * k, by = q[1] + m[1] * k - sag, bz = q[2] + m[2] * k;
  const [, Oy, Oz] = B.origin, [, Uy, Uz] = B.up, [, Ny, Nz] = B.normal;
  const P = B.panel, [, Py, Pz] = P.origin, [, Qy, Qz] = P.up, [, My, Mz] = P.normal;
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS, s = 1 - t;
    const w0 = s * s * s, w1 = 3 * s * s * t, w2 = 3 * s * t * t, w3 = t * t * t;
    const x = w0 * p[0] + w1 * ax + w2 * bx + w3 * q[0];
    let y = w0 * p[1] + w1 * ay + w2 * by + w3 * q[1];
    let z = w0 * p[2] + w1 * az + w2 * bz + w3 * q[2];
    if (x >= B.x0 && x <= B.x1) {
      // Over the top: not into it.
      const over = (y - Oy) * Ny + (z - Oz) * Nz - BOARD.rise - 0.006, along = (y - Oy) * Uy + (z - Oz) * Uz;
      if (over < 0 && along >= 0 && along <= B.length) {
        y -= Ny * over;
        z -= Nz * over;
      }
      // In front of the panel: not into it.
      const out = (y - Py) * My + (z - Pz) * Mz - 0.004, up = (y - Py) * Qy + (z - Pz) * Qz;
      if (out < 0 && up >= 0 && up <= P.height) {
        y -= My * out;
        z -= Mz * out;
      }
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
}

/**
 * Writes a plug into pos from vertex `at`: from `tip` (on the panel, in a jack) along `axis` (a unit
 * vector) for CABLE.plug, a ring at each end and the middle of each end's cap. The vertex after it.
 * @param {Float32Array} pos
 * @param {number} at
 * @param {number[] | Float32Array} tip
 * @param {number[] | Float32Array} axis
 */
function plug(pos, at, tip, axis) {
  const x = tip[0], y = tip[1], z = tip[2], ax = axis[0], ay = axis[1], az = axis[2], L = CABLE.plug;
  at = ring(pos, at, x, y, z, ax, ay, az, CABLE.plugR * 0.8);
  at = ring(pos, at, x + ax * L, y + ay * L, z + az * L, ax, ay, az, CABLE.plugR);
  const i = at * 3;
  pos[i] = x;
  pos[i + 1] = y;
  pos[i + 2] = z;
  pos[i + 3] = x + ax * L;
  pos[i + 4] = y + ay * L;
  pos[i + 5] = z + az * L;
  return at + 2;
}

/**
 * The triangles of a cable from vertex `base` (as writeCable lays its vertices out): its tube, then
 * its two plugs' sides and caps.
 * @param {number} base
 * @param {number[]} out
 */
function cableIndices(base, out) {
  for (let i = 0; i < SEGMENTS; i++) {
    for (let k = 0; k < SIDES; k++) {
      const a = base + i * SIDES + k, b = base + i * SIDES + ((k + 1) % SIDES);
      out.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
    }
  }
  for (let p = 0; p < 2; p++) {
    const r0 = base + (SEGMENTS + 1) * SIDES + p * (2 * SIDES + 2), r1 = r0 + SIDES, c0 = r1 + SIDES, c1 = c0 + 1;
    for (let k = 0; k < SIDES; k++) {
      const k1 = (k + 1) % SIDES;
      out.push(r0 + k, r1 + k, r0 + k1, r0 + k1, r1 + k, r1 + k1, c0, r0 + k1, r0 + k, c1, r1 + k, r1 + k1);
    }
  }
}

/**
 * A tip that strikes (a stick's, a forefinger's): where it was last frame, and whether it is up off
 * the board, so may strike when it comes down.
 * @typedef {{ x: number, y: number, z: number, has: boolean, armed: boolean }} Tip
 */

export class Kit {
  /**
   * @param {Board} B
   * @param {object} o
   * @param {(builder: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's colours (scene.js)
   * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
   * @param {number} [o.anisotropy]
   */
  constructor(B, { lit, lightColor, anisotropy = 1 }) {
    this.board = B;
    this.group = new THREE.Group();
    this.group.name = 'drum board';
    /** (i, velocity, source) a stick's tip or a forefinger came down on pad i. @type {(i: number, velocity: number, source: XRInputSource | null) => void} */
    this.onStrike = () => {};
    /** (s, source) a stick's tip or a forefinger came down on step key s. @type {(s: number, source: XRInputSource | null) => void} */
    this.onStep = () => {};
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(B, a, b, h, [0, 0, 0]);
    const Q = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => panelPoint(B, a, b, h, [0, 0, 0]);
    const W = B.width, D = B.length, T = BOARD.thick, H = B.panel.height, PT = BOARD.panel.thick;
    const across = [W, 0, 0], along = times(B.up, D), down = times(B.normal, T), back = times(B.up, -1);
    const PU = B.panel.up, PN = B.panel.normal;

    // The stand, the top, the panel's edges and back, the RUN button, and the rims of the pads and
    // the step keys: one mesh, lit once.
    const stand = new Builder();
    stand.quad(P(0, 0), across, along, { normal: B.normal, albedo: TOP });
    stand.quad(P(0, 0, -T), across, down, { normal: back, albedo: WOOD });
    stand.quad(P(0, D, -T), across, down, { normal: B.up, albedo: WOOD });
    stand.quad(P(0, 0, -T), along, down, { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(P(W, 0, -T), along, down, { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(P(0, 0, -T), across, along, { normal: times(B.normal, -1), albedo: WOOD });
    for (const [a, b] of [[0.05, 0.08], [W - 0.05, 0.08], [0.05, D - 0.08], [W - 0.05, D - 0.08]]) {
      const p = P(a, b, -T);
      stand.box([p[0] - 0.025, 0, p[2] - 0.025], [p[0] + 0.025, p[1] + 0.01, p[2] + 0.025], { albedo: WOOD, skip: ['-y'] });
    }
    const front = P(0, 0.08, -T), rear = P(0, D - 0.08, -T);
    stand.box([B.x0 + 0.03, 0.18, rear[2]], [B.x1 - 0.03, 0.21, front[2]], { albedo: WOOD });
    // The panel: its face is drawn (below), its edges and back are wood.
    stand.quad(Q(0, H), [W, 0, 0], times(PN, -PT), { normal: PU, albedo: WOOD });
    stand.quad(Q(0, 0), times(PU, H), times(PN, -PT), { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(Q(W, 0), times(PU, H), times(PN, -PT), { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PU, H), { normal: times(PN, -1), albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PN, PT), { normal: times(PU, -1), albedo: WOOD });
    // The RUN button, standing out of it.
    const run = B.panel.run, rw = run.a1 - run.a0, rh = run.b1 - run.b0, rise = times(PN, BUTTON);
    stand.quad(Q(run.a0, run.b0, BUTTON), [rw, 0, 0], times(PU, rh), { normal: PN, albedo: CAP });
    stand.quad(Q(run.a0, run.b0), [rw, 0, 0], rise, { normal: times(PU, -1), albedo: RIM });
    stand.quad(Q(run.a0, run.b1), [rw, 0, 0], rise, { normal: PU, albedo: RIM });
    stand.quad(Q(run.a0, run.b0), times(PU, rh), rise, { normal: [-1, 0, 0], albedo: RIM });
    stand.quad(Q(run.a1, run.b0), times(PU, rh), rise, { normal: [1, 0, 0], albedo: RIM });
    const out = times(B.normal, BOARD.rise);
    for (const p of [...B.pads, ...B.steps]) {
      const w = p.a1 - p.a0, side = times(B.up, p.b1 - p.b0);
      stand.quad(P(p.a0, p.b0), [w, 0, 0], out, { normal: back, albedo: RIM });
      stand.quad(P(p.a0, p.b1), [w, 0, 0], out, { normal: B.up, albedo: RIM });
      stand.quad(P(p.a0, p.b0), side, out, { normal: [-1, 0, 0], albedo: RIM });
      stand.quad(P(p.a1, p.b0), side, out, { normal: [1, 0, 0], albedo: RIM });
    }
    this._add(new THREE.Mesh(lit(stand), new THREE.MeshBasicMaterial({ vertexColors: true })), 'stand');

    // The pads' faces: a quad each on the atlas, their baked light kept to light them up from.
    const faces = new Builder();
    /** The first vertex of each pad's face, and how many it has. @type {[number, number][]} */
    this._spans = B.pads.map((p, i) => {
      const first = faces.count, uv = faces.uvs.length;
      faces.quad(P(p.a0, p.b0, BOARD.rise), [p.a1 - p.a0, 0, 0], times(B.up, p.b1 - p.b0));
      const [u0, v0, u1, v1] = cell(i);
      for (let k = uv; k < faces.uvs.length; k += 2) {
        faces.uvs[k] = u0 + faces.uvs[k] * (u1 - u0);
        faces.uvs[k + 1] = v0 + faces.uvs[k + 1] * (v1 - v0);
      }
      return [first, faces.count - first];
    });
    const faceGeometry = lit(faces);
    /** @private */
    this._base = Float32Array.from(/** @type {ArrayLike<number>} */ (faces.colors));
    /** @private */
    this._colors = /** @type {THREE.BufferAttribute} */ (faceGeometry.getAttribute('color'));
    this._add(new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: texture(padAtlas(), anisotropy), vertexColors: true })), 'pads');
    /** @private Each pad's colour lit up (linear). */
    this._tints = PADS.map((p) => lin(p.color));
    /** How lit up each pad is, 1 just struck, fading. */
    this.glow = new Float32Array(PADS.length);
    /** @private what the faces were last written with: glow, and the pad pointed at */
    this._shown = new Float32Array(PADS.length);
    /** The pad pointed at, else -1. */
    this.hovered = -1;

    // The step keys' caps: a quad each on their atlas, lit as the pads are.
    const keys = new Builder();
    /** The first vertex of each key's cap, and how many it has. @type {[number, number][]} */
    this._keySpans = B.steps.map((q, s) => {
      const first = keys.count, uv = keys.uvs.length;
      keys.quad(P(q.a0, q.b0, BOARD.rise), [q.a1 - q.a0, 0, 0], times(B.up, q.b1 - q.b0));
      for (let k = uv; k < keys.uvs.length; k += 2) keys.uvs[k] = (s + keys.uvs[k]) / STEPS;
      return [first, keys.count - first];
    });
    const keyGeometry = lit(keys);
    /** @private */
    this._keyBase = Float32Array.from(/** @type {ArrayLike<number>} */ (keys.colors));
    /** @private */
    this._keyColors = /** @type {THREE.BufferAttribute} */ (keyGeometry.getAttribute('color'));
    this._add(new THREE.Mesh(keyGeometry, new THREE.MeshBasicMaterial({ map: texture(keyAtlas(), anisotropy), vertexColors: true })), 'step keys');
    /** @private where the selected pad's pattern plays: 1 on a step it plays */
    this._steps = new Uint8Array(STEPS);
    /** @private the selected pad's colour (linear), the keys' where it plays */
    this._keyTint = this._tints[0];
    /** @private what each key was last written as (setSteps, the playhead, the pointer), -1 never */
    this._keyShown = new Int8Array(STEPS).fill(-1);
    /** The step playing now, lit up on its key, else -1. */
    this.playhead = -1;
    /** The step key pointed at, else -1. */
    this.hoveredStep = -1;

    // On the top, in its own frame: x across it, y out of it, -z up it. On the panel likewise.
    const top = new THREE.Group();
    top.name = 'board top';
    top.position.set(B.origin[0], B.origin[1], B.origin[2]);
    top.rotation.x = B.tilt;
    const panel = new THREE.Group();
    panel.name = 'board panel';
    panel.position.set(B.panel.origin[0], B.panel.origin[1], B.panel.origin[2]);
    panel.rotation.x = Math.PI / 2 - B.panel.lean;
    this.group.add(top, panel);
    top.updateMatrix();
    panel.updateMatrix();
    /** @private */
    this._top = top;
    /** @private */
    this._panel = panel;
    const light = lightColor(P(W / 2, D / 2), B.normal);
    const panelLight = lightColor(Q(W / 2, H / 2), PN);

    // The ring round the pad the knobs turn.
    const half = BOARD.pad / 2, rim = new THREE.Shape();
    rim.moveTo(-half - 0.016, -half - 0.016).lineTo(half + 0.016, -half - 0.016).lineTo(half + 0.016, half + 0.016).lineTo(-half - 0.016, half + 0.016).closePath();
    const hole = new THREE.Path();
    hole.moveTo(-half - 0.005, -half - 0.005).lineTo(-half - 0.005, half + 0.005).lineTo(half + 0.005, half + 0.005).lineTo(half + 0.005, -half - 0.005).closePath();
    rim.holes.push(hole);
    this.ring = new THREE.Mesh(new THREE.ShapeGeometry(rim).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }));
    this.ring.name = 'selected pad';
    top.add(this.ring);

    // The knobs, the strip's and the panel's, and a line on each that shows where it is turned to.
    const { r, h } = BOARD.knob, n = B.knobs.length;
    this.knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r * 1.08, h, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2622').multiply(light) }), n);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.003, r * 0.75), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }), n);
    this.knobs.name = 'knobs';
    this.marks.name = 'knob marks';
    this.group.add(this.knobs, this.marks);

    // The strip: the pad's name, and over and under each knob what it is and what it is set to.
    const SX = 1024, SY = Math.round((SX * BOARD.strip) / W);
    /** @private */
    this._strip = canvas(SX, SY);
    /** @private */
    this._stripTexture = texture(this._strip, anisotropy);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(W, BOARD.strip).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this._stripTexture, color: light }));
    strip.position.set(W / 2, 0.0015, -(B.strip.b0 + B.strip.b1) / 2);
    strip.name = 'knob strip';
    top.add(strip);

    // The panel's face, and over it the tempo's display and the delay's settings under its knobs.
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texture(panelFace(B), anisotropy), color: panelLight }));
    face.position.set(W / 2, 0.0005, -H / 2);
    face.name = 'panel face';
    panel.add(face);
    /** @private the tempo's display (its top 128 rows) and the delay's settings (the 48 under) */
    this._values = canvas(480, 176);
    /** @private */
    this._valuesTexture = texture(this._values, anisotropy);
    /** @private where the delay's settings are, across the panel */
    this._row = { a0: 0.645, a1: 0.885, b0: 0.006, b1: 0.03 };
    const S = B.panel.display, R = this._row, split = 1 - 128 / 176; // where the display's rows end, up the canvas
    const values = new THREE.BufferGeometry();
    values.setAttribute('position', new THREE.Float32BufferAttribute([
      S.a0, 0.001, -S.b0, S.a1, 0.001, -S.b0, S.a1, 0.001, -S.b1, S.a0, 0.001, -S.b1,
      R.a0, 0.001, -R.b0, R.a1, 0.001, -R.b0, R.a1, 0.001, -R.b1, R.a0, 0.001, -R.b1,
    ], 3));
    values.setAttribute('uv', new THREE.Float32BufferAttribute([0, split, 320 / 480, split, 320 / 480, 1, 0, 1, 0, 0, 1, 0, 1, split, 0, split], 2));
    values.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    const shown = new THREE.Mesh(values, new THREE.MeshBasicMaterial({ map: this._valuesTexture, color: panelLight }));
    shown.name = 'panel values';
    panel.add(shown);
    // RUN's light, on the button.
    /** @private */
    this._led = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...LED.off) }));
    this._led.position.set((run.a0 + run.a1) / 2, BUTTON + 0.0004, -(run.b1 - 0.012));
    this._led.name = 'run light';
    panel.add(this._led);
    // The ring round the jack pointed at: gold, grey where the cable carried can't go.
    /** @private */
    this._jackRing = new THREE.Mesh(new THREE.RingGeometry(BOARD.panel.jack * 1.45, BOARD.panel.jack * 1.8, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiply(panelLight) }));
    this._jackRing.visible = false;
    this._jackRing.name = 'jack pointed at';
    panel.add(this._jackRing);
    /** @private */
    this._ringColors = { ok: new THREE.Color(GOLD).multiply(panelLight), no: new THREE.Color('#77706a').multiply(panelLight) };

    // The cables, one mesh (made again when they change), and the one being carried (moved in place).
    /** @private the panel's light, the cables' colours lit by it */
    this._panelLight = panelLight;
    this.cables = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.cables.name = 'cables';
    this.group.add(this.cables);
    const carried = new THREE.BufferGeometry();
    /** @private */
    this._carriedPos = new Float32Array(CABLE_VERTICES * 3);
    carried.setAttribute('position', new THREE.BufferAttribute(this._carriedPos, 3).setUsage(THREE.DynamicDrawUsage));
    carried.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CABLE_VERTICES * 3), 3));
    /** @type {number[]} */
    const carriedIndex = [];
    cableIndices(0, carriedIndex);
    carried.setIndex(carriedIndex);
    /** The cable being carried, from a jack to wherever it is pointed. */
    this.carried = new THREE.Mesh(carried, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.carried.name = 'cable carried';
    this.carried.frustumCulled = false;
    this.carried.visible = false;
    this.group.add(this.carried);
    /** @private the jack the carried cable comes from (B.panel.jacks), else -1 */
    this._carry = -1;
    /** @private where its free end is pointed (a hit and the way out of what it is on), if anywhere */
    this._aim = { has: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 };
    /** @private scratch: a cable's path and its ends; the carried one's jack, free plug and its way out */
    this._path = new Float32Array((SEGMENTS + 1) * 3);
    this._p = new Float32Array(3);
    this._q = new Float32Array(3);
    /** @private @type {[number, number, number]} */
    this._from = [0, 0, 0];
    this._free = new Float32Array(3);
    this._m = new Float32Array(3);

    // The sign on the wall, as wide as the board, where a level gaze meets it.
    const G = B.sign, sw = G.x1 - G.x0, sh = G.y1 - G.y0, mid = [(G.x0 + G.x1) / 2, (G.y0 + G.y1) / 2, G.z];
    const plate = signPlate(1024, Math.round((1024 * sh) / sw));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: texture(plate, anisotropy), color: lightColor(mid, [0, 0, 1]) }));
    sign.position.set(mid[0], mid[1], mid[2]);
    this._add(sign, 'sign');

    // The sticks, made once and put in the controllers' hands (holdSticks).
    const stickGeometry = new THREE.CylinderGeometry(0.0065, 0.0105, STICK.tip + STICK.back, 10).rotateX(-Math.PI / 2).translate(0, 0, (STICK.back - STICK.tip) / 2);
    const tipGeometry = new THREE.SphereGeometry(0.011, 10, 8).translate(0, 0, -STICK.tip);
    const wood = new THREE.MeshBasicMaterial({ color: '#b48d58' });
    /** The sticks, one for each hand: hidden until a hand holding a controller is near the board. */
    this.sticks = [0, 1].map(() => {
      const stick = new THREE.Group();
      stick.name = 'stick';
      stick.add(new THREE.Mesh(stickGeometry, wood), new THREE.Mesh(tipGeometry, wood));
      stick.visible = false;
      return stick;
    });
    /** @private the sticks' tips, then the forefingers' @type {Tip[]} */
    this._tips = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0, has: false, armed: false }));
    /** @private */
    this._at = new THREE.Vector3();
    /** @private */
    this._strike = { pad: -1, step: -1, speed: 0 };

    /** The pad the knobs turn. */
    this.selected = 0;
    /** @private @type {Knobs} */
    this._knobs = { pitch: 0.5, decay: 0.5, tone: 0.5 };
    /** @private */
    this._tempo = TEMPO.value;
    /** @private @type {DelayKnobs} */
    this._delay = { ...DEFAULT_DELAY };
    /** @private */
    this._stripDirty = true;
    /** @private seconds since the strip was drawn */
    this._stripAge = Infinity;
    /** @private */
    this._valuesDirty = true;
    /** @private seconds since the tempo and the delay's settings were drawn */
    this._valuesAge = Infinity;
    /** @private whether the clock runs, and how bright RUN's light is from the last beat (1 on it) */
    this._running = false;
    this._beat = 0;
    /** @private what RUN's light was last set to (-1 off, else the beat's brightness) */
    this._ledShown = -1;
    /** @private */
    this._dummy = new THREE.Object3D();
    /** @private */
    this._mat = new THREE.Matrix4();
    /** @private */
    this._offset = new THREE.Matrix4().makeTranslation(0, 0, -r * 0.45);
    this.select(0, this._knobs);
    this.setTempo(this._tempo);
    this.setDelay(this._delay);
  }

  /**
   * @private
   * @param {THREE.Object3D} mesh
   * @param {string} name
   */
  _add(mesh, name) {
    mesh.name = name;
    this.group.add(mesh);
  }

  /**
   * Lights pad i up, as hard as it was played (velocity 0…1); with less motion, more softly.
   * @param {number} i
   * @param {number} velocity
   * @param {boolean} [reduce]
   */
  flash(i, velocity, reduce = false) {
    const g = reduce ? 0.25 + 0.3 * velocity : 0.35 + 0.65 * velocity;
    if (i >= 0 && i < this.glow.length) this.glow[i] = Math.max(this.glow[i], g);
  }

  /**
   * The pad the knobs turn, and its knobs: the ring round it, the knobs turned to them, the strip,
   * and its colour on the step keys (its pattern: setSteps).
   * @param {number} i
   * @param {Knobs} knobs
   */
  select(i, knobs) {
    const p = this.board.pads[i];
    if (!p) return;
    this.selected = i;
    this.ring.position.set((p.a0 + p.a1) / 2, BOARD.rise + 0.0008, -(p.b0 + p.b1) / 2);
    this._keyTint = this._tints[i];
    this._keyShown.fill(-1);
    this.setKnobs(knobs);
  }

  /**
   * The selected pad's pattern on the step keys: lit in its colour where it plays.
   * @param {readonly boolean[]} steps
   */
  setSteps(steps) {
    for (let s = 0; s < STEPS; s++) this._steps[s] = steps[s] ? 1 : 0;
  }

  /**
   * Knob n (B.knobs) turned to `value` (0…1: from 135° left to 135° right), in its frame.
   * @private
   * @param {number} n
   * @param {number} value
   */
  _turn(n, value) {
    const k = this.board.knobs[n], d = this._dummy, h = BOARD.knob.h;
    const frame = k.on === 'top' ? this._top : this._panel;
    d.position.set(k.a, h / 2, -k.b);
    d.rotation.set(0, -(value - 0.5) * 1.5 * Math.PI, 0);
    d.updateMatrix();
    this.knobs.setMatrixAt(n, this._mat.multiplyMatrices(frame.matrix, d.matrix));
    d.position.y = h + 0.0015;
    d.updateMatrix();
    this.marks.setMatrixAt(n, this._mat.multiplyMatrices(frame.matrix, d.matrix).multiply(this._offset));
    this.knobs.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
  }

  /**
   * The strip's knobs turned to the selected pad's settings.
   * @param {Knobs} knobs
   */
  setKnobs(knobs) {
    this._knobs = knobs;
    this.board.knobs.forEach((k, n) => {
      if (k.part === 'drum') this._turn(n, knobs[k.name]);
    });
    this._stripDirty = true;
  }

  /**
   * The clock's tempo (beats per minute): its knob, and its display.
   * @param {number} tempo
   */
  setTempo(tempo) {
    this._tempo = tempo;
    this.board.knobs.forEach((k, n) => {
      if (k.part === 'clock') this._turn(n, (tempo - TEMPO.min) / (TEMPO.max - TEMPO.min));
    });
    this._valuesDirty = true;
  }

  /**
   * The delay's knobs, and their settings under them.
   * @param {DelayKnobs} knobs
   */
  setDelay(knobs) {
    this._delay = knobs;
    this.board.knobs.forEach((k, n) => {
      if (k.part === 'delay') this._turn(n, knobs[k.name]);
    });
    this._valuesDirty = true;
  }

  /** Whether the clock runs: RUN's light. @param {boolean} on */
  setRunning(on) {
    this._running = on;
    if (!on) this._beat = 0;
  }

  /** A beat: RUN's light brighter a moment (with less motion, not). @param {boolean} [reduce] */
  beat(reduce = false) {
    if (!reduce) this._beat = 1;
  }

  /**
   * The cables between the jacks, each in its colour (patch.js's cables, as main.js draws them).
   * @param {readonly DrawnCable[]} cables
   */
  setCables(cables) {
    const jacks = this.board.panel.jacks, N = this.board.panel.normal;
    const pos = new Float32Array(cables.length * CABLE_VERTICES * 3), color = new Float32Array(pos.length);
    /** @type {number[]} */
    const index = [];
    cables.forEach((c, i) => {
      const from = jacks[c.from], to = jacks[c.to];
      if (!from || !to) return;
      this._writeCable(pos, i * CABLE_VERTICES, panelPoint(this.board, from.a, from.b, 0, [0, 0, 0]), N, panelPoint(this.board, to.a, to.b, 0, [0, 0, 0]), N);
      this._paint(color, i * CABLE_VERTICES, c.color);
      cableIndices(i * CABLE_VERTICES, index);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setIndex(index);
    g.computeBoundingSphere();
    this.cables.geometry.dispose();
    this.cables.geometry = g;
  }

  /**
   * A cable carried from jack j (B.panel.jacks), in its colour, to wherever aimAt points it; or,
   * j -1, none.
   * @param {number} j
   * @param {string} [color]
   */
  carry(j, color = GOLD) {
    this._carry = this.board.panel.jacks[j] ? j : -1;
    this.carried.visible = this._carry >= 0;
    if (this._carry < 0) return;
    const attr = /** @type {THREE.BufferAttribute} */ (this.carried.geometry.getAttribute('color'));
    this._paint(/** @type {Float32Array} */ (attr.array), 0, color);
    attr.needsUpdate = true;
    this._moveCarried();
  }

  /**
   * Where the carried cable's free end is pointed: a point on something, and the way out of it; or,
   * with none (a finger lifted), it hangs from its jack.
   * @param {{ x: number, y: number, z: number, nx: number, ny: number, nz: number } | null} hit
   */
  aimAt(hit) {
    const a = this._aim;
    a.has = !!hit;
    if (hit) {
      a.x = hit.x;
      a.y = hit.y;
      a.z = hit.z;
      a.nx = hit.nx;
      a.ny = hit.ny;
      a.nz = hit.nz;
    }
  }

  /**
   * The jack pointed at (B.panel.jacks), else -1: ringed, in gold, or in grey where the cable
   * carried can't go (`ok` false).
   * @param {number} j
   * @param {boolean} [ok]
   */
  hoverJack(j, ok = true) {
    const jack = this.board.panel.jacks[j];
    this._jackRing.visible = !!jack;
    if (!jack) return;
    this._jackRing.position.set(jack.a, 0.0012, -jack.b);
    this._jackRing.material.color.copy(ok ? this._ringColors.ok : this._ringColors.no);
  }

  /**
   * Writes a cable into pos from vertex `at`: a plug in the jack at p (out along n), the cable from
   * its end to the end of the plug at q (out along m), and that plug.
   * @private
   * @param {Float32Array} pos
   * @param {number} at
   * @param {number[] | Float32Array} p
   * @param {number[] | Float32Array} n
   * @param {number[] | Float32Array} q
   * @param {number[] | Float32Array} m
   */
  _writeCable(pos, at, p, n, q, m) {
    const L = CABLE.plug, path = this._path, P = this._p, Q = this._q;
    for (let i = 0; i < 3; i++) {
      P[i] = p[i] + n[i] * L;
      Q[i] = q[i] + m[i] * L;
    }
    hang(this.board, P, n, Q, m, path);
    let v = at;
    for (let i = 0; i <= SEGMENTS; i++) {
      // The way it goes here: from the point before to the one after.
      const a = Math.max(0, i - 1) * 3, b = Math.min(SEGMENTS, i + 1) * 3;
      let tx = path[b] - path[a], ty = path[b + 1] - path[a + 1], tz = path[b + 2] - path[a + 2];
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l;
      ty /= l;
      tz /= l;
      v = ring(pos, v, path[i * 3], path[i * 3 + 1], path[i * 3 + 2], tx, ty, tz, CABLE.r);
    }
    v = plug(pos, v, p, n);
    plug(pos, v, q, m);
  }

  /**
   * A cable's colours into color from vertex `at`: the cable in its colour, its plugs darker, lit as
   * the panel is.
   * @private
   * @param {Float32Array} color
   * @param {number} at
   * @param {string} hex
   */
  _paint(color, at, hex) {
    const [r, g, b] = lin(hex), L = this._panelLight;
    const tube = (SEGMENTS + 1) * SIDES;
    for (let v = 0; v < CABLE_VERTICES; v++) {
      const k = v < tube ? 1 : 0.45, i = (at + v) * 3;
      color[i] = r * k * L.r;
      color[i + 1] = g * k * L.g;
      color[i + 2] = b * k * L.b;
    }
  }

  /**
   * The carried cable, from its jack to where it is pointed: its free plug just off what it points
   * at, facing into it; pointed at nothing, lying out from its jack over the top.
   * @private
   */
  _moveCarried() {
    const B = this.board, jack = B.panel.jacks[this._carry];
    if (!jack) return;
    const N = B.panel.normal, a = this._aim, q = this._free, m = this._m;
    const p = panelPoint(B, jack.a, jack.b, 0, this._from);
    if (a.has) {
      m[0] = a.nx;
      m[1] = a.ny;
      m[2] = a.nz;
      q[0] = a.x + a.nx * 0.008;
      q[1] = a.y + a.ny * 0.008;
      q[2] = a.z + a.nz * 0.008;
      // Pointed farther than it reaches (across the room): held out towards there, as far as it goes.
      const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], d = Math.hypot(dx, dy, dz);
      if (d > CABLE.reach) {
        const k = CABLE.reach / d;
        q[0] = p[0] + dx * k;
        q[1] = p[1] + dy * k;
        q[2] = p[2] + dz * k;
        m[0] = -dx / d;
        m[1] = -dy / d;
        m[2] = -dz / d;
      }
    } else {
      // Out from the jack and down onto the top, its plug lying back towards the panel.
      q[0] = p[0];
      q[1] = p[1] + N[1] * 0.14 - 0.1;
      q[2] = p[2] + N[2] * 0.14;
      const over = heightOver(B, q[0], q[1], q[2]) - 0.012;
      if (over < 0) {
        q[1] -= B.normal[1] * over;
        q[2] -= B.normal[2] * over;
      }
      m[0] = 0;
      m[1] = B.up[1];
      m[2] = B.up[2];
    }
    this._writeCable(this._carriedPos, 0, p, N, q, m);
    this.carried.geometry.getAttribute('position').needsUpdate = true;
  }

  /**
   * The pad pointed at (a mouse, the middle of the view, a controller's ray), else -1; none while a
   * stick is out (its ray is hidden then).
   * @param {number} i
   */
  hover(i) {
    this.hovered = this.sticks[0].visible || this.sticks[1].visible ? -1 : i;
  }

  /**
   * Per frame: the glow fades, and the faces are written when it, or what is pointed at, changed;
   * the step keys likewise; RUN's light; the strip, and the tempo and the delay's settings, redrawn
   * when they changed (at most ten times a second); the carried cable moved.
   * @param {number} dt
   */
  update(dt) {
    const fade = Math.exp(-dt * 9);
    let changed = false;
    for (let i = 0; i < this.glow.length; i++) {
      let g = this.glow[i] * fade;
      if (g < 0.01) g = 0;
      this.glow[i] = g;
      const shown = g + (this.hovered === i ? 2 : 0); // the hover is in the same number, apart from the glow
      if (shown !== this._shown[i]) {
        this._shown[i] = shown;
        this._light(i, g, this.hovered === i);
        changed = true;
      }
    }
    if (changed) this._colors.needsUpdate = true;
    let keys = false;
    for (let s = 0; s < STEPS; s++) if (this._lightKey(s)) keys = true;
    if (keys) this._keyColors.needsUpdate = true;
    this._beat = Math.max(0, this._beat - dt * 5);
    const led = this._running ? Math.round(this._beat * 20) / 20 : -1;
    if (led !== this._ledShown) {
      this._ledShown = led;
      const c = this._led.material.color, k = Math.max(0, led);
      if (led < 0) c.setRGB(LED.off[0], LED.off[1], LED.off[2]);
      else c.setRGB(LED.on[0] + (LED.beat[0] - LED.on[0]) * k, LED.on[1] + (LED.beat[1] - LED.on[1]) * k, LED.on[2] + (LED.beat[2] - LED.on[2]) * k);
    }
    this._stripAge += dt;
    if (this._stripDirty && this._stripAge >= 0.1) this._drawStrip();
    this._valuesAge += dt;
    if (this._valuesDirty && this._valuesAge >= 0.1) this._drawValues();
    if (this._carry >= 0) this._moveCarried();
  }

  /**
   * Pad i's face: its baked light, a little brighter pointed at, and its colour as it glows.
   * @private
   * @param {number} i
   * @param {number} glow
   * @param {boolean} hovered
   */
  _light(i, glow, hovered) {
    const [first, n] = this._spans[i], [r, g, b] = this._tints[i];
    const lift = hovered ? 1.25 : 1, k = glow * BOOST;
    const c = /** @type {Float32Array} */ (this._colors.array), base = this._base;
    for (let v = first * 3; v < (first + n) * 3; v += 3) {
      c[v] = base[v] * lift + r * k;
      c[v + 1] = base[v + 1] * lift + g * k;
      c[v + 2] = base[v + 2] * lift + b * k;
    }
  }

  /**
   * Step key s's cap, if it changed: dark, or in the selected pad's colour where it plays; brighter
   * as the step playing, and pointed at. Whether it was written.
   * @private
   * @param {number} s
   */
  _lightKey(s) {
    const on = this._steps[s] === 1, now = this.playhead === s, hover = this.hoveredStep === s;
    const code = (on ? 1 : 0) | (now ? 2 : 0) | (hover ? 4 : 0);
    if (code === this._keyShown[s]) return false;
    this._keyShown[s] = code;
    const [first, n] = this._keySpans[s], [r, g, b] = this._keyTint;
    const lift = hover ? 1.2 : 1, add = now ? 0.6 : 0;
    const kr = (on ? r * 1.3 : 0.3) + add, kg = (on ? g * 1.3 : 0.3) + add, kb = (on ? b * 1.3 : 0.3) + add;
    const c = /** @type {Float32Array} */ (this._keyColors.array), base = this._keyBase;
    for (let v = first * 3; v < (first + n) * 3; v += 3) {
      c[v] = base[v] * kr * lift;
      c[v + 1] = base[v + 1] * kg * lift;
      c[v + 2] = base[v + 2] * kb * lift;
    }
    return true;
  }

  /** @private */
  _drawStrip() {
    this._stripDirty = false;
    this._stripAge = 0;
    const c = this._strip, g = context(c), B = this.board, W = c.width, H = c.height;
    const x = (/** @type {number} */ a) => (a / B.width) * W;
    const y = (/** @type {number} */ b) => ((B.strip.b1 - b) / (B.strip.b1 - B.strip.b0)) * H;
    g.fillStyle = '#1d1b19';
    g.fillRect(0, 0, W, H);
    // The display: the pad's name in its colour, and its key.
    const D = B.display, pad = PADS[this.selected];
    const dx = x(D.a0), dy = y(D.b1), dw = x(D.a1) - dx, dh = y(D.b0) - dy;
    g.fillStyle = '#0d1714';
    g.beginPath();
    g.roundRect(dx, dy, dw, dh, 10);
    g.fill();
    g.strokeStyle = 'rgba(224,187,114,0.45)';
    g.lineWidth = 2;
    g.stroke();
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = pad.color;
    fit(g, pad.name, dw - 120, 52, '700');
    g.fillText(pad.name, dx + 20, dy + dh * 0.42);
    g.fillStyle = '#b9a98d';
    g.font = `22px ${SANS}`;
    g.fillText(`key ${keyLabel(pad.key)}`, dx + 20, dy + dh * 0.8);
    // Each knob: in front of it (a knob would hide what is behind it), its name, then its setting.
    g.textAlign = 'center';
    const r = (BOARD.knob.r / B.width) * W, room = (BOARD.knob.spacing / B.width) * W - 8;
    for (const k of B.knobs) {
      if (k.part !== 'drum') continue;
      const kx = x(k.a), ky = y(k.b), text = knobText(this.selected, k.name, this._knobs[k.name]);
      g.fillStyle = '#e0bb72';
      g.font = `600 21px ${SANS}`;
      g.fillText(k.name.toUpperCase(), kx, ky + r + 19);
      g.fillStyle = '#efe5cf';
      fit(g, text, room, 20, '500');
      g.fillText(text, kx, ky + r + 43);
    }
    this._stripTexture.needsUpdate = true;
  }

  /** The tempo's display, and the delay's settings under its knobs. @private */
  _drawValues() {
    this._valuesDirty = false;
    this._valuesAge = 0;
    const c = this._values, g = context(c), R = this._row;
    g.fillStyle = '#26231f';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#0d1714';
    g.strokeStyle = 'rgba(224,187,114,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(4, 4, 312, 120, 12);
    g.fill();
    g.stroke();
    g.textBaseline = 'middle';
    g.fillStyle = '#9ee6b8';
    g.textAlign = 'right';
    g.font = `700 78px ${SANS}`;
    g.fillText(String(this._tempo), 206, 66);
    g.textAlign = 'left';
    g.font = `600 30px ${SANS}`;
    g.fillText('BPM', 218, 78);
    g.textAlign = 'center';
    g.fillStyle = '#efe5cf';
    for (const k of this.board.knobs) {
      if (k.part !== 'delay') continue;
      const v = this._delay[k.name], n = delaySteps(v);
      const text = k.name === 'time' ? `${n} step${n === 1 ? '' : 's'}` : `${Math.round(v * 100)}%`;
      fit(g, text, (0.075 / (R.a1 - R.a0)) * c.width, 30, '500');
      g.fillText(text, ((k.a - R.a0) / (R.a1 - R.a0)) * c.width, 128 + 24);
    }
    this._valuesTexture.needsUpdate = true;
  }

  /**
   * Puts the sticks in the controllers' hands (common's Controls hands, in the rig).
   * @param {Hand[]} hands
   */
  holdSticks(hands) {
    hands.forEach((h, i) => {
      const stick = this.sticks[i];
      if (stick) h.controller.add(stick);
    });
  }

  /**
   * In VR, per frame, after the controls' update (the rig's matrices are this frame's): each stick
   * shows while its hand holds a controller near the board, or where `nearAlso` says (the synth's
   * keys), and that hand's laser hides, its reticle too but on a knob, a jack, RUN, a step key, a
   * dial or a button; and each stick's tip, or forefinger of a hand without one, plays a pad, or sets
   * a step, it comes down on.
   * @param {Hand[]} hands
   * @param {THREE.XRHandSpace[]} fingers the hands' joints (renderer.xr.getHand)
   * @param {number} dt
   * @param {((x: number, y: number, z: number) => boolean) | null} [nearAlso] whether a hand at (x, y, z) is near something else played with a stick
   */
  updateXR(hands, fingers, dt, nearAlso = null) {
    const B = this.board, at = this._at;
    for (let i = 0; i < 2; i++) {
      const h = hands[i], stick = this.sticks[i], source = h?.source ?? null;
      let near = false;
      if (h && source && !source.hand && source.targetRayMode === 'tracked-pointer') {
        at.setFromMatrixPosition(h.controller.matrixWorld);
        near = (at.x > B.x0 - 0.7 && at.x < B.x1 + 0.7 && at.z > B.zBack - 0.2 && at.z < B.zFront + 0.9 && at.y > 0.3) || !!nearAlso?.(at.x, at.y, at.z);
        if (near) {
          at.set(0, 0, -STICK.tip).applyMatrix4(h.controller.matrixWorld);
          h.laser.visible = false;
          if (!AIMED.has(h.last?.kind ?? '')) h.reticle.visible = false;
        }
      }
      if (stick) stick.visible = near;
      this._track(this._tips[i], near, false, source, dt);
      // The forefinger of a hand without a controller (three keeps a joint's last pose, and its
      // visible, when the hand puts it down for a controller: the hand's own visible says).
      const tip = fingers[i]?.joints['index-finger-tip'];
      const finger = !!(fingers[i]?.visible && tip?.visible);
      if (finger && tip) at.setFromMatrixPosition(tip.matrixWorld);
      this._track(this._tips[2 + i], finger, true, null, dt);
    }
  }

  /** Back on a screen: the sticks put away, every tip forgotten. */
  endXR() {
    for (const s of this.sticks) s.visible = false;
    for (const t of this._tips) t.has = false;
  }

  /**
   * One tip, now at this._at (when `active`): a strike if it came down on a pad or a step key since
   * last frame and was up off the board before; it must come back up REARM before it can strike
   * again.
   * @private
   * @param {Tip} tip
   * @param {boolean} active
   * @param {boolean} finger
   * @param {XRInputSource | null} source
   * @param {number} dt
   */
  _track(tip, active, finger, source, dt) {
    if (!active) {
      tip.has = false;
      return;
    }
    const B = this.board, p = this._at, h = heightOver(B, p.x, p.y, p.z);
    if (!tip.has) tip.armed = h > REARM;
    else if (tip.armed) {
      const s = strikeAt(B, tip.x, tip.y, tip.z, p.x, p.y, p.z, dt, this._strike);
      if (s.pad >= 0) {
        tip.armed = false;
        this.onStrike(s.pad, strikeVelocity(s.speed, finger), source);
      } else if (s.step >= 0) {
        tip.armed = false;
        this.onStep(s.step, source);
      } else if (h <= 0) tip.armed = false; // through the top off the pads
    } else if (h > REARM) tip.armed = true;
    tip.x = p.x;
    tip.y = p.y;
    tip.z = p.z;
    tip.has = true;
  }
}
