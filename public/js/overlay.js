// The page around the 3D view (not shown in a headset), as outside's and the hallway's. The card is
// the page's <nav>: the room's name, the way back to the hallway as a real link (for keyboards,
// screen readers and browsers without WebGL), its description, what hangs on its walls (each one
// that leads somewhere a link there, the rest buttons that walk up to them), Start / Leave shared session (and,
// in one, how it's going), Drums, and Settings, the control panel's choices: motion (common/access.js, for
// a screen too), how to move and turn in VR, the comfort vignette and seated mode. The view is the
// page's <main>, with a hint on how to move, the Wave, Copy invite link, Fullscreen and Enter VR
// buttons, the dot a gamepad aims with, and short messages, said politely. So everything the room
// offers in 3D is a control here too: the doorway is the link, the panel's buttons are Settings,
// the session's button and Enter VR, and the pieces on the walls are On the walls. In a shared session the card also has the visitor's name.
// Drums is the drum board: a button to go and play it (or step away), its clock (Start or Stop, and
// the tempo), its pads as buttons (each plays as it is pressed, as on the board), the steps of the
// pad last played as toggles (the step playing marked), its knobs and the delay's as sliders, the
// cables as a choice for each input, the volume and mute over the room's sound, and a MIDI device to
// play it from, where the browser has Web MIDI.
// On a TV (common's tv.js) the remote reaches only the card, so Wave is in it, and there is nothing
// to copy a link to: the invite link is shown to type on another device. Fullscreen and Enter VR
// are not offered there (main.js).
import { KNOBS, PADS, ROWS, keyLabel, knobText } from './drums.js';
import { TEMPO } from './clock.js';
import { STEPS } from './pattern.js';
import { DELAY_KNOBS, MAX_STEPS, delaySteps, delayText } from './delay.js';
import { JACKS } from './patch.js';

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

