// The synth (synth.js): its knobs, sections and presets; what each knob means, in numbers and in
// words; the notes and the computer's keys; its envelopes and glide, worked out as they are set; the
// voices made as a browser takes them (on test/helpers/audio.js's fake Web Audio, which refuses what
// a browser would) with the first note and only then; poly (a voice each, the same note its own
// voice, the one held longest taken for a seventh), the sustain pedal, mono (one note, stacked and
// spread, legato and gliding), the knobs heard at once, the presets, a note played for a moment,
// the patch bay (its sound out, the LFO and the filter envelope into the pitch, the cutoff and the
// amp, and out to another instrument), the arpeggiator played through it, the rack's sequencer
// through its NOTES in, and the settings kept for the next visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMP_MOD, DEFAULT_SYNTH, Envelope, Glide, KEYS, LOWEST, MOD_CENTS, MOD_INPUTS, NOTE_KEYS, OCTAVES, OCTAVE_KEYS, PRESETS, SECTIONS,
  SLIDE, SYNTH_KNOBS, Synth, VOICES, attackSeconds, cutoffHz, decaySeconds, detuneCents, glideSeconds, isBlack, knobName, levelOf, lfoHz,
  noteForKey, noteHz, noteName, pulseDuty, resonanceDb, spokenNote, synthText, tanhCurve,
} from '../public/js/synth.js';
import { ARP_GATE } from '../public/js/arp.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const last = (param) => param.events[param.events.length - 1];

/** A synth on the fake Web Audio, its drift's dice always in the middle (none). */
function make({ storage = memoryStorage(), Context = FakeContext } = {}) {
  const sound = new Sound({ Context, storage: null });
  const synth = new Synth(sound, { storage, random: () => 0.5 });
  return { sound, synth };
}

test('twenty-five knobs in six sections, each section together and in order, each as it comes 0…1', () => {
  assert.equal(SYNTH_KNOBS.length, 25);
  const ids = SYNTH_KNOBS.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(DEFAULT_SYNTH).sort(), [...ids].sort());
  for (const id of ids) assert.ok(DEFAULT_SYNTH[id] >= 0 && DEFAULT_SYNTH[id] <= 1, id);
  const order = SECTIONS.map((s) => s.id);
  const seen = SYNTH_KNOBS.map((k) => order.indexOf(k.section));
  assert.ok(!seen.includes(-1), 'every knob in a section');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `${ids[i]}: its section together, in order`);
  for (const s of SECTIONS) assert.ok(SYNTH_KNOBS.some((k) => k.section === s.id), `${s.id}: a knob`);
  for (const k of SYNTH_KNOBS) assert.ok(k.label && k.name && k.label === k.label.toUpperCase(), k.id);
});

test('eight presets, four poly then four mono, each of known knobs within 0…1', () => {
  assert.equal(PRESETS.length, 8);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, 8);
  assert.equal(new Set(PRESETS.map((p) => p.name)).size, 8);
  assert.deepEqual(PRESETS.map((p) => p.mono), [false, false, false, false, true, true, true, true]);
  for (const p of PRESETS) {
    for (const [id, v] of Object.entries(p.knobs)) {
      assert.ok(id in DEFAULT_SYNTH, `${p.id}: ${id} is a knob`);
      assert.ok(v >= 0 && v <= 1, `${p.id}: ${id} ${v}`);
    }
  }
});

test('what the knobs mean: each from its least to its most, rising, and in words', () => {
  assert.deepEqual([levelOf(0), levelOf(0.5), levelOf(1), levelOf(2)], [0, 0.25, 1, 1]);
  assert.ok(pulseDuty(0) === 0.5 && near(pulseDuty(1), 0.05));
  assert.ok(near(cutoffHz(0), 30) && cutoffHz(1) > 17000 && cutoffHz(1) < 18000);
  assert.ok(near(attackSeconds(0), 0.001) && near(attackSeconds(1), 8.192));
  assert.ok(near(decaySeconds(0), 0.005) && near(decaySeconds(1), 10.24));
  assert.ok(near(lfoHz(0), 0.08) && near(lfoHz(1), 20.48));
  assert.deepEqual([glideSeconds(0), detuneCents(0), resonanceDb(0)], [0, 0, 0]);
  for (const f of [cutoffHz, attackSeconds, decaySeconds, lfoHz, glideSeconds, detuneCents, resonanceDb]) {
    for (let k = 0.1; k <= 1; k += 0.1) assert.ok(f(k) > f(k - 0.1), `${f.name} rises at ${k}`);
  }
  assert.equal(synthText('cutoff', 0), '30 Hz');
  assert.equal(synthText('cutoff', 1), '17.6 kHz');
  assert.equal(synthText('rate', 0), '0.08 Hz');
  assert.equal(synthText('rate', 1), '20 Hz');
  assert.equal(synthText('attack', 0), '1 ms');
  assert.equal(synthText('release', 1), '10.2 s');
  assert.equal(synthText('glide', 0), 'off');
  assert.equal(synthText('detune', 0), 'none');
  assert.equal(synthText('detune', 1), '30 cents');
  assert.equal(synthText('width', 0), '50%');
  assert.equal(synthText('amount', 0.5), '3.0 octaves');
  assert.equal(synthText('wah', 1), '3.0 octaves');
  assert.equal(synthText('saw', 0.75), '75%');
  for (const k of SYNTH_KNOBS) for (const v of [0, 0.37, 1]) assert.match(synthText(k.id, v), /\S/, k.id);
  // Its name standing alone: which envelope, the LFO's rate; each different.
  assert.deepEqual(['filterAttack', 'release', 'rate', 'cutoff'].map((id) => knobName(id)), ['Filter envelope attack', 'Amp envelope release', 'LFO rate', 'Cutoff']);
  assert.equal(new Set(SYNTH_KNOBS.map((k) => knobName(k.id))).size, SYNTH_KNOBS.length);
});

