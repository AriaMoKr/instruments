// The band in a shared session (band.js, bandparts.js): pages as the room has them, every instrument
// and module, in made-up sessions that share values as layersharedsession's do (its shared.js, last
// writer wins). The first here brings its band in as it is, its mark last; one who joins takes it,
// every setting, said once; a change anywhere is everyone's a moment later, shown, and doesn't come
// back; two bands begun at once settle on the first; cables plugged at once that would loop come to
// the same patch everywhere; the clock started, stopped and its tempo turned by another; a value this
// page can't take is left be; and leaving keeps the band.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSession, Net } from './helpers/session.js';
import { Band, SEED_AFTER, SEED_ALONE } from '../public/js/band.js';
import { bandParts, stepCode } from '../public/js/bandparts.js';
import { Beat } from '../public/js/beat.js';
import { Clock } from '../public/js/clock.js';
import { Delay } from '../public/js/delay.js';
import { Drums, PADS } from '../public/js/drums.js';
import { Adsr } from '../public/js/envelope.js';
import { Filter } from '../public/js/filter.js';
import { Guitar } from '../public/js/guitar.js';
import { Keys } from '../public/js/keys.js';
import { Lfo } from '../public/js/lfo.js';
import { Mixer } from '../public/js/mixer.js';
import { Patch } from '../public/js/patch.js';
import { Pattern } from '../public/js/pattern.js';
import { Reverb } from '../public/js/reverb.js';
import { Seq } from '../public/js/seq.js';
import { Sound } from '../public/js/sound.js';
import { Synth } from '../public/js/synth.js';

/** The time: performance.now() and the wall clock. */
const T = { now: 0, wall: 1.75e12 };

/** A page of the room: its instruments, its clock, its band, and what it was told. */
function page(name, letter) {
  const sound = new Sound({ Context: null, storage: null });
  const o = { storage: null };
  const r = {
    drums: new Drums(sound, o), pattern: new Pattern(o), delay: new Delay(sound, o), synth: new Synth(sound, o), seq: new Seq(o),
    rackDelay: new Delay(sound, { ...o, channel: 'rackdelay' }), lfo: new Lfo(sound, o), envelope: new Adsr(sound, o), mixer: new Mixer(sound, o),
    filter: new Filter(sound, o), reverb: new Reverb(sound, o), keys: new Keys(sound, o), guitar: new Guitar(sound, { ...o, Worklet: null }), patch: new Patch(o),
  };
  r.clock = new Clock(o);
  r.shown = [];
  r.clocks = [];
  r.adopted = [];
  r.ctx = { state: 'running', currentTime: 0, outputLatency: 0.02, baseLatency: 0 };
  const { settings, parts } = bandParts(r, (part) => r.shown.push(part));
  r.settings = settings;
  // Its band's names from its own letters, so that two pages' bands are never one.
  let k = 0;
  r.band = new Band({
    prefix: 'instruments:',
    settings,
    parts,
    clock: r.clock,
    beat: new Beat({ origin: 0, clock: () => T.now }),
    onClock: (v, was, who, initial) => {
      r.clocks.push({ on: v.on, bpm: v.bpm, who, initial });
      r.clock.setTempo(v.bpm);
      if (v.on && (!r.clock.running || r.clock.seed !== v.seed)) r.clock.standBy(v.seed);
      else if (!v.on && r.clock.running) r.clock.stop();
    },
    onAdopt: (changed, joining) => r.adopted.push({ changed, joining }),
    now: () => T.now,
    wall: () => T.wall,
    random: () => ((letter.charCodeAt(0) * 7 + k++ * 13) % 36) / 36,
  });
  r.name = name;
  /** Every setting as it reads here. */
  r.read = () => Object.fromEntries(settings.map((s) => [s.name, s.read()]));
  return r;
}

