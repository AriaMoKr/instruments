// The keyboard left of the drum board (keysboard.js lays it out, keyskit.js builds it): a stage
// keyboard of sixty-one keys from C2 with two sounds made with Web Audio as they are played, nothing
// to download, and the two at once (a layer).
// Its organ is as the tonewheel organs of the 1950s and 60s made theirs. A key's note is nine sine
// waves at once, its drawbars' (16′ an octave under the note, 8′ the note, then up to 1′, three
// octaves over it), each pulled out 0 to 8 and 3 dB louder a step; they are all harmonics of the
// 16′'s, so they are one wave and one oscillator a note. A click as a key's contacts close and open;
// the percussion, the second or the third harmonic struck and dying away fast or slowly, on the first
// key of a phrase only (a key pressed while none is held), as on the B-3; then the scanner (a short
// delay swaying 6.9 times a second, its vibrato, beside what went in: its chorus), a drive (a soft
// clip, its amplifier's) and a rotary speaker: a horn for the highs and a drum for the lows going
// round, slowly or fast, each speeding up and slowing down at its own pace, so that on each side
// their sound comes and goes and its pitch rises and falls as each turns towards that side and away.
// An organ isn't played harder or softer, so every key is as loud.
// Its electric piano is the tine pianos of the 1970s by FM, as the digital pianos of the 1980s made
// theirs: a key's note is a sine whose pitch another at the note moves (the harder a key is struck,
// the more: brighter, with a bark), dying back to a purer tone, and a short ring over it (a third sine
// at seven times the note, the tine's). Harder keys are louder; held, a note dies away over seconds,
// lower notes more slowly; let go, a damper stops it. Then a tremolo pans it from side to side.
// A key's note is made as it is played and stopped once it has died away, a voice a note, sixteen at
// most held for each sound (past that the oldest is cut). A MIDI keyboard's sustain pedal, or the
// SUSTAIN button, holds the notes let go until it is let go too. The knobs (0…1 each, as on the
// keyboard; a drawbar's in eighths), the switches, the sound chosen and the octave the computer's keys
// play in are kept for the next visit (localStorage).
// Its jacks (patch.js's; the cables main.js's): its sound out (output, both sounds), its notes out
// (onNoteOut: each note as its key goes down, and as it ends, let go with the pedal up), and ROTARY
// in (setInput), where a modulation moves the rotary speaker's speed on from where FAST has it,
// towards fast (or slow), as far as it goes and no further.
import { pageStorage } from './sound.js';
import { driveGain, noteHz, tanhCurve, velocityLevel } from './synth.js';

/** @typedef {import('./sound.js').Sound} Sound */
/** @typedef {import('./sound.js').Store} Store */

/** The keys on the keyboard: five octaves and the C above. */
export const KEYS_COUNT = 61;
/** The lowest key's note (MIDI): C2; middle C (C4, 60) is its 25th key. */
export const KEYS_LOWEST = 36;
/**
 * How far the octave buttons move the computer's keys (A is middle C at 0, and they reach up an
 * octave and a fourth), down and up: so far as they stay on the keyboard (C2 to F6).
 */
export const KEYS_OCTAVES = Object.freeze({ min: -2, max: 1 });

/** What the keys play: the organ, the electric piano, or both at once. @typedef {'organ' | 'epiano' | 'both'} KeysChoice */

/** The sounds, as on the panel's buttons and in words. @type {readonly { id: KeysChoice, label: string, name: string }[]} */
export const KEYS_SOUNDS = Object.freeze([
  { id: 'organ', label: 'ORGAN', name: 'Organ' },
  { id: 'epiano', label: 'E.PIANO', name: 'Electric piano' },
  { id: 'both', label: 'BOTH', name: 'Both' },
]);

/** @typedef {'drawbars' | 'organ' | 'epiano'} KeysSection */

/**
 * The sections of its controls, left to right along its top: what each is called on it, and in words.
 * @type {readonly { id: KeysSection, label: string, name: string }[]}
 */
export const KEYS_SECTIONS = Object.freeze([
  { id: 'drawbars', label: 'DRAWBARS', name: 'Drawbars' },
  { id: 'organ', label: 'ORGAN', name: 'Organ' },
  { id: 'epiano', label: 'ELECTRIC PIANO', name: 'Electric piano' },
]);

/** The knobs as it comes: the drawbars at 88 8000 000, a jazz organ's, and a warm electric piano. */
const DEFAULTS = {
  d16: 1, d513: 1, d8: 1, d4: 0, d223: 0, d2: 0, d135: 0, d113: 0, d1: 0,
  chorus: 0.6, click: 0.35, drive: 0.2, rotary: 0.75, organLevel: 0.7,
  tone: 0.5, bark: 0.5, decay: 0.6, tremolo: 0.35, rate: 0.45, pianoLevel: 0.7,
};

/** @typedef {keyof typeof DEFAULTS} KeysKnob */
/** The knobs, each 0…1. @typedef {Record<KeysKnob, number>} KeysKnobs */

/** @type {Readonly<KeysKnobs>} */
export const DEFAULT_KEYS = Object.freeze({ ...DEFAULTS });

/**
 * A knob: its id, its section, what it is called on the keyboard (short) and in words (the card's
 * slider, under its section's name).
 * @typedef {{ id: KeysKnob, section: KeysSection, label: string, name: string }} KeysKnobSpec
 */

