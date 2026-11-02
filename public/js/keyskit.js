// The keyboard in 3D (keysboard.js lays it out, keys.js says what is on it), as the synth is
// (synthkit.js): its stand, top and panel, lit as the room is (scene.js's bake, once, into vertex
// colours), with a cheek of wood either side of the keys; its keys, one instanced mesh, each going down
// and lit in the room's glow while its note sounds (from any key that plays it: the computer's, the
// card's, a MIDI keyboard's), a little lighter pointed at (or chosen with a TV's arrows); its
// drawbars, a tab each in its colour (brown the 16′ and the 5⅓′, white the note's and its octaves',
// black the rest, as an organ's) over its slot, as far towards the player as the drawbar is pulled
// out; its knobs, turned to the organ's and the piano's, with a line on each; the drawbars' slots, and
// the names of the drawbars, of the knobs and of their sections, on the top behind the keys, and the
// panel's face with its buttons' caps standing out of it, their names on them, and its jacks as the
// board's are (kit.js: its outs on a plate, the cables kit.js's too) (one canvas, drawn once); the
// display on the panel (the sound, the drawbars as an organist writes them or the piano's
// tone, the percussion, the rotary speaker or the tremolo, the octave and SUSTAIN, the knob turned
// last), redrawn when it changes, at most ten times a second; a light on the sound chosen, on each
// switch that is on and on SUSTAIN; and its sign on the wall over it. In VR a stick's tip (kit.js's
// sticks, which show near it too) or a forefinger going down into a key plays it, as hard as it went,
// and holds it until it comes up out of it; sliding off it onto the next, still down, plays that one.
// Per frame nothing is allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, boardPoint, panelPoint } from './board.js';
import { SYNTH, keyUnder, keyVelocity } from './synthboard.js';
import { KEYBOARD, tabB } from './keysboard.js';
import { DEFAULT_KEYS, KEYS_COUNT, KEYS_LOWEST, isDrawbar, keysKnobName, keysText, registration } from './keys.js';
import { JACKS } from './patch.js';
import { STICK, canvas, context, drawJack, drawPlate, fit, lin, signPlate, texture, times } from './kit.js';
import { GOLD, SANS } from './textures.js';

/** @typedef {import('./keysboard.js').KeysDesk} KeysDesk */
/** @typedef {import('./keys.js').KeysKnob} KeysKnob */
/** @typedef {import('./keys.js').KeysSwitch} KeysSwitch */
/** @typedef {import('./keys.js').KeysChoice} KeysChoice */
/** @typedef {import('./synthkit.js').KeyTip} KeyTip */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */

const WOOD = lin('#3b2a1d'), TOP = lin('#23211f'), RIM = lin('#151413');
/** The keys' colours (linear): ivory and ebony, and the room's glow a key sounding takes; as the synth's. */
const IVORY = lin('#ece6da'), EBONY = lin('#1c1a18'), GLOW = lin('#5cc8a8');
/** The drawbars' tabs (linear), as an organ's: brown, white and black. */
const TAB = { brown: lin('#7a3f22'), white: lin('#e9e3d5'), black: lin('#1e1c1a') };
/** Which drawbars' tabs are brown (the 16′ and the 5⅓′) and which white (the note's and its octaves'); the rest black. @type {Readonly<Partial<Record<KeysKnob, 'brown' | 'white'>>>} */
const TABS = { d16: 'brown', d513: 'brown', d8: 'white', d4: 'white', d2: 'white', d1: 'white' };
/** The lights on the sound chosen, the switches on and SUSTAIN: off, on (linear). */
const LIGHT = { off: lin('#2a1d18'), on: lin('#f2b648') };
/** How hard a key slid onto, still down, is played (a glissando), and how far over its key's top a tip must come back up to let it go: as the synth's. */
const GLISS = 0.6, LIFT = 0.004;
/** The canvas drawn once: this many pixels across the keyboard (half as wide again as the synth, as sharp). */
const ATLAS = 3072;

/**
 * What is drawn once, on one canvas: the top behind the keys (the sections named with a line across
 * each, the drawbars' and the knobs' names, the drawbars' slots with a mark at each step) over the
 * panel's face (the display's frame, the names over the buttons and the jacks, its jacks, each
 * button's cap with its name, the keyboard's own). `deck` and `panel`: where each is, in the canvas's
 * rows.
 * @param {KeysDesk} K
 */
