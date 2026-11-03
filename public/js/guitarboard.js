// The electric guitar's desk, against the right wall by the rack, turned to face into the room: the
// first desk that isn't against the far wall. It is a desk as the board is (board.js's Desk: a top
// leaning a little towards the player, a panel at its back leaning back, a sign over it on the wall),
// laid out in a frame of its own as if it stood against a far wall (`a` along it from its left end,
// its wall at z 0, the player towards +z), and turned in the room by its `place`: its left end
// towards the far wall, its back to the right wall, the player facing the right wall. board.js's
// functions work on it in its own frame; those here take the room's points and rays, and give back
// the room's, turning them there and back (hitGuitar, guitarBlocks, clampGuitar, guitarFront,
// guitarStand, guitarPoint).
// On its top the guitar lies, its neck to the player's left and its low E nearest: its headstock, its
// neck with FRETS frets (spaced as a guitar's are, the strings a little further apart towards the
// bridge), its body with the two pickups where strings.js hears them, the bridge, its VOLUME and TONE
// knobs and its pickup switch on the far side of the strings; behind its neck the chord buttons, two
// rows of eight as the computer's keys that choose them (1–8 behind, Q–I in front); on the panel a
// display and the amp's knobs. Pure functions with no three.js, as board.js's, so the tests run them
// in Node.
//
// Coordinates on the top, as board.js's: `a` from its left end along it, `b` from its front edge up
// the slope; on the panel `a` likewise, `b` from its foot up its face.
import { boardBlocks, boardFront, boardStand, clampBoard, meetDesk, writeHit } from './board.js';
import { CHORDS, FRETS, GUITAR_KNOBS, MAX_BEND, PICKUPS } from './guitar.js';
import { PICK, PICKUP_PLACES } from './strings.js';

/** @typedef {import('./guitar.js').GuitarKnob} GuitarKnob */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The guitar's measures, in metres and radians: a guitar's, its neck widened to play with a finger
 * or a stick.
 */
export const GUITAR = Object.freeze({
  /**
   * The neck: the strings' length from the nut to the bridge (`scale`), `nut` apart at the nut and
   * `bridge` at the bridge; the neck `edge` wider than the outer strings either side, ending `end`
   * past the last fret; the headstock `head` long and `headWide` across.
   */
  scale: 0.9, nut: 0.02, bridge: 0.024, edge: 0.012, end: 0.02, head: 0.17, headWide: 0.11,
  /** How high the guitar's face is over the top (its body's, its fretboard's), and its strings over that. */
  body: 0.04, string: 0.008,
  /** The bridge: from `before` the strings' end to `after` it; a palm laid there mutes them. */
  bridgeZone: Object.freeze({ before: 0.008, after: 0.035 }),
  /** The chord buttons: `w` across and `d` deep, `gap` apart, their tops `rise` over the top, from `from` along it and `behind` the neck. */
  chord: Object.freeze({ w: 0.064, d: 0.042, gap: 0.007, rise: 0.012, from: 0.08, behind: 0.024 }),
  /** The guitar's knobs (VOLUME, TONE) on its body: each one's radius and height. */
  knob: Object.freeze({ r: 0.02, h: 0.02 }),
  /** The amp's knobs on the panel: each one's radius and height, `spacing` apart, from `from` along it, `b` up it. */
  amp: Object.freeze({ r: 0.026, h: 0.026, spacing: 0.11, from: 0.5, b: 0.1 }),
  /** The pickup switch: its slot `long` along the body and `wide` across. */
  switch: Object.freeze({ long: 0.075, wide: 0.026 }),
  /** The panel: `height` up its face, leaning back `lean`, `thick`. */
  panel: Object.freeze({ height: 0.25, lean: 0.35, thick: 0.04 }),
  /** The top's front edge `front` high, leaning back by `tilt`, `thick`, `margin` round the guitar; its panel's back `wall` from the wall; its left end `gap` from the rack's front. */
  front: 0.9, tilt: 0.25, thick: 0.05, margin: 0.04, wall: 0.08, gap: 0.6,
  /** The sign over it on the wall, as wide as it: from `bottom` to `top` high, `out` from the wall. */
  sign: Object.freeze({ bottom: 1.42, top: 1.74, out: 0.012 }),
});

