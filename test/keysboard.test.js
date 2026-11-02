// The keyboard (keysboard.js): where it stands beside the drum board and what is on it (its keys, its
// drawbars and knobs in a row with their names and their sections', and the panel's display, buttons
// and jacks), a drawbar's tab along its slot, what a ray meets on it (a black key over the white ones,
// a drawbar, a knob, a button, a jack), one walking round it and playing it (all of it in view on a
// screen, or on a narrow one the keys round middle C; the keys in reach in VR), and a tip down in a key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import { BOARD, boardBlocks, boardFront, boardPoint, boardStand, clampBoard, jackAt, layoutBoard, panelPoint } from '../public/js/board.js';
import { SYNTH, buttonAt, dialAt, keyAt, keyUnder, layoutSynth } from '../public/js/synthboard.js';
import { layoutRack } from '../public/js/rackboard.js';
import { KEYBOARD, drawbarAlong, drawbarAt, drawbarValue, framedKeys, hitKeys, layoutKeyboard, tabB } from '../public/js/keysboard.js';
import { DRAWBARS, KEYS_COUNT, KEYS_KNOBS, KEYS_LOWEST, KEYS_SECTIONS, KEYS_SOUNDS } from '../public/js/keys.js';
import { JACKS } from '../public/js/patch.js';
import { isBlack } from '../public/js/synth.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const S = layoutSynth(L, B);
const rack = layoutRack(L, S);
const K = layoutKeyboard(L, B, rack);
const KEY = SYNTH.key, D = KEYBOARD.drawbar;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: 0, step: 0, knob: 0, jack: 0, key: 0, dial: 0, button: 0, seq: 0, rack: 0, keys: 0 });
/** What a ray from o towards the point t meets on the keyboard, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitKeys(K, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** The middle of key k's top, where it can be seen: a white key's in front of the black keys. */
function keyTop(k, h = 0) {
  const q = K.keys[k];
  return q.black
    ? boardPoint(K, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2, KEY.rise + KEY.blackRise + h)
    : boardPoint(K, (q.a0 + q.a1) / 2, KEY.front + 0.02, KEY.rise + h);
}
/** Where one plays from on a screen, seen from: in front of its middle, a little back. */
const eye = [(K.x0 + K.x1) / 2, EYE, K.zFront + 0.6];

test('it stands left of the drum board against the far wall, as a desk does, room to walk round both', () => {
  assert.ok(near(K.x1, B.x0 - KEYBOARD.gap) && near(K.x1 - K.x0, K.width));
  assert.ok(K.x1 + BOARD.keep <= B.x0 - BOARD.keep + 1e-9, 'where one may not stand round it and round the board apart');
  assert.ok(K.x0 - BOARD.keep > L.x0 + MARGIN + 0.3, 'a way past it on the left');
  assert.ok(K.x0 > S.x1 || K.x1 < S.x0, 'apart from the synth');
  assert.ok(near(K.zBack, L.z1 + KEYBOARD.wall) && K.zFront > K.zBack && K.zFront < B.zFront, 'against the wall, less deep than the board');
  assert.deepEqual(boardPoint(K, 0, 0), K.origin);
  assert.deepEqual(boardPoint(K, 0, K.length).map((x) => x.toFixed(9)), K.panel.origin.map((x) => x.toFixed(9)));
  assert.ok(near(boardPoint(K, 0, K.length)[1], K.top) && K.top > K.front && K.front > 0.75 && K.top < 1.05, 'at the height of a table, a little lower at the front');
  const n = K.normal, u = K.up, N = K.panel.normal, U = K.panel.up;
  for (const [a, b] of [[n, u], [N, U]]) assert.ok(near(Math.hypot(...a), 1) && near(Math.hypot(...b), 1) && near(a[1] * b[1] + a[2] * b[2], 0));
  assert.ok(n[2] > 0 && n[1] > 0.95, 'nearly level, facing the player a little');
  assert.ok(N[2] > 0.9 && U[2] < 0, 'the panel upright, leaning back');
  assert.ok(near(panelPoint(K, 0, K.panel.height, -KEYBOARD.panel.thick)[2], K.zBack));
  assert.ok(near(panelPoint(K, 0, K.panel.height)[1], K.panel.top) && K.panel.top < K.sign.y0, 'under its sign');
  assert.ok(near(K.sign.x0, K.x0) && near(K.sign.x1, K.x1) && near(K.sign.y0, B.sign.y0) && near(K.sign.y1, B.sign.y1) && near(K.sign.z, B.sign.z));
});

