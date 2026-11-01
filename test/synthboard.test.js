// The synth (synthboard.js): where it stands beside the drum board and what is on it (its keys, its
// dials in two rows with their names and their sections', and the panel's display, buttons, patch
// bay and arpeggiator), what a ray meets on it (a black key over the white ones, a jack), one walking
// round it and playing it (all of it in view on a screen; the keys in reach in VR), and a tip down in
// a key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import { BOARD, boardBlocks, boardFront, boardPoint, boardStand, clampBoard, jackAt, layoutBoard, panelPoint } from '../public/js/board.js';
import { SYNTH, blackKeyAt, buttonAt, dialAt, hitSynth, keyAt, keyUnder, keyVelocity, layoutSynth } from '../public/js/synthboard.js';
import { KEYS, LOWEST, PRESETS, SECTIONS, SYNTH_KNOBS, isBlack } from '../public/js/synth.js';
import { ARP_MODES } from '../public/js/arp.js';
import { JACKS } from '../public/js/patch.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const S = layoutSynth(L, B);
const K = SYNTH.key;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: 0, step: 0, knob: 0, jack: 0, key: -1, dial: -1, button: -1 });
/** What a ray from o towards the point t meets on the synth, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitSynth(S, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** The middle of key k's top, where it can be seen: a white key's in front of the black keys. */
function keyTop(k, h = 0) {
  const q = S.keys[k];
  return q.black
    ? boardPoint(S, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2, K.rise + K.blackRise + h)
    : boardPoint(S, (q.a0 + q.a1) / 2, K.front + 0.02, K.rise + h);
}
/** Where one plays from on a screen, seen from: in front of its middle, a little back. */
const eye = [(S.x0 + S.x1) / 2, EYE, S.zFront + 0.6];

test('it stands right of the drum board against the far wall, as a desk does, room to walk round both', () => {
  assert.ok(near(S.x0, B.x1 + SYNTH.gap) && near(S.x1 - S.x0, S.width));
  assert.ok(S.x0 - BOARD.keep >= B.x1 + BOARD.keep - 1e-9, 'where one may not stand round it and round the board apart');
  assert.ok(S.x1 + BOARD.keep < L.x1 - MARGIN - 0.3, 'a way past it on the right');
  assert.ok(near(S.zBack, L.z1 + SYNTH.wall) && S.zFront > S.zBack && S.zFront < B.zFront, 'against the wall, less deep than the board');
  // Its top, from its front edge, leaning back and up to the panel's foot; the panel leaning back.
  assert.deepEqual(boardPoint(S, 0, 0), S.origin);
  assert.deepEqual(boardPoint(S, 0, S.length).map((x) => x.toFixed(9)), S.panel.origin.map((x) => x.toFixed(9)));
  assert.ok(near(boardPoint(S, 0, S.length)[1], S.top) && S.top > S.front && S.front > 0.75 && S.top < 1.05, 'at the height of a table, a little lower at the front');
  const n = S.normal, u = S.up, N = S.panel.normal, U = S.panel.up;
  for (const [a, b] of [[n, u], [N, U]]) assert.ok(near(Math.hypot(...a), 1) && near(Math.hypot(...b), 1) && near(a[1] * b[1] + a[2] * b[2], 0));
  assert.ok(n[2] > 0 && n[1] > 0.95, 'nearly level, facing the player a little');
  assert.ok(N[2] > 0.9 && U[2] < 0, 'the panel upright, leaning back');
  assert.ok(near(panelPoint(S, 0, S.panel.height, -SYNTH.panel.thick)[2], S.zBack));
  assert.ok(near(panelPoint(S, 0, S.panel.height)[1], S.panel.top) && S.panel.top < S.sign.y0, 'under its sign');
  // Its sign as wide as it, beside the board's, as high.
  assert.ok(near(S.sign.x0, S.x0) && near(S.sign.x1, S.x1) && near(S.sign.y0, B.sign.y0) && near(S.sign.y1, B.sign.y1) && near(S.sign.z, B.sign.z));
});

