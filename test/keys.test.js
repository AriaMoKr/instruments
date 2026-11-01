// The keyboard (keys.js): its knobs, sections, drawbars and switches; what each knob means, in
// numbers and in words; the organ (its drawbars' wave, the same loudness however hard, the
// percussion on a phrase's first key, the click, let go at once) and the electric piano (struck
// harder brighter and louder, lower notes ringing longer, the damper, a key struck again), each made
// as a browser takes it (on test/helpers/audio.js's fake Web Audio, which refuses what a browser
// would) with its first note and only then; both at once; the voices held at most; the sustain
// pedal; the knobs and the rotary speaker heard at once; a note played for a moment; and the settings
// kept for the next visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_KEYS, DEFAULT_SWITCHES, DRAWBARS, DRAWBAR_HARMONICS, KEYS_COUNT, KEYS_KNOBS, KEYS_LOWEST, KEYS_OCTAVES, KEYS_SECTIONS, KEYS_SOUNDS,
  KEYS_SWITCHES, KEYS_VOICES, Keys, ORGAN_OUT, PERC, ROTORS, ampAt, barkIndex, drawbarLevel, drawbarStep, drawbarWave, isDrawbar, keysKnobName,
  keysLevel, keysText, noteDecay, pianoDecay, registration, scannerDepth, scannerMix, switchWords, toneIndex, tremoloHz,
} from '../public/js/keys.js';
import { noteHz } from '../public/js/synth.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const last = (param) => param.events[param.events.length - 1];

/** The keyboard on the fake Web Audio, its clicks' dice in the middle. */
function make({ storage = memoryStorage(), Context = FakeContext } = {}) {
  const sound = new Sound({ Context, storage: null });
  const keys = new Keys(sound, { storage, random: () => 0.5 });
  return { sound, keys };
}

/** The oscillators sounding a frequency. */
const at = (ctx, hz) => ctx.all('oscillator').filter((o) => near(o.frequency.value, hz, 1e-6));

test('sixty-one keys from C2, middle C the 25th; three sounds; the octaves either way', () => {
  assert.equal(KEYS_COUNT, 61);
  assert.equal(KEYS_LOWEST, 36);
  assert.equal(KEYS_LOWEST + 24, 60);
  assert.deepEqual(KEYS_SOUNDS.map((s) => s.id), ['organ', 'epiano', 'both']);
  for (const s of KEYS_SOUNDS) assert.ok(s.label === s.label.toUpperCase() && s.name, s.id);
  assert.deepEqual(KEYS_OCTAVES, { min: -2, max: 1 });
  // The computer's keys (A to ', 18 notes from a C) stay on the keyboard either way.
  assert.ok(60 + 12 * KEYS_OCTAVES.min >= KEYS_LOWEST && 60 + 12 * KEYS_OCTAVES.max + 17 <= KEYS_LOWEST + KEYS_COUNT - 1);
});

test('twenty knobs in three sections, each section together and in order, each as it comes 0…1', () => {
  assert.equal(KEYS_KNOBS.length, 20);
  const ids = KEYS_KNOBS.map((k) => k.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.keys(DEFAULT_KEYS).sort(), [...ids].sort());
  for (const id of ids) assert.ok(DEFAULT_KEYS[id] >= 0 && DEFAULT_KEYS[id] <= 1, id);
  const order = KEYS_SECTIONS.map((s) => s.id);
  const seen = KEYS_KNOBS.map((k) => order.indexOf(k.section));
  assert.ok(!seen.includes(-1), 'every knob in a section');
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `${ids[i]}: its section together, in order`);
  for (const k of KEYS_KNOBS) assert.ok(k.label && k.name && k.label === k.label.toUpperCase(), k.id);
  assert.deepEqual(KEYS_SWITCHES.map((s) => s.id), ['perc', 'third', 'fast', 'rotaryFast']);
  assert.deepEqual(Object.keys(DEFAULT_SWITCHES).sort(), KEYS_SWITCHES.map((s) => s.id).sort());
});