/**
 * The body's outline, round from its tail: each point `u` along it from the bridge (towards the neck
 * less) and `w` across from the strings' middle (the high E's side more), a double cutaway's, its
 * longer horn on the low E's side; its neck pocket under the neck's end.
 * @type {readonly (readonly [number, number])[]}
 */
export const BODY = Object.freeze([
  [0.15, 0], [0.145, 0.06], [0.125, 0.12], [0.09, 0.17], [0.04, 0.2], [-0.02, 0.21], [-0.08, 0.2], [-0.13, 0.175],
  [-0.17, 0.15], [-0.21, 0.145], [-0.26, 0.155], [-0.31, 0.155], [-0.36, 0.14], [-0.4, 0.12], [-0.425, 0.1], [-0.43, 0.085],
  [-0.42, 0.075], [-0.4, 0.072], [-0.4, -0.072], [-0.42, -0.075], [-0.44, -0.08], [-0.465, -0.095], [-0.475, -0.12],
  [-0.465, -0.145], [-0.44, -0.16], [-0.4, -0.17], [-0.35, -0.175], [-0.29, -0.165], [-0.23, -0.15], [-0.18, -0.15],
  [-0.13, -0.175], [-0.08, -0.2], [-0.02, -0.21], [0.04, -0.2], [0.09, -0.17], [0.125, -0.12], [0.145, -0.06],
].map(([u, w]) => Object.freeze(/** @type {[number, number]} */ ([u, w]))));

/** Where the guitar's own knobs are on its body: u from the bridge, w across from the strings' middle. */
const ON_BODY = Object.freeze({ volume: [0, 0.135], tone: [0.055, 0.15] });

/**
 * How far across its string a finger pressing it may move before it bends it, and how far more bends
 * it a semitone, in the string's spacings.
 */
export const BEND = Object.freeze({ dead: 0.2, per: 0.5 });

/**
 * A chord button: the chord (guitar.js CHORDS's index), where on the top.
 * @typedef {{ chord: number, a0: number, a1: number, b0: number, b1: number }} ChordButton
 */

/**
 * A knob: the knob it turns (guitar.js), on the guitar's body (the top) or the amp's panel, where.
 * @typedef {{ id: GuitarKnob, on: 'top' | 'panel', label: string, a: number, b: number }} GuitarDial
 */

/**
 * The guitar's desk against the right wall, its left end GUITAR.gap from the rack's front (its
 * `place`: where in the room its own frame's origin is, and how it is turned), laid out in its own
 * frame: its footprint, its top and panel as a Desk (board.js); the guitar on the top (its middle
 * line `mid`, its nut and bridge along it, each fret's place, the headstock's and the neck's ends, the
 * body's place (`body`: where its outline's u is 0), the pickups'); the chord buttons, the knobs (the
 * guitar's on the top, the amp's on the panel, in guitar.js GUITAR_KNOBS's order), the pickup switch
 * (its three places along its slot); on the panel the display and what is written there; and its sign.
 * @param {{ x1: number }} L the room's layout (room.js layoutRoom): its right wall
 * @param {{ zFront: number }} rack the rack's (rackboard.js layoutRack)
 */
