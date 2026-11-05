// The band's beat (beat.js): the pulse arithmetic, the shared clock's value read with care, the
// offsets from another clock (the ping that came back soonest), and pages in a made-up world,
// their clocks seconds apart, their sounds started at different times, their speakers' delays
// different and their audio clocks drifting, each hearing the band's pulse n at once: placed on the
// beat, kept on it, back on it after the sound slept; the beat written again on another's clock when
// its writer leaves, the same beat; and what a page writes of its own clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BURST, Beat, JUMP, MEASURE_WAIT, Offsets, PING_MS, REANCHOR_WAIT, SAMPLES, pulseAfter, pulseAt, readClock, sameClock, stepMs,
} from '../public/js/beat.js';
import { Clock, TEMPO } from '../public/js/clock.js';

test('pulses at a tempo: when pulse k falls on a beat, and the first at or after a time, none before the beat\'s own', () => {
  assert.equal(stepMs(120), 125);
  assert.equal(stepMs(60), 250);
  const b = { n: 10, at: 5000, bpm: 120 };
  assert.equal(pulseAt(b, 10), 5000);
  assert.equal(pulseAt(b, 14), 5500);
  assert.equal(pulseAt(b, 8), 4750, 'before it, likewise');
  assert.equal(pulseAfter(b, 5000), 10, 'at it');
  assert.equal(pulseAfter(b, 5001), 11);
  assert.equal(pulseAfter(b, 5125), 11, 'exactly on one');
  assert.equal(pulseAfter(b, 5125.0000001), 11, 'a hair past one, as a sum may come');
  assert.equal(pulseAfter(b, 5126), 12);
  assert.equal(pulseAfter(b, 0), 10, 'never before its own');
  assert.equal(pulseAfter({ n: 0, at: 0, bpm: 110 }, 3600e3), Math.ceil(3600e3 / stepMs(110)), 'an hour on');
});

test('a shared clock\'s value is read with care: stopped as stopped, the tempo whole within its range; anything else none', () => {
  assert.deepEqual(readClock({ on: false, bpm: 97.4, n: 5, at: 9, of: 'x', seed: 3 }), { on: false, bpm: 97, n: 0, at: 0, of: '', seed: 0 });
  assert.deepEqual(readClock({ on: true, bpm: 120, n: 33, at: 1.7e12, of: 'abc', seed: 4294967295 }), { on: true, bpm: 120, n: 33, at: 1.7e12, of: 'abc', seed: 4294967295 });
  assert.equal(readClock({ on: true, bpm: 500, n: 0, at: 1, of: 'a', seed: 1 })?.bpm, TEMPO.max);
  assert.equal(readClock({ on: true, bpm: 10, n: 0, at: 1, of: 'a', seed: -1 })?.bpm, TEMPO.min);
  assert.equal(readClock({ on: true, bpm: 120, n: 0, at: 1, of: 'a', seed: -1 })?.seed, 4294967295, 'a seed as a whole number 0…2³²−1');
  for (const v of [null, 3, 'on', [], {}, { on: 'yes', bpm: 120 }, { on: true, bpm: NaN, n: 0, at: 1, of: 'a', seed: 1 }, { on: true, bpm: 120, n: -1, at: 1, of: 'a', seed: 1 },
    { on: true, bpm: 120, n: 1.5, at: 1, of: 'a', seed: 1 }, { on: true, bpm: 120, n: 0, at: Infinity, of: 'a', seed: 1 }, { on: true, bpm: 120, n: 0, at: 1, of: '', seed: 1 },
    { on: true, bpm: 120, n: 0, at: 1, of: 'a', seed: 0.5 }, { on: true, bpm: 120, n: 2 ** 60, at: 1, of: 'a', seed: 1 }]) {
    assert.equal(readClock(v), null, JSON.stringify(v));
  }
  const a = { on: true, bpm: 120, n: 1, at: 2, of: 'a', seed: 3 };
  assert.ok(sameClock(a, { ...a }) && sameClock(null, null) && !sameClock(a, null) && !sameClock(a, { ...a, at: 2.5 }));
});

