// The room's sound (sound.js): one context, made at the first press and woken by the next, the
// mixer (a channel each, the volume and mute over them, the soft clipper), the notes kept and cut
// short, and the volume and mute kept for the next visit. On test/helpers/audio.js's fake Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_NOTES, Sound, clipCurve, cut, masterGain } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

/** A note as playDrum makes one: a gain into `out`, a source started at `at`, ending at `end`. */
function note(ctx, out, at, end) {
  const g = ctx.createGain();
  g.connect(out);
  const s = ctx.createOscillator();
  s.start(at);
  s.stop(end);
  return { start: at, end, out: g, level: 0.5, sources: [s] };
}

test('without Web Audio there is no sound, and nothing breaks', () => {
  const sound = new Sound({ Context: null, storage: null });
  assert.equal(sound.supported, false);
  assert.equal(sound.wake(), null);
  assert.equal(sound.channel('drums'), null);
  sound.setVolume(0.3);
  sound.setMuted(true);
  sound.sleep();
  assert.deepEqual([sound.volume, sound.muted, sound.sounding], [0.3, true, 0]);
  // A context the browser won't make (too many open): none, and no more tries.
  class Refusing {
    constructor() {
      throw new Error('too many');
    }
  }
  const refused = new Sound({ Context: /** @type {any} */ (Refusing), storage: null });
  const info = console.info;
  console.info = () => {};
  try {
    assert.equal(refused.wake(), null);
  } finally {
    console.info = info;
  }
  assert.equal(refused.supported, false);
});

test('the first wake makes one context, for low latency, into the clipper; the next ones wake it', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  assert.equal(sound.ctx, null, 'nothing until a press');
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  assert.ok(ctx instanceof FakeContext);
  assert.deepEqual(ctx.options, { latencyHint: 'interactive' });
  assert.equal(ctx.state, 'running', 'resumed');
  const [master] = ctx.all('gain'), [clip] = ctx.all('shaper');
  assert.deepEqual([master.outputs, clip.outputs], [[clip], [ctx.destination]]);
  assert.equal(clip.oversample, 'none', 'no delay');
  assert.equal(master.gain.value, masterGain(0.8, false));
  assert.equal(sound.noise?.duration, 1);
  assert.ok(sound.noise.getChannelData(0).some((x) => x !== 0), 'noise');
  // Put away, then woken by the next press: the same context.
  sound.sleep();
  assert.equal(ctx.state, 'suspended');
  assert.equal(sound.wake(), ctx);
  assert.equal(ctx.state, 'running');
  assert.equal(FakeContext.made.at(-1), ctx);
  // A channel: made once, into the master.
  const drums = sound.channel('drums');
  assert.equal(sound.channel('drums'), drums);
  assert.deepEqual(drums.outputs, [master]);
  assert.notEqual(sound.channel('keys'), drums);
});

test('once its graph is made, the first wake says so, and only the first', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  let ready = 0;
  sound.onReady = () => {
    ready++;
    assert.ok(sound.channel('drums'), 'a channel can be had by then');
  };
  sound.wake();
  sound.sleep();
  sound.wake();
  assert.equal(ready, 1);
});

test('the volume is heard as its square, halved into the clipper; mute is silence', () => {
  assert.equal(masterGain(1, false), 0.5);
  assert.equal(masterGain(0.5, false), 0.125);
  assert.equal(masterGain(0, false), 0);
  assert.equal(masterGain(1, true), 0);
});

test('the clipper: straight up to the knee, then bending towards ±1, odd, never past it', () => {
  const n = 2049, knee = 0.6, curve = clipCurve(n, knee);
  const at = (x) => curve[Math.round(((x / 2 + 1) / 2) * (n - 1))];
  assert.equal(curve.length, n);
  assert.equal(at(0), 0);
  for (const x of [0.1, 0.3, 0.59]) assert.ok(Math.abs(at(x) - x) < 0.002, `${x}: ${at(x)}`);
  for (let i = 1; i < n; i++) assert.ok(curve[i] >= curve[i - 1], 'rising');
  for (let i = 0; i < n; i++) assert.ok(Math.abs(curve[i] + curve[n - 1 - i]) < 1e-6, 'odd');
  assert.ok(curve[n - 1] < 1 && curve[n - 1] > 0.95, `${curve[n - 1]}`);
});