test('nine drawbars, each a harmonic of the 16′, 3 dB a step, as an organist writes them', () => {
  assert.deepEqual(DRAWBARS, ['d16', 'd513', 'd8', 'd4', 'd223', 'd2', 'd135', 'd113', 'd1']);
  assert.deepEqual(DRAWBARS.map((id) => DRAWBAR_HARMONICS[id]), [1, 3, 2, 4, 6, 8, 10, 12, 16]);
  for (const id of DRAWBARS) assert.ok(isDrawbar(id));
  assert.ok(!isDrawbar('chorus'));
  assert.deepEqual([drawbarStep(0), drawbarStep(0.5), drawbarStep(1), drawbarStep(0.3), drawbarStep(2)], [0, 4, 8, 2, 8]);
  assert.equal(drawbarLevel(0), 0);
  assert.equal(drawbarLevel(8), 1);
  assert.ok(near(20 * Math.log10(drawbarLevel(7)), -3));
  assert.ok(near(20 * Math.log10(drawbarLevel(1)), -21));
  assert.equal(registration(DEFAULT_KEYS), '88 8000 000');
  assert.equal(registration({ ...DEFAULT_KEYS, d16: 0, d4: 0.75, d1: 0.5 }), '08 8600 004');
  const { real, imag } = drawbarWave(DEFAULT_KEYS);
  assert.equal(real.length, 17);
  assert.deepEqual([...real], new Array(17).fill(0));
  assert.deepEqual([...imag].map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0), [1, 2, 3], '16′, 8′ and 5⅓′');
  assert.ok([1, 2, 3].every((h) => near(imag[h], 1, 1e-6)));
});

test('what the knobs mean: each from its least to its most, rising, and in words', () => {
  assert.deepEqual([scannerDepth(0), scannerMix(0), keysLevel(0)], [0, 0, 0]);
  assert.ok(near(scannerDepth(1), 0.0005));
  assert.deepEqual([scannerMix(0.25), scannerMix(0.5), scannerMix(1)], [0.25, 0.5, 0.5], 'half and half from halfway up');
  assert.ok(near(pianoDecay(0), 0.4) && near(pianoDecay(1), 6.4));
  assert.ok(near(tremoloHz(0), 1.5) && tremoloHz(1) > 9 && tremoloHz(1) < 9.3);
  assert.ok(near(barkIndex(0, 1), 1) && near(barkIndex(1, 0), 1) && near(barkIndex(1, 1), 4));
  for (const f of [scannerDepth, keysLevel, toneIndex, pianoDecay, tremoloHz]) {
    for (let k = 0.1; k <= 1; k += 0.1) assert.ok(f(k) > f(k - 0.1), `${f.name} rises at ${k}`);
  }
  assert.ok(noteDecay(0.5, 36) > noteDecay(0.5, 60) && noteDecay(0.5, 60) > noteDecay(0.5, 96), 'lower notes ring longer');
  assert.ok(near(noteDecay(0.5, 90), pianoDecay(0.5) / 2), 'half as long two and a half octaves up');
  assert.equal(keysText('d16', 1), '8');
  assert.equal(keysText('d4', 0.25), '2');
  assert.equal(keysText('chorus', 0), 'off');
  assert.equal(keysText('rotary', 0.75), '75%');
  assert.equal(keysText('click', 0), 'none');
  assert.equal(keysText('decay', 0), '1.8 s');
  assert.equal(keysText('decay', 1), '29.5 s');
  assert.equal(keysText('rate', 0), '1.5 Hz');
  assert.equal(keysText('organLevel', 0.7), '70%');
  assert.equal(keysKnobName('d16'), 'Drawbar 16′');
  assert.equal(keysKnobName('organLevel'), 'Organ level');
  assert.equal(keysKnobName('pianoLevel'), 'Electric piano level');
  assert.equal(keysKnobName('rate'), 'Tremolo rate');
  assert.deepEqual([true, false].map((on) => switchWords('perc', on)), ['Percussion on', 'Percussion off']);
  assert.deepEqual([true, false].map((on) => switchWords('third', on)), ['Percussion on the third harmonic', 'Percussion on the second harmonic']);
  assert.deepEqual([true, false].map((on) => switchWords('fast', on)), ['Percussion dying away fast', 'Percussion dying away slowly']);
  assert.deepEqual([true, false].map((on) => switchWords('rotaryFast', on)), ['Rotary speaker fast', 'Rotary speaker slow']);
});

