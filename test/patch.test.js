// The patch (patch.js): the jacks (the clock's outputs, the drums' clock input and an output for
// each pad, the delay's input, the synth's patch bay, the rack's clock outputs, its sequencer's
// clock in and notes out, its delay's in, its LFO's out, its envelope's clock in, notes in and out,
// its mixer's four ins and its out, its filter's in, cutoff in and out and its reverb's in, the
// keyboard's sound out, notes out and rotary speed in), the patch the room comes with, what a cable
// can join (never a sound back round into itself), plugging and unplugging (an input takes one
// cable, an output feeds any number), onChange, and the patch kept for the next visit (what was kept
// but can't be plugged, as it comes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATCH, JACKS, Patch, padForJack } from '../public/js/patch.js';
import { CLOCK_OUTS, RACK_CLOCK_OUTS } from '../public/js/clock.js';
import { PADS } from '../public/js/drums.js';
import { MIXER_KNOBS } from '../public/js/mixer.js';
import { memoryStorage } from './helpers/audio.js';

/** The rack's cables as it comes: the sequencer's notes into the synth, the rack's clock into the sequencer. */
const RACK_CABLES = [{ from: 'seq.notes', to: 'synth.notes' }, { from: 'rack.x1', to: 'seq.clock' }];
/** The patch as the room comes with it. */
const AS_IT_COMES = [{ from: 'clock.x1', to: 'drums.clock' }, { from: 'clock.x1', to: 'synth.clock' }, ...RACK_CABLES];
/** The synth's jacks: id, label, dir, kind. */
const SYNTH_JACKS = [
  ['synth.out', 'OUT', 'out', 'audio'], ['synth.clock', 'CLOCK', 'in', 'clock'],
  ['synth.lfo', 'LFO', 'out', 'mod'], ['synth.env', 'ENV', 'out', 'mod'],
  ['synth.pitch', 'PITCH', 'in', 'mod'], ['synth.cutoff', 'CUTOFF', 'in', 'mod'], ['synth.amp', 'AMP', 'in', 'mod'],
  ['synth.notes', 'NOTES', 'in', 'notes'],
];
/**
 * The rack's jacks: its clock's outputs, the sequencer's clock in and notes out, the delay's in, the
 * LFO's out, the envelope's clock in, notes in and out, the mixer's four ins and its out, the
 * filter's in, cutoff in and out, the reverb's in.
 */
const RACK_JACKS = [
  ['rack.x1', '×1', 'out', 'clock'], ['rack.d2', '÷2', 'out', 'clock'], ['rack.d4', '÷4', 'out', 'clock'],
  ['seq.clock', 'CLOCK', 'in', 'clock'], ['seq.notes', 'NOTES', 'out', 'notes'],
  ['rackdelay.in', 'IN', 'in', 'audio'], ['lfo.out', 'OUT', 'out', 'mod'],
  ['env.clock', 'CLOCK', 'in', 'clock'], ['env.notes', 'NOTES', 'in', 'notes'], ['env.out', 'OUT', 'out', 'mod'],
  ['mixer.in1', 'IN 1', 'in', 'audio'], ['mixer.in2', 'IN 2', 'in', 'audio'], ['mixer.in3', 'IN 3', 'in', 'audio'], ['mixer.in4', 'IN 4', 'in', 'audio'],
  ['mixer.out', 'OUT', 'out', 'audio'],
  ['filter.in', 'IN', 'in', 'audio'], ['filter.cutoff', 'CUTOFF', 'in', 'mod'], ['filter.out', 'OUT', 'out', 'audio'],
  ['reverb.in', 'IN', 'in', 'audio'],
];
/** The rack's modules. */
const RACK_MODULES = new Set(['rackclock', 'seq', 'rackdelay', 'lfo', 'env', 'mixer', 'filter', 'reverb']);
/** The keyboard's jacks: its sound out, its notes out, its rotary speaker's speed in. */
const KEYS_JACKS = [['keys.out', 'OUT', 'out', 'audio'], ['keys.notes', 'NOTES', 'out', 'notes'], ['keys.rotary', 'ROTARY', 'in', 'mod']];
/** Every input as kept with the patch as it comes, and `o` changed. */
const kept = (o = {}) => ({
  'drums.clock': 'clock.x1', 'delay.in': null, 'synth.clock': 'clock.x1', 'synth.pitch': null, 'synth.cutoff': null, 'synth.amp': null,
  'synth.notes': 'seq.notes', 'seq.clock': 'rack.x1', 'rackdelay.in': null, 'env.clock': null, 'env.notes': null,
  'mixer.in1': null, 'mixer.in2': null, 'mixer.in3': null, 'mixer.in4': null, 'filter.in': null, 'filter.cutoff': null, 'reverb.in': null,
  'keys.rotary': null, ...o,
});