test('the notes by name and as said, the black keys, and the computer keys a row of white keys with the black above', () => {
  assert.deepEqual([60, 61, 21, 108, 47].map(noteName), ['C4', 'C♯4', 'A0', 'C8', 'B2']);
  assert.equal(spokenNote(61), 'C sharp 4');
  assert.equal(noteHz(69), 440);
  assert.ok(near(noteHz(81), 880));
  assert.deepEqual([60, 61, 62, 63, 64, 65, 66].map(isBlack), [false, true, false, true, false, false, true]);
  assert.equal(noteForKey('KeyA'), 60);
  assert.equal(noteForKey('KeyK'), 72);
  assert.equal(noteForKey('Quote'), 77);
  assert.equal(noteForKey('KeyA', -1), 48);
  assert.equal(noteForKey('KeyZ'), -1);
  assert.equal(noteForKey('toString'), -1);
  const top = new Set(['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU', 'KeyO', 'KeyP']);
  for (const code of Object.keys(NOTE_KEYS)) assert.equal(isBlack(noteForKey(code)), top.has(code), code);
  assert.ok(!(OCTAVE_KEYS.down in NOTE_KEYS) && !(OCTAVE_KEYS.up in NOTE_KEYS));
  // The keyboard: three octaves and a C, from C3, its C4 the 13th key.
  assert.equal(KEYS, 37);
  assert.equal(noteName(LOWEST), 'C3');
  assert.equal(noteName(LOWEST + KEYS - 1), 'C6');
  assert.ok(OCTAVES.min < 0 && OCTAVES.max > 0);
});

test('a tanh curve from -1 to 1, the same either way', () => {
  const c = tanhCurve(24, 101);
  assert.equal(c.length, 101);
  assert.ok(near(c[0], -1, 1e-6) && near(c[100], 1, 1e-6) && c[50] === 0);
  for (let i = 0; i < 101; i++) assert.ok(near(c[i], -c[100 - i], 1e-6));
  assert.ok(c[55] > 0.9, 'steep at its middle');
});

test('an envelope: up to its peak, down towards the sustain, let go from where it is, started again from there', () => {
  const ctx = new FakeContext(), p = ctx.createGain().gain, env = new Envelope();
  assert.ok(env.released(0) && env.valueAt(0) === 0, 'as it is made: let go long ago, at nothing');
  env.stop([p], 0, 0.5);
  assert.equal(p.events.length, 0, 'letting go of nothing sets nothing');
  env.start([p], 1, 0.8, 0.1, 0.5, 0.5);
  assert.deepEqual(p.events.map((e) => e[0]), ['cancel', 'set', 'linear', 'target']);
  assert.deepEqual(p.events.slice(1).map((e) => e[1]), [0, 0.8, 0.4]);
  assert.ok(near(env.valueAt(1.05), 0.4) && near(env.valueAt(1.1), 0.8));
  assert.ok(near(env.valueAt(10), 0.4, 1e-6), 'nearly at the sustain long after');
  assert.ok(!env.released(2));
  const at = env.valueAt(1.05);
  env.stop([p], 1.05, 0.5);
  assert.ok(env.released(1.05));
  assert.deepEqual(last(p).slice(0, 3), ['target', 0, 1.05]);
  const cut = p.events[p.events.length - 2];
  assert.equal(cut[0], 'linear', "let go mid-attack: the attack's line cut short there, not set back to where it began");
  assert.ok(near(cut[1], at), 'let go mid-attack, from where it was');
  assert.ok(env.valueAt(1.05 + 0.5) < at * 0.01, 'nearly nothing after the release');
  const mid = env.valueAt(1.15);
  env.start([p], 1.15, 0.8, 0.1, 0.5, 0.5);
  assert.ok(near(env.valueAt(1.15), mid) && near(p.events[p.events.length - 3][1], mid), 'started again from where it was');
  // Base and scale: a filter's detune, in cents.
  const q = ctx.createGain().gain, f = new Envelope();
  f.start([q], 0, 1, 0.01, 0.2, 0.25, -300, 1200);
  assert.deepEqual(q.events.slice(1).map((e) => e[1]), [-300, 900, 0]);
  f.stop([q], 5, 0.2);
  assert.equal(last(q)[1], -300, 'back to its base');
  assert.equal(q.events[q.events.length - 2][0], 'set', 'let go after the attack: from where it is');
});

test('a glide: at once without one; with one from where it is, towards the note', () => {
  const ctx = new FakeContext(), p = ctx.createGain().gain, g = new Glide();
  g.go([p], 0, -900, 0);
  assert.equal(g.valueAt(0), -900);
  assert.deepEqual(last(p), ['set', -900, 0]);
  g.go([p], 1, -500, 0.3);
  assert.equal(g.valueAt(1), -900);
  assert.ok(near(g.valueAt(1.1), -500 + (-400) * Math.exp(-1), 1e-9));
  assert.ok(near(g.valueAt(5), -500, 1e-6));
  assert.deepEqual(last(p).slice(0, 3), ['target', -500, 1]);
  assert.ok(near(last(p)[3], 0.1));
  const mid = g.valueAt(1.2);
  g.go([p], 1.2, -1200, 0.3);
  assert.equal(g.valueAt(1.2), mid, 'a new note glides from where the last one had got to');
});