test('without Web Audio a key is still known down, and its knobs are set and kept', () => {
  const storage = memoryStorage();
  const sound = new Sound({ Context: null, storage: null });
  const keys = new Keys(sound, { storage });
  let told = 0;
  keys.onNotes = () => told++;
  assert.equal(keys.noteOn(60), false);
  assert.deepEqual([...keys.down], [60]);
  keys.noteOff(60);
  assert.equal(keys.down.size, 0);
  assert.equal(told, 2);
  keys.setKnob('tone', 0.9);
  keys.setSwitch('rotaryFast', true);
  keys.setSustain(true);
  keys.setSustain(false);
  keys.allOff();
  keys.save();
  const kept = JSON.parse(storage.map.get('keys'));
  assert.equal(kept.knobs.tone, 0.9);
  assert.equal(kept.switches.rotaryFast, true);
});

test('the organ is made with its first note, as a browser takes it, into the keys channel, and only once', () => {
  const { sound, keys } = make();
  assert.equal(sound.ctx, null, 'nothing made before a note');
  assert.equal(keys.noteOn(60), true);
  const ctx = sound.ctx;
  assert.ok(ctx instanceof FakeContext);
  const counts = () => ['oscillator', 'buffer', 'filter', 'merger', 'delay', 'shaper'].map((k) => ctx.all(k).length);
  // The scanner's sway and the two rotors, the note and its percussion; the click; the clicks' band
  // and the crossover's two; the rotary speaker's sides; the scanner and a delay a rotor a side; the
  // drive and the mixer's clipper.
  assert.deepEqual(counts(), [5, 1, 3, 1, 5, 2]);
  for (const s of [...ctx.all('oscillator'), ...ctx.all('buffer')]) assert.equal(s.started, 0);
  const channel = sound.channel('keys');
  assert.ok(ctx.nodes.some((n) => n.outputs.includes(channel)), 'into the keys channel');
  keys.noteOn(64);
  assert.deepEqual(counts(), [6, 2, 3, 1, 5, 2], 'a note and its click more, nothing else');
  // As it comes: the chorus half and half, the drive's gains, the rotary speaker three quarters in, slow.
  const g = keys._organ;
  assert.deepEqual([g.dry.gain.value, g.wet.gain.value], [0.5, 0.5]);
  assert.ok(near(g.depth.gain.value, scannerDepth(0.6)));
  assert.ok(near(g.pre.gain.value, 1.36 / 4) && near(g.post.gain.value, 1 / Math.sqrt(1.36)));
  assert.deepEqual([g.straight.gain.value, g.turning.gain.value], [0.25, 0.75]);
  assert.ok(near(g.level.gain.value, ORGAN_OUT * keysLevel(0.7)), 'as loud as the piano and the synth');
  assert.deepEqual([g.rotors.horn.frequency.value, g.rotors.drum.frequency.value], [ROTORS.horn.slow, ROTORS.drum.slow]);
  assert.equal(keys._piano, null, 'no piano until it plays');
});

test('an organ note: one oscillator an octave under, its drawbars\' wave, as loud however hard', () => {
  const { sound, keys } = make();
  keys.noteOn(60, 0.1);
  const ctx = sound.ctx;
  ctx.currentTime = 1;
  keys.noteOn(67, 1);
  const [a, b] = keys._voices;
  assert.deepEqual([a.engine, b.engine], ['organ', 'organ']);
  assert.equal(a.wave.type, 'custom');
  assert.ok(near(a.wave.frequency.value, noteHz(60) / 2, 1e-9));
  assert.equal(a.wave.wave, keys._organ.wave);
  assert.equal(a.wave.wave.normalized, false, 'as loud as its drawbars make it');
  assert.deepEqual(a.amp.gain.events[0], ['set', 0, 0]);
  assert.deepEqual(last(b.amp.gain).slice(0, 3), ['target', b.peak, 1]);
  assert.equal(a.peak, b.peak, 'struck softly or hard, as loud');
  assert.ok(near(ampAt(a, 0), 0) && near(ampAt(a, 0.5), a.peak, 1e-9), 'up at once');
});

