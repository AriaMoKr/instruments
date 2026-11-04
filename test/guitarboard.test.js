// The guitar's desk (guitarboard.js): where it stands, turned, against the right wall by the rack, and
// the room's points and rays turned into its frame and back; the guitar on its top (the neck to the
// left, the low E nearest, the frets as a guitar's, the body round the pickups and the bridge), the
// chord buttons behind the neck, the knobs and the pickup switch on the body; on the panel its jacks,
// the amp's knobs and the four pedals; what a ray meets on it; and one walking round it and playing it
// (on a screen all of it in view; in VR the neck and the strings over the body in reach).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import { BOARD, boardBlocks, boardPoint, boardStand, jackAt, layoutBoard, panelPoint } from '../public/js/board.js';
import { layoutSynth } from '../public/js/synthboard.js';
import { layoutRack } from '../public/js/rackboard.js';
import { layoutKeyboard } from '../public/js/keysboard.js';
import {
  BEND, BODY, GUITAR, bendFor, chordAt, clampGuitar, deskXZ, fretAt, fretPlace, guitarBlocks, guitarDialAt, guitarFront, guitarPoint, guitarStand,
  hitGuitar, layoutGuitar, neckHalf, onBody, partAt, pedalAt, pickAt, roomXZ, spacingAt, stringAt, stringB, stringsAlong, strummed, switchA, switchAt,
} from '../public/js/guitarboard.js';
import { CHORDS, FRETS, GUITAR_KNOBS, PEDALS, PICKUPS } from '../public/js/guitar.js';
import { JACKS } from '../public/js/patch.js';
import { PICK, PICKUP_PLACES } from '../public/js/strings.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const S = layoutSynth(L, B);
const rack = layoutRack(L, S);
const K = layoutKeyboard(L, B, rack);
const G = layoutGuitar(L, rack, K);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: 0, step: 0, knob: 0, jack: 0, key: 0, dial: 0, button: 0, seq: 0, rack: 0, keys: 0, guitar: 0 });
/** A point in the desk's own frame in the room. */
const room = ([x, y, z]) => [G.place.x - z, y, G.place.z + x];
/** A point on the top (a along it, b up it, h out of it), in the room. */
const top = (a, b, h = 0) => room(boardPoint(G, a, b, h));
/** A point on the panel, in the room. */
const panel = (a, b, h = 0) => room(panelPoint(G, a, b, h));
/** The strings' plane over the top. */
const STRINGS = GUITAR.body + GUITAR.string;
/** What a ray from o towards the point t meets on the guitar's desk, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitGuitar(G, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** Where one plays from on a screen, seen from: in front of its middle, a little back. */
const eye = room([G.width / 2, EYE, G.zFront + 0.6]);
const others = [B, S, rack, K];