/** Time on by `ms`, 25 ms at a time: each page's sound, its beat followed and its clock's pulses, its band's tick, the messages. */
function go(net, pages, ms) {
  for (const end = T.now + ms; T.now < end; ) {
    T.now += 25;
    T.wall += 25;
    for (const r of pages) {
      r.ctx.currentTime += 0.025;
      r.band.beat.follow(r.clock, r.ctx);
      if (r.clock.running) r.clock.advance(r.ctx.currentTime, () => {});
      r.band.tick();
    }
    net.flush();
  }
}

const here = (p) => p.page === 'instruments';

test('alone in a session, a page brings its band in after a while, as it is: every setting, its clock, then its mark', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), s = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana');
  a.drums.setKnob(2, 'tone', 0.9);
  a.band.attach(s, here);
  assert.equal(a.band.state, 'waiting');
  go(net, [a], SEED_ALONE - 100);
  assert.equal(a.band.state, 'waiting');
  assert.equal(s.writes.length, 0, 'nothing yet');
  go(net, [a], 200);
  assert.equal(a.band.state, 'playing');
  assert.match(a.band.id, /^[a-z0-9]{6}$/);
  const id = a.band.id, keys = new Set(s.writes);
  assert.equal(s.writes.length, a.settings.length + 2, 'each once, the clock and the mark');
  for (const st of a.settings) assert.ok(keys.has(`instruments:${id}:${st.name}`), st.name);
  assert.equal(s.writes.at(-1), `instruments:${id}:band`, 'its mark last');
  assert.deepEqual(Object.keys(s.get(`instruments:${id}:band`)), ['since']);
  assert.equal(s.get(`instruments:${id}:drums.closed-hat.tone`), 0.9);
  assert.deepEqual(s.get(`instruments:${id}:clock`), { on: false, bpm: a.clock.tempo, n: 0, at: 0, of: '', seed: 0 });
  // Names are short enough for the session's keys (64 at most).
  for (const k of keys) assert.ok(k.length <= 64, k);
  // Every setting read as a plain value, read again the same.
  for (const st of a.settings) {
    const v = st.read();
    assert.ok(v === null || ['number', 'string', 'boolean'].includes(typeof v), st.name);
    assert.equal(st.read(), v);
    assert.ok(st.valid(v), `${st.name}: what it reads it takes`);
  }
  a.band.detach();
});

test('one who began the session (a new room) brings its band in at once; one who comes by a link and is alone waits for the others a while', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here, { first: true });
  go(net, [a], 25);
  assert.equal(a.band.state, 'playing');
  assert.equal(sa.writes.at(-1), `instruments:${a.band.id}:band`);
  // Bo by the link: the others take seconds to reach; he waits, not bringing in his own meanwhile.
  b.band.attach(sb, here);
  go(net, [a, b], 10000);
  assert.deepEqual([b.band.state, sb.writes.length], ['waiting', 0]);
  net.connect(sa, sb);
  go(net, [a, b], 100);
  assert.deepEqual([b.band.state, b.band.id, b.adopted.length, b.adopted[0].joining], ['playing', a.band.id, 1, true]);
  assert.equal(sb.writes.length, 0, 'nothing of his own in the session');
  a.band.detach();
  b.band.detach();
});

