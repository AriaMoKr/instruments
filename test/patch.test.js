// The patch (patch.js): the jacks (the clock's outputs, the drums' clock input and an output for
// each pad, the delay's input, the synth's patch bay), the patch the room comes with, what a cable
// can join, plugging and unplugging (an input takes one cable, an output feeds any number),
// onChange, and the patch kept for the next visit (what was kept but can't be plugged, as it comes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PATCH, JACKS, Patch, padForJack } from '../public/js/patch.js';
import { CLOCK_OUTS } from '../public/js/clock.js';
import { PADS } from '../public/js/drums.js';
import { memoryStorage } from './helpers/audio.js';

/** JACKS and a second input for sound, a reverb's, so that an output can feed two. */
const MORE = [...JACKS, { id: 'reverb.in', module: 'reverb', name: 'Reverb in', label: 'IN', dir: 'in', kind: 'audio' }];
/** The patch as the room comes with it. */
const AS_IT_COMES = [{ from: 'clock.x1', to: 'drums.clock' }, { from: 'clock.x1', to: 'synth.clock' }];
/** The synth's jacks: id, label, dir, kind. */
const SYNTH_JACKS = [
  ['synth.out', 'OUT', 'out', 'audio'], ['synth.clock', 'CLOCK', 'in', 'clock'],
  ['synth.lfo', 'LFO', 'out', 'mod'], ['synth.env', 'ENV', 'out', 'mod'],
  ['synth.pitch', 'PITCH', 'in', 'mod'], ['synth.cutoff', 'CUTOFF', 'in', 'mod'], ['synth.amp', 'AMP', 'in', 'mod'],
];
/** Every input as kept with the patch as it comes, and `o` changed. */
const kept = (o = {}) => ({ 'drums.clock': 'clock.x1', 'delay.in': null, 'synth.clock': 'clock.x1', 'synth.pitch': null, 'synth.cutoff': null, 'synth.amp': null, ...o });

/** A patch kept nowhere, and each onChange it calls, as [to, from, was]. */
function noted(o = {}) {
  const patch = new Patch({ storage: null, ...o });
  const changes = [];
  patch.onChange = (to, from, was) => changes.push([to, from, was]);
  return { patch, changes };
}

test("the jacks: the clock's three outputs, the drums' clock input, an output for each pad in PADS's order, the delay's input, then the synth's patch bay; each id once", () => {
  assert.deepEqual(JACKS.map((j) => j.id), ['clock.x1', 'clock.d2', 'clock.d4', 'drums.clock', ...PADS.map((p) => `pad.${p.id}`), 'delay.in', ...SYNTH_JACKS.map((j) => j[0])]);
  assert.equal(new Set(JACKS.map((j) => j.id)).size, JACKS.length);
  assert.deepEqual(JACKS.filter((j) => j.module === 'clock').map((j) => [j.id, j.label, j.dir, j.kind]), [
    ['clock.x1', '×1', 'out', 'clock'], ['clock.d2', '÷2', 'out', 'clock'], ['clock.d4', '÷4', 'out', 'clock'],
  ]);
  assert.deepEqual(JACKS.filter((j) => j.module === 'clock').map((j) => j.id), CLOCK_OUTS.map((o) => o.id), "clock.js's outputs");
  assert.deepEqual(JACKS.filter((j) => j.id.startsWith('pad.')), PADS.map((p) => ({ id: `pad.${p.id}`, module: 'drums', name: `${p.name} out`, label: p.name, dir: 'out', kind: 'audio' })));
  assert.deepEqual(JACKS.filter((j) => j.module === 'synth').map((j) => [j.id, j.label, j.dir, j.kind]), SYNTH_JACKS);
  assert.deepEqual(JACKS.filter((j) => j.dir === 'in').map((j) => [j.id, j.module, j.kind]), [
    ['drums.clock', 'drums', 'clock'], ['delay.in', 'delay', 'audio'],
    ['synth.clock', 'synth', 'clock'], ['synth.pitch', 'synth', 'mod'], ['synth.cutoff', 'synth', 'mod'], ['synth.amp', 'synth', 'mod'],
  ]);
  for (const j of JACKS) {
    assert.ok(j.name && j.label, `${j.id}: a name and a label`);
    assert.ok(['in', 'out'].includes(j.dir) && ['clock', 'audio', 'mod'].includes(j.kind), j.id);
  }
  // Which pad's sound comes out of a jack.
  assert.deepEqual(PADS.map((p) => padForJack(`pad.${p.id}`)), PADS.map((_, i) => i));
  assert.deepEqual(['clock.x1', 'delay.in', 'pad.nope', 'kick', '', null].map((id) => padForJack(id)), [-1, -1, -1, -1, -1, -1]);
  assert.ok(Object.isFrozen(JACKS) && Object.isFrozen(DEFAULT_PATCH));
});