// tv: walking with a remote, and a line for TalkBack, which keeps the arrows (the view is described
// by the hint); tv-card: in the card. The hallway's.
const HINTS = {
  touch: 'Drag to look · tap the floor to walk there, or the drums to play them · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, or the drums to play them',
  gamepad: 'Right stick to look · left stick to walk · A on the drums plays them, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the drums, the doorway or the panel in the middle · Menu or hold Back: the drums, settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
  'tv-card': 'Up, down: from control to control · left, right: a choice · OK: choose · Back: walk again',
};
// At the drum board, playing it (controls.js playing).
const BOARD_HINTS = {
  touch: 'Tap the pads, with as many fingers as you like, and the step keys · drag a knob · tap two jacks to patch · tap the floor to step away',
  mouse: 'Click the pads, or press 1–4, Q–R and A–F (Shift: harder) · click the step keys · Space: the clock · drag or scroll a knob · click two jacks to patch · Esc steps away',
  gamepad: 'Right stick to aim · A plays the pad in the middle, sets a step, takes or plugs in a cable · B steps away',
  tv: 'Arrows: choose a pad · OK: play it · Play/pause: the clock · Back: step away · Menu: its steps, its knobs and the rest',
};
// With something on the walls (config.js's pieces), each names the pictures too.
const PIECE_HINTS = {
  ...HINTS,
  touch: 'Drag to look · tap the floor to walk there, a picture, or the drums to play them · tap the doorway to go back',
  mouse: 'Drag to look around · WASD or arrows to walk · click the floor to walk there, a picture, or the drums to play them',
  gamepad: 'Right stick to look · left stick to walk · A on a picture goes to it, on the drums plays them, on the doorway goes back',
  tv: 'Arrows: walk and turn · OK: the drums, the doorway, a picture or the panel in the middle · Menu or hold Back: the drums, settings and the shared session\nWith TalkBack: channel up and down walk, rewind and fast-forward turn',
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
    // Space), a screen reader or the TV's OK gives only the click, which plays it.
    this._pressed = null;
    this.pads = PADS.map((p, i) => {
      const b = el('button', { class: 'pad', type: 'button', 'aria-label': `${p.name}, key ${keyLabel(p.key)}`, style: `--pad: ${p.color}` },
        el('span', { class: 'pad-name' }, p.name), el('kbd', { 'aria-hidden': 'true' }, keyLabel(p.key)));
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
    // The delay's knobs: its time in steps of the clock, its feedback and level.
    /** (name, value) a knob of the delay set 0…1. @type {(name: import('./delay.js').DelayKnob, value: number) => void} */
    this.onDelay = () => {};
    /** The delay's knobs as it comes. */
    this.onResetDelay = () => {};
    /** Each of the delay's sliders and the words for its setting. @type {Map<import('./delay.js').DelayKnob, { input: HTMLInputElement, out: HTMLOutputElement }>} */
    this.delayInputs = new Map();
    const delayRows = DELAY_KNOBS.map((name) => {
      const label = name[0].toUpperCase() + name.slice(1);
      const s = name === 'time'
        ? range(label, 1, MAX_STEPS, (n) => this.onDelay(name, (n - 1) / (MAX_STEPS - 1)))
        : slider(label, (v) => this.onDelay(name, v));
      this.delayInputs.set(name, s);
      return s.row;
    });
    this.resetDelay = el('button', { class: 'chip', type: 'button' }, 'Delay as it comes');
    this.resetDelay.addEventListener('click', () => this.onResetDelay());
    this.delayBox = el('fieldset', { class: 'delay' }, el('legend', {}, 'Delay'), ...delayRows, el('div', { class: 'actions' }, this.resetDelay));
    // The cables: for each input, the output plugged into it, or nothing.
    /** (input, output) the output chosen for an input (patch.js ids), null for nothing. @type {(input: string, output: string | null) => void} */
    this.onPlug = () => {};
    /** Each input's choice. @type {Map<string, HTMLSelectElement>} */
    this.plugs = new Map();
    const plugRows = JACKS.filter((j) => j.dir === 'in').map((j) => {
      const select = el('select', { name: j.id },
        el('option', { value: '' }, 'Nothing'),
        ...JACKS.filter((o) => o.dir === 'out' && o.kind === j.kind).map((o) => el('option', { value: o.id }, o.name)));
      select.addEventListener('change', () => this.onPlug(j.id, select.value || null));
      this.plugs.set(j.id, select);
      return el('label', { class: 'plug' }, el('span', {}, j.name), select);
    });
    this.cablesBox = el('fieldset', { class: 'cables' }, el('legend', {}, 'Cables'), ...plugRows);
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
    this.knobsBox = el('fieldset', { class: 'knobs' }, el('legend', {}, 'Knobs: ', this.knobPad), ...knobRows, el('div', { class: 'actions' }, this.resetKnobs));
    this.playRow = el('div', { class: 'actions' }, this.play);
    this.drums = el('div', { class: 'drums', id: 'drums', hidden: '' },
      this.playRow,
      this.clockBox,
      el('div', { class: 'pads', role: 'group', 'aria-label': 'Pads', style: `--rows: ${ROWS}` }, ...order.map((i) => this.pads[i])),
      this.stepsBox,
      this.knobsBox,
      this.delayBox,
      this.cablesBox,
      el('fieldset', { class: 'mixer' }, el('legend', {}, 'Sound'), volume.row, el('label', { class: 'check' }, this.mute, 'Mute')),
      this.midiBox);
    this._playing = false;
    // In a shared session: how it's going, the visitor's name in it, and on a TV the invite link.
    this.status = el('p', { class: 'together-status' });
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
      el('label', { class: 'me' }, el('span', {}, 'Your name'), this.myName),
      ...(this.inviteText ? [this.inviteText] : []));
    this.card = el('nav', { class: 'card', 'aria-label': room.title },
      el('header', {}, el('h1', { class: 'brand' }, room.title), this.back),
      el('p', { class: 'tagline' }, room.description),
      ...(this.walls ? [this.walls] : []),
      this.inRoom = el('section', { class: 'in-room', 'aria-label': 'In the room' },
        el('div', { class: 'actions' }, this.session, ...(tv ? [this.wave] : []), this.drumsToggle, this.settingsToggle),
        this.together,
        this.drums,
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
    if (this._playing && this._how in BOARD_HINTS) return BOARD_HINTS[this._how];
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
   * At the drum board playing it (controls.js playing), or not: the card's button steps away, or goes
   * to play, and the hint says how to play there, shown again; stepping away, the hint changes back
   * where it is still shown.
   */
  setPlaying(on) {
    if (on === this._playing) return;
    this._playing = on;
    this.play.textContent = on ? 'Step away from the board' : 'Play at the board';
    if (on && this._how !== 'tv-card') this.setHint(this._how);
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

  /** The clock running, or not: its button stops it, or starts it. */
  setRunning(on) {
    const label = on ? 'Stop' : 'Start';
    if (this.run.textContent !== label) this.run.textContent = label;
    if (!on) this.setPlayhead(-1);
  }

  /** The clock's tempo, in beats per minute: its slider and words. */
  setTempo(bpm) {
    const value = String(bpm);
    if (this.tempo.value !== value) this.tempo.value = value;
    if (this.tempoOut.textContent !== `${value} BPM`) {
      this.tempoOut.textContent = `${value} BPM`;
      this.tempo.setAttribute('aria-valuetext', `${value} beats a minute`);
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

  /** The delay's knobs (delay.js): their sliders and words. */
  setDelay(knobs) {
    for (const [name, { input, out }] of this.delayInputs) {
      const value = String(name === 'time' ? delaySteps(knobs[name]) : Math.round(knobs[name] * 100));
      if (input.value !== value) input.value = value;
      const text = delayText(name, knobs[name]);
      if (out.textContent !== text) {
        out.textContent = text;
        input.setAttribute('aria-valuetext', text);
      }
    }
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
   * No 3D view: the way back, where the pieces lead (the rest are just named), and the drums, which
   * play without one (open, with no board to go to).
   */
  noWebGL(message) {
    this.card.classList.add('alone');
    this.inRoom.remove();
    for (const b of this.walls?.querySelectorAll('button.piece') ?? []) b.replaceWith(el('span', { class: 'piece-title' }, b.textContent));
    this.card.append(el('p', { class: 'no-webgl' }, message));
    this.playRow.remove();
    this.drums.hidden = false;
    this.card.append(el('section', { class: 'in-room', 'aria-label': 'Drums' }, this.drums));
    this.hint.remove();
  }
}