/** A patch kept nowhere, and each onChange it calls, as [to, from, was]. */
function noted(o = {}) {
  const patch = new Patch({ storage: null, ...o });
  const changes = [];
  patch.onChange = (to, from, was) => changes.push([to, from, was]);
  return { patch, changes };
}

test("the jacks: the clock's three outputs, the drums' clock input, an output for each pad in PADS's order, the delay's input, then the synth's patch bay, then the rack's, then the keyboard's; each id and each name once", () => {
  assert.deepEqual(JACKS.map((j) => j.id), [
    'clock.x1', 'clock.d2', 'clock.d4', 'drums.clock', ...PADS.map((p) => `pad.${p.id}`), 'delay.in', ...SYNTH_JACKS.map((j) => j[0]), ...RACK_JACKS.map((j) => j[0]),
    ...KEYS_JACKS.map((j) => j[0]),
  ]);
  assert.equal(new Set(JACKS.map((j) => j.id)).size, JACKS.length);
  assert.equal(new Set(JACKS.map((j) => j.name)).size, JACKS.length, "each said apart in the card's cables");
  assert.deepEqual(JACKS.filter((j) => j.module === 'clock').map((j) => [j.id, j.label, j.dir, j.kind]), [
    ['clock.x1', '×1', 'out', 'clock'], ['clock.d2', '÷2', 'out', 'clock'], ['clock.d4', '÷4', 'out', 'clock'],
  ]);
  assert.deepEqual(JACKS.filter((j) => j.module === 'clock').map((j) => j.id), CLOCK_OUTS.map((o) => o.id), "clock.js's outputs");
  assert.deepEqual(JACKS.filter((j) => j.id.startsWith('pad.')), PADS.map((p) => ({ id: `pad.${p.id}`, module: 'drums', name: `${p.name} out`, label: p.name, dir: 'out', kind: 'audio' })));
  assert.deepEqual(JACKS.filter((j) => j.module === 'synth').map((j) => [j.id, j.label, j.dir, j.kind]), SYNTH_JACKS);
  assert.deepEqual(JACKS.filter((j) => RACK_MODULES.has(j.module)).map((j) => [j.id, j.label, j.dir, j.kind]), RACK_JACKS);
  assert.deepEqual(JACKS.filter((j) => j.module === 'rackclock').map((j) => j.id), RACK_CLOCK_OUTS.map((o) => o.id), "clock.js's outputs on the rack");
  assert.deepEqual(JACKS.filter((j) => j.module === 'keys').map((j) => [j.id, j.label, j.dir, j.kind]), KEYS_JACKS);
  assert.deepEqual(JACKS.filter((j) => j.dir === 'in').map((j) => [j.id, j.module, j.kind]), [
    ['drums.clock', 'drums', 'clock'], ['delay.in', 'delay', 'audio'],
    ['synth.clock', 'synth', 'clock'], ['synth.pitch', 'synth', 'mod'], ['synth.cutoff', 'synth', 'mod'], ['synth.amp', 'synth', 'mod'],
    ['synth.notes', 'synth', 'notes'], ['seq.clock', 'seq', 'clock'], ['rackdelay.in', 'rackdelay', 'audio'],
    ['env.clock', 'env', 'clock'], ['env.notes', 'env', 'notes'], ...MIXER_KNOBS.map((k) => [`mixer.${k}`, 'mixer', 'audio']),
    ['filter.in', 'filter', 'audio'], ['filter.cutoff', 'filter', 'mod'], ['reverb.in', 'reverb', 'audio'], ['keys.rotary', 'keys', 'mod'],
  ]);
  for (const j of JACKS) {
    assert.ok(j.name && j.label, `${j.id}: a name and a label`);
    assert.ok(['in', 'out'].includes(j.dir) && ['clock', 'audio', 'mod', 'notes'].includes(j.kind), j.id);
  }
  // Which pad's sound comes out of a jack.
  assert.deepEqual(PADS.map((p) => padForJack(`pad.${p.id}`)), PADS.map((_, i) => i));
  assert.deepEqual(['clock.x1', 'delay.in', 'pad.nope', 'kick', '', null].map((id) => padForJack(id)), [-1, -1, -1, -1, -1, -1]);
  assert.ok(Object.isFrozen(JACKS) && Object.isFrozen(DEFAULT_PATCH));
});

