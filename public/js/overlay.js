// The page around the 3D view (not shown in a headset), as outside's and the hallway's. The card is
// the page's <nav>: the room's name, the way back to the hallway as a real link (for keyboards,
// screen readers and browsers without WebGL), its description, what hangs on its walls (each one
// that leads somewhere a link there, the rest buttons that walk up to them), Start / Leave shared session (and,
// in one, how it's going), Drums, Synth, Rack, Keys, Guitar, Sound, and Settings, the control panel's choices: motion
// (common/access.js, for a screen too), how to move and turn in VR, the comfort vignette and seated
// mode. The view is the page's <main>, with a hint on how to move, the Wave, Copy invite link,
// Fullscreen and Enter VR buttons, the dot a gamepad aims with, and short messages, said politely. So
// everything the room offers in 3D is a control here too: the doorway is the link, the panel's
// buttons are Settings, the session's button and Enter VR, and the pieces on the walls are On the
// walls. In a shared session the card also has the visitor's name.
// Drums is the drum board: a button to go and play it (or step away), its clock (Start or Stop, and
// the tempo), its pads as buttons (each plays as it is pressed, as on the board), the steps of the
// pad last played as toggles (the step playing marked), its knobs and the delay's as sliders, and the
// cables as a choice for each of the board's inputs (the synth's sound and the keyboard's among those
// for the delay's).
// Synth is the synth: a button to go and play it, its keys (each sounds while pressed, one stop among
// them with the arrows going along them), its sounds (the presets a choice, Mono, the octave), its
// arpeggiator (off or one of its ways, Hold, the octaves it plays over), its knobs as sliders, a
// section each as on its top, and the cables into its inputs likewise. Rack is the rack beside it: a
// button to go and play at it, its clock (the room's again: Start or Stop, the tempo), its
// sequencer's sixteen steps a row each (whether the step plays, its note a choice, its accent and its
// slide; the step playing marked), the octave the line plays in, its delay's knobs, its LFO's, its
// envelope's, its mixer's, its filter's and its reverb's as sliders, and the cables into its inputs
// (one that would bring a sound back round into itself refused, and said why). Keys is the keyboard: a button to go and play at it, its
// keys as the synth's, its sound (the organ, the electric piano or both, Sustain, the octave the
// computer's keys play in), its drawbars as sliders in eighths, its percussion's switches, its
// organ's knobs and its electric piano's, a section each as on its top, and the cable into its input
// (ROTARY). Guitar is the guitar: a button to go and play at it, its chords (a choice, or the strings
// open) with buttons that strum them down or up and mute them, its strings a row each with a button
// for each fret (pressing the string there and plucking it while it is pressed; one stop among them,
// the arrows going along and across), its pickup, its knobs and its amp's as sliders, its pedals
// (each on or off, and its knob), and the cables into its inputs (WAH, CLOCK).
// Sound is the volume and mute over the room's sound, and a MIDI device to play from, where the
// browser has Web MIDI.
// On a TV (common's tv.js) the remote reaches only the card, so Wave is in it, and there is nothing
// to copy a link to: the invite link is shown to type on another device. Fullscreen and Enter VR
// are not offered there (main.js), nor the synth's keys, the keyboard's or the guitar's frets (its
// remote plays them there).
import { KNOBS, PADS, ROWS, keyLabel, knobText } from './drums.js';
import { TEMPO } from './clock.js';
import { STEPS } from './pattern.js';
import { DELAY_KNOBS, MAX_STEPS, delaySteps, delayText } from './delay.js';
import { LFO_KNOBS, LFO_RATES, LFO_SHAPES, knobPlace, lfoText } from './lfo.js';
import { FILTER_KNOBS, FILTER_MODES, filterText } from './filter.js';
import { REVERB_KNOBS, reverbText } from './reverb.js';
import { ENVELOPE_KNOBS, envelopeText } from './envelope.js';
import { MIXER_KNOBS, mixerText } from './mixer.js';
import { JACKS } from './patch.js';
import { KEYS, LOWEST, NOTE_KEYS, OCTAVES, PRESETS, SECTIONS, SYNTH_KNOBS, isBlack, noteName, spokenNote, synthText } from './synth.js';
import { ARP_MODES, ARP_RANGES } from './arp.js';
import { SEQ_OCTAVES, SEQ_RANGE } from './seq.js';
import { KEYS_COUNT, KEYS_KNOBS, KEYS_LOWEST, KEYS_OCTAVES, KEYS_SECTIONS, KEYS_SOUNDS, KEYS_SWITCHES, drawbarStep, isDrawbar, keysText, registration } from './keys.js';
import { CHORDS, CHORD_KEYS, GUITAR_KNOBS, GUITAR_SECTIONS, GUITAR_STRINGS, PEDALS, PICKUPS, guitarKnobName, guitarText } from './guitar.js';

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

/** A toggle pressed, or not (aria-pressed), set only when it changes. @param {Element} b @param {boolean} on */
function press(b, on) {
  const pressed = String(on);
  if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
}

/** A delay's knobs (delay.js) on its sliders, and in words: its time in steps, the rest in percent. */
function showDelay(inputs, knobs) {
  for (const [name, { input, out }] of inputs) {
    const value = String(name === 'time' ? delaySteps(knobs[name]) : Math.round(knobs[name] * 100));
    if (input.value !== value) input.value = value;
    const text = delayText(name, knobs[name]);
    if (out.textContent !== text) {
      out.textContent = text;
      input.setAttribute('aria-valuetext', text);
    }
  }
}

/** How many places an LFO knob's slider has (its rate's, its shape's), else 0 (its depth: a percent). */
const lfoPlaces = (name) => (name === 'rate' ? LFO_RATES.length : name === 'shape' ? LFO_SHAPES.length : 0);
/** How many places a filter knob's slider has (its mode's), else 0 (a percent). */
const filterPlaces = (name) => (name === 'mode' ? FILTER_MODES.length : 0);

/**
 * A module's knobs (the LFO's, the envelope's, the mixer's, the filter's, the reverb's) on their
 * sliders, and in words: a knob that turns in steps at its place (from 1), the rest in percent.
 * @param {Map<string, { input: HTMLInputElement, out: HTMLOutputElement }>} inputs
 * @param {Record<string, number>} knobs
 * @param {(name: string) => number} places
 * @param {(name: string, k: number) => string} text
 */
function showKnobs(inputs, knobs, places, text) {
  for (const [name, { input, out }] of inputs) {
    const p = places(name);
    const value = String(p ? knobPlace(knobs[name], p) + 1 : Math.round(knobs[name] * 100));
    if (input.value !== value) input.value = value;
    const words = text(name, knobs[name]);
    if (out.textContent !== words) {
      out.textContent = words;
      input.setAttribute('aria-valuetext', words);
    }
  }
}

/** How far over its first note (A's) the computer's keys reach. */
const REACH = Math.max(...Object.values(NOTE_KEYS));

/**
 * Keys as they lie on a keyboard (the synth's, the keyboard's), `lowest` the first one's note: each
 * sounding while it is pressed (on.down(k, velocity), then on.up(k)), as on it; for a key's Enter or
 * Space, or a screen reader, a moment (on.tap(k)). One stop among them: the arrows, Home and End go
 * along them. Named by their notes (labelKeys).
 * @param {number} count
 * @param {number} lowest
 * @param {{ down: (k: number, velocity: number) => void, up: (k: number) => void, tap: (k: number) => void }} on
 */
function keyRow(count, lowest, on) {
  /** the presses on the keys: which key each pointer holds @type {Map<number, number>} */
  const held = new Map();
  /** keys pressed by a pointer whose click (which ends the press) is still to come @type {Set<number>} */
  const pressed = new Set();
  const keys = Array.from({ length: count }, (_, k) => {
    const b = el('button', { class: isBlack(lowest + k) ? 'key black' : 'key', type: 'button', tabindex: k ? '-1' : '0' });
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      held.set(e.pointerId, k);
      pressed.add(k);
      b.setPointerCapture?.(e.pointerId);
      on.down(k, 0.85);
    });
    const up = (/** @type {PointerEvent} */ e) => {
      if (held.get(e.pointerId) !== k) return;
      held.delete(e.pointerId);
      if (e.type !== 'pointerup') pressed.delete(k); // no click to come
      on.up(k);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('click', () => {
      if (pressed.delete(k)) return;
      on.tap(k);
    });
    return b;
  });
  const box = el('div', { class: 'keyboard', role: 'group', 'aria-label': 'Keys' }, ...keys);
  box.addEventListener('keydown', (e) => {
    const at = keys.indexOf(e.target), key = e.key;
    const to = key === 'ArrowLeft' ? at - 1 : key === 'ArrowRight' ? at + 1 : key === 'Home' ? 0 : key === 'End' ? count - 1 : null;
    if (at < 0 || to === null) return;
    e.preventDefault();
    e.stopPropagation(); // not walking's
    const k = Math.min(count - 1, Math.max(0, to));
    for (const [i, b] of keys.entries()) b.setAttribute('tabindex', i === k ? '0' : '-1');
    keys[k].focus();
  });
  labelKeys(keys, lowest);
  return { keys, box };
}

/**
 * Keys' notes from the first one's: the Cs' on them, which are their names (so a name said to voice
 * control is the one shown), and the rest's names as they are said ('C sharp 4').
 * @param {HTMLElement[]} keys
 * @param {number} lowest
 */
function labelKeys(keys, lowest) {
  for (const [k, b] of keys.entries()) {
    const n = lowest + k;
    b.textContent = n % 12 === 0 ? noteName(n) : '';
    if (b.textContent) b.removeAttribute('aria-label');
    else b.setAttribute('aria-label', spokenNote(n));
  }
}

/**
 * The keys whose notes sound, marked (seen, not said, as the step playing).
 * @param {HTMLElement[]} keys
 * @param {number} lowest the first one's note
 * @param {ReadonlySet<number>} notes
 */
function markKeys(keys, lowest, notes) {
  for (const [k, b] of keys.entries()) {
    const down = notes.has(lowest + k);
    if (b.classList.contains('down') !== down) b.classList.toggle('down', down);
  }
}

/** The frets the card's strings have a button for, after the open string's (0): an octave each. */
const CARD_FRETS = 12;

/**
 * The guitar's strings, a row each, the high E's at the top (as tablature writes them, and as they lie
 * seen from where it is played), a button for each fret from the open string's: each pressing its
 * string there and plucking it while it is pressed (on.down(s, fret, velocity), then on.up(s)), as on
 * the neck; for a key's Enter or Space, or a screen reader, a moment (on.tap(s, fret)). One stop among
 * them: the arrows go along a string and across them, Home and End to its ends. Each is named by its
 * fret, and its note for a screen reader ('3, G 2'), in a group named by its string.
 * @param {{ down: (s: number, fret: number, velocity: number) => void, up: (s: number) => void, tap: (s: number, fret: number) => void }} on
 */