test('thirty-seven keys from a C, the black ones between the white as on a piano, wide enough for a finger', () => {
  assert.equal(S.keys.length, KEYS);
  assert.deepEqual([S.whites.length, S.blacks.length], [22, 15]);
  assert.ok(isBlack(LOWEST + S.blacks[0]) && !isBlack(LOWEST));
  for (const [k, q] of S.keys.entries()) {
    assert.equal(q.black, isBlack(LOWEST + k), `${k}`);
    if (k) assert.ok((q.a0 + q.a1) / 2 > (S.keys[k - 1].a0 + S.keys[k - 1].a1) / 2, `${k} right of ${k - 1}`);
    if (q.black) {
      // Over the line between the white keys either side of it, at the back of the keys.
      const left = S.keys[k - 1], right = S.keys[k + 1];
      assert.ok(!left.black && !right.black && q.a0 < left.a1 && q.a1 > right.a0, `${k} between ${k - 1} and ${k + 1}`);
      assert.ok(near(q.b1, S.bed.b1) && near(q.b1 - q.b0, K.blackLength) && near(q.a1 - q.a0, K.black));
    } else assert.ok(near(q.b0, S.bed.b0) && near(q.b1, S.bed.b1) && near(q.a1 - q.a0, K.white));
    assert.ok(q.a0 >= S.bed.a0 - 1e-9 && q.a1 <= S.bed.a1 + 1e-9);
  }
  assert.ok(K.white - K.gap > 0.035 && K.black > 0.02, 'wide enough to come down on');
  assert.ok(near(S.width, 2 * K.margin + 22 * K.white) && S.bed.b0 > 0 && S.bed.b1 < S.deck.b0);
  // The key at a place: a black key's first, else the white key there, the gaps included.
  for (const k of S.keys.keys()) {
    const p = keyTop(k);
    const q = S.keys[k], b = q.black ? (q.b0 + q.b1) / 2 : K.front + 0.02;
    assert.equal(keyAt(S, (q.a0 + q.a1) / 2, b), k, `${k}`);
    assert.ok(p[1] > S.front);
  }
  const c = S.keys[0], cs = S.keys[1];
  assert.equal(keyAt(S, cs.a0 + 0.002, cs.b1 - 0.01), 1, 'the black key over the white');
  assert.equal(keyAt(S, cs.a0 + 0.002, cs.b0 - 0.01), 0, 'in front of it, the white key');
  assert.equal(blackKeyAt(S, cs.a0 + 0.002, cs.b0 - 0.01), -1);
  assert.equal(keyAt(S, c.a1 - 0.0005, K.front + 0.01), 0, 'in the gap, the key beside it');
  assert.equal(keyAt(S, S.bed.a1, K.front + 0.01), KEYS - 1, 'the top C at its right edge');
  for (const [a, b] of [[S.bed.a0 - 0.001, K.front + 0.05], [S.bed.a1 + 0.001, K.front + 0.05], [0.3, K.front - 0.005], [0.3, S.bed.b1 + 0.005]]) assert.equal(keyAt(S, a, b), -1, `${a}, ${b}`);
});