test("the patch it comes with: the clock into the drums and the synth's arpeggiator, the rack's into its sequencer and the sequencer's notes into the synth, nothing into the delay or the synth's modulation; other defaults, as far as they can be plugged", () => {
  assert.deepEqual(DEFAULT_PATCH, { 'drums.clock': 'clock.x1', 'synth.clock': 'clock.x1', 'seq.clock': 'rack.x1', 'synth.notes': 'seq.notes' });
  const { patch } = noted();
  assert.equal(patch.jacks, JACKS);
  assert.equal(patch.source('drums.clock'), 'clock.x1');
  assert.equal(patch.source('synth.clock'), 'clock.x1');
  assert.equal(patch.source('seq.clock'), 'rack.x1');
  assert.equal(patch.source('synth.notes'), 'seq.notes');
  for (const id of ['delay.in', 'synth.pitch', 'synth.cutoff', 'synth.amp']) assert.equal(patch.source(id), null, id);
  assert.deepEqual(patch.cables(), AS_IT_COMES);
  assert.deepEqual(patch.targets('clock.x1'), ['drums.clock', 'synth.clock']);
  assert.deepEqual(patch.targets('rack.x1'), ['seq.clock']);
  assert.deepEqual(patch.targets('seq.notes'), ['synth.notes']);
  assert.deepEqual(patch.targets('clock.d2'), []);
  // An output, or a jack that isn't there, has no source; an input feeds nothing.
  assert.equal(patch.source('clock.x1'), null);
  assert.equal(patch.source('nope'), null);
  assert.deepEqual(patch.targets('drums.clock'), []);
  assert.deepEqual(patch.jack('delay.in'), { id: 'delay.in', module: 'delay', name: 'Delay in', label: 'IN', dir: 'in', kind: 'audio' });
  assert.equal(patch.jack('nope'), undefined);
  // Other defaults: those a cable can join; the rest, nothing.
  const other = new Patch({ storage: null, defaults: { 'delay.in': 'pad.snare', 'drums.clock': 'pad.kick', 'pad.kick': 'delay.in', nope: 'clock.x1' } });
  assert.deepEqual(other.cables(), [{ from: 'pad.snare', to: 'delay.in' }]);
  other.plug('clock.d2', 'drums.clock');
  other.reset();
  assert.deepEqual(other.cables(), [{ from: 'pad.snare', to: 'delay.in' }], 'reset: back to them');
});

test('a cable joins an output to an input of its kind, either way round; never two outputs, two inputs, two kinds, or a jack that is not there', () => {
  const { patch } = noted();
  const can = [
    ['clock.x1', 'drums.clock'], ['clock.d4', 'drums.clock'], ['pad.kick', 'delay.in'], ['pad.ride', 'delay.in'],
    ['synth.out', 'delay.in'], ['clock.d2', 'synth.clock'], ['synth.lfo', 'synth.pitch'], ['synth.lfo', 'synth.amp'], ['synth.env', 'synth.cutoff'],
    ['seq.notes', 'synth.notes'], ['rack.d2', 'seq.clock'], ['clock.x1', 'seq.clock'], ['rack.x1', 'drums.clock'], ['rack.d4', 'synth.clock'],
  ];
  for (const [a, b] of can) assert.ok(patch.canPlug(a, b) && patch.canPlug(b, a), `${a}, ${b}`);
  const never = [
    ['clock.x1', 'clock.d2'], ['pad.kick', 'pad.snare'], ['drums.clock', 'delay.in'], ['clock.x1', 'delay.in'], ['pad.kick', 'drums.clock'],
    ['delay.in', 'delay.in'], ['clock.x1', 'clock.x1'], ['nope', 'delay.in'], ['pad.kick', 'nope'], ['', ''],
    ['synth.lfo', 'delay.in'], ['synth.out', 'synth.pitch'], ['pad.kick', 'synth.amp'], ['clock.x1', 'synth.cutoff'], ['synth.env', 'synth.clock'],
    ['synth.lfo', 'synth.env'], ['synth.pitch', 'synth.amp'], ['synth.out', 'synth.out'],
    ['seq.notes', 'delay.in'], ['seq.notes', 'seq.clock'], ['seq.notes', 'synth.pitch'], ['synth.out', 'synth.notes'], ['rack.x1', 'synth.notes'],
    ['synth.lfo', 'seq.clock'], ['rack.x1', 'clock.x1'], ['seq.clock', 'synth.notes'],
  ];
  for (const [a, b] of never) assert.ok(!patch.canPlug(a, b) && !patch.canPlug(b, a), `${a}, ${b}`);
});