test('the percussion: on a phrase\'s first key only, the third or the second, fast or slow, or none', () => {
  const { sound, keys } = make();
  keys.noteOn(60);
  const ctx = sound.ctx;
  const perc = (note, h) => at(ctx, noteHz(note) * h);
  assert.equal(perc(60, 3).length, 1, 'the first key: its third harmonic');
  const p = perc(60, 3)[0];
  const pg = ctx.nodes.find((n) => p.outputs.includes(n));
  assert.deepEqual(pg.gain.events, [['set', PERC.level, 0], ['target', 0, 0, PERC.fast]]);
  assert.ok(near(p.stopped, 10 * PERC.fast));
  assert.ok(pg.outputs.includes(keys._voices[0].amp), 'through its note: let go with it');
  keys.noteOn(64);
  assert.equal(perc(64, 3).length, 0, 'a key pressed while another is held: none');
  keys.noteOff(60);
  keys.noteOff(64);
  ctx.currentTime = 1;
  keys.setSwitch('third', false);
  keys.setSwitch('fast', false);
  keys.noteOn(67);
  assert.equal(perc(67, 2).length, 1, 'the second harmonic');
  const slow = ctx.nodes.find((n) => perc(67, 2)[0].outputs.includes(n));
  assert.deepEqual(last(slow.gain), ['target', 0, 1, PERC.slow]);
  keys.noteOff(67);
  keys.setSwitch('perc', false);
  keys.noteOn(72);
  assert.equal(perc(72, 2).length + perc(72, 3).length, 0, 'off: none');
});

test('the click: a little of the noise as a key goes down, and less as it comes up, or none', () => {
  const { sound, keys } = make();
  keys.noteOn(60);
  const ctx = sound.ctx;
  const [down] = ctx.all('buffer');
  assert.equal(down.buffer, sound.noise);
  assert.ok(near(down.started, 0) && near(down.stopped, 0.012));
  const amp = (src) => ctx.nodes.find((n) => src.outputs.includes(n));
  assert.ok(amp(down).outputs.includes(keys._organ.clicks));
  ctx.currentTime = 0.5;
  keys.noteOff(60);
  const up = ctx.all('buffer')[1];
  assert.ok(near(amp(up).gain.events[1][1], amp(down).gain.events[1][1] / 2), 'half as loud');
  keys.setKnob('click', 0);
  keys.noteOn(62);
  assert.equal(ctx.all('buffer').length, 2, 'none');
});

test('an organ note let go stops at once; pressed from two places it is one note', () => {
  const { sound, keys } = make();
  keys.noteOn(60);
  keys.noteOn(60);
  const ctx = sound.ctx;
  assert.equal(keys._voices.length, 1);
  const [v] = keys._voices;
  ctx.currentTime = 2;
  keys.noteOff(60);
  assert.deepEqual(last(v.amp.gain), ['target', 0, 2, 0.005]);
  assert.ok(v.sources.every((s) => near(s.stopped, 2 + 7 * 0.005)));
  assert.ok(near(ampAt(v, 2.005), v.relFrom * Math.exp(-1)));
});

