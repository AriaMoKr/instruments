// The synth in 3D (synthboard.js lays it out, synth.js says what is on it), as the drum board is
// (kit.js): its stand, top and panel, lit as the room is (scene.js's bake, once, into vertex
// colours), with a cheek of wood either side of the keys; its keys, one instanced mesh, each going
// down and lit in the room's glow while its note sounds (from any key that plays it: the computer's,
// the card's, a MIDI keyboard's), a little lighter pointed at (or chosen with a TV's arrows); its
// dials, turned to the knobs, with a line on each; the names of the dials and of their sections on
// the top behind the keys, and the panel's face with its buttons' caps standing out of it, their names
// on them, and its patch bay's jacks as the board's are (kit.js: its outs on a plate, the cables
// kit.js's too) (one canvas, drawn once); the display on the panel (the sound, mono or poly, the keys'
// notes, the arpeggiator, the knob turned last and how it is set), redrawn when it changes, at most ten
// times a second; a light on the preset chosen, on Mono, on the way the arpeggiator plays and on HOLD;
// and its sign on the wall over it. In VR a stick's tip (kit.js's sticks, which show near it too) or a
// forefinger going down into a key plays it, as hard as it went, and holds it until it comes up out of
// it; sliding off it onto the next, still down, plays that one. Per frame nothing is allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, boardPoint, panelPoint } from './board.js';
import { SYNTH, keyUnder, keyVelocity } from './synthboard.js';
import { DEFAULT_SYNTH, KEYS, knobName, noteName } from './synth.js';
import { ARP_MODES } from './arp.js';
import { JACKS } from './patch.js';
import { STICK, canvas, context, drawJack, drawPlate, fit, lin, signPlate, texture, times } from './kit.js';
import { GOLD, SANS } from './textures.js';

/** @typedef {import('./synthboard.js').SynthDesk} SynthDesk */
/** @typedef {import('./synth.js').SynthKnob} SynthKnob */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */

const WOOD = lin('#3b2a1d'), TOP = lin('#23211f'), RIM = lin('#151413');
/** The keys' colours (linear): ivory and ebony, and the room's glow a key sounding takes. */
const IVORY = lin('#ece6da'), EBONY = lin('#1c1a18'), ROOM_GLOW = lin('#5cc8a8');
/** The lights on the preset chosen, on Mono, on the way the arpeggiator plays and on HOLD: off, on (linear). */
const LIGHT = { off: lin('#2a1d18'), on: lin('#f2b648') };
/** How hard a key slid onto, still down, is played (a glissando). */
const GLISS = 0.6;
/** How far over its key's top a tip must come back up to let it go (so a tip held at its top doesn't chatter). */
const LIFT = 0.004;
/** The canvas drawn once: this many pixels across the synth. */
const ATLAS = 2048;

/**
 * What is drawn once, on one canvas: the top behind the keys (its rows' sections named under them
 * with a line across each, the dials' names) over the panel's face (the display's frame, the names
 * over the buttons and the jacks, the patch bay's jacks, each button's cap with its name, the
 * synth's own). `deck` and `panel`: where each is, in the canvas's rows.
 * @param {SynthDesk} S
 */