/** The knobs, section by section, in the order the keyboard and the card show them. @type {readonly KeysKnobSpec[]} */
export const KEYS_KNOBS = Object.freeze([
  { id: 'd16', section: 'drawbars', label: '16′', name: '16′' },
  { id: 'd513', section: 'drawbars', label: '5⅓′', name: '5⅓′' },
  { id: 'd8', section: 'drawbars', label: '8′', name: '8′' },
  { id: 'd4', section: 'drawbars', label: '4′', name: '4′' },
  { id: 'd223', section: 'drawbars', label: '2⅔′', name: '2⅔′' },
  { id: 'd2', section: 'drawbars', label: '2′', name: '2′' },
  { id: 'd135', section: 'drawbars', label: '1⅗′', name: '1⅗′' },
  { id: 'd113', section: 'drawbars', label: '1⅓′', name: '1⅓′' },
  { id: 'd1', section: 'drawbars', label: '1′', name: '1′' },
  { id: 'chorus', section: 'organ', label: 'CHORUS', name: 'Chorus' },
  { id: 'click', section: 'organ', label: 'CLICK', name: 'Key click' },
  { id: 'drive', section: 'organ', label: 'DRIVE', name: 'Drive' },
  { id: 'rotary', section: 'organ', label: 'ROTARY', name: 'Rotary speaker' },
  { id: 'organLevel', section: 'organ', label: 'LEVEL', name: 'Level' },
  { id: 'tone', section: 'epiano', label: 'TONE', name: 'Tone' },
  { id: 'bark', section: 'epiano', label: 'BARK', name: 'Bark' },
  { id: 'decay', section: 'epiano', label: 'DECAY', name: 'Decay' },
  { id: 'tremolo', section: 'epiano', label: 'TREMOLO', name: 'Tremolo' },
  { id: 'rate', section: 'epiano', label: 'RATE', name: 'Tremolo rate' },
  { id: 'pianoLevel', section: 'epiano', label: 'LEVEL', name: 'Level' },
]);

/** The knobs' ids. @type {readonly KeysKnob[]} */
const IDS = KEYS_KNOBS.map((k) => k.id);

/**
 * Each drawbar's harmonic of the 16′'s pitch, an octave under the note: 16′ the first, 8′ (the
 * note) the second, 5⅓′ the third (a fifth over the 8′)… 1′ the sixteenth.
 * @type {Readonly<Partial<Record<KeysKnob, number>>>}
 */
export const DRAWBAR_HARMONICS = Object.freeze({ d16: 1, d513: 3, d8: 2, d4: 4, d223: 6, d2: 8, d135: 10, d113: 12, d1: 16 });

/** The drawbars' ids, as they lie left to right. @type {readonly KeysKnob[]} */
export const DRAWBARS = Object.freeze(KEYS_KNOBS.filter((k) => k.section === 'drawbars').map((k) => k.id));

/** Whether a knob is a drawbar. @param {KeysKnob} id */
export const isDrawbar = (id) => DRAWBARS.includes(id);

/** @typedef {'perc' | 'third' | 'fast' | 'rotaryFast'} KeysSwitch */

/**
 * The switches: the percussion on, on the third harmonic (else the second), dying away fast (else
 * slowly), and the rotary speaker fast (else slow); what each is called on the keyboard, and in words.
 * @type {readonly { id: KeysSwitch, label: string, name: string }[]}
 */
export const KEYS_SWITCHES = Object.freeze([
  { id: 'perc', label: 'PERC', name: 'Percussion' },
  { id: 'third', label: '3RD', name: 'Third harmonic' },
  { id: 'fast', label: 'FAST', name: 'Fast decay' },
  { id: 'rotaryFast', label: 'FAST', name: 'Rotary speaker fast' },
]);

/** The switches as it comes: the percussion on, on the third, fast; the rotary speaker slow. @type {Readonly<Record<KeysSwitch, boolean>>} */
export const DEFAULT_SWITCHES = Object.freeze({ perc: true, third: true, fast: true, rotaryFast: false });

/** @type {readonly KeysSwitch[]} */
const SWITCHES = KEYS_SWITCHES.map((s) => s.id);

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ── What the knobs mean ─────────────────────────────────────────────────────

/** A drawbar's step, 0…8, for its knob. @param {number} k */
export const drawbarStep = (k) => Math.round(clamp(k, 0, 1) * 8);
/** A drawbar's loudness at a step: 3 dB less a step under 8, none at 0. @param {number} n */
export const drawbarLevel = (n) => (n <= 0 ? 0 : 10 ** ((3 * (Math.min(n, 8) - 8)) / 20));
/** How far the scanner's delay sways either way, in seconds: half a millisecond at most (its pitch about a quarter of a semitone). @param {number} k */
export const scannerDepth = (k) => 0.0005 * clamp(k, 0, 1);
/** How much of what is heard is the scanner's swaying copy: half (as much as what went in) from halfway up. @param {number} k */
export const scannerMix = (k) => Math.min(0.5, clamp(k, 0, 1));
/** How loud a key's click is. @param {number} k */
export const clickLevel = (k) => 0.5 * clamp(k, 0, 1) ** 2;
/** The organ's level, or the piano's, into the mixer. @param {number} k */
export const keysLevel = (k) => 1.2 * clamp(k, 0, 1) ** 2;
/** The piano's FM index for TONE: how far the second sine moves the note's, in the note's own frequencies, before BARK. @param {number} k */
export const toneIndex = (k) => 0.3 + 1.5 * clamp(k, 0, 1);
/** How many times more a strike of `velocity` moves it with BARK at k: up to four, struck hardest. @param {number} k @param {number} velocity */
export const barkIndex = (k, velocity) => 1 + 3 * clamp(k, 0, 1) * clamp(velocity, 0, 1) ** 2;
/** How long middle C rings held (a time constant, in seconds): from 0.4 to 6.4. @param {number} k */
export const pianoDecay = (k) => 0.4 * 2 ** (4 * clamp(k, 0, 1));
/** A note's time constant held: lower notes ring on longer, higher ones less (half as long two and a half octaves up). @param {number} k @param {number} note */
export const noteDecay = (k, note) => pianoDecay(k) * 2 ** (-(note - 60) / 30);
/** The tremolo's rate in Hz: from 1.5 to about 9. @param {number} k */
export const tremoloHz = (k) => 1.5 * 2 ** (2.6 * clamp(k, 0, 1));

/** The drawbars as an organist writes them: their steps in groups, 88 8000 000. @param {Readonly<Record<KeysKnob, number>>} knobs */
export function registration(knobs) {
  const s = DRAWBARS.map((id) => drawbarStep(knobs[id])).join('');
  return `${s.slice(0, 2)} ${s.slice(2, 6)} ${s.slice(6)}`;
}

