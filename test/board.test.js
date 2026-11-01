// The drum board (board.js): where it stands and what is on its top, what a ray meets on it, where
// one may walk round it, where one stands to play it (all of it in view on a screen, a desktop's or
// a phone's; in reach in VR), and a stick's tip or a finger coming down on a pad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { EYE, MARGIN, layoutRoom } from '../public/js/room.js';
import {
  BOARD, REARM, boardBlocks, boardFront, boardPoint, boardStand, clampBoard, heightOver, hitBoard, knobAt, layoutBoard, padAt,
  strikeAt, strikeVelocity,
} from '../public/js/board.js';
import { COLUMNS, KNOBS, PADS, ROWS } from '../public/js/drums.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const blank = () => ({ t: 0, kind: '', x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, u: 0, v: 0, walkable: true, piece: -1, pad: -1, knob: -1 });
/** What a ray from o towards the point t meets on the board, else null. */
function ray(o, t, within = Infinity) {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d), out = blank();
  return hitBoard(B, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, out, within) ? out : null;
}
/** The middle of pad i's face, and of knob k's top. */
const padMiddle = (i) => boardPoint(B, (B.pads[i].a0 + B.pads[i].a1) / 2, (B.pads[i].b0 + B.pads[i].b1) / 2, BOARD.rise);
const knobTop = (k) => boardPoint(B, B.knobs[k].a, B.knobs[k].b, BOARD.knob.h);

test('it stands against the middle of the far wall, with room to walk round it', () => {
  assert.ok(near(B.zBack, L.z1 + BOARD.wall));
  assert.ok(near(B.x0, -B.x1));
  assert.ok(B.x0 - BOARD.keep > L.x0 + MARGIN + 0.3 && B.x1 + BOARD.keep < L.x1 - MARGIN - 0.3, 'a way past it on either side');
  assert.ok(B.zFront < L.z1 + L.depth / 2, 'in the far half of the room');
  assert.ok(near(B.zFront - B.zBack, B.length * Math.cos(BOARD.tilt)));
  // Its top: from its front edge, leaning back and up.
  assert.deepEqual(boardPoint(B, 0, 0), B.origin);
  assert.ok(near(boardPoint(B, 0, B.length)[1], B.top) && B.top > B.front);
  assert.ok(B.front > 0.75 && B.top < 1.2, 'at the height of a table, a hand low');
  const n = B.normal, u = B.up;
  assert.ok(near(Math.hypot(...n), 1) && near(Math.hypot(...u), 1) && near(n[1] * u[1] + n[2] * u[2], 0));
  assert.ok(n[2] > 0, 'it faces the player a little');
});

test('the pads in their rows and columns, row 0 nearest, apart and on the top; behind them the knobs and the display', () => {
  for (const [i, p] of PADS.entries()) {
    const q = B.pads[i];
    assert.ok(near(q.a1 - q.a0, BOARD.pad) && near(q.b1 - q.b0, BOARD.pad));
    assert.ok(q.a0 >= BOARD.margin - 1e-9 && q.a1 <= B.width - BOARD.margin + 1e-9 && q.b0 >= BOARD.margin - 1e-9 && q.b1 < B.strip.b0, p.id);
    for (const [j, r] of PADS.entries()) {
      if (r.col === p.col + 1 && r.row === p.row) assert.ok(near(B.pads[j].a0 - q.a1, BOARD.gap), `${p.id}, then ${r.id} to its right`);
      if (r.row === p.row + 1 && r.col === p.col) assert.ok(near(B.pads[j].b0 - q.b1, BOARD.gap), `${p.id}, then ${r.id} beyond it`);
    }
    assert.equal(padAt(B, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2), i);
  }
  assert.equal(padAt(B, B.pads[0].a1 + BOARD.gap / 2, B.pads[0].b0 + 0.01), -1, 'between two');
  assert.equal(B.knobs.length, KNOBS.length);
  B.knobs.forEach((k, n) => {
    assert.equal(k.name, KNOBS[n]);
    assert.ok(k.b > B.strip.b0 && k.b < B.strip.b1 && k.a + BOARD.knob.r < B.width);
    assert.ok(k.a - BOARD.knob.r > B.display.a1, 'right of the display');
    assert.equal(knobAt(B, k.a, k.b), n);
    if (n) assert.ok(near(k.a - B.knobs[n - 1].a, BOARD.knob.spacing));
  });
  assert.ok(B.display.a1 - B.display.a0 > 0.25, 'room for a pad\'s name');
  assert.ok(B.strip.b1 < B.length && near(B.width, 2 * BOARD.margin + COLUMNS * BOARD.pad + (COLUMNS - 1) * BOARD.gap));
  assert.ok(B.pads.every((q) => q.b1 <= BOARD.margin + ROWS * BOARD.pad + (ROWS - 1) * BOARD.gap + 1e-9));
});