function faces(S) {
  const W = S.width, P = S.panel, D = S.deck, k = ATLAS / W;
  const dh = Math.round((D.b1 - D.b0) * k), ph = Math.round(P.height * k);
  const c = canvas(ATLAS, dh + ph), g = context(c);
  const x = (/** @type {number} */ a) => a * k;
  const deckY = (/** @type {number} */ b) => (D.b1 - b) * k;
  const panelY = (/** @type {number} */ b) => dh + (P.height - b) * k;
  g.fillStyle = '#23211f';
  g.fillRect(0, 0, ATLAS, dh);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const s of S.sections) {
    const row = S.rows[s.row], y = deckY((row.titles.b0 + row.titles.b1) / 2), mid = x((s.a0 + s.a1) / 2);
    g.font = `600 ${Math.round(0.0092 * k)}px ${SANS}`;
    const half = g.measureText(s.label).width / 2 + 12;
    g.fillStyle = GOLD;
    g.fillText(s.label, mid, y);
    g.strokeStyle = 'rgba(224,187,114,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(s.a0 + 0.008), y - 8);
    g.lineTo(x(s.a0 + 0.008), y);
    g.lineTo(mid - half, y);
    g.moveTo(mid + half, y);
    g.lineTo(x(s.a1 - 0.008), y);
    g.lineTo(x(s.a1 - 0.008), y - 8);
    g.stroke();
  }
  g.fillStyle = '#efe5cf';
  for (const d of S.dials) {
    const row = S.rows[S.sections.find((s) => s.id === d.section)?.row ?? 0];
    fit(g, d.label, SYNTH.dial.spacing * k - 12, Math.round(0.0085 * k));
    g.fillText(d.label, x(d.a), deckY((row.names.b0 + row.names.b1) / 2));
  }
  // The panel, its top edge against the top's in the canvas.
  g.fillStyle = '#26231f';
  g.fillRect(0, dh, ATLAS, ph);
  const S2 = P.display;
  g.fillStyle = '#0d1714';
  g.strokeStyle = 'rgba(224,187,114,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(x(S2.a0) - 6, panelY(S2.b1) - 6, x(S2.a1) - x(S2.a0) + 12, panelY(S2.b0) - panelY(S2.b1) + 12, 12);
  g.fill();
  g.stroke();
  for (const t of P.titles) {
    const y = panelY(t.b);
    g.fillStyle = GOLD;
    g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
    g.fillText(t.text, x(t.a), y);
    if (t.a0 === undefined || t.a1 === undefined) continue;
    // Over a span: a line along it either side of the name, its ends turned down to what it names.
    const half = g.measureText(t.text).width / 2 + 12;
    g.strokeStyle = 'rgba(224,187,114,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(t.a0), y + 8);
    g.lineTo(x(t.a0), y);
    g.lineTo(x(t.a) - half, y);
    g.moveTo(x(t.a) + half, y);
    g.lineTo(x(t.a1), y);
    g.lineTo(x(t.a1), y + 8);
    g.stroke();
  }
  // The patch bay's jacks, as the board's: the outputs on a plate, each with what it is under it.
  drawPlate(g, P.jacks.filter((j) => j.out), x, panelY, k);
  const r = BOARD.panel.jack * k;
  g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
  for (const j of P.jacks) {
    drawJack(g, x(j.a), panelY(j.b), r);
    g.fillStyle = '#efe5cf';
    g.fillText(JACKS.find((J) => J.id === j.id)?.label ?? '', x(j.a), panelY(j.b - BOARD.panel.jack - 0.011));
  }
  for (const b of P.buttons) {
    const bx = x(b.a0), by = panelY(b.b1), bw = x(b.a1) - bx, bh = panelY(b.b0) - by;
    g.fillStyle = '#3d3934';
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(bx, by + bh - 5, bw, 5);
    g.fillStyle = '#efe5cf';
    const sign = b.id.startsWith('octave.');
    fit(g, b.label, bw - 14, Math.round((sign ? 0.026 : 0.0092) * k), sign ? '500' : '600');
    g.fillText(b.label, bx + bw / 2, by + bh * (sign ? 0.5 : 0.64));
  }
  // Its own name, at the foot of the panel's right, under the octave's buttons.
  const R = P.buttons.find((b) => b.id === 'octave.up') ?? P.buttons[0];
  g.fillStyle = GOLD;
  g.font = `italic 600 ${Math.round(0.0115 * k)}px ${SANS}`;
  g.textAlign = 'right';
  g.fillText('Six-voice analog', x(R.a1), panelY(0.047));
  return { canvas: c, deck: dh, panel: ph };
}

/**
 * A block standing on the top in its frame (P: boardPoint's), a0…a1 across, b0…b1 up it and h0…h1
 * out of it: its top, front, back and sides.
 * @param {Builder} b
 * @param {(a: number, b: number, h?: number) => number[]} P
 * @param {number[]} N the top's normal
 * @param {number[]} U up the top
 * @param {[number, number, number, number, number, number]} box a0, a1, b0, b1, h0, h1
 * @param {number[]} albedo
 */
function block(b, P, N, U, [a0, a1, b0, b1, h0, h1], albedo) {
  const w = [a1 - a0, 0, 0], d = times(U, b1 - b0), h = times(N, h1 - h0);
  b.quad(P(a0, b0, h1), w, d, { normal: N, albedo });
  b.quad(P(a0, b0, h0), w, h, { normal: times(U, -1), albedo });
  b.quad(P(a0, b1, h0), w, h, { normal: U, albedo });
  b.quad(P(a0, b0, h0), d, h, { normal: [-1, 0, 0], albedo });
  b.quad(P(a1, b0, h0), d, h, { normal: [1, 0, 0], albedo });
}

