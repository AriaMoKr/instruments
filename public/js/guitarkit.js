// The guitar in 3D (guitarboard.js lays it out on its desk, guitar.js says what is on it), as the
// keyboard is (keyskit.js), on the first desk that is turned: what is lit as the room is (scene.js's
// bake, once, into vertex colours) is laid out in the desk's own frame and turned into the room's
// before its light is baked; the rest stands in a group turned as the desk is. Its stand, top and
// panel; the guitar lying on its back on the top: its body (a sunburst, a cream pickguard, two
// pickups, the bridge with a saddle for each string), its neck (rosewood with its frets and its
// inlays, the nut) and its headstock (maple, its pegs, the strings round them); the strings, one
// instanced mesh, each lit in the room's glow as it rings and blurred wider (still, with less motion);
// a dot over each string where it is fretted (the chord's in gold, a finger's in the room's glow, a
// cross behind the nut where the chord mutes it) and a pale one where a pointer would press; the
// chord buttons behind the neck, each with its chord and its key, and a light on the chord chosen; the
// guitar's knobs and its pickup switch's lever on the body, the amp's knobs and the pedals' on the
// panel, each with a line that shows where it is turned to, and each pedal's footswitch and its light,
// lit while it is on; on one canvas, drawn once, what is on the top and the panel's face (its jacks,
// as the board's, PATCH over them; the display's frame; the amp's knobs' names and their scales, AMP
// over them; the four pedals, each in its colour, its name, its knob's scale and name); the display
// (the chord, the pickup, how the amp sounds, the pedals on, the knob turned last), redrawn when it
// changes, at most ten times a second; and its sign on the wall over it. Its cables are kit.js's. In VR
// a stick's tip (kit.js's sticks, which show near it too) or a forefinger is a pick over the body,
// plucking each string it crosses as fast as it goes, and a finger on the neck, pressing a string at a
// fret, sliding along it and bending it across, and letting it go as it lifts; coming down on the
// bridge it mutes the strings, on a chord button it chooses that chord. Per frame nothing is
// allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, REARM, boardPoint, panelPoint, strikeVelocity } from './board.js';
import { BODY, GUITAR, bendFor, chordAt, fretAt, fretPlace, guitarPoint, neckHalf, partAt, pickAt, spacingAt, stringAt, stringB, strummed, switchA } from './guitarboard.js';
import { CHORDS, CHORD_KEYS, DEFAULT_GUITAR, FRETS, PEDALS, PICKUPS, ampWords, guitarKnobName } from './guitar.js';
import { JACKS } from './patch.js';
import { STICK, canvas, context, drawJack, drawPlate, fit, lin, signPlate, texture, times } from './kit.js';
import { GOLD, SANS } from './textures.js';

/** @typedef {import('./guitarboard.js').GuitarDesk} GuitarDesk */
/** @typedef {import('./guitar.js').GuitarKnob} GuitarKnob */
/** @typedef {import('./guitar.js').GuitarKnobs} GuitarKnobs */
/** @typedef {import('./guitar.js').Pickup} Pickup */
/** @typedef {import('./guitar.js').PedalId} PedalId */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */
/**
 * A tip that plays the guitar in VR (a stick's, a forefinger): where it was last frame on the top (a,
 * b) and over the strings (h), the string it presses (-1 none) and at which fret, and whether it is
 * up off the chord buttons, so that coming down on one chooses it.
 * @typedef {{ has: boolean, a: number, b: number, h: number, string: number, fret: number, armed: boolean }} GuitarTip
 */

const WOOD = lin('#3b2a1d'), RIM = lin('#151413');
/** The guitar's parts (linear): its sides, the neck's, the headstock's, the nut, the frets, the pickups' covers, the bridge and its saddles. */
const PART = {
  side: lin('#2a1208'), neck: lin('#b88c56'), head: lin('#c49a62'), nut: lin('#e9e1cc'), fret: lin('#c8c3ba'),
  pickup: lin('#ece6d6'), bridge: lin('#b9b4ab'), saddle: lin('#d6d1c8'),
};
/** The strings (linear): plain and wound; and the room's glow one takes as it rings. */
const STEEL = lin('#cfccc4'), WOUND = lin('#ada79c'), GLOW = lin('#5cc8a8');
/** Each string's thickness, the low E's first, and how much wider one ringing at its hardest is drawn. */
const GAUGE = [0.0026, 0.0022, 0.0019, 0.0015, 0.0012, 0.001], BLUR = 0.004;
/** The dots (linear): where the chord frets a string, where a finger presses one, where the chord mutes one, and where a pointer would press. */
const DOT = { chord: lin('#e9c46a'), finger: lin('#5cc8a8'), muted: lin('#d9573b'), hover: lin('#f4efe4') };
/** The chord buttons' lights: off, on (linear); and the pedals': off, on. */
const LIGHT = { off: lin('#2a1d18'), on: lin('#f2b648') };
const LED = { off: lin('#3a1613'), on: lin('#ff4636') };
/**
 * The knobs (linear): the guitar's (cream, a dark line), the amp's (black, a cream line) and the
 * pedals' (as the guitar's); the pickup switch's lever; the pedals' footswitches.
 */
const KNOB = {
  guitar: lin('#e8dfc9'), guitarMark: lin('#2a2420'), amp: lin('#1c1a18'), ampMark: lin('#efe5cf'),
  pedal: lin('#e8dfc9'), pedalMark: lin('#2a2420'), lever: lin('#1c1a18'), stomp: lin('#cdc9c1'),
};
/** Each pedal's colour, and its writing's. @type {Readonly<Record<PedalId, { body: string, ink: string }>>} */
const PEDAL_LOOK = {
  wah: { body: '#262523', ink: '#efe5cf' },
  overdrive: { body: '#276b3b', ink: '#efe5cf' },
  chorus: { body: '#285c94', ink: '#efe5cf' },
  tremolo: { body: '#e0802f', ink: '#1c1a18' },
};
/** How high the body's sides start over the top, how high the headstock's face is, and the fretboard's over the body's. */
const UNDER = 0.003, HEAD = 0.028, BOARD_UP = 0.001;
/** The headstock's pegs: how far in from its near edge, the first's place from its end, and how far apart. */
const PEGS = { w: 0.04, first: 0.022, pitch: 0.021 };
/**
 * The pickguard: its outline as BODY's (u from the bridge, w across), round the pickups and past the
 * high E round the knobs and the switch.
 */
const PICKGUARD = [
  [-0.4, 0.072], [-0.37, 0.105], [-0.3, 0.12], [-0.22, 0.118], [-0.15, 0.13], [-0.1, 0.152], [-0.04, 0.17], [0.03, 0.178],
  [0.085, 0.165], [0.105, 0.135], [0.09, 0.105], [0.04, 0.095], [-0.02, 0.09], [-0.03, 0.07], [-0.03, -0.07], [-0.05, -0.1],
  [-0.12, -0.115], [-0.22, -0.11], [-0.3, -0.12], [-0.37, -0.105], [-0.4, -0.072],
];
/** In VR: how far back over the strings a finger pressing one lifts to let it go; how near over them (or under) a pick plays them, and how far under them it is through the guitar; a move too far in a frame to be one. */
const LIFT = 0.004, TOUCH = 0.012, DEEP = 0.03, JUMP = 0.15;
/** The canvas drawn once: this many pixels across the desk. */
const ATLAS = 2560;

