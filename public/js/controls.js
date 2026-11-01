// Moving about the room: common's Controls (common/controls.js), the walking the hallway, outside
// and the rooms share, on every device (its README's table): a drag to look, the keys, a click or a
// tap, a gamepad, a TV's remote (main.js gives it useMiddle, and sets aimMiddle), and in VR the hands
// and the sticks, with less motion, seated mode and the vignette's speeds. Here is the room's own:
//   its walls and what a ray meets: room.js's clampWalk and castRay on its layout, the hit with
//     where on the panel or a picture (u, v) and which piece (the `hit` option)
//   the control panel: a button pressed is onPanel(id), and the one pointed at hoverPanel
//   the pieces on the walls: one chosen is onPiece(i, how), the one pointed at hoverPiece, and a
//     hand's reticle on one is 1.3 times its size
//   the walks through the doorway (walkInto) and up to a piece (walkUpTo; in VR a teleport)
//   the drum board (board.js): one walks round it, and a ray meets its pads (onPad(i, velocity)),
//     its knobs (onKnob(k, by): a drag, the wheel, or in VR a stick pushed while pointing at one)
//     and the rest of it. Choosing it walks up to it to play it (walkToBoard): on a screen the
//     visitor is then `playing` (onPlaying), so a press on a pad plays it as it goes down (fingers
//     at once on a phone), the keys 1–4, Q–R and A–F are the pads' (Shift harder), on a TV the
//     arrows choose a pad (onPick), and Escape, Back or walking off steps away (leaveBoard).
// What a click, a tap, A, OK or a trigger is on comes to use(hit, how): the panel, the pieces and the
// board here, and common's the doorway (onDoor) and the floor (a walk there, in VR a teleport).
import { Controls as Walking } from 'common/controls.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';
import { boardBlocks, boardFront, boardStand, clampBoard, hitBoard } from './board.js';
import { padForKey } from './drums.js';

/** @typedef {import('./board.js').BandHit} BandHit */
/** @typedef {import('common/controls.js').How} How */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How hard a pad is played by a press, a trigger, A or OK, and by a key (Shift: as hard as can be). */
const PRESS = 0.85, KEY = 0.8;
/** What a ray can meet on the board. */
const ON_BOARD = new Set(['pad', 'knob', 'board']);
/** On a TV, playing: the arrows choose a pad, so many columns right and rows farther. @type {Readonly<Record<string, [number, number]>>} */
const PICK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
/** How far the visitor goes from where they play before they have stepped away. */
const AWAY = 0.25;

