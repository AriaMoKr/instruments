// The drum board: a stand against the middle of the far wall, its top leaning a little towards the
// player, with drums.js's twelve pads on it in its rows and columns (row 0 nearest) and, behind them,
// a strip with the knobs (pitch, decay, tone) of the pad last played and what they are set to. Pure
// functions with no three.js, as room.js's, so the tests run them in Node: where it stands and what
// is on its top (layoutBoard), what a ray meets on it (hitBoard), where one may walk round it
// (clampBoard, boardBlocks), where to stand to play it (boardFront on a screen: as far back as the
// whole top needs to be in view, clear of the card over it; boardStand in VR: at arm's length), and
// when a stick's tip, or a finger, comes down on a pad (strikeAt).
//
// Coordinates as room.js's. On the top, `a` runs from its left edge to the right (world +x) and `b`
// from its front edge up the slope, away from the player; its normal leans towards the player.
import { EYE } from './room.js';
import { COLUMNS, KNOBS, PADS, ROWS } from './drums.js';

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The board's measures, in metres and radians: the pads (`pad` square, `gap` apart, `margin` in
 * from the top's edges, their faces `rise` over it), the strip behind them `strip` deep with the
 * knobs (`knob`: each one's radius and height, `spacing` apart, the last `inset` from the right
 * edge), the top's front edge `front` high, leaning back by `tilt`, `thick`, its back `wall` from
 * the far wall, and how near a head comes to it, `keep`.
 */