test("the patch it comes with: the clock into the drums and the synth's arpeggiator, nothing into the delay or the synth's modulation; other defaults, as far as they can be plugged", () => {
  assert.deepEqual(DEFAULT_PATCH, { 'drums.clock': 'clock.x1', 'synth.clock': 'clock.x1' });
  const { patch } = noted();
  assert.equal(patch.jacks, JACKS);
  assert.equal(patch.source('drums.clock'), 'clock.x1');
  assert.equal(patch.source('synth.clock'), 'clock.x1');
  for (const id of ['delay.in', 'synth.pitch', 'synth.cutoff', 'synth.amp']) assert.equal(patch.source(id), null, id);
  assert.deepEqual(patch.cables(), AS_IT_COMES);
  assert.deepEqual(patch.targets('clock.x1'), ['drums.clock', 'synth.clock']);
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
  ];
  for (const [a, b] of can) assert.ok(patch.canPlug(a, b) && patch.canPlug(b, a), `${a}, ${b}`);
  const never = [
    ['clock.x1', 'clock.d2'], ['pad.kick', 'pad.snare'], ['drums.clock', 'delay.in'], ['clock.x1', 'delay.in'], ['pad.kick', 'drums.clock'],
    ['delay.in', 'delay.in'], ['clock.x1', 'clock.x1'], ['nope', 'delay.in'], ['pad.kick', 'nope'], ['', ''],
    ['synth.lfo', 'delay.in'], ['synth.out', 'synth.pitch'], ['pad.kick', 'synth.amp'], ['clock.x1', 'synth.cutoff'], ['synth.env', 'synth.clock'],
    ['synth.lfo', 'synth.env'], ['synth.pitch', 'synth.amp'], ['synth.out', 'synth.out'],
  ];
  for (const [a, b] of never) assert.ok(!patch.canPlug(a, b) && !patch.canPlug(b, a), `${a}, ${b}`);
});

test("plugged: an input's old cable comes out first, and an output feeds any number; the same cable again, or one that can't be, isn't plugged", () => {
  const { patch, changes } = noted({ jacks: MORE });
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
    { from: 'clock.d2', to: 'drums.clock' }, { from: 'pad.kick', to: 'delay.in' }, { from: 'clock.x1', to: 'synth.clock' }, { from: 'pad.kick', to: 'reverb.in' },
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
  const { patch, changes } = noted({ jacks: MORE });
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
  assert.deepEqual(patch.cables(), []);
  assert.deepEqual(changes.at(-1), ['synth.clock', null, 'clock.x1']);
  assert.equal(changes.length, 4);
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
  // A patch kept before the synth had jacks: its inputs as they come.
  const before = new Patch({ storage: memoryStorage({ patch: '{"drums.clock":"clock.d2","delay.in":"pad.kick"}' }) });
  assert.deepEqual(before.cables(), [{ from: 'clock.d2', to: 'drums.clock' }, { from: 'pad.kick', to: 'delay.in' }, { from: 'clock.x1', to: 'synth.clock' }]);
});

test("what was kept but can't be plugged is as it comes, and so is an input not kept; storage that refuses or is blocked breaks nothing", () => {
  const read = (text) => new Patch({ storage: memoryStorage({ patch: text }) }).cables();
  assert.deepEqual(read('{"delay.in":"pad.tom"}'), AS_IT_COMES, 'a jack that is not there; the clock not kept');
  assert.deepEqual(read('{"delay.in":"clock.x1","drums.clock":"pad.kick"}'), AS_IT_COMES, 'the wrong kind');
  assert.deepEqual(read('{"drums.clock":"drums.clock","delay.in":5}'), AS_IT_COMES, 'an input, and not an id');
  assert.deepEqual(read('{"drums.clock":"clock.d4","pad.kick":"delay.in","nope":"clock.x1"}'), [{ from: 'clock.d4', to: 'drums.clock' }, AS_IT_COMES[1]], 'what is not an input, left out');
  assert.deepEqual(read('{"synth.pitch":"synth.lfo","synth.amp":"synth.out","synth.cutoff":"clock.x1","synth.clock":"synth.env"}'), [...AS_IT_COMES, { from: 'synth.lfo', to: 'synth.pitch' }], 'sound, a clock, a modulation, each where it can go');
  for (const text of ['not json', '[]', '["clock.x1"]', 'null', '"clock.x1"', '7']) assert.deepEqual(read(text), AS_IT_COMES, text);
  // Storage that refuses: the patch lasts this visit.
  const full = memoryStorage();
  full.refuse = true;
  const refused = new Patch({ storage: full });
  assert.equal(refused.plug('pad.kick', 'delay.in'), true);
  assert.equal(refused.unplug('clock.x1'), true);
  refused.save();
  assert.deepEqual(refused.cables(), [{ from: 'pad.kick', to: 'delay.in' }]);
  const { patch: blocked } = noted();
  assert.equal(blocked.plug('pad.ride', 'delay.in'), true);
  blocked.save();
  assert.equal(blocked.source('delay.in'), 'pad.ride');
});
