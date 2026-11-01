// The rack in 3D (rackboard.js lays it out, seq.js says what is on it), as the synth is (synthkit.js):
// its stand, top and panel, lit as the room is (scene.js's bake, once, into vertex colours); its keys,
// one instanced mesh, each step's lit in the room's glow where it plays and its accent's and slide's
// where they are set, the step playing lit up as the clock goes round, a key a little lighter pointed
// at (or chosen with a TV's arrows); the knobs, each step's turned to its note, and the tempo's; on one
// canvas, drawn once, what is written on the top (the steps' numbers, the rows' names) over the
// panel's face (its modules' plates and names, the displays' frames, the jacks as the board's are,
// kit.js: its outs on plates, the cables kit.js's too, and the buttons' caps); on another, redrawn when
// it changes, at most ten times a second, the names of the steps' notes behind their keys and the two
// displays (the tempo; the octave and what was set last); RUN's light, lit while the clock runs and
// brighter on each beat, as the board's; and its sign on the wall over it. In VR a stick's tip (kit.js's
// sticks, which show near it too) or a forefinger coming down on a key presses it. Per frame nothing is
// allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, REARM, boardPoint, heightOver, panelPoint } from './board.js';
import { RACK, SEQ_ROWS, rackStrike } from './rackboard.js';
import { STEPS } from './pattern.js';
import { SEQ_RANGE } from './seq.js';
import { noteName } from './synth.js';
import { TEMPO } from './clock.js';
import { JACKS } from './patch.js';
import { STICK, canvas, context, drawJack, drawPlate, fit, lin, signPlate, texture, times } from './kit.js';
import { GOLD, SANS } from './textures.js';

/** @typedef {import('./rackboard.js').RackDesk} RackDesk */
/** @typedef {import('./rackboard.js').SeqRow} SeqRow */
/** @typedef {import('./seq.js').SeqStep} SeqStep */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */

const WOOD = lin('#3b2a1d'), RIM = lin('#151413');
/** A key's cap: dark; a step's lit in the room's glow where it plays, an accent's and a slide's in theirs where set (linear). */
const CAP = lin('#3a3632'), GLOW = lin('#5cc8a8'), ACCENT = lin('#e8703c'), SLIDE = lin('#f2b648');
/** RUN's light: off, lit while the clock runs, and as bright as a beat makes it (linear), as the board's. */
const LED = { off: lin('#2a1d18'), on: lin('#36c766'), beat: lin('#dcffe6') };
/** The canvas drawn once: this many pixels across the rack. */
const ATLAS = 1536;
/** The canvas redrawn: the notes' names in a band across it, under it the two displays side by side, each `display` wide. */
const VALUES = { w: 1024, band: 32, display: 512 };

/**
 * What is drawn once, on one canvas: the top (the steps' numbers along its front edge, the first of
 * each four in gold, a line between the fours, the rows' names in the margin) over the panel's face
 * (the case between its modules, each module's plate with a screw at each corner and its name, the
 * displays' frames, the outs' plates, the jacks with what each is under it, the buttons' caps with
 * their names, the names of the tempo's knob and the octave's buttons). `top` and `panel`: how many of
 * its rows each takes.
 * @param {RackDesk} R
 */