/**
 * The drawbars' wave: the sine terms of a PeriodicWave at the 16′'s pitch, each drawbar's at its
 * harmonic, as loud as it is pulled out (no cosine terms).
 * @param {Readonly<Record<KeysKnob, number>>} knobs
 */
export function drawbarWave(knobs) {
  const real = new Float32Array(17), imag = new Float32Array(17);
  for (const id of DRAWBARS) imag[DRAWBAR_HARMONICS[id] ?? 0] += drawbarLevel(drawbarStep(knobs[id]));
  return { real, imag };
}

/**
 * A knob's name in words standing alone: a drawbar's as such, a level with whose it is ('Drawbar
 * 16′', 'Organ level', 'Tremolo rate').
 * @param {KeysKnob} id
 */
export function keysKnobName(id) {
  const k = KEYS_KNOBS.find((x) => x.id === id);
  if (!k) return String(id);
  if (k.section === 'drawbars') return `Drawbar ${k.label}`;
  if (id === 'organLevel') return 'Organ level';
  if (id === 'pianoLevel') return 'Electric piano level';
  return k.name;
}

/** @param {number} k */
const percent = (k) => `${Math.round(clamp(k, 0, 1) * 100)}%`;

/**
 * How a knob reads, in words: a drawbar's step, a time, a rate, the rest in percent (or off).
 * @param {KeysKnob} id
 * @param {number} k
 */
export function keysText(id, k) {
  if (isDrawbar(id)) return String(drawbarStep(k));
  switch (id) {
    case 'chorus':
    case 'rotary':
    case 'tremolo':
      return k <= 0 ? 'off' : percent(k);
    case 'click':
      return k <= 0 ? 'none' : percent(k);
    case 'decay':
      // Middle C held: how long until it has died away to a hundredth.
      return `${(pianoDecay(k) * Math.log(100)).toFixed(1)} s`;
    case 'rate':
      return `${tremoloHz(k).toFixed(1)} Hz`;
    default:
      return percent(k);
  }
}

/**
 * A switch as it is now, in words (said as its button is pressed).
 * @param {KeysSwitch} id
 * @param {boolean} on
 */
export function switchWords(id, on) {
  switch (id) {
    case 'perc':
      return on ? 'Percussion on' : 'Percussion off';
    case 'third':
      return `Percussion on the ${on ? 'third' : 'second'} harmonic`;
    case 'fast':
      return `Percussion dying away ${on ? 'fast' : 'slowly'}`;
    default:
      return `Rotary speaker ${on ? 'fast' : 'slow'}`;
  }
}

// ── The voices ──────────────────────────────────────────────────────────────

/** How many notes each sound holds at once, at most: past it the oldest is cut short. */
export const KEYS_VOICES = 16;
/** An organ note's loudness (its drawbars' wave times this), and how quickly it starts and stops (time constants, in seconds): at once, as a key's contacts. */
const ORGAN_GAIN = 0.11, ORGAN_ATTACK = 0.0015, ORGAN_RELEASE = 0.005;
/**
 * How much louder the organ comes out than its LEVEL alone sets it: its notes go in quiet, so that
 * the drive bites only when it is turned up, and come out as loud as the synth's and the piano's.
 */
export const ORGAN_OUT = 2.5;
/** The percussion: how loud (a drawbar pulled out all the way is 1), and how quickly it dies away (a time constant, in seconds), fast and slow. */
export const PERC = Object.freeze({ level: 1, fast: 0.12, slow: 0.45 });
/** The scanner: its delay's middle (seconds) and how often it sways (Hz). */
const SCANNER = Object.freeze({ base: 0.0006, hz: 6.9 });
/** How wide the drive's curve reaches (as the synth's). */
const DRIVE_REACH = 4;
/** Where the rotary speaker's horn takes over from its drum, in Hz, and the delay its turning sways around (seconds). */
const CROSSOVER = 800, ROTOR_DELAY = 0.001;
/** How fast the rotors go, FAST's (SLOW_SPEED slow, 1 fast) and ROTARY's together, kept from slow to fast: a WaveShaper's curve over −1…1, nothing to 0, then as it is. */
const SPEED_CURVE = new Float32Array([0, 0, 1]);
/**
 * FAST's speed when it is off: slow, though never quite 0. To Chrome a ConstantSource at 0 is
 * silence, and an IIRFilter whose input is silent stops after its tail (the horn's lag, a quarter of a
 * second), holding where it was: the horn would drop to slow there, and leap back from there.
 */
export const SLOW_SPEED = 1e-6;
/**
 * The rotary speaker's horn and drum: how fast each goes round, slow and fast (Hz), how quickly it
 * gets there (a time constant, in seconds: the drum, heavier, takes longer), how far its turning
 * sways the delay either way (seconds: the horn's mouth goes round further out), and how far its
 * sound comes and goes on each side.
 */
export const ROTORS = Object.freeze({
  horn: Object.freeze({ slow: 0.8, fast: 6.7, ramp: 0.35, sway: 0.0004, am: 0.35 }),
  drum: Object.freeze({ slow: 0.67, fast: 5.9, ramp: 1.4, sway: 0.00015, am: 0.2 }),
});
/** A piano note's loudness at full velocity, its attack (seconds) and how quickly the damper stops it (a time constant). */
const PIANO_GAIN = 0.32, PIANO_ATTACK = 0.002, DAMP = 0.045;
/** Its FM: how far the index falls back to (of its peak) and how quickly (a time constant); the tine's ring, its frequency (of the note's), its depth and how quickly it dies. */
const INDEX_SUSTAIN = 0.15, INDEX_DECAY = 0.3, TINE = 7, RING = 0.9, RING_DECAY = 0.022;
/** How quickly a note cut short goes (a time constant, in seconds), and how long its sources go on after. */
const CUT = 0.003, CUT_STOP = 0.02;
/** How long a knob takes to get where it is turned (a time constant, in seconds), as the synth's. */
const EASE = 0.012;
/** The knobs each sound hears at once (the rest from its next note; the drawbars in its wave). @type {Readonly<Record<'organ' | 'piano', readonly KeysKnob[]>>} */
const LIVE = Object.freeze({ organ: ['chorus', 'drive', 'rotary', 'organLevel'], piano: ['tremolo', 'rate', 'pianoLevel'] });