test('one who joins takes the session\'s band, every setting, said once; it keeps it on leaving', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  // Ana's band, changed all over.
  a.drums.setKnob(0, 'pitch', 0.9);
  a.pattern.toggle(3, 5);
  a.delay.setKnob('feedback', 0.8);
  a.synth.choose('pad');
  a.synth.setArp('updown');
  a.seq.setStep(4, true, 19, true, true);
  a.seq.setOctave(1);
  a.lfo.setKnob('rate', 0.1);
  a.filter.setKnob('mode', 1);
  a.keys.choose('epiano');
  a.keys.setKnob('d8', 0.25);
  a.keys.setSwitch('perc', true);
  a.guitar.setPedal('wah', true);
  a.guitar.setPickup('neck');
  a.guitar.choose('A');
  a.patch.plug('pad.kick', 'delay.in');
  a.patch.unplug('synth.notes');
  // Bo's own.
  b.synth.setKnob('cutoff', 0.1);
  b.synth.setOctave(2);
  b.keys.setOctave(-1);
  a.band.attach(sa, here);
  go(net, [a], SEED_ALONE + 100);
  assert.equal(a.band.state, 'playing');
  const ana = a.read();
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], 200);
  assert.equal(b.band.state, 'playing');
  assert.equal(b.band.id, a.band.id);
  assert.deepEqual(b.read(), ana, 'every setting Ana\'s');
  assert.deepEqual(a.read(), ana, 'Ana\'s as they were');
  assert.deepEqual(b.adopted, [{ changed: b.adopted[0].changed, joining: true }]);
  assert.ok(b.adopted[0].changed > 10, `${b.adopted[0].changed} changed`);
  assert.deepEqual(a.adopted, [], 'Ana took nothing');
  assert.equal(b.synth.name, 'Pad', 'its preset, not changed (its knobs set one by one)');
  assert.deepEqual([b.synth.octave, b.keys.octave], [2, -1], 'the octaves one\'s own');
  assert.deepEqual(b.patch.cables(), a.patch.cables());
  assert.equal(stepCode(b.seq.steps[4]), stepCode(a.seq.steps[4]));
  for (const part of ['drums', 'pattern', 'delay', 'synth', 'seq', 'lfo', 'filter', 'keys', 'guitar', 'patch']) assert.ok(b.shown.includes(part), part);
  // Bo leaves: the band stays his.
  const before = b.read();
  b.band.detach();
  net.part(sa, sb);
  go(net, [a, b], 500);
  assert.equal(b.band.state, 'off');
  assert.deepEqual(b.read(), before);
  a.band.detach();
});

test('a change anywhere is everyone\'s a moment later, shown, and doesn\'t come back; cables, presets and steps too', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], SEED_AFTER + 200);
  assert.ok(a.band.playing && b.band.playing && a.band.id === b.band.id);
  assert.deepEqual(b.read(), a.read());
  const writes = () => [sa.writes.length, sb.writes.length];

  // A knob turned on Ana's: Bo's a moment later, and Bo writes nothing back.
  let [wa, wb] = writes();
  b.shown.length = 0;
  a.delay.setKnob('feedback', 0.42);
  go(net, [a, b], 150);
  assert.equal(b.delay.knobs.feedback, 0.42);
  assert.deepEqual(b.shown, ['delay']);
  assert.deepEqual(writes(), [wa + 1, wb], 'one write, and none back');
  // Turning: a value at most every POLL_MS, the last one everyone's.
  [wa, wb] = writes();
  for (let i = 0; i <= 20; i++) {
    a.mixer.setKnob('in2', i / 20);
    go(net, [a, b], 25);
  }
  go(net, [a, b], 100);
  assert.equal(b.mixer.knobs.in2, 1);
  assert.ok(writes()[0] - wa <= 9, `${writes()[0] - wa} writes in half a second`);
  assert.equal(writes()[1], wb);

  // Bo's step on the drums, his sequencer's step, his keyboard's drawbar (to its eighth): Ana's.
  b.pattern.toggle(7, 15);
  b.seq.toggleSlide(2);
  b.seq.setNote(2, 24);
  b.keys.setKnob('d4', 0.6);
  go(net, [a, b], 150);
  assert.ok(a.pattern.has(7, 15));
  assert.deepEqual(a.seq.steps[2], b.seq.steps[2]);
  assert.equal(a.keys.knobs.d4, b.keys.knobs.d4);

  // A preset chosen on Bo's: Ana's synth called the same, not changed.
  b.synth.choose('bass');
  go(net, [a, b], 150);
  assert.deepEqual([a.synth.preset, a.synth.edited, a.synth.mono, a.synth.name], [b.synth.preset, false, b.synth.mono, b.synth.name]);
  assert.deepEqual(a.synth.knobs, b.synth.knobs);
  a.synth.setKnob('cutoff', 0.33);
  go(net, [a, b], 150);
  assert.deepEqual([b.synth.edited, b.synth.name], [true, a.synth.name]);

  // A cable plugged and one pulled on Ana's: the same on Bo's, told as any change of the patch is.
  const changes = [];
  b.patch.onChange = (to, from, was) => changes.push([to, from, was]);
  a.patch.plug('synth.out', 'reverb.in');
  a.patch.unplug('drums.clock');
  go(net, [a, b], 150);
  assert.deepEqual(b.patch.cables(), a.patch.cables());
  assert.deepEqual(changes.sort(), [['drums.clock', null, 'clock.x1'], ['reverb.in', 'synth.out', null]]);

  // The guitar's chord and a pedal, the keyboard's sound.
  a.guitar.choose('G');
  b.guitar.setPedal('chorus', true);
  b.keys.choose('both');
  go(net, [a, b], 150);
  assert.deepEqual([b.guitar.chord, a.guitar.pedals.chorus, a.keys.choice], ['G', true, 'both']);
  assert.deepEqual(a.read(), b.read(), 'all one band');
  a.band.detach();
  b.band.detach();
});