test('sixty-one keys from C2, the black ones between the white as on a piano, as the synth\'s are', () => {
  assert.equal(K.keys.length, KEYS_COUNT);
  assert.deepEqual([K.whites.length, K.blacks.length], [36, 25]);
  for (const [k, q] of K.keys.entries()) {
    assert.equal(q.black, isBlack(KEYS_LOWEST + k), `${k}`);
    if (k) assert.ok((q.a0 + q.a1) / 2 > (K.keys[k - 1].a0 + K.keys[k - 1].a1) / 2, `${k} right of ${k - 1}`);
    assert.ok(near(q.a1 - q.a0, q.black ? KEY.black : KEY.white), `${k}: as wide as the synth's`);
    const b = q.black ? (q.b0 + q.b1) / 2 : KEY.front + 0.02;
    assert.equal(keyAt(K, (q.a0 + q.a1) / 2, b), k, `${k}`);
  }
  assert.ok(near(K.width, 2 * KEY.margin + 36 * KEY.white) && K.bed.b1 < K.deck.b0);
  assert.equal(K.keys[60 - KEYS_LOWEST].black, false, 'middle C');
  assert.deepEqual(K.keys.slice(0, 12), S.keys.slice(0, 12), 'its keys the synth\'s');
});

test('behind the keys, the drawbars and the knobs in a row, each name in front of it and its section\'s in front of those', () => {
  assert.deepEqual(K.drawbars.map((d) => d.id), DRAWBARS);
  assert.deepEqual(K.dials.map((d) => d.id), KEYS_KNOBS.filter((k) => k.section !== 'drawbars').map((k) => k.id));
  assert.deepEqual(K.sections.map((s) => s.id), KEYS_SECTIONS.map((s) => s.id));
  const R = SYNTH.dial, row = K.row;
  for (const [i, s] of K.sections.entries()) {
    assert.ok(s.a0 > 0 && s.a1 < K.width, `${s.id} on the top`);
    if (i) assert.ok(s.a0 > K.sections[i - 1].a1 + 0.05, `${K.sections[i - 1].id}, then ${s.id}, apart`);
  }
  const lanes = K.sections[0];
  for (const [i, d] of K.drawbars.entries()) {
    assert.ok(d.a - D.spacing / 2 >= lanes.a0 - 1e-9 && d.a + D.spacing / 2 <= lanes.a1 + 1e-9, `${d.id} with the drawbars`);
    assert.deepEqual([d.b0, d.b1], [row.b0, row.b1]);
    assert.ok(near(d.b1 - d.b0, D.slot) && D.tab < D.spacing - 0.01, `${d.id}: its slot, its tab clear of the next`);
    assert.equal(drawbarAt(K, d.a, (d.b0 + d.b1) / 2), i);
    assert.equal(drawbarAt(K, d.a + D.spacing * 0.45, d.b0), i, 'its whole lane');
    assert.equal(dialAt(K, d.a, (d.b0 + d.b1) / 2), -1);
  }
  for (const [i, d] of K.dials.entries()) {
    const s = K.sections.find((x) => x.id === d.section);
    assert.ok(d.a - R.spacing / 2 >= s.a0 - 1e-9 && d.a + R.spacing / 2 <= s.a1 + 1e-9, `${d.id} in its section`);
    assert.ok(near(d.b, row.b) && d.b - R.r > row.names.b1 && d.b + R.r < K.length, `${d.id} on the top, behind its name`);
    assert.equal(dialAt(K, d.a, d.b), i);
    assert.equal(drawbarAt(K, d.a, d.b), -1);
    for (const o of K.dials) if (o !== d) assert.ok(Math.abs(o.a - d.a) > 2 * R.r * 1.3, `${d.id} apart from ${o.id}`);
  }
  assert.ok(row.titles.b0 >= K.deck.b0 && row.titles.b1 <= row.names.b0 + 1e-9 && row.names.b1 < row.b0, 'the names in front, the sections\' in front of those');
  assert.ok(row.b1 < K.length, 'the slots on the top');
  assert.equal(drawbarAt(K, K.drawbars[0].a, K.bed.b1 + 0.005), -1, 'not over the keys');
});

