// The rack's reverb (reverb.js): its size in seconds, its damping in hertz, its knobs in words; its
// response (two sides of noise, each its own, dying 60 dB over its size, darker by its end as DAMP
// says, faded in and out, as much in it as its length says); what it makes once the sound has woken
// and something is patched into it (in, through a convolver playing the response as loud as it was
// made, through a fade and its level, into its channel); a new response once SIZE or DAMP rests,
// faded over from the one before, which is let go; and the knobs kept for the next visit. On
// test/helpers/audio.js's fake Web Audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BRIGHT, DEFAULT_REVERB, REVERB_KNOBS, Reverb, dampHz, impulse, reverbSeconds, reverbText } from '../public/js/reverb.js';
import { levelGain } from '../public/js/delay.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
/** Numbers 0…1 that come the same each time from the same seed (Park and Miller's). */
const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** The sum of the squares of d from `from` to `to`. */
const energy = (d, from = 0, to = d.length) => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i] * d[i];
  return s;
};
/** How bright d is from `from` to `to`: how much of it is in how it changes from one sample to the next. */
const brightness = (d, from, to) => {
  let s = 0;
  for (let i = Math.max(from, 1); i < to; i++) s += (d[i] - d[i - 1]) ** 2;
  return s / energy(d, from, to);
};

/** A reverb on a woken fake context. */
function made(o = {}) {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const reverb = new Reverb(sound, { storage: null, random: seeded(), ...o });
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  return { sound, reverb, ctx };
}

test('its size as how long it rings, a third of a second to nearly five; its damping as where the highs have died to; each in words', () => {
  assert.deepEqual(REVERB_KNOBS, ['size', 'damp', 'level']);
  assert.deepEqual([reverbSeconds(0), reverbSeconds(DEFAULT_REVERB.size), reverbSeconds(1), reverbSeconds(-1), reverbSeconds(2)], [0.3, 1.2, 4.8, 0.3, 4.8]);
  assert.deepEqual([dampHz(0), dampHz(1), dampHz(5)], [BRIGHT, BRIGHT / 128, BRIGHT / 128]);
  assert.ok(dampHz(0.5) < dampHz(0.4));
  assert.deepEqual([reverbText('size', 0), reverbText('size', 0.5), reverbText('size', 1)], ['0.3 s', '1.2 s', '4.8 s']);
  assert.deepEqual([reverbText('damp', 0.25), reverbText('level', 2)], ['25%', '100%']);
  assert.ok(Object.isFrozen(DEFAULT_REVERB));
});

test('its response: two sides of noise, each its own, as long as its size, dying 60 dB by its end, from nothing and to nothing; as much in it as its length says', () => {
  const ctx = new FakeContext(), rate = ctx.sampleRate;
  const b = impulse(ctx, 1.2, 0, seeded());
  assert.deepEqual([b.numberOfChannels, b.length, b.sampleRate], [2, Math.round(1.2 * rate), rate]);
  const n = b.length, l = b.getChannelData(0), r = b.getChannelData(1);
  for (const d of [l, r]) {
    assert.ok(near(energy(d), 1, 1e-3), `as much in each side as √(1.2 / 1.2): ${energy(d)}`);
    assert.ok(d[0] === 0 && d[n - 1] === 0, 'from nothing, to nothing');
    // Dying evenly, 60 dB over its length: a tenth of the way in and nine tenths, 48 dB apart.
    const tenth = Math.round(n / 10), early = Math.sqrt(energy(d, tenth / 2, tenth * 1.5)), late = Math.sqrt(energy(d, tenth * 8.5, tenth * 9.5));
    assert.ok(near(late / early, 10 ** -2.4, 10 ** -2.4 * 0.1), `${20 * Math.log10(late / early)} dB`);
  }
  let both = 0;
  for (let i = 0; i < n; i++) both += l[i] * r[i];
  assert.ok(Math.abs(both) / Math.sqrt(energy(l) * energy(r)) < 0.05, 'each side its own: wide');
  // A longer one rings louder, a shorter one softer; the same seed, the same response.
  assert.ok(near(energy(impulse(ctx, 4.8, 0.5, seeded()).getChannelData(0)), 2, 2e-3));
  assert.ok(near(energy(impulse(ctx, 0.3, 0.5, seeded()).getChannelData(1)), 0.5, 1e-3));
  assert.deepEqual(impulse(ctx, 0.3, 0.5, seeded(7)).getChannelData(0), impulse(ctx, 0.3, 0.5, seeded(7)).getChannelData(0));
  // One too short to ring: silence, nothing that isn't a number.
  const none = impulse(ctx, 0, 0, seeded());
  assert.ok(none.length >= 2 && none.getChannelData(0).every((x) => x === 0));
});

test('its response darker by its end as far as DAMP says: as bright all through with none', () => {
  const ctx = new FakeContext();
  const n = Math.round(2 * ctx.sampleRate), tenth = Math.round(n / 10);
  const open = impulse(ctx, 2, 0, seeded()).getChannelData(0), closed = impulse(ctx, 2, 1, seeded()).getChannelData(0), half = impulse(ctx, 2, 0.5, seeded()).getChannelData(0);
  const start = (d) => brightness(d, 0, tenth), end = (d) => brightness(d, n - 2 * tenth, n - tenth);
  assert.ok(near(end(open) / start(open), 1, 0.15), `none: ${end(open) / start(open)}`);
  assert.ok(near(start(closed) / start(open), 1, 0.3), 'it starts as bright');
  assert.ok(end(closed) < start(closed) / 10, `all the way: ${end(closed) / start(closed)}`);
  assert.ok(end(closed) < end(half) && end(half) < end(open), 'half way between');
});