test("plugged: an input's old cable comes out first, and an output feeds any number; the same cable again, or one that can't be, isn't plugged", () => {
  const { patch, changes } = noted();
  assert.equal(patch.plug('drums.clock', 'clock.d2'), true, 'either way round');
  assert.equal(patch.source('drums.clock'), 'clock.d2');
  assert.deepEqual(patch.targets('clock.x1'), ['synth.clock'], "the old cable out, the synth's still in");
  assert.equal(patch.plug('pad.snare', 'delay.in'), true);
  assert.equal(patch.plug('delay.in', 'pad.snare'), false, 'already there');
  assert.equal(patch.plug('clock.x1', 'delay.in'), false, 'a clock into sound');
  assert.equal(patch.plug('pad.kick', 'nope'), false);
  assert.equal(patch.source('delay.in'), 'pad.snare');
  assert.equal(patch.plug('pad.kick', 'delay.in'), true);
  assert.equal(patch.source('delay.in'), 'pad.kick', 'the snare out first');
  assert.deepEqual(patch.targets('pad.snare'), []);
  // One output into two inputs.
  assert.equal(patch.plug('reverb.in', 'pad.kick'), true);
  assert.deepEqual(patch.targets('pad.kick'), ['delay.in', 'reverb.in']);
  assert.deepEqual(patch.cables(), [
    { from: 'clock.d2', to: 'drums.clock' }, { from: 'pad.kick', to: 'delay.in' }, { from: 'clock.x1', to: 'synth.clock' }, ...RACK_CABLES,
    { from: 'pad.kick', to: 'reverb.in' },
  ]);
  // The synth's out into the delay takes the kick's place there; the LFO into two of its inputs.
  assert.equal(patch.plug('synth.out', 'delay.in'), true);
  assert.equal(patch.plug('synth.pitch', 'synth.lfo'), true);
  assert.equal(patch.plug('synth.lfo', 'synth.amp'), true);
  assert.deepEqual(patch.targets('pad.kick'), ['reverb.in']);
  assert.deepEqual(patch.targets('synth.lfo'), ['synth.pitch', 'synth.amp']);
  assert.equal(patch.plug('synth.env', 'synth.pitch'), true);
  assert.deepEqual([patch.source('synth.pitch'), patch.targets('synth.lfo')], ['synth.env', ['synth.amp']], 'the LFO out of the pitch first');
  assert.equal(changes.length, 8, 'one change for each cable plugged');
});

test('unplugged: the cable into an input, or every cable from an output; with nothing to pull out, nothing changes', () => {
  const { patch, changes } = noted();
  patch.plug('pad.clap', 'delay.in');
  patch.plug('pad.clap', 'reverb.in');
  changes.length = 0;
  assert.equal(patch.unplug('pad.clap'), true);
  assert.deepEqual(patch.targets('pad.clap'), []);
  assert.deepEqual(changes, [['delay.in', null, 'pad.clap'], ['reverb.in', null, 'pad.clap']], "each input's, in the jacks' order");
  assert.equal(patch.unplug('pad.clap'), false, 'none left');
  assert.equal(patch.unplug('drums.clock'), true);
  assert.equal(patch.source('drums.clock'), null);
  assert.deepEqual(patch.targets('clock.x1'), ['synth.clock']);
  assert.equal(patch.unplug('drums.clock'), false, 'none left');
  assert.equal(patch.unplug('clock.d4'), false, 'an output with no cables');
  assert.equal(patch.unplug('nope'), false);
  assert.deepEqual(changes.at(-1), ['drums.clock', null, 'clock.x1']);
  assert.equal(patch.unplug('clock.x1'), true, "the synth's too");
  assert.deepEqual(patch.cables(), RACK_CABLES, "the rack's own clock still into its sequencer");
  assert.deepEqual(changes.at(-1), ['synth.clock', null, 'clock.x1']);
  assert.equal(changes.length, 4);
  // The sequencer's notes out of the synth, from either end.
  assert.equal(patch.unplug('seq.notes'), true);
  assert.deepEqual(changes.at(-1), ['synth.notes', null, 'seq.notes']);
  assert.equal(patch.unplug('synth.notes'), false, 'none left');
  assert.deepEqual(patch.cables(), [RACK_CABLES[1]]);
});

test('onChange: once for each input whose cable changed, after it did, with where it comes from now and where before; reset too', () => {
  const patch = new Patch({ storage: null });
  const changes = [];
  patch.onChange = (to, from, was) => {
    assert.equal(patch.source(to), from, 'already changed');
    changes.push([to, from, was]);
  };
  patch.plug('clock.d4', 'drums.clock');
  patch.plug('delay.in', 'pad.cowbell');
  patch.plug('pad.crash', 'delay.in');
  assert.deepEqual(changes, [['drums.clock', 'clock.d4', 'clock.x1'], ['delay.in', 'pad.cowbell', null], ['delay.in', 'pad.crash', 'pad.cowbell']]);
  changes.length = 0;
  patch.reset();
  assert.deepEqual(changes, [['drums.clock', 'clock.x1', 'clock.d4'], ['delay.in', null, 'pad.crash']]);
  assert.deepEqual(patch.cables(), AS_IT_COMES);
  // Nothing changed, nothing said.
  changes.length = 0;
  patch.reset();
  patch.plug('clock.x1', 'drums.clock');
  patch.unplug('delay.in');
  patch.plug('clock.x1', 'delay.in');
  assert.deepEqual(changes, []);
});