test('a drawbar is pulled out towards the player: its tab from the back of its slot (0) to the front (8)', () => {
  const row = K.row;
  assert.ok(near(tabB(K, 0), row.b1 - D.grip / 2) && near(tabB(K, 1), row.b0 + D.grip / 2));
  for (let n = 0; n <= 8; n++) assert.ok(near(drawbarValue(K, tabB(K, n / 8)), n / 8), `${n}`);
  assert.equal(drawbarValue(K, row.b1 + 0.1), 0);
  assert.equal(drawbarValue(K, row.b0 - 0.1), 1);
  // Dragged: where the ray from the eye meets the tabs' tops.
  const bar = K.drawbars[4];
  for (const value of [0, 0.25, 0.5, 1]) {
    const p = boardPoint(K, bar.a, tabB(K, value), D.h), d = p.map((c, i) => c - eye[i]), n = Math.hypot(...d);
    assert.ok(near(drawbarAlong(K, ...eye, ...d.map((c) => c / n)), value, 1e-9), `${value}`);
    const h = ray(eye, p);
    assert.deepEqual([h?.kind, h?.keys], ['drawbar', 4]);
    assert.ok(Math.abs(h.v - value) < 0.08, `pointed at ${value}: ${h.v}`);
  }
  assert.ok(Number.isNaN(drawbarAlong(K, ...eye, 0, 1, 0)), 'up, away from it');
});