test('what changed just before something is played goes before it (share) and is set before it is played elsewhere (catchUp)', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], SEED_AFTER + 200);
  assert.ok(a.band.playing && b.band.playing);
  // Bo's page plays what Ana's sends on a channel (as jam.js's playing), the chord as it is then.
  const strummed = [];
  sb.channel('play').on(() => {
    b.band.catchUp();
    strummed.push(b.guitar.chord);
  });
  // Ana frets a chord and strums at once, between two looks at what changed: without share, the
  // strum comes first, and Bo strums the chord before.
  a.guitar.choose('Em');
  sa.channel('play').send('strum');
  net.flush();
  go(net, [a, b], 100);
  const writes = sa.writes.length;
  a.guitar.choose('Am');
  a.band.share();
  sa.channel('play').send('strum');
  net.flush();
  assert.deepEqual(strummed, [null, 'Am']);
  assert.equal(sa.writes.length, writes + 1, 'the chord written once');
  go(net, [a, b], 100);
  assert.equal(sa.writes.length, writes + 1, 'and not again');
  assert.equal(b.guitar.chord, 'Am');
  // Out of the session, neither does anything.
  a.band.detach();
  b.band.detach();
  a.guitar.choose('C');
  a.band.share();
  b.band.catchUp();
  assert.equal(sa.writes.length, writes + 1);
});

test('two bands begun at once (each alone a while): everyone settles on the one begun first, said', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.reverb.setKnob('size', 0.9);
  b.reverb.setKnob('size', 0.1);
  a.band.attach(sa, here);
  go(net, [a], 1000);
  b.band.attach(sb, here);
  go(net, [a, b], SEED_ALONE + 100);
  assert.ok(a.band.playing && b.band.playing && a.band.id !== b.band.id, 'two bands');
  net.connect(sa, sb);
  go(net, [a, b], 200);
  assert.equal(b.band.id, a.band.id, 'Ana\'s, begun first');
  assert.deepEqual(b.read(), a.read());
  assert.equal(b.reverb.knobs.size, 0.9);
  assert.deepEqual(b.adopted, [{ changed: b.adopted[0].changed, joining: false }]);
  assert.deepEqual(a.adopted, []);
  // And a change after is the one band's.
  b.reverb.setKnob('damp', 0.05);
  go(net, [a, b], 150);
  assert.equal(a.reverb.knobs.damp, 0.05);
  a.band.detach();
  b.band.detach();
});

test('cables plugged at once in two places that together would bring a sound back round: both come to the same patch', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], SEED_AFTER + 200);
  // The filter into the mixer on Ana's, the mixer into the filter on Bo's, before either hears of the other.
  assert.ok(a.patch.plug('filter.out', 'mixer.in1'));
  assert.ok(b.patch.plug('mixer.out', 'filter.in'));
  go(net, [a, b], 300);
  assert.deepEqual(a.patch.cables(), b.patch.cables(), 'one patch');
  const has = (p, from, to) => p.patch.source(to) === from;
  assert.ok(has(a, 'filter.out', 'mixer.in1') !== has(a, 'mixer.out', 'filter.in'), 'one of the two, not both');
  a.band.detach();
  b.band.detach();
});