test('the patch: kept at every change for the next visit, every input (one left empty as null), and read back', () => {
  const storage = memoryStorage();
  const patch = new Patch({ storage, key: 'room.patch' });
  assert.equal(storage.map.size, 0, 'nothing until a change');
  patch.unplug('drums.clock');
  assert.deepEqual(JSON.parse(storage.map.get('room.patch')), kept({ 'drums.clock': null }), 'at once');
  patch.plug('pad.rim', 'delay.in');
  patch.plug('synth.env', 'synth.cutoff');
  assert.deepEqual(JSON.parse(storage.map.get('room.patch')), kept({ 'drums.clock': null, 'delay.in': 'pad.rim', 'synth.cutoff': 'synth.env' }));
  const next = new Patch({ storage, key: 'room.patch' });
  assert.equal(next.source('drums.clock'), null, 'left empty on purpose, not the default');
  assert.equal(next.source('delay.in'), 'pad.rim');
  assert.equal(next.source('synth.cutoff'), 'synth.env');
  next.reset();
  assert.deepEqual(JSON.parse(storage.map.get('room.patch')), kept());
  assert.deepEqual(new Patch({ storage, key: 'room.patch' }).cables(), AS_IT_COMES);
  // A patch kept before the synth had jacks: its inputs as they come, and the rack's.
  const before = new Patch({ storage: memoryStorage({ patch: '{"drums.clock":"clock.d2","delay.in":"pad.kick"}' }) });
  assert.deepEqual(before.cables(), [{ from: 'clock.d2', to: 'drums.clock' }, { from: 'pad.kick', to: 'delay.in' }, { from: 'clock.x1', to: 'synth.clock' }, ...RACK_CABLES]);
  // One kept before the rack: its inputs as they come; the synth's kept as they were.
  const synthOnly = new Patch({ storage: memoryStorage({ patch: JSON.stringify({ ...kept({ 'synth.amp': 'synth.lfo' }), 'synth.notes': undefined, 'seq.clock': undefined, 'rackdelay.in': undefined }) }) });
  assert.deepEqual(synthOnly.cables(), [AS_IT_COMES[0], AS_IT_COMES[1], { from: 'synth.lfo', to: 'synth.amp' }, ...RACK_CABLES]);
  // One kept before the rack's delay and LFO: its delay's in as it comes (nothing), the rest as kept.
  const noDelay = new Patch({ storage: memoryStorage({ patch: JSON.stringify({ ...kept({ 'seq.clock': 'rack.d2' }), 'rackdelay.in': undefined }) }) });
  assert.deepEqual(noDelay.cables(), [AS_IT_COMES[0], AS_IT_COMES[1], RACK_CABLES[0], { from: 'rack.d2', to: 'seq.clock' }]);
  // One kept before the keyboard's jacks: its ROTARY in as it comes (nothing), the rest as kept.
  const noKeys = new Patch({ storage: memoryStorage({ patch: JSON.stringify({ ...kept({ 'synth.amp': 'lfo.out' }), 'keys.rotary': undefined }) }) });
  assert.deepEqual(noKeys.cables(), [...AS_IT_COMES.slice(0, 2), { from: 'lfo.out', to: 'synth.amp' }, ...RACK_CABLES]);
  assert.equal(noKeys.source('keys.rotary'), null);
  // One kept before the rack's filter and reverb: their ins as they come (nothing), the rest as kept.
  const noFilter = new Patch({ storage: memoryStorage({ patch: JSON.stringify({ ...kept({ 'rackdelay.in': 'keys.out' }), 'filter.in': undefined, 'filter.cutoff': undefined, 'reverb.in': undefined }) }) });
  assert.deepEqual(noFilter.cables(), [...AS_IT_COMES, { from: 'keys.out', to: 'rackdelay.in' }]);
  assert.deepEqual(['filter.in', 'filter.cutoff', 'reverb.in'].map((id) => noFilter.source(id)), [null, null, null]);
  // One kept before the rack's envelope and mixer: their ins as they come (nothing), the rest as kept.
  const newer = ['env.clock', 'env.notes', ...MIXER_KNOBS.map((k) => `mixer.${k}`)];
  const noMixer = new Patch({ storage: memoryStorage({ patch: JSON.stringify({ ...kept({ 'filter.in': 'synth.out' }), ...Object.fromEntries(newer.map((id) => [id, undefined])) }) }) });
  assert.deepEqual(noMixer.cables(), [...AS_IT_COMES, { from: 'synth.out', to: 'filter.in' }]);
  assert.deepEqual(newer.map((id) => noMixer.source(id)), newer.map(() => null));
});