test('the sustain pedal holds the notes let go until it is let go too', () => {
  const { sound, keys } = make();
  keys.setSustain(true);
  keys.noteOn(60);
  const ctx = sound.ctx;
  ctx.currentTime = 1;
  keys.noteOff(60);
  const [v] = keys._voices;
  assert.ok(v.held && !v.gate && v.rel === Infinity, 'held');
  assert.equal(keys.down.size, 0, 'its key is up');
  keys.noteOn(60);
  assert.equal(keys._voices.length, 1, 'pressed again while held: the same note');
  assert.ok(v.gate && !v.held);
  keys.noteOff(60);
  ctx.currentTime = 2;
  keys.setSustain(false);
  assert.deepEqual(last(v.amp.gain), ['target', 0, 2, 0.005]);
});

test('the drawbars heard at once: a new wave on every organ note sounding, each drawbar in eighths', () => {
  const { sound, keys } = make();
  keys.noteOn(60);
  keys.noteOn(64);
  const waves = () => keys._voices.map((v) => v.wave.wave);
  const before = keys._organ.wave;
  keys.setKnob('d4', 0.3);
  assert.equal(keys.knobs.d4, 0.25);
  assert.equal(keys.registration, '88 8200 000');
  const after = keys._organ.wave;
  assert.notEqual(after, before);
  assert.ok(near(after.imag[4], drawbarLevel(2), 1e-6));
  assert.deepEqual(waves(), [after, after]);
  keys.setKnob('d4', 0.26);
  assert.equal(keys._organ.wave, after, 'the same step: the same wave');
  assert.equal(sound.ctx.all('oscillator').length, 6, 'no new oscillators');
});

test('the organ\'s knobs heard at once, eased; the rotary speaker speeding up and slowing down at its own pace', () => {
  const { sound, keys } = make();
  keys.noteOn(60);
  const ctx = sound.ctx, g = keys._organ;
  ctx.currentTime = 3;
  keys.setKnob('chorus', 0);
  assert.deepEqual([last(g.depth.gain), last(g.dry.gain), last(g.wet.gain)], [['target', 0, 3, 0.012], ['target', 1, 3, 0.012], ['target', 0, 3, 0.012]]);
  keys.setKnob('rotary', 0);
  assert.deepEqual([last(g.straight.gain)[1], last(g.turning.gain)[1]], [1, 0]);
  keys.setKnob('organLevel', 1);
  assert.ok(near(last(g.level.gain)[1], ORGAN_OUT * 1.2));
  keys.setKnob('drive', 1);
  assert.ok(near(last(g.pre.gain)[1], 10 / 4) && near(last(g.post.gain)[1], 1 / Math.sqrt(10)));
  keys.setSwitch('rotaryFast', true);
  assert.deepEqual(last(g.rotors.horn.frequency), ['target', ROTORS.horn.fast, 3, ROTORS.horn.ramp]);
  assert.deepEqual(last(g.rotors.drum.frequency), ['target', ROTORS.drum.fast, 3, ROTORS.drum.ramp]);
  assert.ok(ROTORS.drum.ramp > ROTORS.horn.ramp, 'the drum, heavier, takes longer');
  ctx.currentTime = 4;
  keys.setSwitch('rotaryFast', false);
  assert.deepEqual(last(g.rotors.horn.frequency), ['target', ROTORS.horn.slow, 4, ROTORS.horn.ramp]);
  // Each rotor heard on each side: louder and sooner as it faces it, the other side the other way.
  for (const name of ['horn', 'drum']) {
    const rotor = g.rotors[name], R = ROTORS[name];
    const by = ctx.nodes.filter((n) => rotor.outputs.includes(n)).map((n) => n.gain.value).sort((x, y) => x - y);
    assert.deepEqual(by.map((v) => Math.round(v * 1e6)), [-R.am, -R.sway, R.sway, R.am].sort((x, y) => x - y).map((v) => Math.round(v * 1e6)));
  }
});