/**
 * A block standing on the top in its frame (P: boardPoint's), a0…a1 along it, b0…b1 up it and h0…h1
 * out of it: its top (unless not), front, back and ends (as keyskit.js's).
 * @param {Builder} b
 * @param {(a: number, b: number, h?: number) => number[]} P
 * @param {number[]} N the top's normal
 * @param {number[]} U up the top
 * @param {[number, number, number, number, number, number]} box a0, a1, b0, b1, h0, h1
 * @param {number[]} albedo
 * @param {boolean} [lid] its top too
 */
function block(b, P, N, U, [a0, a1, b0, b1, h0, h1], albedo, lid = true) {
  const w = [a1 - a0, 0, 0], d = times(U, b1 - b0), h = times(N, h1 - h0);
  if (lid) b.quad(P(a0, b0, h1), w, d, { normal: N, albedo });
  b.quad(P(a0, b0, h0), w, h, { normal: times(U, -1), albedo });
  b.quad(P(a0, b1, h0), w, h, { normal: U, albedo });
  b.quad(P(a0, b0, h0), d, h, { normal: [-1, 0, 0], albedo });
  b.quad(P(a1, b0, h0), d, h, { normal: [1, 0, 0], albedo });
}

/**
 * A flat shape on the top (its points round it as [a, b], `h` out of it), triangulated (three's
 * ShapeUtils), facing out of the top, each point's texture coordinates `uv(a, b)`.
 * @param {Builder} b
 * @param {(a: number, b: number, h?: number) => number[]} P
 * @param {number[]} N the top's normal
 * @param {number[][]} points
 * @param {number} h
 * @param {(a: number, b: number) => number[]} uv
 */
function shape(b, P, N, points, h, uv) {
  const base = b.count;
  for (const [a, w] of points) {
    const p = P(a, w, h), t = uv(a, w);
    b.positions.push(p[0], p[1], p[2]);
    b.normals.push(N[0], N[1], N[2]);
    b.uvs.push(t[0], t[1]);
    b.albedo.push(1, 1, 1);
  }
  const pos = b.positions;
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(points.map(([a, w]) => new THREE.Vector2(a, w)), [])) {
    // Wound to face out of the top.
    const o = 3 * (base + i), p = 3 * (base + j), q = 3 * (base + k);
    const ux = pos[p] - pos[o], uy = pos[p + 1] - pos[o + 1], uz = pos[p + 2] - pos[o + 2];
    const vx = pos[q] - pos[o], vy = pos[q + 1] - pos[o + 1], vz = pos[q + 2] - pos[o + 2];
    const out = (uy * vz - uz * vy) * N[0] + (uz * vx - ux * vz) * N[1] + (ux * vy - uy * vx) * N[2];
    if (out >= 0) b.indices.push(base + i, base + j, base + k);
    else b.indices.push(base + i, base + k, base + j);
  }
}

/**
 * The way out of an outline's edge from (a0, b0) to (a1, b1) on the top, its points going round it
 * `way` (1 anticlockwise, seen from over the top, a to the right and b up; -1 clockwise).
 * @param {number[]} U up the top
 * @param {number} a0
 * @param {number} b0
 * @param {number} a1
 * @param {number} b1
 * @param {number} way
 */
function outOf(U, a0, b0, a1, b1, way) {
  const n = times(U, -(a1 - a0) * way);
  n[0] += (b1 - b0) * way;
  return n;
}

/**
 * A builder's points and normals, laid out in the desk's own frame, turned into the room's (before its
 * light is baked).
 * @param {Builder} b
 * @param {GuitarDesk} G
 */
function turn(b, G) {
  const p = b.positions, n = b.normals, { x, z } = G.place;
  for (let i = 0; i < p.length; i += 3) {
    const lx = p[i];
    p[i] = x - p[i + 2];
    p[i + 2] = z + lx;
    const nx = n[i];
    n[i] = -n[i + 2];
    n[i + 2] = nx;
  }
  return b;
}

/** The body's outline (BODY), or another as its, on the top: [a, b] round it. @param {GuitarDesk} G @param {readonly (readonly number[])[]} outline */
const onTop = (G, outline) => outline.map(([u, w]) => [G.body + u, G.mid + w]);

/** Where each peg is along the headstock, the low E's at its end. @param {GuitarDesk} G @param {number} s */
const pegA = (G, s) => G.headEnd + PEGS.first + s * PEGS.pitch;

/** The headstock's outline on the top: [a, b] round it, its far corners cut. @param {GuitarDesk} G */
function headstock(G) {
  const hw = GUITAR.headWide / 2, c = 0.016, a0 = G.headEnd, a1 = G.nut, m = G.mid;
  return [[a1, m - hw], [a0 + c, m - hw], [a0, m - hw + c], [a0, m + hw - c], [a0 + c, m + hw], [a1, m + hw]];
}

/** The fretboard's outline on the top: from the nut to the neck's end, as wide as the neck there. @param {GuitarDesk} G */
function fretboard(G) {
  const n0 = neckHalf(G, G.nut), n1 = neckHalf(G, G.neckEnd);
  return [[G.nut, G.mid - n0], [G.neckEnd, G.mid - n1], [G.neckEnd, G.mid + n1], [G.nut, G.mid + n0]];
}

/**
 * What is drawn once, on one canvas: the top (the desk round the guitar, CHORDS over the chord buttons,
 * each with its chord and its key; the headstock with its pegs and the strings round them, the
 * fretboard with its inlays, the body's sunburst, the pickguard, the switch's slot and the names of
 * the knobs and its places) over the panel's face (its jacks, PATCH over them; the display's frame,
 * its own name; AMP over the amp's knobs, each one's scale and name; the pedals). `top` and `panel`:
 * how many of its rows each takes.
 * @param {GuitarDesk} G
 */