test('without Web Audio a key is still known down, and its knobs are set and kept', () => {
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const synth = new Synth(sound, { storage });
  let told = 0;
  synth.onNotes = () => told++;
  assert.equal(synth.noteOn(60), false);
  assert.deepEqual([...synth.down], [60]);
  synth.noteOff(60);
  assert.equal(synth.down.size, 0);
  assert.equal(told, 2);
  synth.setKnob('cutoff', 0.9);
  synth.setMono(true);
  synth.save();
  assert.deepEqual(JSON.parse(storage.map.get('synth')).knobs.cutoff, 0.9);
  synth.allOff();
  assert.deepEqual(synth.sounding, []);
});

test('the voices are made with the first note, as a browser takes them, into the synth channel, and only once', () => {
  const { sound, synth } = make();
  assert.equal(sound.ctx, null, 'nothing made before a note');
  assert.equal(synth.noteOn(60, 0.8), true);
  const ctx = sound.ctx;
  assert.ok(ctx instanceof FakeContext);
  const counts = () => ['oscillator', 'constant', 'buffer', 'filter', 'merger', 'delay', 'shaper'].map((k) => ctx.all(k).length);
  // Two oscillators a voice, the LFO and the chorus's sway; the filter envelope out a voice, the bend
  // and the width; the noise; two low-passes a voice and the high-pass; the chorus; the pulse's
  // comparator a voice, the drive and the mixer's clipper.
  assert.deepEqual(counts(), [2 * VOICES + 2, VOICES + 2, 1, 2 * VOICES + 1, 1, 2, VOICES + 2]);
  for (const s of [...ctx.all('oscillator'), ...ctx.all('constant'), ...ctx.all('buffer')]) assert.equal(s.started, 0);
  const channel = sound.channel('synth');
  assert.ok(ctx.nodes.some((n) => n.outputs.includes(channel)), 'into the synth channel');
  const lowpasses = ctx.all('filter').filter((f) => f.type === 'lowpass');
  assert.equal(lowpasses.length, 2 * VOICES);
  for (const f of lowpasses) assert.ok([f.frequency, f.detune, f.Q].every((p) => p.automationRate === 'k-rate'));
  synth.noteOn(64);
  synth.noteOn(67);
  assert.deepEqual(counts(), [2 * VOICES + 2, VOICES + 2, 1, 2 * VOICES + 1, 1, 2, VOICES + 2], 'no more for more notes');
  assert.deepEqual(synth.sounding.sort(), [60, 64, 67]);
});

test('poly: a note a voice, the same note its own voice, one let go taken next, and the one held longest for a seventh', () => {
  const { sound, synth } = make();
  for (let i = 0; i < VOICES; i++) {
    synth.noteOn(60 + i);
    sound.ctx.currentTime += 0.1;
  }
  const voices = synth._voices;
  assert.deepEqual(voices.map((v) => v.note), [60, 61, 62, 63, 64, 65]);
  // Its pitch in cents from A4 (no drift with the dice in the middle), the sub's the same an octave under.
  assert.deepEqual(last(voices[0].saw.detune).slice(0, 2), ['set', -900]);
  assert.equal(voices[0].sub.frequency.value * 2, voices[0].saw.frequency.value);
  synth.noteOn(61);
  assert.deepEqual(voices.map((v) => v.note), [60, 61, 62, 63, 64, 65], 'the same note, its own voice');
  synth.noteOn(70);
  assert.deepEqual(voices.map((v) => v.note), [70, 61, 62, 63, 64, 65], 'the one held longest');
  synth.noteOff(63);
  assert.ok(voices[3].ampEnv.released(sound.ctx.currentTime));
  assert.deepEqual(last(voices[3].amp.gain).slice(0, 2), ['target', 0]);
  synth.noteOn(72);
  assert.equal(voices[3].note, 72, 'the voice let go');
  // The amp up to the velocity's loudness, the filter from where the note and velocity set it.
  const hard = voices[3].ampEnv.peak;
  synth.noteOff(72);
  synth.noteOn(72, 0.1);
  assert.ok(voices[3].ampEnv.peak < hard);
  const low = voices[3].filterEnv.base;
  synth.noteOff(72);
  synth.noteOn(84, 0.1);
  assert.ok(voices.find((v) => v.note === 84).filterEnv.base > low, 'higher notes open the filter more');
});

test("a note set ahead (the guitar's, strummed): started then and let go when it says, as a key's; a time gone, now", () => {
  const { sound, synth } = make();
  sound.wake().currentTime = 1;
  synth.noteOn(60, 0.8, 1.04);
  const voice = synth._voices.find((v) => v.note === 60);
  assert.equal(voice.started, 1.04);
  assert.ok(voice.gate, 'held from now, as a key');
  synth.noteOff(60, 1.6);
  assert.ok(!voice.ampEnv.released(1.59) && voice.ampEnv.released(1.6));
  // Set for a time gone: now.
  sound.ctx.currentTime = 2;
  synth.noteOn(62, 0.8, 1.5);
  assert.equal(synth._voices.find((v) => v.note === 62).started, 2);
  synth.noteOff(62, NaN);
  assert.ok(synth._voices.find((v) => v.note === 62).ampEnv.released(2));
});

test('the sustain pedal holds the notes let go until it is let go', () => {
  const { sound, synth } = make();
  synth.setSustain(true);
  synth.noteOn(60);
  synth.noteOff(60);
  const voice = synth._voices.find((v) => v.note === 60);
  assert.ok(voice.held && !voice.ampEnv.released(sound.ctx.currentTime));
  assert.deepEqual(synth.sounding, [60]);
  synth.noteOn(60);
  assert.equal(synth._voices.filter((v) => v.note === 60).length, 1, 'pressed again, the voice it had');
  synth.noteOff(60);
  sound.ctx.currentTime = 1;
  synth.setSustain(false);
  assert.ok(!voice.held && voice.ampEnv.released(1));
});