test('on the panel: the display, then the sounds, the percussion, the rotary speaker, SUSTAIN and the octave, each group\'s name over it', () => {
  const P = K.panel, ids = P.buttons.map((b) => b.id);
  assert.deepEqual(ids, [...KEYS_SOUNDS.map((s) => `sound.${s.id}`), 'switch.perc', 'switch.third', 'switch.fast', 'switch.rotaryFast', 'sustain', 'octave.down', 'octave.up']);
  for (const [i, b] of P.buttons.entries()) {
    assert.ok(b.a0 > P.display.a1 + 0.02 && b.a1 < K.width && b.b0 > 0 && b.b1 < P.height - 0.03, `${b.id} on the panel, right of the display`);
    assert.ok(b.a1 - b.a0 >= 0.04 && b.b1 - b.b0 >= 0.04, `${b.id} large enough to point at`);
    assert.equal(buttonAt(K, (b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2), i);
    for (const o of P.buttons) if (o !== b) assert.ok(o.a0 >= b.a1 + 0.005 || o.a1 <= b.a0 - 0.005, `${b.id} apart from ${o.id}`);
  }
  assert.deepEqual(P.titles.map((t) => t.text), ['SOUND', 'PERCUSSION', 'ROTARY', 'OCTAVE', 'PATCH']);
  const group = { SOUND: 'sound.', PERCUSSION: 'switch.', ROTARY: 'switch.rotaryFast', OCTAVE: 'octave.' };
  for (const t of P.titles.filter((x) => x.text in group)) {
    const under = P.buttons.filter((b) => b.id.startsWith(group[t.text]) && (t.text !== 'PERCUSSION' || b.id !== 'switch.rotaryFast'));
    assert.ok(under.length && near(t.a, (under[0].a0 + under[under.length - 1].a1) / 2), `${t.text} over its buttons`);
    assert.ok(t.b > Math.max(...under.map((b) => b.b1)) + 0.01 && t.b < P.height - 0.012, `${t.text} over them, on the panel`);
  }
  assert.equal(buttonAt(K, (P.display.a0 + P.display.a1) / 2, (P.display.b0 + P.display.b1) / 2), -1);
  assert.ok(P.display.a1 - P.display.a0 > 0.25 && P.display.b1 < P.height);
});

test('its jacks over the buttons at the right end, nearest the board: its sound and its notes out on a plate, the rotary speaker\'s speed in, PATCH over them', () => {
  const P = K.panel, J = BOARD.panel.jack;
  assert.deepEqual(P.jacks.map((j) => j.id), JACKS.filter((j) => j.module === 'keys').map((j) => j.id), "patch.js's, in its order");
  assert.deepEqual(P.jacks.map((j) => j.out), [true, true, false]);
  assert.equal(P.jackBase, rack.panel.jackBase + rack.panel.jacks.length, "in the room's list after the rack's");
  const [out, notes, rotary] = P.jacks, buttons = Math.max(...P.buttons.map((b) => b.b1));
  assert.ok(out.a > notes.a && notes.a > rotary.a, 'its sound out at the end, nearest the board');
  assert.ok(out.a + 0.026 <= K.width - 0.02, 'the plate on the panel');
  for (const [k, j] of P.jacks.entries()) {
    assert.ok(near(j.b, KEYBOARD.panel.row) && j.b - J - 0.02 > buttons + 0.02 && j.b + 0.024 < P.height - 0.03, `${j.id}: over the buttons and their names, under PATCH`);
    assert.equal(jackAt(K, j.a, j.b), k);
    for (const o of P.jacks) if (o !== j) assert.ok(Math.abs(o.a - j.a) >= KEYBOARD.panel.pitch - 1e-9, `${j.id} apart from ${o.id}`);
  }
  assert.ok(rotary.a - J > P.buttons.find((b) => b.id === 'sustain').a1, 'at the right end, past SUSTAIN');
  const patch = P.titles.find((t) => t.text === 'PATCH');
  assert.ok(patch.a0 < rotary.a - J && patch.a1 > out.a + J && patch.a1 < K.width && near(patch.a, (patch.a0 + patch.a1) / 2), 'PATCH over all three');
  assert.ok(patch.b > out.b + 0.024 && patch.b < P.height);
  for (const b of P.buttons) assert.equal(jackAt(K, (b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2), -1, b.id);
  // Pointed at: a jack, the room's index for it.
  for (const [k, j] of P.jacks.entries()) {
    const h = ray(eye, panelPoint(K, j.a, j.b));
    assert.deepEqual([h?.kind, h?.jack, h?.keys, h?.button], ['jack', P.jackBase + k, -1, -1], j.id);
  }
  assert.deepEqual([ray(eye, panelPoint(K, notes.a, notes.b + 0.03))?.kind, ray(eye, panelPoint(K, notes.a, notes.b + 0.03))?.jack], ['keys', -1], 'beside one: the panel');
});

test('a ray meets the key it points at (a black one over the white), a drawbar, a knob, a button, and the rest as the keyboard', () => {
  for (const k of K.keys.keys()) {
    const h = ray(eye, keyTop(k));
    assert.deepEqual([h?.kind, h?.keys, h?.key, h?.dial, h?.button, h?.pad, h?.jack, h?.seq], ['note', k, -1, -1, -1, -1, -1, -1], `${k}`);
    assert.ok(h.u > 0.2 && h.u < 0.8 && h.v >= 0 && h.v <= 1, `${k}: ${h.u} ${h.v}`);
    assert.equal(h.walkable, false);
  }
  const cs = K.keys[1], side = boardPoint(K, (cs.a0 + cs.a1) / 2, cs.b0 + 0.001, KEY.rise + 0.004);
  assert.equal(ray([side[0], side[1] + 0.05, side[2] + 0.4], side)?.keys, 1, 'a black key\'s side, under its top');
  for (const [i, d] of K.dials.entries()) {
    const h = ray(eye, boardPoint(K, d.a, d.b, KEY.rise));
    assert.deepEqual([h?.kind, h?.keys], ['keysknob', i], d.id);
  }
  for (const [i, b] of K.panel.buttons.entries()) {
    const h = ray(eye, panelPoint(K, (b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2));
    assert.deepEqual([h?.kind, h?.keys, h?.button, h?.jack], ['keysbutton', i, -1, -1], b.id);
    assert.ok(near(h.nz, K.panel.normal[2]));
  }
  const P = K.panel.display;
  assert.deepEqual([ray(eye, panelPoint(K, (P.a0 + P.a1) / 2, (P.b0 + P.b1) / 2))?.kind, ray(eye, panelPoint(K, (P.a0 + P.a1) / 2, (P.b0 + P.b1) / 2))?.keys], ['keys', -1], 'the display');
  assert.equal(ray(eye, boardPoint(K, K.width / 2, 0.008, KEY.rise))?.kind, 'keys', 'in front of the keys');
  assert.equal(ray(eye, boardPoint(K, K.sections[1].a1 + 0.02, K.row.b, KEY.rise))?.kind, 'keys', 'between sections');
  const front = ray([K.x0 + 0.3, 0.5, K.zFront + 1], [K.x0 + 0.3, 0.5, K.zFront]);
  assert.deepEqual([front?.kind, front?.nz], ['keys', 1]);
  const left = ray([K.x0 - 1, 0.5, (K.zBack + K.zFront) / 2], [K.x0, 0.5, (K.zBack + K.zFront) / 2]);
  assert.deepEqual([left?.kind, left?.nx], ['keys', -1]);
  const sign = ray([(K.x0 + K.x1) / 2, EYE, -1], [(K.x0 + K.x1) / 2, EYE, L.z1]);
  assert.deepEqual([sign?.kind, sign?.nz], ['keys', 1]);
  assert.equal(ray(eye, [(K.x0 + K.x1) / 2, 2.5, K.zBack]), null, 'over it');
  assert.equal(ray(eye, keyTop(24), 0.1), null, 'the room nearer');
  assert.equal(ray([0, EYE, -1], [0, EYE, L.z1]), null, 'the board\'s sign, not its');
});

test('one walks round it as round the board; on a screen all of it in view, on a narrow one the keys round middle C', () => {
  const Z = K.zFront + BOARD.keep, X0 = K.x0 - BOARD.keep;
  assert.deepEqual(clampBoard(K, K.x0 + 0.3, Z + 0.3, K.x0 + 0.4, Z - 0.1), { x: K.x0 + 0.4, z: Z });
  assert.deepEqual(clampBoard(K, X0 - 0.2, K.zBack + 0.2, X0 + 0.05, K.zBack + 0.1), { x: X0, z: K.zBack + 0.1 });
  assert.ok(boardBlocks(K, (K.x0 + K.x1) / 2, K.zFront + 0.1) && !boardBlocks(K, (K.x0 + K.x1) / 2, Z + 0.01));
  const fovFor = (aspect) => Math.min(100, Math.max(70, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI));
  const free = (x, z) => !boardBlocks(B, x, z) && !boardBlocks(S, x, z);
  const desk = boardFront(K, { fov: fovFor(16 / 9), aspect: 16 / 9, h: D.h, free });
  assert.ok(!boardBlocks(K, desk.x, desk.z) && !boardBlocks(B, desk.x, desk.z), `where one may stand, ${desk.x}, ${desk.z}`);
  assert.ok(desk.pitch < -0.2 && desk.yaw === 0 && near(desk.x, (K.x0 + K.x1) / 2), 'in front of its middle, looking down at it');
  // On a phone held upright, from C3 to C5: nearer, and so the keys larger, than for all of it.
  const aspect = 9 / 19.5, fov = fovFor(aspect);
  const all = boardFront(K, { fov, aspect, h: D.h, free }), part = boardFront(framedKeys(K, 48, 72), { fov, aspect, h: D.h, free });
  const c3 = K.keys[48 - KEYS_LOWEST], c5 = K.keys[72 - KEYS_LOWEST];
  assert.ok(near(part.x, K.x0 + (c3.a0 + c5.a1) / 2), 'in front of the keys round middle C');
  assert.ok(part.z < all.z - 0.5 && !boardBlocks(K, part.x, part.z), `nearer: ${part.z} for ${all.z}`);
  const framed = framedKeys(K, 48, 72);
  assert.ok(near(framed.width, c5.a1 - c3.a0) && near(boardPoint(framed, 0, 0)[0], K.x0 + c3.a0) && near(panelPoint(framed, 0, 0)[0], K.x0 + c3.a0));
});

test('in VR one stands at arm\'s length from the keys, the three octaves round middle C in reach; a tip down in a key is in it', () => {
  const s = boardStand(K, 0.3);
  assert.ok(!boardBlocks(K, s.x, s.z) && !boardBlocks(B, s.x, s.z) && near(s.x, (K.x0 + K.x1) / 2));
  const shoulder = [s.x, EYE - 0.25, s.z];
  for (const k of [12, 24, 36, 48]) assert.ok(Math.hypot(...keyTop(k).map((c, i) => c - shoulder[i])) < 0.75, `key ${k} in reach of a hand`);
  const out = { key: 0, over: 0, h: 0, top: 0 };
  const at = (k, h) => {
    const q = K.keys[k];
    return boardPoint(K, (q.a0 + q.a1) / 2, q.black ? (q.b0 + q.b1) / 2 : KEY.front + 0.02, h);
  };
  assert.equal(keyUnder(K, ...at(24, KEY.rise - 0.002), out).key, 24);
  assert.deepEqual([keyUnder(K, ...at(24, KEY.rise + 0.01), out).key, out.over], [-1, 24]);
  assert.deepEqual([keyUnder(K, ...at(25, KEY.rise + KEY.blackRise - 0.003), out).key, out.top], [25, KEY.rise + KEY.blackRise]);
});
