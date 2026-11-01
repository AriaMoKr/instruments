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
//     its step keys (onStep(s)), its knobs, the strip's and the panel's (onKnob(k, by): a drag, the
//     wheel, or in VR a stick pushed while pointing at one), the panel's jacks (onJack(j): a cable
//     picked up, then plugged in; while `carrying`, choosing anything else but a control drops it,
//     onDrop), RUN (onRun; Space too) and the rest of it.
//   the synth (synthboard.js) beside it: one walks round it too, and a ray meets its keys (a press
//     on one is onNoteOn(note, velocity) as it goes down and onNoteOff(note) as it comes up, sliding
//     onto the next plays that; a click, A, OK or a trigger elsewhere, onNoteTap), its dials
//     (onDial(d, by), as the board's knobs), its panel's buttons (onButton(i)) and the rest of it.
//     Choosing either walks up to it to play it (walkToBoard, walkToSynth): on a screen the visitor
//     is then `at` it (onPlaying), so a press on a pad, a key, a step key, a jack, RUN or a button
//     works as it goes down (fingers at once on a phone). At the board the keys 1–4, Q–R and A–F
//     are the pads' (Shift harder), on a TV the arrows choose a pad (onPick); at the synth the
//     middle row from A plays the white keys and the row over it the black ones (onNoteOn, then
//     onNoteOff as each comes up), Z and X move the octave (onOctave), and on a TV the arrows choose
//     a key (onKeyPick). Escape (a cable carried first), Back or walking off steps away (stepAway).
//     Where a cable carried is pointed: `aim` (the view's pointer), or in VR the hand that last chose
//     (`selectHand`).
// What a click, a tap, A, OK or a trigger is on comes to use(hit, how): the panel, the pieces, the
// board and the synth here, and common's the doorway (onDoor) and the floor (a walk there, in VR a
// teleport).
import { Controls as Walking } from 'common/controls.js';
import { keyOf } from 'common/tv.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';
import { boardBlocks, boardFront, boardStand, clampBoard, hitBoard } from './board.js';
import { SYNTH, hitSynth } from './synthboard.js';
import { padForKey } from './drums.js';
import { LOWEST, OCTAVE_KEYS, noteForKey } from './synth.js';

/** @typedef {import('./board.js').BandHit} BandHit */
/** @typedef {import('common/controls.js').How} How */
/** Where the visitor plays, on a screen: at the drum board, or at the synth. @typedef {'board' | 'synth'} At */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How hard a pad or a key is played by a press, a trigger, A or OK, and by a key (Shift: as hard as can be). */
const PRESS = 0.85, KEY = 0.8;
/** How hard a key slid onto, the press still down, is played (a glissando). */
const GLISS = 0.6;
/** What a ray can meet on the board, and of it what is a control, used at once while playing. */
const ON_BOARD = new Set(['pad', 'step', 'knob', 'jack', 'run', 'board']);
const AT_ONCE = new Set(['step', 'jack', 'run']);
/** What a ray can meet on the synth. */
const ON_SYNTH = new Set(['key', 'dial', 'button', 'synth']);
/** On a TV, playing: the arrows choose a pad, so many columns right and rows farther. @type {Readonly<Record<string, [number, number]>>} */
const PICK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
/** On a TV, at the synth: the arrows choose a key, so many keys on (up and down, an octave). @type {Readonly<Record<string, number>>} */
const KEY_PICK = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 12, ArrowDown: -12 };
/** How far the visitor goes from where they play before they have stepped away. */
const AWAY = 0.25;
/** In VR, how far a whole push of a stick turns a knob or a dial in a second (of its whole turn), and the tempo's. */
const STICK_TURN = 0.4, TEMPO_TURN = 0.15;

