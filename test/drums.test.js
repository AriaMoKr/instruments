// The drums (drums.js): the twelve pads, where each is, its key and its MIDI notes; the knobs in
// numbers and in words; every drum made, at every setting, as a browser would take it (on
// test/helpers/audio.js's fake Web Audio, which refuses what a browser would); the hi-hats' one
// circuit; and the knobs kept for the next visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNS, DEFAULT_KNOBS, Drums, KNOBS, LEVELS, PADS, RECIPES, ROWS,
  decayRatio, keyLabel, knobText, movePad, padForKey, padForNote, pitchRatio, playDrum, velocityGain,
} from '../public/js/drums.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('twelve pads, one in each place of four columns and three rows, each with its key, its notes and its colour', () => {
  assert.equal(PADS.length, COLUMNS * ROWS);
  assert.equal(new Set(PADS.map((p) => p.id)).size, PADS.length);
  assert.equal(new Set(PADS.map((p) => `${p.col},${p.row}`)).size, PADS.length);
  for (const p of PADS) {
    assert.ok(p.col >= 0 && p.col < COLUMNS && p.row >= 0 && p.row < ROWS, p.id);
    assert.match(p.color, /^#[0-9a-f]{6}$/, p.id);
    assert.ok(p.decay > 0 && p.notes.length > 0, p.id);
    assert.ok(RECIPES[p.id] && LEVELS[p.id] > 0 && LEVELS[p.id] <= 1, `${p.id}: a recipe and a level`);
  }
  // The keys lie as the pads do: the number row farthest, then Q–R, then A–F nearest, left to right.
  const rows = ['Digit1 Digit2 Digit3 Digit4', 'KeyQ KeyW KeyE KeyR', 'KeyA KeyS KeyD KeyF'];
  for (const [r, keys] of rows.entries()) {
    keys.split(' ').forEach((key, col) => {
      const p = PADS[padForKey(key)];
      assert.deepEqual([p.row, p.col], [ROWS - 1 - r, col], key);
    });
  }
  assert.equal(padForKey('KeyZ'), -1);
  assert.deepEqual(PADS.map((p) => keyLabel(p.key)).join(''), 'ASDFQWER1234');
  // Each General MIDI note plays one pad at most, and a pad controller's first bank (36–51) plays
  // all but the cowbell (56).
  const notes = PADS.flatMap((p) => p.notes);
  assert.equal(new Set(notes).size, notes.length);
  const bank = new Set(Array.from({ length: 16 }, (_, i) => padForNote(36 + i)));
  assert.ok(!bank.has(-1), 'every note of the bank plays a pad');
  assert.equal(bank.size, 11);
  assert.equal(PADS[padForNote(56)].id, 'cowbell');
  assert.deepEqual([padForNote(36), padForNote(38), padForNote(42), padForNote(46), padForNote(49)].map((i) => PADS[i].id), ['kick', 'snare', 'closed-hat', 'open-hat', 'crash']);
  assert.equal(padForNote(60), -1);
});

test('the arrows choose a pad: a column across, a row farther or nearer, staying on the board', () => {
  const kick = padForKey('KeyA');
  assert.equal(PADS[movePad(kick, 1, 0)].id, 'snare');
  assert.equal(PADS[movePad(kick, 0, 1)].id, 'low-tom');
  assert.equal(PADS[movePad(kick, 0, 2)].id, 'rim');
  assert.equal(movePad(kick, -1, 0), kick, 'the left edge');
  assert.equal(movePad(kick, 0, -1), kick, 'the near edge');
  const ride = padForKey('Digit4');
  assert.equal(movePad(ride, 1, 1), ride, 'the far right corner');
});

test('the knobs: the pitch an octave either way, the decay a third to three times, and each in words', () => {
  assert.deepEqual([pitchRatio(0), pitchRatio(0.5), pitchRatio(1)], [0.5, 1, 2]);
  assert.ok(near(decayRatio(0), 2 ** -1.5) && decayRatio(0.5) === 1 && near(decayRatio(1), 2 ** 1.5));
  const kick = padForKey('KeyA'), crash = padForKey('Digit3');
  assert.equal(knobText(kick, 'pitch', 0.5), 'as it comes');
  assert.equal(knobText(kick, 'pitch', 1), '+12 semitones');
  assert.equal(knobText(kick, 'pitch', 0.5 - 1 / 24), '−1 semitone');
  assert.equal(knobText(kick, 'decay', 0.5), '500 ms');
  assert.equal(knobText(crash, 'decay', 0.5), '1.8 s');
  assert.equal(knobText(kick, 'tone', 0.25), '25% bright');
  assert.deepEqual(KNOBS, ['pitch', 'decay', 'tone']);
  assert.deepEqual(DEFAULT_KNOBS, { pitch: 0.5, decay: 0.5, tone: 0.5 });
});