function faces(K) {
  const W = K.width, P = K.panel, D = K.deck, R = K.row, k = ATLAS / W;
  const dh = Math.round((D.b1 - D.b0) * k), ph = Math.round(P.height * k);
  const c = canvas(ATLAS, dh + ph), g = context(c);
  const x = (/** @type {number} */ a) => a * k;
  const deckY = (/** @type {number} */ b) => (D.b1 - b) * k;
  const panelY = (/** @type {number} */ b) => dh + (P.height - b) * k;
  g.fillStyle = '#23211f';
  g.fillRect(0, 0, ATLAS, dh);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const titleY = deckY((R.titles.b0 + R.titles.b1) / 2), nameY = deckY((R.names.b0 + R.names.b1) / 2);
  for (const s of K.sections) {
    const mid = x((s.a0 + s.a1) / 2);
    g.font = `600 ${Math.round(0.0092 * k)}px ${SANS}`;
    const half = g.measureText(s.label).width / 2 + 12;
    g.fillStyle = GOLD;
    g.fillText(s.label, mid, titleY);
    g.strokeStyle = 'rgba(224,187,114,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(s.a0 + 0.008), titleY - 8);
    g.lineTo(x(s.a0 + 0.008), titleY);
    g.lineTo(mid - half, titleY);
    g.moveTo(mid + half, titleY);
    g.lineTo(x(s.a1 - 0.008), titleY);
    g.lineTo(x(s.a1 - 0.008), titleY - 8);
    g.stroke();
  }
  g.fillStyle = '#efe5cf';
  for (const d of K.dials) {
    fit(g, d.label, SYNTH.dial.spacing * k - 12, Math.round(0.0085 * k));
    g.fillText(d.label, x(d.a), nameY);
  }
  // The drawbars: each one's name, and its slot (a dark well) with a mark at each step, longer at 0,
  // 4 and 8, either side of it.
  const { spacing, grip, slot } = KEYBOARD.drawbar, well = 0.012 * k;
  for (const d of K.drawbars) {
    g.fillStyle = '#efe5cf';
    fit(g, d.label, spacing * k - 8, Math.round(0.0095 * k));
    g.fillText(d.label, x(d.a), nameY);
    g.fillStyle = '#0f0e0d';
    g.beginPath();
    g.roundRect(x(d.a) - well / 2, deckY(d.b1), well, (d.b1 - d.b0) * k, well / 2);
    g.fill();
    g.strokeStyle = 'rgba(239,229,207,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    for (let n = 0; n <= 8; n++) {
      const y = deckY(d.b1 - grip / 2 - (n / 8) * (slot - grip)), long = n % 4 === 0 ? 7 : 4;
      g.moveTo(x(d.a) - well / 2 - 3 - long, y);
      g.lineTo(x(d.a) - well / 2 - 3, y);
      g.moveTo(x(d.a) + well / 2 + 3, y);
      g.lineTo(x(d.a) + well / 2 + 3 + long, y);
    }
    g.stroke();
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
  g.font = `600 ${Math.round(0.0105 * k)}px ${SANS}`;
  for (const t of P.titles) {
    const y = panelY(t.b);
    g.fillStyle = GOLD;
    g.fillText(t.text, x(t.a), y);
    if (t.a0 === undefined || t.a1 === undefined) continue;
    // Over a span (its jacks'): a line along it either side of the name, its ends turned down to what
    // it names, as the synth's.
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
  // Its jacks, as the board's: the outputs on a plate, each with what it is under it.
  drawPlate(g, P.jacks.filter((j) => j.out), x, panelY, k);
  for (const j of P.jacks) {
    drawJack(g, x(j.a), panelY(j.b), BOARD.panel.jack * k);
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
  // Its own name, at the foot of the panel's right.
  g.fillStyle = GOLD;
  g.font = `italic 600 ${Math.round(0.0115 * k)}px ${SANS}`;
  g.textAlign = 'right';
  g.fillText('Sixty-one keys', x(W - 0.03), panelY(0.047));
  return { canvas: c, deck: dh, panel: ph };
}

/**
 * A block standing on the top in its frame (P: boardPoint's), a0…a1 across, b0…b1 up it and h0…h1
 * out of it: its top, front, back and sides (as synthkit.js's).
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

/** An octave as the display writes it: 0, +1, −2. @param {number} o */
const signed = (o) => (o > 0 ? `+${o}` : o < 0 ? `−${-o}` : '0');

export class KeysKit {
  /**
   * @param {KeysDesk} K
   * @param {object} o
   * @param {(builder: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's colours (scene.js)
   * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
   * @param {number} [o.anisotropy]
   */
  constructor(K, { lit, lightColor, anisotropy = 1 }) {
    this.desk = K;
    this.group = new THREE.Group();
    this.group.name = 'keys';
    /** (k, velocity, source) a stick's tip or a forefinger went down into key k. @type {(k: number, velocity: number, source: XRInputSource | null) => void} */
    this.onKeyDown = () => {};
    /** (k) it came up out of key k, or off it. @type {(k: number) => void} */
    this.onKeyUp = () => {};
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(K, a, b, h, [0, 0, 0]);
    const Q = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => panelPoint(K, a, b, h, [0, 0, 0]);
    const W = K.width, D = K.length, T = KEYBOARD.thick, H = K.panel.height, PT = KEYBOARD.panel.thick, BT = KEYBOARD.panel.button;
    const across = [W, 0, 0], along = times(K.up, D), down = times(K.normal, T), back = times(K.up, -1);
    const N = K.normal, U = K.up, PU = K.panel.up, PN = K.panel.normal;

    // The stand, the top and its cheeks, the panel's edges and back, the buttons' sides: one mesh, lit once.
    const stand = new Builder();
    stand.quad(P(0, 0), across, along, { normal: N, albedo: TOP });
    stand.quad(P(0, 0, -T), across, down, { normal: back, albedo: WOOD });
    stand.quad(P(0, D, -T), across, down, { normal: U, albedo: WOOD });
    stand.quad(P(0, 0, -T), along, down, { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(P(W, 0, -T), along, down, { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(P(0, 0, -T), across, along, { normal: times(N, -1), albedo: WOOD });
    const cheek = SYNTH.key.margin - 0.008, bed = K.bed;
    block(stand, P, N, U, [0.004, 0.004 + cheek, 0, bed.b1 + 0.014, 0, 0.034], WOOD);
    block(stand, P, N, U, [W - 0.004 - cheek, W - 0.004, 0, bed.b1 + 0.014, 0, 0.034], WOOD);
    // A rail behind the keys, as high as the white keys' tops and a little over.
    block(stand, P, N, U, [bed.a0, bed.a1, bed.b1 + 0.001, bed.b1 + 0.007, 0, SYNTH.key.rise + 0.002], RIM);
    for (const [a, b] of [[0.05, 0.06], [W - 0.05, 0.06], [0.05, D - 0.06], [W - 0.05, D - 0.06]]) {
      const p = P(a, b, -T);
      stand.box([p[0] - 0.025, 0, p[2] - 0.025], [p[0] + 0.025, p[1] + 0.01, p[2] + 0.025], { albedo: WOOD, skip: ['-y'] });
    }
    const front = P(0, 0.06, -T), rear = P(0, D - 0.06, -T);
    stand.box([K.x0 + 0.03, 0.18, rear[2]], [K.x1 - 0.03, 0.21, front[2]], { albedo: WOOD });
    stand.quad(Q(0, H), [W, 0, 0], times(PN, -PT), { normal: PU, albedo: WOOD });
    stand.quad(Q(0, 0), times(PU, H), times(PN, -PT), { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(Q(W, 0), times(PU, H), times(PN, -PT), { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PU, H), { normal: times(PN, -1), albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PN, PT), { normal: times(PU, -1), albedo: WOOD });
    const rise = times(PN, BT);
    for (const b of K.panel.buttons) {
      const bw = b.a1 - b.a0, side = times(PU, b.b1 - b.b0);
      stand.quad(Q(b.a0, b.b0), [bw, 0, 0], rise, { normal: times(PU, -1), albedo: RIM });
      stand.quad(Q(b.a0, b.b1), [bw, 0, 0], rise, { normal: PU, albedo: RIM });
      stand.quad(Q(b.a0, b.b0), side, rise, { normal: [-1, 0, 0], albedo: RIM });
      stand.quad(Q(b.a1, b.b0), side, rise, { normal: [1, 0, 0], albedo: RIM });
    }
    this._add(new THREE.Mesh(lit(stand), new THREE.MeshBasicMaterial({ vertexColors: true })), 'keys stand');

    // The names and the slots on the top, the panel's face and the buttons' caps, each a quad on the one canvas.
    const drawn = faces(K), rows = drawn.deck + drawn.panel;
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
    mapped(P(0, K.deck.b0, 0.0015), across, times(U, K.deck.b1 - K.deck.b0), [0, 1], deckV);
    mapped(Q(0, 0, 0.0005), across, times(PU, H), [0, 1], panelV);
    const pv = (/** @type {number} */ b) => panelV[0] + (b / H) * (panelV[1] - panelV[0]);
    for (const b of K.panel.buttons) mapped(Q(b.a0, b.b0, BT), [b.a1 - b.a0, 0, 0], times(PU, b.b1 - b.b0), [b.a0 / W, b.a1 / W], [pv(b.b0), pv(b.b1)]);
    this._add(new THREE.Mesh(lit(faceBuilder), new THREE.MeshBasicMaterial({ map: texture(drawn.canvas, anisotropy), vertexColors: true })), 'keys faces');

    // On the top and on the panel, in their own frames, as the board's (kit.js).
    const top = new THREE.Group(), panel = new THREE.Group();
    top.position.set(K.origin[0], K.origin[1], K.origin[2]);
    top.rotation.x = K.tilt;
    panel.position.set(K.panel.origin[0], K.panel.origin[1], K.panel.origin[2]);
    panel.rotation.x = Math.PI / 2 - K.panel.lean;
    top.name = 'keys top';
    panel.name = 'keys panel';
    this.group.add(top, panel);
    top.updateMatrix();
    panel.updateMatrix();
    /** @private */
    this._top = top;
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
    this.keys = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: light }), KEYS_COUNT);
    this.keys.name = 'keys keys';
    this.group.add(this.keys);
    /** @private what each key is shown as: -1 not yet, else down (1) and pointed at (2) */
    this._keyShown = new Int8Array(KEYS_COUNT).fill(-1);
    /** @private which keys' notes sound (setDown) */
    this._down = new Uint8Array(KEYS_COUNT);
    /** The key pointed at (or chosen with a TV's arrows), else -1. */
    this.hovered = -1;

    // The drawbars' tabs, each in its colour.
    const { tab, grip, h: th } = KEYBOARD.drawbar;
    this.tabs = new THREE.InstancedMesh(new THREE.BoxGeometry(tab, th, grip).translate(0, th / 2, 0), new THREE.MeshBasicMaterial({ color: light }), K.drawbars.length);
    this.tabs.name = 'keys drawbars';
    this.group.add(this.tabs);
    K.drawbars.forEach((d, i) => {
      const c = TAB[TABS[d.id] ?? 'black'];
      this.tabs.setColorAt(i, this._color.setRGB(c[0], c[1], c[2]));
    });

    // The knobs, and a line on each that shows where it is turned to.
    const { r, h } = SYNTH.dial, n = K.dials.length;
    this.dials = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2622').multiply(light) }), n);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0042, 0.002, r * 0.75), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }), n);
    this.dials.name = 'keys knobs';
    this.marks.name = 'keys knob marks';
    this.group.add(this.dials, this.marks);
    /** @private */
    this._offset = new THREE.Matrix4().makeTranslation(0, 0, -r * 0.45);

    // The display, over its frame on the face.
    const Sd = K.panel.display, dw = Sd.a1 - Sd.a0, dd = Sd.b1 - Sd.b0;
    /** @private */
    this._display = canvas(600, Math.round((600 * dd) / dw));
    /** @private */
    this._displayTexture = texture(this._display, anisotropy);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(dw, dd).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this._displayTexture, color: panelLight }));
    display.position.set((Sd.a0 + Sd.a1) / 2, 0.001, -(Sd.b0 + Sd.b1) / 2);
    display.name = 'keys display';
    panel.add(display);

    // The lights: on each sound's cap, each switch's and SUSTAIN's (not the octave's).
    const lamps = K.panel.buttons.filter((b) => !b.id.startsWith('octave.'));
    /** @private what each light shows: the sound chosen (`id` its id), a switch on (its id), or SUSTAIN @type {{ on: 'sound' | 'switch' | 'sustain', id: string }[]} */
    this._lightFor = lamps.map((b) => {
      if (b.id === 'sustain') return { on: 'sustain', id: '' };
      const [on, id] = b.id.split('.');
      return { on: on === 'sound' ? 'sound' : 'switch', id };
    });
    this.lights = new THREE.InstancedMesh(new THREE.CircleGeometry(0.0042, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial(), lamps.length);
    this.lights.name = 'keys lights';
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

    // The sign on the wall, as wide as the keyboard.
    const G = K.sign, sw = G.x1 - G.x0, sh = G.y1 - G.y0, mid = [(G.x0 + G.x1) / 2, (G.y0 + G.y1) / 2, G.z];
    const plate = signPlate(1024, Math.round((1024 * sh) / sw), 'Keys', 'an organ and an electric piano');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: texture(plate, anisotropy), color: lightColor(mid, [0, 0, 1]) }));
    sign.position.set(mid[0], mid[1], mid[2]);
    this._add(sign, 'keys sign');

    /** @private the tips that play the keys: the sticks', then the forefingers' @type {KeyTip[]} */
    this._tips = [0, 1, 2, 3].map(() => ({ key: -1, h: 0, has: false }));
    /** @private */
    this._at = new THREE.Vector3();
    /** @private */
    this._under = { key: -1, over: -1, h: 0, top: 0 };
    /** @private what the display shows: the sound, its two lines, the knob turned last */
    this._shown = { name: '', first: '', second: '', last: '' };
    /** @private the sound chosen, the switches, SUSTAIN: for the lights */
    this._choice = /** @type {KeysChoice} */ ('organ');
    /** @private @type {Record<KeysSwitch, boolean>} */
    this._switches = { perc: false, third: false, fast: false, rotaryFast: false };
    /** @private */
    this._sustain = false;
    /** @private */
    this._displayDirty = true;
    /** @private seconds since the display was drawn */
    this._displayAge = Infinity;
    this.setKnobs({ ...DEFAULT_KEYS });
    for (let k = 0; k < KEYS_COUNT; k++) this._writeKey(k);
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
   * Every drawbar pulled and every knob turned to the keyboard's (0…1 each) at once (reset): the knob
   * turned last off the display.
   * @param {Readonly<Record<KeysKnob, number>>} knobs
   */
  setKnobs(knobs) {
    this.desk.drawbars.forEach((d, i) => this._pull(i, knobs[d.id]));
    this.desk.dials.forEach((d, i) => this._turn(i, knobs[d.id]));
    if (this._shown.last) this._displayDirty = true;
    this._shown.last = '';
  }

  /**
   * A drawbar pulled or a knob turned: its tab or its knob, and on the display its name and how it is
   * set (`text`, keys.js keysText).
   * @param {KeysKnob} id
   * @param {number} value
   * @param {string} text
   */
  setKnob(id, value, text) {
    const K = this.desk;
    if (isDrawbar(id)) {
      const i = K.drawbars.findIndex((d) => d.id === id);
      if (i >= 0) this._pull(i, value);
    } else {
      const i = K.dials.findIndex((d) => d.id === id);
      if (i >= 0) this._turn(i, value);
    }
    const last = `${keysKnobName(id)}  ${text}`;
    if (last === this._shown.last) return;
    this._shown.last = last;
    this._displayDirty = true;
  }

  /**
   * The keyboard as it is (keys.js Keys: the sound, its name, the knobs, the switches, the octave the
   * computer's keys play in, SUSTAIN): on the display, and the lights.
   * @param {{ choice: KeysChoice, name: string, knobs: Readonly<Record<KeysKnob, number>>, switches: Readonly<Record<KeysSwitch, boolean>>, octave: number, sustain: boolean }} state
   */
  setState({ choice, name, knobs, switches, octave, sustain }) {
    const organ = choice !== 'epiano', s = switches;
    const perc = s.perc ? `PERC ${s.third ? '3RD' : '2ND'} ${s.fast ? 'FAST' : 'SLOW'}` : 'PERC OFF';
    const first = organ ? `${registration(knobs)}  ·  ${perc}` : `TONE ${keysText('tone', knobs.tone)}  ·  BARK ${keysText('bark', knobs.bark)}`;
    const second = `${organ ? `ROTARY ${s.rotaryFast ? 'FAST' : 'SLOW'}` : `TREMOLO ${keysText('tremolo', knobs.tremolo).toUpperCase()}`}  ·  OCTAVE ${signed(octave)}${sustain ? '  ·  SUSTAIN' : ''}`;
    const shown = this._shown;
    if (name !== shown.name || first !== shown.first || second !== shown.second) this._displayDirty = true;
    shown.name = name;
    shown.first = first;
    shown.second = second;
    this._choice = choice;
    this._switches = { ...switches };
    this._sustain = sustain;
  }

  /**
   * The keys whose notes sound now (keys.js Keys down: from anywhere): those keys go down, lit.
   * @param {ReadonlySet<number>} notes
   */
  setDown(notes) {
    for (let k = 0; k < KEYS_COUNT; k++) this._down[k] = notes.has(KEYS_LOWEST + k) ? 1 : 0;
  }

  /**
   * Drawbar i's tab where it is pulled out to (0…1: from the back of its slot to the front), in the
   * top's frame.
   * @private
   * @param {number} i
   * @param {number} value
   */
  _pull(i, value) {
    const d = this.desk.drawbars[i], o = this._dummy;
    o.position.set(d.a, 0, -tabB(this.desk, value));
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    o.updateMatrix();
    this.tabs.setMatrixAt(i, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    this.tabs.instanceMatrix.needsUpdate = true;
  }

  /**
   * Knob i (K.dials) turned to `value` (0…1: from 135° left to 135° right), in the top's frame.
   * @private
   * @param {number} i
   * @param {number} value
   */
  _turn(i, value) {
    const d = this.desk.dials[i], o = this._dummy, h = SYNTH.dial.h;
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
   * Key k as it is now, if that changed: up, or down and lit; lighter pointed at. Whether it was written.
   * @private
   * @param {number} k
   */
  _writeKey(k) {
    const code = this._down[k] | (this.hovered === k ? 2 : 0);
    if (code === this._keyShown[k]) return false;
    this._keyShown[k] = code;
    const S = SYNTH.key, q = this.desk.keys[k], o = this._dummy, pressed = (code & 1) === 1;
    const sink = pressed ? S.travel : 0;
    if (q.black) {
      o.position.set((q.a0 + q.a1) / 2, S.rise * 0.5 - sink, -(q.b0 + q.b1) / 2);
      o.scale.set(q.a1 - q.a0, S.rise * 0.5 + S.blackRise, q.b1 - q.b0);
    } else {
      o.position.set((q.a0 + q.a1) / 2, -sink, -(q.b0 + q.b1) / 2);
      o.scale.set(q.a1 - q.a0 - S.gap, S.rise, q.b1 - q.b0);
    }
    o.rotation.set(0, 0, 0);
    o.updateMatrix();
    this.keys.setMatrixAt(k, this._mat.multiplyMatrices(this._top.matrix, o.matrix));
    const base = q.black ? EBONY : IVORY, glow = q.black ? 0.8 : 0.6, lift = code & 2 ? (q.black ? 2.6 : 1.12) : 1;
    const c = this._color;
    if (pressed) c.setRGB(base[0] * (1 - glow) + GLOW[0] * glow * 1.3, base[1] * (1 - glow) + GLOW[1] * glow * 1.3, base[2] * (1 - glow) + GLOW[2] * glow * 1.3);
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
    for (let k = 0; k < KEYS_COUNT; k++) if (this._writeKey(k)) keys = true;
    if (keys) {
      this.keys.instanceMatrix.needsUpdate = true;
      if (this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    }
    if (this._writeLights() && this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true;
    this._displayAge += dt;
    if (this._displayDirty && this._displayAge >= 0.1) this._drawDisplay();
  }

  /**
   * The lights as they are now, where they changed: on the sound chosen, on each switch that is on,
   * on SUSTAIN. Whether any was written.
   * @private
   */
  _writeLights() {
    let wrote = false;
    for (let l = 0; l < this._lightFor.length; l++) {
      const f = this._lightFor[l];
      const lit = f.on === 'sustain' ? this._sustain : f.on === 'sound' ? f.id === this._choice : this._switches[/** @type {KeysSwitch} */ (f.id)];
      const on = lit ? 1 : 0;
      if (on === this._lightShown[l]) continue;
      this._lightShown[l] = on;
      const c = on ? LIGHT.on : LIGHT.off;
      this.lights.setColorAt(l, this._color.setRGB(c[0], c[1], c[2]));
      wrote = true;
    }
    return wrote;
  }

  /** The display: the sound, its two lines, and the knob turned last. @private */
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
    fit(g, s.first, w - 40, 28);
    g.fillText(s.first, 20, h * 0.45);
    fit(g, s.second, w - 40, 28);
    g.fillText(s.second, 20, h * 0.66);
    if (s.last) {
      g.fillStyle = '#efe5cf';
      fit(g, s.last, w - 40, 28, '500');
      g.fillText(s.last, 20, h * 0.87);
    }
    this._displayTexture.needsUpdate = true;
  }

  /**
   * In VR, per frame, after kit.js's (whose sticks show near the keyboard too): each stick's tip while
   * it shows, else the forefinger of a hand without a controller, plays a key it goes down into, as
   * the synth's (synthkit.js).
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
    const p = this._at, u = keyUnder(this.desk, p.x, p.y, p.z, this._under);
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