/**
 * A tip that plays the keys (a stick's, a forefinger's): the key it holds down (-1 none), how high it
 * was over the top last frame, and whether there was a last frame.
 * @typedef {{ key: number, h: number, has: boolean }} KeyTip
 */

export class SynthKit {
  /**
   * @param {SynthDesk} S
   * @param {object} o
   * @param {(builder: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's colours (scene.js)
   * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
   * @param {number} [o.anisotropy]
   */
  constructor(S, { lit, lightColor, anisotropy = 1 }) {
    this.synth = S;
    this.group = new THREE.Group();
    this.group.name = 'synth';
    /** (k, velocity, source) a stick's tip or a forefinger went down into key k. @type {(k: number, velocity: number, source: XRInputSource | null) => void} */
    this.onKeyDown = () => {};
    /** (k) it came up out of key k, or off it. @type {(k: number) => void} */
    this.onKeyUp = () => {};
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(S, a, b, h, [0, 0, 0]);
    const Q = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => panelPoint(S, a, b, h, [0, 0, 0]);
    const W = S.width, D = S.length, T = SYNTH.thick, H = S.panel.height, PT = SYNTH.panel.thick, BT = SYNTH.panel.button;
    const across = [W, 0, 0], along = times(S.up, D), down = times(S.normal, T), back = times(S.up, -1);
    const N = S.normal, U = S.up, PU = S.panel.up, PN = S.panel.normal;

    // The stand, the top and its cheeks, the panel's edges and back, the buttons' sides: one mesh, lit once.
    const stand = new Builder();
    stand.quad(P(0, 0), across, along, { normal: N, albedo: TOP });
    stand.quad(P(0, 0, -T), across, down, { normal: back, albedo: WOOD });
    stand.quad(P(0, D, -T), across, down, { normal: U, albedo: WOOD });
    stand.quad(P(0, 0, -T), along, down, { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(P(W, 0, -T), along, down, { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(P(0, 0, -T), across, along, { normal: times(N, -1), albedo: WOOD });
    const cheek = SYNTH.key.margin - 0.008, bed = S.bed;
    block(stand, P, N, U, [0.004, 0.004 + cheek, 0, bed.b1 + 0.014, 0, 0.034], WOOD);
    block(stand, P, N, U, [W - 0.004 - cheek, W - 0.004, 0, bed.b1 + 0.014, 0, 0.034], WOOD);
    // A rail behind the keys, as high as the white keys' tops and a little over.
    block(stand, P, N, U, [bed.a0, bed.a1, bed.b1 + 0.001, bed.b1 + 0.007, 0, SYNTH.key.rise + 0.002], RIM);
    for (const [a, b] of [[0.05, 0.06], [W - 0.05, 0.06], [0.05, D - 0.06], [W - 0.05, D - 0.06]]) {
      const p = P(a, b, -T);
      stand.box([p[0] - 0.025, 0, p[2] - 0.025], [p[0] + 0.025, p[1] + 0.01, p[2] + 0.025], { albedo: WOOD, skip: ['-y'] });
    }
    const front = P(0, 0.06, -T), rear = P(0, D - 0.06, -T);
    stand.box([S.x0 + 0.03, 0.18, rear[2]], [S.x1 - 0.03, 0.21, front[2]], { albedo: WOOD });
    stand.quad(Q(0, H), [W, 0, 0], times(PN, -PT), { normal: PU, albedo: WOOD });
    stand.quad(Q(0, 0), times(PU, H), times(PN, -PT), { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(Q(W, 0), times(PU, H), times(PN, -PT), { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PU, H), { normal: times(PN, -1), albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PN, PT), { normal: times(PU, -1), albedo: WOOD });
    const rise = times(PN, BT);
    for (const b of S.panel.buttons) {
      const bw = b.a1 - b.a0, side = times(PU, b.b1 - b.b0);
      stand.quad(Q(b.a0, b.b0), [bw, 0, 0], rise, { normal: times(PU, -1), albedo: RIM });
      stand.quad(Q(b.a0, b.b1), [bw, 0, 0], rise, { normal: PU, albedo: RIM });
      stand.quad(Q(b.a0, b.b0), side, rise, { normal: [-1, 0, 0], albedo: RIM });
      stand.quad(Q(b.a1, b.b0), side, rise, { normal: [1, 0, 0], albedo: RIM });
    }
    this._add(new THREE.Mesh(lit(stand), new THREE.MeshBasicMaterial({ vertexColors: true })), 'synth stand');

    // The names on the top, the panel's face and the buttons' caps, each a quad on the one canvas.
    const drawn = faces(S), rows = drawn.deck + drawn.panel;
    const deckV = [1 - drawn.deck / rows, 1], panelV = [0, 1 - drawn.deck / rows];
    const faceBuilder = new Builder();
    /**
     * @param {number[]} o
     * @param {number[]} u
     * @param {number[]} v
     * @param {number[]} us
     * @param {number[]} vs
     */
    const mapped = (o, u, v, us, vs) => {
      const first = faceBuilder.uvs.length;
      faceBuilder.quad(o, u, v);
      for (let i = first; i < faceBuilder.uvs.length; i += 2) {
        faceBuilder.uvs[i] = us[0] + faceBuilder.uvs[i] * (us[1] - us[0]);
        faceBuilder.uvs[i + 1] = vs[0] + faceBuilder.uvs[i + 1] * (vs[1] - vs[0]);
      }
    };
    mapped(P(0, S.deck.b0, 0.0015), across, times(U, S.deck.b1 - S.deck.b0), [0, 1], deckV);
    mapped(Q(0, 0, 0.0005), across, times(PU, H), [0, 1], panelV);
    const pv = (/** @type {number} */ b) => panelV[0] + (b / H) * (panelV[1] - panelV[0]);
    for (const b of S.panel.buttons) mapped(Q(b.a0, b.b0, BT), [b.a1 - b.a0, 0, 0], times(PU, b.b1 - b.b0), [b.a0 / W, b.a1 / W], [pv(b.b0), pv(b.b1)]);
    this._add(new THREE.Mesh(lit(faceBuilder), new THREE.MeshBasicMaterial({ map: texture(drawn.canvas, anisotropy), vertexColors: true })), 'synth faces');

    // On the top and on the panel, in their own frames, as the board's (kit.js).
    const top = new THREE.Group(), panel = new THREE.Group();
    top.position.set(S.origin[0], S.origin[1], S.origin[2]);
    top.rotation.x = S.tilt;
    panel.position.set(S.panel.origin[0], S.panel.origin[1], S.panel.origin[2]);
    panel.rotation.x = Math.PI / 2 - S.panel.lean;
    top.name = 'synth top';
    panel.name = 'synth panel';
    this.group.add(top, panel);
    top.updateMatrix();
    panel.updateMatrix();
    /** @private */
    this._top = top;
    /** @private */
    this._panel = panel;
    const light = lightColor(P(W / 2, D / 2), N);
    const panelLight = lightColor(Q(W / 2, H / 2), PN);
    /** @private */
    this._dummy = new THREE.Object3D();
    /** @private */
    this._mat = new THREE.Matrix4();
    /** @private */
    this._color = new THREE.Color();

    // The keys: a box each, its colour and where it is written when it changes.
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.keys = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: light }), KEYS);
    this.keys.name = 'synth keys';
    this.group.add(this.keys);
    /** @private what each key is shown as: -1 not yet, else down (1) and pointed at (2) */
    this._keyShown = new Int8Array(KEYS).fill(-1);
    /** @private which keys' notes sound (setDown) */
    this._down = new Uint8Array(KEYS);
    /** @private the colour each key is lit in down, when another holds it (setDown), else null: the room's glow; and as last shown @type {(readonly number[] | null)[]} */
    this._tint = new Array(KEYS).fill(null);
    /** @private @type {(readonly number[] | null)[]} */
    this._tintShown = new Array(KEYS).fill(null);
    /** The key pointed at (or chosen with a TV's arrows), else -1. */
    this.hovered = -1;

    // The dials, and a line on each that shows where it is turned to.
    const { r, h } = SYNTH.dial, n = S.dials.length;
    this.dials = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2622').multiply(light) }), n);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0042, 0.002, r * 0.75), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }), n);
    this.dials.name = 'synth dials';
    this.marks.name = 'synth dial marks';
    this.group.add(this.dials, this.marks);
    /** @private */
    this._offset = new THREE.Matrix4().makeTranslation(0, 0, -r * 0.45);

    // The display, over its frame on the face.
    const Sd = S.panel.display, dw = Sd.a1 - Sd.a0, dd = Sd.b1 - Sd.b0;
    /** @private */
    this._display = canvas(600, Math.round((600 * dd) / dw));
    /** @private */
    this._displayTexture = texture(this._display, anisotropy);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(dw, dd).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this._displayTexture, color: panelLight }));
    display.position.set((Sd.a0 + Sd.a1) / 2, 0.001, -(Sd.b0 + Sd.b1) / 2);
    display.name = 'synth display';
    panel.add(display);

    // The lights: on each preset's cap, Mono's, each of the arpeggiator's ways and HOLD (not RANGE,
    // which goes round its octaves: the display shows them).
    const lamps = S.panel.buttons.filter((b) => b.id !== 'arp.range' && /^(mono|preset\.|arp\.)/.test(b.id));
    /**
     * @private what each light shows: a preset chosen (`id` its id), Mono, a way the arpeggiator plays
     * (its id), or HOLD
     * @type {{ on: 'preset' | 'mono' | 'arp' | 'hold', id: string }[]}
     */
    this._lightFor = lamps.map((b) => {
      if (b.id === 'mono') return { on: 'mono', id: '' };
      if (b.id === 'arp.hold') return { on: 'hold', id: '' };
      return b.id.startsWith('arp.') ? { on: 'arp', id: b.id.slice('arp.'.length) } : { on: 'preset', id: b.id.slice('preset.'.length) };
    });
    this.lights = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0042, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(), lamps.length);
    this.lights.name = 'synth lights';
    this.group.add(this.lights);
    lamps.forEach((b, l) => {
      const d = this._dummy;
      d.position.set(b.a0 + 0.009, BT + 0.0004, -(b.b1 - 0.009));
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.lights.setMatrixAt(l, this._mat.multiplyMatrices(panel.matrix, d.matrix));
    });
    /** @private each light on (1) or off (0) as last written, -1 never */
    this._lightShown = new Int8Array(lamps.length).fill(-1);

