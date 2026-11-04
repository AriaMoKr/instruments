// The guitar (guitar.js): its strings, frets and chords (each chord the notes its name says, its root
// lowest); its knobs, pickups and what each means, in numbers and in words; the amp's curve; its
// strings' processor asked for once the sound wakes and made only once loaded, what was played
// meanwhile told then (from now, as far apart, what waited too long let go), and nothing at all where
// there's no AudioWorklet; a pluck (as fretted, its note; a muted string's thud), a strum (down from
// the low E, up from the high E and the low strings less, faster the harder), a press, a tap, a
// slide, a bend, a release (the finger mutes it), a palm; a chord changed mutes what it fingers anew;
// MIDI notes on free strings at their lowest fret, folded into its range, stolen from the oldest;
// its amp and its pedals as a browser takes them (on test/helpers/audio.js's fake Web Audio), its
// knobs heard at once, its pedals switched at once and its WAH in into the wah; its notes out as they
// are played (plucked, slid, damped, plucked again, died away); and the settings kept for the next
// visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMP_SLOPE, CHORDS, CHORD_KEYS, DEFAULT_GUITAR, FINGER, FRETS, GUITAR_KNOBS, GUITAR_SECTIONS, GUITAR_STRINGS, Guitar, MAX_BEND, MUTED, PALM, PEDALS, PICKUPS,
  STRING_KEYS, WAH_CENTS, ampCurve, ampDrive, ampLevel, ampWords, chordName, chorusHz, chorusSwing, eqDb, guitarKnobName, guitarText, masterGain, overdriveGain, overdriveLevel,
  strumGap, toneHz, toneQ, tremoloHz, upShare, volumeGain, wahHz,
} from '../public/js/guitar.js';
import { TUNING, ringSeconds } from '../public/js/strings.js';
import { Sound } from '../public/js/sound.js';
import { FakeContext, FakeWorkletNode, memoryStorage } from './helpers/audio.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const last = (param) => param.events[param.events.length - 1];

/** The guitar on the fake Web Audio, the sound woken. */
function make({ storage = memoryStorage(), Worklet = FakeWorkletNode, wake = true } = {}) {
  const sound = new Sound({ Context: FakeContext, storage: null });
  const guitar = new Guitar(sound, { storage, Worklet, seed: 1 });
  const ctx = wake ? sound.wake() : null;
  return { sound, guitar, ctx };
}

/** The guitar, its strings' processor loaded and made. */
async function ready(o) {
  const m = make(o);
  const done = m.guitar.prepare();
  await m.ctx.audioWorklet.settle();
  assert.equal(await done, true);
  const node = m.ctx.all('worklet')[0];
  return { ...m, node };
}

/** Everything the strings were told, in order. */
const told = (node) => node.port.sent.flatMap((m) => (Array.isArray(m) ? m : [m]));
const plucks = (node) => told(node).filter((e) => e.type === 'pluck');

