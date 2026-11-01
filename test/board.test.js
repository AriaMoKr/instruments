// The drum board (board.js): where it stands and what is on it (the step keys, the pads, the strip
// and the panel with its jacks), what a ray meets on it, where one may walk round it, where one
// stands to play it (all of it in view on a screen, a desktop's or a phone's; in reach in VR), and
// a stick's tip or a finger coming down on a pad or a step key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import {
  BOARD, REARM, boardBlocks, boardFront, boardOutline, boardPoint, boardStand, clampBoard, heightOver, hitBoard, jackAt, knobAt,
  layoutBoard, padAt, panelPoint, stepAt, strikeAt, strikeVelocity,
} from '../public/js/board.js';
import { COLUMNS, KNOBS, PADS, ROWS } from '../public/js/drums.js';
import { DELAY_KNOBS } from '../public/js/delay.js';
import { STEPS } from '../public/js/pattern.js';
import { JACKS } from '../public/js/patch.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: -1, step: -1, knob: -1, jack: -1 });
/** What a ray from o towards the point t meets on the board, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitBoard(B, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** The middle of pad i's face, and of step key s's. */
const padMiddle = (i) => boardPoint(B, (B.pads[i].a0 + B.pads[i].a1) / 2, (B.pads[i].b0 + B.pads[i].b1) / 2, BOARD.rise);
const keyMiddle = (s) => boardPoint(B, (B.steps[s].a0 + B.steps[s].a1) / 2, (B.steps[s].b0 + B.steps[s].b1) / 2, BOARD.rise);
/** The strip's knobs (the pad's), and the panel's. */
const topKnobs = [...B.knobs.keys()].filter((k) => B.knobs[k].on === 'top');
const panelKnobs = [...B.knobs.keys()].filter((k) => B.knobs[k].on === 'panel');
/** Where one plays from on a screen, seen from: in front of it, a little back. */
const eye = [0, EYE, B.zFront + 0.6];

test('it stands against the middle of the far wall, with room to walk round it, its panel at the back', () => {
  assert.ok(near(B.x0, -B.x1));
  assert.ok(B.x0 - BOARD.keep > L.x0 + MARGIN + 0.3 && B.x1 + BOARD.keep < L.x1 - MARGIN - 0.3, 'a way past it on either side');
  assert.ok(B.zFront < L.z1 + L.depth / 2, 'in the far half of the room');
  // Its top: from its front edge, leaning back and up to the panel's foot.
  assert.deepEqual(boardPoint(B, 0, 0), B.origin);
  assert.ok(near(boardPoint(B, 0, B.length)[1], B.top) && B.top > B.front);
  assert.deepEqual(boardPoint(B, 0, B.length).map((x) => x.toFixed(9)), B.panel.origin.map((x) => x.toFixed(9)), 'the panel stands on its back edge');
  assert.ok(B.front > 0.75 && B.top < 1.2, 'at the height of a table, a hand low');
  const n = B.normal, u = B.up;
  assert.ok(near(Math.hypot(...n), 1) && near(Math.hypot(...u), 1) && near(n[1] * u[1] + n[2] * u[2], 0));
  assert.ok(n[2] > 0, 'it faces the player a little');
  // The panel: leaning back, facing the player and a little up; its back, at the top, `wall` from the wall.
  const N = B.panel.normal, U = B.panel.up;
  assert.ok(near(Math.hypot(...N), 1) && near(Math.hypot(...U), 1) && near(N[1] * U[1] + N[2] * U[2], 0));
  assert.ok(N[2] > 0.9 && N[1] > 0.2 && U[2] < 0, 'upright, leaning back');
  assert.ok(near(panelPoint(B, 0, B.panel.height, -BOARD.panel.thick)[2], L.z1 + BOARD.wall) && near(B.zBack, L.z1 + BOARD.wall));
  assert.ok(near(panelPoint(B, 0, B.panel.height)[1], B.panel.top));
  assert.ok(B.panel.top < B.sign.y0 && B.panel.top > 1.3, `under the sign, ${B.panel.top}`);
});

