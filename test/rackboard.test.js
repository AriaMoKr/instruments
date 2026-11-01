// The rack (rackboard.js): where it stands beside the synth and what is on it (on its top the
// sequencer's sixteen steps, in fours: a key each, an accent's and a slide's, its note's knob; on its
// panel the clock's module, the sequencer's, the delay's and the LFO's, with their displays, buttons,
// knobs and jacks), what a ray meets on it, one walking round it and playing it (all of it in view on
// a screen; its keys in reach in VR), and a tip coming down on a key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import { BOARD, boardBlocks, boardFront, boardPoint, boardStand, clampBoard, jackAt, layoutBoard, panelPoint } from '../public/js/board.js';
import { layoutSynth } from '../public/js/synthboard.js';
import { RACK, SEQ_ROWS, hitRack, knobRadius, layoutRack, rackButtonAt, rackKeyAt, rackKnobAt, rackStrike } from '../public/js/rackboard.js';
import { STEPS } from '../public/js/pattern.js';
import { JACKS } from '../public/js/patch.js';
import { RACK_CLOCK_OUTS } from '../public/js/clock.js';
import { DELAY_KNOBS } from '../public/js/delay.js';
import { LFO_KNOBS } from '../public/js/lfo.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const S = layoutSynth(L, B);
const R = layoutRack(L, S);
const K = RACK.key;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: 0, step: 0, knob: 0, jack: 0, key: 0, dial: 0, button: 0, seq: 0, rack: 0 });
/** What a ray from o towards the point t meets on the rack, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitRack(R, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** The middle of key k's cap. */
const keyTop = (k, h = 0) => boardPoint(R, (R.keys[k].a0 + R.keys[k].a1) / 2, (R.keys[k].b0 + R.keys[k].b1) / 2, K.rise + h);
/** Where one plays from on a screen, seen from: in front of its middle, a little back. */
const eye = [(R.x0 + R.x1) / 2, EYE, R.zFront + 0.6];
/** The middle of an area. */
const mid = (q) => [(q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2];

test('it stands right of the synth against the far wall, as deep, its front in line with the synth\'s, room to walk past it', () => {
  assert.ok(near(R.x0, S.x1 + RACK.gap) && near(R.x1 - R.x0, R.width));
  assert.ok(R.x1 + BOARD.keep < L.x1 - MARGIN, 'a way past it on the right');
  assert.ok(near(R.zBack, L.z1 + RACK.wall) && near(R.length, S.length) && near(R.zFront, S.zFront, 1e-9), 'as deep as the synth');
  // Its top, from its front edge, leaning back and up to the panel's foot; the panel leaning back.
  assert.deepEqual(boardPoint(R, 0, 0), R.origin);
  assert.deepEqual(boardPoint(R, 0, R.length).map((x) => x.toFixed(9)), R.panel.origin.map((x) => x.toFixed(9)));
  assert.ok(near(boardPoint(R, 0, R.length)[1], R.top) && R.top > R.front && near(R.top, S.top), 'as high as the synth');
  for (const [a, b] of [[R.normal, R.up], [R.panel.normal, R.panel.up]]) assert.ok(near(Math.hypot(...a), 1) && near(Math.hypot(...b), 1) && near(a[1] * b[1] + a[2] * b[2], 0));
  assert.ok(R.panel.normal[2] > 0.9 && R.panel.up[2] < 0, 'the panel upright, leaning back');
  assert.ok(near(panelPoint(R, 0, R.panel.height, -RACK.panel.thick)[2], R.zBack));
  assert.ok(near(panelPoint(R, 0, R.panel.height)[1], R.panel.top) && R.panel.top < R.sign.y0, 'under its sign');
  // Its sign as wide as it, beside the synth's, as high.
  assert.ok(near(R.sign.x0, R.x0) && near(R.sign.x1, R.x1) && near(R.sign.y0, S.sign.y0) && near(R.sign.y1, S.sign.y1) && near(R.sign.z, S.sign.z));
});

test('on its top: the sixteen steps in fours, each a key, an accent\'s and a slide\'s, and its note\'s knob behind them; the rows named at the left', () => {
  assert.equal(R.keys.length, SEQ_ROWS.length * STEPS);
  assert.deepEqual(SEQ_ROWS, ['seq', 'accent', 'slide']);
  for (const [r, row] of SEQ_ROWS.entries()) {
    for (let s = 0; s < STEPS; s++) {
      const q = R.keys[r * STEPS + s], first = R.keys[s];
      assert.ok(near(q.a0, first.a0) && near(q.a1 - q.a0, K.width), `${row} ${s}: under step ${s}'s key`);
      assert.ok(near(q.b1 - q.b0, r ? K.small : K.deep), `${row} ${s}`);
      if (s) {
        const gap = q.a0 - R.keys[r * STEPS + s - 1].a1;
        assert.ok(near(gap, RACK.step.pitch - K.width + (s % 4 ? 0 : RACK.step.group)), `${row} ${s}: in fours`);
      }
      assert.equal(rackKeyAt(R, ...mid(q)), r * STEPS + s);
    }
    if (r) assert.ok(R.keys[r * STEPS].b0 > R.keys[(r - 1) * STEPS].b1 + 0.01, `${row} behind the row before`);
  }
  assert.ok(K.width >= 0.03 && K.small >= 0.035, 'large enough to come down on');
  assert.ok(R.keys[0].a0 >= RACK.step.left && R.keys[STEPS - 1].a1 + RACK.step.right <= R.width + 1e-9);
  assert.ok(R.numbers.b1 < R.keys[0].b0 && R.numbers.b0 > 0, 'the numbers in front of the keys');
  assert.ok(R.names.b0 > R.keys[2 * STEPS].b1 && R.names.b1 < R.knobs[0].b - RACK.knob.r, 'the notes\' names behind the keys, in front of the knobs');
  // Between keys, and in front of them: none.
  assert.equal(rackKeyAt(R, (R.keys[0].a1 + R.keys[1].a0) / 2, mid(R.keys[0])[1]), -1);
  assert.equal(rackKeyAt(R, mid(R.keys[0])[0], (R.keys[0].b1 + R.keys[STEPS].b0) / 2), -1);
  // A knob for each step's note, behind its keys; anywhere across its column points at it.
  for (let s = 0; s < STEPS; s++) {
    const k = R.knobs[s];
    assert.deepEqual([k.part, k.step, k.on], ['note', s, 'top']);
    assert.ok(near(k.a, mid(R.keys[s])[0]) && k.b + RACK.knob.r < R.length && k.b - RACK.knob.r > R.names.b1 - 1e-9, `${s}`);
    assert.equal(rackKnobAt(R, k.a, k.b), s);
    assert.equal(rackKnobAt(R, k.a + RACK.step.pitch * 0.45, k.b + RACK.knob.r), s);
    assert.equal(rackKnobAt(R, k.a, k.b, 'panel'), -1, 'on the top, not the panel');
    if (s) assert.ok(k.a - R.knobs[s - 1].a > 2 * RACK.knob.r * 1.2, `${s} apart from ${s - 1}`);
  }
  assert.equal(rackKnobAt(R, ...mid(R.keys[0])), -1, 'not on the keys');
  // The rows' names at the left, each by its row; the notes' by the knobs.
  assert.deepEqual(R.labels.map((l) => l.text), ['STEP', 'ACCENT', 'SLIDE', 'NOTE']);
  for (const [r, l] of R.labels.slice(0, 3).entries()) assert.ok(near(l.b, mid(R.keys[r * STEPS])[1]), l.text);
  assert.ok(near(R.labels[3].b, R.knobs[0].b));
});

test('on its panel: the clock\'s module (RUN, its tempo\'s knob and display, its outs), the sequencer\'s (its display, its octave\'s buttons, its clock in and notes out), the delay\'s and the LFO\'s; apart', () => {
  const P = R.panel;
  assert.deepEqual(P.modules.map((m) => [m.id, m.name]), [['clock', 'CLOCK'], ['seq', 'SEQUENCER'], ['delay', 'DELAY'], ['lfo', 'LFO']]);
  for (const [i, m] of P.modules.entries()) {
    assert.ok(m.a0 > 0 && m.a1 < R.width && m.a1 > m.a0, m.id);
    if (i) assert.ok(m.a0 > P.modules[i - 1].a1, `${m.id} right of ${P.modules[i - 1].id}`);
  }
  const module = (id) => P.modules.find((m) => m.id === id);
  const within = (m, a, r = 0) => a - r > m.a0 && a + r < m.a1;
  /** The module a jack is on, by its id (patch.js's module, as the rack names it). */
  const home = (id) => ({ rack: 'clock', seq: 'seq', rackdelay: 'delay', lfo: 'lfo' })[id.split('.')[0]];
  // Its jacks: the rack's in patch.js, once, in its order, after the board's and the synth's in the
  // room's list; each in its module.
  assert.deepEqual(P.jacks.map((j) => j.id), JACKS.filter((j) => ['rackclock', 'seq', 'rackdelay', 'lfo'].includes(j.module)).map((j) => j.id));
  assert.deepEqual(P.jacks.slice(0, 3).map((j) => j.id), RACK_CLOCK_OUTS.map((o) => o.id));
  assert.deepEqual(P.jacks.slice(5).map((j) => j.id), ['rackdelay.in', 'lfo.out']);
  assert.equal(P.jackBase, S.panel.jackBase + S.panel.jacks.length);
  assert.equal(P.jackBase, B.panel.jacks.length + S.panel.jacks.length);
  const ring = BOARD.panel.jack * 1.8;
  for (const [n, j] of P.jacks.entries()) {
    assert.equal(j.out, JACKS.find((J) => J.id === j.id).dir === 'out', j.id);
    assert.ok(within(module(home(j.id)), j.a, ring), `${j.id} in its module`);
    assert.ok(j.b - 0.036 > 0, `${j.id} on the panel, its plate too`);
    assert.equal(jackAt(R, j.a, j.b), n);
    for (const o of P.jacks) if (o !== j) assert.ok(Math.hypot(o.a - j.a, o.b - j.b) >= BOARD.panel.pitch - 1e-9, `${j.id} apart from ${o.id}`);
  }
  // Its buttons: RUN the clock's, the octave's the sequencer's; large enough to point at, apart, clear
  // of the jacks and the displays.
  assert.deepEqual(P.buttons.map((b) => [b.id, b.label]), [['run', 'RUN'], ['octave.down', '−'], ['octave.up', '+']]);
  const displays = [P.displays.clock, P.displays.seq];
  for (const [i, b] of P.buttons.entries()) {
    assert.ok(within(module(b.id === 'run' ? 'clock' : 'seq'), b.a0) && within(module(b.id === 'run' ? 'clock' : 'seq'), b.a1), `${b.id} in its module`);
    assert.ok(b.a1 - b.a0 >= 0.04 && b.b1 - b.b0 >= 0.04, `${b.id} large enough to point at`);
    assert.equal(rackButtonAt(R, ...mid(b)), i);
    for (const o of P.buttons) if (o !== b) assert.ok(o.a0 >= b.a1 + 0.005 || o.a1 <= b.a0 - 0.005, `${b.id} apart from ${o.id}`);
    for (const j of P.jacks) assert.ok(j.a + ring < b.a0 || j.a - ring > b.a1 || j.b + ring < b.b0, `${b.id} clear of ${j.id}`);
    for (const d of displays) assert.ok(b.b1 < d.b0 || b.a1 < d.a0 || b.a0 > d.a1, `${b.id} clear of a display`);
  }
  // The tempo's knob: the clock's, clear of the rest; pointed at on the panel only.
  const tempo = R.knobs[STEPS];
  assert.deepEqual([tempo.part, tempo.on, R.knobs.length], ['tempo', 'panel', STEPS + 1 + DELAY_KNOBS.length + LFO_KNOBS.length]);
  assert.ok(within(module('clock'), tempo.a, RACK.knob.tempo));
  assert.equal(rackKnobAt(R, tempo.a, tempo.b, 'panel'), STEPS);
  assert.equal(rackKnobAt(R, tempo.a + RACK.knob.tempo * 1.2, tempo.b, 'panel'), STEPS, 'a little larger to point at');
  assert.equal(rackKnobAt(R, tempo.a, tempo.b), -1);
  for (const j of P.jacks) assert.ok(Math.hypot(j.a - tempo.a, j.b - tempo.b) > RACK.knob.tempo + ring, `the tempo's knob clear of ${j.id}`);
  for (const b of P.buttons) assert.ok(tempo.a + RACK.knob.tempo * 1.25 < b.a0 || tempo.b + RACK.knob.tempo * 1.25 < b.b0, `clear of ${b.id}`);
  // The displays in their modules, under the modules' names, under the panel's top edge.
  assert.ok(within(module('clock'), P.displays.clock.a0) && within(module('clock'), P.displays.clock.a1));
  assert.ok(within(module('seq'), P.displays.seq.a0) && within(module('seq'), P.displays.seq.a1));
  const title = (text) => P.titles.find((t) => t.text === text);
  for (const m of P.modules.filter((x) => x.name)) {
    const t = title(m.name);
    assert.ok(near(t.a, (m.a0 + m.a1) / 2) && t.b > Math.max(...displays.map((d) => d.b1)) && t.b < P.height - 0.012, m.name);
  }
  assert.ok(title('TEMPO').b < tempo.b - RACK.knob.tempo, 'its name under the knob');
  assert.ok(title('OCTAVE').b > P.buttons[1].b1 && near(title('OCTAVE').a, (P.buttons[1].a0 + P.buttons[2].a1) / 2), 'over its buttons');
});

test("on the panel the delay's knobs and the LFO's, each in its module, the first over the other two; each pointed at, apart from the rest, its setting under it", () => {
  const P = R.panel, mod = R.knobs.slice(STEPS + 1);
  assert.deepEqual(mod.map((n) => [n.part, n.name, n.on]), [...DELAY_KNOBS.map((name) => ['delay', name, 'panel']), ...LFO_KNOBS.map((name) => ['lfo', name, 'panel'])]);
  const r = RACK.knob.module, grip = r * 1.25, ring = BOARD.panel.jack * 1.8;
  assert.ok(r >= 0.014, 'as large as a step\'s note\'s, to point at');
  for (const [i, n] of mod.entries()) {
    const k = STEPS + 1 + i, m = P.modules.find((x) => x.id === n.part), first = mod[i - (i % 3)];
    assert.ok(n.a - grip > m.a0 && n.a + grip < m.a1, `${n.name}: in its module, as far as it is pointed at`);
    assert.ok(i % 3 ? n.b < first.b - 2 * grip : near(n.a, (m.a0 + m.a1) / 2), `${n.name}: under the first, or it in the middle`);
    assert.equal(knobRadius(n), r);
    assert.equal(rackKnobAt(R, n.a, n.b, 'panel'), k, n.name);
    assert.equal(rackKnobAt(R, n.a + r * 1.2, n.b, 'panel'), k, `${n.name}: a little larger to point at`);
    assert.equal(rackKnobAt(R, n.a, n.b), -1, `${n.name}: on the panel, not the top`);
    for (const [j, o] of R.knobs.entries()) if (o.on === 'panel' && j !== k) assert.ok(Math.hypot(o.a - n.a, o.b - n.b) > grip + knobRadius(o) * 1.25, `${n.name} apart from knob ${j}`);
    for (const j of P.jacks) assert.ok(Math.hypot(j.a - n.a, j.b - n.b) > grip + ring, `${n.name} clear of ${j.id}`);
    for (const b of P.buttons) assert.ok(n.a + grip < b.a0 || n.a - grip > b.a1 || n.b - grip > b.b1 || n.b + grip < b.b0, `${n.name} clear of ${b.id}`);
    // Room over it for its name (rackkit.js writes it 0.0125 over its edge, 0.0095 high), under the
    // module's (0.0125 high).
    const t = P.titles.find((x) => x.text === m.name);
    assert.ok(n.b + r + 0.0125 + 0.0095 / 2 < t.b - 0.0125 / 2, `${n.name}: its name under the module's`);
  }
  assert.deepEqual(P.settings.map((s) => s.k), mod.map((_, i) => STEPS + 1 + i));
  for (const s of P.settings) {
    const n = R.knobs[s.k];
    assert.ok(near(s.a1 - s.a0, RACK.setting.w) && near(s.b1 - s.b0, RACK.setting.h) && near((s.a0 + s.a1) / 2, n.a), `${n.name}'s setting`);
    assert.ok(s.b1 < n.b - r, `${n.name}'s setting under it`);
    const m = P.modules.find((x) => x.id === n.part);
    assert.ok(s.a0 > m.a0 && s.a1 < m.a1, `${n.name}'s setting in its module`);
    for (const o of P.settings) if (o !== s) assert.ok(o.a0 >= s.a1 || o.a1 <= s.a0 || o.b0 >= s.b1 || o.b1 <= s.b0, `${n.name}'s setting apart from ${R.knobs[o.k].name}'s`);
    for (const [j, o] of R.knobs.entries()) if (o.on === 'panel' && j !== s.k) assert.ok(Math.hypot(Math.max(s.a0 - o.a, 0, o.a - s.a1), Math.max(s.b0 - o.b, 0, o.b - s.b1)) > knobRadius(o), `${n.name}'s setting clear of knob ${j}`);
    for (const j of P.jacks) assert.ok(s.b0 > j.b + 0.024, `${n.name}'s setting over ${j.id} and its plate (kit.js drawPlate)`);
  }
  // The LFO's light by its name, in its module, clear of the name.
  const lfo = P.modules[3], name = P.titles.find((t) => t.text === 'LFO');
  assert.ok(P.light.a > name.a + 0.02 && P.light.a + 0.006 < lfo.a1 - 0.008 && near(P.light.b, name.b));
});

test('a ray meets the key it points at (a step\'s, an accent\'s, a slide\'s), a knob, a jack, a button, and the rest as the rack', () => {
  for (const [k, q] of R.keys.entries()) {
    const h = ray(eye, keyTop(k));
    assert.deepEqual([h?.kind, h?.seq, h?.rack, h?.jack], [SEQ_ROWS[Math.floor(k / STEPS)], k % STEPS, -1, -1], `${k}`);
    assert.deepEqual([h.pad, h.step, h.knob, h.key, h.dial, h.button], [-1, -1, -1, -1, -1, -1]);
    assert.ok(h.u > 0.2 && h.u < 0.8 && h.v > 0.1 && h.v < 0.9, `${k}: ${h.u} ${h.v}`);
    assert.ok(near(h.u * (q.a1 - q.a0) + q.a0, mid(q)[0], 1e-6));
    assert.equal(h.walkable, false);
  }
  for (let s = 0; s < STEPS; s++) {
    const k = R.knobs[s], h = ray(eye, boardPoint(R, k.a, k.b, K.rise));
    assert.deepEqual([h?.kind, h?.rack, h?.seq], ['rackknob', s, -1], `knob ${s}`);
  }
  // On the panel: a jack, its index in the room's list of them, after the board's and the synth's.
  for (const [j, jack] of R.panel.jacks.entries()) {
    const h = ray(eye, panelPoint(R, jack.a + 0.01, jack.b));
    assert.deepEqual([h?.kind, h?.jack, h?.rack, h?.seq], ['jack', R.panel.jackBase + j, -1, -1], jack.id);
  }
  for (const [i, b] of R.panel.buttons.entries()) {
    const h = ray(eye, panelPoint(R, ...mid(b)));
    assert.deepEqual([h?.kind, h?.rack, h?.jack], ['rackbutton', i, -1], b.id);
    assert.ok(near(h.nz, R.panel.normal[2]));
  }
  // The knobs on the panel: the tempo's, the delay's and the LFO's.
  for (let k = STEPS; k < R.knobs.length; k++) {
    const n = R.knobs[k], h = ray(eye, panelPoint(R, n.a, n.b));
    assert.deepEqual([h?.kind, h?.rack, h?.jack], ['rackknob', k, -1], `${n.part} ${n.name ?? ''}`);
  }
  // The rest: its displays, its numbers, the delay's plate between its knobs, a setting, its front,
  // its side, its sign.
  for (const d of [R.panel.displays.clock, R.panel.displays.seq]) assert.equal(ray(eye, panelPoint(R, (d.a0 + d.a1) / 2, (d.b0 + d.b1) / 2 + 0.01))?.kind, 'rack');
  assert.equal(ray(eye, boardPoint(R, mid(R.keys[3])[0], (R.numbers.b0 + R.numbers.b1) / 2))?.kind, 'rack', 'a step\'s number');
  const plate = R.panel.modules[2];
  assert.equal(ray(eye, panelPoint(R, (plate.a0 + plate.a1) / 2, 0.155))?.kind, 'rack', "the delay's plate between its knobs");
  const shown = R.panel.settings[4];
  assert.equal(ray(eye, panelPoint(R, (shown.a0 + shown.a1) / 2, (shown.b0 + shown.b1) / 2))?.kind, 'rack', "the LFO's shape's setting");
  const front = ray([R.x0 + 0.3, 0.5, R.zFront + 1], [R.x0 + 0.3, 0.5, R.zFront]);
  assert.deepEqual([front?.kind, front?.nz], ['rack', 1]);
  const right = ray([R.x1 + 1, 0.5, (R.zBack + R.zFront) / 2], [R.x1, 0.5, (R.zBack + R.zFront) / 2]);
  assert.deepEqual([right?.kind, right?.nx], ['rack', 1]);
  const sign = ray([(R.x0 + R.x1) / 2, 1.6, -1], [(R.x0 + R.x1) / 2, 1.6, L.z1]);
  assert.deepEqual([sign?.kind, sign?.nz], ['rack', 1]);
  assert.equal(ray(eye, [(R.x0 + R.x1) / 2, 2.5, R.zBack]), null, 'over it');
  assert.equal(ray(eye, keyTop(5), 0.1), null, 'the room nearer');
  assert.equal(ray([(S.x0 + S.x1) / 2, EYE, S.zFront + 0.6], [(S.x0 + S.x1) / 2, S.top, S.zBack]), null, 'the synth, not it');
});

test('one walks round it as round the synth; on a screen all of it is in view from where one plays it, clear of the synth', () => {
  const Z = R.zFront + BOARD.keep, X1 = R.x1 + BOARD.keep;
  assert.deepEqual(clampBoard(R, R.x0 + 0.3, Z + 0.3, R.x0 + 0.4, Z - 0.1), { x: R.x0 + 0.4, z: Z });
  assert.deepEqual(clampBoard(R, X1 + 0.2, R.zBack + 0.2, X1 - 0.05, R.zBack + 0.1), { x: X1, z: R.zBack + 0.1 });
  assert.ok(boardBlocks(R, (R.x0 + R.x1) / 2, R.zFront + 0.1) && !boardBlocks(R, (R.x0 + R.x1) / 2, Z + 0.01));
  // In front of the gap between it and the synth, both keep one out alike: their fronts are in line.
  const between = (S.x1 + R.x0) / 2;
  assert.ok(boardBlocks(R, between, Z - 0.01) && boardBlocks(S, between, Z - 0.01) && !boardBlocks(R, between, Z + 0.01) && !boardBlocks(S, between, Z + 0.01));
  const fovFor = (aspect) => Math.min(100, Math.max(70, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI));
  for (const [name, aspect] of [['desktop', 16 / 9], ['phone', 9 / 19.5]]) {
    const fov = fovFor(aspect), free = (x, z) => !boardBlocks(S, x, z) && !boardBlocks(B, x, z);
    const f = boardFront(R, { fov, aspect, h: RACK.knob.h, free });
    assert.ok(!boardBlocks(R, f.x, f.z) && free(f.x, f.z), `${name}: where one may stand, ${f.x}, ${f.z}`);
    assert.ok(f.pitch < -0.2 && f.yaw === 0 && f.z < -MARGIN, `${name}: looking down at it`);
    assert.ok(near(f.x, (R.x0 + R.x1) / 2), `${name}: in front of its middle`);
  }
});

test('in VR one stands at arm\'s length from its keys; a tip coming down through a key\'s cap is on it, where it crossed', () => {
  const s = boardStand(R, 0.3);
  assert.ok(!boardBlocks(R, s.x, s.z) && !boardBlocks(S, s.x, s.z) && near(s.x, (R.x0 + R.x1) / 2));
  const shoulder = [s.x, EYE - 0.25, s.z];
  for (const k of [0, STEPS - 1, 2 * STEPS, 3 * STEPS - 1]) assert.ok(Math.hypot(...keyTop(k).map((c, i) => c - shoulder[i])) < 0.75, `key ${k} in reach of a hand`);
  for (const k of [0, 7, STEPS + 3, 2 * STEPS + 15]) {
    assert.equal(rackStrike(R, ...keyTop(k, 0.02), ...keyTop(k, -0.004)), k, `${k}: down through its cap`);
    assert.equal(rackStrike(R, ...keyTop(k, 0.02), ...keyTop(k, 0.002)), -1, `${k}: not yet down to it`);
    assert.equal(rackStrike(R, ...keyTop(k, -0.002), ...keyTop(k, -0.008)), -1, `${k}: already under it`);
    assert.equal(rackStrike(R, ...keyTop(k, -0.004), ...keyTop(k, 0.02)), -1, `${k}: coming up`);
  }
  // Slanting down from over one key to the next: the one it crossed the caps' height over, three
  // quarters of the way along.
  assert.equal(rackStrike(R, ...keyTop(4, 0.03), ...keyTop(5, -0.01)), 5);
  assert.equal(rackStrike(R, ...keyTop(4, 0.01), ...keyTop(5, -0.03)), 4);
  // Between keys, and off the rack: none.
  const gap = boardPoint(R, (R.keys[3].a1 + R.keys[4].a0) / 2, mid(R.keys[3])[1], K.rise);
  assert.equal(rackStrike(R, gap[0], gap[1] + 0.02, gap[2], gap[0], gap[1] - 0.004, gap[2]), -1);
  assert.equal(rackStrike(R, R.x1 + 0.1, 1.2, R.zFront - 0.1, R.x1 + 0.1, 0.8, R.zFront - 0.1), -1);
});