test('six strings, low E nearest, in standard tuning; fifteen frets', () => {
  assert.deepEqual(GUITAR_STRINGS.map((s) => s.note), [...TUNING]);
  for (const s of GUITAR_STRINGS) assert.ok(s.label && s.name, s.note);
  assert.equal(FRETS, 15);
  assert.deepEqual(STRING_KEYS, ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN']);
  assert.equal(CHORD_KEYS.length, CHORDS.length);
  assert.equal(new Set(CHORD_KEYS).size, CHORD_KEYS.length);
});

test('sixteen chords, each the notes its name says, its root lowest, all within the frets', () => {
  assert.equal(CHORDS.length, 16);
  assert.equal(new Set(CHORDS.map((c) => c.id)).size, 16);
  const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const KINDS = { major: [0, 4, 7], minor: [0, 3, 7], seven: [0, 4, 7, 10], 'power chord': [0, 7] };
  for (const c of CHORDS) {
    assert.equal(c.frets.length, 6, c.id);
    for (const f of c.frets) assert.ok(f === -1 || (Number.isInteger(f) && f >= 0 && f <= FRETS), c.id);
    const [root, kind] = [c.name[0], c.name.slice(2)];
    const notes = c.frets.flatMap((f, s) => (f < 0 ? [] : [TUNING[s] + f]));
    const classes = new Set(notes.map((n) => (n - NAMES[root] + 120) % 12));
    assert.deepEqual([...classes].sort((a, b) => a - b), KINDS[kind].filter((x) => classes.has(x)), `${c.id}: only its notes`);
    for (const x of KINDS[kind].filter((x) => x !== 7 || kind === 'power chord')) assert.ok(classes.has(x), `${c.id}: has ${x}`);
    assert.equal((Math.min(...notes) - NAMES[root] + 120) % 12, 0, `${c.id}: its root lowest`);
    assert.equal(chordName(c.id), c.name);
  }
  assert.equal(chordName(null), 'Open strings');
});

test('eleven knobs: the guitar its two, the amp its five, a pedal each its one, each as it comes 0…1; four pedals in the order heard; three pickups', () => {
  assert.deepEqual(GUITAR_KNOBS.map((k) => k.id), ['volume', 'tone', 'gain', 'bass', 'middle', 'treble', 'master', 'pedal', 'drive', 'rate', 'speed']);
  assert.deepEqual(GUITAR_SECTIONS.map((s) => s.id), ['guitar', 'amp', 'pedals']);
  assert.deepEqual(GUITAR_KNOBS.map((k) => k.section), ['guitar', 'guitar', 'amp', 'amp', 'amp', 'amp', 'amp', 'pedals', 'pedals', 'pedals', 'pedals']);
  assert.deepEqual(Object.keys(DEFAULT_GUITAR).sort(), GUITAR_KNOBS.map((k) => k.id).sort());
  for (const k of GUITAR_KNOBS) {
    assert.ok(DEFAULT_GUITAR[k.id] >= 0 && DEFAULT_GUITAR[k.id] <= 1, k.id);
    assert.ok(k.label === k.label.toUpperCase() && k.name, k.id);
  }
  assert.deepEqual(PEDALS.map((p) => p.id), ['wah', 'overdrive', 'chorus', 'tremolo']);
  assert.deepEqual(PEDALS.map((p) => p.knob), GUITAR_KNOBS.filter((k) => k.section === 'pedals').map((k) => k.id));
  for (const p of PEDALS) assert.ok(p.label === p.label.toUpperCase() && p.name, p.id);
  assert.deepEqual(PICKUPS.map((p) => p.id), ['neck', 'both', 'bridge']);
  assert.deepEqual(PICKUPS.map((p) => [p.neck > 0, p.bridge > 0]), [[true, false], [true, true], [false, true]]);
  assert.equal(guitarKnobName('gain'), 'Amp gain');
  assert.equal(guitarKnobName('tone'), 'Guitar tone');
  assert.deepEqual(PEDALS.map((p) => guitarKnobName(p.knob)), ['Wah pedal', 'Overdrive drive', 'Chorus rate', 'Tremolo speed']);
});

test('what the knobs mean, in numbers and in words', () => {
  assert.equal(volumeGain(0), 0);
  assert.equal(volumeGain(1), 1);
  assert.ok(near(toneHz(0), 1000) && near(toneHz(1), 5000));
  assert.ok(toneQ(0) < 0 && toneQ(1) > 3);
  assert.ok(near(ampDrive(0), 0.5, 2e-3) && near(ampDrive(1), 100, 1e-6));
  for (let k = 0.1; k <= 1; k += 0.1) assert.ok(ampDrive(k) > ampDrive(k - 0.1));
  assert.ok(ampLevel(1) < ampLevel(0));
  assert.equal(eqDb(0.5), 0);
  assert.equal(eqDb(0), -12);
  assert.equal(eqDb(1), 12);
  assert.equal(masterGain(0), 0);
  assert.deepEqual([0, 0.3, 0.5, 0.8, 1].map(ampWords), ['clean', 'clean', 'crunch', 'lead', 'lead']);
  assert.equal(guitarText('gain', 0.3), '30%, clean');
  assert.equal(guitarText('gain', 0.9), '90%, lead');
  assert.equal(guitarText('bass', 0.5), '0 dB');
  assert.equal(guitarText('treble', 0.75), '+6 dB');
  assert.equal(guitarText('middle', 0.25), '−6 dB');
  assert.equal(guitarText('volume', 0), 'off');
  assert.equal(guitarText('master', 0.6), '60%');
  assert.equal(guitarText('tone', 0.75), '75%');
  // The pedals': the wah's sweep, heel down to toe down, all of it a modulation of 1 into WAH; the
  // overdrive's drive; the chorus's sway, its pitch wavering by no more than 12 cents; the tremolo's.
  assert.ok(near(wahHz(0), 350) && near(wahHz(1), 2400, 1e-9));
  for (let k = 0.1; k <= 1; k += 0.1) assert.ok(wahHz(k) > wahHz(k - 0.1));
  assert.ok(near(2 ** (WAH_CENTS / 1200), 2400 / 350, 1e-9));
  assert.ok(near(overdriveGain(0), 10 ** (3 / 20)) && near(overdriveGain(1), 10 ** (36 / 20), 1e-9));
  // …made quieter the harder it is driven, never to nothing.
  for (let k = 0.1; k <= 1; k += 0.1) assert.ok(overdriveLevel(k) < overdriveLevel(k - 0.1) && overdriveLevel(k) > 0.1, k);
  assert.ok(near(chorusHz(0), 0.15) && near(chorusHz(1), 4.5, 1e-9));
  for (const k of [0, 0.4, 0.7, 1]) {
    const hz = chorusHz(k);
    assert.ok(chorusSwing(hz) > 0 && 2 * Math.PI * hz * chorusSwing(hz) <= 2 ** (12 / 1200) - 1, k);
  }
  assert.ok(near(tremoloHz(0), 1.5) && near(tremoloHz(1), 10, 1e-9));
  assert.equal(guitarText('pedal', 0), 'heel down');
  assert.equal(guitarText('pedal', 1), 'toe down');
  assert.equal(guitarText('pedal', 0.5), '50%');
  assert.equal(guitarText('drive', 0.25), '25%');
  assert.equal(guitarText('rate', 0), '0.15 Hz');
  assert.equal(guitarText('rate', 1), '4.5 Hz');
  assert.equal(guitarText('speed', 1), '10.0 Hz');
});

test("the amp's curve: a valve's, through 0, at most 1 either way, its tops clipped sooner; its slope at 0", () => {
  const c = ampCurve(2049), mid = 1024;
  assert.ok(Math.abs(c[mid]) < 1e-9);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] > c[i - 1], 'rising');
  assert.ok(Math.max(...c.map(Math.abs)) <= 1 + 1e-6);
  assert.ok(c[c.length - 1] < -c[0], 'its top lower than its bottom is deep');
  assert.ok(near((c[mid + 1] - c[mid - 1]) / (4 / 2048), AMP_SLOPE, 1e-3));
});