export function layoutGuitar(L, rack) {
  const { scale, head, end, chord: C, amp: A, panel, tilt, front, wall, margin } = GUITAR;
  const nut = margin + head, bridge = nut + scale;
  /** @type {number[]} each fret's place along the top, the nut's (0) first */
  const frets = Array.from({ length: FRETS + 1 }, (_, f) => nut + scale * (1 - 2 ** (-f / 12)));
  const width = bridge + Math.max(...BODY.map((p) => p[0])) + margin;
  const half = Math.max(...BODY.map((p) => Math.abs(p[1])));
  const mid = margin + half, length = mid + half + margin;
  const cos = Math.cos(tilt), sin = Math.sin(tilt), lc = Math.cos(panel.lean), ls = Math.sin(panel.lean);
  // In its own frame, from its wall: the panel's back, its foot at the top's back edge, the top's front edge.
  const zBack = wall, zFoot = zBack + panel.thick * lc + panel.height * ls, zFront = zFoot + length * cos;
  const top = front + length * sin;
  // The chord buttons behind the neck, the first row (1–8) the further.
  const neckFar = mid + 2.5 * GUITAR.nut + GUITAR.edge;
  /** @type {ChordButton[]} */
  const chords = CHORDS.map((_, i) => {
    const row = i < 8 ? 1 : 0, a0 = C.from + (i % 8) * (C.w + C.gap), b0 = neckFar + C.behind + row * (C.d + C.gap);
    return { chord: i, a0, a1: a0 + C.w, b0, b1: b0 + C.d };
  });
  /** @type {GuitarDial[]} */
  const dials = [];
  for (const k of GUITAR_KNOBS) {
    if (k.section === 'guitar') {
      const [u, w] = ON_BODY[/** @type {'volume' | 'tone'} */ (k.id)];
      dials.push({ id: k.id, on: 'top', label: k.label, a: bridge + u, b: mid + w });
    } else dials.push({ id: k.id, on: 'panel', label: k.label, a: A.from + (dials.length - 2) * A.spacing, b: A.b });
  }
  const ampA0 = A.from - A.spacing / 2, ampA1 = ampA0 + (dials.length - 2) * A.spacing;
  return {
    x0: 0, x1: width, zBack, zFront, width, length, tilt, front, top,
    /** @type {[number, number, number]} */
    origin: [0, front, zFront],
    /** @type {[number, number, number]} */
    up: [0, sin, -cos],
    /** @type {[number, number, number]} */
    normal: [0, cos, sin],
    /** where its own frame is in the room: its origin (x, z) and how it is turned (yaw, as the room's: at −π/2 its −z is the room's +x) */
    place: { x: L.x1, z: rack.zFront + GUITAR.gap, yaw: -Math.PI / 2 },
    mid,
    nut,
    bridge,
    frets,
    /** where the neck ends along the top, under the body */
    neckEnd: frets[FRETS] + end,
    /** where the headstock begins along the top */
    headEnd: margin,
    /** where the body's outline (BODY) is: its u from the bridge */
    body: bridge,
    /** the pickups along the top, where strings.js hears them */
    pickups: { neck: bridge - PICKUP_PLACES.neck * scale, bridge: bridge - PICKUP_PLACES.bridge * scale },
    chords,
    /** where the chord buttons are drawn, all of them */
    deck: { a0: C.from - 0.012, a1: chords[7].a1 + 0.012, b0: chords[8].b0 - 0.012, b1: chords[0].b1 + 0.012 },
    dials,
    /** the pickup switch's slot: its places NECK, BOTH, BRIDGE along it (guitar.js PICKUPS), past the high E */
    switch: { a0: bridge - 0.115, a1: bridge - 0.115 + GUITAR.switch.long, b0: mid + 0.112, b1: mid + 0.112 + GUITAR.switch.wide },
    panel: {
      /** @type {[number, number, number]} */
      origin: [0, top, zFoot],
      /** @type {[number, number, number]} */
      up: [0, lc, -ls],
      /** @type {[number, number, number]} */
      normal: [0, ls, lc],
      height: panel.height, lean: panel.lean, top: top + panel.height * lc,
      display: { a0: 0.04, a1: 0.4, b0: 0.025, b1: 0.125 },
      /** the amp's knobs' span, and what is written over them */
      amp: { a0: ampA0, a1: ampA1 },
      titles: [{ text: 'AMP', a: (ampA0 + ampA1) / 2, b: panel.height - 0.03 }],
    },
    sign: { x0: 0, x1: width, y0: GUITAR.sign.bottom, y1: GUITAR.sign.top, z: GUITAR.sign.out },
  };
}