test('the volume and mute: eased in, and kept for the next visit; what was kept, read back', () => {
  const storage = memoryStorage();
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage, key: 'room.sound' });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const master = ctx.all('gain')[0];
  ctx.currentTime = 2;
  sound.setVolume(0.5);
  assert.deepEqual(master.gain.events.at(-1), ['target', masterGain(0.5, false), 2, 0.015], 'no click');
  sound.setMuted(true);
  assert.deepEqual(master.gain.events.at(-1), ['target', 0, 2, 0.015]);
  sound.setVolume(7);
  assert.equal(sound.volume, 1, 'kept to 0…1');
  sound.setVolume(NaN);
  assert.equal(sound.volume, 1, 'nonsense ignored');
  assert.deepEqual(JSON.parse(storage.map.get('room.sound')), { volume: 1, muted: true });
  const next = new Sound({ Context: /** @type {any} */ (FakeContext), storage, key: 'room.sound' });
  assert.deepEqual([next.volume, next.muted], [1, true]);
  // Its master starts there.
  const nextCtx = /** @type {FakeContext} */ (/** @type {unknown} */ (next.wake()));
  assert.equal(nextCtx.all('gain')[0].gain.value, 0);
  // Something else under the key, or nothing readable: as it comes.
  for (const kept of ['{"volume":"loud","muted":1}', 'not json']) {
    const s = new Sound({ Context: null, storage: memoryStorage({ 'room.sound': kept }), key: 'room.sound' });
    assert.deepEqual([s.volume, s.muted], [0.8, false], kept);
  }
  // Storage that refuses: the setting lasts this visit.
  const full = memoryStorage();
  full.refuse = true;
  const s = new Sound({ Context: null, storage: full });
  s.setVolume(0.2);
  assert.equal(s.volume, 0.2);
});

test('a note cut short: its gain down within a few milliseconds from where it was, its sources stopped just after', () => {
  const ctx = new FakeContext();
  const n = note(ctx, ctx.destination, 1, 3);
  cut(n, 1.5);
  assert.deepEqual(n.out.gain.events.slice(-3), [['cancel', 0, 1.5], ['set', 0.5, 1.5], ['target', 0, 1.5, 0.003]]);
  assert.equal(n.sources[0].stopped, 1.52);
  assert.equal(n.end, 1.52);
  // One that has already died away is left alone.
  const gone = note(ctx, ctx.destination, 0, 1);
  cut(gone, 2);
  assert.deepEqual([gone.out.gain.events, gone.sources[0].stopped], [[], 1]);
});

test("the clock's notes, set ahead: of two on one circuit the later cuts the earlier when it starts, whichever came first", () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const out = sound.channel('drums');
  ctx.currentTime = 1;
  // An open hat set for 1.05, then a closed one for 1.15: the open rings until the closed starts.
  const open = note(ctx, out, 1.05, 2), closed = note(ctx, out, 1.15, 1.25);
  sound.add(open, 'hat');
  sound.add(closed, 'hat');
  assert.equal(open.end, 1.17, 'cut when the closed one starts, not now');
  assert.deepEqual(open.out.gain.events.slice(-2), [['set', 0.5, 1.15], ['target', 0, 1.15, 0.003]]);
  // A hat played now, before one already set for later: it rings until that one starts, which stays.
  ctx.currentTime = 1.3;
  const later = note(ctx, out, 1.4, 2.4), now = note(ctx, out, 1.3, 2.3);
  sound.add(later, 'hat');
  sound.add(now, 'hat');
  assert.equal(now.end, 1.42, 'cut by the one set after it');
  assert.equal(later.end, 2.4, 'the one set later rings on');
  assert.equal(sound.sounding, 2);
});

test("the notes: a group's last is cut when the next starts, the oldest past MAX_NOTES, the ended let go", () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const out = sound.channel('drums');
  const kick = note(ctx, out, 0, 1), snare = note(ctx, out, 0, 1);
  sound.add(kick, 'kick');
  sound.add(snare, 'snare');
  assert.equal(sound.sounding, 2);
  ctx.currentTime = 0.25;
  const kick2 = note(ctx, out, 0.25, 1.25);
  sound.add(kick2, 'kick');
  assert.equal(kick.end, 0.27, 'the kick before is cut');
  assert.equal(snare.end, 1, 'the snare rings on');
  ctx.currentTime = 1.1;
  assert.equal(sound.sounding, 1, 'the snare has died away');
  // Past MAX_NOTES, the oldest goes.
  const many = Array.from({ length: MAX_NOTES + 3 }, (_, i) => note(ctx, out, 1.1, 5));
  many.forEach((n, i) => sound.add(n, `g${i}`));
  assert.equal(sound.sounding, MAX_NOTES);
  assert.deepEqual(many.slice(0, 4).map((n) => n.end), [1.12, 1.12, 1.12, 5]);
  assert.equal(kick2.end, 1.12, 'the oldest first');
});