test('it stands against the right wall by the rack, turned to face into the room, room to walk round it', () => {
  assert.deepEqual(G.place, { x: L.x1, z: rack.zFront + GUITAR.gap, yaw: -Math.PI / 2 });
  // Its frame and the room's, there and back.
  for (const [x, z] of [[0, 0], [0.3, 0.7], [-1, 2]]) {
    const [rx, rz] = roomXZ(G, x, z);
    assert.deepEqual(deskXZ(G, rx, rz).map((c) => c.toFixed(12)), [x, z].map((c) => c.toFixed(12)));
  }
  // In the room: along the right wall, its back to it, its left end towards the far wall.
  const [backX] = roomXZ(G, 0, G.zBack), [frontX] = roomXZ(G, 0, G.zFront), [, leftZ] = roomXZ(G, 0, 0), [, rightZ] = roomXZ(G, G.width, 0);
  assert.ok(near(backX, L.x1 - GUITAR.wall) && frontX < backX && frontX > 0, 'against the right wall, its front towards the room');
  assert.ok(leftZ < rightZ && near(leftZ, rack.zFront + GUITAR.gap), 'its left end nearest the far wall, the rack');
  assert.ok(rightZ < -L.depth / 2, 'in the far half of the room');
  // Clear of the other desks, a way between it and the rack, and one may stand at the rack still.
  for (const D of others) for (const x of [D.x0, D.x1]) assert.ok(!guitarBlocks(G, x, D.zFront), 'not where one stands round another desk');
  assert.ok(G.place.z - BOARD.keep > rack.zFront + BOARD.keep, 'a way between it and the rack');
  const r = boardStand(rack, 0.3);
  assert.ok(!guitarBlocks(G, r.x, r.z), 'one may stand at the rack');
  assert.ok(frontX - BOARD.keep > L.x0 + MARGIN + 3, 'the room clear in front of it');
  // As a desk is: a table's height, its panel leaning back, its sign over it.
  assert.ok(G.top > G.front && G.front > 0.75 && G.top < 1.05);
  const n = G.normal, u = G.up, N = G.panel.normal, U = G.panel.up;
  for (const [a, b] of [[n, u], [N, U]]) assert.ok(near(Math.hypot(...a), 1) && near(Math.hypot(...b), 1) && near(a[1] * b[1] + a[2] * b[2], 0));
  assert.ok(near(panelPoint(G, 0, G.panel.height, -GUITAR.panel.thick)[2], G.zBack));
  assert.ok(near(panelPoint(G, 0, G.panel.height)[1], G.panel.top) && G.panel.top < G.sign.y0, 'under its sign');
  assert.ok(near(G.sign.x0, 0) && near(G.sign.x1, G.width) && near(G.sign.y0, B.sign.y0) && near(G.sign.y1, B.sign.y1) && near(G.sign.z, GUITAR.sign.out));
  assert.ok(near(room([0, 0, G.sign.z])[0], L.x1 - GUITAR.sign.out), 'on the right wall');
});