test('the step keys along the front edge, four over each column of pads; behind them the pads, then the knobs and the display', () => {
  assert.equal(B.steps.length, STEPS);
  for (const [s, k] of B.steps.entries()) {
    assert.ok(near(k.b0, BOARD.step.front) && near(k.b1 - k.b0, BOARD.step.depth), `${s}`);
    if (s) assert.ok(k.a0 > B.steps[s - 1].a1, `${s} right of ${s - 1}`);
    assert.equal(stepAt(B, (k.a0 + k.a1) / 2, (k.b0 + k.b1) / 2), s);
    assert.equal(padAt(B, (k.a0 + k.a1) / 2, (k.b0 + k.b1) / 2), -1);
  }
  for (let c = 0; c < COLUMNS; c++) {
    const pad = B.pads[PADS.findIndex((p) => p.col === c && p.row === 0)];
    const first = B.steps[c * (STEPS / COLUMNS)], last = B.steps[(c + 1) * (STEPS / COLUMNS) - 1];
    assert.ok(near(first.a0, pad.a0) && near(last.a1, pad.a1), `column ${c}: its four keys as wide as it`);
    assert.ok(pad.b0 > first.b1 + 0.02, 'the pads behind the keys');
  }
  assert.ok(B.steps[0].a1 - B.steps[0].a0 > 0.035, 'a key wide enough for a stick, or a finger');
  assert.equal(stepAt(B, B.steps[0].a1 + BOARD.step.gap / 2, B.steps[0].b0 + 0.01), -1, 'between two');
  for (const [i, p] of PADS.entries()) {
    const q = B.pads[i];
    assert.ok(near(q.a1 - q.a0, BOARD.pad) && near(q.b1 - q.b0, BOARD.pad));
    assert.ok(q.a0 >= BOARD.margin - 1e-9 && q.a1 <= B.width - BOARD.margin + 1e-9 && q.b1 < B.strip.b0, p.id);
    for (const [j, r] of PADS.entries()) {
      if (r.col === p.col + 1 && r.row === p.row) assert.ok(near(B.pads[j].a0 - q.a1, BOARD.gap), `${p.id}, then ${r.id} to its right`);
      if (r.row === p.row + 1 && r.col === p.col) assert.ok(near(B.pads[j].b0 - q.b1, BOARD.gap), `${p.id}, then ${r.id} beyond it`);
    }
    assert.equal(padAt(B, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2), i);
  }
  assert.equal(padAt(B, B.pads[0].a1 + BOARD.gap / 2, B.pads[0].b0 + 0.01), -1, 'between two');
  // The pad's knobs on the strip, first, then the panel's: the tempo and the delay's.
  assert.deepEqual(B.knobs.map((k) => `${k.part}.${k.name}`), [...KNOBS.map((n) => `drum.${n}`), 'clock.tempo', ...DELAY_KNOBS.map((n) => `delay.${n}`)]);
  assert.deepEqual(topKnobs, [0, 1, 2]);
  for (const n of topKnobs) {
    const k = B.knobs[n];
    assert.ok(k.b > B.strip.b0 && k.b < B.strip.b1 && k.a + BOARD.knob.r < B.width);
    assert.ok(k.a - BOARD.knob.r > B.display.a1, 'right of the display');
    assert.equal(knobAt(B, k.a, k.b), n);
    if (n) assert.ok(near(k.a - B.knobs[n - 1].a, BOARD.knob.spacing));
  }
  assert.ok(B.display.a1 - B.display.a0 > 0.25, 'room for a pad\'s name');
  assert.ok(B.strip.b1 < B.length && near(B.width, 2 * BOARD.margin + COLUMNS * BOARD.pad + (COLUMNS - 1) * BOARD.gap));
  assert.ok(near(B.pads[PADS.findIndex((p) => p.row === ROWS - 1)].b1 + 0.04, B.strip.b0));
});