/**
 * A note sounding: its key's note, which sound plays it, whether its key is down or the pedal holds
 * it; when it started and when it will have died away (Infinity: an organ's, until let go); its amp's
 * envelope (an organ's up towards `peak` from `t0` by `tau`, a piano's up to it and then dying away
 * by `tau`) and, once let go or cut short at `rel`, from `relFrom` towards nothing by `relTau`; its
 * sources and its amp; the organ's oscillator (its wave changes with the drawbars).
 * @typedef {object} KeysVoice
 * @property {number} note
 * @property {'organ' | 'piano'} engine
 * @property {boolean} gate its key is down
 * @property {boolean} held the sustain pedal holds it, its key let go
 * @property {number} started
 * @property {number} end
 * @property {number} t0
 * @property {number} peak
 * @property {number} tau
 * @property {number} rel
 * @property {number} relFrom
 * @property {number} relTau
 * @property {AudioScheduledSourceNode[]} sources
 * @property {GainNode} amp
 * @property {OscillatorNode | null} wave
 */

/**
 * The organ's: where its notes go in, its clicks' band, the scanner (how far it sways, how much of
 * its copy and of what went in), the drive, the rotary speaker (what passes it by, what goes through
 * it, how fast its horn and its drum go round: FAST's speed, and with ROTARY's in it, kept from slow
 * to fast; their turning) and its level; the drawbars' wave now, and their steps.
 * @typedef {object} OrganGraph
 * @property {GainNode} bus
 * @property {BiquadFilterNode} clicks
 * @property {GainNode} depth
 * @property {GainNode} dry
 * @property {GainNode} wet
 * @property {GainNode} pre
 * @property {GainNode} post
 * @property {GainNode} straight
 * @property {GainNode} turning
 * @property {ConstantSourceNode} speed FAST's: SLOW_SPEED slow, 1 fast
 * @property {WaveShaperNode} speedIn where FAST's speed and ROTARY's modulation go in together
 * @property {Record<'horn' | 'drum', OscillatorNode>} rotors
 * @property {GainNode} level
 * @property {PeriodicWave} wave
 * @property {string} steps
 */

/**
 * The piano's: where its notes go in, the tremolo (each side's gain, its oscillator, how far it moves
 * each side) and its level.
 * @typedef {object} PianoGraph
 * @property {GainNode} bus
 * @property {GainNode[]} sides
 * @property {OscillatorNode} lfo
 * @property {GainNode[]} depths
 * @property {GainNode} level
 */

/**
 * A voice's amp where it is at time t: an organ's up towards its peak, a piano's up its attack and
 * then dying away; let go, from where it was then towards nothing.
 * @param {KeysVoice} v
 * @param {number} t
 */
export function ampAt(v, t) {
  if (t >= v.rel) return v.relFrom * Math.exp(-(t - v.rel) / v.relTau);
  if (t <= v.t0) return 0;
  if (v.engine === 'organ') return v.peak * (1 - Math.exp(-(t - v.t0) / v.tau));
  const top = v.t0 + PIANO_ATTACK;
  if (t < top) return (v.peak * (t - v.t0)) / PIANO_ATTACK;
  return v.peak * Math.exp(-(t - top) / v.tau);
}

export class Keys {
  /**
   * @param {Sound} sound
   * @param {{ storage?: Store | null, key?: string, random?: () => number }} [o] where its settings are kept (localStorage), and the dice for where in the noise a click starts
   */
  constructor(sound, { storage = pageStorage(), key = 'keys', random = Math.random } = {}) {
    this.sound = sound;
    /** @type {KeysKnobs} */
    this.knobs = { ...DEFAULT_KEYS };
    /** @type {Record<KeysSwitch, boolean>} */
    this.switches = { ...DEFAULT_SWITCHES };
    /** What the keys play. @type {KeysChoice} */
    this.choice = 'organ';
    /** How many octaves from middle C the computer's keys play (KEYS_OCTAVES). */
    this.octave = 0;
    /** The notes whose keys are down now, from anywhere (the keys, the card, a MIDI keyboard). @type {Set<number>} */
    this.down = new Set();
    /** The sustain pedal is down (a MIDI keyboard's, or the SUSTAIN button). */
    this.sustain = false;
    /** When the keys down change (to show them). */
    this.onNotes = () => {};
    /**
     * Its notes out (its NOTES jack): each note as its key goes down, `velocity` 0…1 hard, and as it
     * ends (its key let go with the pedal up, or the pedal let go), null; `tap` for a note played for a
     * moment (tap), where that is played otherwise (the synth's arpeggiator holding its chord).
     * @type {(note: number, velocity: number | null, tap?: boolean) => void}
     */
    this.onNoteOut = () => {};
    /** What is plugged into ROTARY (setInput): a modulation, else null. @type {AudioNode | null} */
    this.input = null;
    /** @private the notes gone out and not ended yet @type {Set<number>} */
    this._sent = new Set();
    /** @private the note noteOn is about to play is a tap (tap's, for onNoteOut) */
    this._tapping = false;
    /** @private @type {KeysVoice[]} */
    this._voices = [];
    /** @private notes played for a moment, and when each is let go @type {Map<number, ReturnType<typeof setTimeout>>} */
    this._taps = new Map();
    /** @private @type {OrganGraph | null} */
    this._organ = null;
    /** @private @type {PianoGraph | null} */
    this._piano = null;
    /** @private both sounds, into the mixer's channel @type {GainNode | null} */
    this._out = null;
    /** @private */
    this._random = random;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** @private @type {ReturnType<typeof setTimeout> | undefined} */
    this._saving = undefined;
    this._load();
  }

  /** Whether the organ plays (alone or with the piano). */
  get organOn() {
    return this.choice !== 'epiano';
  }

  /** Whether the electric piano plays. */
  get pianoOn() {
    return this.choice !== 'organ';
  }