test('the guitar on its top: its neck to the left, the low E nearest, the frets as a guitar\'s, the body round the pickups and the bridge', () => {
  assert.equal(G.frets.length, FRETS + 1);
  assert.ok(near(G.frets[0], G.nut) && near(G.frets[12] - G.nut, GUITAR.scale / 2) && near(G.bridge - G.nut, GUITAR.scale));
  for (let f = 1; f <= FRETS; f++) {
    assert.ok(G.frets[f] > G.frets[f - 1], `${f}`);
    if (f > 1) assert.ok(G.frets[f] - G.frets[f - 1] < G.frets[f - 1] - G.frets[f - 2], `${f}: closer than the one before`);
    assert.equal(fretAt(G, fretPlace(G, f)), f);
    assert.equal(fretAt(G, G.frets[f] - 1e-6), f);
    assert.ok(G.frets[f] - G.frets[f - 1] >= 0.02, `${f}: wide enough for a finger`);
  }
  assert.deepEqual([fretAt(G, G.nut - 0.01), fretAt(G, G.frets[FRETS] + 0.001)], [0, -1]);
  // The strings, the low E nearest, further apart towards the bridge.
  assert.ok(near(spacingAt(G, G.nut), GUITAR.nut) && near(spacingAt(G, G.bridge), GUITAR.bridge));
  for (const a of [G.nut, 0.5, G.bridge]) {
    for (let s = 1; s < 6; s++) assert.ok(near(stringB(G, s, a) - stringB(G, s - 1, a), spacingAt(G, a)));
    assert.ok(near((stringB(G, 0, a) + stringB(G, 5, a)) / 2, G.mid));
    for (let s = 0; s < 6; s++) {
      const o = stringAt(G, a, stringB(G, s, a) + 0.3 * spacingAt(G, a));
      assert.ok(o.string === s && near(o.across, 0.3, 1e-9), `${a} ${s}`);
    }
    assert.equal(stringAt(G, a, stringB(G, 0, a) - 0.7 * spacingAt(G, a)).string, 0, 'a little past the low E');
    assert.equal(stringAt(G, a, stringB(G, 0, a) - 0.8 * spacingAt(G, a)).string, -1, 'further past it');
    assert.equal(stringAt(G, a, stringB(G, 5, a) + 0.8 * spacingAt(G, a)).string, -1);
  }
  // In the room: the nut to the player's left (towards the far wall), the low E nearest them.
  assert.ok(top(G.nut, G.mid)[2] < top(G.bridge, G.mid)[2], 'the neck to the left');
  assert.ok(top(0.5, stringB(G, 0, 0.5))[0] < top(0.5, stringB(G, 5, 0.5))[0], 'the low E nearest');
  // On the top, all of it.
  assert.ok(G.headEnd >= GUITAR.margin - 1e-9 && G.nut - G.headEnd >= 0.15, 'the headstock');
  for (const [u, w] of BODY) {
    assert.ok(G.body + u > 0 && G.body + u <= G.width - GUITAR.margin + 1e-9, `${u}, ${w}: on the top along it`);
    assert.ok(G.mid + w >= GUITAR.margin - 1e-9 && G.mid + w <= G.length - GUITAR.margin + 1e-9, `${u}, ${w}: on the top across it`);
  }
  // The pickups where the strings are heard, on the body; the neck into the body.
  assert.ok(near((G.bridge - G.pickups.neck) / GUITAR.scale, PICKUP_PLACES.neck) && near((G.bridge - G.pickups.bridge) / GUITAR.scale, PICKUP_PLACES.bridge));
  for (const a of [G.pickups.neck, G.pickups.bridge, G.bridge]) for (const s of [0, 5]) assert.ok(onBody(G, a, stringB(G, s, a)), `${a} ${s}: on the body`);
  assert.ok(G.neckEnd > G.frets[FRETS] && onBody(G, G.neckEnd - 0.01, G.mid) && !onBody(G, G.frets[FRETS] - 0.05, G.mid));
  // Its parts.
  assert.equal(partAt(G, (G.headEnd + G.nut) / 2, G.mid), 'head');
  assert.equal(partAt(G, (G.headEnd + G.nut) / 2, G.mid + GUITAR.headWide), '');
  assert.equal(partAt(G, G.headEnd - 0.01, G.mid), '');
  for (let f = 1; f <= FRETS; f++) for (const s of [0, 5]) assert.equal(partAt(G, fretPlace(G, f), stringB(G, s, fretPlace(G, f))), 'fret', `fret ${f}, string ${s}`);
  assert.equal(partAt(G, 0.5, G.mid + neckHalf(G, 0.5) + 0.002), '', 'beside the neck');
  for (const a of [G.frets[FRETS] + 0.002, G.pickups.neck, G.pickups.bridge, G.bridge - 0.01]) assert.equal(partAt(G, a, stringB(G, 2, a)), 'strum', `${a}`);
  assert.equal(partAt(G, G.bridge + 0.01, G.mid), 'mute');
  assert.equal(partAt(G, G.bridge + 0.08, G.mid), 'body');
  assert.equal(partAt(G, G.pickups.neck, G.mid + 0.12), 'body');
  assert.equal(partAt(G, G.width - 0.01, G.mid), '');
  // The pick: nearer the bridge, nearer its end of the string.
  assert.ok(pickAt(G, G.pickups.bridge) < pickAt(G, G.pickups.neck) && near(pickAt(G, G.bridge), PICK.min) && near(pickAt(G, G.nut), PICK.max));
});

test('behind the neck the chord buttons, two rows of eight as the keys that choose them, 1–8 behind Q–I', () => {
  assert.equal(G.chords.length, CHORDS.length);
  for (const [i, c] of G.chords.entries()) {
    assert.equal(c.chord, i);
    assert.ok(c.a1 - c.a0 >= 0.04 && c.b1 - c.b0 >= 0.04, `${CHORDS[i].id}: large enough to press`);
    assert.ok(c.a0 >= G.deck.a0 && c.a1 <= G.deck.a1 && c.b0 >= G.deck.b0 && c.b1 <= G.deck.b1, `${CHORDS[i].id} on the deck`);
    assert.equal(chordAt(G, (c.a0 + c.a1) / 2, (c.b0 + c.b1) / 2), i);
    for (const [a, b] of [[c.a0, c.b0], [c.a1, c.b0], [c.a0, c.b1], [c.a1, c.b1]]) assert.equal(partAt(G, a, b), '', `${CHORDS[i].id}: clear of the guitar`);
    for (const o of G.chords) if (o !== c) assert.ok(o.a0 >= c.a1 + 0.005 || o.a1 <= c.a0 - 0.005 || o.b0 >= c.b1 + 0.005 || o.b1 <= c.b0 - 0.005, `${CHORDS[i].id} apart from ${CHORDS[o.chord].id}`);
    if (i % 8) assert.ok(c.a0 > G.chords[i - 1].a1, 'left to right');
  }
  assert.ok(G.chords[0].b0 > G.chords[8].b1, 'the first row behind the second');
  assert.ok(G.deck.a0 >= 0 && G.deck.b1 <= G.length && G.deck.b0 > G.mid + neckHalf(G, G.nut), 'behind the neck, on the top');
  assert.equal(chordAt(G, G.nut, G.mid), -1);
});