test('an electric piano note: struck harder brighter and louder, lower notes ringing longer, the damper', () => {
  const { sound, keys } = make();
  keys.choose('epiano');
  keys.noteOn(60, 0.2);
  const ctx = sound.ctx;
  ctx.currentTime = 1;
  keys.noteOn(64, 1);
  const [soft, hard] = keys._voices;
  assert.deepEqual([soft.engine, hard.engine], ['piano', 'piano']);
  assert.equal(keys._organ, null, 'no organ until it plays');
  const [carrier, mod, tine] = hard.sources;
  assert.ok(near(carrier.frequency.value, noteHz(64), 1e-9) && near(mod.frequency.value, noteHz(64), 1e-9));
  assert.ok(near(tine.frequency.value, 7 * noteHz(64), 1e-9));
  const into = (v) => ctx.nodes.filter((n) => n.outputs.includes(v.sources[0].frequency));
  const index = (v) => into(v)[0].gain.events[0][1] / noteHz(v.note);
  assert.ok(near(index(hard), toneIndex(0.5) * barkIndex(0.5, 1), 1e-9));
  assert.ok(index(hard) > index(soft), 'harder: brighter');
  assert.ok(hard.peak > soft.peak, 'harder: louder');
  assert.ok(near(hard.tau, noteDecay(0.6, 64)));
  assert.deepEqual(hard.amp.gain.events.map((e) => e[0]), ['set', 'linear', 'target']);
  keys.noteOn(36, 1);
  keys.noteOn(96, 1);
  const [low, high] = keys._voices.slice(2);
  assert.ok(low.end - low.started > high.end - high.started, 'lower notes ring longer');
  ctx.currentTime = 1.5;
  keys.noteOff(64);
  assert.deepEqual(last(hard.amp.gain), ['target', 0, 1.5, 0.045]);
  assert.ok(hard.sources.every((s) => near(s.stopped, 1.5 + 7 * 0.045)));
  assert.ok(near(ampAt(hard, 1.5), hard.relFrom));
});

test('an electric piano key struck again cuts the note it rang', () => {
  const { sound, keys } = make();
  keys.choose('epiano');
  keys.noteOn(60);
  const ctx = sound.ctx;
  ctx.currentTime = 0.5;
  keys.noteOn(60);
  const [first, again] = keys._voices;
  assert.deepEqual(last(first.amp.gain), ['target', 0, 0.5, 0.003]);
  assert.ok(first.sources.every((s) => near(s.stopped, 0.52)));
  assert.equal(again.rel, Infinity);
  assert.ok(near(first.relFrom, ampAt({ ...first, rel: Infinity }, 0.5)), 'from where it had got to');
});

test('the piano made with its first note: its tremolo pans it, one side as loud as the other is soft', () => {
  const { sound, keys } = make();
  keys.choose('epiano');
  keys.noteOn(60);
  const ctx = sound.ctx, p = keys._piano;
  assert.deepEqual(p.sides.map((s) => Math.round(s.gain.value * 1000)), [825, 825]);
  assert.deepEqual(p.depths.map((d) => Math.round(d.gain.value * 1000)), [175, -175]);
  assert.ok(near(p.lfo.frequency.value, tremoloHz(0.45)));
  assert.equal(ctx.all('merger').length, 1);
  ctx.currentTime = 2;
  keys.setKnob('tremolo', 1);
  assert.deepEqual(p.sides.map((s) => last(s.gain)[1]), [0.5, 0.5]);
  assert.deepEqual(p.depths.map((d) => last(d.gain)[1]), [0.5, -0.5]);
  keys.setKnob('rate', 1);
  assert.ok(near(last(p.lfo.frequency)[1], tremoloHz(1)));
});

test('both at once: a key plays the organ and the piano', () => {
  const { keys } = make();
  keys.choose('both');
  assert.equal(keys.name, 'Organ and electric piano');
  keys.noteOn(60);
  assert.deepEqual(keys._voices.map((v) => v.engine), ['organ', 'piano']);
  keys.noteOff(60);
  assert.ok(keys._voices.every((v) => v.rel !== Infinity), 'both let go');
});