    // The sign on the wall, as wide as the synth.
    const G = S.sign, sw = G.x1 - G.x0, sh = G.y1 - G.y0, mid = [(G.x0 + G.x1) / 2, (G.y0 + G.y1) / 2, G.z];
    const plate = signPlate(1024, Math.round((1024 * sh) / sw), 'Synth', 'six analog voices');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: texture(plate, anisotropy), color: lightColor(mid, [0, 0, 1]) }));
    sign.position.set(mid[0], mid[1], mid[2]);
    this._add(sign, 'synth sign');

    /** @private the tips that play the keys: the sticks', then the forefingers' @type {KeyTip[]} */
    this._tips = [0, 1, 2, 3].map(() => ({ key: -1, h: 0, has: false }));
    /** @private */
    this._at = new THREE.Vector3();
    /** @private */
    this._under = { key: -1, over: -1, h: 0, top: 0 };
    /** @private what the display shows: the sound, mono, the keys' notes, the arpeggiator, the knob turned last */
    this._shown = { name: '', mono: false, keys: '', arp: '', last: '' };
    /** @private the preset chosen (its id), else null */
    this._preset = /** @type {string | null} */ (null);
    /** @private */
    this._mono = false;
    /** @private the way the arpeggiator plays (its id), else null: off; and HOLD */
    this._arpMode = /** @type {string | null} */ (null);
    /** @private */
    this._hold = false;
    /** @private */
    this._displayDirty = true;
    /** @private seconds since the display was drawn */
    this._displayAge = Infinity;
    this.setKnobs({ ...DEFAULT_SYNTH });
    for (let k = 0; k < KEYS; k++) this._writeKey(k);
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
   * Every dial turned to the knobs (0…1 each) at once (a preset, as it comes): the knob turned last
   * off the display.
   * @param {Readonly<Record<SynthKnob, number>>} knobs
   */
  setKnobs(knobs) {
    this.synth.dials.forEach((d, i) => this._turn(i, knobs[d.id]));
    if (this._shown.last) this._displayDirty = true;
    this._shown.last = '';
  }

  /**
   * A knob turned: its dial, and on the display its name and how it is set (`text`, synth.js
   * synthText).
   * @param {SynthKnob} id
   * @param {number} value
   * @param {string} text
   */
  setKnob(id, value, text) {
    const i = this.synth.dials.findIndex((d) => d.id === id);
    if (i < 0) return;
    this._turn(i, value);
    const last = `${knobName(id)}  ${text}`;
    if (last === this._shown.last) return;
    this._shown.last = last;
    this._displayDirty = true;
  }

  /**
   * The sound (synth.js Synth name), mono or poly, the preset chosen (its id, else null), the lowest
   * key's note and the arpeggiator (the way it plays, else null, its octaves and HOLD): on the display
   * (the keys' notes; the arpeggiator in short), and the lights.
   * @param {{ name: string, mono: boolean, preset: string | null, lowest: number, arp: { mode: string | null, range: number, hold: boolean } }} state
   */
  setState({ name, mono, preset, lowest, arp }) {
    const shown = this._shown, keys = `${noteName(lowest)}–${noteName(lowest + KEYS - 1)}`;
    const way = ARP_MODES.find((m) => m.id === arp.mode);
    const arpText = way ? `ARP ${way.label}  ·  ${arp.range} OCT${arp.hold ? '  ·  HOLD' : ''}` : 'ARP OFF';
    if (name !== shown.name || mono !== shown.mono || keys !== shown.keys || arpText !== shown.arp) this._displayDirty = true;
    shown.name = name;
    shown.mono = mono;
    shown.keys = keys;
    shown.arp = arpText;
    this._preset = preset;
    this._mono = mono;
    this._arpMode = way ? way.id : null;
    this._hold = arp.hold;
  }

  /**
   * The keys whose notes sound now (synth.js Synth down: from anywhere), the lowest key's note as it
   * is: those keys go down, lit in the room's glow, or in the colour of another who holds them in a
   * shared session (`tint`: a note's, linear, else null).
   * @param {ReadonlySet<number>} notes
   * @param {number} lowest
   * @param {((note: number) => readonly number[] | null) | null} [tint]
   */
  setDown(notes, lowest, tint = null) {
    for (let k = 0; k < KEYS; k++) {
      const down = notes.has(lowest + k);
      this._down[k] = down ? 1 : 0;
      this._tint[k] = down && tint ? tint(lowest + k) : null;
    }
  }

  /**
   * Dial i (S.dials) turned to `value` (0…1: from 135° left to 135° right), in the top's frame.
   * @private
   * @param {number} i
   * @param {number} value
   */
  _turn(i, value) {
    const d = this.synth.dials[i], o = this._dummy, h = SYNTH.dial.h;
    o.position.set(d.a, h / 2, -d.b);
    o.rotation.set(0, -(value - 0.5) * 1.5 * Math.PI, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    this.dials.setMatrixAt(i, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    o.position.y = h + 0.0012;
    o.updateMatrix();
    this.marks.setMatrixAt(i, this._mat.multiplyMatrices(this._top.matrix, o.matrix).multiply(this._offset));
    this.dials.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
  }

  /**
   * Key k as it is now, if that changed: up, or down and lit (in the room's glow, or the colour of
   * another who holds it); lighter pointed at. Whether it was written.
   * @private
   * @param {number} k
   */
  _writeKey(k) {
    const code = this._down[k] | (this.hovered === k ? 2 : 0), tint = this._tint[k];
    if (code === this._keyShown[k] && tint === this._tintShown[k]) return false;
    this._keyShown[k] = code;
    this._tintShown[k] = tint;
    const hue = tint ?? ROOM_GLOW;
    const K = SYNTH.key, q = this.synth.keys[k], o = this._dummy, pressed = (code & 1) === 1;
    const sink = pressed ? K.travel : 0;
    if (q.black) {
      o.position.set((q.a0 + q.a1) / 2, K.rise * 0.5 - sink, -(q.b0 + q.b1) / 2);
      o.scale.set(q.a1 - q.a0, K.rise * 0.5 + K.blackRise, q.b1 - q.b0);
    } else {
      o.position.set((q.a0 + q.a1) / 2, -sink, -(q.b0 + q.b1) / 2);
      o.scale.set(q.a1 - q.a0 - K.gap, K.rise, q.b1 - q.b0);
    }
    o.rotation.set(0, 0, 0);
    o.updateMatrix();
    this.keys.setMatrixAt(k, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    const base = q.black ? EBONY : IVORY, glow = q.black ? 0.8 : 0.6, lift = code & 2 ? (q.black ? 2.6 : 1.12) : 1;
    const c = this._color;
    if (pressed) c.setRGB(base[0] * (1 - glow) + hue[0] * glow * 1.3, base[1] * (1 - glow) + hue[1] * glow * 1.3, base[2] * (1 - glow) + hue[2] * glow * 1.3);
    else c.setRGB(base[0] * lift, base[1] * lift, base[2] * lift);
    this.keys.setColorAt(k, c);
    return true;
  }

  /**
   * Per frame: the keys written where they changed (down, pointed at), the lights, and the display
   * redrawn when it changed (at most ten times a second).
   * @param {number} dt
   */
  update(dt) {
    let keys = false;
    for (let k = 0; k < KEYS; k++) if (this._writeKey(k)) keys = true;
    if (keys) {
      this.keys.instanceMatrix.needsUpdate = true;
      if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    }
    if (this._writeLights() && this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    this._displayAge += dt;
    if (this._displayDirty && this._displayAge >= 0.1) this._drawDisplay();
  }

  /**
   * The lights as they are now, where they changed: on the preset chosen, on Mono, on the way the
   * arpeggiator plays and on HOLD. Whether any was written.
   * @private
   */
  _writeLights() {
    let wrote = false;
    for (let l = 0; l < this._lightFor.length; l++) {
      const f = this._lightFor[l];
      const lit = f.on === 'mono' ? this._mono : f.on === 'hold' ? this._hold : f.on === 'arp' ? f.id === this._arpMode : f.id === this._preset;
      const on = lit ? 1 : 0;
      if (on === this._lightShown[l]) continue;
      this._lightShown[l] = on;
      const c = on ? LIGHT.on : LIGHT.off;
      this.lights.setColorAt(l, this._color.setRGB(c[0], c[1], c[2]));
      wrote = true;
    }
    return wrote;
  }

  /** The display: the sound, mono or poly and the keys' notes, the arpeggiator, and the knob turned last. @private */
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
    g.fillText(s.name, 20, h * 0.2);
    g.fillStyle = '#6fbf93';
    const voices = `${s.mono ? 'MONO' : 'POLY'}  ·  KEYS ${s.keys}`;
    fit(g, voices, w - 40, 28);
    g.fillText(voices, 20, h * 0.45);
    g.fillStyle = s.arp === 'ARP OFF' ? '#3f6f58' : '#6fbf93';
    fit(g, s.arp, w - 40, 28);
    g.fillText(s.arp, 20, h * 0.66);
    if (s.last) {
      g.fillStyle = '#efe5cf';
      fit(g, s.last, w - 40, 28, '500');
      g.fillText(s.last, 20, h * 0.87);
    }
    this._displayTexture.needsUpdate = true;
  }

  /**
   * In VR, per frame, after kit.js's (whose sticks show near the synth too): each stick's tip while
   * it shows, else the forefinger of a hand without a controller, plays a key it goes down into.
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

  /** Back on a screen: every key a tip held let go, every tip forgotten. */
  endXR() {
    for (const t of this._tips) this._track(t, false, false, null, 0);
  }

  /**
   * One tip, now at this._at (when `active`): down into a key from over it plays it, as hard as it
   * went; back up LIFT over it, off it or through the top lets it go, and slid off onto another key
   * still down plays that.
   * @private
   * @param {KeyTip} tip
   * @param {boolean} active
   * @param {boolean} finger
   * @param {XRInputSource | null} source
   * @param {number} dt
   */
  _track(tip, active, finger, source, dt) {
    if (!active) {
      if (tip.key >= 0) this.onKeyUp(tip.key);
      tip.key = -1;
      tip.has = false;
      return;
    }
    const p = this._at, u = keyUnder(this.synth, p.x, p.y, p.z, this._under);
    const held = tip.key >= 0 && u.over === tip.key && u.h >= 0 && u.h < u.top + LIFT;
    if (tip.key >= 0 && !held) {
      this.onKeyUp(tip.key);
      tip.key = -1;
      if (u.key >= 0) {
        tip.key = u.key;
        this.onKeyDown(u.key, GLISS, source);
      }
    } else if (tip.key < 0 && u.key >= 0 && tip.has && tip.h >= u.top) {
      tip.key = u.key;
      this.onKeyDown(u.key, keyVelocity((tip.h - u.h) / Math.max(dt, 1e-3), finger), source);
    }
    tip.h = u.h;
    tip.has = true;
  }
}