test('on the panel: every jack of the patch but the synth\'s and the rack\'s (on their own panels) once, in its module\'s section, apart; the pads\' outs as the pads lie; the knobs and RUN clear of them', () => {
  const P = B.panel, r = BOARD.panel.jack, jack = (id) => P.jacks.find((j) => j.id === id);
  assert.deepEqual(P.jacks.map((j) => j.id).sort(), JACKS.filter((j) => ['clock', 'drums', 'delay'].includes(j.module)).map((j) => j.id).sort());
  for (const j of P.jacks) {
    const J = JACKS.find((x) => x.id === j.id);
    assert.equal(j.out, J.dir === 'out', `${j.id}: an output on a plate`);
    const s = P.sections.find((x) => x.name.toLowerCase() === J.module);
    assert.ok(j.a - r * 1.5 > s.a0 && j.a + r * 1.5 < s.a1, `${j.id} in ${s.name}`);
    assert.ok(j.b - r * 1.5 > 0 && j.b + r * 1.5 < P.height - 0.03, `${j.id} under the sections' names`);
    assert.equal(jackAt(B, j.a, j.b), P.jacks.indexOf(j));
    for (const o of P.jacks) if (o !== j) assert.ok(Math.hypot(o.a - j.a, o.b - j.b) > r * 3, `${j.id} and ${o.id} apart`);
  }
  for (const p of PADS) {
    const j = jack(`pad.${p.id}`);
    assert.equal(j.color, p.color, `${p.id}: ringed in its colour`);
    for (const q of PADS) {
      const k = jack(`pad.${q.id}`);
      if (q.row === p.row && q.col > p.col) assert.ok(k.a > j.a && near(k.b, j.b), `${q.id} right of ${p.id}`);
      if (q.col === p.col && q.row > p.row) assert.ok(k.b > j.b && near(k.a, j.a), `${q.id} over ${p.id}`);
    }
  }
  // The cable the room comes with, short: the clock's ×1 level with the drums' clock in, beside it.
  assert.ok(near(jack('clock.x1').b, jack('drums.clock').b) && jack('drums.clock').a - jack('clock.x1').a < 0.1);
  // The knobs, RUN and the display: on the panel, clear of the jacks and of each other.
  const things = [...panelKnobs.map((k) => [B.knobs[k].a, B.knobs[k].b, BOARD.knob.r * 1.25]), [(P.run.a0 + P.run.a1) / 2, (P.run.b0 + P.run.b1) / 2, 0.035]];
  for (const [a, b, size] of things) {
    assert.ok(a - size > 0 && a + size < B.width && b - size > 0 && b + size < P.height - 0.03, `${a}, ${b} on the panel`);
    for (const j of P.jacks) assert.ok(Math.hypot(j.a - a, j.b - b) > size + r * 1.5, `${a}, ${b} clear of ${j.id}`);
    assert.ok(!(a > P.display.a0 - size && a < P.display.a1 + size && b > P.display.b0 - size && b < P.display.b1 + size), `${a}, ${b} clear of the display`);
  }
  for (const k of panelKnobs) assert.equal(knobAt(B, B.knobs[k].a, B.knobs[k].b, 'panel'), k);
  assert.equal(knobAt(B, B.knobs[panelKnobs[0]].a, B.knobs[panelKnobs[0]].b), -1, 'not on the top');
});