test('a ray meets the pad it points at (where on it), a knob, the rest of the board, its front and its sides', () => {
  const eye = [0, EYE, B.zFront + 0.6];
  for (const i of PADS.keys()) {
    const h = ray(eye, padMiddle(i));
    assert.deepEqual([h?.kind, h?.pad, h?.knob], ['pad', i, -1], PADS[i].id);
    assert.ok(near(h.u, 0.5, 1e-6) && near(h.v, 0.5, 1e-6), `${h.u} ${h.v}`);
    assert.equal(h.walkable, false);
  }
  // A pad's front left corner is u, v 0, 0.
  const q = B.pads[5];
  const corner = ray(eye, boardPoint(B, q.a0 + 0.001, q.b0 + 0.001, BOARD.rise));
  assert.ok(corner.u < 0.01 && corner.v < 0.01);
  // The knobs: a ray on the knob's top meets the top's plane at its foot, a little nearer.
  for (const k of B.knobs.keys()) {
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
/** The board's top outline, the knobs' height over it, as a ring of points. */
const outline = [];
for (const [a0, b0, a1, b1] of [[0, 0, 1, 0], [1, 0, 1, 1], [1, 1, 0, 1], [0, 1, 0, 0]]) {
  for (let i = 0; i < 40; i++) outline.push(boardPoint(B, (a0 + ((a1 - a0) * i) / 40) * B.width, (b0 + ((b1 - b0) * i) / 40) * B.length, BOARD.knob.h));
}
/** A page element's box (CSS pixels) in the view's terms. */
const box = (w, h, left, top, right, bottom) => ({ x0: (left / w) * 2 - 1, x1: (right / w) * 2 - 1, y0: 1 - (bottom / h) * 2, y1: 1 - (top / h) * 2 });

test('on a screen one plays it from where all of its top is in view, a desktop near and a phone held upright further back', () => {
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
  assert.ok(near(at.desktop.z, B.zFront + BOARD.keep), 'as near as one may');
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
    assert.ok(!boardBlocks(B, f.x, f.z) && f.z < B.zFront + 2, `${name}: near enough to play, ${f.z - B.zFront}`);
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

test('in VR one stands at arm\'s length, a stick reaching the far pads', () => {
  const s = boardStand(B);
  assert.ok(!boardBlocks(B, s.x, s.z) && s.yaw === 0 && near(s.x, 0));
  // Shoulders a little below the eye, an arm and a stick of reach.
  const shoulder = [0, EYE - 0.25, s.z];
  for (const i of PADS.keys()) {
    const p = padMiddle(i);
    assert.ok(Math.hypot(p[0] - shoulder[0], p[1] - shoulder[1], p[2] - shoulder[2]) < 0.65 + 0.36, PADS[i].id);
  }
});

test('a tip coming down on a pad strikes it, as fast as it was going; across it, up, or between pads, it does not', () => {
  const at = (i, h) => {
    const q = B.pads[i];
    return boardPoint(B, (q.a0 + q.a1) / 2, (q.b0 + q.b1) / 2, BOARD.rise + h);
  };
  const out = { pad: 0, speed: 0 };
  for (const i of PADS.keys()) {
    const [f, t] = [at(i, 0.03), at(i, -0.01)];
    strikeAt(B, ...f, ...t, 1 / 60, out);
    assert.equal(out.pad, i, PADS[i].id);
    assert.ok(near(out.speed, 0.04 * 60, 1e-6), `${out.speed}`);
  }
  // Where it crossed the face says which pad, not where it ended (here, past the pad's edge).
  const f = at(0, 0.02);
  const cross = boardPoint(B, B.pads[0].a1 - 0.035, (B.pads[0].b0 + B.pads[0].b1) / 2, BOARD.rise);
  strikeAt(B, f[0], f[1], f[2], 2 * cross[0] - f[0], 2 * cross[1] - f[1], 2 * cross[2] - f[2], 1 / 60, out);
  assert.equal(out.pad, 0);
  strikeAt(B, ...at(0, 0.03), ...at(1, 0.01), 1 / 60, out);
  assert.deepEqual(out, { pad: -1, speed: 0 }, 'across, above');
  strikeAt(B, ...at(0, -0.01), ...at(0, 0.03), 1 / 60, out);
  assert.equal(out.pad, -1, 'up from below');
  const gap = (h) => boardPoint(B, B.pads[0].a1 + BOARD.gap / 2, B.pads[0].b0 + 0.05, BOARD.rise + h);
  strikeAt(B, ...gap(0.02), ...gap(-0.02), 1 / 60, out);
  assert.equal(out.pad, -1, 'between pads');
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
