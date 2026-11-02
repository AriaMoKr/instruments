// Just enough of Web Audio for sound.js, drums.js, delay.js, synth.js and keys.js in Node: nodes that
// keep what they are connected to (and let go of one, refusing one they aren't connected to, or of
// all), params that keep their automation and refuse what a browser would (a time, a value or a time
// constant that isn't finite, an exponential ramp to 0, a negative time constant), sources that keep
// when they start and stop (and refuse a second start, or a stop before one), delays that refuse a
// longest time a browser wouldn't make, a merger that refuses an input it hasn't, periodic waves that
// refuse terms a browser would (of two lengths, fewer than two, or not finite), and IIR filters that
// keep their coefficients and refuse those a browser would (none or more than 20, not finite, a
// feedforward all 0, a first feedback of 0). A test sets the context's currentTime itself.

class Param {
  constructor(value) {
    this.value = value;
    this.automationRate = 'a-rate';
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

  connect(node, output = 0, input = 0) {
    if (node.kind === 'merger' && !(input >= 0 && input < node.numberOfInputs)) throw new RangeError(`connect: the merger has no input ${input}`);
    this.outputs.push(node);
    return node;
  }

  disconnect(node) {
    if (node !== undefined && !this.outputs.includes(node)) throw new Error(`disconnect: the ${this.kind} isn't connected to that ${node.kind}`);
    this.outputs = node === undefined ? [] : this.outputs.filter((o) => o !== node);
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

/** A PeriodicWave: its terms as given, and whether it is left as loud as they make it. */
class Wave {
  constructor(real, imag, { disableNormalization = false } = {}) {
    this.real = Float32Array.from(real);
    this.imag = Float32Array.from(imag);
    this.normalized = !disableNormalization;
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
    n.wave = null;
    n.setPeriodicWave = (wave) => {
      if (!(wave instanceof Wave)) throw new TypeError('setPeriodicWave: not a PeriodicWave');
      n.type = 'custom';
      n.wave = wave;
    };
    return n;
  }

  createPeriodicWave(real, imag, constraints = {}) {
    if (real.length !== imag.length || real.length < 2) throw new RangeError(`createPeriodicWave: lengths ${real.length} and ${imag.length}`);
    for (const x of [...real, ...imag]) if (!Number.isFinite(x)) throw new TypeError(`createPeriodicWave: ${x} is not finite`);
    return new Wave(real, imag, constraints);
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
    n.detune = new Param(0);
    n.Q = new Param(1);
    n.gain = new Param(0);
    return n;
  }

  createConstantSource() {
    const n = new Source(this, 'constant');
    n.offset = new Param(1);
    return n;
  }

  createChannelMerger(inputs = 6) {
    if (!(inputs >= 1 && inputs <= 32)) throw new RangeError(`createChannelMerger(${inputs})`);
    const n = new Node(this, 'merger');
    n.numberOfInputs = inputs;
    return n;
  }

  createDelay(max = 1) {
    if (!(max > 0 && max < 180)) throw new RangeError(`createDelay(${max})`);
    const n = new Node(this, 'delay');
    n.maxDelayTime = max;
    n.delayTime = new Param(0);
    return n;
  }

  createWaveShaper() {
    const n = new Node(this, 'shaper');
    n.curve = null;
    n.oversample = 'none';
    return n;
  }

  createIIRFilter(feedforward, feedback) {
    const ff = Array.from(feedforward), fb = Array.from(feedback);
    for (const c of [ff, fb]) if (!(c.length >= 1 && c.length <= 20)) throw new RangeError(`createIIRFilter: ${c.length} coefficients`);
    for (const x of [...ff, ...fb]) if (!Number.isFinite(x)) throw new TypeError(`createIIRFilter: ${x} is not finite`);
    if (ff.every((x) => x === 0)) throw new Error('createIIRFilter: the feedforward is all 0');
    if (fb[0] === 0) throw new Error('createIIRFilter: the first feedback is 0');
    const n = new Node(this, 'iir');
    n.feedforward = ff;
    n.feedback = fb;
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
