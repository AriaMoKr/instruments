// The drum board in 3D (board.js lays it out, drums.js says what is on it): its stand and top, lit as
// the room is (scene.js's bake, once, into vertex colours), the pads' faces with their keys and
// names on one canvas, lit up in their colours when played (their vertex colours, written only while
// one glows), a ring round the pad the knobs turn, the three knobs, the strip with that pad's name
// and its knobs' settings (a canvas, redrawn when they change, at most ten times a second), and its
// sign on the wall over it. In VR a stick in each hand that holds a controller, near the board, whose
// tip comes down on a pad to play it (board.js strikeAt), as hard as it was going; a hand without a
// controller plays with its forefinger. Per frame nothing is allocated.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { BOARD, REARM, boardPoint, heightOver, strikeAt, strikeVelocity } from './board.js';
import { COLUMNS, KNOBS, PADS, ROWS, keyLabel, knobText } from './drums.js';
import { GOLD, SANS, SERIF } from './textures.js';

/** @typedef {import('./board.js').Board} Board */
/** @typedef {import('./drums.js').Knobs} Knobs */
/** @typedef {import('common/controls.js').Hand<import('./board.js').BandHit>} Hand */

/** @param {string} hex @returns {[number, number, number]} linear */
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
/** @param {number[]} v @param {number} k @returns {[number, number, number]} */
const times = (v, k) => [v[0] * k, v[1] * k, v[2] * k];

const WOOD = lin('#3b2a1d'), TOP = lin('#23211f'), RIM = lin('#151413');
/** How much brighter than its rubber a pad lights up at full glow, in its colour. */
const BOOST = 3;
/** A stick: from just behind the hand to its tip, along the controller's aim (-z). */
const STICK = { back: 0.04, tip: 0.36 };
/** The pads' atlas: a cell each, this many pixels square. */
const CELL = 256;

/** @param {number} w @param {number} h */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** @param {HTMLCanvasElement} c */
const context = (c) => /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));

/**
 * Sets the largest font, from `size` px down, in which `text` fits `width`.
 * @param {CanvasRenderingContext2D} g
 * @param {string} text
 * @param {number} width
 * @param {number} size
 * @param {string} [weight]
 */