  /** The sound, in words. */
  get name() {
    return this.choice === 'both' ? 'Organ and electric piano' : KEYS_SOUNDS.find((s) => s.id === this.choice)?.name ?? '';
  }

  /** The drawbars as an organist writes them (88 8000 000). */
  get registration() {
    return registration(this.knobs);
  }

  /** Its sound, both sounds', for a cable (its OUT jack; before the mixer's channel): made once there is sound, null before. */
  output() {
    return this._outNode();
  }

  /**
   * A key pressed: its note (MIDI) played, `velocity` 0…1 loud (the piano's; the organ is as loud
   * however hard), waking the sound: whether it is heard (no Web Audio: not).
   * @param {number} note
   * @param {number} [velocity]
   */
  noteOn(note, velocity = 0.8) {
    const tap = this._tapping;
    this._tapping = false;
    if (!Number.isFinite(note)) return false;
    clearTimeout(this._taps.get(note));
    this._taps.delete(note);
    this.down.add(note);
    this.onNotes();
    this._sent.add(note);
    this.onNoteOut(note, clamp(velocity, 0, 1), tap);
    const ctx = this.sound.wake();
    if (!ctx) return false;
    const t = ctx.currentTime;
    this._voices = this._voices.filter((v) => v.end > t);
    let heard = false;
    if (this.organOn) {
      const g = this._buildOrgan();
      if (g) heard = this._organNote(g, note, t);
    }
    if (this.pianoOn) {
      const g = this._buildPiano();
      if (g) heard = this._pianoNote(g, note, clamp(velocity, 0, 1), t) || heard;
    }
    return heard;
  }

  /**
   * A key let go: its note released (with the sustain pedal down, held until the pedal is let go).
   * @param {number} note
   */
  noteOff(note) {
    clearTimeout(this._taps.get(note));
    this._taps.delete(note);
    if (this.down.delete(note)) this.onNotes();
    if (!this.sustain && this._sent.delete(note)) this.onNoteOut(note, null);
    const t = this.sound.ctx?.currentTime;
    if (t === undefined) return;
    for (const voice of this._voices) {
      if (voice.note !== note || !voice.gate) continue;
      voice.gate = false;
      if (voice.engine === 'organ') this._click(t, 0.5);
      if (this.sustain) voice.held = true;
      else this._release(voice, t);
    }
  }

  /**
   * A note played for a moment (a click, the TV's OK), let go `length` seconds later unless its key
   * is pressed or let go first: whether it is heard.
   * @param {number} note
   * @param {number} [velocity]
   * @param {number} [length] seconds
   */
  tap(note, velocity = 0.8, length = 0.35) {
    if (!Number.isFinite(note)) return false;
    this._tapping = true;
    const heard = this.noteOn(note, velocity);
    this._taps.set(note, setTimeout(() => this.noteOff(note), length * 1000));
    return heard;
  }

  /** Every note let go at once, those the pedal holds too (the page put away, the sound changed). */
  allOff() {
    for (const timer of this._taps.values()) clearTimeout(timer);
    this._taps.clear();
    const had = this.down.size > 0;
    this.down.clear();
    if (had) this.onNotes();
    const sent = [...this._sent];
    this._sent.clear();
    for (const note of sent) this.onNoteOut(note, null);
    const t = this.sound.ctx?.currentTime ?? 0;
    for (const voice of this._voices) {
      voice.gate = false;
      voice.held = false;
      this._release(voice, t);
    }
  }

  /** The sustain pedal down, or let go (then the notes it held are released, and end out too). @param {boolean} on */
  setSustain(on) {
    this.sustain = !!on;
    if (this.sustain) return;
    for (const note of [...this._sent]) {
      if (this.down.has(note)) continue;
      this._sent.delete(note);
      this.onNoteOut(note, null);
    }
    const t = this.sound.ctx?.currentTime ?? 0;
    for (const voice of this._voices) {
      if (!voice.held) continue;
      voice.held = false;
      if (!voice.gate) this._release(voice, t);
    }
  }

  /**
   * Sets a knob (0…1; a drawbar's to its nearest eighth), heard at once where it can be (a drawbar,
   * the chorus, the drive, the rotary speaker, the tremolo, a level) and from the next note where it
   * can't (the click, TONE, BARK, DECAY); kept a moment later (a knob turned keeps changing).
   * @param {KeysKnob} id
   * @param {number} value
   */
  setKnob(id, value) {
    if (!IDS.includes(id) || !Number.isFinite(value)) return;
    this.knobs[id] = isDrawbar(id) ? drawbarStep(value) / 8 : clamp(value, 0, 1);
    this._apply(id);
    this._saveSoon();
  }

  /**
   * A switch on or off: the percussion's from the next note, the rotary speaker's at once (its horn
   * and its drum speed up or slow down).
   * @param {KeysSwitch} id
   * @param {boolean} on
   */
  setSwitch(id, on) {
    if (!SWITCHES.includes(id) || this.switches[id] === !!on) return;
    this.switches[id] = !!on;
    if (id === 'rotaryFast') this._speed();
    this._saveSoon();
  }

  /**
   * What is plugged into ROTARY: a modulation (a node in the sound's context: the rack's LFO's out,
   * the synth's LFO or its filter envelope), moving the rotary speaker's speed on from where FAST has
   * it, or nothing; heard at once (the rotors getting there at their pace).
   * @param {AudioNode | null} source
   */
  setInput(source) {
    const to = source ?? null, was = this.input;
    if (to === was) return;
    this.input = to;
    const g = this._organ;
    if (!g) return;
    was?.disconnect(g.speedIn);
    to?.connect(g.speedIn);
  }

  /** What the keys play (KEYS_SOUNDS's ids; another word changes nothing): every note let go first. Whether it is one. @param {string} id */
  choose(id) {
    const s = KEYS_SOUNDS.find((x) => x.id === id);
    if (!s) return false;
    if (s.id === this.choice) return true;
    this.allOff();
    this.choice = s.id;
    this._saveSoon();
    return true;
  }