test('a ray meets the pad or the step key it points at (where on it), a knob, the rest of the board, its front and its sides', () => {
  for (const i of PADS.keys()) {
    const h = ray(eye, padMiddle(i));
    assert.deepEqual([h?.kind, h?.pad, h?.step, h?.knob], ['pad', i, -1, -1], PADS[i].id);
    assert.ok(near(h.u, 0.5, 1e-6) && near(h.v, 0.5, 1e-6), `${h.u} ${h.v}`);
    assert.equal(h.walkable, false);
  }
  for (const s of B.steps.keys()) {
    const h = ray(eye, keyMiddle(s));
    assert.deepEqual([h?.kind, h?.step, h?.pad], ['step', s, -1], `step ${s}`);
    assert.ok(near(h.u, 0.5, 1e-6) && near(h.v, 0.5, 1e-6), `${h.u} ${h.v}`);
  }
  // A pad's front left corner is u, v 0, 0.
  const q = B.pads[5];
  const corner = ray(eye, boardPoint(B, q.a0 + 0.001, q.b0 + 0.001, BOARD.rise));
  assert.ok(corner.u < 0.01 && corner.v < 0.01);
  // The knobs: a ray on the knob's top meets the top's plane at its foot, a little nearer.
  for (const k of topKnobs) {
    const h = ray(eye, boardPoint(B, B.knobs[k].a, B.knobs[k].b, BOARD.rise));
    assert.deepEqual([h?.kind, h?.knob, h?.pad], ['knob', k, -1], KNOBS[k]);
  }
  assert.equal(ray(eye, boardPoint(B, B.pads[0].a1 + BOARD.gap / 2, B.pads[0].b0 + 0.05, BOARD.rise))?.kind, 'board', 'between pads');
  assert.equal(ray(eye, boardPoint(B, B.display.a0 + 0.05, B.strip.b0 + 0.05, BOARD.rise))?.kind, 'board', 'the display');
  // Its front, from low in front; its sides, from beside it.
  const front = ray([0.1, 0.5, B.zFront + 1], [0.1, 0.5, B.zFront]);
  assert.deepEqual([front?.kind, front?.nz], ['board', 1]);
  assert.ok(near(front.z, B.zFront, 1e-9));
  const side = ray([B.x1 + 1, 0.5, (B.zBack + B.zFront) / 2], [B.x1, 0.5, (B.zBack + B.zFront) / 2]);
  assert.deepEqual([side?.kind, side?.nx], ['board', 1]);
  const left = ray([B.x0 - 1, 0.5, (B.zBack + B.zFront) / 2], [B.x0, 0.5, (B.zBack + B.zFront) / 2]);
  assert.deepEqual([left?.kind, left?.nx], ['board', -1]);
  // The panel's side, as it rises over the top.
  const z = panelPoint(B, 0, B.panel.height / 2)[2], y = panelPoint(B, 0, B.panel.height / 2, -0.01)[1];
  assert.deepEqual(ray([B.x1 + 1, y, z - 0.01], [B.x1, y, z - 0.01])?.kind, 'board', 'the panel\'s side');
  // Its sign on the wall over it, as wide as it: a level gaze from across the room (a TV's dot, which
  // can't look down) meets it over the board.
  assert.ok(B.sign.y0 < EYE && B.sign.y1 > EYE && B.sign.y0 > B.top && near(B.sign.x0, B.x0) && near(B.sign.x1, B.x1));
  assert.ok(B.sign.z > L.z1 && B.sign.z < B.zBack, 'on the wall, behind the board');
  for (const x of [B.x0 + 0.01, 0, B.x1 - 0.01]) {
    const h = ray([0, EYE, -1], [x, EYE, L.z1]);
    assert.deepEqual([h?.kind, h?.nz, h?.pad, h?.knob], ['board', 1, -1, -1], `the sign at ${x}`);
    assert.ok(near(h.z, B.sign.z));
  }
  assert.equal(ray([0, EYE, -1], [B.x1 + 0.05, EYE, L.z1]), null, 'beside the sign');
  // Over it, under it and past it: nothing; nor when the room has something nearer.
  assert.equal(ray(eye, [0, 2.5, B.zBack]), null, 'over it');
  assert.equal(ray([B.x1 + 1, 0.5, B.zFront + 1], [B.x1 + 2, 0.5, B.zFront + 1]), null, 'away from it');
  assert.equal(ray(eye, padMiddle(0), 0.1), null, 'the room nearer');
  assert.equal(ray([0, 0.5, B.zFront + 1], [0, 0.5, B.zFront], 0.5), null);
});