test('the guitar\'s knobs and its pickup switch on its body past the high E, the amp\'s knobs on the panel under AMP', () => {
  assert.deepEqual(G.dials.map((d) => d.id), GUITAR_KNOBS.map((k) => k.id));
  assert.deepEqual(G.dials.map((d) => d.section), GUITAR_KNOBS.map((k) => k.section));
  assert.deepEqual(G.dials.map((d) => d.on), GUITAR_KNOBS.map((k) => (k.section === 'guitar' ? 'top' : 'panel')));
  const R = GUITAR.knob.r, A = GUITAR.amp.r;
  for (const [i, d] of G.dials.entries()) {
    assert.equal(guitarDialAt(G, d.a, d.b, d.on), i);
    assert.equal(guitarDialAt(G, d.a, d.b, d.on === 'top' ? 'panel' : 'top'), -1);
    assert.deepEqual([d.r, d.h], d.section === 'guitar' ? [R, GUITAR.knob.h] : d.section === 'amp' ? [A, GUITAR.amp.h] : [GUITAR.pedal.knob.r, GUITAR.pedal.knob.h]);
    if (d.on === 'top') {
      for (let k = 0; k < 8; k++) assert.ok(onBody(G, d.a + R * Math.cos(k), d.b + R * Math.sin(k)), `${d.id} on the body`);
      assert.ok(d.b - R > stringB(G, 5, d.a) + GUITAR.edge + 0.02, `${d.id} past the high E`);
      assert.equal(switchAt(G, d.a, d.b), -1);
    } else {
      assert.ok(d.a - d.r > G.panel.display.a1 + 0.02 && d.b - d.r > 0.04 && d.b + d.r < G.panel.height - 0.04, `${d.id} on the panel, right of the display`);
      // Apart from the others, their scales too (as far out again as a third of each one's radius).
      for (const o of G.dials) if (o !== d && o.on === 'panel') assert.ok(Math.hypot(o.a - d.a, o.b - d.b) >= 1.33 * (o.r + d.r) + 0.01, `${d.id} apart from ${o.id}`);
    }
    if (d.section === 'amp') assert.ok(d.a + 1.5 * A < G.panel.pedals[0].a0, `${d.id} left of the pedals`);
  }
  const [volume, tone] = G.dials;
  assert.ok(Math.hypot(volume.a - tone.a, volume.b - tone.b) > 2 * R * 1.3, 'VOLUME and TONE apart');
  const amp = G.panel.titles.find((t) => t.text === 'AMP');
  assert.ok(amp && near(amp.a, (G.dials[2].a + G.dials[6].a) / 2) && amp.b > GUITAR.amp.b + A + 0.04 && amp.b < G.panel.height, 'AMP over them');
  // The pickup switch: its three places along its slot, toward the neck to toward the bridge.
  const s = G.switch;
  for (const [i] of PICKUPS.entries()) {
    assert.equal(switchAt(G, switchA(G, i), (s.b0 + s.b1) / 2), i);
    assert.equal(guitarDialAt(G, switchA(G, i), (s.b0 + s.b1) / 2, 'top'), -1);
  }
  assert.ok(switchA(G, 0) < switchA(G, 2), 'NECK towards the neck');
  for (const [a, b] of [[s.a0, s.b0], [s.a1, s.b0], [s.a0, s.b1], [s.a1, s.b1]]) assert.equal(partAt(G, a, b), 'body', 'on the body');
  assert.ok(s.b0 > stringB(G, 5, s.a1) + GUITAR.edge + 0.02, 'past the high E');
  assert.equal(switchAt(G, s.a1 + 0.02, s.b0), -1);
});