/** The guitar's desk as layoutGuitar lays it out. @typedef {ReturnType<typeof layoutGuitar>} GuitarDesk */

// ── Its own frame and the room's ────────────────────────────────────────────

/** A point in the room (x, z) in the desk's own frame: [along it, out from its wall]. @param {GuitarDesk} G @param {number} x @param {number} z @returns {[number, number]} */
export const deskXZ = (G, x, z) => [z - G.place.z, G.place.x - x];
/** A point in the desk's own frame (x, z) in the room. @param {GuitarDesk} G @param {number} x @param {number} z @returns {[number, number]} */
export const roomXZ = (G, x, z) => [G.place.x - z, G.place.z + x];

/**
 * Where a point in the room is on the top: `a` along it, `b` up it, `h` over the strings (below them:
 * < 0), written into out.
 * @param {GuitarDesk} G
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {{ a: number, b: number, h: number }} [out]
 */
export function guitarPoint(G, x, y, z, out = { a: 0, b: 0, h: 0 }) {
  const lx = z - G.place.z, lz = G.place.x - x;
  const [Ox, Oy, Oz] = G.origin, [, Uy, Uz] = G.up, [, Ny, Nz] = G.normal;
  out.a = lx - Ox;
  out.b = (y - Oy) * Uy + (lz - Oz) * Uz;
  out.h = (y - Oy) * Ny + (lz - Oz) * Nz - GUITAR.body - GUITAR.string;
  return out;
}

// ── The strings and the frets ───────────────────────────────────────────────

/** How far apart the strings are at `a` along the top: from the nut's spacing to the bridge's. @param {GuitarDesk} G @param {number} a */
export const spacingAt = (G, a) => GUITAR.nut + (GUITAR.bridge - GUITAR.nut) * clamp((a - G.nut) / GUITAR.scale, 0, 1);

/** Where string s (0 the low E) is up the top at `a` along it. @param {GuitarDesk} G @param {number} s @param {number} a */
export const stringB = (G, s, a) => G.mid + (s - 2.5) * spacingAt(G, a);

/** How far either side of the strings' middle the neck reaches at `a`. @param {GuitarDesk} G @param {number} a */
export const neckHalf = (G, a) => 2.5 * spacingAt(G, a) + GUITAR.edge;

/**
 * The fret a finger at `a` along the neck presses a string at (1 behind the first fret… FRETS), 0
 * behind the nut, -1 past the last fret.
 * @param {GuitarDesk} G
 * @param {number} a
 */
export function fretAt(G, a) {
  if (a <= G.frets[0]) return 0;
  for (let f = 1; f <= FRETS; f++) if (a <= G.frets[f]) return f;
  return -1;
}

/** Where a finger presses fret f, along the neck: a little behind its wire, as a guitarist's does. @param {GuitarDesk} G @param {number} f */
export const fretPlace = (G, f) => (f <= 0 ? G.nut : G.frets[f] - 0.3 * (G.frets[f] - G.frets[f - 1]));

/**
 * The string nearest (a, b) on the top, and how far across from it (in its spacings, the high E's
 * side more), written into out; out.string -1 where (a, b) is past the outer strings by more than
 * `beyond` spacings.
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 * @param {{ string: number, across: number }} [out]
 * @param {number} [beyond]
 */
export function stringAt(G, a, b, out = { string: -1, across: 0 }, beyond = 0.75) {
  const x = (b - G.mid) / spacingAt(G, a) + 2.5;
  const s = Math.min(5, Math.max(0, Math.round(x))); // Math.max, not clamp: +0, never -0
  out.across = x - s;
  out.string = Math.abs(out.across) <= (s === 0 || s === 5 ? beyond : 0.5) ? s : -1;
  return out;
}

/** Where the pick meets the strings at `a` along the top, of their length from the bridge (strings.js PICK). @param {GuitarDesk} G @param {number} a */
export const pickAt = (G, a) => clamp((G.bridge - a) / GUITAR.scale, PICK.min, PICK.max);