test("the rack's envelope: a clock's pulses or notes into it, its out into any modulation in; its mixer: up to four sounds into it, its out wherever a sound goes, never back round into it", () => {
  const { patch, changes } = noted();
  for (const c of ['clock.x1', 'clock.d4', 'rack.x1', 'rack.d2']) assert.ok(patch.canPlug(c, 'env.clock'), c);
  for (const n of ['seq.notes', 'keys.notes']) assert.ok(patch.canPlug(n, 'env.notes'), n);
  for (const m of ['synth.pitch', 'synth.cutoff', 'synth.amp', 'keys.rotary', 'filter.cutoff']) assert.ok(patch.canPlug('env.out', m), m);
  for (const s of ['pad.kick', 'synth.out', 'keys.out', 'filter.out']) for (const k of MIXER_KNOBS) assert.ok(patch.canPlug(s, `mixer.${k}`), `${s} into ${k}`);
  for (const i of ['delay.in', 'rackdelay.in', 'filter.in', 'reverb.in']) assert.ok(patch.canPlug('mixer.out', i), i);
  const never = [
    ['env.out', 'env.clock'], ['env.out', 'env.notes'], ['env.out', 'delay.in'], ['env.out', 'mixer.in1'], ['env.clock', 'env.notes'],
    ['seq.notes', 'env.clock'], ['clock.x1', 'env.notes'], ['lfo.out', 'env.clock'], ['synth.out', 'env.notes'],
    ['mixer.out', 'mixer.in1'], ['mixer.out', 'mixer.in4'], ['mixer.out', 'filter.cutoff'], ['mixer.out', 'synth.notes'], ['mixer.in1', 'mixer.in2'],
    ['lfo.out', 'mixer.in2'], ['seq.notes', 'mixer.in3'], ['clock.x1', 'mixer.in4'],
  ];
  for (const [a, b] of never) assert.ok(!patch.canPlug(a, b) && !patch.canPlug(b, a), `${a}, ${b}`);
  // The sequencer's notes into the envelope as well as the synth; the envelope into the filter's
  // cutoff and the synth's.
  assert.ok(patch.plug('seq.notes', 'env.notes') && patch.plug('env.out', 'filter.cutoff') && patch.plug('synth.cutoff', 'env.out'));
  assert.deepEqual(patch.targets('seq.notes'), ['synth.notes', 'env.notes']);
  assert.deepEqual(patch.targets('env.out'), ['synth.cutoff', 'filter.cutoff']);
  // A pad, the synth and the keyboard into the mixer, and it through the filter: the filter's out
  // back into the mixer would go round; into the reverb it may go.
  assert.ok(patch.plug('pad.kick', 'mixer.in1') && patch.plug('synth.out', 'mixer.in2') && patch.plug('mixer.in3', 'keys.out') && patch.plug('mixer.out', 'filter.in'));
  assert.equal(patch.loops('filter.out', 'mixer.in4'), true);
  assert.equal(patch.plug('filter.out', 'mixer.in4'), false, 'the filter back into the mixer');
  assert.ok(patch.plug('filter.out', 'reverb.in'));
  assert.deepEqual(changes.slice(3), [
    ['mixer.in1', 'pad.kick', null], ['mixer.in2', 'synth.out', null], ['mixer.in3', 'keys.out', null], ['filter.in', 'mixer.out', null], ['reverb.in', 'filter.out', null],
  ]);
  // The filter's out into the mixer once the mixer no longer goes through it.
  assert.ok(patch.plug('keys.out', 'filter.in'));
  assert.ok(patch.plug('filter.out', 'mixer.in4'), 'the keyboard through the filter, into the mixer');
  assert.equal(patch.canPlug('mixer.out', 'filter.in'), false, 'and now the mixer into the filter would go round');
});

test("the rack's filter: any sound through it, its out into a delay or the reverb, a modulation into its cutoff; never its out back into its own in", () => {
  const { patch, changes } = noted();
  for (const s of ['pad.kick', 'synth.out', 'keys.out']) assert.ok(patch.canPlug(s, 'filter.in') && patch.canPlug('reverb.in', s), s);
  for (const i of ['delay.in', 'rackdelay.in', 'reverb.in']) assert.ok(patch.canPlug('filter.out', i), i);
  for (const m of ['synth.lfo', 'synth.env', 'lfo.out']) assert.ok(patch.canPlug(m, 'filter.cutoff'), m);
  const never = [
    ['filter.out', 'filter.in'], ['filter.out', 'filter.cutoff'], ['filter.out', 'synth.notes'], ['filter.out', 'keys.rotary'], ['filter.out', 'synth.out'],
    ['lfo.out', 'filter.in'], ['clock.x1', 'filter.in'], ['seq.notes', 'filter.in'], ['synth.out', 'filter.cutoff'], ['filter.in', 'reverb.in'],
    ['lfo.out', 'reverb.in'], ['clock.d2', 'filter.cutoff'],
  ];
  for (const [a, b] of never) assert.ok(!patch.canPlug(a, b) && !patch.canPlug(b, a), `${a}, ${b}`);
  assert.equal(patch.loops('filter.out', 'filter.in'), true);
  assert.equal(patch.plug('filter.in', 'filter.out'), false, 'its sound back into itself');
  assert.equal(changes.length, 0);
  // The synth through the filter, then into the reverb and the board's delay; the rack's LFO into its cutoff.
  assert.ok(patch.plug('synth.out', 'filter.in') && patch.plug('filter.out', 'reverb.in') && patch.plug('delay.in', 'filter.out'));
  assert.deepEqual(patch.targets('filter.out'), ['delay.in', 'reverb.in']);
  assert.ok(patch.plug('lfo.out', 'filter.cutoff'));
  assert.deepEqual(changes, [['filter.in', 'synth.out', null], ['reverb.in', 'filter.out', null], ['delay.in', 'filter.out', null], ['filter.cutoff', 'lfo.out', null]]);
  // A sound and the filter's out, side by side in the reverb's in: one takes the other's place.
  assert.ok(patch.plug('keys.out', 'reverb.in'));
  assert.deepEqual(patch.targets('filter.out'), ['delay.in']);
  assert.equal(patch.source('reverb.in'), 'keys.out');
});

