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
//     picked up, then plugged in), RUN (onRun; Space too) and the rest of it.
//   the synth (synthboard.js) beside it: one walks round it too, and a ray meets its keys (a press
//     on one is onNoteOn(note, velocity) as it goes down and onNoteOff(note) as it comes up, sliding
//     onto the next plays that; a click, A, OK or a trigger elsewhere, onNoteTap), its dials
//     (onDial(d, by), as the board's knobs), its panel's buttons (onButton(i)), its jacks (onJack, as
//     the board's: the room's list of them, the board's first) and the rest of it.
//   the rack (rackboard.js) beside the synth: one walks round it too, and a ray meets its keys, each
//     step's, its accent's and its slide's (onSeqKey(row, s)), its knobs, each step's note, the
//     clock's tempo, the delay's and the LFO's (onRackKnob(k, by), as the board's knobs), its panel's
//     buttons (onRackButton(i): RUN, the octave), its jacks (onJack, as the board's: the room's list
//     of them, the board's, then the synth's, first) and the rest of it.
//     Choosing any of them walks up to it to play it (walkToBoard, walkToSynth, walkToRack): on a
//     screen the visitor is then `at` it (onPlaying), so a press on a pad, a key, a step key, a jack,
//     RUN or a button works as it goes down (fingers at once on a phone); a jack works so on another
//     desk too, for a cable from one to the other. At the board the keys 1–4, Q–R and A–F are the
//     pads' (Shift harder), on a TV the arrows choose a pad (onPick); at the synth the middle row
//     from A plays the white keys and the row over it the black ones (onNoteOn, then onNoteOff as
//     each comes up), Z and X move the octave (onOctave), and on a TV the arrows choose a key
//     (onKeyPick); at the rack the keys 1–8 and Q–I are the steps' (Shift their accents'), Z and X
//     move its octave (onSeqOctave), and on a TV the arrows choose a step and turn its note
//     (onSeqPick). Escape (a cable carried first), Back or walking off steps away (stepAway).
//     While a cable is `carrying`: a jack plugs it in, the controls where one plays work, another
//     desk walks there with it (`goingTo` while on the way), and choosing anything else, or Escape,
//     drops it (onDrop). Where it is pointed: `aim` (the view's pointer), or in VR the hand that last
//     chose (`selectHand`).
// What a click, a tap, A, OK or a trigger is on comes to use(hit, how): the panel, the pieces, the
// board, the synth and the rack here, and common's the doorway (onDoor) and the floor (a walk there,
// in VR a teleport).
import { Controls as Walking } from 'common/controls.js';
import { keyOf } from 'common/tv.js';
import { EYE, castRay, clampWalk, panelButtonAt, pieceFront } from './room.js';
import { boardBlocks, boardFront, boardStand, clampBoard, hitBoard } from './board.js';
import { SYNTH, hitSynth } from './synthboard.js';
import { RACK, SEQ_ROWS, hitRack } from './rackboard.js';
import { padForKey } from './drums.js';
import { LOWEST, OCTAVE_KEYS, noteForKey } from './synth.js';
import { STEPS } from './pattern.js';