test('the velocity: never quite silent, all of it at the hardest, rising', () => {
  assert.ok(near(velocityGain(0), 0.08) && velocityGain(1) === 1);
  for (let v = 0.05; v <= 1; v += 0.05) assert.ok(velocityGain(v) > velocityGain(v - 0.05));
  assert.equal(velocityGain(3), 1);
});

test('every drum, at every setting and velocity, is made as a browser takes it, and stops once it has died away', () => {
  const settings = [0, 0.5, 1];
  for (const [i, pad] of PADS.entries()) {
    for (const pitch of settings) {
      for (const decay of settings) {
        for (const tone of settings) {
          for (const velocity of [0, 0.6, 1]) {
            const ctx = new FakeContext();
            const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
            const out = ctx.createGain();
            const when = 3;
            const what = `${pad.id} ${JSON.stringify({ pitch, decay, tone, velocity })}`;
            const note = playDrum(/** @type {any} */ (ctx), out, noise, i, velocity, { pitch, decay, tone }, when);
            assert.deepEqual(note.out.outputs, [out], what);
            assert.ok(near(note.level, LEVELS[pad.id] * velocityGain(velocity)), what);
            assert.ok(note.sources.length > 0, what);
            for (const s of note.sources) assert.deepEqual([s.started, s.stopped], [when, note.end], what);
            const rings = pad.decay * decayRatio(decay);
            assert.ok(note.end >= when + rings * 0.75 && note.end <= when + rings * 1.4 + 0.1, `${what}: ends at ${note.end}`);
            // Every filter within what the browser can make.
            for (const f of ctx.all('filter')) assert.ok(f.frequency.value > 20 && f.frequency.value <= ctx.sampleRate * 0.45, `${what}: ${f.frequency.value} Hz`);
            for (const o of ctx.all('oscillator')) {
              const hz = o.frequency.events.map((e) => e[1]);
              assert.ok(hz.every((f) => f > 10 && f < ctx.sampleRate / 2), `${what}: ${hz}`);
            }
          }
        }
      }
    }
  }
});

test('a pad played: into the drums channel; again, the last one cut; the closed hi-hat stops the open one', () => {
  const sound = new Sound({ Context: /** @type {any} */ (FakeContext), storage: null });
  const drums = new Drums(sound, { storage: null });
  assert.equal(drums.hit(padForKey('KeyA'), 1)?.out.outputs[0], sound.channel('drums'));
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.ctx));
  ctx.currentTime = 0.1;
  const open = drums.hit(padForKey('KeyF'));
  ctx.currentTime = 0.2;
  const kick = drums.hit(padForKey('KeyA'));
  ctx.currentTime = 0.3;
  drums.hit(padForKey('KeyD'));
  assert.ok(near(open.end, 0.32), `the open hat cut by the closed one: ${open.end}`);
  assert.ok(kick.end > 0.6, 'the kick rings on');
  ctx.currentTime = 0.4;
  drums.hit(padForKey('KeyA'));
  assert.ok(near(kick.end, 0.42), 'the kick cut by the next');
  // No such pad, or no Web Audio: nothing.
  assert.equal(drums.hit(99), null);
  assert.equal(new Drums(new Sound({ Context: null, storage: null }), { storage: null }).hit(0), null);
});

test('the knobs: set within 0…1, reset as the drum comes, kept a moment later for the next visit and read back', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const drums = new Drums(sound, { storage, key: 'room.drums' });
  const snare = padForKey('KeyS');
  drums.setKnob(snare, 'pitch', 0.75);
  drums.setKnob(snare, 'decay', 3);
  drums.setKnob(snare, 'tone', NaN);
  assert.deepEqual(drums.knobs[snare], { pitch: 0.75, decay: 1, tone: 0.5 });
  assert.equal(storage.map.size, 0, 'not at once, while a knob is turning');
  t.mock.timers.tick(400);
  const kept = JSON.parse(storage.map.get('room.drums'));
  assert.deepEqual(kept.snare, { pitch: 0.75, decay: 1, tone: 0.5 });
  assert.deepEqual(kept.kick, DEFAULT_KNOBS);
  const next = new Drums(sound, { storage, key: 'room.drums' });
  assert.deepEqual(next.knobs[snare], { pitch: 0.75, decay: 1, tone: 0.5 });
  next.reset(snare);
  assert.deepEqual(next.knobs[snare], DEFAULT_KNOBS);
  assert.notEqual(next.knobs[snare], DEFAULT_KNOBS, 'a copy, to turn');
  // What isn't knobs is left out; nothing readable is as they come.
  const odd = new Drums(sound, { storage: memoryStorage({ 'room.drums': '{"snare":{"pitch":"high","decay":-2},"nope":{}}' }), key: 'room.drums' });
  assert.deepEqual(odd.knobs[snare], { pitch: 0.5, decay: 0, tone: 0.5 });
  assert.deepEqual(new Drums(sound, { storage: memoryStorage({ 'room.drums': '{' }), key: 'room.drums' }).knobs[snare], DEFAULT_KNOBS);
});
