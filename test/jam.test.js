// Playing together (jam.js): each message checked as it comes, its numbers held within their ranges;
// who holds which note, a note let go only when the last who holds it lets go; and the channel
// between pages in made-up sessions: what is played goes to those in this room only, and not back;
// nothing goes while the band isn't the session's, except what lets go; a move is sent at most every
// MOVE_MS, its latest, before what is played after it; each visitor's notes capped, so many at once
// and so many a second, what lets go never; and one who played is let go of when they leave the
// session or this room, or this page leaves it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeSession, Net } from './helpers/session.js';
import { Holds, Jam, MAX_DELAY, MOVE_MS, NOTE_BURST, NOTE_RATE, instrumentOf, kindOf, moveKey, readPlay } from '../public/js/jam.js';
import { PADS } from '../public/js/drums.js';
import { FRETS, MAX_BEND } from '../public/js/guitar.js';
import { PICK } from '../public/js/strings.js';

test('every kind of play is read back as it was sent', () => {
  const plays = [
    ['pad', 3, 0.7],
    ['on', 's', 60, 0.8],
    ['off', 'k', 36],
    ['tap', 'k', 96, 0.85],
    ['sus', 's', true],
    ['sus', 'k', false],
    ['bend', -0.25],
    ['mod', 0.5],
    ['pluck', 5, 0.6, 0.13, 0.012],
    ['strum', false, 0.4],
    ['fret', 0, 3, 0.85],
    ['ftap', 2, 0, 0.5],
    ['slide', 1, 7],
    ['gbend', 3, 1.5],
    ['lift', 4],
    ['mute'],
    ['gon', 64, 0.9],
    ['goff', 64],
    ['all'],
  ];
  for (const play of plays) assert.deepEqual(readPlay(JSON.parse(JSON.stringify(play))), play, play[0]);
});

test('a play\'s numbers are held within their ranges, and what comes after what it knows is left out', () => {
  assert.deepEqual(readPlay(['pad', 0, 1.5]), ['pad', 0, 1]);
  assert.deepEqual(readPlay(['on', 's', 60, -0.2]), ['on', 's', 60, 0]);
  assert.deepEqual(readPlay(['bend', -3]), ['bend', -1]);
  assert.deepEqual(readPlay(['mod', 2]), ['mod', 1]);
  assert.deepEqual(readPlay(['pluck', 0, 0.5, 0.9, 2]), ['pluck', 0, 0.5, PICK.max, MAX_DELAY]);
  assert.deepEqual(readPlay(['pluck', 0, 0.5, 0, -1]), ['pluck', 0, 0.5, PICK.min, 0]);
  assert.deepEqual(readPlay(['gbend', 2, 9]), ['gbend', 2, MAX_BEND]);
  assert.deepEqual(readPlay(['on', 's', 60, 0.5, 'more', { x: 1 }]), ['on', 's', 60, 0.5]);
  assert.deepEqual(readPlay(['mute', 'and more']), ['mute']);
});

test('what isn\'t a play, or is one of a kind this page doesn\'t know, is nothing', () => {
  const bad = [
    null, undefined, 'on', 7, {}, { 0: 'pad', 1: 0, 2: 0.5, length: 3 }, [], ['boom', 1], [42],
    ['pad', PADS.length, 0.5], ['pad', -1, 0.5], ['pad', 1.5, 0.5], ['pad', '1', 0.5], ['pad', 1], ['pad', 1, null], ['pad', 1, '0.5'],
    ['on', 'x', 60, 0.5], ['on', 's', 128, 0.5], ['on', 's', -1, 0.5], ['on', 's', 60.5, 0.5], ['on', 's', 60], ['on', 's', 60, Infinity],
    ['off', 's'], ['off', 'synth', 60], ['tap', 'k', 60, 'loud'],
    ['sus', 's', 1], ['sus', 's'], ['bend', 'up'], ['bend'], ['mod', null],
    ['pluck', 6, 0.5, 0.13, 0], ['pluck', 0, 0.5, 0.13], ['pluck', 0, 0.5, '0.13', 0],
    ['strum', 'down', 0.5], ['strum', true],
    ['fret', 6, 0, 0.5], ['fret', 0, FRETS + 1, 0.5], ['fret', 0, -1, 0.5], ['ftap', 0, 2.5, 0.5], ['fret', 0, 3],
    ['slide', 0, 2.5], ['slide', 0], ['gbend', 0, NaN], ['lift', -1], ['lift', 6], ['lift'],
    ['gon', 200, 0.5], ['gon', 60], ['goff', 'E'],
  ];
  for (const data of bad) assert.equal(readPlay(data), null, JSON.stringify(data));
});