test('mono: the voices on one note spread by DETUNE; a key pressed while one is held glides there legato, and back', () => {
  const { sound, synth } = make();
  synth.setMono(true);
  synth.setKnob('glide', 0.5);
  synth.noteOn(60);
  const voices = synth._voices;
  assert.ok(voices.every((v) => v.note === 60 && v.gate));
  const pitches = voices.map((v) => last(v.saw.detune)[1]);
  const spread = detuneCents(synth.knobs.detune);
  assert.ok(near(pitches[0], -900 - spread) && near(pitches[VOICES - 1], -900 + spread));
  assert.deepEqual(last(voices[0].saw.detune)[0], 'set', 'the first note at once');
  assert.ok(voices.every((v) => v.ampEnv.t0 === 0), 'every voice started');
  sound.ctx.currentTime = 0.5;
  synth.noteOn(64);
  assert.ok(voices.every((v) => v.note === 64 && v.ampEnv.t0 === 0), 'legato: not started again');
  assert.deepEqual(last(voices[2].saw.detune).slice(0, 2), ['target', -500 + ((2 / 5) * 2 - 1) * spread]);
  assert.ok(near(last(voices[2].saw.detune)[3], glideSeconds(0.5) / 3));
  sound.ctx.currentTime = 1;
  synth.noteOff(64);
  assert.ok(voices.every((v) => v.note === 60 && v.gate), 'back to the key still held');
  synth.noteOff(60);
  assert.ok(voices.every((v) => !v.gate && v.ampEnv.released(1)));
  // A note after all were let go starts again, and doesn't glide.
  sound.ctx.currentTime = 2;
  synth.noteOn(67);
  assert.ok(voices.every((v) => v.ampEnv.t0 === 2));
  assert.equal(last(voices[0].saw.detune)[0], 'set');
  // DETUNE at none: one voice, at the whole loudness.
  synth.noteOff(67);
  synth.setKnob('detune', 0);
  sound.ctx.currentTime = 3;
  synth.noteOn(69);
  assert.deepEqual(voices.map((v) => v.ampEnv.t0 === 3), [true, false, false, false, false, false]);
  assert.ok(voices[0].ampEnv.peak > voices[1].ampEnv.peak);
  // Switching to poly lets every note go.
  synth.setMono(false);
  assert.equal(synth.down.size, 0);
  assert.ok(voices.every((v) => !v.gate && v.ampEnv.released(3)));
});

test('the knobs: heard at once where they can be, each within 0…1, and nothing for a knob there isn\'t', () => {
  const { sound, synth } = make();
  synth.noteOn(60);
  const g = synth._graph, voices = synth._voices;
  synth.setKnob('cutoff', 0.7);
  for (const v of voices) for (const f of v.filters) assert.deepEqual(last(f.frequency).slice(0, 2), ['target', cutoffHz(0.7)]);
  synth.setKnob('saw', 0.5);
  assert.deepEqual(last(voices[4].levels.saw.gain).slice(0, 2), ['target', 0.25]);
  synth.setKnob('resonance', 1);
  assert.deepEqual(last(voices[1].filters[1].Q).slice(0, 2), ['target', 26]);
  synth.setKnob('level', 0);
  assert.deepEqual(last(g.level.gain).slice(0, 2), ['target', 0]);
  synth.setKnob('width', 1);
  assert.ok(near(last(g.width.offset)[1], -0.9));
  synth.setMod(1);
  assert.deepEqual(last(g.vibrato.gain).slice(0, 2), ['target', 60]);
  synth.setBend(-1);
  assert.deepEqual(last(g.bend.offset).slice(0, 2), ['target', -200]);
  synth.setBend(NaN);
  assert.equal(last(g.bend.offset)[1], 0);
  synth.setKnob('drive', 3);
  assert.equal(synth.knobs.drive, 1);
  const before = { ...synth.knobs };
  synth.setKnob('nonsense', 0.5);
  synth.setKnob('cutoff', NaN);
  assert.deepEqual(synth.knobs, before);
  // At every preset, every note held and let go, bent and moved, as a browser takes it.
  for (const p of PRESETS) {
    synth.choose(p.id);
    for (let n = 24; n <= 108; n += 7) synth.noteOn(n, (n % 10) / 10);
    synth.setBend(0.5);
    synth.setMod(0.3);
    sound.ctx.currentTime += 0.05;
    for (let n = 24; n <= 108; n += 7) synth.noteOff(n);
    sound.ctx.currentTime += 0.05;
  }
});

test('the presets set every knob and Mono at once; a knob turned after is a change; one after another, round the list', () => {
  const { synth } = make();
  assert.equal(synth.title, 'As it comes, poly');
  assert.equal(synth.choose('acid'), true);
  const acid = PRESETS.find((p) => p.id === 'acid');
  assert.equal(synth.mono, true);
  assert.deepEqual(synth.knobs, { ...DEFAULT_SYNTH, ...acid.knobs });
  assert.equal(synth.title, 'Acid, mono');
  synth.setKnob('cutoff', 0.5);
  assert.equal(synth.title, 'Acid (changed), mono');
  synth.step(1);
  assert.equal(synth.preset, 'wobble');
  synth.choose(PRESETS[0].id);
  synth.step(-1);
  assert.equal(synth.preset, PRESETS[PRESETS.length - 1].id);
  synth.step(1);
  assert.equal(synth.preset, PRESETS[0].id);
  assert.equal(synth.choose('nonsense'), false);
  assert.equal(synth.preset, PRESETS[0].id);
  synth.reset();
  assert.deepEqual([synth.preset, synth.mono, synth.edited], [null, false, false]);
  assert.deepEqual(synth.knobs, { ...DEFAULT_SYNTH });
  synth.setKnob('saw', 0.1);
  assert.equal(synth.title, 'Own sound, poly');
});