test('on the panel a ray meets each jack, each knob and RUN, and the rest of it as the board', () => {
  const P = B.panel;
  for (const [j, jack] of P.jacks.entries()) {
    // At the nut's edge too: half as large again to point at.
    for (const da of [0, BOARD.panel.jack * 1.3]) {
      const h = ray(eye, panelPoint(B, jack.a + da, jack.b));
      assert.deepEqual([h?.kind, h?.jack, h?.knob, h?.pad, h?.step], ['jack', j, -1, -1, -1], `${jack.id} +${da}`);
      assert.ok(near(h.ny, P.normal[1]) && near(h.nz, P.normal[2]), 'facing out of the panel');
    }
  }
  for (const k of panelKnobs) {
    const h = ray(eye, panelPoint(B, B.knobs[k].a, B.knobs[k].b));
    assert.deepEqual([h?.kind, h?.knob, h?.jack], ['knob', k, -1], B.knobs[k].name);
  }
  assert.deepEqual(ray(eye, panelPoint(B, (P.run.a0 + P.run.a1) / 2, (P.run.b0 + P.run.b1) / 2))?.kind, 'run');
  for (const [a, b] of [[(P.display.a0 + P.display.a1) / 2, (P.display.b0 + P.display.b1) / 2], [0.8, 0.2], [0.005, 0.24]]) {
    assert.deepEqual(ray(eye, panelPoint(B, a, b))?.kind, 'board', `${a}, ${b}`);
  }
  // A level gaze passes over it, to the sign.
  assert.ok(P.top < EYE - 0.15);
});

test('one walks round it: kept from its front and sides, sliding along them; the floor there is no place to walk to', () => {
  const Z = B.zFront + BOARD.keep, X0 = B.x0 - BOARD.keep, X1 = B.x1 + BOARD.keep;
  // Walking into its front: stopped in front, sliding across.
  assert.deepEqual(clampBoard(B, 0.1, Z + 0.3, 0.2, Z - 0.1), { x: 0.2, z: Z });
  // Into its side: stopped beside it, sliding along.
  assert.deepEqual(clampBoard(B, X1 + 0.2, B.zBack + 0.2, X1 - 0.05, B.zBack + 0.1), { x: X1, z: B.zBack + 0.1 });
  assert.deepEqual(clampBoard(B, X0 - 0.2, B.zBack + 0.2, X0 + 0.05, B.zBack + 0.3), { x: X0, z: B.zBack + 0.3 });
  // Away from it, as it was.
  assert.deepEqual(clampBoard(B, 0, Z + 1, 0, Z + 0.5), { x: 0, z: Z + 0.5 });
  // Somehow on it: out the nearest way.
  assert.deepEqual(clampBoard(B, 0, B.zFront - 0.05, 0, B.zFront - 0.05), { x: 0, z: Z });
  assert.ok(boardBlocks(B, 0, B.zFront + 0.1) && boardBlocks(B, X1 - 0.01, B.zBack + 0.2));
  assert.ok(!boardBlocks(B, 0, Z + 0.01) && !boardBlocks(B, X1 + 0.01, B.zBack + 0.2));
});

/**
 * Where a point is in a view from (x, EYE, z), turned yaw to the left and pitch up: -1…1 across and
 * up, and whether ahead. The camera's axes in the world, the point taken along each.
 */
function project(p, at, fov, aspect) {
  const d = [p[0] - at.x, p[1] - EYE, p[2] - at.z];
  const [cy, sy, cp, sp] = [Math.cos(at.yaw), Math.sin(at.yaw), Math.cos(at.pitch), Math.sin(at.pitch)];
  const right = [cy, 0, -sy], forward = [-sy * cp, sp, -cy * cp], up = [sy * sp, cp, cy * sp];
  const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  const ty = Math.tan((fov * Math.PI) / 360), ahead = dot(forward);
  return { x: dot(right) / (ahead * ty * aspect), y: dot(up) / (ahead * ty), ahead: ahead > 0 };
}
/** main.js fitCamera's field of view for an aspect. */
const fovFor = (aspect) => Math.min(100, Math.max(70, (2 * Math.atan(Math.tan(Math.PI / 6) / aspect) * 180) / Math.PI));
/**
 * All of the board, the knobs' height out of it, as a ring of points: the top's front edge and
 * sides, and the panel's sides and top edge.
 */
const outline = [];
const h = BOARD.knob.h, W = B.width, D = B.length, H = B.panel.height;
for (let i = 0; i < 40; i++) {
  const f = i / 40;
  outline.push(boardPoint(B, f * W, 0, h), boardPoint(B, W, f * D, h), boardPoint(B, 0, f * D, h));
  outline.push(panelPoint(B, W, f * H, h), panelPoint(B, f * W, H, h), panelPoint(B, 0, f * H, h));
}
/** A page element's box (CSS pixels) in the view's terms. */
const box = (w, h, left, top, right, bottom) => ({ x0: (left / w) * 2 - 1, x1: (right / w) * 2 - 1, y0: 1 - (bottom / h) * 2, y1: 1 - (top / h) * 2 });