test('a play starts, moves or lets go; on which instrument; and which moves only their latest is sent of', () => {
  assert.deepEqual(['pad', 'on', 'tap', 'pluck', 'strum', 'fret', 'ftap', 'gon'].map((k) => kindOf(readPlay(sample(k)))), Array(8).fill('start'));
  assert.deepEqual(['sus', 'bend', 'mod', 'slide', 'gbend', 'mute'].map((k) => kindOf(readPlay(sample(k)))), Array(6).fill('move'));
  assert.deepEqual(['off', 'lift', 'goff', 'all'].map((k) => kindOf(readPlay(sample(k)))), Array(4).fill('end'));
  assert.deepEqual([['pad', 0, 1], ['on', 's', 60, 1], ['off', 'k', 60], ['sus', 'k', true], ['bend', 0], ['mute'], ['gon', 60, 1], ['all']].map(instrumentOf), ['drums', 'synth', 'keys', 'keys', 'synth', 'guitar', 'guitar', null]);
  assert.deepEqual([['bend', 0.5], ['mod', 0.1], ['gbend', 3, 1], ['gbend', 4, 1], ['slide', 3, 5], ['on', 's', 60, 1]].map(moveKey), ['bend', 'mod', 'gbend:3', 'gbend:4', null, null]);
});

/** A play of each kind, for the tables above. */
function sample(kind) {
  return {
    pad: ['pad', 0, 1], on: ['on', 's', 60, 1], tap: ['tap', 'k', 60, 1], off: ['off', 's', 60], sus: ['sus', 's', true],
    bend: ['bend', 0.5], mod: ['mod', 0.5], pluck: ['pluck', 0, 1, 0.13, 0], strum: ['strum', true, 1], fret: ['fret', 0, 1, 1],
    ftap: ['ftap', 0, 1, 1], slide: ['slide', 0, 2], gbend: ['gbend', 0, 1], lift: ['lift', 0], mute: ['mute'], gon: ['gon', 60, 1],
    goff: ['goff', 60], all: ['all'],
  }[kind];
}

test('a note held by two sounds till the last of them lets go; one who never held it lets go of nothing', () => {
  const h = new Holds();
  assert.equal(h.off('', 60), true, 'no one held it: let go, as before anyone else played');
  h.on('', 60);
  h.on('peer-b', 60);
  h.on('peer-b', 64);
  assert.deepEqual([h.has('', 60), h.has('peer-b', 60), h.has('peer-c', 60)], [true, true, false]);
  assert.equal(h.last(60), 'peer-b');
  assert.deepEqual([h.count('peer-b'), h.count(''), h.size], [2, 1, 2]);
  assert.deepEqual(h.of('peer-b').sort(), [60, 64]);
  assert.equal(h.off('peer-c', 60), false, 'others hold it still');
  assert.equal(h.off('', 60), false, 'Bo still holds it');
  assert.equal(h.last(60), 'peer-b');
  h.on('', 60);
  h.on('peer-b', 60); // pressed again: the latest again
  assert.equal(h.last(60), 'peer-b');
  assert.equal(h.last(64), 'peer-b');
  assert.equal(h.last(62), undefined);
  assert.equal(h.off('peer-b', 60), false);
  assert.equal(h.last(60), '');
  assert.equal(h.off('', 60), true, 'the last let go');
  assert.equal(h.has('', 60), false);
  h.clear();
  assert.deepEqual([h.size, h.count('peer-b')], [0, 0]);
});

/** The time: performance.now(). */
const T = { now: 0 };
const here = (p) => p.page === 'instruments';