/** @typedef {import('./board.js').BandHit} BandHit */
/** @typedef {import('./rackboard.js').SeqRow} SeqRow */
/** @typedef {import('common/controls.js').How} How */
/** Where the visitor plays, on a screen: at the drum board, the synth or the rack. @typedef {'board' | 'synth' | 'rack'} At */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** How hard a pad or a key is played by a press, a trigger, A or OK, and by a key (Shift: as hard as can be). */
const PRESS = 0.85, KEY = 0.8;
/** How hard a key slid onto, the press still down, is played (a glissando). */
const GLISS = 0.6;
/** What a ray can meet on the board (and a jack on the synth too: deskOf), and of it what is a control, used at once while playing. */
const ON_BOARD = new Set(['pad', 'step', 'knob', 'jack', 'run', 'board']);
const AT_ONCE = new Set(['step', 'jack', 'run']);
/** What a ray can meet on the synth (and its jacks). */
const ON_SYNTH = new Set(['key', 'dial', 'button', 'synth']);
/** What a ray can meet on the rack (and its jacks), and of it the keys. */
const ON_RACK = new Set([...SEQ_ROWS, 'rackknob', 'rackbutton', 'rack']);
/** @type {ReadonlySet<string>} */
const SEQ_KEYS = new Set(SEQ_ROWS);
/** The rest of each desk, which walks up to it. */
const DESKS = new Set(['board', 'synth', 'rack']);
/** On a TV, playing: the arrows choose a pad, so many columns right and rows farther. @type {Readonly<Record<string, [number, number]>>} */
const PICK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
/** On a TV, at the synth: the arrows choose a key, so many keys on (up and down, an octave). @type {Readonly<Record<string, number>>} */
const KEY_PICK = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 12, ArrowDown: -12 };
/** On a TV, at the rack: the arrows choose a step (left and right) or turn its note (up and down, a semitone): [steps on, semitones up]. @type {Readonly<Record<string, [number, number]>>} */
const SEQ_PICK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
/** At the rack, the keys that are the steps', 1–16: the number row's first eight, then the row under them. */
const SEQ_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'];
/** How far the visitor goes from where they play before they have stepped away. */
const AWAY = 0.25;
/** In VR, how far a whole push of a stick turns a knob or a dial in a second (of its whole turn), and the tempo's. */
const STICK_TURN = 0.4, TEMPO_TURN = 0.15;

/**
 * Walking about the room, with its control panel, the pictures on its walls, the drum board, the
 * synth and the rack.
 * @extends {Walking<BandHit>}
 */