test('choosing a sound lets every note go first; another word changes nothing', () => {
  const { keys } = make();
  assert.equal(keys.name, 'Organ');
  keys.noteOn(60);
  let told = 0;
  keys.onNotes = () => told++;
  assert.equal(keys.choose('harpsichord'), false);
  assert.equal(keys.choice, 'organ');
  assert.equal(keys.choose('organ'), true);
  assert.equal(keys.down.size, 1, 'the same sound: nothing let go');
  assert.equal(keys.choose('epiano'), true);
  assert.equal(keys.choice, 'epiano');
  assert.equal(keys.down.size, 0);
  assert.equal(told, 1);
  assert.ok(keys._voices[0].rel !== Infinity);
  assert.equal(keys.name, 'Electric piano');
});

test('sixteen notes held at most for each sound: past it the oldest is cut, one whose key is up first', () => {
  const { sound, keys } = make();
  keys.choose('epiano');
  for (let i = 0; i < KEYS_VOICES; i++) keys.noteOn(48 + i);
  const ctx = sound.ctx;
  ctx.currentTime = 0.1;
  keys.noteOn(48 + KEYS_VOICES);
  const cut = keys._voices.filter((v) => v.rel !== Infinity);
  assert.deepEqual(cut.map((v) => v.note), [48], 'the oldest');
  keys.setSustain(true);
  keys.noteOff(55);
  ctx.currentTime = 0.2;
  keys.noteOn(80);
  assert.ok(!keys._voices.some((v) => v.note === 48), 'the one cut gone once it has');
  assert.deepEqual(keys._voices.filter((v) => v.rel !== Infinity).map((v) => v.note), [55], 'one whose key is up, held by the pedal');
});

test('a note played for a moment is let go a moment later, unless its key is pressed again first', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { keys } = make();
  keys.tap(60);
  assert.deepEqual([...keys.down], [60]);
  t.mock.timers.tick(200);
  keys.tap(60);
  t.mock.timers.tick(200);
  assert.deepEqual([...keys.down], [60], 'pressed again: the first let-go forgotten');
  t.mock.timers.tick(200);
  assert.equal(keys.down.size, 0);
  keys.tap(62);
  keys.noteOn(62);
  t.mock.timers.tick(1000);
  assert.deepEqual([...keys.down], [62], 'held after a tap: held');
  keys.tap(64);
  keys.allOff();
  assert.equal(keys.down.size, 0);
});

test('the knobs, the switches, the sound and the octave kept for the next visit, and reset', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = memoryStorage();
  const { keys } = make({ storage });
  keys.setKnob('d1', 1);
  keys.setKnob('tone', 0.8);
  keys.setKnob('bogus', 1);
  keys.setKnob('tone', NaN);
  keys.setSwitch('perc', false);
  keys.choose('both');
  keys.setOctave(-1);
  assert.equal(storage.map.get('keys'), undefined, 'not at once');
  t.mock.timers.tick(400);
  const again = new Keys(new Sound({ Context: FakeContext, storage: null }), { storage });
  assert.deepEqual([again.knobs.d1, again.knobs.tone, again.switches.perc, again.choice, again.octave], [1, 0.8, false, 'both', -1]);
  assert.equal(again.registration, '88 8000 008');
  again.setOctave(9);
  assert.equal(again.octave, KEYS_OCTAVES.max);
  again.reset();
  assert.deepEqual(again.knobs, { ...DEFAULT_KEYS });
  assert.deepEqual(again.switches, { ...DEFAULT_SWITCHES });
  assert.equal(again.choice, 'organ');
  const odd = memoryStorage({ keys: JSON.stringify({ knobs: { d16: 'x', d8: 0.6, tone: 2 }, switches: { perc: 'yes' }, choice: 'tuba', octave: 9 }) });
  const read = new Keys(new Sound({ Context: null, storage: null }), { storage: odd });
  assert.deepEqual([read.knobs.d16, read.knobs.d8, read.knobs.tone, read.switches.perc, read.choice, read.octave], [1, 0.625, 1, true, 'organ', 1]);
  const broken = new Keys(new Sound({ Context: null, storage: null }), { storage: memoryStorage({ keys: '{' }) });
  assert.deepEqual(broken.knobs, { ...DEFAULT_KEYS });
  storage.refuse = true;
  assert.doesNotThrow(() => keys.save());
});