test('its outline: round the top and the panel, the knobs\' height out of them', () => {
  const ring = boardOutline(B, 4);
  assert.equal(ring.length, 24);
  assert.deepEqual(ring[0], boardPoint(B, 0, 0, h));
  assert.deepEqual(ring[12], panelPoint(B, W, H, h), 'the panel\'s top right corner');
});

test('on a screen one plays it from where all of it is in view, a desktop near and a phone held upright further back', () => {
  const at = {};
  for (const [name, aspect] of [['desktop', 16 / 9], ['laptop', 16 / 10], ['phone', 9 / 19.5], ['phone on its side', 19.5 / 9]]) {
    const fov = fovFor(aspect);
    const f = boardFront(B, { fov, aspect });
    at[name] = f;
    assert.equal(f.yaw, 0, `${name}: facing it`);
    assert.ok(f.pitch < -0.2 && f.pitch > -1.3, `${name}: looking down at it, ${f.pitch}`);
    assert.ok(!boardBlocks(B, f.x, f.z), `${name}: where one may stand`);
    assert.ok(f.z < -MARGIN, `${name}: inside the room, ${f.z}`);
    for (const p of outline) {
      const v = project(p, f, fov, aspect);
      assert.ok(v.ahead && Math.abs(v.x) <= 0.88 + 1e-9 && Math.abs(v.y) <= 0.88 + 1e-9, `${name}: its outline at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}`);
    }
  }
  assert.ok(at.desktop.z < B.zFront + BOARD.keep + 0.3, `a desktop near: ${at.desktop.z - B.zFront}`);
  assert.ok(at.phone.z > at.desktop.z + 0.2, `a phone further back: ${at.phone.z - B.zFront}`);
});

test('clear of the card over the view: beside it on a desktop and a TV, below it on a phone, and of the buttons at the foot', () => {
  // The card at the top left (style.css: 340 wide, 12 in; a TV's 400 wide, 48 in), as tall as it is
  // with nothing open, a TV's to the screen's foot (main.js: the remote opens the drums in it); the
  // buttons at the foot on the right.
  const screens = [
    ['desktop', 1024, 640, [[12, 12, 352, 210], [880, 584, 1008, 624]]],
    ['wide desktop', 1920, 1080, [[12, 12, 352, 210], [1650, 1024, 1904, 1064]]],
    ['phone', 320, 568, [[12, 12, 308, 236], [190, 512, 304, 552]]],
    ['TV', 960, 540, [[48, 27, 448, 540]]],
  ];
  for (const [name, w, h, boxes] of screens) {
    const aspect = w / h, fov = fovFor(aspect);
    const over = boxes.map((b) => box(w, h, ...b));
    const f = boardFront(B, { fov, aspect, over });
    assert.ok(!boardBlocks(B, f.x, f.z) && f.z < B.zFront + 2.4, `${name}: near enough to play, ${f.z - B.zFront}`);
    const seen = outline.map((p) => project(p, f, fov, aspect));
    for (const v of seen) {
      assert.ok(v.ahead && Math.abs(v.x) <= 0.88 + 1e-9 && Math.abs(v.y) <= 0.88 + 1e-9, `${name}: in view, ${v.x.toFixed(2)}, ${v.y.toFixed(2)}`);
      for (const r of over) assert.ok(v.x < r.x0 || v.x > r.x1 || v.y < r.y0 || v.y > r.y1, `${name}: clear of ${JSON.stringify(r)} at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}`);
    }
    const xs = seen.map((v) => v.x), ys = seen.map((v) => v.y);
    if (name === 'phone') assert.ok(Math.max(...ys) < over[0].y0, 'all of it below the card');
    if (name === 'TV') assert.ok(Math.min(...xs) > over[0].x1 && f.x < 0, 'all of it right of the card, from a step to the left');
    assert.equal(f.yaw, 0, `${name}: facing it, its edges level in the view`);
  }
  // With nothing over the view, as before.
  assert.deepEqual(boardFront(B, { fov: 70, aspect: 16 / 9, over: [] }), boardFront(B, { fov: 70, aspect: 16 / 9 }));
});