test('on the panel its jacks at its left end, nearest the rack, under PATCH, after the keyboard\'s in the room\'s list', () => {
  const P = G.panel, J = BOARD.panel.jack;
  assert.deepEqual(P.jacks.map((j) => j.id), JACKS.filter((j) => j.module === 'guitar').map((j) => j.id));
  assert.equal(P.jackBase, K.panel.jackBase + K.panel.jacks.length);
  for (const [i, j] of P.jacks.entries()) {
    const spec = JACKS.find((x) => x.id === j.id);
    assert.equal(j.out, spec.dir === 'out', `${j.id}: its plate as it goes`);
    assert.equal(jackAt(G, j.a, j.b), i);
    assert.ok(j.a - 2 * J >= 0.015 && j.a + 2 * J < P.display.a0 - 0.02 && j.b - J - 0.02 > 0 && j.b + 2 * J < P.height - 0.04, `${j.id} on the panel, left of the display`);
    for (const o of P.jacks) if (o !== j) assert.ok(Math.hypot(o.a - j.a, o.b - j.b) >= BOARD.panel.pitch - 1e-9, `${j.id} apart from ${o.id}`);
    assert.equal(guitarDialAt(G, j.a, j.b, 'panel'), -1);
    assert.equal(pedalAt(G, j.a, j.b), -1);
  }
  // Its outs over its ins; in the room, its left end the nearest the rack.
  const [out, notes, wah, clock] = P.jacks;
  assert.ok(near(out.b, notes.b) && near(wah.b, clock.b) && out.b > wah.b && near(out.a, wah.a) && out.a < notes.a);
  assert.ok(roomXZ(G, out.a, 0)[1] < roomXZ(G, P.display.a0, 0)[1], 'towards the far wall');
  const patch = P.titles.find((t) => t.text === 'PATCH');
  assert.ok(patch && near(patch.a, (out.a + notes.a) / 2) && patch.b > out.b + 2 * J + 0.02 && patch.b < P.height, 'PATCH over them');
  assert.ok(patch.a0 < out.a - J && patch.a1 > notes.a + J, 'its line over them all');
});

test('on the panel its four pedals at its right end, each with its knob, its light and its footswitch', () => {
  const P = G.panel, E = GUITAR.pedal;
  assert.deepEqual(P.pedals.map((p) => [p.id, p.label]), PEDALS.map((p) => [p.id, p.label]));
  for (const [i, p] of P.pedals.entries()) {
    assert.ok(p.a1 - p.a0 >= 0.07 && p.b1 - p.b0 >= 0.18, `${p.id}: large enough to stomp`);
    assert.ok(p.a0 > P.amp.a1 && p.a1 <= G.width - 0.02 && p.b0 > 0 && p.b1 < P.height, `${p.id}: on the panel right of the amp`);
    if (i) assert.ok(p.a0 >= P.pedals[i - 1].a1 + 0.005, `${p.id}: right of ${P.pedals[i - 1].id}`);
    // Its knob on it, its own (guitar.js PEDALS's), under its name.
    const d = G.dials[p.knob];
    assert.equal(d.id, PEDALS[i].knob);
    assert.ok(near(d.a, p.a) && d.a - d.r * 1.33 > p.a0 && d.a + d.r * 1.33 < p.a1 && d.b + d.r * 1.33 < E.name - 0.004, `${p.id}: its knob on it`);
    // Its footswitch under its light, under its knob: a press on it, or on the pedal under the knob's name, stomps it.
    assert.ok(E.stomp.b + E.stomp.r < E.led - 0.01 && E.led < E.press && E.press < d.b - d.r * 1.3 - 0.008, `${p.id}: its light between`);
    for (const [a, b] of [[p.a, E.stomp.b], [p.a0 + 0.001, p.b0 + 0.001], [p.a1 - 0.001, E.press], [p.a, E.led]]) {
      assert.equal(pedalAt(G, a, b), i, `${p.id} at ${a}, ${b}`);
      assert.equal(guitarDialAt(G, a, b, 'panel'), -1);
    }
    for (const [a, b] of [[p.a, d.b], [p.a, E.press + 0.002], [p.a0 - 0.003, E.stomp.b], [p.a, E.name]]) assert.equal(pedalAt(G, a, b), -1, `${p.id}: not at ${a}, ${b}`);
  }
});