export class Controls extends Walking {
  /**
   * @param {Omit<import('common/controls.js').ControlsOptions<BandHit>, 'eye' | 'hit'> & { layout: import('./room.js').Layout, board: import('./board.js').Board, synth: import('./synthboard.js').SynthDesk, rack: import('./rackboard.js').RackDesk }} options
   *   common's, the room's layout (room.js layoutRoom), the drum board's (board.js layoutBoard), the synth's (synthboard.js layoutSynth) and the rack's (rackboard.js layoutRack)
   */
  constructor({ layout, board, synth, rack, ...options }) {
    super({ ...options, eye: EYE, hit: () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: false, piece: -1, pad: -1, step: -1, knob: -1, jack: -1, key: -1, dial: -1, button: -1, seq: -1, rack: -1 }) });
    this.layout = layout; // after super(): common's constructor calls none of the methods below
    this.board = board;
    this.synth = synth;
    this.rack = rack;
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
    /** The rack's key pointed at (its index in its keys: row r's for step s is r * STEPS + s), else -1, its knob and its panel's button. */
    this.hoverSeqKey = -1;
    this.hoverRackKnob = -1;
    this.hoverRackButton = -1;
    /** Where the view's pointer, or its middle, is on something, and the way out of it (`has` false: nothing). */
    this.aim = { has: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
    /** In VR, the hand that last chose something (its index in hands), else -1. */
    this.selectHand = -1;
    /** A cable is being carried (main.js): choosing anything but a control or a desk drops it, and so does Escape. */
    this.carrying = false;
    /** On a screen, the desk the visitor is walking up to, to play (a cable carried stays carried on the way), else null. @type {At | null} */
    this.goingTo = null;
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
    /** (j) when jack j (the room's list of them: board.js layoutBoard's panel.jacks, then the synth's) is chosen. @type {(j: number) => void} */
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
    /** (row, s) when step s's key in that row of the rack's (rackboard.js SEQ_ROWS: its own, its accent's, its slide's) is pressed. @type {(row: SeqRow, s: number) => void} */
    this.onSeqKey = () => {};
    /** (k, by) when knob k of the rack's (rackboard.js layoutRack's knobs: the steps' notes, the tempo, the delay's, the LFO's) is turned, by this much of its whole turn. @type {(k: number, by: number) => void} */
    this.onRackKnob = () => {};
    /** (i) when button i of the rack's panel (layoutRack's panel.buttons) is pressed. @type {(i: number) => void} */
    this.onRackButton = () => {};
    /** (by) the sequencer an octave down (-1) or up (1): Z and X at the rack. @type {(by: number) => void} */
    this.onSeqOctave = () => {};
    /** (steps, semitones) on a TV at the rack, the arrows: the step chosen so many steps on, or its note so many semitones up. @type {(steps: number, semitones: number) => void} */
    this.onSeqPick = () => {};
    /** (at) when the visitor starts playing at the board, the synth or the rack on a screen, or steps away (null). @type {(at: At | null) => void} */
    this.onPlaying = () => {};
    /** The note the synth's lowest key plays now (main.js: synth.js Synth's lowest). @type {() => number} */
    this.lowest = () => LOWEST;
    /** On a screen, where the visitor stands to play: at the board (its keys are the pads'), the synth (they are its keys) or the rack (they are its steps'); else null. @type {At | null} */
    this.at = null;
    /** On a TV, while playing, the arrows choose a pad, a key or a step (and OK plays it: main.js). */
    this.arrowsPick = false;
    /**
     * What the page shows over the view (the card, the buttons), for the board to be played clear of
     * (main.js). @type {() => import('./board.js').Rect[]}
     */
    this.over = () => [];
    /** @private where the visitor plays from, while playing */
    this._playAt = { x: 0, z: 0 };
    /** @private a walk to a desk is starting, which leaves where one plays */
    this._toBoard = false;
    /** @private the view easing back to level, having walked away from the board looking down at it */
    this._leveling = false;
    /** @private a knob turned by a drag: which pointer, which knob (the board's, a dial of the synth's, the rack's), and where it was @type {{ id: number, knob: number, on: 'knob' | 'dial' | 'rackknob', y: number } | null} */
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

  /** On a screen, playing at the board, the synth or the rack. */
  get playing() {
    return this.at !== null;
  }

  /**
   * What a ray meets first in the room (room.js castRay), with u, v and piece, or on the board
   * (board.js hitBoard) with pad and knob, on the synth (synthboard.js hitSynth) with key, dial and
   * button, or on the rack (rackboard.js hitRack) with seq and rack; the floor round any of them is
   * no place to walk to.
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
    out.pad = out.step = out.knob = out.jack = out.key = out.dial = out.button = out.seq = out.rack = -1;
    let met = hitBoard(this.board, ox, oy, oz, dx, dy, dz, out, hit ? hit.t : Infinity);
    met = hitSynth(this.synth, ox, oy, oz, dx, dy, dz, out, met || hit ? out.t : Infinity) || met;
    met = hitRack(this.rack, ox, oy, oz, dx, dy, dz, out, met || hit ? out.t : Infinity) || met;
    if (met) return out;
    if (hit?.kind === 'floor' && hit.walkable && (boardBlocks(this.board, hit.x, hit.z) || boardBlocks(this.synth, hit.x, hit.z) || boardBlocks(this.rack, hit.x, hit.z))) hit.walkable = false;
    return hit;
  }

  /**
   * The room's walls (room.js clampWalk), the doorway between its jambs, and round the board, the
   * synth and the rack.
   * @param {number} fx
   * @param {number} fz
   * @param {number} x
   * @param {number} z
   * @param {{ x: number, z: number }} out
   */
  clampWalk(fx, fz, x, z, out) {
    clampWalk(this.layout, fx, fz, x, z, out);
    clampBoard(this.board, fx, fz, out.x, out.z, out);
    clampBoard(this.synth, fx, fz, out.x, out.z, out);
    return clampBoard(this.rack, fx, fz, out.x, out.z, out);
  }

  /**
   * What could be used where a hit is: a panel button's id, 'piece', 'pad', 'step', 'knob', 'jack',
   * 'run' or 'board' (to walk up to it; not while playing it), 'key', 'dial', 'button' or 'synth'
   * (likewise), 'seq', 'accent', 'slide', 'rackknob', 'rackbutton' or 'rack' (likewise), or common's
   * ('door').
   * @param {BandHit | null} hit
   */
  usable(hit) {
    if (hit?.kind === 'panel') return panelButtonAt(hit.u, hit.v);
    if (hit?.kind === 'piece') return 'piece';
    const desk = this.deskOf(hit);
    if (hit && desk) return hit.kind === desk && this.at === desk ? null : hit.kind;
    return super.usable(hit);
  }

  /**
   * The desk a hit is on, the board, the synth or the rack (a jack by where it is in the room's list
   * of them), else null.
   * @param {BandHit | null} hit
   * @returns {At | null}
   */
  deskOf(hit) {
    if (!hit) return null;
    if (hit.kind === 'jack') return hit.jack < this.synth.panel.jackBase ? 'board' : hit.jack < this.rack.panel.jackBase ? 'synth' : 'rack';
    return ON_BOARD.has(hit.kind) ? 'board' : ON_SYNTH.has(hit.kind) ? 'synth' : ON_RACK.has(hit.kind) ? 'rack' : null;
  }

  /**
   * Uses what a hit is on: a panel button, a piece on a wall, the board's controls (in VR, or while
   * playing at the board: a pad played, a step key set, RUN; else, as the rest of the board, a walk
   * up to it), the synth's likewise (a key played for a moment, a button pressed), the rack's
   * likewise (a key pressed, a button), a jack on any of them (in VR, or while playing at any: for a
   * cable from one to another), or common's (the doorway, the floor). Carrying a cable, a desk's
   * controls work where one plays, another desk walks there with it, and anything else drops it.
   * @param {BandHit | null} hit
   * @param {How} how
   */
  use(hit, how) {
    const xr = how === 'xr', desk = this.deskOf(hit), here = !!desk && (xr || desk === this.at);
    const control = here && !!hit && !DESKS.has(hit.kind);
    if (hit?.kind === 'jack' && (xr || this.at)) this.onJack(hit.jack);
    else if (this.carrying && !control && (here || !desk)) this.onDrop();
    else if (hit?.kind === 'panel') this._press(panelButtonAt(hit.u, hit.v));
    else if (hit?.kind === 'piece') this.onPiece(hit.piece, how);
    else if (control && hit?.kind === 'pad') this.onPad(hit.pad, PRESS);
    else if (control && hit && AT_ONCE.has(hit.kind)) this._atOnce(hit);
    else if (control && hit?.kind === 'key') this.onNoteTap(this.lowest() + hit.key, PRESS);
    else if (control && hit?.kind === 'button') this.onButton(hit.button);
    else if (control && hit && SEQ_KEYS.has(hit.kind)) this.onSeqKey(/** @type {SeqRow} */ (hit.kind), hit.seq);
    else if (control && hit?.kind === 'rackbutton') this.onRackButton(hit.rack);
    else if (desk) {
      if (this.at !== desk) this._walkTo(desk);
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
    const row = hit ? SEQ_ROWS.indexOf(/** @type {SeqRow} */ (hit.kind)) : -1;
    this.hoverSeqKey = hit && row >= 0 ? row * STEPS + hit.seq : -1;
    this.hoverRackKnob = hit?.kind === 'rackknob' ? hit.rack : -1;
    this.hoverRackButton = hit?.kind === 'rackbutton' ? hit.rack : -1;
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
   * A hand's reticle on a piece, a pad, a step key, a knob, a jack, RUN, a key, a dial or a button,
   * the rack's keys, knobs and buttons; the rest as common's.
   * @param {string | null} use
   * @param {BandHit} hit
   */
  reticleScale(use, hit) {
    if (use === 'piece') return 1.3;
    if (use === 'pad') return 0.9;
    if (use === 'knob' || use === 'step' || use === 'run' || use === 'dial' || use === 'button' || use === 'rackbutton') return 0.6;
    if (use === 'key' || use === 'rackknob' || (use && SEQ_KEYS.has(use))) return 0.5;
    if (use === 'jack') return 0.45;
    return super.reticleScale(use, hit);
  }

  /**
   * Escape drops a cable carried, wherever one is. Playing: Space is RUN, Escape steps away; at the
   * board a pad's key plays it (Shift: harder) and on a TV the arrows choose a pad; at the synth its
   * keys, the octave's and on a TV the arrows choosing a key; at the rack the steps' keys, the
   * octave's and on a TV the arrows. Otherwise walking's.
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  takeKey(e, name) {
    if (name === 'Escape' && this.carrying) {
      this.onDrop();
      return true;
    }
    if (!this.at) return false;
    if (name === 'Escape') {
      this.stepAway();
      return true;
    }
    if (name === 'Space' || name === ' ') {
      e.preventDefault();
      if (!e.repeat) this.onRun();
      return true;
    }
    return this.at === 'board' ? this._boardKey(e, name) : this.at === 'synth' ? this._synthKey(e, name) : this._rackKey(e, name);
  }

  /**
   * At the rack: a step's key (1–8, then Q–I) plays it or rests it (Shift: its accent), Z and X move
   * the sequencer's octave, and on a TV the arrows choose a step and turn its note.
   * @private
   * @param {KeyboardEvent} e
   * @param {string} name
   */
  _rackKey(e, name) {
    const s = SEQ_KEY_CODES.indexOf(name);
    if (s >= 0) {
      e.preventDefault();
      if (!e.repeat) this.onSeqKey(e.shiftKey ? 'accent' : 'seq', s);
      return true;
    }
    if (name === OCTAVE_KEYS.down || name === OCTAVE_KEYS.up) {
      e.preventDefault();
      if (!e.repeat) this.onSeqOctave(name === OCTAVE_KEYS.up ? 1 : -1);
      return true;
    }
    const pick = this.arrowsPick ? SEQ_PICK[name] : undefined;
    if (!pick) return false;
    e.preventDefault();
    this.onSeqPick(pick[0], pick[1]);
    return true;
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
    else if (this.hoverRackKnob >= 0) this.onRackKnob(this.hoverRackKnob, -dy / 1200);
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
    if ((hit?.kind !== 'knob' && hit?.kind !== 'dial' && hit?.kind !== 'rackknob') || Math.abs(ay) < 0.25) return false;
    const push = (Math.abs(ay) - 0.25) / 0.75, by = -Math.sign(ay) * push * push * dt;
    if (hit.kind === 'dial') this.onDial(hit.dial, by * STICK_TURN);
    else if (hit.kind === 'rackknob') this.onRackKnob(hit.rack, by * (this.rack.knobs[hit.rack]?.part === 'tempo' ? TEMPO_TURN : STICK_TURN));
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

  /** Walks up to the rack to play it, as to the synth. */
  walkToRack() {
    this._walkTo('rack');
  }

  /**
   * @private
   * @param {At} at
   */
  _walkTo(at) {
    const desk = at === 'board' ? this.board : at === 'synth' ? this.synth : this.rack;
    const others = [this.board, this.synth, this.rack].filter((D) => D !== desk);
    if (this.renderer.xr.isPresenting) {
      const s = at === 'board' ? boardStand(desk) : boardStand(desk, 0.3);
      this.camera.getWorldPosition(this._head);
      if (Math.hypot(this._head.x - s.x, this._head.z - s.z) > 0.5) this._teleport(s.x, s.z);
      return;
    }
    const view = /** @type {import('three').PerspectiveCamera} */ (this.camera);
    const h = at === 'synth' ? SYNTH.key.rise + SYNTH.key.blackRise : at === 'rack' ? RACK.knob.h : undefined;
    const f = boardFront(desk, { fov: view.fov, aspect: view.aspect, over: this.over(), h, free: (x, z) => !others.some((D) => boardBlocks(D, x, z)) });
    const p = this.rig.position;
    this.goingTo = at;
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

  /** Steps back from the board, the synth or the rack (Escape, a TV's Back, a gamepad's B): a little way back, looking up again. */
  stepAway() {
    if (!this.at) return;
    this._stop(false);
    const p = this.rig.position;
    this._startWalk([[p.x, p.z + 0.45]], this.yaw);
  }

  /**
   * At the board, the synth or the rack, playing.
   * @private
   * @param {At} at
   * @param {number} x
   * @param {number} z
   */
  _play(at, x, z) {
    this._playAt.x = x;
    this._playAt.z = z;
    this._leveling = false;
    this.goingTo = null;
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
   * Any walk but the one to a desk leaves where one plays (and one taken over on the way there
   * drops the cable carried).
   * @protected
   * @param {[number, number][]} points
   * @param {number | null} face
   * @param {(() => void) | null} [done]
   * @param {boolean} [turn]
   */
  _startWalk(points, face, done = null, turn = points.length > 1) {
    if (!this._toBoard) {
      const going = this.goingTo;
      this.goingTo = null;
      this._stop(false);
      if (going && this.carrying) this.onDrop();
    }
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
   * (as many fingers as there are), one on a step key or RUN works at once, one on a knob turns it
   * as it is dragged up or down. At the synth: one on a key plays it until it comes up, sliding onto
   * another plays that (as many fingers as there are: chords), one on a button works at once, one on
   * a dial turns it as a knob. At the rack: one on a key or a button works at once, one on a knob
   * turns it. At any of them, one on a jack of any works at once. Elsewhere, walking's. Taken in the
   * view's parent, as the press goes down to the view.
   * @private
   */
  _bindBoard() {
    const view = this.dom, around = view.parentElement ?? view;
    around.addEventListener('pointerdown', (e) => {
      if (!this.at || this.renderer.xr.isPresenting || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const hit = this._pickScreen(e.clientX, e.clientY);
      if (!hit) return;
      const at = this.at;
      if (hit.kind === 'jack') this.onJack(hit.jack);
      else if (at === 'board' && hit.kind === 'pad') this.onPad(hit.pad, e.shiftKey ? 1 : PRESS);
      else if (at === 'board' && AT_ONCE.has(hit.kind)) this._atOnce(hit);
      else if (at === 'board' && hit.kind === 'knob') this._grab(e, hit.knob, 'knob');
      else if (at === 'synth' && hit.kind === 'key') {
        const note = this.lowest() + hit.key;
        this._fingers.set(e.pointerId, note);
        view.setPointerCapture?.(e.pointerId);
        this.onNoteOn(note, e.shiftKey ? 1 : PRESS);
      } else if (at === 'synth' && hit.kind === 'button') this.onButton(hit.button);
      else if (at === 'synth' && hit.kind === 'dial') this._grab(e, hit.dial, 'dial');
      else if (at === 'rack' && SEQ_KEYS.has(hit.kind)) this.onSeqKey(/** @type {SeqRow} */ (hit.kind), hit.seq);
      else if (at === 'rack' && hit.kind === 'rackbutton') this.onRackButton(hit.rack);
      else if (at === 'rack' && hit.kind === 'rackknob') this._grab(e, hit.rack, 'rackknob');
      else return;
      e.stopPropagation();
      this.onActivity();
    }, { capture: true });
    view.addEventListener('pointermove', (e) => {
      const t = this._turning;
      if (t && t.id === e.pointerId) {
        const by = (t.y - e.clientY) / 160;
        if (t.on === 'dial') this.onDial(t.knob, by);
        else if (t.on === 'rackknob') this.onRackKnob(t.knob, by);
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
   * A knob (the board's, a dial, the rack's) taken by a press, to turn as it is dragged.
   * @private
   * @param {PointerEvent} e
   * @param {number} knob
   * @param {'knob' | 'dial' | 'rackknob'} on
   */
  _grab(e, knob, on) {
    this._turning = { id: e.pointerId, knob, on, y: e.clientY };
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