/** A page's playing together: what it heard (and from whom), who it let go of, whether it plays the session's band. */
function player(session) {
  const r = { session, heard: [], gone: [], ready: true };
  r.jam = new Jam({ prefix: 'instruments:', onPlay: (play, p) => r.heard.push([...play, p.name]), onGone: (id) => r.gone.push(id), ready: () => r.ready, now: () => T.now });
  r.jam.attach(session, here);
  return r;
}

/** Ana and Bo here, Cy in the hallway, all in one session. */
function room() {
  const net = new Net();
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo'), sc = new FakeSession(net, 'cccccccccccc', 'Cy', 'hallway');
  const a = player(sa), b = player(sb), c = player(sc);
  net.connect(sa, sb);
  net.connect(sa, sc);
  net.connect(sb, sc);
  return { net, a, b, c, sa, sb, sc };
}

test('what is played goes to the others in this room as it is, checked, and not back; not to one in another room, nor heard from them', () => {
  const { net, a, b, c } = room();
  a.jam.send(['on', 's', 60, 0.8]);
  a.jam.send(['pad', 2, 1]);
  a.jam.send(['off', 's', 60]);
  net.flush();
  assert.deepEqual(b.heard, [['on', 's', 60, 0.8, 'Ana'], ['pad', 2, 1, 'Ana'], ['off', 's', 60, 'Ana']]);
  assert.deepEqual(a.heard, [], 'nothing back');
  assert.deepEqual(c.heard, [], 'nothing sent to the hallway');
  // Cy, in the hallway, sends anyway (to those it takes to be in its room): no one here plays it.
  c.jam.send(['pad', 0, 1]);
  net.flush();
  assert.deepEqual([a.heard, b.heard.length], [[], 3]);
  // What isn't a play, or a kind this page doesn't know, is let be.
  b.session.channel('instruments:play').send(['pad', 99, 1]);
  b.session.channel('instruments:play').send({ kind: 'pad' });
  b.session.channel('instruments:play').send(['sparkle', 1]);
  net.flush();
  assert.deepEqual(a.heard, []);
});

test('nothing goes while the band isn\'t the session\'s, either way, but what lets go, from one who played', () => {
  const { net, a, b } = room();
  a.ready = false;
  a.jam.send(['on', 's', 60, 0.8]);
  net.flush();
  assert.deepEqual(b.heard, [], 'not sent');
  a.ready = true;
  a.jam.send(['on', 's', 62, 0.8]);
  net.flush();
  b.ready = false;
  a.jam.send(['on', 's', 64, 0.8]);
  a.jam.send(['bend', 0.5]);
  a.jam.send(['off', 's', 62]);
  a.jam.send(['all']);
  net.flush();
  assert.deepEqual(b.heard.map((h) => h.slice(0, 3).join()), ['on,s,62', 'off,s,62', 'all,Ana']);
  // Sent while this page's band isn't the session's: only what lets go, of what was held before.
  b.ready = true;
  a.ready = false;
  a.jam.send(['on', 's', 67, 0.8]);
  a.jam.send(['off', 's', 64]);
  net.flush();
  assert.deepEqual(b.heard.slice(3).map((h) => h.slice(0, 3).join()), ['off,s,64']);
  // An end from one who never played here: nothing of theirs to let go.
  b.jam.send(['off', 'k', 40]);
  net.flush();
  assert.deepEqual(a.heard, []);
});

