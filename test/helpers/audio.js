// Just enough of Web Audio for sound.js and drums.js in Node: nodes that keep what they are
// connected to, params that keep their automation and refuse what a browser would (a time, a value
// or a time constant that isn't finite, an exponential ramp to 0, a negative time constant),
// sources that keep when they start and stop (and refuse a second start, or a stop before one).
// A test sets the context's currentTime itself.

class Param {
  constructor(value) {
    this.value = value;
    /** [kind, value, time, timeConstant?] in the order set */
    this.events = [];
  }

  _check(name, ...xs) {
    for (const x of xs) if (!Number.isFinite(x)) throw new TypeError(`${name}: ${x} is not finite`);
  }

  setValueAtTime(v, t) {
    this._check('setValueAtTime', v, t);
    this.events.push(['set', v, t]);
    return this;
  }

  linearRampToValueAtTime(v, t) {
    this._check('linearRampToValueAtTime', v, t);
    this.events.push(['linear', v, t]);
    return this;
  }

  exponentialRampToValueAtTime(v, t) {
    this._check('exponentialRampToValueAtTime', v, t);
    if (v === 0) throw new RangeError('exponentialRampToValueAtTime: 0');
    this.events.push(['exponential', v, t]);
    return this;
  }

  setTargetAtTime(v, t, c) {
    this._check('setTargetAtTime', v, t, c);
    if (c < 0) throw new RangeError(`setTargetAtTime: time constant ${c}`);
    this.events.push(['target', v, t, c]);
    return this;
  }

  cancelScheduledValues(t) {
    this._check('cancelScheduledValues', t);
    this.events = this.events.filter((e) => e[2] < t);
    this.events.push(['cancel', 0, t]);
    return this;
  }
}

class Node {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.outputs = [];
    context.nodes.push(this);
  }

  connect(node) {
    this.outputs.push(node);
    return node;
  }

  disconnect() {
    this.outputs = [];
  }
}

class Source extends Node {
  start(t = 0, offset = 0) {
    if (this.started !== undefined) throw new Error(`${this.kind}: started twice`);
    if (!Number.isFinite(t) || !Number.isFinite(offset) || t < 0) throw new RangeError(`${this.kind}: start(${t}, ${offset})`);
    this.started = t;
  }

  stop(t = 0) {
    if (this.started === undefined) throw new Error(`${this.kind}: stopped before it started`);
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`${this.kind}: stop(${t})`);
    this.stopped = t;
  }
}

export class FakeContext {
  /** @param {AudioContextOptions} [options] */
  constructor(options = {}) {
    this.options = options;
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = 'suspended';
    this.nodes = [];
    this.destination = new Node(this, 'destination');
    FakeContext.made.push(this);
  }

  createGain() {
    const n = new Node(this, 'gain');
    n.gain = new Param(1);
    return n;
  }

  createOscillator() {
    const n = new Source(this, 'oscillator');
    n.type = 'sine';
    n.frequency = new Param(440);
    n.detune = new Param(0);
    return n;
  }

  createBufferSource() {
    const n = new Source(this, 'buffer');
    n.buffer = null;
    n.loop = false;
    n.playbackRate = new Param(1);
    return n;
  }

  createBiquadFilter() {
    const n = new Node(this, 'filter');
    n.type = 'lowpass';
    n.frequency = new Param(350);
    n.Q = new Param(1);
    n.gain = new Param(0);
    return n;
  }

  createWaveShaper() {
    const n = new Node(this, 'shaper');
    n.curve = null;
    n.oversample = 'none';
    return n;
  }

  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (c) => data[c] };
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  /** The nodes of a kind made so far. */
  all(kind) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}
/** Every context made, newest last. @type {FakeContext[]} */
FakeContext.made = [];

/** A localStorage that keeps strings in a Map, and can be made to refuse. */
export function memoryStorage(entries = {}) {
  const m = new Map(Object.entries(entries));
  return {
    map: m,
    refuse: false,
    getItem(k) {
      return m.has(k) ? m.get(k) : null;
    },
    setItem(k, v) {
      if (this.refuse) throw new Error('QuotaExceededError');
      m.set(k, String(v));
    },
  };
}