test('the offset from another clock is the one whose ping came back soonest, of the last SAMPLES', () => {
  const o = new Offsets();
  assert.ok(Number.isNaN(o.offset) && Number.isNaN(o.rtt) && o.count === 0);
  o.add(80, 105);
  o.add(20, 99);
  o.add(50, 120);
  assert.deepEqual([o.offset, o.rtt, o.count], [99, 20, 3]);
  o.add(NaN, 1);
  o.add(-5, 1);
  o.add(10, Infinity);
  assert.equal(o.count, 3, 'no measure');
  // The soonest gone after SAMPLES more: the soonest of those.
  for (let i = 0; i < SAMPLES; i++) o.add(40 + i, 200 + i);
  assert.deepEqual([o.offset, o.rtt, o.count], [200, 40, SAMPLES]);
});

/**
 * A made-up world: real time (ms), pages, and the messages between them, each `delay` ms on its way.
 * A page's clock is the real time and its skew; its audio clock runs from `start` at `rate`, asleep
 * when told; what it plays is heard `latency` s later. Its pulses are kept as heard, in real time.
 */
function world({ delay = () => 30 } = {}) {
  const w = { t: 0, pages: [], queue: [], delay };
  return w;
}

function page(w, { id, skew = 0, start = 0, latency = 0.01, rate = 1, stamp = false, jitter = 0 }) {
  const p = {
    id,
    peerId: `peer-${id}`,
    beat: new Beat({ origin: skew, clock: () => w.t }),
    clock: new Clock({ storage: null }),
    /** pulse n → when it is heard, in real time (ms) */
    heard: new Map(),
    time: 0,
    ctx: null,
  };
  const ctx = {
    state: 'running',
    outputLatency: latency,
    baseLatency: 0,
    get currentTime() {
      return p.time;
    },
  };
  // getOutputTimestamp, as Chrome has it: the audio clock's time heard now, and now (± `jitter` ms,
  // as a render quantum's and a callback's come).
  let k = 0;
  if (stamp) ctx.getOutputTimestamp = () => ({ contextTime: Math.max(0, p.time - latency * rate), performanceTime: w.t + (((k++ * 7919) % 9) / 4 - 1) * jitter });
  p.ctx = ctx;
  p.started = start;
  p.rate = rate;
  /** Its audio clock on by dt ms (from its start, unless asleep). */
  p.advance = (dt) => {
    if (w.t >= start && ctx.state === 'running') p.time += (dt / 1000) * rate;
  };
  /** When audio time c is heard, in real time (ms): from now, at its rate, and its speakers' delay. */
  p.realAt = (c) => w.t + ((c - p.time) * 1000) / rate + latency * 1000;
  /** As main.js's schedule(): on the beat, then the pulses handed out. */
  p.schedule = () => {
    if (w.t < start) return;
    p.beat.follow(p.clock, ctx);
    if (p.clock.running) p.clock.advance(ctx.currentTime, (n, time) => p.heard.set(n, p.realAt(time)));
  };
  /** The band's clock as shared, set here as main.js's bandClock does. */
  p.take = (v) => {
    p.beat.receive(v);
    if (!v) return;
    p.clock.setTempo(v.bpm);
    if (v.on && (!p.clock.running || p.clock.seed !== v.seed)) p.clock.standBy(v.seed);
    else if (!v.on) p.clock.stop();
  };
  w.pages.push(p);
  return p;
}

/** Every page sees every other, and pings it. */
function meet(w) {
  for (const p of w.pages) {
    p.beat.attach((data, peerId) => {
      const to = w.pages.find((q) => q.peerId === peerId);
      if (to) w.queue.push({ at: w.t + w.delay(), to, data: JSON.parse(JSON.stringify(data)), from: p });
    }, () => p.id);
    for (const q of w.pages) if (q !== p) p.beat.peer({ peerId: q.peerId, memberId: q.id }, true);
  }
}

/** Page p shares its clock's value: here at once, elsewhere after the network's delay. */
function share(w, p, v) {
  p.beat.receive(v);
  for (const q of w.pages) if (q !== p) w.queue.push({ at: w.t + w.delay(), to: q, value: v });
}

/** The world on by `ms`, 5 ms at a time: the audio clocks, the messages due, a tick every 25 ms, the schedules. */
function run(w, ms) {
  for (const end = w.t + ms; w.t < end; ) {
    w.t += 5;
    for (const p of w.pages) p.advance(5);
    w.queue.sort((a, b) => a.at - b.at);
    while (w.queue.length && w.queue[0].at <= w.t) {
      const m = w.queue.shift();
      if ('value' in m) m.to.take(m.value);
      else m.to.beat.hear(m.data, { peerId: m.from.peerId, memberId: m.from.id });
    }
    if (w.t % 25 === 0) {
      for (const p of w.pages) {
        const again = p.beat.tick();
        if (again) share(w, p, again);
      }
    }
    for (const p of w.pages) p.schedule();
  }
}