test('a ray meets the strings over a fret, over the body, the bridge, a knob, the switch, a chord, the panel\'s jacks, knobs and pedals, and the rest as the guitar', () => {
  const check = (h, kind, guitar, what, jack = -1) => {
    assert.deepEqual([h?.kind, h?.guitar, h?.pad, h?.step, h?.knob, h?.jack, h?.key, h?.dial, h?.button, h?.seq, h?.rack, h?.keys], [kind, guitar, -1, -1, -1, jack, -1, -1, -1, -1, -1, -1], what);
    assert.equal(h.walkable, false);
  };
  for (let s = 0; s < 6; s++) {
    for (let f = 1; f <= FRETS; f++) {
      const a = fretPlace(G, f), h = ray(eye, top(a, stringB(G, s, a), STRINGS));
      check(h, 'fret', s, `string ${s}, fret ${f}`);
      assert.ok(h.u === f && Math.abs(h.v) < 1e-6, `${h.u} ${h.v}`);
      const beside = ray(eye, top(a, stringB(G, s, a) + 0.4 * spacingAt(G, a), STRINGS));
      assert.deepEqual([beside?.guitar, beside?.u], [s, f]);
      assert.ok(near(beside.v, 0.4, 1e-6));
    }
    for (const a of [G.pickups.neck, (G.pickups.neck + G.pickups.bridge) / 2, G.pickups.bridge]) {
      const h = ray(eye, top(a, stringB(G, s, a), STRINGS));
      check(h, 'strum', s, `string ${s} at ${a}`);
      assert.ok(near(h.u, pickAt(G, a), 1e-9));
    }
  }
  check(ray(eye, top(G.bridge + 0.01, G.mid, STRINGS)), 'mute', -1, 'the bridge');
  check(ray(eye, top(G.bridge + 0.09, G.mid, STRINGS)), 'guitar', -1, 'the body');
  check(ray(eye, top((G.headEnd + G.nut) / 2, G.mid, STRINGS)), 'guitar', -1, 'the headstock');
  for (const [i, d] of G.dials.entries()) {
    check(ray(eye, d.on === 'top' ? top(d.a, d.b, GUITAR.body + d.h) : panel(d.a, d.b, d.h)), 'guitarknob', i, d.id);
  }
  for (const [i] of PICKUPS.entries()) check(ray(eye, top(switchA(G, i), (G.switch.b0 + G.switch.b1) / 2, GUITAR.body)), 'pickup', i, PICKUPS[i].id);
  for (const [i, c] of G.chords.entries()) check(ray(eye, top((c.a0 + c.a1) / 2, (c.b0 + c.b1) / 2, GUITAR.chord.rise)), 'chord', i, CHORDS[i].id);
  for (const [j, J] of G.panel.jacks.entries()) check(ray(eye, panel(J.a, J.b)), 'jack', -1, J.id, G.panel.jackBase + j);
  for (const [i, p] of G.panel.pedals.entries()) {
    check(ray(eye, panel(p.a, GUITAR.pedal.stomp.b, GUITAR.pedal.stomp.h)), 'pedal', i, `${p.id}'s footswitch`);
    check(ray(eye, panel(p.a, GUITAR.pedal.name)), 'guitar', -1, `${p.id}'s name`);
  }
  // Its normals, turned into the room's: the top's and the panel's towards the player (the room's −x).
  const t = ray(eye, top(0.5, G.mid, STRINGS)), p = ray(eye, panel(0.2, 0.07));
  assert.ok(near(t.nx, -G.normal[2]) && near(t.ny, G.normal[1]) && near(t.nz, 0) && t.nx < 0);
  check(p, 'guitar', -1, 'the display');
  assert.ok(near(p.nx, -G.panel.normal[2]) && near(p.ny, G.panel.normal[1]) && p.nx < 0);
  // Where it met it, in the room.
  const at = top(0.5, stringB(G, 2, 0.5), STRINGS), h = ray(eye, at);
  assert.ok(near(h.x, at[0], 1e-9) && near(h.y, at[1], 1e-9) && near(h.z, at[2], 1e-9));
  // Its front, its ends, its sign.
  const [fx, fz] = roomXZ(G, G.width / 2, G.zFront);
  const front = ray([fx - 1, 0.5, fz], [fx, 0.5, fz]);
  assert.deepEqual([front?.kind, front?.nx, front?.nz], ['guitar', -1, 0]);
  const [, z0] = roomXZ(G, 0, 0), [, z1] = roomXZ(G, G.width, 0), [sx] = roomXZ(G, 0, (G.zBack + G.zFront) / 2);
  const left = ray([sx, 0.5, z0 - 0.3], [sx, 0.5, z0]), right = ray([sx, 0.5, z1 + 0.3], [sx, 0.5, z1]);
  assert.deepEqual([left?.kind, left?.nx, left?.nz], ['guitar', 0, -1], 'its left end, towards the far wall');
  assert.deepEqual([right?.kind, right?.nx, right?.nz], ['guitar', 0, 1]);
  const sign = ray([0, EYE, (z0 + z1) / 2], [L.x1, EYE, (z0 + z1) / 2]);
  assert.deepEqual([sign?.kind, sign?.nx], ['guitar', -1]);
  assert.ok(near(sign.x, L.x1 - GUITAR.sign.out));
  assert.equal(ray(eye, [L.x1, 2.5, (z0 + z1) / 2]), null, 'over it');
  assert.equal(ray(eye, top(0.5, G.mid, STRINGS), 0.1), null, 'the room nearer');
  assert.equal(ray([0, EYE, -1], [0, EYE, L.z1]), null, 'the far wall, not it');
});