/**
 * How far a string pressed is bent (semitones, 0…MAX_BEND) by a finger moved `across` its spacings
 * from it, either way: none within BEND.dead, a semitone each BEND.per further.
 * @param {number} across
 */
export const bendFor = (across) => clamp((Math.abs(across) - BEND.dead) / BEND.per, 0, MAX_BEND);

/**
 * The strings a pick moving over them from (a0, b0) to (a1, b1) on the top crosses, in the order it
 * crosses them: their indices written into `strings`, how far along the move each is (0…1) into
 * `when`; how many. Away from the player (towards the high E) a down strum's way.
 * @param {GuitarDesk} G
 * @param {number} a0
 * @param {number} b0
 * @param {number} a1
 * @param {number} b1
 * @param {number[]} strings
 * @param {number[]} when
 */
export function strummed(G, a0, b0, a1, b1, strings, when) {
  const x0 = (b0 - G.mid) / spacingAt(G, a0) + 2.5, x1 = (b1 - G.mid) / spacingAt(G, a1) + 2.5;
  let n = 0;
  if (!(x1 !== x0)) return 0;
  const down = x1 > x0;
  for (let k = 0; k < 6; k++) {
    const s = down ? k : 5 - k;
    if (down ? x0 < s && s <= x1 : x1 <= s && s < x0) {
      strings[n] = s;
      when[n] = (s - x0) / (x1 - x0);
      n++;
    }
  }
  return n;
}

/**
 * Whether (a, b) on the top is in the body's outline (BODY, laid at G.body).
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 */
export function onBody(G, a, b) {
  const u = a - G.body, w = b - G.mid;
  let inside = false;
  for (let i = 0, j = BODY.length - 1; i < BODY.length; j = i++) {
    const [ui, wi] = BODY[i], [uj, wj] = BODY[j];
    if (wi > w !== wj > w && u < ((uj - ui) * (w - wi)) / (wj - wi) + ui) inside = !inside;
  }
  return inside;
}

/**
 * Which part of the guitar (a, b) on the top is on: 'head' (the headstock), 'fret' (the strings over
 * the neck, up to its last fret), 'strum' (over the strings from there to the bridge), 'mute' (the
 * bridge), 'body' (the rest of it); else ''.
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 */
export function partAt(G, a, b) {
  const across = Math.abs(b - G.mid);
  if (a >= G.headEnd && a < G.nut) return across <= GUITAR.headWide / 2 ? 'head' : '';
  const z = GUITAR.bridgeZone;
  if (a >= G.nut && a <= G.bridge + z.after && across <= neckHalf(G, a)) return a <= G.frets[FRETS] ? 'fret' : a < G.bridge - z.before ? 'strum' : 'mute';
  return onBody(G, a, b) ? 'body' : '';
}

/**
 * The pickup switch's place at (a, b) on the top (guitar.js PICKUPS's index), else -1.
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 */
export function switchAt(G, a, b) {
  const s = G.switch, pad = 0.008;
  if (a < s.a0 - pad || a > s.a1 + pad || b < s.b0 - pad || b > s.b1 + pad) return -1;
  return clamp(Math.floor(((a - s.a0) / (s.a1 - s.a0)) * PICKUPS.length), 0, PICKUPS.length - 1);
}

/** Where along the switch's slot its lever is at a pickup's place (PICKUPS's index). @param {GuitarDesk} G @param {number} i */
export const switchA = (G, i) => G.switch.a0 + ((i + 0.5) / PICKUPS.length) * (G.switch.a1 - G.switch.a0);

/**
 * The knob at (a, b) on the top or the panel (a little larger than it): its index in G.dials, else -1.
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 * @param {'top' | 'panel'} on
 */