  /** The octave the computer's keys play in, -2…2 (KEYS_OCTAVES). @param {number} octave */
  setOctave(octave) {
    if (!Number.isFinite(octave)) return;
    this.octave = clamp(Math.round(octave), KEYS_OCTAVES.min, KEYS_OCTAVES.max);
    this._saveSoon();
  }

  /** The knobs, the switches and the sound as they come (the organ). */
  reset() {
    this.choose('organ');
    for (const id of IDS) {
      this.knobs[id] = DEFAULT_KEYS[id];
      this._apply(id);
    }
    for (const id of SWITCHES) this.setSwitch(id, DEFAULT_SWITCHES[id]);
    this._saveSoon();
  }

  /**
   * Room for one more of a sound's notes: past KEYS_VOICES held, the oldest cut short (one whose key
   * is up first).
   * @private
   * @param {'organ' | 'piano'} engine
   * @param {number} t
   */
  _room(engine, t) {
    const mine = this._voices.filter((v) => v.engine === engine && v.rel === Infinity && v.end > t);
    if (mine.length < KEYS_VOICES) return;
    const up = mine.filter((v) => !v.gate);
    const oldest = (up.length ? up : mine).reduce((a, b) => (b.started < a.started ? b : a));
    this._cut(oldest, t);
  }

  /**
   * An organ note started at t, unless its key's note sounds already (pressed from two places, or
   * again while the pedal holds it): its drawbars' wave, the percussion on a phrase's first key, the
   * click. Whether it is heard.
   * @private
   * @param {OrganGraph} g
   * @param {number} note
   * @param {number} t
   */
  _organNote(g, note, t) {
    const ctx = /** @type {AudioContext} */ (this.sound.ctx);
    const same = this._voices.find((v) => v.engine === 'organ' && v.note === note && (v.gate || v.held));
    if (same) {
      same.gate = true;
      same.held = false;
      return true;
    }
    this._room('organ', t);
    // The percussion only on a key pressed while no other of the organ's is (its single trigger).
    const first = !this._voices.some((v) => v.engine === 'organ' && v.gate);
    const hz = noteHz(note), osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.setPeriodicWave(g.wave);
    osc.frequency.value = hz / 2;
    amp.gain.setValueAtTime(0, t);
    amp.gain.setTargetAtTime(ORGAN_GAIN, t, ORGAN_ATTACK);
    osc.connect(amp).connect(g.bus);
    osc.start(t);
    /** @type {AudioScheduledSourceNode[]} */
    const sources = [osc];
    if (this.switches.perc && first) {
      const p = ctx.createOscillator(), pa = ctx.createGain(), tau = this.switches.fast ? PERC.fast : PERC.slow;
      p.frequency.value = hz * (this.switches.third ? 3 : 2);
      pa.gain.setValueAtTime(PERC.level, t);
      pa.gain.setTargetAtTime(0, t, tau);
      p.connect(pa).connect(amp);
      p.start(t);
      p.stop(t + 10 * tau);
      sources.push(p);
    }
    this._click(t, 1);
    this._voices.push({
      note, engine: 'organ', gate: true, held: false, started: t, end: Infinity, t0: t, peak: ORGAN_GAIN, tau: ORGAN_ATTACK,
      rel: Infinity, relFrom: 0, relTau: ORGAN_RELEASE, sources, amp, wave: osc,
    });
    return true;
  }

  /**
   * A key's click at t, `level` of CLICK: a few milliseconds of the noise, from a place of its own.
   * @private
   * @param {number} t
   * @param {number} level
   */
  _click(t, level) {
    const k = clickLevel(this.knobs.click) * level, ctx = this.sound.ctx, noise = this.sound.noise, g = this._organ;
    if (!(k > 0) || !ctx || !noise || !g) return;
    const src = ctx.createBufferSource(), amp = ctx.createGain();
    src.buffer = noise;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(k, t + 0.0005);
    amp.gain.setTargetAtTime(0, t + 0.0005, 0.0012);
    src.connect(amp).connect(g.clicks);
    src.start(t, this._random() * Math.max(0, noise.duration - 0.05));
    src.stop(t + 0.012);
  }