test("its strings' processor: asked for once the sound wakes, made once loaded, and its amp after it into its channel", async () => {
  const { guitar, ctx } = make();
  assert.equal(guitar.output(), null);
  const done = guitar.prepare();
  assert.equal(guitar.prepare(), done, 'once');
  assert.equal(ctx.audioWorklet.asked.length, 1);
  assert.match(ctx.audioWorklet.asked[0], /\/strings-worklet\.js$/);
  assert.equal(ctx.all('worklet').length, 0, 'not before it is loaded');
  await ctx.audioWorklet.settle();
  assert.equal(await done, true);
  const [node] = ctx.all('worklet');
  assert.equal(node.name, 'guitar-strings');
  assert.deepEqual(node.options.outputChannelCount, [1]);
  assert.equal(node.options.numberOfInputs, 0);
  assert.deepEqual(node.options.processorOptions.tuning, [...TUNING]);
  // Its way out: the strings through the pedals and the amp to its out, into the guitar's channel;
  // its valve and the overdrive's clipping worked out four times as finely.
  const out = guitar.output();
  let at = node, hops = 0;
  while (at !== out && at.outputs.length && hops++ < 30) at = at.outputs[0];
  assert.equal(at, out);
  assert.equal(out.outputs.length, 1);
  assert.equal(ctx.all('shaper').filter((s) => s.oversample === '4x').length, 2);
  // The pickups told first.
  assert.deepEqual(told(node)[0], { type: 'pickups', neck: 0.7, bridge: 0.7 });
});