test('no cable brings a sound back round into where it came from, through any number of modules; a modulation may go anywhere it can', () => {
  /** A module that passes sound on, as the filter does: an in and an out. */
  const passes = (m) => [
    { id: `${m}.in`, module: m, name: `${m} in`, label: 'IN', dir: 'in', kind: 'audio' },
    { id: `${m}.out`, module: m, name: `${m} out`, label: 'OUT', dir: 'out', kind: 'audio' },
  ];
  const jacks = [
    ...passes('a'), ...passes('b'), ...passes('c'),
    { id: 'a.mod', module: 'a', name: 'a mod in', label: 'MOD', dir: 'in', kind: 'mod' }, { id: 'a.lfo', module: 'a', name: 'a lfo', label: 'LFO', dir: 'out', kind: 'mod' },
  ];
  const { patch } = noted({ jacks, defaults: {} });
  assert.ok(patch.plug('a.out', 'b.in') && patch.plug('b.out', 'c.in'), 'a into b into c');
  assert.equal(patch.plug('c.out', 'a.in'), false, 'c back into a');
  assert.equal(patch.plug('c.out', 'b.in'), false, "c into b, in a's place: still round");
  assert.ok(patch.plug('a.lfo', 'a.mod'), 'a modulation of its own: no sound goes round');
  // a into c in b's place: b feeds nothing now, so c into b is no loop; b into a would be one.
  assert.ok(patch.plug('a.out', 'c.in'));
  assert.ok(patch.plug('c.out', 'b.in'));
  assert.equal(patch.canPlug('b.out', 'a.in'), false);
  assert.deepEqual(patch.cables(), [{ from: 'c.out', to: 'b.in' }, { from: 'a.out', to: 'c.in' }, { from: 'a.lfo', to: 'a.mod' }]);
  // A loop kept (by hand, or by a page before this one): the cable that would close it is left out.
  const storage = memoryStorage({ patch: JSON.stringify({ 'a.in': 'c.out', 'b.in': 'a.out', 'c.in': 'b.out' }) });
  assert.deepEqual(new Patch({ jacks, defaults: {}, storage }).cables(), [{ from: 'c.out', to: 'a.in' }, { from: 'a.out', to: 'b.in' }]);
});

test("the keyboard's jacks: its sound into either delay, its notes into the synth in the sequencer's place, and any modulation into its rotary speaker's speed", () => {
  const { patch, changes } = noted();
  assert.ok(patch.canPlug('keys.out', 'delay.in') && patch.canPlug('rackdelay.in', 'keys.out'));
  assert.ok(patch.canPlug('keys.notes', 'synth.notes'));
  for (const m of ['synth.lfo', 'synth.env', 'lfo.out']) assert.ok(patch.canPlug(m, 'keys.rotary'), m);
  const never = [
    ['keys.out', 'synth.notes'], ['keys.out', 'keys.rotary'], ['keys.out', 'synth.amp'], ['keys.notes', 'delay.in'], ['keys.notes', 'seq.clock'],
    ['keys.notes', 'keys.rotary'], ['keys.notes', 'seq.notes'], ['keys.rotary', 'synth.pitch'], ['clock.x1', 'keys.rotary'], ['synth.out', 'keys.rotary'],
    ['seq.notes', 'keys.rotary'], ['keys.out', 'synth.out'],
  ];
  for (const [a, b] of never) assert.ok(!patch.canPlug(a, b) && !patch.canPlug(b, a), `${a}, ${b}`);
  assert.ok(patch.plug('keys.notes', 'synth.notes'), "the keyboard's notes into the synth");
  assert.deepEqual(changes.at(-1), ['synth.notes', 'keys.notes', 'seq.notes'], "the sequencer's out first");
  assert.ok(patch.plug('keys.out', 'delay.in') && patch.plug('rackdelay.in', 'keys.out'), 'one sound into both delays');
  assert.deepEqual(patch.targets('keys.out'), ['delay.in', 'rackdelay.in']);
  assert.ok(patch.plug('lfo.out', 'keys.rotary') && patch.plug('lfo.out', 'synth.cutoff'), "the rack's LFO into the rotary speaker and the synth's cutoff");
  assert.ok(patch.plug('keys.rotary', 'synth.env'));
  assert.deepEqual(changes.at(-1), ['keys.rotary', 'synth.env', 'lfo.out'], "the synth's envelope in the LFO's place");
  assert.deepEqual(patch.targets('lfo.out'), ['synth.cutoff']);
  assert.ok(patch.unplug('keys.notes'));
  assert.equal(patch.source('synth.notes'), null);
});

