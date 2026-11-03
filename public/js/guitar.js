// The electric guitar on its desk by the right wall (guitarboard.js lays it out, guitarkit.js builds
// it): six strings modelled as they are plucked, nothing to download (strings.js, on the audio thread:
// strings-worklet.js), heard through its pickups (the neck's, the bridge's or both), its TONE (the
// pickups' resonance, darker turned down) and VOLUME, then its amp: a valve's drive (GAIN, clean
// through crunch to lead: its curve clips the tops a little sooner than the bottoms, as a valve does,
// worked out four times as finely as heard so its harmonics don't fold back), a tone stack (BASS,
// MIDDLE, TREBLE), MASTER, and a speaker cabinet's sound (a 12-inch speaker's: no deep lows, a thump,
// a bite, nothing much over 5 kHz). It is played as a guitarist plays: a chord fretted (its buttons;
// none, the strings open), a string plucked or all strummed, down or up; a string pressed at a fret
// is fretted there and plucked, slid along the neck to another fret, bent up to a tone; let go, the
// finger lifting mutes it, and a chord changed mutes the strings it fingers anew. A MIDI keyboard's
// notes go to the strings where they fall under a hand (a free string, at its lowest fret). The knobs
// (0…1 each), the pickup and the chord are kept for the next visit (localStorage).
import { pageStorage } from './sound.js';
import { PICK, TUNING, ringSeconds } from './strings.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */
/** @typedef {import('./strings.js').StringEvent} StringEvent */
/** The page's AudioWorkletNode, or a stand-in for it (a test's). @typedef {new (context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) => AudioWorkletNode} WorkletNode */

/** The frets on its neck. */
export const FRETS = 15;

/** The strings, low E (nearest the player) to high E: their open notes (strings.js TUNING), what each is called on it and in words. */
export const GUITAR_STRINGS = Object.freeze([
  { note: 40, label: 'E', name: 'Low E' },
  { note: 45, label: 'A', name: 'A' },
  { note: 50, label: 'D', name: 'D' },
  { note: 55, label: 'G', name: 'G' },
  { note: 59, label: 'B', name: 'B' },
  { note: 64, label: 'e', name: 'High E' },
]);

/** A chord: its id, as on its button and in words, and its frets from the low E (-1: muted). @typedef {{ id: string, label: string, name: string, frets: readonly number[] }} Chord */

/** @type {(id: string, name: string, frets: number[]) => Chord} */
const chord = (id, name, frets) => Object.freeze({ id, label: id, name, frets: Object.freeze(frets) });

/**
 * The chords on its buttons, as a beginner learns them first: in two rows of eight, the majors and
 * two minors, then the rest of the minors, the sevenths and two power chords.
 * @type {readonly Chord[]}
 */
export const CHORDS = Object.freeze([
  chord('E', 'E major', [0, 2, 2, 1, 0, 0]),
  chord('A', 'A major', [-1, 0, 2, 2, 2, 0]),
  chord('D', 'D major', [-1, -1, 0, 2, 3, 2]),
  chord('G', 'G major', [3, 2, 0, 0, 0, 3]),
  chord('C', 'C major', [-1, 3, 2, 0, 1, 0]),
  chord('F', 'F major', [1, 3, 3, 2, 1, 1]),
  chord('Em', 'E minor', [0, 2, 2, 0, 0, 0]),
  chord('Am', 'A minor', [-1, 0, 2, 2, 1, 0]),
  chord('Dm', 'D minor', [-1, -1, 0, 2, 3, 1]),
  chord('Bm', 'B minor', [-1, 2, 4, 4, 3, 2]),
  chord('E7', 'E seven', [0, 2, 0, 1, 0, 0]),
  chord('A7', 'A seven', [-1, 0, 2, 0, 2, 0]),
  chord('D7', 'D seven', [-1, -1, 0, 2, 1, 2]),
  chord('B7', 'B seven', [-1, 2, 1, 2, 0, 2]),
  chord('E5', 'E power chord', [0, 2, 2, -1, -1, -1]),
  chord('A5', 'A power chord', [-1, 0, 2, 2, -1, -1]),
]);

/** The chord's name in words, or the strings open's. @param {string | null} id */
export const chordName = (id) => CHORDS.find((c) => c.id === id)?.name ?? 'Open strings';