test('the octave the keys play in, within its reach', () => {
  const { synth } = make();
  assert.equal(synth.lowest, LOWEST);
  synth.setOctave(1);
  assert.equal(synth.lowest, LOWEST + 12);
  synth.setOctave(9);
  assert.equal(synth.octave, OCTAVES.max);
  synth.setOctave(-9);
  assert.equal(synth.octave, OCTAVES.min);
  synth.setOctave(NaN);
  assert.equal(synth.octave, OCTAVES.min);
});

test('a note played for a moment is let go a moment later, unless its key is pressed again first', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { synth } = make();
  synth.tap(60);
  assert.deepEqual([...synth.down], [60]);
  t.mock.timers.tick(200);
  synth.tap(60);
  t.mock.timers.tick(200);
  assert.deepEqual([...synth.down], [60], 'pressed again: the first let-go forgotten');
  t.mock.timers.tick(200);
  assert.equal(synth.down.size, 0);
  synth.tap(62);
  synth.noteOn(62);
  t.mock.timers.tick(1000);
  assert.deepEqual([...synth.down], [62], 'held after a tap: held');
  synth.tap(64);
  synth.allOff();
  assert.equal(synth.down.size, 0);
});

test('its sound out, for a cable, once the voices are made: onBuilt then, and only then', () => {
  const { synth } = make();
  let built = 0;
  synth.onBuilt = () => built++;
  assert.equal(synth.output, null);
  synth.noteOn(60);
  assert.equal(synth.output, synth._graph.level);
  synth.noteOn(64);
  assert.equal(built, 1);
});

test('the patch bay: the LFO, or each voice its own filter envelope, into the pitch, the cutoff and the amp, before the voices are made or after', () => {
  const { sound, synth } = make();
  assert.deepEqual(MOD_INPUTS, ['pitch', 'cutoff', 'amp']);
  synth.setInput('pitch', 'lfo');
  synth.noteOn(60);
  const g = synth._graph, voices = synth._voices;
  for (const v of voices) {
    assert.ok(g.lfo.outputs.includes(v.inputs.pitch), 'plugged in before: connected as they are made');
    assert.ok([v.saw.detune, v.sub.detune].every((p) => v.inputs.pitch.outputs.includes(p)));
    assert.ok(v.filters.every((f) => v.inputs.cutoff.outputs.includes(f.detune)));
    assert.ok(v.inputs.amp.outputs.includes(v.vca.gain));
    assert.equal(v.vca.gain.value, 1, 'nothing into AMP: open');
  }
  assert.deepEqual(MOD_INPUTS.map((i) => voices[0].inputs[i].gain.value), [MOD_CENTS.pitch, MOD_CENTS.cutoff, AMP_MOD]);
  synth.setInput('cutoff', 'env');
  for (const v of voices) assert.ok(v.env.outputs.includes(v.inputs.cutoff) && !g.lfo.outputs.includes(v.inputs.cutoff));
  assert.ok(!voices[0].env.outputs.includes(voices[1].inputs.cutoff), "a voice's envelope into its own voice only");
  synth.setInput('cutoff', 'lfo');
  for (const v of voices) assert.ok(!v.env.outputs.includes(v.inputs.cutoff) && g.lfo.outputs.includes(v.inputs.cutoff), 'the cable moved');
  synth.setInput('amp', 'env');
  for (const v of voices) assert.deepEqual(last(v.vca.gain).slice(0, 2), ['target', AMP_MOD], 'half open, the rest the envelope');
  synth.setInput('amp', null);
  for (const v of voices) assert.ok(last(v.vca.gain)[1] === 1 && !v.env.outputs.includes(v.inputs.amp), 'pulled out: open again');
  synth.setInput('nonsense', 'lfo');
  synth.setInput('pitch', 'sideways');
  assert.deepEqual(synth.inputs, { pitch: null, cutoff: 'lfo', amp: null });
  assert.ok(voices.every((v) => !g.lfo.outputs.includes(v.inputs.pitch)), 'something it is not: nothing');
  // ENV out: each voice's filter envelope, 0…1, started and let go with it.
  sound.ctx.currentTime = 1;
  synth.noteOn(67);
  const v = voices.find((x) => x.note === 67);
  assert.deepEqual([v.envOut.t0, v.envOut.peak, v.envOut.base, v.envOut.scale], [1, 1, 0, 1]);
  assert.deepEqual(v.env.offset.events.slice(-3).map((e) => e[0]), ['set', 'linear', 'target']);
  assert.equal(v.envOut.attack, v.filterEnv.attack);
  sound.ctx.currentTime = 2;
  synth.noteOff(67);
  assert.ok(v.envOut.released(2) && v.filterEnv.released(2));
  // Plugged into AMP before the voices are made: made half open.
  const other = make().synth;
  other.setInput('amp', 'lfo');
  other.noteOn(60);
  assert.ok(other._voices.every((x) => x.vca.gain.value === AMP_MOD && other._graph.lfo.outputs.includes(x.inputs.amp)));
});