export function guitarDialAt(G, a, b, on) {
  const r = (on === 'top' ? GUITAR.knob.r : GUITAR.amp.r) * 1.3;
  for (let d = 0; d < G.dials.length; d++) {
    const n = G.dials[d];
    if (n.on === on && (a - n.a) ** 2 + (b - n.b) ** 2 <= r * r) return d;
  }
  return -1;
}

/**
 * The chord button at (a, b) on the top: its index in G.chords (CHORDS's), else -1.
 * @param {GuitarDesk} G
 * @param {number} a
 * @param {number} b
 */
export function chordAt(G, a, b) {
  for (let i = 0; i < G.chords.length; i++) {
    const c = G.chords[i];
    if (a >= c.a0 && a <= c.a1 && b >= c.b0 && b <= c.b1) return i;
  }
  return -1;
}

// ── A ray, walking round it, standing at it ─────────────────────────────────

/**
 * Where a ray in the room meets the plane of the strings, ahead of it, written into out: `a` along
 * the top, `b` up it, `t` along the ray; null where it doesn't (a pointer dragged over the strings,
 * which may be off the guitar).
 * @param {GuitarDesk} G
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {{ a: number, b: number, t: number }} [out]
 */
export function stringsAlong(G, ox, oy, oz, dx, dy, dz, out = { a: 0, b: 0, t: 0 }) {
  // The ray in the desk's frame.
  const lz = G.place.x - ox, ldz = -dx;
  const [Ox, Oy, Oz] = G.origin, [, Uy, Uz] = G.up, [, Ny, Nz] = G.normal, dn = dy * Ny + ldz * Nz;
  if (!(dn < 0)) return null;
  const rise = GUITAR.body + GUITAR.string, t = ((Oy + Ny * rise - oy) * Ny + (Oz + Nz * rise - lz) * Nz) / dn;
  if (!(t > 0)) return null;
  out.a = oz - G.place.z + dz * t - Ox;
  out.b = (oy + dy * t - Oy) * Uy + (lz + ldz * t - Oz) * Uz;
  out.t = t;
  return out;
}

/** Where the last ray met the desk (hitGuitar's), kept to write no new object per ray. @type {import('./board.js').DeskHit} */
const MET = { on: '', t: 0, a: 0, b: 0, nx: 0, ny: 0, nz: 0 };
/** Where it met the strings' plane. */
const ALONG = { a: 0, b: 0, t: 0 };
/** @type {{ string: number, across: number }} */
const NEAR = { string: -1, across: 0 };

/**
 * What a ray in the room meets on the guitar's desk, if nearer than `within`: on the guitar (where
 * the ray meets the plane of its strings) the strings over the neck ('fret': `guitar` the string, u
 * the fret, v how far across from the string, in spacings), over the body ('strum': `guitar` the
 * string nearest, u where the pick meets it, v likewise), the bridge ('mute'), a knob ('guitarknob':
 * `guitar` its index in G.dials), the pickup switch ('pickup': `guitar` the place under it); on the
 * top a chord button ('chord': `guitar` its index); on the panel an amp's knob ('guitarknob'); or the
 * rest of it ('guitar': the guitar elsewhere, its top, its panel, its front, its sides, its sign),
 * written into out as room.js castRay writes a hit (the other desks' -1). Whether it met the desk.
 * @param {GuitarDesk} G
 * @param {number} ox
 * @param {number} oy
 * @param {number} oz
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {import('./board.js').BandHit} out
 * @param {number} [within]
 */
