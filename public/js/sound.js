// The room's sound: one AudioContext for every instrument, made (or woken) by the visitor's presses,
// as browsers allow sound only after one, and the mixer the instruments play into: a channel each,
// the volume and mute over them all, and a soft clipper, so that many hits at once bend rather than
// crackle (a WaveShaper, which adds no delay, where a compressor would wait on its look-ahead). A
// note played live starts in the event that plays it (a key, a press, a stick on a pad, a MIDI
// note) at the context's current time: nothing waits for a scheduler, so the time from the hit to
// the sound is the device's own output latency (latencyHint 'interactive'). The clock's notes are
// set a little ahead instead, each at its step's time. Each instrument hands its notes to add(): of
// two notes on one circuit (a drum's), the later cuts the earlier short when it starts, and past
// MAX_NOTES the oldest is cut. The volume and mute are kept for the next visit (localStorage).

/** How many notes sound at once, at most: past it the oldest is cut short. */
export const MAX_NOTES = 32;

/**
 * A note sounding, or set to (drums.js playDrum's): when it starts and when it will have died away,
 * its own gain (to cut it short with) and that gain's level, and its sources.
 * @typedef {object} Note
 * @property {number} start
 * @property {number} end
 * @property {GainNode} out
 * @property {number} level
 * @property {AudioScheduledSourceNode[]} sources
 */

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} Store */

/** @type {(v: number, lo: number, hi: number) => number} */
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The page's localStorage, or null where it is blocked (a private window, site data refused).
 * @returns {Store | null}
 */
export function pageStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * The page's Web Audio (webkit's on older Safari), or null.
 * @returns {typeof AudioContext | null}
 */
function pageContext() {
  const g = /** @type {{ AudioContext?: typeof AudioContext, webkitAudioContext?: typeof AudioContext }} */ (globalThis);
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/**
 * The soft clipper's curve: straight through up to ±knee, then bending smoothly towards ±1, for an
 * input of up to ±2 (the curve's ends; the master gain halves the signal into it, masterGain).
 * @param {number} [n] points
 * @param {number} [knee]
 */
export function clipCurve(n = 2049, knee = 0.6) {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = 2 * ((2 * i) / (n - 1) - 1);
    const m = Math.abs(x);
    curve[i] = Math.sign(x) * (m <= knee ? m : knee + (1 - knee) * Math.tanh((m - knee) / (1 - knee)));
  }
  return curve;
}

/**
 * The master gain for a volume (0…1) and mute: the volume's square (the ear hears that about
 * evenly), halved into the clipper.
 * @param {number} volume
 * @param {boolean} muted
 */
export const masterGain = (volume, muted) => (muted ? 0 : 0.5 * volume * volume);

/**
 * Cuts a note short at `at`: its gain down to nothing within a few milliseconds (no click), and its
 * sources stopped just after.
 * @param {Note} note
 * @param {number} at
 */
export function cut(note, at) {
  if (note.end <= at) return;
  const g = note.out.gain;
  g.cancelScheduledValues(at);
  g.setValueAtTime(note.level, at);
  g.setTargetAtTime(0, at, 0.003);
  for (const s of note.sources) {
    try {
      s.stop(at + 0.02);
    } catch {
      // never started, or gone
    }
  }
  note.end = at + 0.02;
}

export class Sound {
  /**
   * @param {object} [o]
   * @param {typeof AudioContext | null} [o.Context] the page's Web Audio
   * @param {Store | null} [o.storage] where the volume and mute are kept (the page's localStorage)
   * @param {string} [o.key] the key they are kept under
   */
  constructor({ Context = pageContext(), storage = pageStorage(), key = 'sound' } = {}) {
    /** @private */
    this._Context = Context;
    /** @private */
    this._storage = storage;
    /** @private */
    this._key = key;
    /** The context, once a press has woken the sound; null before, and without Web Audio. @type {AudioContext | null} */
    this.ctx = null;
    /** A second of white noise for every instrument that needs some, made with the context. @type {AudioBuffer | null} */
    this.noise = null;
    /** The volume over every instrument, 0…1. */
    this.volume = 0.8;
    this.muted = false;
    /** @private @type {GainNode | null} */
    this._master = null;
    /** @private @type {Map<string, GainNode>} */
    this._channels = new Map();
    /** @private @type {{ note: Note, group: string }[]} */
    this._notes = [];
    /** Once the sound has woken for the first time, its graph made (to plug in what is patched). */
    this.onReady = () => {};
    this._load();
  }