test("a modulation from outside it (the rack's LFO's out): into every voice, plugged in before the voices are made or after; moved, pulled out, and nothing for what is not a node", () => {
  const { sound, synth } = make();
  const ctx = /** @type {FakeContext} */ (/** @type {unknown} */ (sound.wake()));
  const rack = ctx.createGain();
  synth.setInput('cutoff', rack);
  assert.equal(synth.inputs.cutoff, rack);
  synth.noteOn(60);
  const voices = synth._voices, g = synth._graph;
  assert.ok(voices.every((v) => rack.outputs.includes(v.inputs.cutoff)), 'plugged in before: connected as they are made');
  synth.setInput('pitch', rack);
  assert.ok(voices.every((v) => rack.outputs.includes(v.inputs.pitch)), 'and after: at once');
  synth.setInput('cutoff', 'lfo');
  assert.ok(voices.every((v) => !rack.outputs.includes(v.inputs.cutoff) && g.lfo.outputs.includes(v.inputs.cutoff)), 'moved to its own LFO');
  synth.setInput('amp', rack);
  for (const v of voices) assert.deepEqual(last(v.vca.gain).slice(0, 2), ['target', AMP_MOD], 'half open, the rest the LFO');
  synth.setInput('pitch', null);
  synth.setInput('amp', null);
  assert.deepEqual(rack.outputs, [], 'pulled out');
  synth.setInput('pitch', /** @type {any} */ ({ connect: 'no' }));
  assert.equal(synth.inputs.pitch, null, 'not a node: nothing');
});

test("its modulations out to another instrument (the keyboard's ROTARY in): the LFO as it is, and the filter envelope of the voice started last; the voices made for them once there is sound", () => {
  const { sound, synth } = make();
  let built = 0;
  synth.onBuilt = () => built++;
  assert.equal(synth.modOutput('lfo'), null, 'no sound yet');
  assert.equal(synth.modOutput('env'), null);
  sound.wake();
  const lfo = synth.modOutput('lfo'), envs = synth.modOutput('env');
  assert.equal(built, 1, 'the voices made for them');
  assert.equal(lfo, synth._graph.lfo);
  assert.equal(envs, synth._graph.envs);
  assert.equal(synth.modOutput('env'), envs, 'the same each time');
  const voices = synth._voices;
  assert.ok(voices.every((v) => v.env.outputs.includes(v.tap) && v.tap.outputs.includes(envs)), 'each voice\'s through its tap');
  /** The voices whose taps are open at time t: as the switch set latest at or before it (of two at once, the last) left them. */
  const open = (t) => voices.filter((v) => {
    let x = v.tap.gain.value, at = -Infinity;
    for (const [kind, value, when] of v.tap.gain.events) if (kind === 'set' && when <= t && when >= at) [x, at] = [value, when];
    return x === 1;
  });
  assert.deepEqual(open(0), [], 'no voice started yet: none');
  synth.noteOn(60);
  const first = voices.find((v) => v.note === 60);
  assert.deepEqual(open(0), [first]);
  sound.ctx.currentTime = 1;
  synth.noteOn(64);
  const second = voices.find((v) => v.note === 64);
  assert.deepEqual(open(1), [second], 'the one started last, the one before no more');
  assert.deepEqual(open(0.5), [first], 'switched at its time');
  // A note set ahead (the sequencer's) switches at its own time, and one played before that goes
  // out till then.
  synth.seqStep(67, 0.8, 1.12, 1.2);
  const ahead = voices.find((v) => v.note === 67);
  assert.deepEqual(open(1.1), [second], 'set ahead: not before its time');
  assert.deepEqual(open(1.12), [ahead]);
  sound.ctx.currentTime = 1.05;
  synth.noteOn(72);
  const now = voices.find((v) => v.note === 72);
  assert.deepEqual(open(1.05), [now], 'played before it comes: till then');
  assert.deepEqual(open(1.2), [ahead], 'then the one started after it');
  sound.ctx.currentTime = 2;
  synth.noteOn(64);
  assert.deepEqual(open(2), [second], 'the same voice again');
  synth.setMono(true);
  synth.noteOn(48);
  assert.deepEqual(open(2), [voices[0]], 'in mono, the first voice\'s: the rest start with it');
});

test('in mono a key let go that isn\'t held here lets nothing go: the voices are another\'s (the sequencer\'s note held on)', () => {
  const { sound, synth } = make();
  synth.setMono(true);
  sound.wake();
  assert.equal(synth.seqStep(48, 0.8, 0, Infinity), true);
  const playing = () => synth._voices.filter((v) => v.started > -Infinity && v.ended === Infinity);
  const n = playing().length;
  assert.ok(n > 0);
  synth.noteOff(60);
  assert.equal(playing().length, n, 'played on');
  synth.noteOn(60);
  sound.ctx.currentTime = 1;
  synth.noteOff(60);
  assert.deepEqual(playing(), [], 'a key held here, let go: let go');
});