test('behind the keys, a dial for every knob in two rows, its name under it and its section\'s under those', () => {
  assert.deepEqual(S.dials.map((d) => d.id), SYNTH_KNOBS.map((k) => k.id), 'in the knobs\' order');
  assert.deepEqual(S.sections.map((s) => s.id).sort(), SECTIONS.map((s) => s.id).sort());
  const R = SYNTH.dial;
  for (const [d, dial] of S.dials.entries()) {
    const spec = SYNTH_KNOBS[d], s = S.sections.find((x) => x.id === spec.section), row = S.rows[s.row];
    assert.deepEqual([dial.section, dial.label, dial.b], [spec.section, spec.label, row.b], spec.id);
    assert.ok(dial.a - R.spacing / 2 >= s.a0 - 1e-9 && dial.a + R.spacing / 2 <= s.a1 + 1e-9, `${spec.id} in its section`);
    assert.ok(dial.a - R.r > 0 && dial.a + R.r < S.width && dial.b - R.r > S.bed.b1 && dial.b + R.r < S.length, `${spec.id} on the top, behind the keys`);
    assert.equal(dialAt(S, dial.a, dial.b), d);
    assert.equal(dialAt(S, dial.a + R.r * 1.2, dial.b), d, 'a little larger to point at');
    for (const [e, other] of S.dials.entries()) if (e !== d) assert.ok(Math.hypot(other.a - dial.a, other.b - dial.b) > 2 * R.r * 1.3, `${spec.id} apart from ${other.id}`);
  }
  // The oscillator, the LFO and the filter at the back; the envelopes and the output in front; each
  // row's sections left to right, apart.
  const byRow = (r) => S.sections.filter((s) => s.row === r).map((s) => s.id);
  assert.deepEqual([byRow(0), byRow(1)], [['fenv', 'aenv', 'out'], ['osc', 'lfo', 'filter']]);
  assert.ok(S.rows[1].b > S.rows[0].b);
  for (const [i, s] of S.sections.entries()) {
    const next = S.sections[i + 1];
    if (next?.row === s.row) assert.ok(next.a0 > s.a1 + 0.01, `${s.id}, then ${next.id}`);
  }
  // Under each row's dials its names, and under those its sections': in front of them, where a dial
  // stands up in front of nothing it would hide.
  for (const row of S.rows) {
    assert.ok(row.titles.b1 <= row.names.b0 + 1e-9 && row.names.b1 < row.b - R.r, 'the names under the dials, the sections\' under those');
    assert.ok(row.titles.b0 >= S.deck.b0);
  }
  assert.ok(S.rows[1].titles.b0 > S.rows[0].b + R.r, 'the back row\'s names behind the front row\'s dials');
  assert.equal(dialAt(S, S.dials[0].a, S.bed.b1 - 0.01), -1);
});