test('played before its strings are made, it is heard once they are: from now, as far apart; what waited too long let go', async () => {
  const { guitar, ctx } = make();
  ctx.currentTime = 1;
  assert.equal(guitar.strum(true, 1), true);
  assert.equal(ctx.audioWorklet.asked.length, 1, 'asked for by the strum');
  ctx.currentTime = 1.2;
  guitar.pluck(5, 0.8);
  ctx.currentTime = 1.4;
  guitar.pluck(0, 0.8);
  ctx.currentTime = 1.65;
  await ctx.audioWorklet.settle();
  const node = ctx.all('worklet')[0], p = plucks(node);
  // The strum (at 1) waited longer than half a second: let go; the 1.2 and the 1.4 kept, the first from now.
  assert.equal(p.length, 2);
  assert.ok(near(p[0].at, 1.65) && p[0].string === 5);
  assert.ok(near(p[1].at, 1.85) && p[1].string === 0);
});

test("where there's no AudioWorklet (a page not served securely), its strings are silent and nothing waits", async () => {
  const { guitar, ctx } = make({ Worklet: null });
  assert.equal(guitar.pluck(0), false);
  assert.equal(await guitar.prepare(), false);
  assert.equal(guitar.broken, true);
  assert.equal(guitar.strum(true), false);
  assert.equal(ctx.all('worklet').length, 0);
  // A module that won't load: likewise.
  const m = make();
  const done = m.guitar.prepare();
  await m.ctx.audioWorklet.refuse();
  assert.equal(await done, false);
  assert.equal(m.guitar.broken, true);
  assert.equal(m.guitar.pluck(1), false);
});

test('a pluck as the string is fretted: open, the chord, a press; one the chord mutes, a short thud', async () => {
  const { guitar, ctx, node } = await ready();
  ctx.currentTime = 2;
  guitar.pluck(1, 0.6);
  assert.deepEqual(plucks(node).at(-1), { type: 'pluck', string: 1, note: 45, at: 2, velocity: 0.6, pick: 0.13 });
  guitar.choose('C');
  guitar.pluck(1);
  assert.equal(plucks(node).at(-1).note, 48);
  guitar.pluck(0, 0.6);
  const thud = plucks(node).at(-1);
  assert.equal(thud.note, 40);
  assert.ok(near(thud.velocity, 0.6 * MUTED.velocity) && thud.ring === MUTED.ring);
  assert.equal(guitar.noteOf(0), null);
  // Not a string: nothing.
  assert.equal(guitar.pluck(6), false);
  assert.equal(guitar.pluck(-1), false);
  assert.equal(guitar.pluck(1.5), false);
  // Its look: struck, dying away.
  assert.ok(guitar.level(1, 2) > 0.7 && guitar.level(1, 3) < guitar.level(1, 2.1));
});