test('the clock started, stopped and its tempo turned by another: set here, by whom; on joining, as the band has it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  go(net, [a], SEED_ALONE + 100);
  a.clock.setTempo(128);
  a.clock.start(a.ctx.currentTime);
  go(net, [a], 100);
  const v = sa.get(`instruments:${a.band.id}:clock`);
  assert.ok(v.on && v.bpm === 128 && v.of === 'aaaaaaaaaaaa' && v.seed === a.clock.seed, JSON.stringify(v));
  // Bo joins while it runs: his clock runs the band's run, at its tempo.
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], 300);
  assert.deepEqual(b.clocks, [{ on: true, bpm: 128, who: '', initial: true }]);
  assert.deepEqual([b.clock.running, b.clock.seed, b.clock.tempo], [true, a.clock.seed, 128]);
  // Bo turns the tempo: Ana's, and no one is told of it in words.
  b.clock.setTempo(90);
  go(net, [a, b], 200);
  assert.equal(a.clock.tempo, 90);
  assert.deepEqual(a.clocks.at(-1), { on: true, bpm: 90, who: 'Bo', initial: false });
  // Ana stops it: Bo's stops, by Ana.
  a.clock.stop();
  go(net, [a, b], 100);
  assert.equal(b.clock.running, false);
  assert.deepEqual(b.clocks.at(-1), { on: false, bpm: 90, who: 'Ana', initial: false });
  // Bo starts it again: a run of his own, Ana's clock standing by for it.
  b.clock.start(b.ctx.currentTime);
  go(net, [a, b], 200);
  assert.deepEqual([a.clock.running, a.clock.seed], [true, b.clock.seed]);
  assert.equal(a.clocks.at(-1).who, 'Bo');
  a.band.detach();
  b.band.detach();
});

test('a value this page can\'t take (a newer page\'s) is left be, here and in the session; one it lacks is shared from here', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  go(net, [a], SEED_ALONE + 100);
  const id = a.band.id;
  // As a newer page would: a preset this one doesn't have, a knob beyond 0…1, a cable from a jack it lacks.
  sa.set(`instruments:${id}:synth.preset`, 'theremin');
  sa.set(`instruments:${id}:delay.time`, 7);
  sa.set(`instruments:${id}:patch.reverb.in`, 'theremin.out');
  // And one it lacks: as an older page's band would be.
  sa.shared.entries.delete(`instruments:${id}:lfo.depth`);
  const preset = b.synth.preset, time = b.delay.knobs.time;
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], 300);
  assert.equal(b.band.id, id);
  assert.deepEqual([b.synth.preset, b.delay.knobs.time, b.patch.source('reverb.in')], [preset, time, null]);
  assert.equal(sb.get(`instruments:${id}:synth.preset`), 'theremin', 'left be');
  assert.equal(sb.get(`instruments:${id}:delay.time`), 7);
  assert.ok(sb.writes.includes(`instruments:${id}:lfo.depth`), 'the one lacking, shared');
  assert.ok(!sb.writes.includes(`instruments:${id}:synth.preset`) && !sb.writes.includes(`instruments:${id}:delay.time`));
  a.band.detach();
  b.band.detach();
});

test('in again after leaving: the session\'s band taken again in place of what was changed meanwhile', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const net = new Net(), a = page('Ana', 'a'), b = page('Bo', 'b');
  let sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  a.band.attach(sa, here);
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], SEED_AFTER + 200);
  const id = a.band.id;
  b.band.detach();
  net.part(sa, sb);
  b.filter.setKnob('cutoff', 0.05);
  PADS.forEach((_, i) => b.pattern.clear(i));
  go(net, [a, b], 1000);
  sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo');
  b.band.attach(sb, here);
  net.connect(sa, sb);
  go(net, [a, b], 300);
  assert.equal(b.band.id, id);
  assert.deepEqual(b.read(), a.read());
  assert.equal(b.adopted.at(-1).joining, true);
  a.band.detach();
  b.band.detach();
});