function faces(G) {
  const W = G.width, D = G.length, P = G.panel, k = ATLAS / W;
  const th = Math.round(D * k), ph = Math.round(P.height * k);
  const c = canvas(ATLAS, th + ph), g = context(c);
  const x = (/** @type {number} */ a) => a * k;
  const topY = (/** @type {number} */ b) => (D - b) * k;
  const panelY = (/** @type {number} */ b) => th + (P.height - b) * k;
  /** @param {number[][]} points [a, b] on the top */
  const path = (points) => {
    g.beginPath();
    points.forEach(([a, b], i) => (i ? g.lineTo(x(a), topY(b)) : g.moveTo(x(a), topY(b))));
    g.closePath();
  };
  g.fillStyle = '#23211f';
  g.fillRect(0, 0, ATLAS, th);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  // The chord buttons: CHORDS over them, each cap with its chord and, small in its corner, its key.
  const deck = G.deck;
  g.fillStyle = GOLD;
  g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
  g.fillText('CHORDS', x((deck.a0 + deck.a1) / 2), topY(deck.b1 + 0.022));
  for (const cb of G.chords) {
    const bx = x(cb.a0), by = topY(cb.b1), bw = x(cb.a1) - bx, bh = topY(cb.b0) - by;
    g.fillStyle = '#3d3934';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(bx, by + bh - 5, bw, 5);
    g.fillStyle = '#efe5cf';
    const label = CHORDS[cb.chord].label;
    fit(g, label, bw - 20, Math.round(0.019 * k), '700');
    g.fillText(label, bx + bw / 2, by + bh * 0.56);
    g.fillStyle = 'rgba(239,229,207,0.6)';
    g.font = `600 ${Math.round(0.0075 * k)}px ${SANS}`;
    g.textAlign = 'left';
    g.fillText(CHORD_KEYS[cb.chord].replace(/^(Digit|Key)/, ''), bx + 8, by + 0.0075 * k);
    g.textAlign = 'center';
  }

  // The headstock: maple, its pegs along its near edge, each string from the nut round its peg.
  path(headstock(G));
  g.fillStyle = '#d6b27a';
  g.fill();
  g.strokeStyle = '#8f6c3e';
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = '#d9d5cc';
  g.lineWidth = 2;
  for (let s = 0; s < 6; s++) {
    g.beginPath();
    g.moveTo(x(G.nut), topY(stringB(G, s, G.nut)));
    g.lineTo(x(pegA(G, s)), topY(G.mid - PEGS.w));
    g.stroke();
  }
  for (let s = 0; s < 6; s++) {
    g.fillStyle = '#cfcac0';
    g.beginPath();
    g.arc(x(pegA(G, s)), topY(G.mid - PEGS.w), 0.0062 * k, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = '#8d877d';
    g.beginPath();
    g.arc(x(pegA(G, s)), topY(G.mid - PEGS.w), 0.0024 * k, 0, 2 * Math.PI);
    g.fill();
  }
  g.fillStyle = 'rgba(42,24,12,0.75)';
  g.font = `italic 600 ${Math.round(0.011 * k)}px ${SANS}`;
  g.fillText('Band Room', x((G.headEnd + G.nut) / 2 + 0.01), topY(G.mid + 0.022));

  // The body: a sunburst, amber in the middle, dark at its edge; its pickguard; the switch's slot.
  path(onTop(G, BODY));
  const burst = g.createRadialGradient(x(G.body - 0.13), topY(G.mid), 0, x(G.body - 0.13), topY(G.mid), 0.36 * k);
  burst.addColorStop(0, '#f0b04a');
  burst.addColorStop(0.42, '#d47a26');
  burst.addColorStop(0.7, '#8a2f12');
  burst.addColorStop(0.88, '#3a1408');
  burst.addColorStop(1, '#1c0904');
  g.fillStyle = burst;
  g.fill();
  path(onTop(G, PICKGUARD));
  g.fillStyle = '#efe8d9';
  g.fill();
  g.strokeStyle = '#c4b9a3';
  g.lineWidth = 3;
  g.stroke();
  // Its screws, a little in from its edge.
  const cu = PICKGUARD.reduce((s, p) => s + p[0], 0) / PICKGUARD.length, cw = PICKGUARD.reduce((s, p) => s + p[1], 0) / PICKGUARD.length;
  g.fillStyle = '#a39b8e';
  for (const i of [1, 4, 7, 9, 13, 16, 19]) {
    const [u, w] = PICKGUARD[i], d = Math.hypot(cu - u, cw - w), inset = 0.009 / d;
    g.beginPath();
    g.arc(x(G.body + u + (cu - u) * inset), topY(G.mid + w + (cw - w) * inset), 0.0022 * k, 0, 2 * Math.PI);
    g.fill();
  }
  const sw = G.switch, mid = (sw.b0 + sw.b1) / 2;
  g.fillStyle = '#1a1816';
  g.beginPath();
  g.roundRect(x(sw.a0), topY(mid + 0.0035), x(sw.a1) - x(sw.a0), 0.007 * k, 0.0035 * k);
  g.fill();
  g.fillStyle = '#5a5248';
  g.font = `600 ${Math.round(0.0052 * k)}px ${SANS}`;
  PICKUPS.forEach((p, i) => g.fillText(p.label, x(switchA(G, i)), topY(sw.b0 - 0.007)));
  for (const d of G.dials) if (d.on === 'top') g.fillText(d.label, x(d.a), topY(d.b - GUITAR.knob.r - 0.008));

  // The fretboard: rosewood, its inlays between the frets, two at the twelfth.
  path(fretboard(G));
  g.fillStyle = '#3b2417';
  g.fill();
  g.fillStyle = '#e8dfc8';
  for (const f of [3, 5, 7, 9, 12, 15]) {
    const a = (G.frets[f - 1] + G.frets[f]) / 2, sp = spacingAt(G, a);
    for (const w of f === 12 ? [-1.5 * sp, 1.5 * sp] : [0]) {
      g.beginPath();
      g.arc(x(a), topY(G.mid + w), 0.0045 * k, 0, 2 * Math.PI);
      g.fill();
    }
  }

  // The panel, its top edge against the top's back edge in the canvas.
  g.fillStyle = '#1a1917';
  g.fillRect(0, th, ATLAS, ph);
  const S = P.display;
  g.fillStyle = '#0d1714';
  g.strokeStyle = 'rgba(224,187,114,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x(S.a0) - 6, panelY(S.b1) - 6, x(S.a1) - x(S.a0) + 12, panelY(S.b0) - panelY(S.b1) + 12, 12);
  g.fill();
  g.stroke();
  g.fillStyle = GOLD;
  g.font = `italic 600 ${Math.round(0.0125 * k)}px ${SANS}`;
  g.textAlign = 'left';
  g.fillText('Electric guitar', x(S.a0), panelY(S.b1 + 0.045));
  g.textAlign = 'center';
  // AMP over its knobs and PATCH over the jacks, a line along each either side of it, its ends turned
  // down to them.
  g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
  for (const t of P.titles) {
    const ty = panelY(t.b), half = g.measureText(t.text).width / 2 + 12;
    g.fillStyle = GOLD;
    g.fillText(t.text, x(t.a), ty);
    g.strokeStyle = 'rgba(224,187,114,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(t.a0), ty + 8);
    g.lineTo(x(t.a0), ty);
    g.lineTo(x(t.a) - half, ty);
    g.moveTo(x(t.a) + half, ty);
    g.lineTo(x(t.a1), ty);
    g.lineTo(x(t.a1), ty + 8);
    g.stroke();
  }
  // Its jacks, as the board's: its outs on a plate, each with what it is under it.
  drawPlate(g, P.jacks.filter((j) => j.out), x, panelY, k);
  for (const j of P.jacks) {
    drawJack(g, x(j.a), panelY(j.b), BOARD.panel.jack * k);
    g.fillStyle = '#efe5cf';
    g.fillText(JACKS.find((J) => J.id === j.id)?.label ?? '', x(j.a), panelY(j.b - BOARD.panel.jack - 0.011));
  }
  /**
   * A knob's scale round it, 0 to 10, from `inner` to `outer` past its edge (0, 5 and 10 longer).
   * @param {import('./guitarboard.js').GuitarDial} d
   * @param {number} inner
   * @param {number} outer
   */
  const scale = (d, inner, outer) => {
    const cx = x(d.a), cy = panelY(d.b), r0 = (d.r + inner) * k, r1 = (d.r + outer) * k;
    g.beginPath();
    for (let n = 0; n <= 10; n++) {
      const t = (n / 10 - 0.5) * 1.5 * Math.PI, long = n % 5 === 0 ? 1.35 : 1;
      g.moveTo(cx + r0 * Math.sin(t), cy - r0 * Math.cos(t));
      g.lineTo(cx + (r0 + (r1 - r0) * long) * Math.sin(t), cy - (r0 + (r1 - r0) * long) * Math.cos(t));
    }
    g.stroke();
  };
  // Each amp's knob: its scale, and its name under it.
  for (const d of G.dials) {
    if (d.section !== 'amp') continue;
    g.strokeStyle = 'rgba(239,229,207,0.7)';
    g.lineWidth = 3;
    scale(d, 0.005, 0.0095);
    g.fillStyle = '#efe5cf';
    fit(g, d.label, GUITAR.amp.spacing * k - 16, Math.round(0.0095 * k));
    g.fillText(d.label, x(d.a), panelY(d.b - d.r - 0.019));
  }
  // The pedals, each in its colour: its name, its knob's scale and name, its light's bezel, its
  // footswitch's nut, a screw at each corner.
  const E = GUITAR.pedal;
  for (const p of P.pedals) {
    const look = PEDAL_LOOK[p.id], px = x(p.a0), py = panelY(p.b1), pw = x(p.a1) - px, pd = panelY(p.b0) - py, d = G.dials[p.knob];
    g.fillStyle = look.body;
    g.beginPath();
    g.roundRect(px, py, pw, pd, 0.007 * k);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(px + 0.007 * k, py + 2, pw - 0.014 * k, 3);
    g.fillStyle = look.ink;
    fit(g, p.label, pw - 18, Math.round(0.0088 * k), '700');
    g.fillText(p.label, x(p.a), panelY(E.name));
    g.strokeStyle = look.ink;
    g.globalAlpha = 0.7;
    g.lineWidth = 2;
    scale(d, 0.003, 0.0065);
    g.globalAlpha = 1;
    g.font = `600 ${Math.round(0.0068 * k)}px ${SANS}`;
    g.fillText(d.label, x(d.a), panelY(d.b - d.r - 0.011));
    g.fillStyle = '#121110';
    g.beginPath();
    g.arc(x(p.a), panelY(E.led), 0.0064 * k, 0, 2 * Math.PI);
    g.fill();
    g.fillStyle = '#6f6a62';
    g.beginPath();
    g.arc(x(p.a), panelY(E.stomp.b), E.stomp.r * 1.32 * k, 0, 2 * Math.PI);
    g.fill();
    const s = 0.0055 * k;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const [sx, sy] of [[px + s, py + s], [px + pw - s, py + s], [px + s, py + pd - s], [px + pw - s, py + pd - s]]) {
      g.beginPath();
      g.arc(sx, sy, 3.5, 0, 2 * Math.PI);
      g.fill();
    }
  }
  return { canvas: c, top: th, panel: ph };
}