/** How far apart two pages hear the pulses both played after `from` (ms): the largest, and how many. */
function apart(a, b, from = -Infinity) {
  let worst = 0, both = 0;
  for (const [n, t] of a.heard) {
    const u = b.heard.get(n);
    if (u === undefined || t < from) continue;
    worst = Math.max(worst, Math.abs(t - u));
    both++;
  }
  return { worst, both };
}

test('pinged, each page knows how far the other\'s clock is, seconds apart, the network\'s delay jittering', () => {
  let k = 0;
  const w = world();
  // 20 ms each way, but for two half-seconds in three, up to 60 ms more, one way and the other unlike.
  w.delay = () => (Math.floor(w.t / 500) % 3 === 0 ? 20 : 20 + ((k++ * 37) % 60));
  const a = page(w, { id: 'aaa', skew: 3000 }), b = page(w, { id: 'bbb', skew: -1700 });
  meet(w);
  run(w, (BURST * 120) + 100);
  assert.ok(Math.abs(b.beat.offsetOf('aaa') - 4700) < 30, `measured soon: ${b.beat.offsetOf('aaa')}`);
  run(w, 10 * PING_MS);
  // A ping each way as quick as 20 ms: the offset within a few ms.
  assert.ok(Math.abs(b.beat.offsetOf('aaa') - 4700) <= 3, `b: ${b.beat.offsetOf('aaa')}`);
  assert.ok(Math.abs(a.beat.offsetOf('bbb') + 4700) <= 3, `a: ${a.beat.offsetOf('bbb')}`);
  assert.equal(a.beat.offsetOf('aaa'), 0, 'its own');
  assert.ok(Number.isNaN(a.beat.offsetOf('ccc')), 'one not here');
});

test('two pages hear the band\'s pulses at once: clocks seconds apart, sounds started apart, speakers\' delays apart', () => {
  for (const stamp of [false, true]) {
    const w = world();
    const a = page(w, { id: 'aaa', skew: 3000, start: 500, latency: 0.02, stamp });
    const b = page(w, { id: 'bbb', skew: -1700, start: 1234, latency: 0.15, stamp });
    meet(w);
    run(w, 2000);
    a.clock.setTempo(120);
    a.clock.start(a.ctx.currentTime);
    run(w, 5); // its schedule: when its sound is heard, known
    const v = a.beat.write(a.clock);
    assert.ok(v && v.on && v.of === 'aaa' && v.bpm === 120 && v.seed === a.clock.seed && v.n === a.clock.nextPulse, JSON.stringify(v));
    share(w, a, v);
    run(w, 6000);
    const { worst, both } = apart(a, b, 3000);
    assert.ok(both > 20, `${stamp}: ${both} pulses heard on both`);
    assert.ok(worst < 1.5, `${stamp}: pulses heard ${worst.toFixed(2)} ms apart`);
    // b came in on the beat's own numbers: none of its pulses out of place.
    for (const [n, t] of b.heard) if (a.heard.has(n)) assert.ok(Math.abs(t - a.heard.get(n)) < JUMP * 1000, `pulse ${n}`);
    assert.ok(!b.heard.has(0), 'the first, heard before the beat came, not played late');
  }
});

test('the audio clocks drifting apart (50 ppm), when each is heard jittering, the pages stay on the beat; a page whose sound slept is put back on it', () => {
  const w = world();
  const a = page(w, { id: 'aaa', skew: 800, start: 100, latency: 0.03, stamp: true, jitter: 2 });
  const b = page(w, { id: 'bbb', skew: -250, start: 300, latency: 0.04, rate: 1.00005, stamp: true, jitter: 2 });
  meet(w);
  run(w, 1500);
  a.clock.start(a.ctx.currentTime);
  run(w, 5);
  share(w, a, a.beat.write(a.clock));
  run(w, 60_000);
  assert.ok(apart(a, b, 20_000).worst < 1.5, `after a minute: ${apart(a, b, 20_000).worst}`);
  // b's sound asleep three seconds (the page was put away), then woken: back on the beat at once.
  b.ctx.state = 'suspended';
  run(w, 3000);
  b.ctx.state = 'running';
  const woke = w.t;
  run(w, 3000);
  assert.ok(apart(a, b, woke + 500).worst < 1.5, `woken: ${apart(a, b, woke + 500).worst}`);
});