function fretGrid(on) {
  /** the presses on the frets: which (s × 32 + fret) each pointer holds @type {Map<number, number>} */
  const held = new Map();
  /** frets pressed by a pointer whose click (which ends the press) is still to come @type {Set<number>} */
  const pressed = new Set();
  const n = GUITAR_STRINGS.length;
  /** each string's buttons, the low E's first, from the open string's */
  const frets = GUITAR_STRINGS.map((string, s) => Array.from({ length: CARD_FRETS + 1 }, (_, f) => {
    const code = s * 32 + f;
    const b = el('button', { class: 'fret', type: 'button', tabindex: s === n - 1 && !f ? '0' : '-1' },
      String(f), el('span', { class: 'sr-only' }, `, ${spokenNote(string.note + f)}`));
    b.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      held.set(e.pointerId, code);
      pressed.add(code);
      b.setPointerCapture?.(e.pointerId);
      on.down(s, f, 0.85);
    });
    const up = (/** @type {PointerEvent} */ e) => {
      if (held.get(e.pointerId) !== code) return;
      held.delete(e.pointerId);
      if (e.type !== 'pointerup') pressed.delete(code); // no click to come
      on.up(s);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('click', () => {
      if (pressed.delete(code)) return;
      on.tap(s, f);
    });
    return b;
  }));
  const rows = GUITAR_STRINGS.map((string, s) => el('div', { class: 'fret-row', role: 'group', 'aria-label': `${string.name} string` },
    el('span', { class: 'string-name', 'aria-hidden': 'true' }, string.label), ...frets[s]));
  const box = el('div', { class: 'fretboard' }, ...[...rows].reverse());
  box.addEventListener('keydown', (e) => {
    const s = frets.findIndex((row) => row.includes(e.target)), key = e.key;
    if (s < 0) return;
    const f = frets[s].indexOf(e.target);
    const to = key === 'ArrowLeft' ? [s, f - 1] : key === 'ArrowRight' ? [s, f + 1] : key === 'ArrowUp' ? [s + 1, f] : key === 'ArrowDown' ? [s - 1, f]
      : key === 'Home' ? [s, 0] : key === 'End' ? [s, CARD_FRETS] : null;
    if (!to) return;
    e.preventDefault();
    e.stopPropagation(); // not walking's
    const b = frets[Math.min(n - 1, Math.max(0, to[0]))][Math.min(CARD_FRETS, Math.max(0, to[1]))];
    for (const row of frets) for (const x of row) if (x !== b && x.getAttribute('tabindex') !== '-1') x.setAttribute('tabindex', '-1');
    b.setAttribute('tabindex', '0');
    b.focus();
  });
  return { frets, rows, box };
}

// tv: walking with a remote, and a line for TalkBack, which keeps the arrows (the view is described
// by the hint); tv-card: in the card. The hallway's.
const HINTS = {
  touch: 'Drag to look · tap the floor to walk there, or the drums, the synth, the rack, the keys or the guitar to play them · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, or the drums, the synth, the rack, the keys or the guitar to play them',
  gamepad: 'Right stick to look · left stick to walk · A on the drums, the synth, the rack, the keys or the guitar plays them, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the drums, the synth, the rack, the keys, the guitar, the doorway or the panel in the middle · Menu or hold Back: the instruments, settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
  'tv-card': 'Up, down: from control to control · left, right: a choice · OK: choose · Back: walk again',
};
// At the drum board, playing it (controls.js at).
const BOARD_HINTS = {
  touch: 'Tap the pads, with as many fingers as you like, and the step keys · drag a knob · tap two jacks to patch · tap the floor to step away',
  mouse: 'Click the pads, or press 1–4, Q–R and A–F (Shift: harder) · click the step keys · Space: the clock · drag or scroll a knob · click two jacks to patch · Esc steps away',
  gamepad: 'Right stick to aim · A plays the pad in the middle, sets a step, takes or plugs in a cable · B steps away',
  tv: 'Arrows: choose a pad · OK: play it · Play/pause: the clock · Back: step away · Menu: its steps, its knobs and the rest',
};
// At the synth, playing it.
const SYNTH_HINTS = {
  touch: 'Touch the keys, with as many fingers as you like, and slide along them · drag a knob · tap a button on its panel · tap the floor to step away',
  mouse: 'Play the keys from A (white) and W (black), Shift harder, or click them · Z, X: an octave down, up · drag or scroll a knob · Esc steps away',
  gamepad: 'Right stick to aim · A plays the key in the middle, presses a button · B steps away',
  tv: 'Arrows: choose a key, up and down an octave · OK: play it · Back: step away · Menu: its sounds and knobs',
};
// At the rack, playing its sequencer.
const RACK_HINTS = {
  touch: "Tap a step's key, its accent's or its slide's · drag a step's knob: its note · tap RUN or the octave · tap two jacks to patch · tap the floor to step away",
  mouse: "Click the keys, or press 1–8 and Q–I (Shift: its accent) · drag or scroll a step's knob: its note · Z, X: an octave down, up · Space: the clock · Esc steps away",
  gamepad: 'Right stick to aim · A sets the key in the middle, presses a button, takes or plugs in a cable · B steps away',
  tv: 'Left, right: choose a step · up, down: its note · OK: it plays, or rests · Play/pause: the clock · Back: step away · Menu: its steps, accents and slides',
};
// At the keyboard, playing it.
const KEYS_HINTS = {
  touch: 'Touch the keys, with as many fingers as you like, and slide along them · drag a drawbar or a knob · tap a button on its panel · tap the floor to step away',
  mouse: 'Play the keys from A (white) and W (black), Shift harder, or click them · Z, X: an octave down, up · drag a drawbar, drag or scroll a knob · Esc steps away',
  gamepad: 'Right stick to aim · A plays the key in the middle, sets a drawbar, presses a button · B steps away',
  tv: 'Arrows: choose a key, up and down an octave · OK: play it · Back: step away · Menu: its sounds, drawbars and knobs',
};
// At the guitar, playing it.
const GUITAR_HINTS = {
  touch: 'Swipe across the strings over the body · press a string on the neck at a fret, slide along it, bend it across · tap a chord or a pedal · tap the floor to step away',
  mouse: 'Press 1–8 and Q–I for a chord, Z–N to pluck a string, the down and up arrows to strum, M to mute · drag across the strings, or press one on the neck · click a pedal to switch it · Esc steps away',
  gamepad: 'Right stick to aim · A plucks the string in the middle, presses it at its fret, chooses a chord, switches a pedal · B steps away',
  tv: 'Left, right: choose a chord · OK or down: strum down · up: strum up · Back: step away · Menu: its chords, knobs and pedals',
};
// With something on the walls (config.js's pieces), each names the pictures too.
const PIECE_HINTS = {
  ...HINTS,
  touch: 'Drag to look · tap the floor to walk there, a picture, or the drums, the synth, the rack, the keys or the guitar to play them · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, a picture, or the drums, the synth, the rack, the keys or the guitar to play them',
  gamepad: 'Right stick to look · left stick to walk · A on a picture goes to it, on the drums, the synth, the rack, the keys or the guitar plays them, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the drums, the synth, the rack, the keys, the guitar, the doorway, a picture or the panel in the middle · Menu or hold Back: the instruments, settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
};