/** A percent, as the display writes it. @param {number} v */
const pct = (v) => `${Math.round(v * 100)}%`;

export class GuitarKit {
  /**
   * @param {GuitarDesk} G
   * @param {object} o
   * @param {(builder: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's colours (scene.js)
   * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
   * @param {number} [o.anisotropy]
   */
  constructor(G, { lit, lightColor, anisotropy = 1 }) {
    this.desk = G;
    this.group = new THREE.Group();
    this.group.name = 'guitar';
    /** (s, velocity, pick, delay, source) a tip crossed string s over the body: pluck it `delay` seconds from now. @type {(s: number, velocity: number, pick: number, delay: number, source: XRInputSource | null) => void} */
    this.onPluck = () => {};
    /** (s, fret, velocity, source) a tip pressed string s down at a fret. @type {(s: number, fret: number, velocity: number, source: XRInputSource | null) => void} */
    this.onPress = () => {};
    /** (s, fret) the tip pressing string s slid to another fret. @type {(s: number, fret: number) => void} */
    this.onSlide = () => {};
    /** (s, semitones) the tip pressing string s moved across it. @type {(s: number, semitones: number) => void} */
    this.onBend = () => {};
    /** (s) the tip pressing string s lifted off it. @type {(s: number) => void} */
    this.onRelease = () => {};
    /** (i, source) a tip came down on chord button i. @type {(i: number, source: XRInputSource | null) => void} */
    this.onChord = () => {};
    /** (source) a tip came down on the bridge. @type {(source: XRInputSource | null) => void} */
    this.onMute = () => {};
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(G, a, b, h, [0, 0, 0]);
    const Q = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => panelPoint(G, a, b, h, [0, 0, 0]);
    /** A point in the desk's frame, in the room's (for its light). @param {number[]} p */
    const R = (p) => [G.place.x - p[2], p[1], G.place.z + p[0]];
    /** A way in the desk's frame, in the room's. @param {number[]} n */
    const RN = (n) => [-n[2], n[1], n[0]];
    const W = G.width, D = G.length, T = GUITAR.thick, H = G.panel.height, PT = GUITAR.panel.thick, BODY_H = GUITAR.body;
    const across = [W, 0, 0], along = times(G.up, D), down = times(G.normal, T), back = times(G.up, -1);
    const N = G.normal, U = G.up, PU = G.panel.up, PN = G.panel.normal;

    // The stand, the panel's edges and back, the guitar's sides, its frets, nut, pickups and bridge,
    // the chord buttons' sides: one mesh, laid out in the desk's frame, turned, lit once.
    const stand = new Builder();
    stand.quad(P(0, 0, -T), across, down, { normal: back, albedo: WOOD });
    stand.quad(P(0, D, -T), across, down, { normal: U, albedo: WOOD });
    stand.quad(P(0, 0, -T), along, down, { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(P(W, 0, -T), along, down, { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(P(0, 0, -T), across, along, { normal: times(N, -1), albedo: WOOD });
    for (const [a, b] of [[0.05, 0.06], [W - 0.05, 0.06], [0.05, D - 0.06], [W - 0.05, D - 0.06]]) {
      const p = P(a, b, -T);
      stand.box([p[0] - 0.025, 0, p[2] - 0.025], [p[0] + 0.025, p[1] + 0.01, p[2] + 0.025], { albedo: WOOD, skip: ['-y'] });
    }
    const front = P(0, 0.06, -T), rear = P(0, D - 0.06, -T);
    stand.box([0.03, 0.18, rear[2]], [W - 0.03, 0.21, front[2]], { albedo: WOOD });
    stand.quad(Q(0, H), [W, 0, 0], times(PN, -PT), { normal: PU, albedo: WOOD });
    stand.quad(Q(0, 0), times(PU, H), times(PN, -PT), { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(Q(W, 0), times(PU, H), times(PN, -PT), { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PU, H), { normal: times(PN, -1), albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PN, PT), { normal: times(PU, -1), albedo: WOOD });
    // The body's sides, round its outline (which way is out from the way round it goes).
    const body = onTop(G, BODY);
    let area = 0;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) area += body[j][0] * body[i][1] - body[i][0] * body[j][1];
    for (let i = 0; i < body.length; i++) {
      const [a0, b0] = body[i], [a1, b1] = body[(i + 1) % body.length], o = P(a0, b0, UNDER), e = P(a1, b1, UNDER);
      stand.quad(o, [e[0] - o[0], e[1] - o[1], e[2] - o[2]], times(N, BODY_H - UNDER), { normal: outOf(U, a0, b0, a1, b1, Math.sign(area)), albedo: PART.side });
    }
    // The neck's sides, from the nut into the body; the headstock's, round it but at the nut.
    const board = fretboard(G);
    for (const [i, j, way] of [[0, 1, -1], [3, 2, 1]]) {
      const o = P(board[i][0], board[i][1], UNDER), e = P(board[j][0], board[j][1], UNDER);
      stand.quad(o, [e[0] - o[0], e[1] - o[1], e[2] - o[2]], times(N, BODY_H + BOARD_UP - UNDER), { normal: times(U, way), albedo: PART.neck });
    }
    const head = headstock(G);
    for (let i = 0; i < head.length - 1; i++) {
      const [a0, b0] = head[i], [a1, b1] = head[i + 1], o = P(a0, b0, UNDER), e = P(a1, b1, UNDER);
      stand.quad(o, [e[0] - o[0], e[1] - o[1], e[2] - o[2]], times(N, HEAD - UNDER), { normal: outOf(U, a0, b0, a1, b1, -1), albedo: PART.head });
    }
    // The nut, its top as high as the strings; the frets; the pickups; the bridge and its saddles.
    const n0 = neckHalf(G, G.nut), STR = BODY_H + GUITAR.string;
    block(stand, P, N, U, [G.nut - 0.005, G.nut, G.mid - n0, G.mid + n0, HEAD, STR - 0.0005], PART.nut);
    for (let f = 1; f <= FRETS; f++) {
      const a = G.frets[f], nh = neckHalf(G, a) - 0.0015;
      block(stand, P, N, U, [a - 0.0009, a + 0.0009, G.mid - nh, G.mid + nh, BODY_H + BOARD_UP, BODY_H + BOARD_UP + 0.0016], PART.fret);
    }
    for (const a of [G.pickups.neck, G.pickups.bridge]) block(stand, P, N, U, [a - 0.009, a + 0.009, G.mid - 0.037, G.mid + 0.037, BODY_H, BODY_H + 0.0045], PART.pickup);
    block(stand, P, N, U, [G.bridge - 0.012, G.bridge + 0.035, G.mid - 0.046, G.mid + 0.046, BODY_H, BODY_H + 0.002], PART.bridge);
    for (let s = 0; s < 6; s++) {
      const b = stringB(G, s, G.bridge);
      block(stand, P, N, U, [G.bridge - 0.004, G.bridge + 0.009, b - 0.0045, b + 0.0045, BODY_H + 0.002, STR - 0.0005], PART.saddle);
    }
    for (const cb of G.chords) block(stand, P, N, U, [cb.a0, cb.a1, cb.b0, cb.b1, 0, GUITAR.chord.rise], RIM, false);
    this._add(new THREE.Mesh(lit(turn(stand, G)), new THREE.MeshBasicMaterial({ vertexColors: true })), 'guitar stand');

    // The faces, each on the one canvas: the top (the desk round the guitar), the body's, the
    // fretboard's, the headstock's, the chord buttons' caps; the panel's.
    const drawn = faces(G), rows = drawn.top + drawn.panel, k = ATLAS / W;
    const topUV = (/** @type {number} */ a, /** @type {number} */ b) => [a / W, 1 - ((D - b) * k) / rows];
    const panelUV = (/** @type {number} */ a, /** @type {number} */ b) => [a / W, 1 - (drawn.top + (H - b) * k) / rows];
    const [, Oy, Oz] = G.origin, [, Py, Pz] = G.panel.origin;
    const onTopUV = (/** @type {number[]} */ p) => topUV(p[0], (p[1] - Oy) * U[1] + (p[2] - Oz) * U[2]);
    const onPanelUV = (/** @type {number[]} */ p) => panelUV(p[0], (p[1] - Py) * PU[1] + (p[2] - Pz) * PU[2]);
    const faceBuilder = new Builder();
    faceBuilder.quad(P(0, 0), across, along, { normal: N, uv: onTopUV });
    shape(faceBuilder, P, N, body, BODY_H, topUV);
    shape(faceBuilder, P, N, board, BODY_H + BOARD_UP, topUV);
    shape(faceBuilder, P, N, head, HEAD, topUV);
    for (const cb of G.chords) faceBuilder.quad(P(cb.a0, cb.b0, GUITAR.chord.rise), [cb.a1 - cb.a0, 0, 0], times(U, cb.b1 - cb.b0), { normal: N, uv: onTopUV });
    faceBuilder.quad(Q(0, 0, 0.0005), across, times(PU, H), { normal: PN, uv: onPanelUV });
    this._add(new THREE.Mesh(lit(turn(faceBuilder, G)), new THREE.MeshBasicMaterial({ map: texture(drawn.canvas, anisotropy), vertexColors: true })), 'guitar faces');

    // What moves stands in a group turned as the desk is; on the top and on the panel, in their own
    // frames, as the board's (kit.js).
    const turned = new THREE.Group(), top = new THREE.Group(), panel = new THREE.Group();
    turned.position.set(G.place.x, 0, G.place.z);
    turned.rotation.y = G.place.yaw;
    turned.name = 'guitar turned';
    top.position.set(G.origin[0], G.origin[1], G.origin[2]);
    top.rotation.x = G.tilt;
    panel.position.set(G.panel.origin[0], G.panel.origin[1], G.panel.origin[2]);
    panel.rotation.x = Math.PI / 2 - G.panel.lean;
    top.name = 'guitar top';
    panel.name = 'guitar panel';
    this.group.add(turned);
    turned.add(top, panel);
    top.updateMatrix();
    panel.updateMatrix();
    /** @private */
    this._turned = turned;
    /** @private */
    this._top = top;
    /** @private */
    this._panel = panel;
    const light = lightColor(R(P(G.bridge - 0.3, G.mid, BODY_H)), RN(N));
    const panelLight = lightColor(R(Q(W / 2, H / 2)), RN(PN));
    /** @private */
    this._light = [light.r, light.g, light.b];
    /** @private */
    this._dummy = new THREE.Object3D();
    /** @private */
    this._mat = new THREE.Matrix4();
    /** @private */
    this._color = new THREE.Color();

    // The strings: a box each, from the nut to the bridge, written as they ring.
    this.strings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 6);
    this.strings.name = 'guitar strings';
    turned.add(this.strings);
    /** How much each string moves now (main.js: guitar.js level), 0…1. */
    this.levels = new Float32Array(6);
    /** The colour each string lights up in as it rings, when another plucked it in a shared session (linear), else null: the room's glow. @type {(readonly number[] | null)[]} */
    this.ringTints = [null, null, null, null, null, null];
    /** @private what each string was last written as: its level (-1 never) and whether pointed at; and its colour */
    this._stringShown = new Float32Array(6).fill(-1);
    /** @private @type {(readonly number[] | null)[]} */
    this._ringShown = [null, null, null, null, null, null];
    /** Less motion: a string ringing lit, not blurred. */
    this.still = false;
    /** The string pointed at (a pointer over it), else -1; and the fret a press there would press it at (0: over the body). */
    this.hoverString = -1;
    this.hoverFret = 0;

    // The dots: one for each string (where it is fretted, or muted), and the one where a press would go.
    this.dots = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: light }), 7);
    this.dots.name = 'guitar dots';
    turned.add(this.dots);
    /** @private each string's fret (-1 muted), whether a finger presses it (and the colour of another's, else null), and its bend, as last shown @type {{ fret: number, finger: boolean, tint: readonly number[] | null, bend: number }[]} */
    this._strings = [0, 1, 2, 3, 4, 5].map(() => ({ fret: 0, finger: false, tint: null, bend: 0 }));
    /** @private */
    this._dotsDirty = true;
    /** @private the hover dot as last written: string × 32 + fret, -1 hidden, -2 never */
    this._hoverShown = -2;

    // The knobs (the guitar's two on its body, the amp's five and the pedals' four on the panel), the
    // pickup switch's lever and the pedals' footswitches, one mesh, each its size and colour; a line
    // on each knob.
    const n = G.dials.length, E = GUITAR.pedal;
    this.knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 1, 24).translate(0, 0.5, 0), new THREE.MeshBasicMaterial(), n + 1 + G.panel.pedals.length);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), n);
    this.knobs.name = 'guitar knobs';
    this.marks.name = 'guitar knob marks';
    turned.add(this.knobs, this.marks);
    const tint = (/** @type {number[]} */ c, /** @type {THREE.Color} */ l) => this._color.setRGB(c[0] * l.r, c[1] * l.g, c[2] * l.b);
    G.dials.forEach((d, i) => {
      const [body, mark] = d.section === 'guitar' ? [KNOB.guitar, KNOB.guitarMark] : d.section === 'amp' ? [KNOB.amp, KNOB.ampMark] : [KNOB.pedal, KNOB.pedalMark];
      this.knobs.setColorAt(i, tint(body, d.on === 'top' ? light : panelLight));
      this.marks.setColorAt(i, tint(mark, d.on === 'top' ? light : panelLight));
    });
    this.knobs.setColorAt(n, tint(KNOB.lever, light));
    G.panel.pedals.forEach((p, i) => {
      const o = this._dummy;
      o.position.set(p.a, 0, -E.stomp.b);
      o.rotation.set(0, 0, 0);
      o.scale.set(E.stomp.r, E.stomp.h, E.stomp.r);
      o.updateMatrix();
      this.knobs.setMatrixAt(n + 1 + i, this._mat.multiplyMatrices(panel.matrix, o.matrix));
      this.knobs.setColorAt(n + 1 + i, tint(KNOB.stomp, panelLight));
    });

    // The lights: the chord buttons', one each in its corner, lit on the chord chosen; the pedals', one
    // each over its footswitch, lit while it is on.
    const chords = G.chords.length;
    this.lights = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0042, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(), chords + G.panel.pedals.length);
    this.lights.name = 'guitar lights';
    turned.add(this.lights);
    G.chords.forEach((cb, i) => {
      const d = this._dummy;
      d.position.set(cb.a1 - 0.009, GUITAR.chord.rise + 0.0004, -(cb.b1 - 0.009));
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.lights.setMatrixAt(i, this._mat.multiplyMatrices(top.matrix, d.matrix));
    });
    G.panel.pedals.forEach((p, i) => {
      const d = this._dummy;
      d.position.set(p.a, 0.0006, -E.led);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.lights.setMatrixAt(chords + i, this._mat.multiplyMatrices(panel.matrix, d.matrix));
    });
    /** @private each light on (1) or off (0) as last written, -1 never */
    this._lightShown = new Int8Array(chords + G.panel.pedals.length).fill(-1);
    /** @private which pedals are on (G.panel.pedals' order) */
    this._pedals = G.panel.pedals.map(() => false);

    // The display, over its frame on the face.
    const Sd = G.panel.display, dw = Sd.a1 - Sd.a0, dd = Sd.b1 - Sd.b0;
    /** @private */
    this._display = canvas(600, Math.round((600 * dd) / dw));
    /** @private */
    this._displayTexture = texture(this._display, anisotropy);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(dw, dd).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this._displayTexture, color: panelLight }));
    display.position.set((Sd.a0 + Sd.a1) / 2, 0.001, -(Sd.b0 + Sd.b1) / 2);
    display.name = 'guitar display';
    panel.add(display);

    // The sign on the wall, as wide as the desk.
    const Gs = G.sign, sw = Gs.x1 - Gs.x0, sh = Gs.y1 - Gs.y0, mid = [(Gs.x0 + Gs.x1) / 2, (Gs.y0 + Gs.y1) / 2, Gs.z];
    const plate = signPlate(1024, Math.round((1024 * sh) / sw), 'Guitar', 'an electric guitar, its amp and its pedals');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: texture(plate, anisotropy), color: lightColor(R(mid), RN([0, 0, 1])) }));
    sign.position.set(mid[0], mid[1], mid[2]);
    sign.name = 'guitar sign';
    turned.add(sign);

    /** @private the tips that play it: the sticks', then the forefingers' @type {GuitarTip[]} */
    this._tips = [0, 1, 2, 3].map(() => ({ has: false, a: 0, b: 0, h: 0, string: -1, fret: 0, armed: false }));
    /** @private */
    this._at = new THREE.Vector3();
    /** @private */
    this._point = { a: 0, b: 0, h: 0 };
    /** @private */
    this._near = { string: -1, across: 0 };
    /** @private the strings a move crossed, and how far along it */
    this._crossed = [0, 0, 0, 0, 0, 0];
    /** @private */
    this._when = [0, 0, 0, 0, 0, 0];
    /** @private what the display shows: the chord, its three lines, the knob turned last */
    this._shown = { name: '', first: '', second: '', third: '', last: '' };
    /** @private the chord chosen (CHORDS' index), -1 none */
    this._chord = -1;
    /** @private */
    this._displayDirty = true;
    /** @private seconds since the display was drawn */
    this._displayAge = Infinity;
    this.setKnobs({ ...DEFAULT_GUITAR });
    this.setPickup('both');
    for (let s = 0; s < 6; s++) this._writeString(s);
    this._writeDots();
    this._writeLights();
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
   * Every knob turned to the guitar's (0…1 each) at once (reset): the knob turned last off the display.
   * @param {Readonly<GuitarKnobs>} knobs
   */
  setKnobs(knobs) {
    this.desk.dials.forEach((d, i) => this._turn(i, knobs[d.id]));
    if (this._shown.last) this._displayDirty = true;
    this._shown.last = '';
  }

  /**
   * A knob turned: it, and on the display its name and how it is set (`text`, guitar.js guitarText).
   * @param {GuitarKnob} id
   * @param {number} value
   * @param {string} text
   */
  setKnob(id, value, text) {
    const i = this.desk.dials.findIndex((d) => d.id === id);
    if (i >= 0) this._turn(i, value);
    const last = `${guitarKnobName(id)}  ${text}`;
    if (last === this._shown.last) return;
    this._shown.last = last;
    this._displayDirty = true;
  }

  /**
   * The pickup switch's lever at its place.
   * @param {Pickup} id
   */
  setPickup(id) {
    const G = this.desk, o = this._dummy, i = Math.max(0, PICKUPS.findIndex((p) => p.id === id));
    o.position.set(switchA(G, i), GUITAR.body, -(G.switch.b0 + G.switch.b1) / 2);
    o.rotation.set(0, 0, 0);
    o.scale.set(0.0048, 0.017, 0.0048);
    o.updateMatrix();
    this.knobs.setMatrixAt(G.dials.length, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    this.knobs.instanceMatrix.needsUpdate = true;
  }

  /**
   * The guitar as it is (guitar.js Guitar: the chord, its name, the pickup, the knobs, the pedals on):
   * on the display, the lights and the switch.
   * @param {{ chord: string | null, chordName: string, pickup: Pickup, knobs: Readonly<GuitarKnobs>, pedals: Readonly<Record<PedalId, boolean>> }} state
   */
  setState({ chord, chordName, pickup, knobs, pedals }) {
    const p = PICKUPS.find((x) => x.id === pickup);
    const first = `${p ? p.name.toUpperCase() : ''}  ·  VOLUME ${pct(knobs.volume)}  ·  TONE ${pct(knobs.tone)}`;
    const second = `AMP ${ampWords(knobs.gain).toUpperCase()}  ·  GAIN ${pct(knobs.gain)}  ·  MASTER ${pct(knobs.master)}`;
    const on = PEDALS.filter((x) => pedals[x.id]).map((x) => x.label);
    const third = `PEDALS  ${on.length ? on.join('  ·  ') : 'OFF'}`;
    const shown = this._shown;
    if (chordName !== shown.name || first !== shown.first || second !== shown.second || third !== shown.third) this._displayDirty = true;
    shown.name = chordName;
    shown.first = first;
    shown.second = second;
    shown.third = third;
    this._chord = CHORDS.findIndex((c) => c.id === chord);
    this.desk.panel.pedals.forEach((x, i) => (this._pedals[i] = !!pedals[x.id]));
    this.setPickup(pickup);
  }

  /**
   * Where each string is fretted now (guitar.js fretOf: -1 muted, 0 open), whether a finger presses it
   * there (not the chord), and how far it is bent: its dot, in the room's glow for a finger, or in the
   * colour of another whose finger it is in a shared session (`tints`, linear).
   * @param {readonly number[]} frets
   * @param {readonly boolean[]} fingers
   * @param {readonly number[]} bends
   * @param {readonly (readonly number[] | null)[] | null} [tints]
   */
  setStrings(frets, fingers, bends, tints = null) {
    for (let s = 0; s < 6; s++) {
      const t = this._strings[s], tint = tints?.[s] ?? null;
      if (t.fret === frets[s] && t.finger === fingers[s] && t.tint === tint && t.bend === bends[s]) continue;
      t.fret = frets[s];
      t.finger = fingers[s];
      t.tint = tint;
      t.bend = bends[s];
      this._dotsDirty = true;
    }
  }

  /**
   * Knob i (G.dials) turned to `value` (0…1: from 135° left to 135° right), on the top or the panel.
   * @private
   * @param {number} i
   * @param {number} value
   */
  _turn(i, value) {
    const d = this.desk.dials[i], o = this._dummy, own = d.on === 'top';
    const { r, h } = d, base = own ? GUITAR.body : 0;
    const frame = own ? this._top.matrix : this._panel.matrix, turn = -(value - 0.5) * 1.5 * Math.PI;
    o.position.set(d.a, base, -d.b);
    o.rotation.set(0, turn, 0);
    o.scale.set(r, h, r);
    o.updateMatrix();
    this.knobs.setMatrixAt(i, this._mat.multiplyMatrices(frame, o.matrix));
    const out = r * 0.45;
    o.position.set(d.a - out * Math.sin(turn), base + h + 0.0012, -d.b - out * Math.cos(turn));
    o.scale.set(r * 0.22, 0.002, r * 0.75);
    o.updateMatrix();
    this.marks.setMatrixAt(i, this._mat.multiplyMatrices(frame, o.matrix));
    this.knobs.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
  }

  /**
   * String s as it is now, if that changed: as wide as it rings (unless still), lit as it rings (in
   * the room's glow, or the colour of another who plucked it), a little lighter pointed at. Whether it
   * was written.
   * @private
   * @param {number} s
   */
  _writeString(s) {
    const G = this.desk, level = this.levels[s], lift = this.hoverString === s ? 1 : 0, tint = this.ringTints[s];
    const shown = Math.round(level * 200) + lift * 1000 + (this.still ? 2000 : 0);
    if (shown === this._stringShown[s] && tint === this._ringShown[s]) return false;
    this._stringShown[s] = shown;
    this._ringShown[s] = tint;
    const hue = tint ?? GLOW;
    const b0 = stringB(G, s, G.nut), b1 = stringB(G, s, G.bridge), len = Math.hypot(GUITAR.scale, b1 - b0);
    const wide = GAUGE[s] + (this.still ? 0 : BLUR * level), o = this._dummy;
    o.position.set((G.nut + G.bridge) / 2, GUITAR.body + GUITAR.string - GAUGE[s] / 2, -(b0 + b1) / 2);
    o.rotation.set(0, Math.atan2(b1 - b0, GUITAR.scale), 0);
    o.scale.set(len, GAUGE[s], wide);
    o.updateMatrix();
    this.strings.setMatrixAt(s, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    const base = s < 3 ? WOUND : STEEL, glow = Math.min(1, level * 1.6) * 0.75, up = lift ? 1.25 : 1, l = this._light, c = this._color;
    c.setRGB(
      (base[0] * (1 - glow) * up + hue[0] * glow * 1.4) * l[0],
      (base[1] * (1 - glow) * up + hue[1] * glow * 1.4) * l[1],
      (base[2] * (1 - glow) * up + hue[2] * glow * 1.4) * l[2],
    );
    this.strings.setColorAt(s, c);
    return true;
  }

  /**
   * The dots as they are now: over each string at its fret (gold the chord's, the room's glow a
   * finger's, moved across as it is bent), a cross's colour behind the nut where it is muted, none
   * where open.
   * @private
   */
  _writeDots() {
    this._dotsDirty = false;
    const G = this.desk, o = this._dummy, STR = GUITAR.body + GUITAR.string;
    for (let s = 0; s < 6; s++) {
      const t = this._strings[s];
      o.rotation.set(0, 0, 0);
      if (t.fret > 0) {
        const a = fretPlace(G, Math.min(t.fret, FRETS)), sp = spacingAt(G, a), way = s < 3 ? 1 : -1;
        o.position.set(a, STR + 0.0006, -(stringB(G, s, a) + way * t.bend * sp * 0.4));
        o.scale.set(0.0058, 1, 0.0058);
        const c = t.finger ? t.tint ?? DOT.finger : DOT.chord;
        this.dots.setColorAt(s, this._color.setRGB(c[0], c[1], c[2]));
      } else if (t.fret < 0) {
        o.position.set(G.nut - 0.013, HEAD + 0.0006, -stringB(G, s, G.nut));
        o.scale.set(0.0042, 1, 0.0042);
        this.dots.setColorAt(s, this._color.setRGB(DOT.muted[0], DOT.muted[1], DOT.muted[2]));
      } else o.scale.set(0, 0, 0);
      o.updateMatrix();
      this.dots.setMatrixAt(s, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    }
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    this._hoverShown = -2;
  }

  /**
   * The pale dot where a press would go (the string pointed at over the neck, at its fret), if that
   * changed. Whether it was written.
   * @private
   */
  _writeHover() {
    const s = this.hoverString, f = this.hoverFret, code = s >= 0 && f > 0 ? s * 32 + f : -1;
    if (code === this._hoverShown) return false;
    this._hoverShown = code;
    const G = this.desk, o = this._dummy;
    o.rotation.set(0, 0, 0);
    if (code >= 0) {
      const a = fretPlace(G, Math.min(f, FRETS));
      o.position.set(a, GUITAR.body + GUITAR.string + 0.0004, -stringB(G, s, a));
      o.scale.set(0.0048, 1, 0.0048);
    } else o.scale.set(0, 0, 0);
    o.updateMatrix();
    this.dots.setMatrixAt(6, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    this.dots.setColorAt(6, this._color.setRGB(DOT.hover[0] * 0.8, DOT.hover[1] * 0.8, DOT.hover[2] * 0.8));
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    return true;
  }

  /**
   * The lights as they are now, where they changed: the chord buttons' on the chord chosen, the
   * pedals' on those on. Whether any was written.
   * @private
   */
  _writeLights() {
    let wrote = false;
    const chords = this.desk.chords.length;
    for (let l = 0; l < this._lightShown.length; l++) {
      const pedal = l >= chords, on = (pedal ? this._pedals[l - chords] : l === this._chord) ? 1 : 0;
      if (on === this._lightShown[l]) continue;
      this._lightShown[l] = on;
      const c = pedal ? (on ? LED.on : LED.off) : on ? LIGHT.on : LIGHT.off;
      this.lights.setColorAt(l, this._color.setRGB(c[0], c[1], c[2]));
      wrote = true;
    }
    return wrote;
  }

  /**
   * Per frame: the strings written where they changed (as they ring, pointed at), the dots, the
   * lights, and the display redrawn when it changed (at most ten times a second).
   * @param {number} dt
   */
  update(dt) {
    let strings = false;
    for (let s = 0; s < 6; s++) if (this._writeString(s)) strings = true;
    if (strings) {
      this.strings.instanceMatrix.needsUpdate = true;
      if (this.strings.instanceColor) this.strings.instanceColor.needsUpdate = true;
    }
    if (this._dotsDirty) this._writeDots();
    this._writeHover();
    if (this._writeLights() && this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    this._displayAge += dt;
    if (this._displayDirty && this._displayAge >= 0.1) this._drawDisplay();
  }

  /** The display: the chord, its three lines, and the knob turned last. @private */
  _drawDisplay() {
    this._displayDirty = false;
    this._displayAge = 0;
    const c = this._display, g = context(c), w = c.width, h = c.height, s = this._shown;
    g.fillStyle = '#0d1714';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = '#9ee6b8';
    fit(g, s.name, w - 40, 52, '700');
    g.fillText(s.name, 20, h * 0.16);
    g.fillStyle = '#6fbf93';
    fit(g, s.first, w - 40, 26);
    g.fillText(s.first, 20, h * 0.37);
    fit(g, s.second, w - 40, 26);
    g.fillText(s.second, 20, h * 0.53);
    fit(g, s.third, w - 40, 26);
    g.fillText(s.third, 20, h * 0.69);
    if (s.last) {
      g.fillStyle = '#efe5cf';
      fit(g, s.last, w - 40, 28, '500');
      g.fillText(s.last, 20, h * 0.87);
    }
    this._displayTexture.needsUpdate = true;
  }

  /**
   * In VR, per frame, after kit.js's (whose sticks show near the guitar too): each stick's tip while
   * it shows, else the forefinger of a hand without a controller, plays the guitar.
   * @param {Hand[]} hands
   * @param {THREE.XRHandSpace[]} fingers the hands' joints (renderer.xr.getHand)
   * @param {THREE.Object3D[]} sticks kit.js's, in the controllers
   * @param {number} dt
   */
  updateXR(hands, fingers, sticks, dt) {
    const at = this._at;
    for (let i = 0; i < 2; i++) {
      const h = hands[i], stick = !!(h && sticks[i]?.visible);
      if (h && stick) at.set(0, 0, -STICK.tip).applyMatrix4(h.controller.matrixWorld);
      this._track(this._tips[i], stick, false, h?.source ?? null, dt);
      const tip = fingers[i]?.joints['index-finger-tip'];
      const finger = !!(fingers[i]?.visible && tip?.visible);
      if (finger && tip) at.setFromMatrixPosition(tip.matrixWorld);
      this._track(this._tips[2 + i], finger, true, null, dt);
    }
  }

  /** Back on a screen: every string a tip pressed let go, every tip forgotten. */
  endXR() {
    for (const t of this._tips) this._track(t, false, false, null, 0);
  }

  /** Whether `a` along the top is where the strings are over the body, between the last fret and the bridge. @private @param {number} a */
  _overBody(a) {
    return a > this.desk.frets[FRETS] && a < this.desk.bridge - GUITAR.bridgeZone.before;
  }

  /**
   * One tip, now at this._at (when `active`): on the neck, down onto a string presses it at its fret
   * (as hard as it came down), along it slides it, across it bends it, and up off it lets it go; over
   * the body, near or among the strings, it plucks each string it crosses, as fast as it goes (a
   * string poked straight down too); down on the bridge it mutes them all, down on a chord button it
   * chooses that chord.
   * @private
   * @param {GuitarTip} tip
   * @param {boolean} active
   * @param {boolean} finger
   * @param {XRInputSource | null} source
   * @param {number} dt
   */
  _track(tip, active, finger, source, dt) {
    if (!active) {
      if (tip.string >= 0) this.onRelease(tip.string);
      tip.string = -1;
      tip.has = false;
      return;
    }
    const G = this.desk, p = this._at, at = guitarPoint(G, p.x, p.y, p.z, this._point), { a, b, h } = at;
    const part = partAt(G, a, b), overTop = h + GUITAR.body + GUITAR.string - GUITAR.chord.rise, step = Math.max(dt, 1e-3);
    if (tip.string >= 0) {
      // Pressing a string: along it slides it, across it bends it, up off it (or off the neck) lets it go.
      if (h > LIFT || part !== 'fret') {
        this.onRelease(tip.string);
        tip.string = -1;
      } else {
        const f = Math.max(1, fretAt(G, a));
        if (f !== tip.fret) this.onSlide(tip.string, (tip.fret = f));
        this.onBend(tip.string, bendFor((b - stringB(G, tip.string, a)) / spacingAt(G, a)));
      }
    } else if (tip.has) {
      const moved = Math.hypot(a - tip.a, b - tip.b);
      if (part === 'fret' && tip.h > 0 && h <= 0 && h > -DEEP) {
        const near = stringAt(G, a, b, this._near);
        if (near.string >= 0) {
          tip.string = near.string;
          tip.fret = Math.max(1, fretAt(G, a));
          this.onPress(tip.string, tip.fret, strikeVelocity((tip.h - h) / step, finger), source);
        }
      } else if (this._overBody(a) && this._overBody(tip.a) && Math.min(tip.h, h) <= TOUCH && Math.max(tip.h, h) >= -DEEP && moved < JUMP) {
        const n = strummed(G, tip.a, tip.b, a, b, this._crossed, this._when);
        const v = strikeVelocity(Math.abs(b - tip.b) / step, finger), pick = pickAt(G, a);
        for (let k = 0; k < n; k++) this.onPluck(this._crossed[k], v, pick, this._when[k] * dt, source);
        if (!n && part === 'strum' && tip.h > 0 && h <= 0) {
          const near = stringAt(G, a, b, this._near, 0.5);
          if (near.string >= 0 && Math.abs(near.across) < 0.35) this.onPluck(near.string, strikeVelocity((tip.h - h) / step, finger), pick, 0, source);
        }
      } else if (part === 'mute' && tip.h > 0 && h <= 0) this.onMute(source);
      if (tip.armed && overTop <= 0 && overTop > -DEEP) {
        const c = chordAt(G, a, b);
        if (c >= 0) this.onChord(c, source);
        tip.armed = false;
      }
    }
    if (!tip.has || overTop > REARM) tip.armed = overTop > REARM;
    tip.a = a;
    tip.b = b;
    tip.h = h;
    tip.has = true;
  }
}