test('no reverb until the sound has woken and something goes into it; then one, made once: in, through a convolver playing its response as loud as made, through a fade, out through its level into its channel', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const reverb = new Reverb(sound, { storage: null, random: seeded() });
  assert.deepEqual([reverb.input(), reverb.channel, reverb.seconds], [null, 'reverb', reverbSeconds(DEFAULT_REVERB.size)]);
  reverb.setKnob('level', 1);
  reverb.setKnob('size', 0);
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  assert.equal(ctx.all('convolver').length, 0, 'none until asked for');
  const input = reverb.input();
  assert.ok(input);
  assert.equal(reverb.input(), input, 'made once');
  const [convolver] = ctx.all('convolver');
  const [fade] = convolver.outputs, [level] = fade.outputs;
  assert.deepEqual([input.outputs, level.outputs], [[convolver], [sound.channel('reverb')]]);
  assert.equal(convolver.normalized, false, 'not made as loud as any other: its own loudness, its length\'s');
  assert.equal(convolver.buffer.length, Math.round(reverbSeconds(0) * ctx.sampleRate), 'as the knob was turned before');
  assert.deepEqual([fade.gain.value, level.gain.value], [1, levelGain(1)]);
  // Without Web Audio: none, and nothing breaks.
  const none = new Reverb(new Sound({ Context: null, storage: null }), { storage: null });
  assert.equal(none.input(), null);
  none.setKnob('size', 1);
  none.respond();
  none.reset();
});

test('its level eased at once; its size or damping turned, a new response once the knob rests, faded in over the one before, which is let go once faded; reset as it comes', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { reverb, ctx } = made();
  const input = reverb.input();
  const [first] = ctx.all('convolver'), [firstFade] = first.outputs, [level] = firstFade.outputs;
  ctx.currentTime = 5;
  reverb.setKnob('level', 0.8);
  assert.deepEqual(level.gain.events.at(-1), ['target', levelGain(0.8), 5, 0.02]);
  t.mock.timers.tick(1000);
  assert.equal(ctx.all('convolver').length, 1, 'its level needs no new response');
  reverb.setKnob('size', 0.25);
  t.mock.timers.tick(100);
  reverb.setKnob('size', 0.3);
  t.mock.timers.tick(149);
  assert.equal(ctx.all('convolver').length, 1, 'not while it turns');
  t.mock.timers.tick(1);
  assert.equal(ctx.all('convolver').length, 2, 'one new, once it rests');
  const second = ctx.all('convolver')[1], [secondFade] = second.outputs;
  assert.equal(second.buffer.length, Math.round(reverbSeconds(0.3) * ctx.sampleRate));
  assert.deepEqual([input.outputs, secondFade.outputs], [[first, second], [level]]);
  assert.deepEqual(secondFade.gain.events, [['set', 0, 5], ['target', 1, 5, 0.05]], 'faded in');
  assert.deepEqual(firstFade.gain.events.slice(-2), [['cancel', 0, 5], ['target', 0, 5, 0.05]], 'the one before faded out');
  t.mock.timers.tick(399);
  assert.deepEqual(input.outputs, [first, second]);
  t.mock.timers.tick(1);
  assert.deepEqual([input.outputs, firstFade.outputs], [[second], []], 'and let go');
  // The same knobs again: nothing new.
  reverb.respond();
  reverb.setKnob('damp', reverb.knobs.damp);
  t.mock.timers.tick(1000);
  assert.equal(ctx.all('convolver').length, 2);
  // Nonsense ignored; reset, and a response for it once it rests.
  reverb.setKnob('size', NaN);
  reverb.setKnob(/** @type {any} */ ('toString'), 0.5);
  assert.deepEqual(reverb.knobs, { ...DEFAULT_REVERB, size: 0.3, level: 0.8 });
  reverb.reset();
  assert.deepEqual(reverb.knobs, DEFAULT_REVERB);
  assert.notEqual(reverb.knobs, DEFAULT_REVERB, 'a copy, to turn');
  t.mock.timers.tick(150);
  assert.equal(ctx.all('convolver').at(-1).buffer.length, Math.round(reverbSeconds(DEFAULT_REVERB.size) * ctx.sampleRate));
});

test('the knobs kept a moment later for the next visit and read back; what is not knobs left out', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const reverb = new Reverb(sound, { storage, key: 'room.reverb' });
  reverb.setKnob('damp', 0.9);
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  assert.deepEqual(JSON.parse(storage.map.get('room.reverb')), { ...DEFAULT_REVERB, damp: 0.9 });
  assert.deepEqual(new Reverb(sound, { storage, key: 'room.reverb' }).knobs, { ...DEFAULT_REVERB, damp: 0.9 });
  const odd = new Reverb(sound, { storage: memoryStorage({ 'room.reverb': '{"size":"huge","level":7,"nope":1}' }), key: 'room.reverb' });
  assert.deepEqual(odd.knobs, { ...DEFAULT_REVERB, level: 1 });
  assert.deepEqual(new Reverb(sound, { storage: memoryStorage({ 'room.reverb': '{' }), key: 'room.reverb' }).knobs, DEFAULT_REVERB);
  // Storage that refuses: they last this visit.
  const full = memoryStorage();
  full.refuse = true;
  const kept = new Reverb(sound, { storage: full });
  kept.setKnob('size', 1);
  kept.save();
  assert.equal(kept.knobs.size, 1);
});