  /**
   * A piano note started at t, `velocity` hard: its key's note struck again cuts the one ringing.
   * Whether it is heard.
   * @private
   * @param {PianoGraph} g
   * @param {number} note
   * @param {number} velocity 0…1
   * @param {number} t
   */
  _pianoNote(g, note, velocity, t) {
    const ctx = /** @type {AudioContext} */ (this.sound.ctx), k = this.knobs;
    for (const v of this._voices) if (v.engine === 'piano' && v.note === note) this._cut(v, t);
    this._room('piano', t);
    const hz = noteHz(note);
    const carrier = ctx.createOscillator(), mod = ctx.createOscillator(), tine = ctx.createOscillator();
    carrier.frequency.value = hz;
    mod.frequency.value = hz;
    tine.frequency.value = hz * TINE;
    const index = ctx.createGain(), ring = ctx.createGain(), amp = ctx.createGain();
    const dev = toneIndex(k.tone) * barkIndex(k.bark, velocity) * hz;
    index.gain.setValueAtTime(dev, t);
    index.gain.setTargetAtTime(dev * INDEX_SUSTAIN, t, INDEX_DECAY);
    ring.gain.setValueAtTime((0.2 + 0.8 * k.tone) * RING * velocity * hz * TINE, t);
    ring.gain.setTargetAtTime(0, t, RING_DECAY);
    const peak = velocityLevel(velocity) * PIANO_GAIN, tau = noteDecay(k.decay, note);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + PIANO_ATTACK);
    amp.gain.setTargetAtTime(0, t + PIANO_ATTACK, tau);
    mod.connect(index).connect(carrier.frequency);
    tine.connect(ring).connect(carrier.frequency);
    carrier.connect(amp).connect(g.bus);
    // Held, it has died away (to a thousandth) by then.
    const end = t + PIANO_ATTACK + 7 * tau, sources = [carrier, mod, tine];
    for (const o of sources) {
      o.start(t);
      o.stop(end);
    }
    this._voices.push({
      note, engine: 'piano', gate: true, held: false, started: t, end, t0: t, peak, tau,
      rel: Infinity, relFrom: 0, relTau: DAMP, sources, amp, wave: null,
    });
    return true;
  }

  /**
   * A voice let go at t: an organ's stops at once, a piano's damper stops it. Nothing if it has
   * been let go already, or has died away.
   * @private
   * @param {KeysVoice} voice
   * @param {number} t
   */
  _release(voice, t) {
    if (voice.rel !== Infinity || voice.end <= t) return;
    this._fade(voice, t, voice.engine === 'organ' ? ORGAN_RELEASE : DAMP, 7);
  }

  /**
   * A voice cut short at t (its key struck again, too many at once): gone within milliseconds.
   * @private
   * @param {KeysVoice} voice
   * @param {number} t
   */
  _cut(voice, t) {
    voice.gate = false;
    voice.held = false;
    if (voice.end <= t || (voice.rel <= t && voice.relTau <= CUT)) return;
    this._fade(voice, t, CUT, CUT_STOP / CUT);
  }

  /**
   * A voice's amp from where it is at t towards nothing by `tau`, its sources stopped `stop` of them
   * later (if sooner than they would have).
   * @private
   * @param {KeysVoice} voice
   * @param {number} t
   * @param {number} tau
   * @param {number} stop
   */
  _fade(voice, t, tau, stop) {
    const from = ampAt(voice, t), p = voice.amp.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(from, t);
    p.setTargetAtTime(0, t, tau);
    voice.rel = t;
    voice.relFrom = from;
    voice.relTau = tau;
    const end = t + stop * tau;
    if (end >= voice.end) return;
    voice.end = end;
    for (const s of voice.sources) {
      try {
        s.stop(end);
      } catch {
        // gone
      }
    }
  }

  /**
   * The rotary speaker switched slow or fast: its speed so from now, its horn and its drum getting
   * there as a real one's do (each at its own pace: its lag's, _buildOrgan).
   * @private
   */
  _speed() {
    const g = this._organ, ctx = this.sound.ctx;
    if (!g || !ctx) return;
    const t = ctx.currentTime, p = g.speed.offset;
    p.cancelScheduledValues(t);
    p.setValueAtTime(this.switches.rotaryFast ? 1 : SLOW_SPEED, t);
  }

  /**
   * A knob heard at once where it can be: eased there (a knob turned), or set (the graph made).
   * @private
   * @param {KeysKnob} id
   * @param {boolean} [ease]
   */
  _apply(id, ease = true) {
    const ctx = this.sound.ctx;
    if (!ctx) return;
    const t = ctx.currentTime, k = this.knobs, o = this._organ, p = this._piano;
    /** @type {(param: AudioParam, v: number) => void} */
    const to = (param, v) => {
      if (!ease) {
        param.value = v;
        return;
      }
      param.cancelScheduledValues(t);
      param.setTargetAtTime(v, t, EASE);
    };
    if (isDrawbar(id)) {
      if (o) this._wave(o);
      return;
    }
    switch (id) {
      case 'chorus': {
        if (!o) break;
        const mix = scannerMix(k.chorus);
        to(o.depth.gain, scannerDepth(k.chorus));
        to(o.dry.gain, 1 - mix);
        to(o.wet.gain, mix);
        break;
      }
      case 'drive': {
        if (!o) break;
        const d = driveGain(k.drive);
        to(o.pre.gain, d / DRIVE_REACH);
        to(o.post.gain, 1 / Math.sqrt(d));
        break;
      }
      case 'rotary':
        if (!o) break;
        to(o.straight.gain, 1 - k.rotary);
        to(o.turning.gain, k.rotary);
        break;
      case 'organLevel':
        if (o) to(o.level.gain, ORGAN_OUT * keysLevel(k.organLevel));
        break;
      case 'tremolo': {
        if (!p) break;
        const half = k.tremolo / 2;
        for (const s of p.sides) to(s.gain, 1 - half);
        to(p.depths[0].gain, half);
        to(p.depths[1].gain, -half);
        break;
      }
      case 'rate':
        if (p) to(p.lfo.frequency, tremoloHz(k.rate));
        break;
      case 'pianoLevel':
        if (p) to(p.level.gain, keysLevel(k.pianoLevel));
        break;
      default:
        break; // the click, TONE, BARK, DECAY: from the next note
    }
  }

  /**
   * The drawbars' wave made again, if their steps changed, and set on every organ note sounding.
   * @private
   * @param {OrganGraph} g
   */
  _wave(g) {
    const steps = this.registration, ctx = this.sound.ctx;
    if (steps === g.steps || !ctx) return;
    const { real, imag } = drawbarWave(this.knobs);
    g.wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    g.steps = steps;
    for (const v of this._voices) if (v.wave && v.end > ctx.currentTime) v.wave.setPeriodicWave(g.wave);
  }

  /**
   * Both sounds' way into the mixer, made once there is sound; null before.
   * @private
   */
  _outNode() {
    if (this._out) return this._out;
    const ctx = this.sound.ctx, channel = this.sound.channel('keys');
    if (!ctx || !channel) return null;
    this._out = ctx.createGain();
    this._out.connect(channel);
    return this._out;
  }

  /**
   * The organ's sound after its notes, made the first time it plays once the sound has woken: the
   * graph, or null where there is no sound.
   * @private
   */
  _buildOrgan() {
    if (this._organ) return this._organ;
    const ctx = this.sound.ctx, out = this._outNode();
    if (!ctx || !out) return null;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    // The clicks: noise through a band around 3 kHz, in with the notes.
    const clicks = ctx.createBiquadFilter();
    clicks.type = 'bandpass';
    clicks.frequency.value = 3200;
    clicks.Q.value = 0.7;
    clicks.connect(bus);
    // The scanner: a short delay swaying (a triangle, as its capacitors are scanned), beside what
    // went in; then the drive.
    const scanner = ctx.createDelay(0.01), sway = ctx.createOscillator(), depth = ctx.createGain();
    scanner.delayTime.value = SCANNER.base;
    sway.type = 'triangle';
    sway.frequency.value = SCANNER.hz;
    sway.start(t);
    sway.connect(depth).connect(scanner.delayTime);
    const dry = ctx.createGain(), wet = ctx.createGain();
    const pre = ctx.createGain(), clip = ctx.createWaveShaper(), post = ctx.createGain();
    clip.curve = tanhCurve(DRIVE_REACH);
    clip.oversample = 'none';
    bus.connect(dry).connect(pre);
    bus.connect(scanner).connect(wet).connect(pre);
    pre.connect(clip).connect(post);
    // The rotary speaker: what passes it by, to both sides; what goes through it, split between the
    // horn and the drum, each heard on a side through a delay that is shortest, and as loud as it
    // gets, as it faces that side (a side's the other's turned over).
    const sides = ctx.createChannelMerger(2), straight = ctx.createGain(), turning = ctx.createGain();
    post.connect(straight);
    straight.connect(sides, 0, 0);
    straight.connect(sides, 0, 1);
    post.connect(turning);
    // How fast they go round: FAST's speed (SLOW_SPEED slow, 1 fast) and what ROTARY's cable brings,
    // together kept from slow to fast; each rotor following it at its own pace (a lag of one pole, its
    // time constant its `ramp`: the drum, heavier, slower), from its slow speed up to its fast. A lag
    // starts at rest, so it follows how far the speed goes from FAST's now (`from`, taken off it): the
    // rotors start at that speed, not spinning up to it.
    const s = this.switches.rotaryFast ? 1 : SLOW_SPEED;
    const speed = ctx.createConstantSource(), speedIn = ctx.createWaveShaper(), from = ctx.createConstantSource();
    speed.offset.value = s;
    speedIn.curve = SPEED_CURVE;
    speed.connect(speedIn);
    this.input?.connect(speedIn);
    speed.start(t);
    from.offset.value = -s;
    from.start(t);
    /** @type {Partial<Record<'horn' | 'drum', OscillatorNode>>} */
    const rotors = {};
    for (const name of /** @type {const} */ (['horn', 'drum'])) {
      const R = ROTORS[name], split = ctx.createBiquadFilter(), rotor = ctx.createOscillator();
      const a = Math.exp(-1 / (R.ramp * ctx.sampleRate)), lag = ctx.createIIRFilter([1 - a], [1, -a]), span = ctx.createGain();
      rotor.frequency.value = R.slow + (R.fast - R.slow) * s;
      span.gain.value = R.fast - R.slow;
      speedIn.connect(lag).connect(span).connect(rotor.frequency);
      from.connect(lag);
      split.type = name === 'horn' ? 'highpass' : 'lowpass';
      split.frequency.value = CROSSOVER;
      split.Q.value = 0.5;
      turning.connect(split);
      [1, -1].forEach((facing, side) => {
        const doppler = ctx.createDelay(0.01), swayBy = ctx.createGain(), g = ctx.createGain(), am = ctx.createGain();
        doppler.delayTime.value = ROTOR_DELAY;
        swayBy.gain.value = -facing * R.sway;
        rotor.connect(swayBy).connect(doppler.delayTime);
        g.gain.value = 1 - R.am;
        am.gain.value = facing * R.am;
        rotor.connect(am).connect(g.gain);
        split.connect(doppler).connect(g).connect(sides, 0, side);
      });
      rotor.start(t);
      rotors[name] = rotor;
    }
    const level = ctx.createGain();
    sides.connect(level).connect(out);
    const { real, imag } = drawbarWave(this.knobs);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: true });
    this._organ = {
      bus, clicks, depth, dry, wet, pre, post, straight, turning, speed, speedIn,
      rotors: /** @type {Record<'horn' | 'drum', OscillatorNode>} */ (rotors), level, wave, steps: this.registration,
    };
    for (const id of LIVE.organ) this._apply(id, false);
    return this._organ;
  }

  /**
   * The piano's sound after its notes, made the first time it plays once the sound has woken: the
   * tremolo (one side as loud as the other is soft) and its level. The graph, or null.
   * @private
   */
  _buildPiano() {
    if (this._piano) return this._piano;
    const ctx = this.sound.ctx, out = this._outNode();
    if (!ctx || !out) return null;
    const bus = ctx.createGain(), merger = ctx.createChannelMerger(2), lfo = ctx.createOscillator();
    lfo.start(ctx.currentTime);
    const sides = [ctx.createGain(), ctx.createGain()], depths = [ctx.createGain(), ctx.createGain()];
    sides.forEach((g, side) => {
      bus.connect(g).connect(merger, 0, side);
      lfo.connect(depths[side]).connect(g.gain);
    });
    const level = ctx.createGain();
    merger.connect(level).connect(out);
    this._piano = { bus, sides, lfo, depths, level };
    for (const id of LIVE.piano) this._apply(id, false);
    return this._piano;
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (!s || typeof s !== 'object') return;
      for (const id of IDS) {
        const v = s.knobs?.[id];
        if (Number.isFinite(v)) this.knobs[id] = isDrawbar(id) ? drawbarStep(v) / 8 : clamp(v, 0, 1);
      }
      for (const id of SWITCHES) if (typeof s.switches?.[id] === 'boolean') this.switches[id] = s.switches[id];
      if (KEYS_SOUNDS.some((x) => x.id === s.choice)) this.choice = s.choice;
      if (Number.isFinite(s.octave)) this.octave = clamp(Math.round(s.octave), KEYS_OCTAVES.min, KEYS_OCTAVES.max);
    } catch {
      // none kept, or not readable: as it comes
    }
  }

  /** @private */
  _saveSoon() {
    clearTimeout(this._saving);
    this._saving = setTimeout(() => this.save(), 400);
  }

  /** Keeps the knobs, the switches, the sound and the octave now (localStorage). */
  save() {
    clearTimeout(this._saving);
    try {
      this._storage?.setItem(this._key, JSON.stringify({ knobs: this.knobs, switches: this.switches, choice: this.choice, octave: this.octave }));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