test('a strum: down from the low E, up from the high E with the low strings less; faster the harder', async () => {
  const { guitar, ctx, node } = await ready();
  ctx.currentTime = 1;
  guitar.choose('G');
  guitar.strum(true, 1);
  let p = plucks(node).slice(-6);
  assert.deepEqual(p.map((e) => e.string), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(p.map((e) => e.note), [43, 47, 50, 55, 59, 67]);
  for (let i = 1; i < 6; i++) assert.ok(near(p[i].at - p[i - 1].at, strumGap(1)));
  guitar.strum(false, 0.5);
  p = plucks(node).slice(-6);
  assert.deepEqual(p.map((e) => e.string), [5, 4, 3, 2, 1, 0]);
  for (const e of p) assert.ok(near(e.velocity, 0.5 * upShare(e.string)));
  assert.ok(near(p[1].at - p[0].at, strumGap(0.5)));
  assert.ok(strumGap(1) < strumGap(0.5));
  // Set for a time (the clock's): from then.
  guitar.strum(true, 0.8, { at: 1.5, spread: 0.01 });
  p = plucks(node).slice(-6);
  assert.ok(near(p[0].at, 1.5) && near(p[5].at, 1.55));
});

test('pressed at a fret, plucked there; slid, bent and let go (the finger mutes it, the chord frets it again)', async () => {
  const { guitar, ctx, node } = await ready();
  let changed = 0;
  guitar.onStrings = () => changed++;
  ctx.currentTime = 1;
  guitar.choose('Am');
  guitar.press(2, 7, 0.9);
  assert.deepEqual(plucks(node).at(-1), { type: 'pluck', string: 2, note: 57, at: 1, velocity: 0.9, pick: 0.13 });
  assert.equal(guitar.fretOf(2), 7);
  guitar.slide(2, 9);
  assert.deepEqual(told(node).at(-1), { type: 'pitch', string: 2, note: 59, at: 1, glide: 0.012 });
  guitar.bend(2, 1);
  assert.deepEqual(told(node).at(-1), { type: 'pitch', string: 2, note: 60, at: 1, glide: 0.02 });
  guitar.bend(2, 5);
  assert.equal(guitar.bends[2], MAX_BEND);
  guitar.release(2);
  assert.deepEqual(told(node).at(-1), { type: 'damp', string: 2, at: 1, ring: FINGER });
  assert.equal(guitar.fretOf(2), 2, "the chord's again");
  assert.equal(guitar.bends[2], 0);
  assert.ok(changed >= 4);
  // A slide or a bend on a string not pressed: nothing.
  const n = told(node).length;
  guitar.slide(3, 5);
  guitar.bend(3, 1);
  guitar.release(3);
  assert.equal(told(node).length, n);
  // Pressed for a moment: let go by itself.
  guitar.tapFret(4, 3, 0.8, 0.01);
  assert.equal(guitar.pressed[4], 3);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(guitar.pressed[4], -1);
});

test('a chord changed mutes the strings it fingers anew; a palm mutes them all; none, the strings open', async () => {
  const { guitar, ctx, node } = await ready();
  ctx.currentTime = 1;
  guitar.choose('C');
  guitar.strum(true);
  const before = told(node).length;
  guitar.choose('Am');
  // C [-1,3,2,0,1,0] to Am [-1,0,2,2,1,0]: the A and the G strings move.
  assert.deepEqual(told(node).slice(before).map((e) => [e.type, e.string, e.ring]), [['damp', 1, FINGER], ['damp', 3, FINGER]]);
  assert.equal(guitar.choose('H'), false);
  assert.equal(guitar.chord, 'Am');
  // A palm: on the strings still ringing (the low E, muted, was a thud; the A and the G are damped).
  const n = told(node).length;
  guitar.damp();
  assert.deepEqual(told(node).slice(n).map((e) => [e.type, e.string, e.ring]), [['damp', 2, PALM], ['damp', 4, PALM], ['damp', 5, PALM]]);
  guitar.damp();
  assert.equal(told(node).length, n + 3);
  assert.equal(guitar.choose(null), true);
  assert.deepEqual(TUNING.map((_, s) => guitar.noteOf(s)), [...TUNING]);
  assert.equal(guitar.chordName, 'Open strings');
});

test('MIDI notes: on the free string where each is lowest, folded into its range, the oldest taken when none is free', async () => {
  const { guitar, ctx, node } = await ready();
  ctx.currentTime = 1;
  guitar.noteOn(60, 0.7); // C4: the B string's 1st fret
  guitar.noteOn(64, 0.7); // E4: the high E open
  guitar.noteOn(67, 0.7); // G4: the high E is taken; the B's 8th is, too; the G string's 12th
  assert.deepEqual(plucks(node).map((e) => [e.string, e.note]), [[4, 60], [5, 64], [3, 67]]);
  guitar.noteOn(28, 0.7); // E1: an octave up, twice: the low E open
  assert.deepEqual(plucks(node).at(-1), { type: 'pluck', string: 0, note: 40, at: 1, velocity: 0.7, pick: 0.13 });
  guitar.noteOn(91, 0.7); // G6: down to G5, only the high E's 15th: taken from 64
  assert.deepEqual([plucks(node).at(-1).string, plucks(node).at(-1).note], [5, 79]);
  guitar.noteOff(64); // no longer its string's: nothing
  assert.equal(guitar.pressed[5], 15);
  guitar.noteOff(91);
  assert.equal(guitar.pressed[5], -1);
  guitar.noteOff(60);
  assert.equal(guitar.pressed[4], -1);
  guitar.allOff();
  assert.ok(guitar.pressed.every((f) => f === -1));
});

test("the amp's knobs are heard at once, eased; the pickup told at once", async () => {
  const { guitar, ctx, node } = await ready();
  ctx.currentTime = 3;
  const [tone] = ctx.all('filter').filter((f) => f.type === 'lowpass');
  guitar.setKnob('tone', 0);
  assert.deepEqual(last(tone.frequency), ['target', 1000, 3, 0.012]);
  const gains = ctx.all('gain');
  guitar.setKnob('gain', 1);
  const pre = gains.find((g) => g.gain.events.some((e) => e[0] === 'target' && near(e[1], 100 / AMP_SLOPE)));
  assert.ok(pre, 'the drive into the valve');
  guitar.setKnob('bass', 1);
  const [bass] = ctx.all('filter').filter((f) => f.type === 'lowshelf');
  assert.deepEqual(last(bass.gain), ['target', 12, 3, 0.012]);
  guitar.setKnob('master', 0);
  assert.ok(gains.some((g) => near(last(g.gain)?.[1], 0) && last(g.gain)[0] === 'target'));
  guitar.setKnob('loudness', 1);
  guitar.setKnob('gain', NaN);
  assert.equal(guitar.knobs.gain, 1);
  assert.equal(guitar.setPickup('bridge'), true);
  assert.deepEqual(told(node).at(-1), { type: 'pickups', neck: 0, bridge: 1 });
  assert.equal(guitar.setPickup('middle'), false);
  assert.equal(guitar.pickupName, 'Bridge pickup');
});

test('its pedals: as made, all off, the guitar going by each as it came; switched on, through it, eased; their knobs heard at once', async () => {
  const m = make();
  let built = 0;
  m.guitar.onBuilt = () => built++;
  const done = m.guitar.prepare();
  await m.ctx.audioWorklet.settle();
  assert.equal(await done, true);
  assert.equal(built, 1, 'said once its sound can go where its cables go');
  const { guitar, ctx } = m, g = guitar._graph;
  assert.deepEqual(guitar.pedals, { wah: false, overdrive: false, chorus: false, tremolo: false });
  assert.deepEqual([g.wah.dry.gain.value, g.wah.wet.gain.value, g.overdrive.dry.gain.value, g.overdrive.wet.gain.value], [1, 0, 1, 0]);
  assert.deepEqual([g.chorus.dry.gain.value, ...g.chorus.wets.map((w) => w.gain.value)], [1, 0, 0]);
  assert.deepEqual([g.tremolo.gain.gain.value, g.tremolo.depth.gain.value], [1, 0]);
  // Its knobs as they are; the chorus's sway and the tremolo's going from the start.
  assert.ok(near(g.wah.band.frequency.value, wahHz(DEFAULT_GUITAR.pedal)) && g.wah.band.type === 'bandpass');
  assert.ok(near(g.chorus.sway.frequency.value, chorusHz(DEFAULT_GUITAR.rate)) && near(g.tremolo.sway.frequency.value, tremoloHz(DEFAULT_GUITAR.speed)));
  assert.equal(g.chorus.sway.started, 0);
  assert.equal(g.tremolo.sway.started, 0);
  // The chorus: the guitar to both sides, and a delay to each, swaying opposite ways.
  assert.equal(g.chorus.dry.outputs.length, 2);
  const delays = ctx.all('delay');
  assert.equal(delays.length, 2);
  assert.ok(delays.every((d) => d.delayTime.value > 0.005 && d.delayTime.value < 0.015));
  const [l, r] = g.chorus.swings.map((s) => s.gain.value);
  assert.ok(l > 0 && near(r, -l));
  // On: through it, eased (no click).
  ctx.currentTime = 2;
  assert.equal(guitar.setPedal('wah', true), true);
  assert.equal(last(g.wah.dry.gain)[0], 'target');
  assert.ok(last(g.wah.dry.gain)[1] < 0.2 && last(g.wah.wet.gain)[1] > 1, 'its band, made up, a little of the guitar beside it');
  guitar.setPedal('overdrive', true);
  assert.deepEqual([last(g.overdrive.dry.gain)[1], last(g.overdrive.wet.gain)], [0, ['target', overdriveLevel(DEFAULT_GUITAR.drive), 2, 0.012]]);
  guitar.setPedal('chorus', true);
  assert.ok(g.chorus.wets.every((w) => last(w.gain)[1] > 0));
  guitar.setPedal('tremolo', true);
  const base = last(g.tremolo.gain.gain)[1], depth = last(g.tremolo.depth.gain)[1];
  assert.ok(depth > 0 && base - depth > 0, 'beating, never to silence');
  assert.deepEqual(guitar.pedals, { wah: true, overdrive: true, chorus: true, tremolo: true });
  // Their knobs, at once.
  guitar.setKnob('pedal', 1);
  assert.deepEqual(last(g.wah.band.frequency), ['target', wahHz(1), 2, 0.012]);
  const before = g.overdrive.pre.gain.value;
  guitar.setKnob('drive', 1);
  assert.ok(near(last(g.overdrive.pre.gain)[1] / before, overdriveGain(1) / overdriveGain(DEFAULT_GUITAR.drive), 1e-9));
  assert.deepEqual(last(g.overdrive.wet.gain), ['target', overdriveLevel(1), 2, 0.012], 'as loud, driven harder');
  guitar.setKnob('rate', 1);
  assert.deepEqual(last(g.chorus.sway.frequency), ['target', chorusHz(1), 2, 0.012]);
  assert.deepEqual(g.chorus.swings.map((s) => last(s.gain)[1]), [chorusSwing(chorusHz(1)), -chorusSwing(chorusHz(1))]);
  guitar.setKnob('speed', 0);
  assert.deepEqual(last(g.tremolo.sway.frequency), ['target', tremoloHz(0), 2, 0.012]);
  // Off again: as it came.
  guitar.setPedal('wah', false);
  assert.deepEqual([last(g.wah.dry.gain), last(g.wah.wet.gain)], [['target', 1, 2, 0.012], ['target', 0, 2, 0.012]]);
  assert.equal(guitar.setPedal('fuzz', true), false);
  assert.equal(guitar.setPedal('wah', false), true);
});

test("its WAH in: a modulation into the wah's band (1, all of its sweep), connected once there is one, let go when unplugged", async () => {
  const m = make();
  const lfo = m.ctx.createGain(), env = m.ctx.createGain();
  m.guitar.setWahIn(lfo);
  assert.equal(m.guitar.wahIn, lfo);
  assert.equal(lfo.outputs.length, 0, 'nothing to connect to yet');
  const done = m.guitar.prepare();
  await m.ctx.audioWorklet.settle();
  await done;
  const g = m.guitar._graph;
  assert.equal(lfo.outputs.length, 1);
  assert.equal(lfo.outputs[0], g.wah.cv);
  assert.equal(g.wah.cv.gain.value, WAH_CENTS);
  assert.equal(g.wah.cv.outputs[0], g.wah.band.detune);
  m.guitar.setWahIn(env);
  assert.equal(lfo.outputs.length, 0);
  assert.equal(env.outputs[0], g.wah.cv);
  m.guitar.setWahIn(null);
  assert.equal(env.outputs.length, 0);
  assert.equal(m.guitar.wahIn, null);
});

test("its notes out: each string's from its pluck (a bend not told, a slide carried on), ended as it is damped or has died away; one plucked ahead, when it is", async () => {
  const { guitar, ctx } = await ready();
  const out = [];
  guitar.onNoteOut = (s, note, velocity, at) => out.push([s, note, velocity, at]);
  ctx.currentTime = 1;
  guitar.choose('Am');
  guitar.pluck(1, 0.7); // the A string open
  guitar.press(2, 7, 0.9); // the D string at its 7th fret
  assert.deepEqual(out.splice(0), [[1, 45, 0.7, 1], [2, 57, 0.9, 1]]);
  guitar.bend(2, 1);
  assert.deepEqual(out.splice(0), []);
  guitar.slide(2, 9);
  assert.deepEqual(out.splice(0), [[2, 59, null, 1]]);
  ctx.currentTime = 1.5;
  guitar.release(2); // the finger lifted: ended
  assert.deepEqual(out.splice(0), [[2, -1, null, 1.5]]);
  guitar.slide(2, 5); // not pressed: nothing
  guitar.pluck(0, 0.5); // the low E, which Am mutes: a thud, no note
  assert.deepEqual(out.splice(0), []);
  guitar.pluck(1, 0.6); // plucked again: its note anew (the one before ends there)
  assert.deepEqual(out.splice(0), [[1, 45, 0.6, 1.5]]);
  // Died away: half its ring after its pluck (to −30 dB), and not before.
  const gone = 1.5 + ringSeconds(45) / 2;
  guitar.ringOut(gone - 0.01);
  assert.deepEqual(out.splice(0), []);
  guitar.ringOut(gone);
  assert.deepEqual(out.splice(0), [[1, -1, null, gone]]);
  // A strum set ahead (the clock's): its notes from then; a palm now doesn't end them, a chord
  // changed once they sound ends those it fingers anew, and the rest when put away.
  guitar.choose(null);
  guitar.strum(true, 0.8, { at: 2, spread: 0 });
  assert.deepEqual(out.splice(0).map((e) => [e[0], e[1], e[3]]), [[0, 40, 2], [1, 45, 2], [2, 50, 2], [3, 55, 2], [4, 59, 2], [5, 64, 2]]);
  guitar.damp();
  assert.deepEqual(out.splice(0), []);
  ctx.currentTime = 2.1;
  guitar.choose('E5');
  assert.deepEqual(out.splice(0), [1, 2, 3, 4, 5].map((s) => [s, -1, null, 2.1]));
  guitar.pluck(1, 0.8); // E5's B on the A string, now
  guitar.pluck(0, 0.8, { at: 3 }); // the low E again, ahead
  assert.deepEqual(out.splice(0), [[1, 47, 0.8, 2.1], [0, 40, 0.8, 3]]);
  guitar.allOff();
  assert.deepEqual(out.splice(0), [[1, -1, null, 2.1], [0, -1, null, 3]]);
});

test('its knobs, its pedals, its pickup and its chord kept for the next visit; as it comes again', async () => {
  const storage = memoryStorage();
  const { guitar } = make({ storage });
  guitar.setKnob('gain', 0.8);
  guitar.setKnob('rate', 0.9);
  guitar.setPedal('chorus', true);
  guitar.setPickup('neck');
  guitar.choose('Em');
  guitar.save();
  const again = make({ storage }).guitar;
  assert.equal(again.knobs.gain, 0.8);
  assert.equal(again.knobs.rate, 0.9);
  assert.deepEqual(again.pedals, { wah: false, overdrive: false, chorus: true, tremolo: false });
  assert.equal(again.pickup, 'neck');
  assert.equal(again.chord, 'Em');
  assert.equal(again.noteOf(1), 47);
  again.reset();
  assert.deepEqual(again.knobs, { ...DEFAULT_GUITAR });
  assert.deepEqual(again.pedals, { wah: false, overdrive: false, chorus: false, tremolo: false });
  assert.equal(again.pickup, 'both');
  assert.equal(again.chord, null);
  // Not readable, or refused: as it comes, and no throw.
  assert.equal(make({ storage: memoryStorage({ guitar: '{' }) }).guitar.pickup, 'both');
  const refusing = memoryStorage();
  refusing.refuse = true;
  make({ storage: refusing }).guitar.save();
});