function fit(g, text, width, size, weight = '600') {
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

/** The sign over the board: "Drums" in gold on a dark plate edged in gold, and what they are. @param {number} w @param {number} h */
function signPlate(w, h) {
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
  g.fillText('Drums', w / 2, h * 0.44);
  g.fillStyle = '#efe5cf';
  fit(g, 'twelve analog pads', w - 96, Math.round(h * 0.12), '500');
  g.fillText('twelve analog pads', w / 2, h * 0.76);
  return c;
}

/** @param {HTMLCanvasElement} c @param {number} anisotropy */
function texture(c, anisotropy) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  return t;
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
    const P = (/** @type {number} */ a, /** @type {number} */ b, h = 0) => boardPoint(B, a, b, h, [0, 0, 0]);
    const W = B.width, D = B.length, T = BOARD.thick;
    const across = [W, 0, 0], along = times(B.up, D), down = times(B.normal, T), back = times(B.up, -1);

    // The stand, the top and the pads' rims: one mesh, lit once.
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
    const out = times(B.normal, BOARD.rise);
    for (const p of B.pads) {
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

    // On the top, in its own frame: x across it, y out of it, -z up it.
    const top = new THREE.Group();
    top.name = 'board top';
    top.position.set(B.origin[0], B.origin[1], B.origin[2]);
    top.rotation.x = B.tilt;
    this.group.add(top);
    const light = lightColor(P(W / 2, D / 2), B.normal);

    // The ring round the pad the knobs turn.
    const half = BOARD.pad / 2, ring = new THREE.Shape();
    ring.moveTo(-half - 0.016, -half - 0.016).lineTo(half + 0.016, -half - 0.016).lineTo(half + 0.016, half + 0.016).lineTo(-half - 0.016, half + 0.016).closePath();
    const hole = new THREE.Path();
    hole.moveTo(-half - 0.005, -half - 0.005).lineTo(-half - 0.005, half + 0.005).lineTo(half + 0.005, half + 0.005).lineTo(half + 0.005, -half - 0.005).closePath();
    ring.holes.push(hole);
    this.ring = new THREE.Mesh(new THREE.ShapeGeometry(ring).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }));
    this.ring.name = 'selected pad';
    top.add(this.ring);

    // The knobs, and a line on each that shows where it is turned to.
    const { r, h } = BOARD.knob;
    this.knobs = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r * 1.08, h, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color('#2a2622').multiply(light) }), KNOBS.length);
    this.marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.003, r * 0.75), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f1e6d0').multiply(light) }), KNOBS.length);
    this.knobs.name = 'knobs';
    this.marks.name = 'knob marks';
    top.add(this.knobs, this.marks);

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

    // The sign on the wall, as wide as the board, where a level gaze meets it.
    const S = B.sign, sw = S.x1 - S.x0, sh = S.y1 - S.y0, mid = [(S.x0 + S.x1) / 2, (S.y0 + S.y1) / 2, S.z];
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
    this._strike = { pad: -1, speed: 0 };

    /** The pad the knobs turn. */
    this.selected = 0;
    /** @private @type {Knobs} */
    this._knobs = { pitch: 0.5, decay: 0.5, tone: 0.5 };
    /** @private */
    this._stripDirty = true;
    /** @private seconds since the strip was drawn */
    this._stripAge = Infinity;
    /** @private */
    this._dummy = new THREE.Object3D();
    /** @private */
    this._m = new THREE.Matrix4();
    /** @private */
    this._offset = new THREE.Matrix4().makeTranslation(0, 0, -r * 0.45);
    this.select(0, this._knobs);
  }

  /**
   * @private
   * @param {THREE.Mesh} mesh
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
   * The pad the knobs turn, and its knobs: the ring round it, the knobs turned to them, the strip.
   * @param {number} i
   * @param {Knobs} knobs
   */
  select(i, knobs) {
    const p = this.board.pads[i];
    if (!p) return;
    this.selected = i;
    this.ring.position.set((p.a0 + p.a1) / 2, BOARD.rise + 0.0008, -(p.b0 + p.b1) / 2);
    this.setKnobs(knobs);
  }

  /**
   * The knobs turned to the selected pad's settings (each 0…1: from 135° left to 135° right).
   * @param {Knobs} knobs
   */
  setKnobs(knobs) {
    this._knobs = knobs;
    const d = this._dummy, h = BOARD.knob.h;
    this.board.knobs.forEach((k, n) => {
      d.position.set(k.a, h / 2, -k.b);
      d.rotation.set(0, -(knobs[k.name] - 0.5) * 1.5 * Math.PI, 0);
      d.updateMatrix();
      this.knobs.setMatrixAt(n, d.matrix);
      d.position.y = h + 0.0015;
      d.updateMatrix();
      this.marks.setMatrixAt(n, this._m.multiplyMatrices(d.matrix, this._offset));
    });
    this.knobs.instanceMatrix.needsUpdate = true;
    this.marks.instanceMatrix.needsUpdate = true;
    this._stripDirty = true;
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
   * the strip is redrawn when its pad or knobs changed (at most ten times a second).
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
    this._stripAge += dt;
    if (this._stripDirty && this._stripAge >= 0.1) this._drawStrip();
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
    // Each knob: its name over it, its setting under it.
    g.textAlign = 'center';
    const r = (BOARD.knob.r / B.width) * W, room = (BOARD.knob.spacing / B.width) * W - 8;
    for (const k of B.knobs) {
      const kx = x(k.a), ky = y(k.b), text = knobText(this.selected, k.name, this._knobs[k.name]);
      g.fillStyle = '#e0bb72';
      g.font = `600 21px ${SANS}`;
      g.fillText(k.name.toUpperCase(), kx, ky - r - 17);
      g.fillStyle = '#efe5cf';
      fit(g, text, room, 20, '500');
      g.fillText(text, kx, ky + r + 18);
    }
    this._stripTexture.needsUpdate = true;
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
   * shows while its hand holds a controller near the board (and that hand's laser hides, but on a
   * knob), and each stick's tip, or forefinger of a hand without one, plays a pad it comes down on.
   * @param {Hand[]} hands
   * @param {THREE.XRHandSpace[]} fingers the hands' joints (renderer.xr.getHand)
   * @param {number} dt
   */
  updateXR(hands, fingers, dt) {
    const B = this.board, at = this._at;
    for (let i = 0; i < 2; i++) {
      const h = hands[i], stick = this.sticks[i], source = h?.source ?? null;
      let near = false;
      if (h && source && !source.hand && source.targetRayMode === 'tracked-pointer') {
        at.setFromMatrixPosition(h.controller.matrixWorld);
        near = at.x > B.x0 - 0.7 && at.x < B.x1 + 0.7 && at.z > B.zBack - 0.2 && at.z < B.zFront + 0.9 && at.y > 0.3;
        if (near) {
          at.set(0, 0, -STICK.tip).applyMatrix4(h.controller.matrixWorld);
          h.laser.visible = false;
          if (h.last?.kind !== 'knob') h.reticle.visible = false;
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
   * One tip, now at this._at (when `active`): a strike if it came down on a pad since last frame and
   * was up off the board before; it must come back up REARM before it can strike again.
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
      } else if (h <= 0) tip.armed = false; // through the top off the pads
    } else if (h > REARM) tip.armed = true;
    tip.x = p.x;
    tip.y = p.y;
    tip.z = p.z;
    tip.has = true;
  }
}