test('in VR one stands at arm\'s length, a stick reaching the far pads and every step key', () => {
  const s = boardStand(B);
  assert.ok(!boardBlocks(B, s.x, s.z) && s.yaw === 0 && near(s.x, 0));
  // Shoulders a little below the eye, an arm and a stick of reach.
  const shoulder = [0, EYE - 0.25, s.z];
  const reach = (p) => Math.hypot(p[0] - shoulder[0], p[1] - shoulder[1], p[2] - shoulder[2]) < 0.65 + 0.36;
  for (const i of PADS.keys()) assert.ok(reach(padMiddle(i)), PADS[i].id);
  for (const k of B.steps.keys()) assert.ok(reach(keyMiddle(k)), `step ${k}`);
});

test('a tip coming down on a pad strikes it, as fast as it was going, and on a step key sets it; across, up, or between, it does not', () => {
  const at = (i, h) => {
    const q = B.pads[i];
    return boardPoint(B, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2, BOARD.rise + h);
  };
  const out = { pad: 0, step: 0, speed: 0 };
  for (const i of PADS.keys()) {
    const [f, t] = [at(i, 0.03), at(i, -0.01)];
    strikeAt(B, ...f, ...t, 1 / 60, out);
    assert.deepEqual([out.pad, out.step], [i, -1], PADS[i].id);
    assert.ok(near(out.speed, 0.04 * 60, 1e-6), `${out.speed}`);
  }
  for (const s of B.steps.keys()) {
    const k = B.steps[s], m = (h) => boardPoint(B, (k.a0 + k.a1) / 2, (k.b0 + k.b1) / 2, BOARD.rise + h);
    strikeAt(B, ...m(0.02), ...m(-0.01), 1 / 60, out);
    assert.deepEqual([out.pad, out.step], [-1, s], `step ${s}`);
  }
  // Where it crossed the face says which pad, not where it ended (here, past the pad's edge).
  const f = at(0, 0.02);
  const cross = boardPoint(B, B.pads[0].a1 - 0.035, (B.pads[0].b0 + B.pads[0].b1) / 2, BOARD.rise);
  strikeAt(B, f[0], f[1], f[2], 2 * cross[0] - f[0], 2 * cross[1] - f[1], 2 * cross[2] - f[2], 1 / 60, out);
  assert.equal(out.pad, 0);
  strikeAt(B, ...at(0, 0.03), ...at(1, 0.01), 1 / 60, out);
  assert.deepEqual(out, { pad: -1, step: -1, speed: 0 }, 'across, above');
  strikeAt(B, ...at(0, -0.01), ...at(0, 0.03), 1 / 60, out);
  assert.equal(out.pad, -1, 'up from below');
  const gap = (h) => boardPoint(B, B.pads[0].a1 + BOARD.gap / 2, B.pads[0].b0 + 0.05, BOARD.rise + h);
  strikeAt(B, ...gap(0.02), ...gap(-0.02), 1 / 60, out);
  assert.deepEqual([out.pad, out.step], [-1, -1], 'between pads');
  // How far out of a pad's face a point is.
  assert.ok(near(heightOver(B, ...at(3, 0.05)), 0.05, 1e-9) && near(heightOver(B, ...at(3, -REARM)), -REARM, 1e-9));
});

test('a strike as a velocity: the softest still heard, the hardest all of it, a finger counting for more than a stick', () => {
  assert.equal(strikeVelocity(0), 0.06);
  assert.equal(strikeVelocity(10), 1);
  assert.equal(strikeVelocity(10, true), 1);
  assert.ok(strikeVelocity(1, true) > strikeVelocity(1));
  for (let s = 0.4; s < 2.4; s += 0.2) assert.ok(strikeVelocity(s) > strikeVelocity(s - 0.2), `${s}`);
});