test('a move is sent at most every MOVE_MS, its latest, and before anything played after it', () => {
  const { net, a, b } = room();
  T.now = 1000;
  a.jam.send(['bend', 0.1]); // sent at once
  T.now += 5;
  a.jam.send(['bend', 0.2]);
  a.jam.send(['gbend', 3, 0.5]); // another move, sent at once
  T.now += 5;
  a.jam.send(['bend', 0.3]);
  a.jam.tick();
  net.flush();
  assert.deepEqual(b.heard.map((h) => h.slice(0, -1)), [['bend', 0.1], ['gbend', 3, 0.5]]);
  T.now = 1000 + MOVE_MS;
  a.jam.tick();
  net.flush();
  assert.deepEqual(b.heard.at(-1), ['bend', 0.3, 'Ana'], 'the latest, once its time comes');
  T.now += 5;
  a.jam.send(['bend', 0.4]); // waits
  a.jam.send(['gbend', 3, 0.8]); // its last went MOVE_MS ago: at once
  T.now += 1;
  a.jam.send(['gbend', 3, 1]); // waits
  T.now += 1;
  a.jam.send(['lift', 3]); // the moves waiting go first, as they came
  net.flush();
  assert.deepEqual(b.heard.slice(-4).map((h) => h.slice(0, -1)), [['gbend', 3, 0.8], ['bend', 0.4], ['gbend', 3, 1], ['lift', 3]]);
  T.now += MOVE_MS;
  a.jam.tick();
  net.flush();
  assert.equal(b.heard.length, 7, 'nothing waits');
});

test('each visitor\'s notes are capped: so many at once, then so many a second; moves and what lets go are not', () => {
  const { net, a, b } = room();
  T.now = 5000;
  for (let n = 0; n < 100; n++) a.jam.send(['on', 'k', n, 0.5]);
  net.flush();
  const ons = () => b.heard.filter((h) => h[0] === 'on').length;
  assert.equal(ons(), NOTE_BURST);
  T.now += 500;
  for (let n = 0; n < 100; n++) a.jam.send(['on', 'k', n, 0.5]);
  net.flush();
  assert.equal(ons(), NOTE_BURST + NOTE_RATE / 2, 'half a second later, half a second\'s more');
  for (let n = 0; n < 100; n++) a.jam.send(['off', 'k', n]);
  net.flush();
  assert.equal(b.heard.filter((h) => h[0] === 'off').length, 100, 'every note let go');
  T.now += 10_000;
  for (let n = 0; n < 3; n++) a.jam.send(['pad', n, 1]);
  net.flush();
  assert.equal(b.heard.filter((h) => h[0] === 'pad').length, 3, 'played again once the allowance is back');
  // Another visitor's allowance is their own.
  const before = a.heard.length;
  for (let n = 0; n < 10; n++) b.jam.send(['pad', 1, 1]);
  net.flush();
  assert.equal(a.heard.length - before, 10);
});

test('one who played is let go of when they leave the session or this room, and everyone when this page leaves it; one who never played, not', () => {
  const net = new Net();
  const sa = new FakeSession(net, 'aaaaaaaaaaaa', 'Ana'), sb = new FakeSession(net, 'bbbbbbbbbbbb', 'Bo'), sd = new FakeSession(net, 'dddddddddddd', 'Di'), se = new FakeSession(net, 'eeeeeeeeeeee', 'Ed');
  const a = player(sa), b = player(sb), d = player(sd), e = player(se);
  for (const s of [sb, sd, se]) net.connect(sa, s);
  b.jam.send(['on', 's', 60, 1]);
  d.jam.send(['fret', 0, 3, 1]);
  net.flush();
  assert.equal(a.heard.length, 2);
  net.part(sa, se); // Ed never played here
  net.part(sa, sb); // Bo leaves, holding his note
  assert.deepEqual(a.gone, ['peer-bbbbbbbbbbbb']);
  sd.move('hallway'); // Di walks out to the hallway, holding her fret
  assert.deepEqual(a.gone, ['peer-bbbbbbbbbbbb', 'peer-dddddddddddd']);
  // Di comes back and plays again, then Ana leaves the session: Di let go of.
  sd.move('instruments');
  d.jam.send(['pad', 0, 1]);
  net.flush();
  a.jam.detach();
  assert.deepEqual(a.gone, ['peer-bbbbbbbbbbbb', 'peer-dddddddddddd', 'peer-dddddddddddd']);
  assert.equal(a.jam.attached, false);
  // Out of the session: nothing sent, nothing heard.
  a.jam.send(['pad', 0, 1]);
  d.jam.send(['pad', 0, 1]);
  net.flush();
  assert.deepEqual([d.heard.length, a.heard.length], [0, 3]);
  e.jam.detach();
});