test('a page that measured the beat\'s writer writes it again on its own clock when the writer leaves, the same beat; with none sure, the first by member id', () => {
  const w = world();
  const a = page(w, { id: 'mmm', skew: 5000, start: 0, latency: 0.02 });
  const b = page(w, { id: 'zzz', skew: -3000, start: 0, latency: 0.02 });
  const c = page(w, { id: 'ccc', skew: 900, start: 0, latency: 0.02 });
  meet(w);
  run(w, 2000);
  a.clock.start(a.ctx.currentTime);
  run(w, 5);
  share(w, a, a.beat.write(a.clock));
  run(w, 3000);
  assert.ok(b.beat.locked && c.beat.locked);
  // a leaves: b and c see it gone, and c (before b by member id) writes it again after REANCHOR_WAIT.
  w.pages.splice(w.pages.indexOf(a), 1);
  for (const p of [b, c]) p.beat.gone({ peerId: a.peerId, memberId: a.id });
  const before = new Map(c.heard);
  run(w, REANCHOR_WAIT + 200);
  assert.equal(c.beat.value?.of, 'ccc', 'c wrote it');
  assert.equal(b.beat.value?.of, 'ccc', 'and b has it');
  run(w, 3000);
  // The beat as it was: each pulse heard where a's beat had it.
  const first = [...before.keys()].pop();
  const step = stepMs(c.clock.tempo);
  const t0 = before.get(first);
  for (const [n, t] of c.heard) if (n > first) assert.ok(Math.abs(t - (t0 + (n - first) * step)) < 1.5, `pulse ${n}`);
  assert.ok(apart(b, c, w.t - 2500).worst < 1.5);

  // None measured the writer (all came after it left): the first by member id writes the beat as it came, after MEASURE_WAIT.
  const v = { on: true, bpm: 100, n: 7, at: w.t + 400, of: 'gone', seed: 42 };
  for (const p of [b, c]) p.take(v);
  assert.ok(!b.beat.locked && !c.beat.locked);
  run(w, MEASURE_WAIT - 100);
  assert.equal(c.beat.value?.of, 'gone', 'not yet');
  run(w, REANCHOR_WAIT + 300);
  assert.equal(b.beat.value?.of, 'ccc');
  assert.equal(c.beat.value?.n >= 7, true);
});

test('what a page writes of its own clock: stopped; started, its next pulse when heard (once known); standing by, the band\'s next', () => {
  const w = world();
  const a = page(w, { id: 'aaa', skew: 0, start: 0, latency: 0.05 });
  const clock = a.clock;
  assert.equal(a.beat.differs(clock), 2, 'no band\'s clock yet');
  assert.deepEqual(a.beat.write(clock), { on: false, bpm: clock.tempo, n: 0, at: 0, of: '', seed: 0 }, 'stopped');
  clock.start(0);
  assert.equal(a.beat.write(clock), null, 'running, out of a session: none (it is no one\'s)');
  clock.stop();
  a.beat.attach(() => {}, () => 'aaa');
  a.beat.receive(a.beat.write(clock));
  assert.equal(a.beat.differs(clock), 0);
  clock.setTempo(clock.tempo + 5);
  assert.equal(a.beat.differs(clock), 1, 'its tempo');
  clock.start(0);
  assert.equal(a.beat.differs(clock), 2, 'started');
  assert.equal(a.beat.write(clock), null, 'not until when its sound is heard is known');
  run(w, 50);
  const v = a.beat.write(clock);
  assert.ok(v && v.on && v.n === clock.nextPulse && v.of === 'aaa');
  assert.ok(Math.abs(v.at - a.realAt(clock.nextAt)) < 0.5, 'its next pulse, when it is heard');
  a.beat.receive(v);
  assert.equal(a.beat.differs(clock), 0);
  // Another's run, standing by: the band's next pulse, at the new tempo from there.
  const other = { on: true, bpm: 100, n: 40, at: w.t + 1000, of: 'aaa', seed: 9 };
  a.take(other);
  assert.ok(Number.isNaN(clock.nextAt));
  clock.setTempo(150);
  const again = a.beat.write(clock);
  assert.deepEqual([again?.n, again?.at, again?.bpm, again?.seed], [40, other.at, 150, 9]);
});