export const BOARD = Object.freeze({
  pad: 0.18, gap: 0.03, margin: 0.05, rise: 0.012, strip: 0.14,
  knob: Object.freeze({ r: 0.032, h: 0.028, spacing: 0.15, inset: 0.07 }),
  front: 0.9, tilt: 0.25, thick: 0.05, wall: 0.08, keep: 0.25,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/** How far a stick's tip, or a finger, comes back up off a pad before it can strike again. */
export const REARM = 0.012;

/**
 * The board against the middle of the far wall: its footprint (x0…x1, zBack at the wall's side to
 * zFront), its top (`origin` its front left corner, `up` along it away from the player, `normal`
 * out of it; `width` across, `length` up the slope; its front edge `front` high, its back `top`),
 * each pad's place on it (a0…a1, b0…b1), the knobs' (a, b), the strip's span (b0…b1) and its
 * display's (a0…a1, b0…b1, where the pad's name is shown), and the sign over it on the wall (x0…x1,
 * y0…y1 at z), at eye height, where a level gaze finds it (a TV's dot, which can't look down).
 * @param {{ z1: number }} L the room's layout (room.js layoutRoom)
 */
export function layoutBoard(L) {
  const { pad, gap, margin, strip, tilt, front, wall, knob } = BOARD;
  const width = 2 * margin + COLUMNS * pad + (COLUMNS - 1) * gap;
  const stripB0 = margin + ROWS * pad + (ROWS - 1) * gap + 0.04;
  const length = stripB0 + strip + 0.03;
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  const zBack = L.z1 + wall, zFront = zBack + length * cos;
  const x0 = -width / 2;
  const pads = PADS.map((p) => {
    const a0 = margin + p.col * (pad + gap), b0 = margin + p.row * (pad + gap);
    return { a0, a1: a0 + pad, b0, b1: b0 + pad };
  });
  const knobs = KNOBS.map((name, k) => ({ name, a: width - knob.inset - (KNOBS.length - 1 - k) * knob.spacing, b: stripB0 + strip / 2 }));
  const firstKnob = knobs[0]?.a ?? width;
  return {
    x0, x1: width / 2, zBack, zFront, width, length, tilt, front, top: front + length * sin,
    /** @type {[number, number, number]} */
    origin: [x0, front, zFront],
    /** @type {[number, number, number]} */
    up: [0, sin, -cos],
    /** @type {[number, number, number]} */
    normal: [0, cos, sin],
    pads,
    knobs,
    strip: { b0: stripB0, b1: stripB0 + strip },
    display: { a0: margin, a1: firstKnob - knob.r - 0.05, b0: stripB0 + 0.012, b1: stripB0 + strip - 0.012 },
    sign: { x0, x1: width / 2, y0: BOARD.sign.bottom, y1: BOARD.sign.top, z: L.z1 + BOARD.sign.out },
  };
}

/** The board as layoutBoard lays it out. @typedef {ReturnType<typeof layoutBoard>} Board */

/**
 * The point `a` across the top, `b` up it and `h` out of it, in the world, written into out.
 * @param {Board} B
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
 * The pad at (a, b) on the top, else -1.
 * @param {Board} B
 * @param {number} a
 * @param {number} b
 */
export function padAt(B, a, b) {
  for (let i = 0; i < B.pads.length; i++) {
    const p = B.pads[i];
    if (a >= p.a0 && a <= p.a1 && b >= p.b0 && b <= p.b1) return i;
  }
  return -1;
}

/**
 * The knob at (a, b) on the top (a little larger than it, to be easier to point at), else -1.
 * @param {Board} B
 * @param {number} a
 * @param {number} b
 */
export function knobAt(B, a, b) {
  const r = BOARD.knob.r * 1.25;
  for (let k = 0; k < B.knobs.length; k++) {
    const n = B.knobs[k];
    if ((a - n.a) ** 2 + (b - n.b) ** 2 <= r * r) return k;
  }
  return -1;
}

/**
 * What room.js castRay writes, with the board's: which pad (else -1) and which knob (else -1).
 * @typedef {import('./room.js').RoomHit & { pad: number, knob: number }} BandHit
 */

/**
 * What a ray meets on the board, if nearer than `within` (what it meets in the room otherwise): a
 * pad (its faces, `rise` over the top; u, v where on it, from its front left), a knob, or the rest of
 * the board ('board': its top, its front, its sides, and its sign on the wall), written into out as
 * room.js castRay writes a hit. Whether it met the board.
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
  let t = within, kind = '', nx = 0, ny = 0, nz = 0, pad = -1, knob = -1, u = 0, v = 0;
  const [Ox, Oy, Oz] = B.origin, [, Uy, Uz] = B.up, [, Ny, Nz] = B.normal;
  // The top, coming down on it.
  const dn = dy * Ny + dz * Nz;
  if (dn < 0) {
    const s = ((Oy + Ny * BOARD.rise - oy) * Ny + (Oz + Nz * BOARD.rise - oz) * Nz) / dn;
    if (s > 0 && s < t) {
      const a = ox + dx * s - Ox, b = (oy + dy * s - Oy) * Uy + (oz + dz * s - Oz) * Uz;
      if (a >= 0 && a <= B.width && b >= 0 && b <= B.length) {
        t = s;
        kind = 'board';
        ny = Ny;
        nz = Nz;
        pad = padAt(B, a, b);
        knob = pad < 0 ? knobAt(B, a, b) : -1;
        if (pad >= 0) {
          kind = 'pad';
          u = (a - B.pads[pad].a0) / BOARD.pad;
          v = (b - B.pads[pad].b0) / BOARD.pad;
        } else if (knob >= 0) kind = 'knob';
      }
    }
  }
  // Its front, under the top's front edge, and its sign on the wall.
  if (dz < 0) {
    for (const [z, x0, x1, y0, y1] of [[B.zFront, B.x0, B.x1, 0, B.front], [B.sign.z, B.sign.x0, B.sign.x1, B.sign.y0, B.sign.y1]]) {
      const s = (z - oz) / dz;
      const x = ox + dx * s, y = oy + dy * s;
      if (s > 0 && s < t && x >= x0 && x <= x1 && y >= y0 && y <= y1) {
        t = s;
        kind = 'board';
        nx = ny = 0;
        nz = 1;
        pad = knob = -1;
      }
    }
  }
  // Its sides, under the top as it rises.
  for (const side of [-1, 1]) {
    if (dx * side >= 0) continue;
    const s = ((side < 0 ? B.x0 : B.x1) - ox) / dx;
    const y = oy + dy * s, z = oz + dz * s;
    if (s > 0 && s < t && z >= B.zBack && z <= B.zFront && y >= 0 && y <= B.front + (B.zFront - z) * Math.tan(B.tilt)) {
      t = s;
      kind = 'board';
      nx = side;
      ny = nz = 0;
      pad = knob = -1;
    }
  }
  if (!kind) return false;
  out.t = t;
  out.kind = kind;
  out.x = ox + dx * t;
  out.y = oy + dy * t;
  out.z = oz + dz * t;
  out.nx = nx;
  out.ny = ny;
  out.nz = nz;
  out.u = u;
  out.v = v;
  out.walkable = false;
  out.piece = -1;
  out.pad = pad;
  out.knob = knob;
  return true;
}

/**
 * Whether (x, z) is too near the board to stand at: on it, or within `keep` of its front or sides.
 * @param {Board} B
 * @param {number} x
 * @param {number} z
 */
export function boardBlocks(B, x, z) {
  const k = BOARD.keep - 1e-9;
  return x > B.x0 - k && x < B.x1 + k && z < B.zFront + k;
}

/**
 * The nearest place to (x, z) a head coming from (fx, fz) may be, round the board: `keep` from its
 * front or its sides, the side it came from, sliding along it. Writes { x, z } into out.
 * @param {Board} B
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
 * Where to stand to play the board on a screen: in front of it, as near as `keep` allows but far
 * enough back that all of its top is in the view (a view `fov` degrees high, `aspect` wide for 1
 * high, from EYE), within `fill` of its edges and clear of what the page shows over it (`over`: the
 * card, the buttons). Facing it, looking down at the middle of its top in the middle of the view;
 * where something covers that, with the board beside it, or below or above it: at each distance,
 * the first of those that fits.
 * @param {Board} B
 * @param {{ fov?: number, aspect?: number, fill?: number, over?: Rect[] }} [o]
 */
export function boardFront(B, { fov = 70, aspect = 16 / 9, fill = 0.88, over = [] } = {}) {
  const ty = Math.tan((fov * Math.PI) / 360), tx = ty * aspect;
  // The top's outline, the knobs' height above it: points along each edge in turn, round it.
  /** @type {[number, number, number][]} */
  const outline = [];
  for (const [a0, b0, a1, b1] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]]) {
    for (let i = 0; i < 16; i++) {
      const f = i / 16;
      outline.push(boardPoint(B, (a0 + (a1 - a0) * f) * B.width, (b0 + (b1 - b0) * f) * B.length, BOARD.knob.h));
    }
  }
  const c = boardPoint(B, B.width / 2, B.length / 2);
  const x = (B.x0 + B.x1) / 2;
  // Where in the view the top's middle goes: the middle, else beside, below or above what covers it.
  /** @type {[number, number][]} */
  const aims = [[0, 0]];
  for (const r of over) aims.push([(r.x1 + 1) / 2, 0], [(r.x0 - 1) / 2, 0], [0, (r.y0 - 1) / 2], [0, (r.y1 + 1) / 2]);
  // Up or down in the view by looking higher or lower, across it by stepping aside (a metre at
  // most), so that the board's edges stay level in the view.
  /** @param {number} z @param {[number, number]} aim */
  const place = (z, [mx, my]) => {
    const pitch = -Math.atan2(EYE - c[1], z - c[2]) - Math.atan(my * ty);
    const ahead = (c[1] - EYE) * Math.sin(pitch) - (c[2] - z) * Math.cos(pitch);
    return { x: x - mx * tx * ahead, z, yaw: 0, pitch };
  };
  /** @param {{ x: number, z: number, yaw: number, pitch: number }} at */
  const fits = (at) => {
    if (Math.abs(at.x - x) > 1) return false;
    /** @type {[number, number][]} */
    const seen = [];
    for (const [px, py, pz] of outline) {
      const v = inView(px, py, pz, at.x, at.z, at.yaw, at.pitch, tx, ty);
      if (!v || Math.abs(v[0]) > fill || Math.abs(v[1]) > fill) return false;
      if (over.some((r) => v[0] > r.x0 - CLEAR && v[0] < r.x1 + CLEAR && v[1] > r.y0 - CLEAR && v[1] < r.y1 + CLEAR)) return false;
      seen.push(v);
    }
    // Nor anything over the view inside the outline (which is convex): a corner of it within.
    return over.every((r) => [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].every((p) => !within(seen, /** @type {[number, number]} */ (p))));
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
 * Where to stand to play the board in VR: the head a little back from its front edge, the pads in
 * reach of a stick, facing it.
 * @param {Board} B
 */
export function boardStand(B) {
  return { x: (B.x0 + B.x1) / 2, z: B.zFront + 0.32, yaw: 0 };
}

/**
 * How far the point (x, y, z) is out of the pads' faces (below them: < 0).
 * @param {Board} B
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function heightOver(B, x, y, z) {
  const [, Oy, Oz] = B.origin, [, Ny, Nz] = B.normal;
  return (y - Oy) * Ny + (z - Oz) * Nz - BOARD.rise;
}

/**
 * A tip (a stick's, a finger's) that went from (fx, fy, fz) to (tx, ty, tz) in `dt` seconds: if it
 * came down through a pad's face, which pad and how fast it was going into it (m/s), written into
 * out; else out.pad is -1. Where it crossed, not where it ended, says which pad.
 * @param {Board} B
 * @param {number} fx
 * @param {number} fy
 * @param {number} fz
 * @param {number} tx
 * @param {number} ty
 * @param {number} tz
 * @param {number} dt
 * @param {{ pad: number, speed: number }} out
 */
export function strikeAt(B, fx, fy, fz, tx, ty, tz, dt, out) {
  out.pad = -1;
  out.speed = 0;
  const hf = heightOver(B, fx, fy, fz), ht = heightOver(B, tx, ty, tz);
  if (!(hf > 0 && ht <= 0)) return out;
  const f = hf / (hf - ht);
  const x = fx + (tx - fx) * f, y = fy + (ty - fy) * f, z = fz + (tz - fz) * f;
  const [Ox, Oy, Oz] = B.origin, [, Uy, Uz] = B.up;
  out.pad = padAt(B, x - Ox, (y - Oy) * Uy + (z - Oz) * Uz);
  out.speed = (hf - ht) / Math.max(dt, 1e-3);
  return out;
}

/**
 * A strike's speed into a pad (m/s) as a velocity 0…1: a stick moves faster than a finger, so a
 * finger's counts for more.
 * @param {number} speed
 * @param {boolean} [finger]
 */
export const strikeVelocity = (speed, finger = false) => clamp((speed - (finger ? 0.1 : 0.2)) / (finger ? 1.4 : 2.3), 0.06, 1);