test('a pick moved across the strings crosses them in its order; a finger pressing one, moved across it, bends it', () => {
  const strings = [0, 0, 0, 0, 0, 0], when = [0, 0, 0, 0, 0, 0], a = G.pickups.neck, b = (s) => stringB(G, s, a);
  assert.equal(strummed(G, a, b(-0.5), a, b(5.5), strings, when), 6, 'down, across all six');
  assert.deepEqual(strings, [0, 1, 2, 3, 4, 5]);
  assert.ok(when.every((w, i) => near(w, (i + 0.5) / 6, 1e-9) && (!i || w > when[i - 1])), `${when}`);
  assert.equal(strummed(G, a, b(4.5), a, b(1.2), strings, when), 3, 'up, across three');
  assert.deepEqual(strings.slice(0, 3), [4, 3, 2]);
  assert.equal(strummed(G, a, b(2.05), a, b(2.9), strings, when), 0, 'from a string, not up to the next: none');
  assert.equal(strummed(G, a, b(1.9), a, b(2.05), strings, when), 1, 'over one');
  assert.equal(strings[0], 2);
  assert.equal(strummed(G, a, b(3), a, b(3), strings, when), 0, 'not moved');
  assert.equal(strummed(G, G.pickups.neck, b(0.5), G.pickups.bridge, stringB(G, 0.5, G.pickups.bridge), strings, when), 0, 'along between two');
  // A bend: none near the string, a semitone a half spacing further, at most MAX_BEND.
  assert.deepEqual([bendFor(0), bendFor(0.19), bendFor(-0.15)], [0, 0, 0]);
  assert.ok(near(bendFor(BEND.dead + BEND.per), 1) && near(bendFor(-(BEND.dead + BEND.per)), 1));
  assert.equal(bendFor(3), 2);
});

test('a point in the room on the top, over the strings', () => {
  const out = { a: 0, b: 0, h: 0 };
  for (const [a, b, h] of [[0.3, 0.2, STRINGS], [1, 0.4, 0], [0.7, 0.25, 0.1]]) {
    guitarPoint(G, ...top(a, b, h), out);
    assert.ok(near(out.a, a) && near(out.b, b) && near(out.h, h - STRINGS), `${a} ${b} ${h}: ${out.a} ${out.b} ${out.h}`);
  }
});