/**
 * The keys of a computer's keyboard that fret a chord, by where they are (KeyboardEvent.code): 1 to
 * 8 the first row's, Q to I the second's, as the drum board's steps.
 */
export const CHORD_KEYS = Object.freeze(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI']);
/** The keys that pluck a string, low E to high E: Z to N. */
export const STRING_KEYS = Object.freeze(['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN']);
/** The key that mutes every string (a palm laid on them). */
export const MUTE_KEY = 'KeyM';

/** @typedef {'guitar' | 'amp'} GuitarSection */

/** Its sections: the guitar's own knobs (on its body), then its amp's (on the panel). @type {readonly { id: GuitarSection, label: string, name: string }[]} */
export const GUITAR_SECTIONS = Object.freeze([
  { id: 'guitar', label: 'GUITAR', name: 'Guitar' },
  { id: 'amp', label: 'AMP', name: 'Amp' },
]);

/** The knobs as it comes: the guitar full up, its tone a little down; the amp at the edge of breaking up, its tone stack flat, the treble a little up. */
const DEFAULTS = { volume: 1, tone: 0.75, gain: 0.3, bass: 0.5, middle: 0.5, treble: 0.6, master: 0.6 };

/** @typedef {keyof typeof DEFAULTS} GuitarKnob */
/** The knobs, each 0…1. @typedef {Record<GuitarKnob, number>} GuitarKnobs */

/** @type {Readonly<GuitarKnobs>} */
export const DEFAULT_GUITAR = Object.freeze({ ...DEFAULTS });

/** A knob: its id, its section, what it is called on it and in words. @typedef {{ id: GuitarKnob, section: GuitarSection, label: string, name: string }} GuitarKnobSpec */

/** The knobs, the guitar's then the amp's, in the order they are shown. @type {readonly GuitarKnobSpec[]} */
export const GUITAR_KNOBS = Object.freeze([
  { id: 'volume', section: 'guitar', label: 'VOLUME', name: 'Volume' },
  { id: 'tone', section: 'guitar', label: 'TONE', name: 'Tone' },
  { id: 'gain', section: 'amp', label: 'GAIN', name: 'Gain' },
  { id: 'bass', section: 'amp', label: 'BASS', name: 'Bass' },
  { id: 'middle', section: 'amp', label: 'MIDDLE', name: 'Middle' },
  { id: 'treble', section: 'amp', label: 'TREBLE', name: 'Treble' },
  { id: 'master', section: 'amp', label: 'MASTER', name: 'Master' },
]);

/** The knobs' ids. @type {readonly GuitarKnob[]} */
const IDS = GUITAR_KNOBS.map((k) => k.id);

/** @typedef {'neck' | 'both' | 'bridge'} Pickup */

/** Its pickup switch's places, toward the neck to toward the bridge, and how much of each pickup each lets through. @type {readonly { id: Pickup, label: string, name: string, neck: number, bridge: number }[]} */
export const PICKUPS = Object.freeze([
  { id: 'neck', label: 'NECK', name: 'Neck pickup', neck: 1, bridge: 0 },
  { id: 'both', label: 'BOTH', name: 'Both pickups', neck: 0.7, bridge: 0.7 },
  { id: 'bridge', label: 'BRIDGE', name: 'Bridge pickup', neck: 0, bridge: 1 },
]);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ── What the knobs mean ─────────────────────────────────────────────────────

/** The guitar's VOLUME as a gain: its square (a pot's taper), nothing at 0. @param {number} k */
export const volumeGain = (k) => clamp(k, 0, 1) ** 2;
/** TONE: where the pickups' resonance is, 1 kHz turned down to 5 kHz up. @param {number} k */
export const toneHz = (k) => 1000 * 5 ** clamp(k, 0, 1);
/** …and how high it peaks there (a low-pass's Q, in dB): flat turned down, 6 dB up. @param {number} k */
export const toneQ = (k) => -3 + 9 * clamp(k, 0, 1);
/** GAIN: how much the amp drives its valve, from half (clean) to 100 times (lead). @param {number} k */
export const ampDrive = (k) => 10 ** ((-6 + 46 * clamp(k, 0, 1)) / 20);
/** …and how loud what comes out of it is made, so that clean, crunch and lead are about as loud. @param {number} k */
export const ampLevel = (k) => ampDrive(k) ** -0.35;
/** BASS, MIDDLE, TREBLE: how much each boosts its band or cuts it, in dB (flat at half). @param {number} k */
export const eqDb = (k) => 24 * (clamp(k, 0, 1) - 0.5);
/** MASTER as a gain: its square, nothing at 0; as it comes, a strum about as loud as the synth's chord (K-weighted, BS.1770's). @param {number} k */
export const masterGain = (k) => 2.25 * clamp(k, 0, 1) ** 2;

/** What the amp's GAIN makes of the guitar, in words. @param {number} k */
export const ampWords = (k) => (k < 0.35 ? 'clean' : k < 0.7 ? 'crunch' : 'lead');

/** How wide the amp's curve reaches, and how far off the middle its valve is biased (its tops clip sooner than its bottoms). */
const AMP_REACH = 4, AMP_BIAS = 0.15;

/** The amp's curve over −1…1: a valve's, a biased tanh, at most 1 either way. @param {number} [n] points */
export function ampCurve(n = 2049) {
  const curve = new Float32Array(n), b = Math.tanh(AMP_BIAS), top = Math.max(b - Math.tanh(AMP_BIAS - AMP_REACH), Math.tanh(AMP_BIAS + AMP_REACH) - b);
  for (let i = 0; i < n; i++) curve[i] = (Math.tanh(AMP_REACH * ((2 * i) / (n - 1) - 1) + AMP_BIAS) - b) / top;
  return curve;
}

/** The curve's slope at 0: how much louder a quiet sound comes out of it (the drive's gain goes in over it). */
export const AMP_SLOPE = (AMP_REACH * (1 - Math.tanh(AMP_BIAS) ** 2)) / Math.max(Math.tanh(AMP_BIAS) - Math.tanh(AMP_BIAS - AMP_REACH), Math.tanh(AMP_BIAS + AMP_REACH) - Math.tanh(AMP_BIAS));

/**
 * A knob's name in words standing alone ('Amp gain', 'Guitar tone').
 * @param {GuitarKnob} id
 */
export function guitarKnobName(id) {
  const k = GUITAR_KNOBS.find((x) => x.id === id);
  if (!k) return String(id);
  return `${k.section === 'amp' ? 'Amp' : 'Guitar'} ${k.name.toLowerCase()}`;
}

/** @param {number} k */
const percent = (k) => `${Math.round(clamp(k, 0, 1) * 100)}%`;

/**
 * How a knob reads, in words: the gain with what it makes of the guitar, the tone stack in dB, the
 * rest in percent (or off).
 * @param {GuitarKnob} id
 * @param {number} k
 */
export function guitarText(id, k) {
  switch (id) {
    case 'gain':
      return `${percent(k)}, ${ampWords(k)}`;
    case 'bass':
    case 'middle':
    case 'treble': {
      const db = Math.round(eqDb(k));
      return db === 0 ? '0 dB' : `${db > 0 ? '+' : '−'}${Math.abs(db)} dB`;
    }
    case 'volume':
    case 'master':
      return k <= 0 ? 'off' : percent(k);
    default:
      return percent(k);
  }
}

// ── Playing it ──────────────────────────────────────────────────────────────

/** How far apart a strum's strings are (seconds): faster the harder, 4 ms hardest, 16 ms softest. @param {number} velocity */
export const strumGap = (velocity) => 0.004 + 0.012 * (1 - clamp(velocity, 0, 1));
/** An up strum's pick meets the low strings less: each string's share of its velocity, the low E's 0.7. @param {number} s */
export const upShare = (s) => 0.7 + 0.06 * s;
/** How far a string can be bent, in semitones. */
export const MAX_BEND = 2;
/** How long a string rings once a finger lifts off it, a palm is laid on it, or the chord leaves it muted and it is struck (seconds to die away 60 dB), and how hard the last is heard. */
export const FINGER = 0.08, PALM = 0.12, MUTED = Object.freeze({ ring: 0.03, velocity: 0.5 });
/** How quickly a slide gets to its fret, and a bend to its pitch (time constants, seconds). */
const SLIDE = 0.012, BEND = 0.02;
/** How long what is played waits, at most, for the strings to be made (seconds): what waited longer is let go. */
const WAIT = 0.5;
/** How long a knob takes to get where it is turned (a time constant, in seconds), as the synth's. */
const EASE = 0.012;
/** The amp's: a high-pass before its valve (Hz), so the lows don't muddy what it drives. */
const TIGHT_HZ = 90;

/** Where its strings' processor is: beside this module. */
const WORKLET_URL = new URL('./strings-worklet.js', import.meta.url).href;

/**
 * The page's AudioWorkletNode, or null (a browser without it).
 * @returns {WorkletNode | null}
 */
function pageWorklet() {
  return /** @type {{ AudioWorkletNode?: WorkletNode }} */ (globalThis).AudioWorkletNode ?? null;
}

/** Whether s is a string's index. @param {number} s */
const isString = (s) => Number.isInteger(s) && s >= 0 && s < TUNING.length;

/**
 * Its sound's way, from the strings' processor to its channel: the pickups' resonance (TONE), VOLUME,
 * the amp's drive (into its valve, and out), its tone stack, MASTER, and out.
 * @typedef {object} GuitarGraph
 * @property {AudioWorkletNode} strings
 * @property {BiquadFilterNode} tone
 * @property {GainNode} volume
 * @property {GainNode} pre
 * @property {GainNode} post
 * @property {BiquadFilterNode} bass
 * @property {BiquadFilterNode} middle
 * @property {BiquadFilterNode} treble
 * @property {GainNode} master
 */

/** A string as last heard, for its look: when it was plucked, how hard, how long it rings, and when it was damped and how much. @typedef {{ at: number, velocity: number, ring: number, damped: number, dampRing: number }} Rang */

export class Guitar {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, Worklet?: WorkletNode | null, url?: string, seed?: number }} [o] where its settings are kept (localStorage), the page's AudioWorkletNode and where its strings' processor is, and the seed of their dice
   */
  constructor(sound, { storage = pageStorage(), key = 'guitar', Worklet = pageWorklet(), url = WORKLET_URL, seed = Math.floor(Math.random() * 2 ** 31) } = {}) {
    this.sound = sound;
    /** @type {GuitarKnobs} */
    this.knobs = { ...DEFAULT_GUITAR };
    /** @type {Pickup} */
    this.pickup = 'both';
    /** The chord fretted (CHORDS' id), else null: the strings open. @type {string | null} */
    this.chord = null;
    /** Each string's fret a finger presses it at (the desk, the card, a MIDI note), else -1. @type {number[]} */
    this.pressed = TUNING.map(() => -1);
    /** How far each string pressed is bent, in semitones. @type {number[]} */
    this.bends = TUNING.map(() => 0);
    /** When the chord, or a string pressed or bent, changes (to show them). */
    this.onStrings = () => {};
    /** Whether its strings can't sound here: the page has no AudioWorklet (one not served securely, an old browser). */
    this.broken = false;
    /** @private the chord's frets (all 0: none) */
    this._frets = TUNING.map(() => 0);
    /** @private @type {Rang[]} */
    this._rang = TUNING.map(() => ({ at: -Infinity, velocity: 0, ring: 1, damped: Infinity, dampRing: 1 }));
    /** @private a MIDI note's string, and the order they came in @type {Map<number, { string: number, n: number }>} */
    this._midi = new Map();
    /** @private */
    this._order = 0;
    /** @private a string pressed for a moment (tapFret), and when it is let go @type {Map<number, ReturnType<typeof setTimeout>>} */
    this._taps = new Map();
    /** @private */
    this._Worklet = Worklet;
    /** @private */
    this._url = url;
    /** @private */
    this._seed = seed;
    /** @private @type {Promise<boolean> | null} */
    this._loading = null;
    /** @private what the strings are told before they are made @type {StringEvent[]} */
    this._queue = [];
    /** @private @type {GuitarGraph | null} */
    this._graph = null;
    /** @private into the mixer's channel @type {GainNode | null} */
    this._out = null;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** The chord fretted, in words (or the strings open). */
  get chordName() {
    return chordName(this.chord);
  }

  /** The pickup, in words. */
  get pickupName() {
    return PICKUPS.find((p) => p.id === this.pickup)?.name ?? '';
  }

  /** Its sound, after its amp, for a cable (before the mixer's channel): made once its strings are, null before. */
  output() {
    return this._graph ? this._out : null;
  }

  /**
   * The fret string s is played at now: where it is pressed, else the chord's (-1: muted), else open.
   * @param {number} s
   */
  fretOf(s) {
    if (!isString(s)) return -1;
    return this.pressed[s] >= 0 ? this.pressed[s] : this._frets[s];
  }

  /**
   * The note string s plays now (MIDI, its bend in it), or null where the chord mutes it.
   * @param {number} s
   */
  noteOf(s) {
    const f = this.fretOf(s);
    return f < 0 ? null : TUNING[s] + f + this.bends[s];
  }

  /**
   * How much string s is moving at time t (0…1 struck hardest), for its look: from its pluck's
   * velocity dying away as it rings, and faster once damped.
   * @param {number} s
   * @param {number} t
   */
  level(s, t) {
    const r = this._rang[s];
    if (!r || t < r.at) return 0;
    let v = r.velocity * Math.exp((-6.9 * (t - r.at)) / r.ring);
    if (t > r.damped) v *= Math.exp((-6.9 * (t - r.damped)) / r.dampRing);
    return v < 1e-3 ? 0 : v;
  }

  /**
   * The strings' processor loaded and the amp made, once there is sound (main.js: when the sound
   * wakes; played before, it is asked for then): whether they are.
   */
  prepare() {
    if (this._loading) return this._loading;
    const ctx = this.sound.ctx, Worklet = this._Worklet;
    if (!ctx) return Promise.resolve(false);
    if (!ctx.audioWorklet || !Worklet) {
      this._fail('no AudioWorklet');
      return (this._loading = Promise.resolve(false));
    }
    this._loading = ctx.audioWorklet.addModule(this._url).then(
      () => {
        this._build(ctx, Worklet);
        return true;
      },
      (err) => {
        this._fail(err instanceof Error ? err.message : String(err));
        return false;
      },
    );
    return this._loading;
  }

  /**
   * String s plucked as it is fretted, `velocity` 0…1 hard, at `at` (the audio clock's; now if
   * sooner), the pick `pick` of its length from the bridge; one the chord mutes is heard as a short
   * thud. Waking the sound: whether it is heard (no Web Audio, or no AudioWorklet: not).
   * @param {number} s
   * @param {number} [velocity]
   * @param {{ at?: number, pick?: number }} [o]
   */
  pluck(s, velocity = 0.8, { at = 0, pick = PICK.usual } = {}) {
    if (!isString(s)) return false;
    const ctx = this.sound.wake();
    if (!ctx || this.broken) return false;
    const t = Math.max(at, ctx.currentTime), v = Number.isFinite(velocity) ? clamp(velocity, 0, 1) : 0.8, note = this.noteOf(s);
    if (note === null) {
      this._post({ type: 'pluck', string: s, note: TUNING[s], at: t, velocity: v * MUTED.velocity, pick, ring: MUTED.ring });
      this._rang[s] = { at: t, velocity: v * MUTED.velocity, ring: MUTED.ring, damped: Infinity, dampRing: 1 };
    } else {
      this._post({ type: 'pluck', string: s, note, at: t, velocity: v, pick });
      this._rang[s] = { at: t, velocity: v, ring: ringSeconds(note), damped: Infinity, dampRing: 1 };
    }
    return !this.broken;
  }

  /**
   * Every string strummed, down (low E first) or up (high E first, the low strings less), each
   * strumGap after the one before (or `spread` seconds), from `at` (now if sooner). Whether heard.
   * @param {boolean} down
   * @param {number} [velocity]
   * @param {{ at?: number, spread?: number }} [o]
   */
  strum(down, velocity = 0.8, { at = 0, spread } = {}) {
    const ctx = this.sound.wake();
    if (!ctx || this.broken) return false;
    const t = Math.max(at, ctx.currentTime), v = Number.isFinite(velocity) ? clamp(velocity, 0, 1) : 0.8;
    const gap = spread !== undefined && Number.isFinite(spread) ? Math.max(0, spread) : strumGap(v);
    let heard = false;
    for (let i = 0; i < TUNING.length; i++) {
      const s = down ? i : TUNING.length - 1 - i;
      heard = this.pluck(s, down ? v : v * upShare(s), { at: t + i * gap }) || heard;
    }
    return heard;
  }

  /**
   * String s pressed at `fret` (0 the open string's place, to FRETS) and plucked: held there until
   * let go (release), slid or bent meanwhile. Whether heard.
   * @param {number} s
   * @param {number} fret
   * @param {number} [velocity]
   */
  press(s, fret, velocity = 0.8) {
    if (!isString(s) || !Number.isFinite(fret)) return false;
    this._untap(s);
    this.pressed[s] = clamp(Math.round(fret), 0, FRETS);
    this.bends[s] = 0;
    this.onStrings();
    return this.pluck(s, velocity);
  }

  /**
   * String s pressed for a moment at `fret` (a click, the TV's OK): let go `length` seconds later
   * unless pressed or let go first. Whether heard.
   * @param {number} s
   * @param {number} fret
   * @param {number} [velocity]
   * @param {number} [length]
   */
  tapFret(s, fret, velocity = 0.8, length = 0.8) {
    const heard = this.press(s, fret, velocity);
    if (isString(s) && this.pressed[s] >= 0) this._taps.set(s, setTimeout(() => this.release(s), length * 1000));
    return heard;
  }

  /**
   * A string pressed slid along the neck to `fret`, still ringing (its pitch through the frets).
   * @param {number} s
   * @param {number} fret
   */
  slide(s, fret) {
    if (!isString(s) || this.pressed[s] < 0 || !Number.isFinite(fret)) return;
    const f = clamp(Math.round(fret), 0, FRETS);
    if (f === this.pressed[s]) return;
    this.pressed[s] = f;
    this._pitch(s, SLIDE);
    this.onStrings();
  }

  /**
   * A string pressed bent `semitones` up (0…MAX_BEND), still ringing.
   * @param {number} s
   * @param {number} semitones
   */
  bend(s, semitones) {
    if (!isString(s) || this.pressed[s] < 0 || !Number.isFinite(semitones)) return;
    const b = clamp(semitones, 0, MAX_BEND);
    if (Math.abs(b - this.bends[s]) < 0.01) return;
    this.bends[s] = b;
    this._pitch(s, BEND);
    this.onStrings();
  }

  /**
   * A string pressed let go: the finger lifting mutes it, and it is played as the chord frets it again.
   * @param {number} s
   */
  release(s) {
    if (!isString(s)) return;
    this._untap(s);
    if (this.pressed[s] < 0) return;
    this.pressed[s] = -1;
    this.bends[s] = 0;
    this.damp(s, FINGER);
    this.onStrings();
  }

  /**
   * A string's ringing cut short (every string's, s -1: a palm laid on them), to `ring` seconds; one
   * that rings no longer already is let be.
   * @param {number} [s]
   * @param {number} [ring]
   */
  damp(s = -1, ring = PALM) {
    const t = this.sound.ctx?.currentTime;
    if (t === undefined) return;
    for (let i = 0; i < TUNING.length; i++) {
      if (s >= 0 && i !== s) continue;
      const r = this._rang[i];
      if (Math.min(r.ring, r.damped <= t ? r.dampRing : Infinity) <= ring) continue;
      this._post({ type: 'damp', string: i, at: t, ring });
      r.damped = Math.min(r.damped, t);
      r.dampRing = ring;
    }
  }

  /**
   * A chord fretted (CHORDS' id), or none (null: the strings open); the strings it fingers anew are
   * muted as the fingers move. Whether it is one.
   * @param {string | null} id
   */
  choose(id) {
    const c = id === null ? null : CHORDS.find((x) => x.id === id);
    if (c === undefined) return false;
    const next = c ? c.id : null;
    if (next === this.chord) return true;
    const before = TUNING.map((_, s) => this.fretOf(s));
    this.chord = next;
    this._frets = c ? [...c.frets] : TUNING.map(() => 0);
    for (let s = 0; s < TUNING.length; s++) if (this.pressed[s] < 0 && this.fretOf(s) !== before[s]) this.damp(s, FINGER);
    this.onStrings();
    this._saveSoon();
    return true;
  }

  /**
   * A MIDI note played: on the free string where it falls lowest on the neck (taken from the note
   * held longest where none is free), an octave up or down until the guitar has it. Whether heard.
   * @param {number} note
   * @param {number} [velocity]
   */
  noteOn(note, velocity = 0.8) {
    if (!Number.isFinite(note)) return false;
    let n = Math.round(note);
    while (n < TUNING[0]) n += 12;
    while (n > TUNING[TUNING.length - 1] + FRETS) n -= 12;
    const held = new Map([...this._midi.values()].map((m) => [m.string, m.n]));
    /** @type {number[]} */
    const fits = [];
    for (let s = 0; s < TUNING.length; s++) if (n - TUNING[s] >= 0 && n - TUNING[s] <= FRETS) fits.push(s);
    const free = fits.filter((s) => !held.has(s) && this.pressed[s] < 0);
    const s = free.length
      ? free.reduce((a, b) => (n - TUNING[b] < n - TUNING[a] ? b : a))
      : fits.reduce((a, b) => ((held.get(b) ?? Infinity) < (held.get(a) ?? Infinity) ? b : a));
    for (const [k, m] of this._midi) if (m.string === s) this._midi.delete(k);
    this._midi.set(Math.round(note), { string: s, n: this._order++ });
    return this.press(s, n - TUNING[s], velocity);
  }

  /** A MIDI note let go: its string, if it still plays it. @param {number} note */
  noteOff(note) {
    const m = this._midi.get(Math.round(note));
    if (!m) return;
    this._midi.delete(Math.round(note));
    this.release(m.string);
  }

  /** Every string let go and muted (the page put away). */
  allOff() {
    for (const timer of this._taps.values()) clearTimeout(timer);
    this._taps.clear();
    this._midi.clear();
    const had = this.pressed.some((f) => f >= 0) || this.bends.some((b) => b > 0);
    this.pressed.fill(-1);
    this.bends.fill(0);
    this.damp(-1, PALM);
    if (had) this.onStrings();
  }

  /**
   * Sets a knob (0…1), heard at once (eased there); kept a moment later (a knob turned keeps changing).
   * @param {GuitarKnob} id
   * @param {number} value
   */
  setKnob(id, value) {
    if (!IDS.includes(id) || !Number.isFinite(value)) return;
    this.knobs[id] = clamp(value, 0, 1);
    this._apply(id);
    this._saveSoon();
  }

  /** The pickup switched (PICKUPS' id; another word changes nothing): whether it is one. @param {string} id */
  setPickup(id) {
    const p = PICKUPS.find((x) => x.id === id);
    if (!p) return false;
    if (p.id === this.pickup) return true;
    this.pickup = p.id;
    if (this._graph) this._post({ type: 'pickups', neck: p.neck, bridge: p.bridge });
    this._saveSoon();
    return true;
  }

  /** The knobs and the pickup as they come, and no chord. */
  reset() {
    for (const id of IDS) {
      this.knobs[id] = DEFAULT_GUITAR[id];
      this._apply(id);
    }
    this.setPickup('both');
    this.choose(null);
    this._saveSoon();
  }

  /** @private @param {number} s */
  _untap(s) {
    clearTimeout(this._taps.get(s));
    this._taps.delete(s);
  }

  /**
   * String s's pitch moved to its note now, by `glide` seconds (a time constant).
   * @private
   * @param {number} s
   * @param {number} glide
   */
  _pitch(s, glide) {
    const t = this.sound.ctx?.currentTime;
    if (t === undefined || this.broken) return;
    this._post({ type: 'pitch', string: s, note: this.noteOf(s) ?? TUNING[s], at: t, glide });
  }

  /**
   * Tells the strings, or keeps it for when they are made (asking for them).
   * @private
   * @param {StringEvent} event
   */
  _post(event) {
    if (this.broken) return;
    const node = this._graph?.strings;
    if (node) {
      node.port.postMessage(event);
      return;
    }
    this._queue.push(event);
    void this.prepare();
  }

  /**
   * The strings can't be made here: nothing waits for them.
   * @private
   * @param {string} why
   */
  _fail(why) {
    if (!this.broken) console.info(`guitar: its strings can't sound here (${why})`);
    this.broken = true;
    this._queue.length = 0;
  }

  /**
   * A knob heard at once: eased there (a knob turned), or set (the graph made).
   * @private
   * @param {GuitarKnob} id
   * @param {boolean} [ease]
   */
  _apply(id, ease = true) {
    const ctx = this.sound.ctx, g = this._graph;
    if (!ctx || !g) return;
    const t = ctx.currentTime, k = this.knobs[id];
    /** @type {(param: AudioParam, v: number) => void} */
    const to = (param, v) => {
      if (!ease) {
        param.value = v;
        return;
      }
      param.cancelScheduledValues(t);
      param.setTargetAtTime(v, t, EASE);
    };
    switch (id) {
      case 'volume':
        to(g.volume.gain, volumeGain(k));
        break;
      case 'tone':
        to(g.tone.frequency, toneHz(k));
        to(g.tone.Q, toneQ(k));
        break;
      case 'gain':
        to(g.pre.gain, ampDrive(k) / AMP_SLOPE);
        to(g.post.gain, ampLevel(k));
        break;
      case 'bass':
      case 'middle':
      case 'treble':
        to(g[id].gain, eqDb(k));
        break;
      case 'master':
        to(g.master.gain, masterGain(k));
        break;
      default:
        break;
    }
  }

  /**
   * Its way into the mixer, made once there is sound; null before.
   * @private
   */
  _outNode() {
    if (this._out) return this._out;
    const ctx = this.sound.ctx, channel = this.sound.channel('guitar');
    if (!ctx || !channel) return null;
    this._out = ctx.createGain();
    this._out.connect(channel);
    return this._out;
  }

  /**
   * The strings' processor and the amp after it, its knobs and its pickup set; then what was played
   * while they were made, from now (its first now, the rest as far after it as they were), what
   * waited longer than WAIT let go.
   * @private
   * @param {BaseAudioContext} ctx
   * @param {WorkletNode} Worklet
   */
  _build(ctx, Worklet) {
    const out = this._outNode();
    if (this._graph || !out) return;
    const strings = new Worklet(ctx, 'guitar-strings', {
      numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { tuning: [...TUNING], seed: this._seed },
    });
    /** @type {(type: BiquadFilterType, frequency: number, Q?: number, gain?: number) => BiquadFilterNode} */
    const biquad = (type, frequency, Q = 0, gain = 0) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = Q;
      f.gain.value = gain;
      return f;
    };
    const tone = biquad('lowpass', 4000), volume = ctx.createGain();
    // The amp's valve: the lows tightened, driven into its curve, made as loud again.
    const pre = ctx.createGain(), tight = biquad('highpass', TIGHT_HZ, -3), valve = ctx.createWaveShaper(), post = ctx.createGain();
    valve.curve = ampCurve();
    valve.oversample = '4x';
    const bass = biquad('lowshelf', 120), middle = biquad('peaking', 650, 0.8), treble = biquad('highshelf', 2600);
    const master = ctx.createGain();
    // The cabinet: a 12-inch speaker's lows rolled off under 75 Hz, a thump at 120, a bite at 2.2 kHz,
    // and little over 5 kHz.
    const cabinet = [biquad('highpass', 75, 0), biquad('peaking', 120, 1.4, 3), biquad('peaking', 2200, 1.2, 3), biquad('lowpass', 4500, 3), biquad('lowpass', 6500, -3)];
    /** @type {AudioNode} */
    let at = strings;
    for (const node of [tone, volume, pre, tight, valve, post, bass, middle, treble, master, ...cabinet]) at = at.connect(node);
    at.connect(out);
    this._graph = { strings, tone, volume, pre, post, bass, middle, treble, master };
    for (const id of IDS) this._apply(id, false);
    const p = PICKUPS.find((x) => x.id === this.pickup) ?? PICKUPS[1];
    /** @type {StringEvent[]} */
    const told = [{ type: 'pickups', neck: p.neck, bridge: p.bridge }];
    const now = ctx.currentTime, waiting = this._queue.splice(0).filter((e) => e.type === 'pickups' || e.at >= now - WAIT);
    const first = Math.min(...waiting.map((e) => (e.type === 'pickups' ? Infinity : e.at)));
    const later = first < now ? now - first : 0;
    for (const e of waiting) if (e.type !== 'pickups') told.push({ ...e, at: e.at + later });
    strings.port.postMessage(told);
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (!s || typeof s !== 'object') return;
      for (const id of IDS) {
        const v = s.knobs?.[id];
        if (Number.isFinite(v)) this.knobs[id] = clamp(v, 0, 1);
      }
      if (PICKUPS.some((p) => p.id === s.pickup)) this.pickup = s.pickup;
      const c = CHORDS.find((x) => x.id === s.chord);
      if (c) {
        this.chord = c.id;
        this._frets = [...c.frets];
      }
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the knobs, the pickup and the chord now (localStorage). */
  save() {
    clearTimeout(this._saving);
    try {
      this._storage?.setItem(this._key, JSON.stringify({ knobs: this.knobs, pickup: this.pickup, chord: this.chord }));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