test('on the panel: the display, the presets in two rows (the poly sounds over the mono), Mono and the octave; over them the patch bay and the arpeggiator; apart', () => {
  const P = S.panel, ids = P.buttons.map((b) => b.id);
  assert.deepEqual(ids, [...PRESETS.map((p) => `preset.${p.id}`), 'mono', 'octave.down', 'octave.up', ...ARP_MODES.map((m) => `arp.${m.id}`), 'arp.hold', 'arp.range']);
  for (const [i, b] of P.buttons.entries()) {
    assert.ok(b.a0 > 0 && b.a1 < S.width && b.b0 > 0 && b.b1 < P.height - 0.03, `${b.id} on the panel`);
    assert.ok(b.a1 - b.a0 >= 0.04 && b.b1 - b.b0 >= 0.04, `${b.id} large enough to point at`);
    assert.ok(b.a0 > P.display.a1 + 0.02, `${b.id} right of the display`);
    assert.equal(buttonAt(S, (b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2), i);
    for (const o of P.buttons) if (o !== b) assert.ok(o.a0 >= b.a1 + 0.005 || o.a1 <= b.a0 - 0.005 || o.b0 >= b.b1 + 0.005 || o.b1 <= b.b0 - 0.005, `${b.id} apart from ${o.id}`);
  }
  // The patch bay: every synth jack in patch.js, once, in its order, after the board's in the room's
  // list; its outs together on a plate at the left, nearest the board; each clear of the rest.
  const ring = BOARD.panel.jack * 1.8;
  assert.deepEqual(P.jacks.map((j) => j.id), JACKS.filter((j) => j.module === 'synth').map((j) => j.id));
  assert.equal(P.jackBase, B.panel.jacks.length);
  for (const [n, j] of P.jacks.entries()) {
    assert.equal(j.out, JACKS.find((J) => J.id === j.id).dir === 'out', j.id);
    assert.ok(j.a - 0.026 > 0 && j.b - 0.036 > 0 && j.b + 0.024 < P.height, `${j.id} on the panel, its plate too`);
    assert.equal(jackAt(S, j.a, j.b), n);
    for (const o of P.jacks) if (o !== j) assert.ok(Math.hypot(o.a - j.a, o.b - j.b) >= BOARD.panel.pitch - 1e-9, `${j.id} apart from ${o.id}`);
    for (const b of P.buttons) assert.ok(j.a + ring < b.a0 || j.a - ring > b.a1 || j.b - 0.036 > b.b1 || j.b + ring < b.b0, `${j.id} clear of ${b.id}`);
    assert.ok(j.b - 0.036 > P.display.b1 + 0.01, `${j.id} over the display`);
  }
  const outs = P.jacks.filter((j) => j.out), ins = P.jacks.filter((j) => !j.out);
  assert.ok(Math.max(...outs.map((j) => j.a)) < Math.min(...ins.map((j) => j.a)), 'the outs together, at the left');
  // What is written over them: the patch bay's name over its jacks, the arpeggiator's over its clock
  // in and its buttons, each under the panel's top edge; the presets', Mono's and the octave's over
  // theirs, under the patch bay and the arpeggiator.
  const bay = P.titles.find((t) => t.text === 'PATCH'), arp = P.titles.find((t) => t.text === 'ARPEGGIATOR');
  const upper = P.buttons.filter((b) => b.id.startsWith('arp.')), lower = P.buttons.filter((b) => !b.id.startsWith('arp.'));
  const clock = P.jacks.find((j) => j.id === 'synth.clock');
  for (const j of P.jacks) if (j !== clock) assert.ok(j.a - 0.026 >= bay.a0 - 1e-9 && j.a + 0.026 <= bay.a1 + 1e-9, `${j.id} in the patch bay`);
  assert.ok(clock.a - ring > arp.a0 && clock.a + ring < upper[0].a0, "the arpeggiator's clock in, before its buttons");
  for (const b of upper) assert.ok(b.a0 > arp.a0 && b.a1 <= arp.a1 + 1e-9, `${b.id} under ARPEGGIATOR`);
  assert.ok(bay.a1 < arp.a0, 'the patch bay, then the arpeggiator');
  const band = Math.min(...upper.map((b) => b.b0), ...P.jacks.map((j) => j.b - BOARD.panel.jack - 0.016));
  for (const t of P.titles) {
    if (t.a0 !== undefined) assert.ok(t.b > Math.max(...upper.map((b) => b.b1), ...P.jacks.map((j) => j.b + ring)) + 0.008 && t.b < P.height - 0.012, t.text);
    else assert.ok(t.b > Math.max(...lower.map((b) => b.b1)) + 0.01 && t.b < band - 0.01, t.text);
  }
  for (const p of PRESETS) {
    const b = P.buttons[ids.indexOf(`preset.${p.id}`)];
    for (const q of PRESETS) {
      const c = P.buttons[ids.indexOf(`preset.${q.id}`)];
      if (p.mono !== q.mono) assert.ok(p.mono ? c.b0 > b.b1 : b.b0 > c.b1, `${p.id} and ${q.id}`);
    }
  }
  assert.equal(buttonAt(S, (P.display.a0 + P.display.a1) / 2, (P.display.b0 + P.display.b1) / 2), -1);
  assert.ok(P.display.a1 - P.display.a0 > 0.25 && P.display.b1 < P.height);
});

test('a ray meets the key it points at (a black one over the white), a dial, a button, and the rest as the synth', () => {
  for (const k of S.keys.keys()) {
    const h = ray(eye, keyTop(k));
    assert.deepEqual([h?.kind, h?.key, h?.dial, h?.button, h?.pad, h?.knob], ['key', k, -1, -1, -1, -1], `${k}`);
    assert.ok(h.u > 0.2 && h.u < 0.8 && h.v >= 0 && h.v <= 1, `${k}: ${h.u} ${h.v}`);
    assert.equal(h.walkable, false);
  }
  // A black key's side, seen from low in front, under its top: that key, not the white one.
  const cs = S.keys[1], side = boardPoint(S, (cs.a0 + cs.a1) / 2, cs.b0 + 0.001, K.rise + 0.004);
  assert.equal(ray([side[0], side[1] + 0.05, side[2] + 0.4], side)?.key, 1);
  for (const [d, dial] of S.dials.entries()) {
    const h = ray(eye, boardPoint(S, dial.a, dial.b, K.rise));
    assert.deepEqual([h?.kind, h?.dial, h?.key], ['dial', d, -1], dial.id);
  }
  for (const [i, b] of S.panel.buttons.entries()) {
    const h = ray(eye, panelPoint(S, (b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2));
    assert.deepEqual([h?.kind, h?.button, h?.key, h?.dial, h?.jack], ['button', i, -1, -1, -1], b.id);
    assert.ok(near(h.nz, S.panel.normal[2]));
  }
  // A jack: its index in the room's list of them, after the board's.
  for (const [j, jack] of S.panel.jacks.entries()) {
    const h = ray(eye, panelPoint(S, jack.a + 0.01, jack.b));
    assert.deepEqual([h?.kind, h?.jack, h?.button, h?.key, h?.pad, h?.knob], ['jack', S.panel.jackBase + j, -1, -1, -1, -1], jack.id);
  }
  const D = S.panel.display;
  assert.equal(ray(eye, panelPoint(S, (D.a0 + D.a1) / 2, (D.b0 + D.b1) / 2))?.kind, 'synth', 'the display');
  assert.equal(ray(eye, boardPoint(S, S.width / 2, 0.008, K.rise))?.kind, 'synth', 'in front of the keys');
  assert.equal(ray(eye, boardPoint(S, S.sections[0].a1 + 0.01, S.rows[0].b, K.rise))?.kind, 'synth', 'between sections');
  // Its front and its sides; its sign; nothing over it, nor where the room has something nearer.
  const front = ray([S.x0 + 0.3, 0.5, S.zFront + 1], [S.x0 + 0.3, 0.5, S.zFront]);
  assert.deepEqual([front?.kind, front?.nz], ['synth', 1]);
  const right = ray([S.x1 + 1, 0.5, (S.zBack + S.zFront) / 2], [S.x1, 0.5, (S.zBack + S.zFront) / 2]);
  assert.deepEqual([right?.kind, right?.nx], ['synth', 1]);
  const sign = ray([(S.x0 + S.x1) / 2, EYE, -1], [(S.x0 + S.x1) / 2, EYE, L.z1]);
  assert.deepEqual([sign?.kind, sign?.nz], ['synth', 1]);
  assert.ok(near(sign.z, S.sign.z));
  assert.equal(ray(eye, [(S.x0 + S.x1) / 2, 2.5, S.zBack]), null, 'over it');
  assert.equal(ray(eye, keyTop(12), 0.1), null, 'the room nearer');
  assert.equal(ray([0, EYE, -1], [0, EYE, L.z1]), null, 'the board\'s sign, not its');
});

test('one walks round it as round the board; on a screen all of it is in view from where one plays it, clear of the board', () => {
  const Z = S.zFront + BOARD.keep, X1 = S.x1 + BOARD.keep;
  assert.deepEqual(clampBoard(S, S.x0 + 0.3, Z + 0.3, S.x0 + 0.4, Z - 0.1), { x: S.x0 + 0.4, z: Z });
  assert.deepEqual(clampBoard(S, X1 + 0.2, S.zBack + 0.2, X1 - 0.05, S.zBack + 0.1), { x: X1, z: S.zBack + 0.1 });
  assert.ok(boardBlocks(S, (S.x0 + S.x1) / 2, S.zFront + 0.1) && !boardBlocks(S, (S.x0 + S.x1) / 2, Z + 0.01));
  const fovFor = (aspect) => Math.min(100, Math.max(70, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI));
  for (const [name, aspect] of [['desktop', 16 / 9], ['phone', 9 / 19.5]]) {
    const fov = fovFor(aspect), free = (x, z) => !boardBlocks(B, x, z);
    const f = boardFront(S, { fov, aspect, h: SYNTH.dial.h, free });
    assert.ok(!boardBlocks(S, f.x, f.z) && !boardBlocks(B, f.x, f.z), `${name}: where one may stand, ${f.x}, ${f.z}`);
    assert.ok(f.pitch < -0.2 && f.yaw === 0 && f.z < -MARGIN, `${name}: looking down at it`);
    assert.ok(near(f.x, (S.x0 + S.x1) / 2), `${name}: in front of its middle`);
  }
  // A place the board takes is no place to play from.
  const blocked = boardFront(S, { fov: 70, aspect: 16 / 9, h: SYNTH.dial.h, free: (x) => x > S.x1 });
  assert.ok(blocked.z >= S.zFront + 3 - 1e-9, 'nowhere fits: as far back as it goes');
});

test('in VR one stands at arm\'s length from the keys; a tip down in a key is in it, a black one over the white', () => {
  const s = boardStand(S, 0.3);
  assert.ok(!boardBlocks(S, s.x, s.z) && !boardBlocks(B, s.x, s.z) && near(s.x, (S.x0 + S.x1) / 2));
  const shoulder = [s.x, EYE - 0.25, s.z];
  for (const k of [0, 12, KEYS - 1]) assert.ok(Math.hypot(...keyTop(k).map((c, i) => c - shoulder[i])) < 0.7, `key ${k} in reach of a hand`);
  const out = { key: 0, over: 0, h: 0, top: 0 };
  // Over a white key: not in it, but over it; just under its top: in it; through the top: not.
  const c = S.keys[0], at = (k, h, b) => {
    const q = S.keys[k];
    return boardPoint(S, (q.a0 + q.a1) / 2, b ?? (q.black ? (q.b0 + q.b1) / 2 : K.front + 0.02), h);
  };
  assert.deepEqual(keyUnder(S, ...at(0, K.rise + 0.01), out), { key: -1, over: 0, h: out.h, top: K.rise });
  assert.ok(near(out.h, K.rise + 0.01, 1e-9));
  assert.equal(keyUnder(S, ...at(0, K.rise - 0.002), out).key, 0);
  assert.deepEqual([keyUnder(S, ...at(0, -0.002), out).key, out.over], [-1, 0], 'through the top');
  assert.deepEqual([keyUnder(S, ...boardPoint(S, c.a0 - 0.01, K.front + 0.02, 0.005), out).key, out.over], [-1, -1], 'beside the keys');
  // A black key: in it under its top, even over the white keys' tops; the white key in front of it.
  assert.deepEqual([keyUnder(S, ...at(1, K.rise + K.blackRise - 0.003), out).key, out.top], [1, K.rise + K.blackRise]);
  assert.equal(keyUnder(S, ...at(1, K.rise + K.blackRise + 0.003), out).key, -1);
  assert.equal(keyUnder(S, ...at(0, K.rise - 0.003, S.keys[1].b0 - 0.005), out).key, 0);
  // How hard: the softest still heard, a finger counting for more than a stick.
  assert.equal(keyVelocity(0), 0.12);
  assert.equal(keyVelocity(5), 1);
  assert.ok(keyVelocity(0.3, true) > keyVelocity(0.3));
  for (let v = 0.2; v < 1; v += 0.1) assert.ok(keyVelocity(v) > keyVelocity(v - 0.1), `${v}`);
});