export class Overlay {
  /**
   * @param {{ title: string, description: string, pieces?: import('./config.js').Piece[] }} room config.js's ROOM
   * @param {{ url: string, label: string, title: string }} way the way back (common/door.js wayBack)
   * @param {object} [o]
   * @param {() => string} [o.href] the address the way back opens now (it carries the shared session)
   * @param {(i: number) => string} [o.pieceHref] the address piece i's link opens now (likewise)
   * @param {(i: number) => void} [o.onLeave] called when a link is followed: the way back's (-1), or piece i's
   * @param {boolean} [o.tv] the TV app's page (common's tv.js tvMode)
   */
  constructor(room, way, { href = () => way.url, pieceHref = () => '#', onLeave = () => {}, tv = false } = {}) {
    this.root = document.getElementById('overlay');
    this.view = document.getElementById('view-overlay');
    this.tv = tv;
    this.href = href;
    this.pieceHref = pieceHref;
    this.back = el('a', { class: 'way-back', href: href(), title: way.title }, way.label);
    this.back.addEventListener('click', () => onLeave(-1));
    /** (i) a piece without a link chosen in On the walls: walk up to it. @type {(i: number) => void} */
    this.onPiece = () => {};
    // What hangs on the walls, with what each is: a link where it leads, else a button.
    /** @type {[number, HTMLAnchorElement][]} */
    this.pieceLinks = [];
    const pieces = room.pieces ?? [];
    this.walls = pieces.length ? el('section', { class: 'walls', 'aria-labelledby': 'walls-heading' },
      el('h2', { id: 'walls-heading' }, 'On the walls'),
      el('ul', {}, ...pieces.map((p, i) => {
        const about = `piece-${p.id}-about`;
        let use;
        if (p.link) {
          use = el('a', { class: 'piece', href: pieceHref(i), 'aria-describedby': about }, p.title);
          use.addEventListener('click', () => onLeave(i));
          this.pieceLinks.push([i, use]);
        } else {
          use = el('button', { class: 'piece', type: 'button', title: 'Walk up to it', 'aria-describedby': about }, p.title);
          use.addEventListener('click', () => this.onPiece(i));
        }
        return el('li', {}, use, el('span', { class: 'about', id: about }, p.description));
      }))) : null;
    this.onSession = () => {};
    /** (key, value) a movement choice for VR: 'move' 'smooth' or 'teleport', 'turn' 'snap' or 'smooth'. @type {(key: string, value: string) => void} */
    this.onNav = () => {};
    /** (change) accessibility settings changed (common/access.js), such as { motion: 'reduce' } or { seated: true }. @type {(change: Partial<import('common/access.js').Access>) => void} */
    this.onAccess = () => {};
    this.onWave = () => {};
    /** (name) when the visitor renames themself; returns the name kept. */
    this.onName = (name) => name;
    this.session = el('button', { class: 'chip', type: 'button' }, 'Start shared session');
    this.session.addEventListener('click', () => this.onSession());
    // Wave: a pill at the foot of the view, or on a TV in the card, beside the session's button.
    this.wave = el('button', { class: tv ? 'chip' : 'pill', type: 'button', hidden: '' }, 'Wave');
    this.wave.addEventListener('click', () => this.onWave());
    this.settingsToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'settings' }, 'Settings');
    this.choices = new Map(); // 'move:smooth' → its radio button, 'vignette' → its checkbox
    const choice = (key, legend, options, apply) => el('fieldset', {}, el('legend', {}, legend), ...options.map(([value, label]) => {
      const input = el('input', { type: 'radio', name: key, value });
      input.addEventListener('change', () => {
        if (input.checked) apply(key, value);
      });
      this.choices.set(`${key}:${value}`, input);
      return el('label', {}, input, label);
    }));
    const toggle = (key, label) => {
      const input = el('input', { type: 'checkbox', name: key });
      input.addEventListener('change', () => this.onAccess({ [key]: input.checked }));
      this.choices.set(key, input);
      return el('label', {}, input, label);
    };
    this.settings = el('div', { class: 'settings', id: 'settings', hidden: '' },
      choice('motion', 'Motion', [['system', 'System'], ['reduce', 'Less'], ['full', 'Full']], (key, value) => this.onAccess({ [key]: value })),
      choice('move', 'Move in VR', [['smooth', 'Smooth'], ['teleport', 'Teleport']], (key, value) => this.onNav(key, value)),
      choice('turn', 'Turn in VR', [['snap', 'Snap'], ['smooth', 'Smooth']], (key, value) => this.onNav(key, value)),
      el('fieldset', {}, el('legend', {}, 'In VR'), toggle('vignette', 'Comfort vignette'), toggle('seated', 'Seated mode')));
    this.settingsToggle.addEventListener('click', () => {
      const open = this.settings.hidden;
      this.settings.hidden = !open;
      this.settingsToggle.setAttribute('aria-expanded', String(open));
    });
    // The drums, as on the board, and the room's sound.
    /** (i, velocity) a pad pressed. @type {(i: number, velocity: number) => void} */
    this.onPad = () => {};
    /** Play at the board, or step away from it. */
    this.onPlay = () => {};
    /** (name, value) a knob of the pad last played, set 0…1. @type {(name: import('./drums.js').Knob, value: number) => void} */
    this.onKnob = () => {};
    /** That pad's knobs back as it comes. */
    this.onResetKnobs = () => {};
    /** (volume) 0…1. @type {(volume: number) => void} */
    this.onVolume = () => {};
    /** (muted) @type {(muted: boolean) => void} */
    this.onMute = () => {};
    /** Play from a MIDI device: ask for one. */
    this.onMidi = () => {};
    this.drumsToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'drums' }, 'Drums');
    this.drumsToggle.addEventListener('click', () => this.openDrums(this.drums.hidden));
    this.play = el('button', { class: 'chip', type: 'button' }, 'Play at the board');
    this.play.addEventListener('click', () => this.onPlay());
    // A pad plays as it is pressed, as on the board; its click then is that press's. A key (Enter,
    // Space), a screen reader or the TV's OK gives only the click, which plays it. Its name is the
    // words on it (so a name said to voice control is the one shown), 'Kick, key A', the ', key '
    // there for a screen reader only.
    this._pressed = null;
    this.pads = PADS.map((p, i) => {
      const b = el('button', { class: 'pad', type: 'button', style: `--pad: ${p.color}` },
        el('span', { class: 'pad-name' }, p.name), el('span', { class: 'sr-only' }, ', key '), el('kbd', {}, keyLabel(p.key)));
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        this._pressed = { pad: i, at: e.timeStamp };
        this.onPad(i, 0.85);
      });
      b.addEventListener('click', (e) => {
        const pressed = this._pressed;
        this._pressed = null;
        if (pressed?.pad === i && e.timeStamp - pressed.at < 1500) return;
        this.onPad(i, 0.85);
      });
      return b;
    });
    // In the board's rows, the farthest at the top, as on the board seen from where one plays it and
    // as the keys are on a keyboard.
    const order = [...PADS.keys()].sort((a, b) => PADS[b].row - PADS[a].row || PADS[a].col - PADS[b].col);
    // A slider from min to max in whole steps, its setting in words beside its label (and said as its
    // value); a knob's from 0 to 100, given to `apply` as 0…1.
    const range = (label, min, max, apply) => {
      const input = el('input', { type: 'range', min: String(min), max: String(max), step: '1', value: String(Math.round((min + max) / 2)) });
      const out = el('output', { 'aria-hidden': 'true' });
      input.addEventListener('input', () => apply(Number(input.value)));
      return { row: el('label', { class: 'slider' }, el('span', {}, label), input, out), input, out };
    };
    const slider = (label, apply) => range(label, 0, 100, (v) => apply(v / 100));
    // The clock: Start or Stop, and the tempo.
    /** Start the clock, or stop it. */
    this.onRun = () => {};
    /** (bpm) the tempo set. @type {(bpm: number) => void} */
    this.onTempo = () => {};
    this.run = el('button', { class: 'chip', type: 'button' }, 'Start');
    this.run.addEventListener('click', () => this.onRun());
    const tempo = range('Tempo', TEMPO.min, TEMPO.max, (bpm) => this.onTempo(bpm));
    this.tempo = tempo.input;
    this.tempoOut = tempo.out;
    this.clockBox = el('fieldset', { class: 'clock' }, el('legend', {}, 'Clock'), el('div', { class: 'actions' }, this.run), tempo.row);
    // The steps of the pad last played: one toggle each, a beat's first edged brighter.
    /** (s) step s of the pad last played pressed: it plays there now, or no longer. @type {(s: number) => void} */
    this.onStep = () => {};
    /** That pad's steps all rests. */
    this.onClearSteps = () => {};
    /** Every pad's steps as the beat comes. */
    this.onResetPattern = () => {};
    this.stepPad = el('span', {}, PADS[0].name);
    this.steps = Array.from({ length: STEPS }, (_, s) => {
      const b = el('button', { class: s % 4 ? 'step' : 'step beat', type: 'button', 'aria-pressed': 'false' }, String(s + 1));
      b.addEventListener('click', () => this.onStep(s));
      return b;
    });
    this.stepGrid = el('div', { class: 'steps', style: `--pad: ${PADS[0].color}` }, ...this.steps);
    this.clearSteps = el('button', { class: 'chip', type: 'button' }, 'Clear');
    this.clearSteps.addEventListener('click', () => this.onClearSteps());
    this.resetPattern = el('button', { class: 'chip', type: 'button' }, 'Beat as it comes');
    this.resetPattern.addEventListener('click', () => this.onResetPattern());
    this.stepsBox = el('fieldset', { class: 'pattern' }, el('legend', {}, 'Steps: ', this.stepPad), this.stepGrid, el('div', { class: 'actions' }, this.clearSteps, this.resetPattern));
    /** @private the step marked as playing, else -1 */
    this._playhead = -1;
    // A delay's knobs (the board's, the rack's): its time in steps of the clock, its feedback and
    // level, and a button for them as they come.
    /**
     * @param {(name: import('./delay.js').DelayKnob, value: number) => void} apply
     * @param {() => void} reset
     */
    const delayBox = (apply, reset) => {
      /** @type {Map<import('./delay.js').DelayKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
      const inputs = new Map();
      const rows = DELAY_KNOBS.map((name) => {
        const label = name[0].toUpperCase() + name.slice(1);
        const s = name === 'time'
          ? range(label, 1, MAX_STEPS, (n) => apply(name, (n - 1) / (MAX_STEPS - 1)))
          : slider(label, (v) => apply(name, v));
        inputs.set(name, s);
        return s.row;
      });
      const button = el('button', { class: 'chip', type: 'button' }, 'Delay as it comes');
      button.addEventListener('click', reset);
      return { box: el('fieldset', { class: 'delay' }, el('legend', {}, 'Delay'), ...rows, el('div', { class: 'actions' }, button)), inputs, button };
    };
    /** (name, value) a knob of the delay set 0…1. @type {(name: import('./delay.js').DelayKnob, value: number) => void} */
    this.onDelay = () => {};
    /** The delay's knobs as it comes. */
    this.onResetDelay = () => {};
    const boardDelay = delayBox((name, v) => this.onDelay(name, v), () => this.onResetDelay());
    /** Each of the delay's sliders and the words for its setting. */
    this.delayInputs = boardDelay.inputs;
    this.resetDelay = boardDelay.button;
    this.delayBox = boardDelay.box;
    // The cables: for each input, the output plugged into it, or nothing. The board's here (the
    // drums' and the delay's), the synth's, the rack's and the keyboard's with them.
    /** (input, output) the output chosen for an input (patch.js ids), null for nothing. @type {(input: string, output: string | null) => void} */
    this.onPlug = () => {};
    /** Each input's choice. @type {Map<string, HTMLSelectElement>} */
    this.plugs = new Map();
    /**
     * The rows for the inputs on these modules (patch.js Jack module): each a choice of the outputs of
     * its kind, but its own module's (the filter's out into its in: round into itself).
     * @param {string[]} modules
     */
    const plugRows = (modules) => JACKS.filter((j) => j.dir === 'in' && modules.includes(j.module)).map((j) => {
      const select = el('select', { name: j.id },
        el('option', { value: '' }, 'Nothing'),
        ...JACKS.filter((o) => o.dir === 'out' && o.kind === j.kind && !(o.kind === 'audio' && o.module === j.module)).map((o) => el('option', { value: o.id }, o.name)));
      select.addEventListener('change', () => this.onPlug(j.id, select.value || null));
      this.plugs.set(j.id, select);
      return el('label', { class: 'plug' }, el('span', {}, j.name), select);
    });
    this.cablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows(['drums', 'delay']));
    this.knobPad = el('span', {}, PADS[0].name);
    /** Each knob's slider and the words for its setting. @type {Map<import('./drums.js').Knob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.knobInputs = new Map();
    const knobRows = KNOBS.map((name) => {
      const s = slider(name[0].toUpperCase() + name.slice(1), (v) => this.onKnob(name, v));
      this.knobInputs.set(name, s);
      return s.row;
    });
    this.resetKnobs = el('button', { class: 'chip', type: 'button' }, 'As it comes');
    this.resetKnobs.addEventListener('click', () => this.onResetKnobs());
    this.knobsBox = el('fieldset', { class: 'knobs' }, el('legend', {}, 'Knobs: ', this.knobPad), ...knobRows, el('div', { class: 'actions' }, this.resetKnobs));
    this.playRow = el('div', { class: 'actions' }, this.play);
    this.drums = el('div', { class: 'part drums', id: 'drums', hidden: '' },
      this.playRow,
      this.clockBox,
      el('div', { class: 'pads', role: 'group', 'aria-label': 'Pads', style: `--rows: ${ROWS}` }, ...order.map((i) => this.pads[i])),
      this.stepsBox,
      this.knobsBox,
      this.delayBox,
      this.cablesBox);
    // The synth, as on it: going to play it, its keys, its sounds and its knobs.
    /** Play at the synth, or step away from it. */
    this.onPlaySynth = () => {};
    /** (k, velocity) key k (from the lowest) pressed, until onKeyUp(k). @type {(k: number, velocity: number) => void} */
    this.onKeyDown = () => {};
    /** (k) key k let go. @type {(k: number) => void} */
    this.onKeyUp = () => {};
    /** (k) key k played for a moment: a key's Enter or Space, a screen reader. @type {(k: number) => void} */
    this.onKeyTap = () => {};
    /** (id) a preset chosen (synth.js PRESETS); chosen again, back to it as it comes. @type {(id: string) => void} */
    this.onPreset = () => {};
    /** (on) Mono, or poly. @type {(on: boolean) => void} */
    this.onMono = () => {};
    /** (octave) the keys' octave, OCTAVES.min…max. @type {(octave: number) => void} */
    this.onOctave = () => {};
    /** (id, value) a knob of the synth set 0…1. @type {(id: import('./synth.js').SynthKnob, value: number) => void} */
    this.onSynthKnob = () => {};
    /** The synth's knobs as it comes, in poly. */
    this.onResetSynth = () => {};
    this.synthToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'synth' }, 'Synth');
    this.synthToggle.addEventListener('click', () => this.openSynth(this.synth.hidden));
    this.playSynth = el('button', { class: 'chip', type: 'button' }, 'Play at the synth');
    this.playSynth.addEventListener('click', () => this.onPlaySynth());
    // Its keys, each sounding while it is pressed (as on the synth; for a key's Enter or Space, or a
    // screen reader, a moment). One stop among them: the arrows, Home and End go along them.
    const synthKeys = keyRow(KEYS, LOWEST, { down: (k, v) => this.onKeyDown(k, v), up: (k) => this.onKeyUp(k), tap: (k) => this.onKeyTap(k) });
    this.keys = synthKeys.keys;
    this.keyboard = synthKeys.box;
    // Its sounds: the presets a choice (poly, then mono), Mono, the octave the keys play in.
    /** @private the preset chosen (setSynth), else null */
    this._preset = null;
    this.soundName = el('span', {}, 'As it comes');
    /** Each preset's choice. @type {Map<string, HTMLInputElement>} */
    this.presetInputs = new Map();
    const presets = PRESETS.map((p) => {
      const input = el('input', { type: 'radio', name: 'synth-preset', value: p.id });
      input.addEventListener('change', () => {
        if (input.checked) this.onPreset(p.id);
      });
      // The one chosen, chosen again (changed since): back to it as it comes. Its click comes before
      // any change, while the one chosen is still the last.
      input.addEventListener('click', () => {
        if (this._preset === p.id) this.onPreset(p.id);
      });
      this.presetInputs.set(p.id, input);
      return el('label', {}, input, p.mono ? `${p.name} (mono)` : p.name);
    });
    this.monoInput = el('input', { type: 'checkbox', name: 'synth-mono' });
    this.monoInput.addEventListener('change', () => this.onMono(this.monoInput.checked));
    const octave = range('Octave', OCTAVES.min, OCTAVES.max, (o) => this.onOctave(o));
    this.octave = octave.input;
    this.octaveOut = octave.out;
    this.resetSynth = el('button', { class: 'chip', type: 'button' }, 'As it comes');
    this.resetSynth.addEventListener('click', () => this.onResetSynth());
    this.presetsBox = el('fieldset', { class: 'presets' }, el('legend', {}, 'Sound: ', this.soundName),
      el('div', { class: 'choices' }, ...presets),
      el('div', { class: 'actions' }, el('label', { class: 'check' }, this.monoInput, 'Mono'), this.resetSynth),
      octave.row);
    // Its arpeggiator: off or one of its ways (as its panel's buttons), Hold, the octaves it plays over.
    /** (mode) the arpeggiator playing one of its ways (arp.js ARP_MODES), or off (null). @type {(mode: string | null) => void} */
    this.onArp = () => {};
    /** (on) its Hold: the chord kept when the keys are let go. @type {(on: boolean) => void} */
    this.onHold = () => {};
    /** (n) the octaves it plays over (ARP_RANGES). @type {(n: number) => void} */
    this.onRange = () => {};
    /** Each of its ways' choice, '' for off. @type {Map<string, HTMLInputElement>} */
    this.arpInputs = new Map();
    const ways = [{ id: '', name: 'Off' }, ...ARP_MODES].map(({ id, name }) => {
      const input = el('input', { type: 'radio', name: 'synth-arp', value: id });
      input.addEventListener('change', () => {
        if (input.checked) this.onArp(id || null);
      });
      this.arpInputs.set(id, input);
      return el('label', {}, input, name);
    });
    this.holdInput = el('input', { type: 'checkbox', name: 'synth-hold' });
    this.holdInput.addEventListener('change', () => this.onHold(this.holdInput.checked));
    const span = range('Range', ARP_RANGES[0], ARP_RANGES[ARP_RANGES.length - 1], (n) => this.onRange(n));
    this.arpRange = span.input;
    this.arpRangeOut = span.out;
    this.arpBox = el('fieldset', { class: 'arp' }, el('legend', {}, 'Arpeggiator'),
      el('div', { class: 'choices' }, ...ways),
      el('div', { class: 'actions' }, el('label', { class: 'check' }, this.holdInput, 'Hold')),
      span.row);
    // Its knobs, a section each as on its top.
    /** Each of the synth's sliders and the words for its setting. @type {Map<import('./synth.js').SynthKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.synthInputs = new Map();
    this.sectionBoxes = SECTIONS.map((s) => el('fieldset', { class: 'section' }, el('legend', {}, s.name),
      ...SYNTH_KNOBS.filter((k) => k.section === s.id).map((k) => {
        const row = slider(k.name, (v) => this.onSynthKnob(k.id, v));
        this.synthInputs.set(k.id, row);
        return row.row;
      })));
    this.synthCablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows(['synth']));
    this.synthPlayRow = el('div', { class: 'actions' }, this.playSynth);
    this.synth = el('div', { class: 'part synth', id: 'synth', hidden: '' }, this.synthPlayRow, this.keyboard, this.presetsBox, this.arpBox, ...this.sectionBoxes, this.synthCablesBox);
    // The rack, as on it: going to play at it, its clock, its sequencer's steps and octave, its cables.
    /** Play at the rack, or step away from it. */
    this.onPlayRack = () => {};
    /** (row, s) step s's key in a row pressed (rackboard.js SEQ_ROWS): it plays or rests, its accent, its slide. @type {(row: import('./rackboard.js').SeqRow, s: number) => void} */
    this.onSeqKey = () => {};
    /** (s, n) step s's note chosen, semitones up from the line's lowest (0…SEQ_RANGE). @type {(s: number, n: number) => void} */
    this.onSeqNote = () => {};
    /** (octave) the octave the line plays in (seq.js SEQ_OCTAVES). @type {(octave: number) => void} */
    this.onSeqOctave = () => {};
    /** Every step a rest. */
    this.onClearSeq = () => {};
    /** The line as it comes. */
    this.onResetSeq = () => {};
    this.rackToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'rack' }, 'Rack');
    this.rackToggle.addEventListener('click', () => this.openRack(this.rack.hidden));
    this.playRack = el('button', { class: 'chip', type: 'button' }, 'Play at the rack');
    this.playRack.addEventListener('click', () => this.onPlayRack());
    // Its clock, the room's again as on the board: Start or Stop, and the tempo.
    this.rackRun = el('button', { class: 'chip', type: 'button' }, 'Start');
    this.rackRun.addEventListener('click', () => this.onRun());
    const rackTempo = range('Tempo', TEMPO.min, TEMPO.max, (bpm) => this.onTempo(bpm));
    this.rackTempo = rackTempo.input;
    this.rackTempoOut = rackTempo.out;
    this.rackClockBox = el('fieldset', { class: 'clock' }, el('legend', {}, 'Clock'), el('div', { class: 'actions' }, this.rackRun), rackTempo.row);
    // Its steps, a row each, as they go along its top: the step's number, pressed where it plays (else
    // it rests), its note a choice of its knob's, and its accent and its slide, pressed where they are
    // on. Their names are the words on them, the step's for a screen reader only ('Step 1',
    // 'Accent, step 1'), so a name said to voice control is the one shown.
    /** Each step's row and controls. @type {{ row: HTMLElement, on: HTMLElement, note: HTMLSelectElement, accent: HTMLElement, slide: HTMLElement }[]} */
    this.seqSteps = Array.from({ length: STEPS }, (_, s) => {
      const n = s + 1;
      const toggle = (row, cls, ...words) => {
        const b = el('button', { class: cls, type: 'button', 'aria-pressed': 'false' }, ...words);
        b.addEventListener('click', () => this.onSeqKey(row, s));
        return b;
      };
      const on = toggle('seq', 'seq-on', el('span', { class: 'sr-only' }, 'Step '), el('span', {}, String(n)));
      const note = /** @type {HTMLSelectElement} */ (el('select', { class: 'seq-note', name: `seq-note-${n}`, 'aria-label': `Note, step ${n}` },
        ...Array.from({ length: SEQ_RANGE + 1 }, (_, i) => el('option', { value: String(i) }))));
      note.addEventListener('change', () => this.onSeqNote(s, Number(note.value)));
      const accent = toggle('accent', 'seq-accent', 'Accent', el('span', { class: 'sr-only' }, `, step ${n}`));
      const slide = toggle('slide', 'seq-slide', 'Slide', el('span', { class: 'sr-only' }, `, step ${n}`));
      return { row: el('div', { class: s % 4 ? 'seq-step' : 'seq-step beat' }, on, note, accent, slide), on, note, accent, slide };
    });
    /** @private the line's lowest note the notes' choices are named from (setSeq), else NaN */
    this._seqLowest = NaN;
    /** @private the step marked as playing, else -1 */
    this._seqPlayhead = -1;
    const seqOctave = range('Octave', SEQ_OCTAVES.min, SEQ_OCTAVES.max, (o) => this.onSeqOctave(o));
    this.seqOctave = seqOctave.input;
    this.seqOctaveOut = seqOctave.out;
    this.clearSeq = el('button', { class: 'chip', type: 'button' }, 'Clear');
    this.clearSeq.addEventListener('click', () => this.onClearSeq());
    this.resetSeq = el('button', { class: 'chip', type: 'button' }, 'Line as it comes');
    this.resetSeq.addEventListener('click', () => this.onResetSeq());
    this.seqBox = el('fieldset', { class: 'sequencer' }, el('legend', {}, 'Sequencer'),
      el('div', { class: 'seq-steps' }, ...this.seqSteps.map((r) => r.row)),
      seqOctave.row,
      el('div', { class: 'actions' }, this.clearSeq, this.resetSeq));
    // Its delay, as the board's; and its LFO: its rate (a note value) and its shape, each a slider
    // along its knob's places, and its depth.
    /** (name, value) a knob of the rack's delay set 0…1. @type {(name: import('./delay.js').DelayKnob, value: number) => void} */
    this.onRackDelay = () => {};
    /** The rack's delay's knobs as it comes. */
    this.onResetRackDelay = () => {};
    const rackDelay = delayBox((name, v) => this.onRackDelay(name, v), () => this.onResetRackDelay());
    /** Each of the rack's delay's sliders and the words for its setting. */
    this.rackDelayInputs = rackDelay.inputs;
    this.resetRackDelay = rackDelay.button;
    this.rackDelayBox = rackDelay.box;
    /** (name, value) a knob of the LFO set 0…1. @type {(name: import('./lfo.js').LfoKnob, value: number) => void} */
    this.onLfo = () => {};
    /** The LFO's knobs as it comes. */
    this.onResetLfo = () => {};
    /** Each of the LFO's sliders and the words for its setting. @type {Map<import('./lfo.js').LfoKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.lfoInputs = new Map();
    const lfoRows = LFO_KNOBS.map((name) => {
      const label = name[0].toUpperCase() + name.slice(1), places = lfoPlaces(name);
      const s = places
        ? range(label, 1, places, (n) => this.onLfo(name, (n - 1) / (places - 1)))
        : slider(label, (v) => this.onLfo(name, v));
      this.lfoInputs.set(name, s);
      return s.row;
    });
    this.resetLfo = el('button', { class: 'chip', type: 'button' }, 'LFO as it comes');
    this.resetLfo.addEventListener('click', () => this.onResetLfo());
    this.lfoBox = el('fieldset', { class: 'lfo' }, el('legend', {}, 'LFO'), ...lfoRows, el('div', { class: 'actions' }, this.resetLfo));
    // Its envelope: its attack, decay, sustain and release, and how much of it goes out (Depth).
    /** (name, value) a knob of the envelope set 0…1. @type {(name: import('./envelope.js').EnvelopeKnob, value: number) => void} */
    this.onEnvelope = () => {};
    /** The envelope's knobs as it comes. */
    this.onResetEnvelope = () => {};
    /** Each of the envelope's sliders and the words for its setting. @type {Map<import('./envelope.js').EnvelopeKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.envelopeInputs = new Map();
    const envelopeRows = ENVELOPE_KNOBS.map((name) => {
      const s = slider(name[0].toUpperCase() + name.slice(1), (v) => this.onEnvelope(name, v));
      this.envelopeInputs.set(name, s);
      return s.row;
    });
    this.resetEnvelope = el('button', { class: 'chip', type: 'button' }, 'Envelope as it comes');
    this.resetEnvelope.addEventListener('click', () => this.onResetEnvelope());
    this.envelopeBox = el('fieldset', { class: 'envelope' }, el('legend', {}, 'Envelope'), ...envelopeRows, el('div', { class: 'actions' }, this.resetEnvelope));
    // In its second row: its mixer, a level for each of its ins; its filter, its mode a slider along
    // its places, its cutoff, its resonance and how far its CUTOFF in moves it (Mod, as on it); and its
    // reverb, its size, damping and level.
    /** (name, value) a knob of the mixer set 0…1. @type {(name: import('./mixer.js').MixerKnob, value: number) => void} */
    this.onMixer = () => {};
    /** The mixer's knobs as it comes. */
    this.onResetMixer = () => {};
    /** Each of the mixer's sliders and the words for its setting. @type {Map<import('./mixer.js').MixerKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.mixerInputs = new Map();
    const mixerRows = MIXER_KNOBS.map((name, i) => {
      const s = slider(`In ${i + 1}`, (v) => this.onMixer(name, v));
      this.mixerInputs.set(name, s);
      return s.row;
    });
    this.resetMixer = el('button', { class: 'chip', type: 'button' }, 'Mixer as it comes');
    this.resetMixer.addEventListener('click', () => this.onResetMixer());
    this.mixerBox = el('fieldset', { class: 'mixer' }, el('legend', {}, 'Mixer'), ...mixerRows, el('div', { class: 'actions' }, this.resetMixer));
    /** (name, value) a knob of the filter set 0…1. @type {(name: import('./filter.js').FilterKnob, value: number) => void} */
    this.onFilter = () => {};
    /** The filter's knobs as it comes. */
    this.onResetFilter = () => {};
    /** Each of the filter's sliders and the words for its setting. @type {Map<import('./filter.js').FilterKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.filterInputs = new Map();
    const filterRows = FILTER_KNOBS.map((name) => {
      const label = name[0].toUpperCase() + name.slice(1), places = filterPlaces(name);
      const s = places
        ? range(label, 1, places, (n) => this.onFilter(name, (n - 1) / (places - 1)))
        : slider(label, (v) => this.onFilter(name, v));
      this.filterInputs.set(name, s);
      return s.row;
    });
    this.resetFilter = el('button', { class: 'chip', type: 'button' }, 'Filter as it comes');
    this.resetFilter.addEventListener('click', () => this.onResetFilter());
    this.filterBox = el('fieldset', { class: 'filter' }, el('legend', {}, 'Filter'), ...filterRows, el('div', { class: 'actions' }, this.resetFilter));
    /** (name, value) a knob of the reverb set 0…1. @type {(name: import('./reverb.js').ReverbKnob, value: number) => void} */
    this.onReverb = () => {};
    /** The reverb's knobs as it comes. */
    this.onResetReverb = () => {};
    /** Each of the reverb's sliders and the words for its setting. @type {Map<import('./reverb.js').ReverbKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.reverbInputs = new Map();
    const reverbRows = REVERB_KNOBS.map((name) => {
      const s = slider(name[0].toUpperCase() + name.slice(1), (v) => this.onReverb(name, v));
      this.reverbInputs.set(name, s);
      return s.row;
    });
    this.resetReverb = el('button', { class: 'chip', type: 'button' }, 'Reverb as it comes');
    this.resetReverb.addEventListener('click', () => this.onResetReverb());
    this.reverbBox = el('fieldset', { class: 'reverb' }, el('legend', {}, 'Reverb'), ...reverbRows, el('div', { class: 'actions' }, this.resetReverb));
    this.rackCablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows(['seq', 'rackdelay', 'env', 'mixer', 'filter', 'reverb']));
    this.rackPlayRow = el('div', { class: 'actions' }, this.playRack);
    this.rack = el('div', { class: 'part rack', id: 'rack', hidden: '' },
      this.rackPlayRow, this.rackClockBox, this.seqBox, this.rackDelayBox, this.lfoBox, this.envelopeBox, this.mixerBox, this.filterBox, this.reverbBox, this.rackCablesBox);
    // The keyboard, as on it: going to play at it, its keys, its sound, its drawbars, its percussion,
    // and its organ's knobs and its electric piano's.
    /** Play at the keys, or step away from them. */
    this.onPlayKeys = () => {};
    /** (k, velocity) the keyboard's key k (from its lowest, keys.js KEYS_LOWEST) pressed, until onKeysUp(k). @type {(k: number, velocity: number) => void} */
    this.onKeysDown = () => {};
    /** (k) that key let go. @type {(k: number) => void} */
    this.onKeysUp = () => {};
    /** (k) key k played for a moment: a key's Enter or Space, a screen reader. @type {(k: number) => void} */
    this.onKeysTap = () => {};
    /** (id) what the keys play (keys.js KEYS_SOUNDS). @type {(id: string) => void} */
    this.onKeysSound = () => {};
    /** (on) Sustain: the notes let go held, or let go. @type {(on: boolean) => void} */
    this.onSustain = () => {};
    /** (octave) the octave the computer's keys play in at the keys (keys.js KEYS_OCTAVES). @type {(octave: number) => void} */
    this.onKeysOctave = () => {};
    /** (id, value) a drawbar (in eighths) or a knob of the keyboard's set 0…1. @type {(id: import('./keys.js').KeysKnob, value: number) => void} */
    this.onKeysKnob = () => {};
    /** (id, on) a switch of the keyboard's (keys.js KEYS_SWITCHES). @type {(id: import('./keys.js').KeysSwitch, on: boolean) => void} */
    this.onKeysSwitch = () => {};
    /** The keyboard as it comes. */
    this.onResetKeys = () => {};
    this.keysToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'keys' }, 'Keys');
    this.keysToggle.addEventListener('click', () => this.openKeys(this.keysPart.hidden));
    this.playKeys = el('button', { class: 'chip', type: 'button' }, 'Play at the keys');
    this.playKeys.addEventListener('click', () => this.onPlayKeys());
    const keysRow = keyRow(KEYS_COUNT, KEYS_LOWEST, { down: (k, v) => this.onKeysDown(k, v), up: (k) => this.onKeysUp(k), tap: (k) => this.onKeysTap(k) });
    /** The keyboard's keys, and the row they are in. */
    this.keysKeys = keysRow.keys;
    this.keysRow = keysRow.box;
    // Its sound: the organ, the electric piano or both, Sustain, the octave the computer's keys play in.
    this.keysName = el('span', {}, 'Organ');
    /** Each sound's choice. @type {Map<string, HTMLInputElement>} */
    this.keysSoundInputs = new Map();
    const keysSounds = KEYS_SOUNDS.map((s) => {
      const input = el('input', { type: 'radio', name: 'keys-sound', value: s.id });
      input.addEventListener('change', () => {
        if (input.checked) this.onKeysSound(s.id);
      });
      this.keysSoundInputs.set(s.id, input);
      return el('label', {}, input, s.name);
    });
    this.sustainInput = el('input', { type: 'checkbox', name: 'keys-sustain' });
    this.sustainInput.addEventListener('change', () => this.onSustain(this.sustainInput.checked));
    const keysOctave = range('Octave', KEYS_OCTAVES.min, KEYS_OCTAVES.max, (o) => this.onKeysOctave(o));
    this.keysOctave = keysOctave.input;
    this.keysOctaveOut = keysOctave.out;
    this.resetKeys = el('button', { class: 'chip', type: 'button' }, 'As it comes');
    this.resetKeys.addEventListener('click', () => this.onResetKeys());
    this.keysSoundBox = el('fieldset', { class: 'presets' }, el('legend', {}, 'Sound: ', this.keysName),
      el('div', { class: 'choices' }, ...keysSounds),
      el('div', { class: 'actions' }, el('label', { class: 'check' }, this.sustainInput, 'Sustain'), this.resetKeys),
      keysOctave.row);
    // Its switches: the percussion's, and the rotary speaker's with the organ's knobs.
    /** Each switch's checkbox. @type {Map<import('./keys.js').KeysSwitch, HTMLInputElement>} */
    this.switchInputs = new Map();
    const check = (/** @type {{ id: import('./keys.js').KeysSwitch, name: string }} */ s) => {
      const input = el('input', { type: 'checkbox', name: `keys-${s.id}` });
      input.addEventListener('change', () => this.onKeysSwitch(s.id, input.checked));
      this.switchInputs.set(s.id, input);
      return el('label', { class: 'check' }, input, s.name);
    };
    // Its drawbars (each in eighths, as an organist writes them over them) and its knobs, a section each.
    this.registration = el('span', {}, '88 8000 000');
    /** Each drawbar's and knob's slider and the words for its setting. @type {Map<import('./keys.js').KeysKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.keysInputs = new Map();
    this.keysSectionBoxes = KEYS_SECTIONS.map((s) => el('fieldset', { class: 'section' }, el('legend', {}, s.name, ...(s.id === 'drawbars' ? [': ', this.registration] : [])),
      ...KEYS_KNOBS.filter((k) => k.section === s.id).map((k) => {
        const row = isDrawbar(k.id) ? range(k.name, 0, 8, (n) => this.onKeysKnob(k.id, n / 8)) : slider(k.name, (v) => this.onKeysKnob(k.id, v));
        this.keysInputs.set(k.id, row);
        return row.row;
      }),
      ...(s.id === 'organ' ? KEYS_SWITCHES.filter((w) => w.id === 'rotaryFast').map(check) : [])));
    this.percBox = el('fieldset', { class: 'perc' }, el('legend', {}, 'Percussion'),
      el('div', { class: 'choices' }, ...KEYS_SWITCHES.filter((w) => w.id !== 'rotaryFast').map(check)));
    const [drawbarsBox, ...soundBoxes] = this.keysSectionBoxes;
    // Its cable in, ROTARY (its sound and its notes go out from the delays' and the synth's choices).
    this.keysCablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows(['keys']));
    this.keysPlayRow = el('div', { class: 'actions' }, this.playKeys);
    this.keysPart = el('div', { class: 'part keys', id: 'keys', hidden: '' }, this.keysPlayRow, this.keysRow, this.keysSoundBox, drawbarsBox, this.percBox, ...soundBoxes,
      this.keysCablesBox);
    // The guitar, as on it: going to play at it, its chords (strummed down or up, muted), its strings'
    // frets, its pickup, its knobs and its amp's, its pedals, and its cables in.
    /** Play at the guitar, or step away from it. */
    this.onPlayGuitar = () => {};
    /** (id) a chord fretted (guitar.js CHORDS' id), or none (null): the strings open. @type {(id: string | null) => void} */
    this.onChord = () => {};
    /** (down) the strings strummed, down (the low E first) or up. @type {(down: boolean) => void} */
    this.onStrum = () => {};
    /** The strings muted. */
    this.onMuteStrings = () => {};
    /** (s, fret, velocity) string s (the low E 0) pressed at a fret and plucked, until onFretUp(s). @type {(s: number, fret: number, velocity: number) => void} */
    this.onFretDown = () => {};
    /** (s) that string let go. @type {(s: number) => void} */
    this.onFretUp = () => {};
    /** (s, fret) string s pressed at a fret a moment and plucked: a key's Enter or Space, a screen reader. @type {(s: number, fret: number) => void} */
    this.onFretTap = () => {};
    /** (id) its pickup (guitar.js PICKUPS). @type {(id: string) => void} */
    this.onPickup = () => {};
    /** (id, value) a knob of the guitar's, its amp's or a pedal's set 0…1. @type {(id: import('./guitar.js').GuitarKnob, value: number) => void} */
    this.onGuitarKnob = () => {};
    /** (id, on) a pedal (guitar.js PEDALS' id) switched on or off. @type {(id: import('./guitar.js').PedalId, on: boolean) => void} */
    this.onPedal = () => {};
    /** The guitar as it comes. */
    this.onResetGuitar = () => {};
    this.guitarToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'guitar' }, 'Guitar');
    this.guitarToggle.addEventListener('click', () => this.openGuitar(this.guitarPart.hidden));
    this.playGuitar = el('button', { class: 'chip', type: 'button' }, 'Play at the guitar');
    this.playGuitar.addEventListener('click', () => this.onPlayGuitar());
    // Its chords, four to a row as the two rows of eight are on it, each with the key that frets it
    // ('E (E major), key 1', the words in brackets and ', key ' for a screen reader only); the strings
    // open; strumming them and muting them, each as it is pressed, as a pad plays (a key, a screen
    // reader or the TV's OK gives only the click, which plays it).
    this.chordName = el('span', {}, 'Open strings');
    /** Each chord's choice, '' for the strings open. @type {Map<string, HTMLInputElement>} */
    this.chordInputs = new Map();
    const chordChoice = (/** @type {string} */ id, /** @type {(string | HTMLElement)[]} */ ...words) => {
      const input = el('input', { type: 'radio', name: 'guitar-chord', value: id });
      input.addEventListener('change', () => {
        if (input.checked) this.onChord(id || null);
      });
      this.chordInputs.set(id, input);
      return el('label', id ? {} : { class: 'open' }, input, ...words);
    };
    const chords = [chordChoice('', 'Open strings'),
      ...CHORDS.map((c, i) => chordChoice(c.id, c.label, el('span', { class: 'sr-only' }, ` (${c.name}), key `), el('kbd', {}, keyLabel(CHORD_KEYS[i]))))];
    /** @type {(label: string, play: () => void) => HTMLElement} */
    const playButton = (label, play) => {
      let at = -Infinity;
      const b = el('button', { class: 'chip', type: 'button' }, label);
      b.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        at = e.timeStamp;
        play();
      });
      b.addEventListener('click', (e) => {
        const pressed = e.timeStamp - at < 1500;
        at = -Infinity;
        if (!pressed) play();
      });
      return b;
    };
    this.chordsBox = el('fieldset', { class: 'presets' }, el('legend', {}, 'Chord: ', this.chordName),
      el('div', { class: 'choices chords' }, ...chords),
      el('div', { class: 'actions' }, playButton('Strum down', () => this.onStrum(true)), playButton('Strum up', () => this.onStrum(false)), playButton('Mute strings', () => this.onMuteStrings())));
    // Its strings, a row of frets each (the one each plays at marked), as on its neck.
    const grid = fretGrid({ down: (s, f, v) => this.onFretDown(s, f, v), up: (s) => this.onFretUp(s), tap: (s, f) => this.onFretTap(s, f) });
    /** Each string's fret buttons (the low E's first), and its row. */
    this.frets = grid.frets;
    this.fretRows = grid.rows;
    /** @private each string's fret marked, and whether a finger's (setStrings): fret × 2 + finger, NaN none yet */
    this._fretsShown = GUITAR_STRINGS.map(() => NaN);
    this.fretsBox = el('fieldset', { class: 'frets' }, el('legend', {}, 'Strings'), grid.box);
    // Its pickup, and its knobs and its amp's, a section each, as on it.
    this.pickupName = el('span', {}, PICKUPS[1].name);
    /** Each pickup's choice. @type {Map<string, HTMLInputElement>} */
    this.pickupInputs = new Map();
    const pickups = PICKUPS.map((p) => {
      const input = el('input', { type: 'radio', name: 'guitar-pickup', value: p.id });
      input.addEventListener('change', () => {
        if (input.checked) this.onPickup(p.id);
      });
      this.pickupInputs.set(p.id, input);
      return el('label', {}, input, p.label[0] + p.label.slice(1).toLowerCase());
    });
    this.pickupBox = el('fieldset', { class: 'pickup' }, el('legend', {}, 'Pickup: ', this.pickupName), el('div', { class: 'choices three' }, ...pickups));
    /** Each of the guitar's sliders and the words for its setting. @type {Map<import('./guitar.js').GuitarKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.guitarInputs = new Map();
    const guitarBoxes = GUITAR_SECTIONS.filter((s) => s.id !== 'pedals').map((s) => el('fieldset', { class: 'section' }, el('legend', {}, s.name),
      ...GUITAR_KNOBS.filter((k) => k.section === s.id).map((k) => {
        const row = slider(k.name, (v) => this.onGuitarKnob(k.id, v));
        this.guitarInputs.set(k.id, row);
        return row.row;
      })));
    // Its pedals, as they stand on its panel: each switched on or off, and its knob, named by its
    // pedal ('Overdrive drive', as on its display).
    /** Each pedal's switch. @type {Map<import('./guitar.js').PedalId, HTMLInputElement>} */
    this.pedalInputs = new Map();
    this.pedalsBox = el('fieldset', { class: 'section pedals' }, el('legend', {}, 'Pedals'),
      ...PEDALS.flatMap((p) => {
        const input = el('input', { type: 'checkbox', name: `guitar-${p.id}` });
        input.addEventListener('change', () => this.onPedal(p.id, input.checked));
        this.pedalInputs.set(p.id, input);
        const row = slider(guitarKnobName(p.knob), (v) => this.onGuitarKnob(p.knob, v));
        this.guitarInputs.set(p.knob, row);
        return [el('label', { class: 'check' }, input, p.name), row.row];
      }));
    this.resetGuitar = el('button', { class: 'chip', type: 'button' }, 'As it comes');
    this.resetGuitar.addEventListener('click', () => this.onResetGuitar());
    // Its cables in, WAH and CLOCK (its sound and its notes go out from the others' choices).
    this.guitarCablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows(['guitar']));
    this.guitarPlayRow = el('div', { class: 'actions' }, this.playGuitar);
    this.guitarPart = el('div', { class: 'part guitar', id: 'guitar', hidden: '' }, this.guitarPlayRow, this.chordsBox, this.fretsBox, this.pickupBox, ...guitarBoxes,
      this.pedalsBox, el('div', { class: 'actions' }, this.resetGuitar), this.guitarCablesBox);
    // The room's sound: its volume and Mute, and a MIDI device to play from.
    this.soundToggle = el('button', { class: 'chip', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'sound' }, 'Sound');
    this.soundToggle.addEventListener('click', () => this.openSound(this.sound.hidden));
    const volume = slider('Volume', (v) => this.onVolume(v));
    this.volume = volume.input;
    this.volumeOut = volume.out;
    this.mute = el('input', { type: 'checkbox', name: 'mute' });
    this.mute.addEventListener('change', () => this.onMute(this.mute.checked));
    // Where the browser has Web MIDI (showMidi): a button to ask for it, and what it hears, said as it changes.
    this.midi = el('button', { class: 'chip', type: 'button' }, 'Play from a MIDI device');
    this.midi.addEventListener('click', () => this.onMidi());
    this.midiStatus = el('p', { class: 'midi-status', role: 'status' });
    this.midiBox = el('div', { class: 'midi', hidden: '' }, this.midi, this.midiStatus);
    this.sound = el('div', { class: 'part sound', id: 'sound', hidden: '' }, volume.row, el('label', { class: 'check' }, this.mute, 'Mute'), this.midiBox);
    /** @private where the visitor plays (controls.js at): 'board', 'synth', 'rack', 'keys', 'guitar', or null @type {'board' | 'synth' | 'rack' | 'keys' | 'guitar' | null} */
    this._at = null;
    // In a shared session: how it's going, the band played in it, the visitor's name in it, and on
    // a TV the invite link.
    this.status = el('p', { class: 'together-status' });
    this.bandLine = el('p', { class: 'together-band', hidden: '' });
    this.myName = el('input', { class: 'my-name', type: 'text', maxlength: '24', autocomplete: 'off', spellcheck: 'false' });
    this.myName.addEventListener('change', () => {
      this.myName.value = this.onName(this.myName.value);
    });
    this.myName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.myName.blur();
    });
    this.inviteText = tv ? el('p', { class: 'invite-text' }) : null;
    this.together = el('div', { class: 'together', hidden: '' },
      this.status,
      this.bandLine,
      el('label', { class: 'me' }, el('span', {}, 'Your name'), this.myName),
      ...(this.inviteText ? [this.inviteText] : []));
    this.card = el('nav', { class: 'card', 'aria-label': room.title },
      el('header', {}, el('h1', { class: 'brand' }, room.title), this.back),
      el('p', { class: 'tagline' }, room.description),
      ...(this.walls ? [this.walls] : []),
      this.inRoom = el('section', { class: 'in-room', 'aria-label': 'In the room' },
        el('div', { class: 'actions' }, this.session, ...(tv ? [this.wave] : []), this.drumsToggle, this.synthToggle, this.rackToggle, this.keysToggle, this.guitarToggle, this.soundToggle, this.settingsToggle),
        this.together,
        this.drums,
        this.synth,
        this.rack,
        this.keysPart,
        this.guitarPart,
        this.sound,
        this.settings));
    this.hint = el('p', { class: 'hint', id: 'hint' });
    this.fullscreen = el('button', { class: 'pill', type: 'button', hidden: '' }, 'Fullscreen');
    this.vr = el('button', { class: 'pill vr', type: 'button', hidden: '' }, 'Enter VR');
    this.invite = el('button', { class: 'pill invite', type: 'button', hidden: '' }, 'Copy invite link');
    this.invite.addEventListener('click', () => this._copyInvite());
    this._inviteLink = '';
    this.buttons = el('div', { class: 'buttons' }, ...(tv ? [] : [this.wave]), this.invite, this.fullscreen, this.vr);
    this.dot = el('div', { class: 'aim', hidden: '', 'aria-hidden': 'true' });
    this.toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.card);
    this.view.append(this.hint, this.buttons, this.dot, this.toasts);
    // The card stops above the buttons, however many rows they wrap to (style.css, --buttons).
    new ResizeObserver(() => {
      document.documentElement.style.setProperty('--buttons', `${this.buttons.offsetHeight}px`);
      this._placeHint();
    }).observe(this.buttons);
    /** @type {'mouse'|'touch'|'gamepad'|'tv'|'tv-card'} */
    this._how = 'mouse';
    this.pieces = pieces;
    this._hints = pieces.length ? PIECE_HINTS : HINTS;
    this._aimed = -1; // the piece a TV's dot is on (setAimed)
    this._aimShown = false; // the hint shown again for it, to fade when the dot leaves
    addEventListener('resize', () => this._placeHint());
  }

  /** @param {'mouse'|'touch'|'gamepad'|'tv'|'tv-card'} how */
  setHint(how, seconds = 12) {
    this._how = how;
    this._aimShown = false;
    this.hint.classList.remove('gone');
    this.hint.removeAttribute('aria-hidden');
    this.hint.textContent = this._hintText();
    this._placeHint();
    clearTimeout(this._hintTimer);
    if (seconds) this._hintTimer = setTimeout(() => this.hideHint(), seconds * 1000);
  }

  /**
   * The hint's words: at the board, how to play it; on a TV with the dot on a piece, its OK says what
   * OK does there, as music's does on the gramophone.
   */
  _hintText() {
    const playing = this._at === 'board' ? BOARD_HINTS : this._at === 'synth' ? SYNTH_HINTS : this._at === 'rack' ? RACK_HINTS : this._at === 'keys' ? KEYS_HINTS : this._at === 'guitar' ? GUITAR_HINTS : null;
    if (playing && this._how in playing) return playing[this._how];
    const text = this._hints[this._how];
    if (this._how !== 'tv' || this._aimed < 0) return text;
    const p = this.pieces[this._aimed];
    return text.replace(/OK: [^·]*? · /, `OK: ${p.link ? p.title : `walk up to ${p.title}`} · `);
  }

  /**
   * On a TV, walking: the piece the dot is on (its index in config.js's pieces), else -1. The hint
   * says what OK does there ("OK: <its title>" for one with a link), shown again if it had faded,
   * and faded again when the dot leaves.
   */
  setAimed(i) {
    if (i === this._aimed) return;
    this._aimed = i;
    if (this._how !== 'tv') return;
    if (i >= 0) {
      const faded = this._aimShown || this.hint.classList.contains('gone');
      this.setHint('tv');
      this._aimShown = faded;
      return;
    }
    this.hint.textContent = this._hintText();
    this._placeHint();
    if (this._aimShown) {
      clearTimeout(this._hintTimer);
      this.hideHint();
    }
  }

  /**
   * Keeps the hint clear of the buttons at the foot: in the middle where it fits beside them, else
   * in the space beside them (wrapping within it), else above them (a narrow screen). Outside's.
   */
  _placeHint() {
    const s = this.hint.style;
    s.left = s.bottom = s.maxWidth = '';
    let left = Infinity, top = Infinity;
    for (const b of this.buttons.children) {
      if (b.hidden) continue;
      const r = b.getBoundingClientRect();
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
    }
    const h = this.hint.getBoundingClientRect();
    const gap = 12, margin = 16;
    if (left === Infinity || h.right <= left - gap || h.bottom <= top - 4) return;
    const room = left - gap - margin;
    if (room >= 260) {
      s.left = `${margin + room / 2}px`;
      s.maxWidth = `${room}px`;
    } else s.bottom = `${innerHeight - top + 8}px`;
  }

  /**
   * The hint fades. On a TV it also leaves the reading order, or TalkBack would stop on an empty
   * spot; it stays the view's description (main.js: aria-describedby), which a hidden element
   * named that way still gives.
   */
  hideHint() {
    this.hint.classList.add('gone');
    if (this.tv) this.hint.setAttribute('aria-hidden', 'true');
  }

  /**
   * Playing at the drum board, the synth, the rack, the keyboard or the guitar (controls.js at:
   * 'board', 'synth', 'rack', 'keys', 'guitar'), or not (null): the card's button there steps away,
   * the others go to play, and the hint says how to play there, shown again; stepping away, the hint
   * changes back where it is still shown.
   * @param {'board' | 'synth' | 'rack' | 'keys' | 'guitar' | null} at
   */
  setPlaying(at) {
    if (at === this._at) return;
    this._at = at;
    this.play.textContent = at === 'board' ? 'Step away from the board' : 'Play at the board';
    this.playSynth.textContent = at === 'synth' ? 'Step away from the synth' : 'Play at the synth';
    this.playRack.textContent = at === 'rack' ? 'Step away from the rack' : 'Play at the rack';
    this.playKeys.textContent = at === 'keys' ? 'Step away from the keys' : 'Play at the keys';
    this.playGuitar.textContent = at === 'guitar' ? 'Step away from the guitar' : 'Play at the guitar';
    if (at && this._how !== 'tv-card') this.setHint(this._how);
    else {
      this.hint.textContent = this._hintText();
      this._placeHint();
    }
  }

  /** Drums open in the card, or closed. */
  openDrums(open) {
    this.drums.hidden = !open;
    this.drumsToggle.setAttribute('aria-expanded', String(open));
  }

  /** Synth open in the card, or closed. */
  openSynth(open) {
    this.synth.hidden = !open;
    this.synthToggle.setAttribute('aria-expanded', String(open));
  }

  /** Rack open in the card, or closed. */
  openRack(open) {
    this.rack.hidden = !open;
    this.rackToggle.setAttribute('aria-expanded', String(open));
  }

  /** Keys open in the card, or closed. */
  openKeys(open) {
    this.keysPart.hidden = !open;
    this.keysToggle.setAttribute('aria-expanded', String(open));
  }

  /** Guitar open in the card, or closed. */
  openGuitar(open) {
    this.guitarPart.hidden = !open;
    this.guitarToggle.setAttribute('aria-expanded', String(open));
  }

  /** Sound open in the card, or closed. */
  openSound(open) {
    this.sound.hidden = !open;
    this.soundToggle.setAttribute('aria-expanded', String(open));
  }

  /**
   * The synth as it is (synth.js Synth): what it plays (its name, `title`, over the presets), the
   * preset chosen, Mono, its arpeggiator (its way, else off; Hold; its octaves) and the octave (the
   * keys' notes, on them too).
   * @param {{ name: string, preset: string | null, mono: boolean, octave: number, lowest: number, arp: { mode: string | null, range: number, hold: boolean } }} synth
   */
  setSynth({ name, preset, mono, octave, lowest, arp }) {
    this._preset = preset;
    if (this.soundName.textContent !== name) this.soundName.textContent = name;
    for (const [id, input] of this.presetInputs) if (input.checked !== (id === preset)) input.checked = id === preset;
    if (this.monoInput.checked !== mono) this.monoInput.checked = mono;
    const way = arp.mode ?? '';
    for (const [id, input] of this.arpInputs) if (input.checked !== (id === way)) input.checked = id === way;
    if (this.holdInput.checked !== arp.hold) this.holdInput.checked = arp.hold;
    const span = String(arp.range), octaves = arp.range === 1 ? '1 octave' : `${arp.range} octaves`;
    if (this.arpRange.value !== span) this.arpRange.value = span;
    if (this.arpRangeOut.textContent !== octaves) {
      this.arpRangeOut.textContent = octaves;
      this.arpRange.setAttribute('aria-valuetext', octaves);
    }
    const value = String(octave);
    if (this.octave.value !== value) this.octave.value = value;
    const text = `${noteName(lowest)}–${noteName(lowest + KEYS - 1)}`;
    if (this.octaveOut.textContent === text) return;
    this.octaveOut.textContent = text;
    this.octave.setAttribute('aria-valuetext', `Keys ${spokenNote(lowest)} to ${spokenNote(lowest + KEYS - 1)}`);
    labelKeys(this.keys, lowest);
  }

  /** The synth's knobs (synth.js): their sliders and words. @param {Readonly<Record<import('./synth.js').SynthKnob, number>>} knobs */
  setSynthKnobs(knobs) {
    for (const [id, { input, out }] of this.synthInputs) {
      const value = String(Math.round(knobs[id] * 100));
      if (input.value !== value) input.value = value;
      const text = synthText(id, knobs[id]);
      if (out.textContent !== text) {
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
      }
    }
  }

  /**
   * The notes sounding from a key held down (synth.js Synth down), the lowest key's note as it is:
   * those keys marked. Seen, not said, as the step playing.
   * @param {ReadonlySet<number>} notes
   * @param {number} lowest
   */
  setNotes(notes, lowest) {
    markKeys(this.keys, lowest, notes);
  }

  /**
   * The keyboard as it is (keys.js Keys): what it plays (its name over the choice), the sound chosen,
   * Sustain, its switches, and the octave the computer's keys play in (their notes in words).
   * @param {{ name: string, choice: string, sustain: boolean, switches: Readonly<Record<import('./keys.js').KeysSwitch, boolean>>, octave: number }} keys
   */
  setKeys({ name, choice, sustain, switches, octave }) {
    if (this.keysName.textContent !== name) this.keysName.textContent = name;
    for (const [id, input] of this.keysSoundInputs) if (input.checked !== (id === choice)) input.checked = id === choice;
    if (this.sustainInput.checked !== sustain) this.sustainInput.checked = sustain;
    for (const [id, input] of this.switchInputs) if (input.checked !== switches[id]) input.checked = switches[id];
    const value = String(octave);
    if (this.keysOctave.value !== value) this.keysOctave.value = value;
    const from = 60 + 12 * octave, text = `${noteName(from)}–${noteName(from + REACH)}`;
    if (this.keysOctaveOut.textContent === text) return;
    this.keysOctaveOut.textContent = text;
    this.keysOctave.setAttribute('aria-valuetext', `Computer's keys ${spokenNote(from)} to ${spokenNote(from + REACH)}`);
  }

  /** The keyboard's drawbars (in eighths, and as an organist writes them) and its knobs (keys.js): their sliders and words. @param {Readonly<Record<import('./keys.js').KeysKnob, number>>} knobs */
  setKeysKnobs(knobs) {
    const drawn = registration(knobs);
    if (this.registration.textContent !== drawn) this.registration.textContent = drawn;
    for (const [id, { input, out }] of this.keysInputs) {
      const value = String(isDrawbar(id) ? drawbarStep(knobs[id]) : Math.round(knobs[id] * 100));
      if (input.value !== value) input.value = value;
      const text = keysText(id, knobs[id]);
      if (out.textContent !== text) {
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
      }
    }
  }

  /** The notes sounding from the keyboard's keys held down (keys.js Keys down): those keys marked. @param {ReadonlySet<number>} notes */
  setKeysNotes(notes) {
    markKeys(this.keysKeys, KEYS_LOWEST, notes);
  }

  /**
   * The guitar as it is (guitar.js Guitar): its chord (its name over the choice, else the strings
   * open), its pickup and its pedals on.
   * @param {{ chord: string | null, chordName: string, pickup: string, pedals: Readonly<Record<import('./guitar.js').PedalId, boolean>> }} guitar
   */
  setGuitar({ chord, chordName, pickup, pedals }) {
    if (this.chordName.textContent !== chordName) this.chordName.textContent = chordName;
    const id = chord ?? '';
    for (const [c, input] of this.chordInputs) if (input.checked !== (c === id)) input.checked = c === id;
    const name = PICKUPS.find((p) => p.id === pickup)?.name ?? '';
    if (this.pickupName.textContent !== name) this.pickupName.textContent = name;
    for (const [p, input] of this.pickupInputs) if (input.checked !== (p === pickup)) input.checked = p === pickup;
    for (const [p, input] of this.pedalInputs) if (input.checked !== pedals[p]) input.checked = pedals[p];
  }

  /** The guitar's knobs, its amp's and its pedals' (guitar.js): their sliders and words. @param {Readonly<Record<import('./guitar.js').GuitarKnob, number>>} knobs */
  setGuitarKnobs(knobs) {
    for (const [id, { input, out }] of this.guitarInputs) {
      const value = String(Math.round(knobs[id] * 100));
      if (input.value !== value) input.value = value;
      const text = guitarText(id, knobs[id]);
      if (out.textContent !== text) {
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
      }
    }
  }

  /**
   * Where each string is fretted now (guitar.js fretOf: -1 muted, 0 open), and whether a finger
   * presses it there (else the chord frets it): that fret's button marked, the chord's or a finger's
   * (an open string's only where a finger presses it), a muted string's open one struck through. Seen,
   * not said, as the step playing.
   * @param {readonly number[]} frets
   * @param {readonly boolean[]} fingers
   */
  setStrings(frets, fingers) {
    for (const [s, row] of this.frets.entries()) {
      const shown = frets[s] * 2 + (fingers[s] ? 1 : 0);
      if (shown === this._fretsShown[s]) continue;
      this._fretsShown[s] = shown;
      for (const [f, b] of row.entries()) {
        const at = frets[s] === f && (f > 0 || fingers[s]), finger = at && fingers[s], chord = at && !fingers[s], muted = !f && frets[s] < 0;
        if (b.classList.contains('finger') !== finger) b.classList.toggle('finger', finger);
        if (b.classList.contains('chord') !== chord) b.classList.toggle('chord', chord);
        if (b.classList.contains('muted') !== muted) b.classList.toggle('muted', muted);
      }
    }
  }

  /** Pad i's knobs (drums.js), i the pad last played: its name over the sliders, their places and their words. */
  setKnobs(i, knobs) {
    if (this.knobPad.textContent !== PADS[i].name) this.knobPad.textContent = PADS[i].name;
    for (const [name, { input, out }] of this.knobInputs) {
      const value = String(Math.round(knobs[name] * 100));
      if (input.value !== value) input.value = value;
      const text = knobText(i, name, knobs[name]);
      if (out.textContent !== text) {
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
      }
    }
  }

  /** The clock running, or not: its buttons (the board's, the rack's) stop it, or start it. */
  setRunning(on) {
    const label = on ? 'Stop' : 'Start';
    for (const b of [this.run, this.rackRun]) if (b.textContent !== label) b.textContent = label;
    if (!on) this.setPlayhead(-1);
  }

  /** The clock's tempo, in beats per minute: its sliders (the board's, the rack's) and words. */
  setTempo(bpm) {
    const value = String(bpm);
    for (const [input, out] of [[this.tempo, this.tempoOut], [this.rackTempo, this.rackTempoOut]]) {
      if (input.value !== value) input.value = value;
      if (out.textContent !== `${value} BPM`) {
        out.textContent = `${value} BPM`;
        input.setAttribute('aria-valuetext', `${value} beats a minute`);
      }
    }
  }

  /** Pad i's steps (pattern.js), i the pad last played: its name over them, each pressed where it plays, in its colour. */
  setSteps(i, steps) {
    if (this.stepPad.textContent !== PADS[i].name) {
      this.stepPad.textContent = PADS[i].name;
      this.stepGrid.style.cssText = `--pad: ${PADS[i].color}`;
    }
    this.steps.forEach((b, s) => {
      const on = String(!!steps[s]);
      if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    });
  }

  /** The step playing (0…15), marked, else -1. Seen, not said: a screen reader would say nothing else. */
  setPlayhead(s) {
    if (s === this._playhead) return;
    this.steps[this._playhead]?.classList.remove('now');
    this._playhead = s;
    this.steps[s]?.classList.add('now');
  }

  /**
   * The sequencer's line (seq.js Seq): each step pressed where it plays, its note chosen, its accent
   * and its slide pressed where they are on; the notes' choices named from the line's lowest note,
   * and the octave, with the notes it reaches in words.
   * @param {readonly import('./seq.js').SeqStep[]} steps
   * @param {number} lowest the line's lowest note (MIDI)
   * @param {number} octave
   */
  setSeq(steps, lowest, octave) {
    if (lowest !== this._seqLowest) {
      this._seqLowest = lowest;
      for (const { note } of this.seqSteps) for (const [i, option] of [...note.children].entries()) option.textContent = noteName(lowest + i);
      const value = String(octave), text = `${noteName(lowest)}–${noteName(lowest + SEQ_RANGE)}`;
      if (this.seqOctave.value !== value) this.seqOctave.value = value;
      this.seqOctaveOut.textContent = text;
      this.seqOctave.setAttribute('aria-valuetext', `Notes ${spokenNote(lowest)} to ${spokenNote(lowest + SEQ_RANGE)}`);
    }
    this.seqSteps.forEach(({ on, note, accent, slide }, s) => {
      press(on, steps[s].on);
      press(accent, steps[s].accent);
      press(slide, steps[s].slide);
      const value = String(steps[s].note);
      if (note.value !== value) note.value = value;
    });
  }

  /** The sequencer's step playing (0…15), marked, else -1. Seen, not said, as the drums'. */
  setSeqPlayhead(s) {
    if (s === this._seqPlayhead) return;
    this.seqSteps[this._seqPlayhead]?.row.classList.remove('now');
    this._seqPlayhead = s;
    this.seqSteps[s]?.row.classList.add('now');
  }

  /** The delay's knobs (delay.js): their sliders and words. */
  setDelay(knobs) {
    showDelay(this.delayInputs, knobs);
  }

  /** The rack's delay's knobs (delay.js), likewise. */
  setRackDelay(knobs) {
    showDelay(this.rackDelayInputs, knobs);
  }

  /** The LFO's knobs (lfo.js): their sliders and words. */
  setLfo(knobs) {
    showKnobs(this.lfoInputs, knobs, lfoPlaces, lfoText);
  }

  /** The envelope's knobs (envelope.js): their sliders and words. */
  setEnvelope(knobs) {
    showKnobs(this.envelopeInputs, knobs, () => 0, envelopeText);
  }

  /** The mixer's knobs (mixer.js): their sliders and words. */
  setMixer(knobs) {
    showKnobs(this.mixerInputs, knobs, () => 0, mixerText);
  }

  /** The filter's knobs (filter.js): their sliders and words. */
  setFilter(knobs) {
    showKnobs(this.filterInputs, knobs, filterPlaces, filterText);
  }

  /** The reverb's knobs (reverb.js): their sliders and words. */
  setReverb(knobs) {
    showKnobs(this.reverbInputs, knobs, () => 0, reverbText);
  }

  /** The cables (patch.js's Patch): each input's choice, the output plugged into it or nothing. */
  setPatch(patch) {
    for (const [id, select] of this.plugs) {
      const value = patch.source(id) ?? '';
      if (select.value !== value) select.value = value;
    }
  }

  /** The room's sound (sound.js): the volume's slider and words, and Mute. */
  setSound({ volume, muted }) {
    const value = String(Math.round(volume * 100));
    if (this.volume.value !== value) this.volume.value = value;
    const text = `${value}%`;
    if (this.volumeOut.textContent !== text) {
      this.volumeOut.textContent = text;
      this.volume.setAttribute('aria-valuetext', text);
    }
    if (this.mute.checked !== muted) this.mute.checked = muted;
  }

  /** The browser has Web MIDI (midi.js hasMidi): its button and what it hears. */
  showMidi() {
    this.midiBox.hidden = false;
  }

  /** What MIDI hears now, or why not (main.js), said to a screen reader as it changes. */
  setMidi(text) {
    if (this.midiStatus.textContent !== text) this.midiStatus.textContent = text;
  }

  /** In a shared session (or paused in one, going through the door), or not: its button leaves, or starts one. */
  setSession(on) {
    const label = on ? 'Leave shared session' : 'Start shared session';
    if (this.session.textContent !== label) this.session.textContent = label;
  }

  /** The settings as they are now: the VR movement choices (common/nav.js) and the accessibility settings (common/access.js). */
  setChoices({ move, turn }, { motion, vignette, seated }) {
    const on = new Set([`move:${move}`, `turn:${turn}`, `motion:${motion}`]);
    if (vignette) on.add('vignette');
    if (seated) on.add('seated');
    for (const [id, input] of this.choices) if (input.checked !== on.has(id)) input.checked = on.has(id);
  }

  /**
   * In a shared session (together.js active), or not: how it's going (presence.js statusText), the
   * visitor's name (together.js self), and the Wave button.
   */
  setTogether(active, status = '', self = null) {
    this.wave.hidden = this.together.hidden = !active;
    const text = active ? `Together: ${status}` : '';
    if (this.status.textContent !== text) this.status.textContent = text;
    // Not while it is being typed in.
    if (self && document.activeElement !== this.myName && this.myName.value !== self.name) this.myName.value = self.name;
    this._placeHint();
  }

  /** The shared session's band (band.js) in words: being found, or played; '' out of a session. */
  setBand(text) {
    if (this.bandLine.textContent !== text) this.bandLine.textContent = text;
    this.bandLine.hidden = !text;
    this._placeHint();
  }

  /** The shared session's invite link (together.js), or '' when not in one: hides the button. On a TV, the link to type elsewhere. */
  setInvite(link) {
    this._inviteLink = link;
    if (this.inviteText) {
      if (link) this.inviteText.replaceChildren('To join from a phone or a computer, open ', el('span', { class: 'invite-link' }, link.replace(/^https?:\/\//, '')));
      return;
    }
    this.invite.hidden = !link;
    this._placeHint();
  }

  /** Works out the way back's link again, and the pieces' (they carry the shared session's room). */
  refreshLinks() {
    const href = this.href();
    if (this.back.getAttribute('href') !== href) this.back.setAttribute('href', href);
    for (const [i, a] of this.pieceLinks) {
      const h = this.pieceHref(i);
      if (a.getAttribute('href') !== h) a.setAttribute('href', h);
    }
  }

  showVR(onClick) {
    this.vr.hidden = false;
    this._placeHint();
    this.vr.addEventListener('click', onClick);
  }

  /** In VR, or not: the button's words. */
  setVR(on) {
    this.vr.textContent = on ? 'Exit VR' : 'Enter VR';
  }

  async _copyInvite() {
    const link = this._inviteLink;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.toast('Invite link copied: anyone who opens it joins you here');
    } catch {
      prompt('Copy this link to invite others:', link);
    }
  }

  showFullscreen(onClick) {
    this.fullscreen.hidden = false;
    this._placeHint();
    this.fullscreen.addEventListener('click', onClick);
  }

  setFullscreen(on) {
    this.fullscreen.textContent = on ? '✕ Exit fullscreen' : 'Fullscreen';
    this.fullscreen.classList.toggle('on', on);
    this._placeHint();
  }

  /** The dot in the middle of the view that a gamepad aims with; larger and filled on something A would use. */
  setAim(on, hover = false) {
    if (this.dot.hidden !== !on) this.dot.hidden = !on;
    if (this.dot.classList.contains('hover') !== hover) this.dot.classList.toggle('hover', hover);
  }

  toast(text, seconds = 3.5) {
    const t = el('div', { class: 'toast' }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), seconds * 1000);
  }

  /**
   * No 3D view: the way back, where the pieces lead (the rest are just named), and the drums, the
   * synth, the rack, the keys, the guitar and the sound, which play without one (open, each under its
   * name, with nothing to walk up to).
   */
  noWebGL(message) {
    this.card.classList.add('alone');
    this.inRoom.remove();
    for (const b of this.walls?.querySelectorAll('button.piece') ?? []) b.replaceWith(el('span', { class: 'piece-title' }, b.textContent));
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.playRow.remove();
    this.synthPlayRow.remove();
    this.rackPlayRow.remove();
    this.keysPlayRow.remove();
    this.guitarPlayRow.remove();
    for (const [name, part] of [['Drums', this.drums], ['Synth', this.synth], ['Rack', this.rack], ['Keys', this.keysPart], ['Guitar', this.guitarPart], ['Sound', this.sound]]) {
      part.hidden = false;
      this.card.append(el('section', { class: 'in-room' }, el('h2', { class: 'part-title' }, name), part));
    }
    this.hint.remove();
  }
}