export function hitGuitar(G, ox, oy, oz, dx, dy, dz, out, within = Infinity) {
  let kind = 'guitar', index = -1, u = 0, v = 0;
  const at = stringsAlong(G, ox, oy, oz, dx, dy, dz, ALONG), part = at && at.t < within ? partAt(G, at.a, at.b) : '';
  if (at && part) {
    const { a, b } = at;
    MET.on = 'top';
    MET.t = at.t;
    MET.a = a;
    MET.b = b;
    MET.nx = 0;
    MET.ny = G.normal[1];
    MET.nz = G.normal[2];
    if (part === 'fret' || part === 'strum') {
      stringAt(G, a, b, NEAR);
      if (NEAR.string >= 0) {
        kind = part;
        index = NEAR.string;
        u = part === 'fret' ? Math.max(1, fretAt(G, a)) : pickAt(G, a);
        v = NEAR.across;
      }
    } else if (part === 'mute') kind = 'mute';
    else if (part === 'body') {
      if ((index = guitarDialAt(G, a, b, 'top')) >= 0) kind = 'guitarknob';
      else if ((index = switchAt(G, a, b)) >= 0) kind = 'pickup';
    }
  } else {
    // The ray in the desk's frame, onto its top, its panel and the rest of it.
    if (!meetDesk(G, oz - G.place.z, oy, G.place.x - ox, dz, dy, -dx, within, GUITAR.chord.rise, MET)) return false;
    if (MET.on === 'top' && (index = chordAt(G, MET.a, MET.b)) >= 0) kind = 'chord';
    else if (MET.on === 'panel' && (index = guitarDialAt(G, MET.a, MET.b, 'panel')) >= 0) kind = 'guitarknob';
  }
  writeHit(out, MET, kind, ox, oy, oz, dx, dy, dz, u, v);
  // Its way out, turned into the room's (0, not -0, along the right wall).
  out.nx = MET.nz ? -MET.nz : 0;
  out.ny = MET.ny;
  out.nz = MET.nx;
  out.pad = out.step = out.knob = out.jack = out.key = out.dial = out.button = out.seq = out.rack = out.keys = -1;
  out.guitar = kind === 'guitar' || kind === 'mute' ? -1 : index;
  return true;
}

/**
 * Whether (x, z) in the room is too near the guitar's desk to stand at: on it, or within board.js's
 * `keep` of its front or its ends.
 * @param {GuitarDesk} G
 * @param {number} x
 * @param {number} z
 */
export function guitarBlocks(G, x, z) {
  return boardBlocks(G, z - G.place.z, G.place.x - x);
}

/** @type {{ x: number, z: number }} */
const CLAMPED = { x: 0, z: 0 };

/**
 * The nearest place to (x, z) in the room a head coming from (fx, fz) may be, round the guitar's desk
 * (board.js clampBoard's, in its frame). Writes { x, z } into out.
 * @param {GuitarDesk} G
 * @param {number} fx
 * @param {number} fz
 * @param {number} x
 * @param {number} z
 * @param {{ x: number, z: number }} [out]
 */
export function clampGuitar(G, fx, fz, x, z, out = { x: 0, z: 0 }) {
  clampBoard(G, fz - G.place.z, G.place.x - fx, z - G.place.z, G.place.x - x, CLAMPED);
  out.x = G.place.x - CLAMPED.z;
  out.z = G.place.z + CLAMPED.x;
  return out;
}

/**
 * Where to stand to play the guitar on a screen (board.js boardFront's, in its frame, `free` asked in
 * the room's): in the room, facing it.
 * @param {GuitarDesk} G
 * @param {{ fov?: number, aspect?: number, fill?: number, over?: import('./board.js').Rect[], free?: (x: number, z: number) => boolean }} [o]
 */
export function guitarFront(G, { free = () => true, ...o } = {}) {
  const at = boardFront(G, { ...o, h: GUITAR.body + GUITAR.knob.h, free: (lx, lz) => free(G.place.x - lz, G.place.z + lx) });
  return { x: G.place.x - at.z, z: G.place.z + at.x, yaw: G.place.yaw + at.yaw, pitch: at.pitch };
}

/**
 * Where to stand to play it in VR: `back` from its front edge, at `a` along it (by default the neck's
 * end: the neck to the left, the strings over the body to the right), facing it.
 * @param {GuitarDesk} G
 * @param {number} [back]
 * @param {number} [a]
 */
export function guitarStand(G, back = 0.3, a = G.neckEnd) {
  const at = boardStand(G, back, a);
  return { x: G.place.x - at.z, z: G.place.z + at.x, yaw: G.place.yaw };
}