/**
 * Walking about the room, with its control panel, the pictures on its walls and the drum board.
 * @extends {Walking<BandHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<BandHit>, 'eye' | 'hit'> & { layout: import('./room.js').Layout, board: import('./board.js').Board }} options
   *   common's, the room's layout (room.js layoutRoom) and the drum board's (board.js layoutBoard)
   */
  constructor({ layout, board, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, pad: -1, knob: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    this.board = board;
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** What hangs on the walls pointed at: its index in layout.pieces, else -1. */
    this.hoverPiece = -1;
    /** The drum board's pad pointed at (its index in drums.js PADS), else -1, and its knob. */
    this.hoverPad = -1;
    this.hoverKnob = -1;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
    /** (i, how) when piece i on a wall (layout.pieces) is chosen. @type {(i: number, how: How) => void} */
    this.onPiece = () => {};
    /** (i, velocity) when pad i is played: a key, a press, a trigger, A or OK on it. @type {(i: number, velocity: number) => void} */
    this.onPad = () => {};
    /** (k, by) when knob k (board.js layoutBoard's knobs) is turned, by this much of its whole turn. @type {(k: number, by: number) => void} */
    this.onKnob = () => {};
    /** (columns, rows) the arrows, choosing a pad on a TV while playing. @type {(dc: number, dr: number) => void} */
    this.onPick = () => {};
    /** (on) when the visitor starts playing at the board on a screen, or steps away. @type {(on: boolean) => void} */
    this.onPlaying = () => {};
    /** On a screen, standing at the board to play it: its keys are the pads', Escape steps away. */
    this.playing = false;
    /** On a TV, while playing, the arrows choose a pad (and OK plays it: main.js). */
    this.arrowsPick = false;
    /**
     * What the page shows over the view (the card, the buttons), for the board to be played clear of
     * (main.js). @type {() => import('./board.js').Rect[]}
     */
    this.over = () => [];
    /** @private where the visitor plays from, while playing */
    this._playAt = { x: 0, z: 0 };
    /** @private a walk to the board is starting, which leaves nothing */
    this._toBoard = false;
    /** @private the view easing back to level, having walked away from the board looking down at it */
    this._leveling = false;
    /** @private a knob turned by a drag: which pointer, which knob, and where it was @type {{ id: number, knob: number, y: number } | null} */
    this._turning = null;
    this._bindBoard();
    this.renderer.xr.addEventListener('sessionstart', () => this._stop(false));
  }

  /**
   * What a ray meets first in the room (room.js castRay), with u, v and piece, or on the board
   * (board.js hitBoard) with pad and knob; the floor round the board is no place to walk to.
   * @param {number} ox
   * @param {number} oy
   * @param {number} oz
   * @param {number} dx
   * @param {number} dy
   * @param {number} dz
   * @param {BandHit} out
   */
  castRay(ox, oy, oz, dx, dy, dz, out) {
    const hit = /** @type {BandHit | null} */ (castRay(this.layout, ox, oy, oz, dx, dy, dz, out)); // out, or null
    out.pad = out.knob = -1;
    if (hitBoard(this.board, ox, oy, oz, dx, dy, dz, out, hit ? hit.t : Infinity)) return out;
    if (hit?.kind === 'floor' && hit.walkable && boardBlocks(this.board, hit.x, hit.z)) hit.walkable = false;
    return hit;
  }

  /**
   * The room's walls (room.js clampWalk), the doorway between its jambs, and round the board.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    clampWalk(this.layout, fx, fz, x, z, out);
    return clampBoard(this.board, fx, fz, out.x, out.z, out);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'piece', 'pad', 'knob' or 'board' (to
   * walk up to it; not while playing it), or common's ('door').
   * @param {BandHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'piece') return 'piece';
    if (hit && ON_BOARD.has(hit.kind)) return hit.kind === 'board' && this.playing ? null : hit.kind;
    return super.usable(hit);
  }

  /**
   * Uses what a hit is on: a panel button, a piece on a wall, a pad (played in VR, or while playing
   * at the board; else, as the rest of the board, a walk up to it), or common's (the doorway, the
   * floor).
   * @param {BandHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else if (hit?.kind === 'pad' && (how === 'xr' || this.playing)) this.onPad(hit.pad, PRESS);
    else if (hit && ON_BOARD.has(hit.kind)) {
      if (!this.playing) this.walkToBoard();
    } else super.use(hit, how);
  }

  /**
   * @protected
   * @param {string | null} usable
   * @param {BandHit | null} hit
   */
  _setHover(usable, hit) {
    super._setHover(usable, hit);
    this.hoverPanel = hit?.kind === 'panel' ? usable : null;
    this.hoverPiece = hit?.kind === 'piece' ? hit.piece : -1;
    this.hoverPad = hit?.kind === 'pad' ? hit.pad : -1;
    this.hoverKnob = hit?.kind === 'knob' ? hit.knob : -1;
  }

  /**
   * A hand's reticle on a piece, a pad or a knob; the rest as common's.
   * @param {string | null} use
   * @param {BandHit} hit
   */
  reticleScale(use, hit) {
    if (use === 'piece') return 1.3;
    if (use === 'pad') return 0.9;
    if (use === 'knob') return 0.6;
    return super.reticleScale(use, hit);
  }

  /**
   * Playing at the board: a pad's key plays it (Shift: harder), Escape steps away, and on a TV the
   * arrows choose a pad. Otherwise walking's.
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  takeKey(e, name) {
    if (!this.playing) return false;
    const pad = padForKey(name);
    if (pad >= 0) {
      e.preventDefault();
      if (!e.repeat) this.onPad(pad, e.shiftKey ? 1 : KEY);
      return true;
    }
    if (name === 'Escape') {
      this.leaveBoard();
      return true;
    }
    const pick = this.arrowsPick ? PICK[name] : undefined;
    if (!pick) return false;
    e.preventDefault();
    this.onPick(pick[0], pick[1]);
    return true;
  }

  /**
   * The wheel over a knob turns it.
   * @param {number} dy
   */
  takeWheel(dy) {
    if (this.hoverKnob < 0) return false;
    this.onKnob(this.hoverKnob, -dy / 1200);
    return true;
  }

  /**
   * In VR, a stick pushed up or down while its hand points at a knob turns it (and neither walks nor
   * turns the visitor).
   * @param {import('common/controls.js').Hand<BandHit>} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   */
  takeHand(hand, pad, ax, ay, dt) {
    const hit = hand.last;
    if (hit?.kind !== 'knob' || Math.abs(ay) < 0.25) return false;
    this.onKnob(hit.knob, -ay * dt * 0.6);
    return true;
  }

  /**
   * Walks up to the board to play it: on a screen to where all of its top is in view, clear of what
   * the page shows over it (board.js boardFront, for this view's field and shape, and `over`),
   * looking down at it, then playing; with less motion, there at once. In VR, a teleport to arm's
   * length (board.js boardStand), unless there already.
   */
  walkToBoard() {
    if (this.renderer.xr.isPresenting) {
      const s = boardStand(this.board);
      this.camera.getWorldPosition(this._head);
      if (Math.hypot(this._head.x - s.x, this._head.z - s.z) > 0.5) this._teleport(s.x, s.z);
      return;
    }
    const view = /** @type {import('three').PerspectiveCamera} */ (this.camera);
    const f = boardFront(this.board, { fov: view.fov, aspect: view.aspect, over: this.over() });
    const p = this.rig.position;
    this._stop(false);
    this.stand();
    this.restPitch = clamp(f.pitch, -1.3, 0);
    this._toBoard = true;
    try {
      this._startWalk(this.route(p.x, p.z, f.x, f.z), f.yaw, () => this._play(f.x, f.z));
    } finally {
      this._toBoard = false;
    }
  }

  /** Steps back from the board (Escape, a TV's Back, a gamepad's B): a little way back, looking up again. */
  leaveBoard() {
    if (!this.playing) return;
    this._stop(false);
    const p = this.rig.position;
    this._startWalk([[p.x, p.z + 0.45]], this.yaw);
  }

  /**
   * At the board, playing.
   * @private
   * @param {number} x
   * @param {number} z
   */
  _play(x, z) {
    this._playAt.x = x;
    this._playAt.z = z;
    this._leveling = false;
    this.playing = true;
    this.onPlaying(true);
  }

  /**
   * Not playing any more: the view comes back to level on the next walk that faces somewhere, or
   * (`level`) at once, easing.
   * @private
   * @param {boolean} level
   */
  _stop(level) {
    this.restPitch = 0;
    if (!this.playing) return;
    this.playing = false;
    this._leveling = level;
    this.onPlaying(false);
  }

  /**
   * Any walk but the one to the board leaves it.
   * @protected
   * @param {[number, number][]} points
   * @param {number | null} face
   * @param {(() => void) | null} [done]
   * @param {boolean} [turn]
   */
  _startWalk(points, face, done = null, turn = points.length > 1) {
    if (!this._toBoard) this._stop(false);
    super._startWalk(points, face, done, turn);
  }

  /**
   * Common's, then: walking off from where one plays steps away from the board, and the view comes
   * back to level (with less motion, at once; a drag stops it).
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    if (this.renderer.xr.isPresenting) return;
    const p = this.rig.position;
    if (this.playing && !this.auto && Math.hypot(p.x - this._playAt.x, p.z - this._playAt.z) > AWAY) this._stop(true);
    if (!this._leveling) return;
    if (this._down?.moved || this.auto) this._leveling = false;
    else {
      this.pitch = this.reduceMotion ? 0 : this.pitch * Math.exp(-dt * 5);
      if (Math.abs(this.pitch) < 0.005) {
        this.pitch = 0;
        this._leveling = false;
      }
      this._apply();
    }
  }

  /**
   * Presses on the board while playing, before walking's: one on a pad plays it as it goes down (as
   * many fingers as there are), one on a knob turns it as it is dragged up or down; elsewhere,
   * walking's. Taken in the view's parent, as the press goes down to the view.
   * @private
   */
  _bindBoard() {
    const view = this.dom, around = view.parentElement ?? view;
    around.addEventListener('pointerdown', (e) => {
      if (!this.playing || this.renderer.xr.isPresenting || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const hit = this._pickScreen(e.clientX, e.clientY);
      if (hit?.kind === 'pad') {
        e.stopPropagation();
        this.onActivity();
        this.onPad(hit.pad, e.shiftKey ? 1 : PRESS);
      } else if (hit?.kind === 'knob') {
        e.stopPropagation();
        this.onActivity();
        this._turning = { id: e.pointerId, knob: hit.knob, y: e.clientY };
        view.setPointerCapture?.(e.pointerId);
      }
    }, { capture: true });
    view.addEventListener('pointermove', (e) => {
      const t = this._turning;
      if (!t || t.id !== e.pointerId) return;
      this.onKnob(t.knob, (t.y - e.clientY) / 160);
      t.y = e.clientY;
    });
    const end = (/** @type {PointerEvent} */ e) => {
      if (this._turning?.id === e.pointerId) this._turning = null;
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
  }

  /**
   * Walks up to the doorway and through it, facing it from the first step: the view goes on to the
   * Hallway (main.js) before the walk ends.
   */
  walkInto() {
    const p = this.rig.position;
    const jamb = this.layout.door.width / 2 - 0.25;
    /** @type {[number, number]} */
    const front = [clamp(p.x, -jamb, jamb), -1.0];
    /** @type {[number, number][]} */
    const points = p.z > -1.2 && Math.abs(p.x) < jamb ? [] : [front];
    points.push([front[0], this.layout.door.reveal]);
    this._startWalk(points, Math.PI, null, false);
  }

  /**
   * Walks up to piece i on a wall, to stand in front of it facing it, then done() (unless the walk
   * is taken over on the way); with less motion, there at once. In VR, a teleport there.
   * @param {number} i
   * @param {(() => void) | null} [done]
   */
  walkUpTo(i, done = null) {
    const f = pieceFront(this.layout, i);
    if (this.renderer.xr.isPresenting) {
      this._teleport(f.x, f.z);
      done?.();
      return;
    }
    this._startWalk([[f.x, f.z]], f.yaw, done);
  }

  /** @param {string | null} id a panel button's, or null where there is none */
  _press(id) {
    if (id) this.onPanel(id);
  }
}