test("the rack's delay takes sound (a pad's, the synth's), and its LFO goes where a modulation goes: the synth's pitch, cutoff and amp", () => {
  const { patch, changes } = noted();
  assert.ok(patch.canPlug('synth.out', 'rackdelay.in') && patch.canPlug('rackdelay.in', 'pad.clap'));
  assert.ok(!patch.canPlug('lfo.out', 'rackdelay.in') && !patch.canPlug('seq.notes', 'rackdelay.in') && !patch.canPlug('rack.x1', 'rackdelay.in'));
  for (const m of ['synth.pitch', 'synth.cutoff', 'synth.amp']) assert.ok(patch.canPlug('lfo.out', m), m);
  assert.ok(!patch.canPlug('lfo.out', 'seq.clock') && !patch.canPlug('lfo.out', 'delay.in') && !patch.canPlug('lfo.out', 'synth.lfo'));
  assert.ok(patch.plug('synth.out', 'rackdelay.in') && patch.plug('delay.in', 'synth.out'), 'one sound into both delays');
  assert.ok(patch.plug('lfo.out', 'synth.cutoff') && patch.plug('synth.amp', 'lfo.out'), 'one LFO into two inputs');
  assert.deepEqual(patch.targets('synth.out'), ['delay.in', 'rackdelay.in']);
  assert.deepEqual(patch.targets('lfo.out'), ['synth.cutoff', 'synth.amp']);
  assert.ok(patch.plug('synth.env', 'synth.cutoff'), 'the envelope in its place');
  assert.deepEqual(changes.slice(-1), [['synth.cutoff', 'synth.env', 'lfo.out']]);
  assert.ok(patch.unplug('lfo.out'));
  assert.deepEqual(patch.targets('lfo.out'), []);
});

test("what was kept but can't be plugged is as it comes, and so is an input not kept; storage that refuses or is blocked breaks nothing", () => {
  const read = (text) => new Patch({ storage: memoryStorage({ patch: text }) }).cables();
  assert.deepEqual(read('{"delay.in":"pad.tom"}'), AS_IT_COMES, 'a jack that is not there; the clock not kept');
  assert.deepEqual(read('{"delay.in":"clock.x1","drums.clock":"pad.kick"}'), AS_IT_COMES, 'the wrong kind');
  assert.deepEqual(read('{"drums.clock":"drums.clock","delay.in":5}'), AS_IT_COMES, 'an input, and not an id');
  assert.deepEqual(read('{"drums.clock":"clock.d4","pad.kick":"delay.in","nope":"clock.x1"}'), [{ from: 'clock.d4', to: 'drums.clock' }, ...AS_IT_COMES.slice(1)], 'what is not an input, left out');
  assert.deepEqual(read('{"synth.pitch":"synth.lfo","synth.amp":"synth.out","synth.cutoff":"clock.x1","synth.clock":"synth.env"}'), [AS_IT_COMES[0], AS_IT_COMES[1], { from: 'synth.lfo', to: 'synth.pitch' }, ...RACK_CABLES], 'sound, a clock, a modulation, each where it can go');
  assert.deepEqual(read('{"synth.notes":"clock.x1","seq.clock":"seq.notes"}'), AS_IT_COMES, 'a clock into the notes, notes into a clock');
  assert.deepEqual(read('{"synth.notes":null,"seq.clock":"clock.d2"}'), [AS_IT_COMES[0], AS_IT_COMES[1], { from: 'clock.d2', to: 'seq.clock' }], "the notes left out on purpose, the board's clock into the sequencer");
  for (const text of ['not json', '[]', '["clock.x1"]', 'null', '"clock.x1"', '7']) assert.deepEqual(read(text), AS_IT_COMES, text);
  // Storage that refuses: the patch lasts this visit.
  const full = memoryStorage();
  full.refuse = true;
  const refused = new Patch({ storage: full });
  assert.equal(refused.plug('pad.kick', 'delay.in'), true);
  assert.equal(refused.unplug('clock.x1'), true);
  refused.save();
  assert.deepEqual(refused.cables(), [{ from: 'pad.kick', to: 'delay.in' }, ...RACK_CABLES]);
  const { patch: blocked } = noted();
  assert.equal(blocked.plug('pad.ride', 'delay.in'), true);
  blocked.save();
  assert.equal(blocked.source('delay.in'), 'pad.ride');
});