test('a ray onto the strings\' plane, over the guitar or past its edge (a drag gone off it); none from under it, along it or away', () => {
  const out = { a: 0, b: 0, t: 0 };
  for (const [a, b] of [[0.5, G.mid], [fretPlace(G, 3), stringB(G, 0, fretPlace(G, 3))], [G.pickups.bridge, stringB(G, 5, G.pickups.bridge) + 0.01], [-0.2, 0.9]]) {
    const p = top(a, b, STRINGS), d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], n = Math.hypot(...d);
    assert.equal(stringsAlong(G, eye[0], eye[1], eye[2], d[0] / n, d[1] / n, d[2] / n, out), out);
    assert.ok(near(out.a, a, 1e-9) && near(out.b, b, 1e-9) && near(out.t, n, 1e-9), `${a} ${b}: ${out.a} ${out.b} ${out.t}`);
  }
  const under = top(0.5, G.mid, 0.01), over = top(0.5, G.mid, 0.2), d = [over[0] - under[0], over[1] - under[1], over[2] - under[2]], n = Math.hypot(...d);
  assert.equal(stringsAlong(G, ...under, d[0] / n, d[1] / n, d[2] / n), null, 'from under it, up through it');
  assert.equal(stringsAlong(G, ...over, d[0] / n, d[1] / n, d[2] / n), null, 'away from it');
  // Up the top, in the room (its frame's up turned: the top leans back towards the wall, the room's +x).
  assert.equal(stringsAlong(G, ...over, -G.up[2], G.up[1], G.up[0]), null, 'along it');
});

test('one walks round it, its front and its ends; on a screen all of it in view, in VR the neck and the strings over the body in reach', () => {
  const [fx, fz] = roomXZ(G, G.width / 2, G.zFront), X = fx - BOARD.keep;
  assert.ok(guitarBlocks(G, fx - 0.1, fz) && !guitarBlocks(G, X - 0.01, fz));
  assert.ok(guitarBlocks(G, fx + 0.1, G.place.z - BOARD.keep + 0.01) && !guitarBlocks(G, fx + 0.1, G.place.z - BOARD.keep - 0.01), 'its left end');
  assert.ok(!guitarBlocks(G, L.x1 - MARGIN, G.place.z + G.width + BOARD.keep + 0.01), 'past its right end, by the wall');
  const c = clampGuitar(G, X - 0.3, fz, X + 0.2, fz + 0.1);
  assert.ok(near(c.x, X) && near(c.z, fz + 0.1), 'stopped at its front, sliding along it');
  const e = clampGuitar(G, L.x1 - 0.3, G.place.z - 0.4, L.x1 - 0.3, G.place.z - 0.1);
  assert.ok(near(e.z, G.place.z - BOARD.keep) && near(e.x, L.x1 - 0.3), 'stopped at its left end');
  // On a screen: where one may stand, facing it (the room's +x), looking down at it.
  const fovFor = (aspect) => Math.min(100, Math.max(70, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI));
  const free = (x, z) => !others.some((D) => boardBlocks(D, x, z));
  for (const aspect of [16 / 9, 4 / 3, 9 / 19.5]) {
    const at = guitarFront(G, { fov: fovFor(aspect), aspect, free });
    assert.ok(!guitarBlocks(G, at.x, at.z) && free(at.x, at.z), `${aspect}: where one may stand, ${at.x}, ${at.z}`);
    assert.ok(near(at.yaw, -Math.PI / 2) && at.pitch < -0.2 && at.x > L.x0 + MARGIN, `${aspect}: facing it, looking down`);
    assert.ok(near(at.z, G.place.z + G.width / 2), `${aspect}: in front of its middle`);
  }
  // In VR: at the neck's end, facing it; the nut in reach of a left hand, the bridge of a right.
  const s = guitarStand(G);
  assert.ok(!guitarBlocks(G, s.x, s.z) && free(s.x, s.z) && near(s.yaw, -Math.PI / 2) && near(s.z, G.place.z + G.neckEnd));
  const leftShoulder = [s.x, EYE - 0.25, s.z - 0.2], rightShoulder = [s.x, EYE - 0.25, s.z + 0.2];
  const reach = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  for (const st of [0, 5]) {
    assert.ok(reach(leftShoulder, top(G.nut, stringB(G, st, G.nut), STRINGS)) < 0.75, `the nut's string ${st} in reach`);
    assert.ok(reach(rightShoulder, top(G.bridge, stringB(G, st, G.bridge), STRINGS)) < 0.75, `the bridge's string ${st} in reach`);
  }
});