/**
 * Walking about the room, with its control panel, the pictures on its walls, the drum board and the
 * synth.
 * @extends {Walking<BandHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<BandHit>, 'eye' | 'hit'> & { layout: import('./room.js').Layout, board: import('./board.js').Board, synth: import('./synthboard.js').SynthDesk }} options
   *   common's, the room's layout (room.js layoutRoom), the drum board's (board.js layoutBoard) and the synth's (synthboard.js layoutSynth)
   */
  constructor({ layout, board, synth, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, pad: -1, step: -1, knob: -1, jack: -1, key: -1, dial: -1, button: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    this.board = board;
    this.synth = synth;
    /** The control panel's button pointed at, or null. @type {string | null} */
    this.hoverPanel = null;
    /** What hangs on the walls pointed at: its index in layout.pieces, else -1. */
    this.hoverPiece = -1;
    /** The drum board's pad pointed at (its index in drums.js PADS), else -1, its step key, knob and jack. */
    this.hoverPad = -1;
    this.hoverStep = -1;
    this.hoverKnob = -1;
    this.hoverJack = -1;
    /** The synth's key pointed at (its index, from the lowest), else -1, its dial and its panel's button. */
    this.hoverKey = -1;
    this.hoverDial = -1;
    this.hoverButton = -1;
    /** Where the view's pointer, or its middle, is on something, and the way out of it (`has` false: nothing). */
    this.aim = { has: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
    /** In VR, the hand that last chose something (its index in hands), else -1. */
    this.selectHand = -1;
    /** A cable is being carried (main.js): choosing anything but a control drops it, and so does Escape. */
    this.carrying = false;
    /** (button id) when a button of the control panel is pressed. @type {(id: string) => void} */
    this.onPanel = () => {};
    /** (i, how) when piece i on a wall (layout.pieces) is chosen. @type {(i: number, how: How) => void} */
    this.onPiece = () => {};
    /** (i, velocity) when pad i is played: a key, a press, a trigger, A or OK on it. @type {(i: number, velocity: number) => void} */
    this.onPad = () => {};
    /** (s) when step key s is pressed. @type {(s: number) => void} */
    this.onStep = () => {};
    /** (k, by) when knob k (board.js layoutBoard's knobs) is turned, by this much of its whole turn. @type {(k: number, by: number) => void} */
    this.onKnob = () => {};
    /** (j) when jack j (board.js layoutBoard's panel.jacks) is chosen. @type {(j: number) => void} */
    this.onJack = () => {};
    /** RUN pressed: the clock started, or stopped. */
    this.onRun = () => {};
    /** The cable carried dropped. */
    this.onDrop = () => {};
    /** (columns, rows) the arrows, choosing a pad on a TV while playing. @type {(dc: number, dr: number) => void} */
    this.onPick = () => {};
    /** (note, velocity) a key of the synth pressed, or a computer's key that plays one, until onNoteOff(note). @type {(note: number, velocity: number) => void} */
    this.onNoteOn = () => {};
    /** (note) that key let go. @type {(note: number) => void} */
    this.onNoteOff = () => {};
    /** (note, velocity) a key of the synth played for a moment: a click, A, OK or a trigger on it. @type {(note: number, velocity: number) => void} */
    this.onNoteTap = () => {};
    /** (d, by) when dial d (synthboard.js layoutSynth's dials) is turned, by this much of its whole turn. @type {(d: number, by: number) => void} */
    this.onDial = () => {};
    /** (i) when button i of the synth's panel (layoutSynth's panel.buttons) is pressed. @type {(i: number) => void} */
    this.onButton = () => {};
    /** (by) the keys an octave down (-1) or up (1): Z and X at the synth. @type {(by: number) => void} */
    this.onOctave = () => {};
    /** (by) on a TV at the synth, the arrows: the key chosen so many keys on. @type {(by: number) => void} */
    this.onKeyPick = () => {};
    /** (at) when the visitor starts playing at the board or the synth on a screen, or steps away (null). @type {(at: At | null) => void} */
    this.onPlaying = () => {};
    /** The note the synth's lowest key plays now (main.js: synth.js Synth's lowest). @type {() => number} */
    this.lowest = () => LOWEST;
    /** On a screen, where the visitor stands to play: at the board (its keys are the pads') or the synth (they are its keys); else null. @type {At | null} */
    this.at = null;
    /** On a TV, while playing, the arrows choose a pad or a key (and OK plays it: main.js). */
    this.arrowsPick = false;
    /**
     * What the page shows over the view (the card, the buttons), for the board to be played clear of
     * (main.js). @type {() => import('./board.js').Rect[]}
     */
    this.over = () => [];
    /** @private where the visitor plays from, while playing */
    this._playAt = { x: 0, z: 0 };
    /** @private a walk to the board or the synth is starting, which leaves where one plays */
    this._toBoard = false;
    /** @private the view easing back to level, having walked away from the board looking down at it */
    this._leveling = false;
    /** @private a knob or a dial turned by a drag: which pointer, which knob (or dial), and where it was @type {{ id: number, knob: number, dial: boolean, y: number } | null} */
    this._turning = null;
    /** @private the notes the computer's keys hold, by their names (tv.js keyOf) @type {Map<string, number>} */
    this._keysDown = new Map();
    /** @private the notes presses on the synth's keys hold, by pointer (-1: down, but off the keys) @type {Map<number, number>} */
    this._fingers = new Map();
    this._bindBoard();
    this._window.addEventListener('keyup', (e) => {
      const name = keyOf(/** @type {KeyboardEvent} */ (e)), note = this._keysDown.get(name);
      if (note === undefined) return;
      this._keysDown.delete(name);
      this.onNoteOff(note);
    });
    this._window.addEventListener('blur', () => this._letGo());
    this.renderer.xr.addEventListener('sessionstart', () => this._stop(false));
  }

  /** On a screen, playing at the board or the synth. */
  get playing() {
    return this.at !== null;
  }

  /**
   * What a ray meets first in the room (room.js castRay), with u, v and piece, or on the board
   * (board.js hitBoard) with pad and knob, or on the synth (synthboard.js hitSynth) with key, dial
   * and button; the floor round either is no place to walk to.
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
    out.pad = out.step = out.knob = out.jack = out.key = out.dial = out.button = -1;
    const onBoard = hitBoard(this.board, ox, oy, oz, dx, dy, dz, out, hit ? hit.t : Infinity);
    if (hitSynth(this.synth, ox, oy, oz, dx, dy, dz, out, onBoard || hit ? out.t : Infinity) || onBoard) return out;
    if (hit?.kind === 'floor' && hit.walkable && (boardBlocks(this.board, hit.x, hit.z) || boardBlocks(this.synth, hit.x, hit.z))) hit.walkable = false;
    return hit;
  }

  /**
   * The room's walls (room.js clampWalk), the doorway between its jambs, and round the board and the
   * synth.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    clampWalk(this.layout, fx, fz, x, z, out);
    clampBoard(this.board, fx, fz, out.x, out.z, out);
    return clampBoard(this.synth, fx, fz, out.x, out.z, out);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'piece', 'pad', 'step', 'knob', 'jack',
   * 'run' or 'board' (to walk up to it; not while playing it), 'key', 'dial', 'button' or 'synth'
   * (likewise), or common's ('door').
   * @param {BandHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'piece') return 'piece';
    if (hit && ON_BOARD.has(hit.kind)) return hit.kind === 'board' && this.at === 'board' ? null : hit.kind;
    if (hit && ON_SYNTH.has(hit.kind)) return hit.kind === 'synth' && this.at === 'synth' ? null : hit.kind;
    return super.usable(hit);
  }

  /**
   * Uses what a hit is on: a panel button, a piece on a wall, the board's controls (in VR, or while
   * playing at the board: a pad played, a step key set, a jack, RUN; else, as the rest of the
   * board, a walk up to it), the synth's likewise (a key played for a moment, a button pressed), or
   * common's (the doorway, the floor). Carrying a cable, anything but one of the board's controls
   * drops it.
   * @param {BandHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    const board = how === 'xr' || this.at === 'board', synth = how === 'xr' || this.at === 'synth';
    if (this.carrying && !(board && hit && ON_BOARD.has(hit.kind) && hit.kind !== 'board')) this.onDrop();
    else if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else if (hit?.kind === 'pad' && board) this.onPad(hit.pad, PRESS);
    else if (hit && AT_ONCE.has(hit.kind) && board) this._atOnce(hit);
    else if (hit && ON_BOARD.has(hit.kind)) {
      if (this.at !== 'board') this.walkToBoard();
    } else if (hit?.kind === 'key' && synth) this.onNoteTap(this.lowest() + hit.key, PRESS);
    else if (hit?.kind === 'button' && synth) this.onButton(hit.button);
    else if (hit && ON_SYNTH.has(hit.kind)) {
      if (this.at !== 'synth') this.walkToSynth();
    } else super.use(hit, how);
  }

  /**
   * A step key, a jack or RUN used.
   * @private
   * @param {BandHit} hit
   */
  _atOnce(hit) {
    if (hit.kind === 'step') this.onStep(hit.step);
    else if (hit.kind === 'jack') this.onJack(hit.jack);
    else this.onRun();
  }

  /**
   * In VR, the hand that chooses (and carries what it picks up), then common's.
   * @protected
   * @param {import('common/controls.js').Hand<BandHit>} hand
   */
  _xrSelect(hand) {
    this.selectHand = this.hands.indexOf(hand);
    super._xrSelect(hand);
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
    this.hoverStep = hit?.kind === 'step' ? hit.step : -1;
    this.hoverKnob = hit?.kind === 'knob' ? hit.knob : -1;
    this.hoverJack = hit?.kind === 'jack' ? hit.jack : -1;
    this.hoverKey = hit?.kind === 'key' ? hit.key : -1;
    this.hoverDial = hit?.kind === 'dial' ? hit.dial : -1;
    this.hoverButton = hit?.kind === 'button' ? hit.button : -1;
    const a = this.aim;
    a.has = !!hit && hit.kind !== 'ceiling';
    if (!hit) return;
    a.x = hit.x;
    a.y = hit.y;
    a.z = hit.z;
    a.nx = hit.nx;
    a.ny = hit.ny;
    a.nz = hit.nz;
  }

  /**
   * A hand's reticle on a piece, a pad, a step key, a knob, a jack, RUN, a key, a dial or a button;
   * the rest as common's.
   * @param {string | null} use
   * @param {BandHit} hit
   */
  reticleScale(use, hit) {
    if (use === 'piece') return 1.3;
    if (use === 'pad') return 0.9;
    if (use === 'knob' || use === 'step' || use === 'run' || use === 'dial' || use === 'button') return 0.6;
    if (use === 'key') return 0.5;
    if (use === 'jack') return 0.45;
    return super.reticleScale(use, hit);
  }

  /**
   * Playing: Space is RUN, Escape drops a cable carried or else steps away; at the board a pad's key
   * plays it (Shift: harder) and on a TV the arrows choose a pad; at the synth its keys, the octave's
   * and on a TV the arrows choosing a key. Otherwise walking's.
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  takeKey(e, name) {
    if (!this.at) return false;
    if (name === 'Escape') {
      if (this.carrying) this.onDrop();
      else this.stepAway();
      return true;
    }
    if (name === 'Space' || name === ' ') {
      e.preventDefault();
      if (!e.repeat) this.onRun();
      return true;
    }
    return this.at === 'board' ? this._boardKey(e, name) : this._synthKey(e, name);
  }

  /**
   * At the board: a pad's key plays it; on a TV the arrows choose a pad.
   * @private
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  _boardKey(e, name) {
    const pad = padForKey(name);
    if (pad >= 0) {
      e.preventDefault();
      if (!e.repeat) this.onPad(pad, e.shiftKey ? 1 : KEY);
      return true;
    }
    const pick = this.arrowsPick ? PICK[name] : undefined;
    if (!pick) return false;
    e.preventDefault();
    this.onPick(pick[0], pick[1]);
    return true;
  }

  /**
   * At the synth: a key that plays a note (synth.js NOTE_KEYS) plays it until it comes up (Shift:
   * harder), Z and X move the octave, Q (walking's turn) leaves the view be, and on a TV the arrows
   * choose a key.
   * @private
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  _synthKey(e, name) {
    const note = noteForKey(name, (this.lowest() - LOWEST) / 12);
    if (note >= 0) {
      e.preventDefault();
      if (!e.repeat && !this._keysDown.has(name)) {
        this._keysDown.set(name, note);
        this.onNoteOn(note, e.shiftKey ? 1 : KEY);
      }
      return true;
    }
    if (name === OCTAVE_KEYS.down || name === OCTAVE_KEYS.up) {
      e.preventDefault();
      if (!e.repeat) this.onOctave(name === OCTAVE_KEYS.up ? 1 : -1);
      return true;
    }
    if (name === 'KeyQ') return true;
    const pick = this.arrowsPick ? KEY_PICK[name] : undefined;
    if (pick === undefined) return false;
    e.preventDefault();
    this.onKeyPick(pick);
    return true;
  }

  /**
   * The wheel over a knob or a dial turns it.
   * @param {number} dy
   */
  takeWheel(dy) {
    if (this.hoverKnob >= 0) this.onKnob(this.hoverKnob, -dy / 1200);
    else if (this.hoverDial >= 0) this.onDial(this.hoverDial, -dy / 1200);
    else return false;
    return true;
  }

  /**
   * In VR, a stick pushed up or down while its hand points at a knob or a dial turns it (and neither
   * walks nor turns the visitor): slowly pushed a little, more quickly all the way, the tempo more
   * slowly still (its whole turn is many beats a minute).
   * @param {import('common/controls.js').Hand<BandHit>} hand
   * @param {Gamepad} pad
   * @param {number} ax
   * @param {number} ay
   * @param {number} dt
   */
  takeHand(hand, pad, ax, ay, dt) {
    const hit = hand.last;
    if ((hit?.kind !== 'knob' && hit?.kind !== 'dial') || Math.abs(ay) < 0.25) return false;
    const push = (Math.abs(ay) - 0.25) / 0.75, by = -Math.sign(ay) * push * push * dt;
    if (hit.kind === 'dial') this.onDial(hit.dial, by * STICK_TURN);
    else this.onKnob(hit.knob, by * (this.board.knobs[hit.knob]?.part === 'clock' ? TEMPO_TURN : STICK_TURN));
    return true;
  }

  /**
   * Walks up to the board to play it: on a screen to where all of its top is in view, clear of what
   * the page shows over it (board.js boardFront, for this view's field and shape, and `over`),
   * looking down at it, then playing; with less motion, there at once. In VR, a teleport to arm's
   * length (board.js boardStand), unless there already.
   */
  walkToBoard() {
    this._walkTo('board');
  }

  /** Walks up to the synth to play it, as to the board; in VR to where its keys are in reach of a hand. */
  walkToSynth() {
    this._walkTo('synth');
  }

  /**
   * @private
   * @param {At} at
   */
  _walkTo(at) {
    const desk = at === 'board' ? this.board : this.synth, other = at === 'board' ? this.synth : this.board;
    if (this.renderer.xr.isPresenting) {
      const s = at === 'board' ? boardStand(desk) : boardStand(desk, 0.3);
      this.camera.getWorldPosition(this._head);
      if (Math.hypot(this._head.x - s.x, this._head.z - s.z) > 0.5) this._teleport(s.x, s.z);
      return;
    }
    const view = /** @type {import('three').PerspectiveCamera} */ (this.camera);
    const h = at === 'synth' ? SYNTH.key.rise + SYNTH.key.blackRise : undefined;
    const f = boardFront(desk, { fov: view.fov, aspect: view.aspect, over: this.over(), h, free: (x, z) => !boardBlocks(other, x, z) });
    const p = this.rig.position;
    this._stop(false);
    this.stand();
    this.restPitch = clamp(f.pitch, -1.3, 0.3); // a little up: the board under the card on a phone
    this._toBoard = true;
    try {
      this._startWalk(this.route(p.x, p.z, f.x, f.z), f.yaw, () => this._play(at, f.x, f.z));
    } finally {
      this._toBoard = false;
    }
  }

  /** Steps back from the board or the synth (Escape, a TV's Back, a gamepad's B): a little way back, looking up again. */
  stepAway() {
    if (!this.at) return;
    this._stop(false);
    const p = this.rig.position;
    this._startWalk([[p.x, p.z + 0.45]], this.yaw);
  }

  /**
   * At the board or the synth, playing.
   * @private
   * @param {At} at
   * @param {number} x
   * @param {number} z
   */
  _play(at, x, z) {
    this._playAt.x = x;
    this._playAt.z = z;
    this._leveling = false;
    this.at = at;
    this.onPlaying(at);
  }

  /**
   * Not playing any more, every key held let go: the view comes back to level on the next walk that
   * faces somewhere, or (`level`) at once, easing.
   * @private
   * @param {boolean} level
   */
  _stop(level) {
    this.restPitch = 0;
    if (!this.at) return;
    this.at = null;
    this._leveling = level;
    this._turning = null;
    this._letGo();
    this.onPlaying(null);
  }

  /**
   * Every note a computer's key or a press holds let go (stepping away, the page left for another
   * window).
   * @private
   */
  _letGo() {
    for (const note of this._keysDown.values()) this.onNoteOff(note);
    this._keysDown.clear();
    for (const note of this._fingers.values()) if (note >= 0) this.onNoteOff(note);
    this._fingers.clear();
  }

  /**
   * Any walk but the one to the board or the synth leaves it.
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
   * Common's, then: walking off from where one plays steps away, and the view comes back to level
   * (with less motion, at once; a drag stops it).
   * @param {number} dt
   */
  update(dt) {
    super.update(dt);
    if (this.renderer.xr.isPresenting) return;
    const p = this.rig.position;
    if (this.at && !this.auto && Math.hypot(p.x - this._playAt.x, p.z - this._playAt.z) > AWAY) this._stop(true);
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
   * Presses where one plays, before walking's. At the board: one on a pad plays it as it goes down
   * (as many fingers as there are), one on a step key, a jack or RUN works at once, one on a knob
   * turns it as it is dragged up or down. At the synth: one on a key plays it until it comes up,
   * sliding onto another plays that (as many fingers as there are: chords), one on a button works
   * at once, one on a dial turns it as a knob. Elsewhere, walking's. Taken in the view's parent, as
   * the press goes down to the view.
   * @private
   */
  _bindBoard() {
    const view = this.dom, around = view.parentElement ?? view;
    around.addEventListener('pointerdown', (e) => {
      if (!this.at || this.renderer.xr.isPresenting || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const hit = this._pickScreen(e.clientX, e.clientY);
      if (!hit) return;
      const board = this.at === 'board';
      if (board && hit.kind === 'pad') this.onPad(hit.pad, e.shiftKey ? 1 : PRESS);
      else if (board && AT_ONCE.has(hit.kind)) this._atOnce(hit);
      else if (board && hit.kind === 'knob') this._grab(e, hit.knob, false);
      else if (!board && hit.kind === 'key') {
        const note = this.lowest() + hit.key;
        this._fingers.set(e.pointerId, note);
        view.setPointerCapture?.(e.pointerId);
        this.onNoteOn(note, e.shiftKey ? 1 : PRESS);
      } else if (!board && hit.kind === 'button') this.onButton(hit.button);
      else if (!board && hit.kind === 'dial') this._grab(e, hit.dial, true);
      else return;
      e.stopPropagation();
      this.onActivity();
    }, { capture: true });
    view.addEventListener('pointermove', (e) => {
      const t = this._turning;
      if (t && t.id === e.pointerId) {
        const by = (t.y - e.clientY) / 160;
        if (t.dial) this.onDial(t.knob, by);
        else this.onKnob(t.knob, by);
        t.y = e.clientY;
        return;
      }
      const held = this._fingers.get(e.pointerId);
      if (held === undefined) return;
      // Slid onto another key, still down: that one plays (a glissando); off the keys, let go.
      const hit = this._pickScreen(e.clientX, e.clientY);
      const note = hit?.kind === 'key' ? this.lowest() + hit.key : -1;
      if (note === held) return;
      if (held >= 0) this.onNoteOff(held);
      this._fingers.set(e.pointerId, note);
      if (note >= 0) this.onNoteOn(note, GLISS);
    });
    const end = (/** @type {PointerEvent} */ e) => {
      if (this._turning?.id === e.pointerId) this._turning = null;
      const held = this._fingers.get(e.pointerId);
      if (held === undefined) return;
      this._fingers.delete(e.pointerId);
      if (held >= 0) this.onNoteOff(held);
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
  }

  /**
   * A knob (or a dial) taken by a press, to turn as it is dragged.
   * @private
   * @param {PointerEvent} e
   * @param {number} knob
   * @param {boolean} dial
   */
  _grab(e, knob, dial) {
    this._turning = { id: e.pointerId, knob, dial, y: e.clientY };
    this.dom.setPointerCapture?.(e.pointerId);
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