function faces(R) {
  const W = R.width, P = R.panel, k = ATLAS / W;
  const th = Math.round(R.length * k), ph = Math.round(P.height * k);
  const c = canvas(ATLAS, th + ph), g = context(c);
  const x = (/** @type {number} */ a) => a * k;
  const topY = (/** @type {number} */ b) => (R.length - b) * k;
  const panelY = (/** @type {number} */ b) => th + (P.height - b) * k;
  g.fillStyle = '#23211f';
  g.fillRect(0, 0, ATLAS, th);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 ${Math.round(0.0115 * k)}px ${SANS}`;
  for (let s = 0; s < STEPS; s++) {
    const q = R.keys[s];
    g.fillStyle = s % 4 === 0 ? GOLD : '#efe5cf';
    g.fillText(String(s + 1), x((q.a0 + q.a1) / 2), topY((R.numbers.b0 + R.numbers.b1) / 2));
  }
  g.strokeStyle = 'rgba(224,187,114,0.3)';
  g.lineWidth = 2;
  const back = R.knobs[0].b + RACK.knob.r + 0.008;
  for (let f = 4; f < STEPS; f += 4) {
    const a = (R.keys[f - 1].a1 + R.keys[f].a0) / 2;
    g.beginPath();
    g.moveTo(x(a), topY(0.012));
    g.lineTo(x(a), topY(back));
    g.stroke();
  }
  g.fillStyle = GOLD;
  for (const l of R.labels) {
    fit(g, l.text, x(RACK.step.left) - 20, Math.round(0.0092 * k));
    g.fillText(l.text, x(RACK.step.left / 2), topY(l.b));
  }
  // The panel, its top edge against the top's back edge in the canvas: the case, then its modules.
  g.fillStyle = '#141311';
  g.fillRect(0, th, ATLAS, ph);
  for (const m of P.modules) {
    const mx = x(m.a0), my = panelY(P.height - 0.006), mw = x(m.a1) - mx, mh = panelY(0.006) - my;
    g.fillStyle = m.id === 'blank' ? '#24211e' : '#2b2824';
    g.beginPath();
    g.roundRect(mx, my, mw, mh, 6);
    g.fill();
    for (const [sx, sy] of [[mx + 14, my + 14], [mx + mw - 14, my + 14], [mx + 14, my + mh - 14], [mx + mw - 14, my + mh - 14]]) {
      g.fillStyle = '#8d877d';
      g.beginPath();
      g.arc(sx, sy, 6, 0, 2 * Math.PI);
      g.fill();
      g.strokeStyle = '#3d3934';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(sx - 4, sy);
      g.lineTo(sx + 4, sy);
      g.stroke();
    }
  }
  for (const d of Object.values(P.displays)) {
    g.fillStyle = '#0d1714';
    g.strokeStyle = 'rgba(224,187,114,0.45)';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(x(d.a0) - 6, panelY(d.b1) - 6, x(d.a1) - x(d.a0) + 12, panelY(d.b0) - panelY(d.b1) + 12, 12);
    g.fill();
    g.stroke();
  }
  for (const t of P.titles) {
    g.fillStyle = GOLD;
    g.font = `600 ${Math.round((t.b > 0.2 ? 0.0125 : 0.0105) * k)}px ${SANS}`;
    g.fillText(t.text, x(t.a), panelY(t.b));
  }
  // The outs on plates: the clock's, and the sequencer's notes.
  for (const prefix of ['rack.', 'seq.notes']) drawPlate(g, P.jacks.filter((j) => j.id.startsWith(prefix)), x, panelY, k);
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
    g.fillText(b.label, bx + bw / 2, by + bh * (sign ? 0.5 : 0.66));
  }
  // What the sequencer is, in the room left on its plate.
  g.fillStyle = GOLD;
  g.font = `italic 600 ${Math.round(0.0115 * k)}px ${SANS}`;
  g.textAlign = 'right';
  g.fillText('Sixteen steps', x(P.displays.seq.a1), panelY(0.118));
  return { canvas: c, top: th, panel: ph };
}

/**
 * A tip that presses the keys (a stick's, a forefinger's): where it was last frame, whether there was
 * a last frame, and whether it is up off the keys, so may press one when it comes down.
 * @typedef {{ x: number, y: number, z: number, has: boolean, armed: boolean }} KeyTip
 */

export class RackKit {
  /**
   * @param {RackDesk} R
   * @param {object} o
   * @param {(builder: Builder) => THREE.BufferGeometry} o.lit the room's light baked into a builder's colours (scene.js)
   * @param {(p: number[], n: number[]) => THREE.Color} o.lightColor the room's light at a point facing n
   * @param {number} [o.anisotropy]
   */
  constructor(R, { lit, lightColor, anisotropy = 1 }) {
    this.rack = R;
    this.group = new THREE.Group();
    this.group.name = 'rack';
    /** (row, s, source) a stick's tip or a forefinger came down on step s's key in that row. @type {(row: SeqRow, s: number, source: XRInputSource | null) => void} */
    this.onKey = () => {};
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(R, a, b, h, [0, 0, 0]);
    const Q = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => panelPoint(R, a, b, h, [0, 0, 0]);
    const W = R.width, D = R.length, T = RACK.thick, H = R.panel.height, PT = RACK.panel.thick, BT = RACK.panel.button;
    const across = [W, 0, 0], along = times(R.up, D), down = times(R.normal, T), back = times(R.up, -1);
    const N = R.normal, PU = R.panel.up, PN = R.panel.normal;

    // The stand, the top, the panel's edges and back, the buttons' sides: one mesh, lit once.
    const stand = new Builder();
    stand.quad(P(0, 0), across, along, { normal: N, albedo: lin('#23211f') });
    stand.quad(P(0, 0, -T), across, down, { normal: back, albedo: WOOD });
    stand.quad(P(0, D, -T), across, down, { normal: R.up, albedo: WOOD });
    stand.quad(P(0, 0, -T), along, down, { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(P(W, 0, -T), along, down, { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(P(0, 0, -T), across, along, { normal: times(N, -1), albedo: WOOD });
    for (const [a, b] of [[0.05, 0.06], [W - 0.05, 0.06], [0.05, D - 0.06], [W - 0.05, D - 0.06]]) {
      const p = P(a, b, -T);
      stand.box([p[0] - 0.025, 0, p[2] - 0.025], [p[0] + 0.025, p[1] + 0.01, p[2] + 0.025], { albedo: WOOD, skip: ['-y'] });
    }
    const front = P(0, 0.06, -T), rear = P(0, D - 0.06, -T);
    stand.box([R.x0 + 0.03, 0.18, rear[2]], [R.x1 - 0.03, 0.21, front[2]], { albedo: WOOD });
    stand.quad(Q(0, H), [W, 0, 0], times(PN, -PT), { normal: PU, albedo: WOOD });
    stand.quad(Q(0, 0), times(PU, H), times(PN, -PT), { normal: [-1, 0, 0], albedo: WOOD });
    stand.quad(Q(W, 0), times(PU, H), times(PN, -PT), { normal: [1, 0, 0], albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PU, H), { normal: times(PN, -1), albedo: WOOD });
    stand.quad(Q(0, 0, -PT), [W, 0, 0], times(PN, PT), { normal: times(PU, -1), albedo: WOOD });
    const rise = times(PN, BT);
    for (const b of R.panel.buttons) {
      const bw = b.a1 - b.a0, side = times(PU, b.b1 - b.b0);
      stand.quad(Q(b.a0, b.b0), [bw, 0, 0], rise, { normal: times(PU, -1), albedo: RIM });
      stand.quad(Q(b.a0, b.b1), [bw, 0, 0], rise, { normal: PU, albedo: RIM });
      stand.quad(Q(b.a0, b.b0), side, rise, { normal: [-1, 0, 0], albedo: RIM });
      stand.quad(Q(b.a1, b.b0), side, rise, { normal: [1, 0, 0], albedo: RIM });
    }
    this._add(new THREE.Mesh(lit(stand), new THREE.MeshBasicMaterial({ vertexColors: true })), 'rack stand');

    // What is written on the top, the panel's face and the buttons' caps, each a quad on the one canvas.
    const drawn = faces(R), rows = drawn.top + drawn.panel;
    const topV = [1 - drawn.top / rows, 1], panelV = [0, 1 - drawn.top / rows];
    const faceBuilder = new Builder();
    /**
     * A quad from o along u and v, showing the part of a canvas us (across) by vs (up).
     * @param {Builder} into
     * @param {number[]} o
     * @param {number[]} u
     * @param {number[]} v
     * @param {number[]} us
     * @param {number[]} vs
     */
    const mapped = (into, o, u, v, us, vs) => {
      const first = into.uvs.length;
      into.quad(o, u, v);
      for (let i = first; i < into.uvs.length; i += 2) {
        into.uvs[i] = us[0] + into.uvs[i] * (us[1] - us[0]);
        into.uvs[i + 1] = vs[0] + into.uvs[i + 1] * (vs[1] - vs[0]);
      }
    };
    mapped(faceBuilder, P(0, 0, 0.0015), across, along, [0, 1], topV);
    mapped(faceBuilder, Q(0, 0, 0.0005), across, times(PU, H), [0, 1], panelV);
    const pv = (/** @type {number} */ b) => panelV[0] + (b / H) * (panelV[1] - panelV[0]);
    for (const b of R.panel.buttons) mapped(faceBuilder, Q(b.a0, b.b0, BT), [b.a1 - b.a0, 0, 0], times(PU, b.b1 - b.b0), [b.a0 / W, b.a1 / W], [pv(b.b0), pv(b.b1)]);
    this._add(new THREE.Mesh(lit(faceBuilder), new THREE.MeshBasicMaterial({ map: texture(drawn.canvas, anisotropy), vertexColors: true })), 'rack faces');

    // The notes' names behind the keys and the two displays, on the canvas redrawn, lit as the faces.
    const Dc = R.panel.displays.clock, Ds = R.panel.displays.seq;
    const ch = Math.round((VALUES.display * (Dc.b1 - Dc.b0)) / (Dc.a1 - Dc.a0)), sh = Math.round((VALUES.display * (Ds.b1 - Ds.b0)) / (Ds.a1 - Ds.a0));
    /** @private */
    this._values = canvas(VALUES.w, VALUES.band + Math.max(ch, sh));
    /** @private where each display is on it: x, y, w, h (pixels) */
    this._clockArea = { x: 0, y: VALUES.band, w: VALUES.display, h: ch };
    /** @private */
    this._seqArea = { x: VALUES.display, y: VALUES.band, w: VALUES.display, h: sh };
    /** @private */
    this._valuesTexture = texture(this._values, anisotropy);
    const VH = this._values.height;
    /** @param {{ x: number, y: number, w: number, h: number }} r */
    const region = (r) => [[r.x / VALUES.w, (r.x + r.w) / VALUES.w], [1 - (r.y + r.h) / VH, 1 - r.y / VH]];
    const shown = new Builder(), [bandU, bandV] = region({ x: 0, y: 0, w: VALUES.w, h: VALUES.band });
    mapped(shown, P(0, R.names.b0, 0.0016), across, times(R.up, R.names.b1 - R.names.b0), bandU, bandV);
    /**
     * @param {import('./board.js').Area} d
     * @param {{ x: number, y: number, w: number, h: number }} area
     */
    const display = (d, area) => {
      const [us, vs] = region(area);
      mapped(shown, Q(d.a0, d.b0, 0.001), [d.a1 - d.a0, 0, 0], times(PU, d.b1 - d.b0), us, vs);
    };
    display(Dc, this._clockArea);
    display(Ds, this._seqArea);
    this._add(new THREE.Mesh(lit(shown), new THREE.MeshBasicMaterial({ map: this._valuesTexture, vertexColors: true })), 'rack values');

    // On the top and on the panel, in their own frames, as the board's (kit.js).
    const top = new THREE.Group(), panel = new THREE.Group();
    top.position.set(R.origin[0], R.origin[1], R.origin[2]);
    top.rotation.x = R.tilt;
    panel.position.set(R.panel.origin[0], R.panel.origin[1], R.panel.origin[2]);
    panel.rotation.x = Math.PI / 2 - R.panel.lean;
    top.name = 'rack top';
    panel.name = 'rack panel';
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

    // The keys: a box each, written where it is once, its colour when it changes.
    const n = R.keys.length;
    this.keys = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: light }), n);
    this.keys.name = 'rack keys';
    this.group.add(this.keys);
    const o = this._dummy;
    R.keys.forEach((q, i) => {
      o.position.set((q.a0 + q.a1) / 2, 0, -(q.b0 + q.b1) / 2);
      o.rotation.set(0, 0, 0);
      o.scale.set(q.a1 - q.a0, RACK.key.rise, q.b1 - q.b0);
      o.updateMatrix();
      this.keys.setMatrixAt(i, this._mat.multiplyMatrices(top.matrix, o.matrix));
    });
    /** @private what each key was last written as: -1 never, else set (1), the step playing (2), pointed at (4) */
    this._keyShown = new Int8Array(n).fill(-1);
    /** @private each key set: a step playing (not a rest), an accent, a slide */
    this._set = new Uint8Array(n);
    /** The step playing now, lit up on its key, else -1. */
    this.playhead = -1;
    /** The key pointed at (its index in R.keys: row r's for step s is r * STEPS + s), else -1. */
    this.hovered = -1;

    // The knobs, each step's and the tempo's, and a line on each that shows where it is turned to.
    const k = R.knobs.length;
    this.knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.08, 1, 24).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2622').multiply(light) }), k);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }), k);
    this.knobs.name = 'rack knobs';
    this.marks.name = 'rack knob marks';
    this.group.add(this.knobs, this.marks);
    /** @private a mark's way out from its knob's middle, in its own (scaled) frame */
    this._offset = new THREE.Matrix4().makeTranslation(0, 0, -0.6);

    // RUN's light, on the button.
    const run = R.panel.buttons.find((b) => b.id === 'run') ?? R.panel.buttons[0];
    /** @private */
    this._led = new THREE.Mesh(new THREE.CircleGeometry(0.0048, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(LED.off[0], LED.off[1], LED.off[2]) }));
    this._led.position.set(run.a0 + 0.009, BT + 0.0004, -(run.b1 - 0.009));
    this._led.name = 'rack run light';
    panel.add(this._led);

    // The sign on the wall, as wide as the rack.
    const G = R.sign, sw = G.x1 - G.x0, sgh = G.y1 - G.y0, mid = [(G.x0 + G.x1) / 2, (G.y0 + G.y1) / 2, G.z];
    const plate = signPlate(1024, Math.round((1024 * sgh) / sw), 'Rack', 'a clock and a sequencer');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sgh), new THREE.MeshBasicMaterial({ map: texture(plate, anisotropy), color: lightColor(mid, [0, 0, 1]) }));
    sign.position.set(mid[0], mid[1], mid[2]);
    this._add(sign, 'rack sign');

    /** @private the tips that press the keys: the sticks', then the forefingers' @type {KeyTip[]} */
    this._tips = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0, has: false, armed: false }));
    /** @private */
    this._at = new THREE.Vector3();
    /** @private the steps' notes (semitones up from the lowest) and whether each plays, for their names */
    this._notes = new Int8Array(STEPS);
    this._on = new Uint8Array(STEPS);
    /** @private the line's lowest note (MIDI) */
    this._lowest = 36;
    /** @private the octave, the tempo, and the knob or key set last, in words */
    this._octave = 0;
    this._tempo = TEMPO.value;
    this._last = '';
    /** @private whether the clock runs, and how bright RUN's light is from the last beat (1 on it) */
    this._running = false;
    this._beat = 0;
    /** @private what RUN's light was last set to (-1 off, else the beat's brightness) */
    this._ledShown = -1;
    /** @private */
    this._valuesDirty = true;
    /** @private seconds since the names and the displays were drawn */
    this._valuesAge = Infinity;
    this.setTempo(this._tempo);
    for (let i = 0; i < n; i++) this._writeKey(i);
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
   * The line (seq.js Seq's steps, and its lowest note and octave): the keys lit where set, the knobs
   * turned to the notes, the notes' names and the octave on the display.
   * @param {readonly SeqStep[]} steps
   * @param {number} lowest
   * @param {number} octave
   */
  setLine(steps, lowest, octave) {
    for (let s = 0; s < STEPS; s++) {
      const step = steps[s];
      if (!step) continue;
      this._set[s] = step.on ? 1 : 0;
      this._set[STEPS + s] = step.accent ? 1 : 0;
      this._set[2 * STEPS + s] = step.slide ? 1 : 0;
      if (step.note !== this._notes[s] || this._on[s] !== this._set[s]) this._valuesDirty = true;
      this._notes[s] = step.note;
      this._on[s] = this._set[s];
      this._turn(s, step.note / SEQ_RANGE);
    }
    if (lowest !== this._lowest || octave !== this._octave) this._valuesDirty = true;
    this._lowest = lowest;
    this._octave = octave;
  }

  /**
   * What was set last, in words (a step's note, its accent or slide), on the sequencer's display.
   * @param {string} text
   */
  setLast(text) {
    if (text === this._last) return;
    this._last = text;
    this._valuesDirty = true;
  }

  /**
   * The clock's tempo (beats per minute): its knob, and its display.
   * @param {number} tempo
   */
  setTempo(tempo) {
    const k = this.rack.knobs.findIndex((n) => n.part === 'tempo');
    if (k >= 0) this._turn(k, (tempo - TEMPO.min) / (TEMPO.max - TEMPO.min));
    if (tempo !== this._tempo) this._valuesDirty = true;
    this._tempo = tempo;
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
   * Knob n (R.knobs) turned to `value` (0…1: from 135° left to 135° right), in its frame.
   * @private
   * @param {number} n
   * @param {number} value
   */
  _turn(n, value) {
    const knob = this.rack.knobs[n], o = this._dummy, h = RACK.knob.h;
    const r = knob.part === 'tempo' ? RACK.knob.tempo : RACK.knob.r;
    const frame = knob.on === 'top' ? this._top : this._panel;
    o.position.set(knob.a, 0, -knob.b);
    o.rotation.set(0, -(Math.min(1, Math.max(0, value)) - 0.5) * 1.5 * Math.PI, 0);
    o.scale.set(r, h, r);
    o.updateMatrix();
    this.knobs.setMatrixAt(n, this._mat.multiplyMatrices(frame.matrix, o.matrix));
    o.position.y = h + 0.0012;
    o.scale.set(0.0036, 0.002, r * 0.75);
    o.updateMatrix();
    this.marks.setMatrixAt(n, this._mat.multiplyMatrices(frame.matrix, o.matrix).multiply(this._offset));
    this.knobs.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
  }

  /**
   * Key i's colour, if it changed: dark, or lit in its row's colour where set; brighter as the step
   * playing (a step's key), and pointed at. Whether it was written.
   * @private
   * @param {number} i
   */
  _writeKey(i) {
    const row = Math.floor(i / STEPS), set = this._set[i] === 1, now = row === 0 && this.playhead === i % STEPS, hover = this.hovered === i;
    const code = (set ? 1 : 0) | (now ? 2 : 0) | (hover ? 4 : 0);
    if (code === this._keyShown[i]) return false;
    this._keyShown[i] = code;
    const lit = row === 0 ? GLOW : row === 1 ? ACCENT : SLIDE, base = set ? lit : CAP;
    const k = (set ? 1.25 : 1) * (hover ? 1.3 : 1), add = now ? 0.45 : 0;
    this.keys.setColorAt(i, this._color.setRGB(base[0] * k + add, base[1] * k + add, base[2] * k + add));
    return true;
  }

  /**
   * Per frame: the keys written where they changed (set, the step playing, pointed at), RUN's light,
   * and the names and the displays redrawn when they changed (at most ten times a second).
   * @param {number} dt
   */
  update(dt) {
    let keys = false;
    for (let i = 0; i < this._keyShown.length; i++) if (this._writeKey(i)) keys = true;
    if (keys && this.keys.instanceColor) this.keys.instanceColor.needsUpdate = true;
    this._beat = Math.max(0, this._beat - dt * 5);
    const led = this._running ? Math.round(this._beat * 20) / 20 : -1;
    if (led !== this._ledShown) {
      this._ledShown = led;
      const c = this._led.material.color, k = Math.max(0, led);
      if (led < 0) c.setRGB(LED.off[0], LED.off[1], LED.off[2]);
      else c.setRGB(LED.on[0] + (LED.beat[0] - LED.on[0]) * k, LED.on[1] + (LED.beat[1] - LED.on[1]) * k, LED.on[2] + (LED.beat[2] - LED.on[2]) * k);
    }
    this._valuesAge += dt;
    if (this._valuesDirty && this._valuesAge >= 0.1) this._drawValues();
  }

  /** The notes' names behind their keys (a rest's dimmed), the tempo, and the octave and what was set last. @private */
  _drawValues() {
    this._valuesDirty = false;
    this._valuesAge = 0;
    const c = this._values, g = context(c), R = this.rack;
    g.fillStyle = '#23211f';
    g.fillRect(0, 0, c.width, VALUES.band);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let s = 0; s < STEPS; s++) {
      const q = R.keys[s], name = noteName(this._lowest + this._notes[s]);
      g.fillStyle = this._on[s] ? '#efe5cf' : '#7d766c';
      fit(g, name, ((q.a1 - q.a0) / R.width) * c.width + 4, 22, '600');
      g.fillText(name, (((q.a0 + q.a1) / 2) / R.width) * c.width, VALUES.band / 2 + 1);
    }
    // The clock's display: the tempo.
    const C = this._clockArea, S = this._seqArea;
    g.fillStyle = '#0d1714';
    g.fillRect(C.x, C.y, C.w, C.h);
    g.fillStyle = '#9ee6b8';
    g.textAlign = 'right';
    g.font = `700 ${Math.round(C.h * 0.5)}px ${SANS}`;
    g.fillText(String(this._tempo), C.x + C.w * 0.64, C.y + C.h * 0.54);
    g.textAlign = 'left';
    g.font = `600 ${Math.round(C.h * 0.2)}px ${SANS}`;
    g.fillText('BPM', C.x + C.w * 0.68, C.y + C.h * 0.62);
    // The sequencer's: its octave and the notes its knobs reach, and what was set last.
    g.fillStyle = '#0d1714';
    g.fillRect(S.x, S.y, S.w, S.h);
    g.fillStyle = '#9ee6b8';
    const octave = `OCTAVE ${this._octave > 0 ? '+' : ''}${this._octave}`;
    g.font = `700 ${Math.round(S.h * 0.3)}px ${SANS}`;
    g.fillText(octave, S.x + 16, S.y + S.h * 0.3);
    g.fillStyle = '#6fbf93';
    const reach = `NOTES ${noteName(this._lowest)}–${noteName(this._lowest + SEQ_RANGE)}`;
    fit(g, reach, S.w - 32, Math.round(S.h * 0.2));
    g.textAlign = 'right';
    g.fillText(reach, S.x + S.w - 16, S.y + S.h * 0.3);
    if (this._last) {
      g.textAlign = 'left';
      g.fillStyle = '#efe5cf';
      fit(g, this._last, S.w - 32, Math.round(S.h * 0.24), '500');
      g.fillText(this._last, S.x + 16, S.y + S.h * 0.72);
    }
    this._valuesTexture.needsUpdate = true;
  }

  /**
   * In VR, per frame, after kit.js's (whose sticks show near the rack too): each stick's tip while it
   * shows, else the forefinger of a hand without a controller, presses a key it comes down on.
   * @param {Hand[]} hands
   * @param {THREE.XRHandSpace[]} fingers the hands' joints (renderer.xr.getHand)
   * @param {THREE.Object3D[]} sticks kit.js's, in the controllers
   */
  updateXR(hands, fingers, sticks) {
    const at = this._at;
    for (let i = 0; i < 2; i++) {
      const h = hands[i], stick = !!(h && sticks[i]?.visible);
      if (h && stick) at.set(0, 0, -STICK.tip).applyMatrix4(h.controller.matrixWorld);
      this._track(this._tips[i], stick, h?.source ?? null);
      const tip = fingers[i]?.joints['index-finger-tip'];
      const finger = !!(fingers[i]?.visible && tip?.visible);
      if (finger && tip) at.setFromMatrixPosition(tip.matrixWorld);
      this._track(this._tips[2 + i], finger, null);
    }
  }

  /** Back on a screen: every tip forgotten. */
  endXR() {
    for (const t of this._tips) t.has = false;
  }

  /**
   * One tip, now at this._at (when `active`): a press if it came down on a key since last frame and
   * was up off the keys before; it must come back up REARM before it can press again.
   * @private
   * @param {KeyTip} tip
   * @param {boolean} active
   * @param {XRInputSource | null} source
   */
  _track(tip, active, source) {
    if (!active) {
      tip.has = false;
      return;
    }
    const R = this.rack, p = this._at, h = heightOver(R, p.x, p.y, p.z, RACK.key.rise);
    if (!tip.has) tip.armed = h > REARM;
    else if (tip.armed) {
      const key = rackStrike(R, tip.x, tip.y, tip.z, p.x, p.y, p.z);
      if (key >= 0) {
        tip.armed = false;
        this.onKey(SEQ_ROWS[Math.floor(key / STEPS)], key % STEPS, source);
      } else if (h <= 0) tip.armed = false; // through the top off the keys
    } else if (h > REARM) tip.armed = true;
    tip.x = p.x;
    tip.y = p.y;
    tip.z = p.z;
    tip.has = true;
  }
}