test('the arpeggiator: the keys make its chord, and each step plays its next note, set ahead and let go ARP_GATE of the step later', () => {
  const { sound, synth } = make();
  let arps = 0;
  synth.onArp = () => arps++;
  synth.setArp('up');
  assert.equal(synth.noteOn(64, 0.5), true);
  synth.noteOn(60, 0.9);
  assert.equal(arps, 1, 'the chord just started: its first note to play now');
  assert.deepEqual([...synth.held].sort(), [60, 64]);
  assert.ok(synth._voices.every((v) => v.started === -Infinity), 'the keys play nothing themselves');
  sound.ctx.currentTime = 1;
  assert.equal(synth.arpStep(1.02, 0.125), true);
  const first = synth._voices.find((v) => v.note === 60);
  assert.equal(first.ampEnv.t0, 1.02, 'set ahead, at its time');
  assert.ok(near(first.ampEnv.t1, 1.02 + 0.125 * ARP_GATE), 'let go ARP_GATE of the step later');
  synth.arpStep(1.145, 0.125);
  const second = synth._voices.find((v) => v.note === 64);
  assert.ok(second !== first && second.ampEnv.t0 === 1.145, 'a voice of its own, the last ringing on');
  assert.ok(second.ampEnv.peak < first.ampEnv.peak, 'as hard as its key went down');
  sound.ctx.currentTime = 2;
  synth.arpStep(1.5, 0.125);
  assert.equal(synth._voices.find((v) => v.ampEnv.t0 === 2)?.note, 60, 'a step whose time has gone: now');
  // The sustain pedal doesn't hold its notes.
  synth.setSustain(true);
  synth.arpStep(2.2, 0.125);
  assert.ok(synth._voices.some((v) => v.ampEnv.t0 === 2.2 && v.ampEnv.released(2.2 + 0.125 * ARP_GATE)));
  synth.setSustain(false);
  // The keys let go: nothing to play.
  synth.noteOff(60);
  synth.noteOff(64);
  assert.equal(synth.held.size, 0);
  assert.equal(synth.arpStep(3, 0.125), false);
  // In mono, every voice on the note, at once, started afresh each step (no legato, no glide).
  synth.setMono(true);
  synth.setKnob('glide', 0.5);
  synth.noteOn(62);
  sound.ctx.currentTime = 4;
  synth.arpStep(4, 0.1);
  synth.arpStep(4.1, 0.1);
  const voices = synth._voices;
  assert.ok(voices.every((v) => v.note === 62 && v.ampEnv.t0 === 4.1 && near(v.ampEnv.t1, 4.1 + 0.1 * ARP_GATE)));
  assert.ok(voices.every((v) => last(v.saw.detune)[0] === 'set'));
  // On its own clock: the first step of a chord at once.
  synth.noteOff(62);
  synth.setMono(false);
  synth.noteOn(65);
  sound.ctx.currentTime = 5;
  assert.equal(synth.arpRun(5, 5.12, 0.125), 1);
  assert.equal(synth._voices.find((v) => v.ampEnv.t0 === 5)?.note, 65);
  assert.equal(synth.arpRun(5.05, 5.17, 0.125), 1, 'the next a step later');
  assert.ok(synth._voices.some((v) => v.ampEnv.t0 === 5.125));
});

test('the arpeggiator: HOLD keeps the chord and taps come into it or leave; another way plays on; on or off lets every note go', () => {
  const { sound, synth } = make();
  let arps = 0, notes = 0;
  synth.onArp = () => arps++;
  synth.onNotes = () => notes++;
  synth.noteOn(60);
  assert.ok(synth._voices[0].gate);
  synth.setArp('up');
  assert.ok(!synth._voices[0].gate && synth._voices[0].ampEnv.released(0), 'turned on: the note held let go');
  assert.equal(synth.down.size, 0);
  notes = 0;
  synth.setHold(true);
  assert.equal(notes, 1);
  synth.tap(67);
  assert.equal(arps, 1);
  synth.tap(71);
  assert.deepEqual([...synth.held].sort(), [67, 71]);
  assert.equal(synth.down.size, 0, 'a tap holds no key down');
  synth.tap(67);
  assert.deepEqual([...synth.held], [71], 'tapped again: out');
  synth.noteOn(72);
  synth.noteOff(72);
  assert.deepEqual([...synth.held], [72], 'a key down with none held: a new chord, kept');
  synth.setArp('updown');
  assert.deepEqual([synth.arp.mode, [...synth.held]], ['updown', [72]], 'another way: the chord plays on');
  sound.ctx.currentTime = 1;
  synth.arpStep(1, 0.1);
  synth.setArp(null);
  assert.deepEqual([synth.arp.on, synth.held.size], [false, 0]);
  assert.ok(synth._voices.every((v) => v.ampEnv.released(1)), 'turned off: everything let go');
  // RANGE goes round its three, or is set.
  synth.setRange();
  assert.equal(synth.arp.range, 2);
  synth.setRange(3);
  synth.setRange();
  assert.equal(synth.arp.range, 1);
});