  /** Whether the page can make sound at all: it has Web Audio. */
  get supported() {
    return this._Context !== null;
  }

  /**
   * Makes the context, or wakes it (browsers allow sound only after a press, so every press calls
   * this, and so does every note): the context, or null without Web Audio.
   */
  wake() {
    if (!this._Context) return null;
    if (!this.ctx) {
      // An instrument is heard with an iPhone's ring switch on silent too, as its music apps are
      // (Safari's audio session; elsewhere there is none).
      const session = /** @type {{ audioSession?: { type: string } }} */ (globalThis.navigator ?? {}).audioSession;
      try {
        if (session) session.type = 'playback';
      } catch {
        // a session that won't: Safari's own way, then
      }
      try {
        this.ctx = new this._Context({ latencyHint: 'interactive' });
      } catch (err) {
        console.info(`sound: no audio here (${err instanceof Error ? err.message : err})`);
        this._Context = null;
        return null;
      }
      this._build(this.ctx);
      this.onReady();
    }
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Lets the sound sleep (the page put away): the next press wakes it. */
  sleep() {
    if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
  }

  /**
   * The master gain into the clipper into the speakers, and the noise.
   * @private
   * @param {AudioContext} ctx
   */
  _build(ctx) {
    const master = ctx.createGain();
    master.gain.value = masterGain(this.volume, this.muted);
    const clip = ctx.createWaveShaper();
    clip.curve = clipCurve();
    clip.oversample = 'none'; // no delay
    master.connect(clip).connect(ctx.destination);
    this._master = master;
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = noise;
  }

  /**
   * An instrument's channel into the mixer, made the first time it is asked for; null before the
   * sound has woken.
   * @param {string} name
   */
  channel(name) {
    let g = this._channels.get(name) ?? null;
    if (!g && this.ctx && this._master) {
      g = this.ctx.createGain();
      g.connect(this._master);
      this._channels.set(name, g);
    }
    return g;
  }

  /**
   * Keeps a note that has started, or is set to: a note of its group that starts before it is cut
   * short when it starts, and one that starts after it (the clock's, set ahead) cuts it short then;
   * past MAX_NOTES the oldest is cut when it starts.
   * @param {Note} note
   * @param {string} group
   */
  add(note, group) {
    const now = this.ctx?.currentTime ?? 0;
    const at = Math.max(note.start, now);
    this._notes = this._notes.filter((n) => {
      if (n.note.end <= now) return false;
      if (n.group !== group) return true;
      if (n.note.start <= note.start) {
        cut(n.note, at);
        return false;
      }
      cut(note, n.note.start);
      return true;
    });
    while (this._notes.length >= MAX_NOTES) {
      const oldest = this._notes.shift();
      if (oldest) cut(oldest.note, at);
    }
    this._notes.push({ note, group });
  }

  /** How many notes are sounding now. */
  get sounding() {
    const now = this.ctx?.currentTime ?? 0;
    return this._notes.filter((n) => n.note.end > now).length;
  }

  /** @param {number} volume 0…1 */
  setVolume(volume) {
    this.volume = Number.isFinite(volume) ? clamp(volume, 0, 1) : this.volume;
    this._apply();
    this._save();
  }

  /** @param {boolean} muted */
  setMuted(muted) {
    this.muted = !!muted;
    this._apply();
    this._save();
  }

  /**
   * The master gain to the volume and mute, eased over a few hundredths of a second (no click).
   * @private
   */
  _apply() {
    if (!this.ctx || !this._master) return;
    const g = this._master.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(masterGain(this.volume, this.muted), now, 0.015);
  }

  /** @private */
  _load() {
    try {
      const s = JSON.parse(this._storage?.getItem(this._key) ?? 'null');
      if (Number.isFinite(s?.volume)) this.volume = clamp(s.volume, 0, 1);
      if (typeof s?.muted === 'boolean') this.muted = s.muted;
    } catch {
      // none kept, or not readable: as they come
    }
  }

  /** @private */
  _save() {
    try {
      this._storage?.setItem(this._key, JSON.stringify({ volume: this.volume, muted: this.muted }));
    } catch {
      // storage full or blocked: they last this visit
    }
  }
}