test("the sequencer through its NOTES in: a step's note set ahead and let go when its step says; a slide held on into the next step and glided there, legato; a rest, or the sequencer stopping, lets it go", () => {
  const { sound, synth } = make();
  assert.equal(synth.seqStep(36, 0.62, 0, 0.1), false, 'no sound yet: nothing');
  const ctx = sound.wake();
  ctx.currentTime = 1;
  // A voice a step, started at its time and let go when its step says; no key holds it.
  assert.equal(synth.seqStep(36, 0.62, 1.05, 1.11), true);
  const first = synth._voices.find((v) => v.note === 36);
  assert.deepEqual([first.ampEnv.t0, first.ampEnv.t1, first.gate], [1.05, 1.11, false]);
  assert.equal(synth.down.size, 0);
  // An accent: harder.
  synth.seqStep(36, 1, 1.2, 1.26);
  const accented = synth._voices.find((v) => v.ampEnv.t0 === 1.2);
  assert.ok(accented !== first && accented.ampEnv.peak > first.ampEnv.peak);
  // A slide: held on, then the next step glides its voice to its note, not started again.
  synth.seqStep(36, 0.62, 1.4, Infinity);
  const slid = synth._voices.find((v) => v.ampEnv.t0 === 1.4);
  assert.ok(!slid.ampEnv.released(9), 'held on');
  synth.seqStep(48, 0.62, 1.55, 1.61);
  assert.deepEqual([slid.note, slid.ampEnv.t0, slid.ampEnv.t1], [48, 1.4, 1.61], 'the same voice, legato, let go when the next step says');
  assert.deepEqual(last(slid.saw.detune).slice(0, 3), ['target', (48 - 69) * 100, 1.55], 'glided to C3 from its step, its drift (none here) kept');
  assert.ok(near(slid.pitch.tau, Math.max(glideSeconds(synth.knobs.glide), SLIDE) / 3), 'over SLIDE at the least');
  assert.ok(synth._voices.filter((v) => v.ampEnv.t0 === 1.55).length === 0, 'no voice started for it');
  // GLIDE longer than SLIDE: its time.
  synth.setKnob('glide', 0.6);
  synth.seqStep(36, 0.62, 1.7, Infinity);
  synth.seqStep(43, 0.62, 1.85, 1.9);
  const glided = synth._voices.find((v) => v.note === 43);
  assert.ok(glideSeconds(0.6) > SLIDE && near(glided.pitch.tau, glideSeconds(0.6) / 3));
  // A rest after a slide lets the note held on go at the rest's time.
  synth.seqStep(41, 0.62, 2, Infinity);
  const held = synth._voices.find((v) => v.ampEnv.t0 === 2);
  assert.equal(synth.seqStep(-1, 0, 2.15, 2.2), false);
  assert.ok(held.ampEnv.released(2.15) && !held.ampEnv.released(2.149));
  // The sequencer stopped, or its cable pulled: a note held on let go now.
  synth.seqStep(43, 0.62, 3, Infinity);
  const ending = synth._voices.find((v) => v.ampEnv.t0 === 3);
  ctx.currentTime = 3.05;
  synth.seqEnd();
  assert.ok(ending.ampEnv.released(3.05) && !ending.ampEnv.released(3.04));
  synth.seqStep(45, 0.62, 3.2, 3.26);
  assert.equal(synth._voices.find((v) => v.note === 45).ampEnv.t0, 3.2, 'after it, started afresh');
  // A step whose time has gone: now; and the pedal doesn't hold its notes.
  ctx.currentTime = 4;
  synth.seqStep(38, 0.62, 3.9, 4.05);
  assert.ok(synth._voices.some((v) => v.note === 38 && v.ampEnv.t0 === 4));
  synth.setSustain(true);
  synth.seqStep(40, 0.62, 4.2, 4.26);
  assert.ok(synth._voices.find((v) => v.ampEnv.t0 === 4.2).ampEnv.released(4.26));
  synth.setSustain(false);
  // Mono: the voices on the note together; a slide glides them all, legato; a key pressed between
  // takes them, so the next step starts afresh.
  synth.setMono(true);
  ctx.currentTime = 5;
  synth.seqStep(36, 0.62, 5, Infinity);
  const voices = synth._voices, stack = synth.knobs.detune > 0 ? VOICES : 1;
  assert.equal(voices.filter((v) => v.note === 36 && v.ampEnv.t0 === 5).length, stack);
  synth.seqStep(43, 0.62, 5.1, 5.16);
  assert.ok(voices.every((v) => v.note === 43));
  assert.ok(voices.slice(0, stack).every((v) => v.ampEnv.t0 === 5 && v.ampEnv.t1 === 5.16), 'legato, let go when the step says');
  synth.seqStep(36, 0.62, 5.3, Infinity);
  synth.noteOn(60);
  synth.noteOff(60);
  synth.seqStep(38, 0.62, 5.45, 5.5);
  assert.ok(voices.slice(0, stack).every((v) => v.note === 38 && v.ampEnv.t0 === 5.45), 'a key between: afresh');
  // Every note let go (the page put away): nothing held on.
  synth.seqStep(36, 0.62, 6, Infinity);
  synth.allOff();
  synth.seqStep(41, 0.62, 6.2, 6.3);
  assert.ok(voices.slice(0, stack).every((v) => v.ampEnv.t0 === 6.2));
});

test('the knobs, Mono, the preset, the octave and the arpeggiator are kept for the next visit, and what is kept is read with care', () => {
  const storage = memoryStorage();
  const { synth } = make({ storage });
  synth.choose('brass');
  synth.setKnob('cutoff', 0.66);
  synth.setOctave(-1);
  synth.setArp('random');
  synth.setHold(true);
  synth.setRange(2);
  synth.save();
  const again = make({ storage }).synth;
  assert.deepEqual([again.preset, again.edited, again.mono, again.octave, again.knobs.cutoff], ['brass', true, false, -1, 0.66]);
  assert.deepEqual([again.arp.mode, again.arp.hold, again.arp.range], ['random', true, 2]);
  storage.map.set('synth', JSON.stringify({ knobs: { cutoff: 7, saw: 'loud' }, mono: 'yes', preset: 'nope', octave: 12, arp: { mode: 'sideways', hold: 'yes', range: 9 } }));
  const odd = make({ storage }).synth;
  assert.deepEqual([odd.knobs.cutoff, odd.knobs.saw, odd.mono, odd.preset, odd.octave], [1, DEFAULT_SYNTH.saw, false, null, OCTAVES.max]);
  assert.deepEqual([odd.arp.mode, odd.arp.hold, odd.arp.range], [null, false, 3]);
  storage.map.set('synth', '{nonsense');
  assert.deepEqual(make({ storage }).synth.knobs, { ...DEFAULT_SYNTH });
  storage.refuse = true;
  assert.doesNotThrow(() => odd.save());
});
