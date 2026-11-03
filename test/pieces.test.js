// What hangs on the walls (config.js's pieces, room.js): where each hangs and its label, what a ray
// meets, where one stands to look and where one comes back, what is wrong with a piece in words,
// each also on the page (On the walls), and a piece's link there and back (common's hallLink).
// An empty room has none, so these hang some in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hallLink, readVisit, wayBack, withoutVisit } from 'common/door.js';
import { ROOM } from '../public/js/config.js';
import { PIECE, castRay, layoutRoom, pieceFront, pieceProblems, pieceSpawn, standable } from '../public/js/room.js';
import { installDom } from './helpers/dom.js';

/** @type {import('../public/js/config.js').Piece[]} */
const PIECES = [
  { id: 'still-life', wall: 'left', at: 2, y: 1.5, width: 1, height: 0.7, image: 'gallery/still-life.jpg', title: 'Still life', description: 'Pears on a blue cloth.' },
  { id: 'studio', wall: 'far', at: 0, y: 1.6, width: 1.2, height: 0.8, image: 'gallery/studio.jpg', title: 'The studio', description: 'A painting studio in VR.', link: 'https://example.org/studio/?load=x#y' },
  { id: 'low', wall: 'right', at: -1, y: 0.6, width: 0.5, height: 0.6, image: 'gallery/low.jpg', title: 'Low', description: 'Hung low.' },
];
const room = (pieces = PIECES) => ({ ...ROOM, size: { width: 6, depth: 7, height: 3.2 }, window: /** @type {'left'} */ ('left'), pieces });
const L = layoutRoom(room());
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
/** What a ray from o towards the point t meets. */
const ray = (o, t) => {
  const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], n = Math.hypot(...d);
  return castRay(L, o[0], o[1], o[2], d[0] / n, d[1] / n, d[2] / n, {});
};
/** Facing yaw, the way ahead on the floor (room.js: yaw 0 faces -z, positive turns left). */
const ahead = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];

test('a piece hangs on its wall, at along it to the right facing it, its label under it, or over it hung low', () => {
  const [a, b, c] = L.pieces;
  // The left wall: facing it (-x), the right is -z.
  assert.deepEqual([a.x, a.z, a.nx, a.nz, a.rx, a.rz], [L.x0, -L.depth / 2 - 2, 1, 0, 0, -1]);
  // The far wall: facing it (-z), the right is +x.
  assert.deepEqual([b.x, b.z, b.nx, b.nz, b.rx, b.rz], [0, L.z1, 0, 1, 1, 0]);
  // The right wall: facing it (+x), the right is +z.
  assert.deepEqual([c.x, c.z, c.nx, c.nz, c.rx, c.rz], [L.x1, -L.depth / 2 - 1, -1, 0, 0, 1]);
  assert.ok(near(a.label.y1, a.y - a.height / 2 - PIECE.frame - PIECE.label.gap));
  assert.ok(near(c.label.y0, c.y + c.height / 2 + PIECE.frame + PIECE.label.gap), 'a low one has its label over it');
  assert.equal(c.label.width, PIECE.label.width);
  assert.ok(near(a.label.width, a.width + 2 * PIECE.frame), 'as wide as its frame, when that is wider');
  assert.equal(b.link, 'https://example.org/studio/?load=x#y');
  assert.equal(a.link, null);
  assert.deepEqual(layoutRoom({ size: ROOM.size, window: ROOM.window }).pieces, []);
});

test('a ray meets a piece on its face, where on its picture from the bottom left as one faces it; past it, the wall', () => {
  const eye = [0, 1.6, -3.5];
  let hit = ray(eye, [0, 1.6, L.z1]);
  assert.equal(hit.kind, 'piece');
  assert.equal(hit.piece, 1);
  assert.ok(near(hit.z, L.z1 + PIECE.picture) && near(hit.u, 0.5) && near(hit.v, 0.5));
  hit = ray(eye, [0.3, 1.8, L.z1 + PIECE.picture]);
  assert.ok(near(hit.u, 0.5 + 0.3 / 1.2) && near(hit.v, 0.5 + 0.2 / 0.8), `${hit.u} ${hit.v}`);
  hit = ray([0, 1.5, -5.5], [L.x0 + PIECE.picture, 1.5, -5.8]);
  assert.deepEqual([hit.kind, hit.piece], ['piece', 0]);
  assert.ok(near(hit.u, 0.8), `on the left wall, further in is to the right: ${hit.u}`);
  hit = ray([0, 1.5, -4.5], [L.x1 - PIECE.picture, 0.6, -4.3]);
  assert.deepEqual([hit.kind, hit.piece], ['piece', 2]);
  assert.ok(near(hit.u, 0.5 + 0.2 / 0.5), `on the right wall, further out is to the right: ${hit.u}`);
  // Its frame is part of it; over it, and beside it, is the wall.
  assert.equal(ray(eye, [0.62, 1.6, L.z1]).kind, 'piece');
  for (const t of [[0, 2.3, L.z1], [0.8, 1.6, L.z1]]) {
    hit = ray(eye, t);
    assert.deepEqual([hit.kind, hit.piece], ['wall', -1], String(t));
  }
});

test('one walks up to stand in front of it, facing it, and comes back out of it facing into the room', () => {
  L.pieces.forEach((p, i) => {
    const f = pieceFront(L, i), s = pieceSpawn(L, i);
    assert.ok(standable(L, f.x, f.z) && standable(L, s.x, s.z), p.id);
    const [fx, fz] = ahead(f.yaw), [sx, sz] = ahead(s.yaw);
    assert.ok(near(fx, -p.nx, 1e-12) && near(fz, -p.nz, 1e-12), `${p.id} faced`);
    assert.ok(near(sx, p.nx, 1e-12) && near(sz, p.nz, 1e-12), `${p.id} faces away`);
    // From in front of it, looking ahead at its height: it.
    const hit = castRay(L, f.x, p.y, f.z, fx, 0, fz, {});
    assert.deepEqual([hit.kind, hit.piece], ['piece', i], p.id);
  });
});

test('what is wrong with a piece, in words; none with these', () => {
  assert.deepEqual(pieceProblems(room()), []);
  assert.deepEqual(pieceProblems(room([])), []);
  const one = (change) => pieceProblems(room([{ ...PIECES[0], ...change }]));
  const cases = [
    [{ id: 'Still Life' }, /id is not/],
    [{ id: 'hallway' }, /the Hallway's/],
    [{ wall: 'near' }, /wall is not one of left, right, far/],
    [{ at: Number.NaN }, /at is not a number/],
    [{ width: 0.05 }, /smaller than 10 cm/],
    [{ image: '/gallery/a.jpg' }, /not a relative address/],
    [{ image: 'https://example.org/a.jpg' }, /not a relative address/],
    [{ title: 'Two\nlines' }, /title is not a line/],
    [{ description: '' }, /description is not a line/],
    [{ link: 'javascript:alert(1)' }, /not an http\(s\) address/],
    [{ link: 'https://example.org/?back=x' }, /door's own parameters/],
    [{ at: 4 }, /runs off its wall/],
    [{ y: 0.3, height: 0.3 }, /skirting/],
    [{ y: 3, height: 0.5 }, /ceiling/],
    [{ at: 0 }, /over the window/],
  ];
  for (const [change, words] of cases) {
    const problems = one(change);
    assert.equal(problems.length, 1, `${JSON.stringify(change)}: ${problems.join('; ')}`);
    assert.match(problems[0], words);
  }
  assert.match(pieceProblems(room([PIECES[0], { ...PIECES[0], at: 2.3, y: 1.6 }])).join('; '), /another piece has its id/);
  assert.match(pieceProblems(room([PIECES[0], { ...PIECES[0], id: 'next', at: 2.3 }])).join('; '), /still-life: it is over next/);
});

test('each is on the page too: On the walls, a link where it leads, a button that walks up to the rest, and what each is', async () => {
  const remove = installDom();
  try {
    const { Overlay } = await import('../public/js/overlay.js');
    const way = { url: 'https://ariamokr.github.io/hallway/?from=x', label: '← Hallway', title: 'Back to the Hallway' };
    const left = [], walked = [];
    const o = new Overlay(room(), way, { pieceHref: (i) => `https://example.org/${i}`, onLeave: (i) => left.push(i) });
    o.onPiece = (i) => walked.push(i);
    assert.ok(o.walls && o.card.findAll((c) => c === o.walls).length === 1);
    assert.equal(o.walls.getAttribute('aria-labelledby'), 'walls-heading');
    const uses = o.walls.findAll((c) => c.className === 'piece');
    assert.deepEqual(uses.map((u) => [u.tagName, u.textContent]), [['BUTTON', 'Still life'], ['A', 'The studio'], ['BUTTON', 'Low']]);
    assert.equal(uses[1].getAttribute('href'), 'https://example.org/1');
    for (const [i, u] of uses.entries()) {
      const about = o.walls.findAll((c) => c.getAttribute('id') === u.getAttribute('aria-describedby'));
      assert.equal(about[0]?.textContent, PIECES[i].description);
      u.fire('click');
    }
    assert.deepEqual([walked, left], [[0, 2], [1]]);
    o.back.fire('click');
    assert.deepEqual(left, [1, -1]);
    // The shared session's room comes and goes on its link, as on the way back's.
    o.pieceHref = (i) => `https://example.org/${i}?room=k3vd-q8hn`;
    o.refreshLinks();
    assert.equal(uses[1].getAttribute('href'), 'https://example.org/1?room=k3vd-q8hn');
    // A room with nothing on its walls has no list.
    assert.equal(new Overlay({ ...ROOM, pieces: [] }, way).walls, null);
  } finally {
    remove();
  }
});

test('the hints name the pictures, and on a TV the dot on one says what OK does there; without pictures they name none', async () => {
  const remove = installDom();
  try {
    const { Overlay } = await import('../public/js/overlay.js');
    const way = { url: 'https://ariamokr.github.io/hallway/?from=x', label: '← Hallway', title: 'Back to the Hallway' };
    const empty = new Overlay({ ...ROOM, pieces: [] }, way, { tv: true });
    const o = new Overlay(room(), way, { tv: true });
    for (const how of /** @type {const} */ (['mouse', 'touch', 'gamepad', 'tv'])) {
      empty.setHint(how, 0);
      o.setHint(how, 0);
      assert.doesNotMatch(empty.hint.textContent, /picture/, how);
      assert.match(o.hint.textContent, /a picture/, how);
    }
    assert.equal(empty.hint.textContent.split('\n')[0], 'Arrows: walk and turn · OK: the drums, the synth, the rack, the keys, the guitar, the doorway or the panel in the middle · Menu or hold Back: the instruments, settings and the shared session');
    assert.match(o.hint.textContent, /^Arrows: walk and turn · OK: the drums, the synth, the rack, the keys, the guitar, the doorway, a picture or the panel in the middle · Menu or hold Back: /);
    // The dot on one: where its link goes, else up to it; off it, the hint as it was.
    o.setAimed(1);
    assert.match(o.hint.textContent, /^Arrows: walk and turn · OK: The studio · Menu or hold Back: .*\nWith TalkBack: /);
    o.setAimed(0);
    assert.match(o.hint.textContent, / · OK: walk up to Still life · /);
    o.setAimed(-1);
    assert.match(o.hint.textContent, / · OK: the drums, the synth, the rack, the keys, the guitar, the doorway, a picture or the panel in the middle · /);
    // Faded, the hint comes back for a piece, stays from one to the next, and fades when the dot leaves.
    o.hideHint();
    o.setAimed(1);
    assert.ok(!o.hint.classList.contains('gone') && o.hint.getAttribute('aria-hidden') === null);
    o.setAimed(2);
    assert.match(o.hint.textContent, / · OK: walk up to Low · /);
    assert.ok(!o.hint.classList.contains('gone'));
    o.setAimed(-1);
    assert.ok(o.hint.classList.contains('gone') && o.hint.getAttribute('aria-hidden') === 'true');
    assert.match(o.hint.textContent, / · OK: the drums, the synth, the rack, the keys, the guitar, the doorway, a picture or the panel in the middle · /, 'still the view’s description');
    // In the card, its own hint, whatever the dot was on.
    o.setHint('tv-card', 0);
    o.setAimed(1);
    assert.match(o.hint.textContent, /Back: walk again$/);
  } finally {
    remove();
  }
});

test("a piece's link: where it leads, with the way back named for the room, and back in front of it, the kept way back kept", () => {
  const here = 'https://ariamokr.github.io/art/?room=k3vd-q8hn&tv=emulate';
  const url = new URL(hallLink({ id: 'studio', url: PIECES[1].link }, { here, name: 'Art', room: 'k3vd-q8hn' }));
  assert.equal(url.origin + url.pathname + url.hash, 'https://example.org/studio/#y');
  assert.equal(url.searchParams.get('load'), 'x');
  const way = wayBack(url.search, 'studio', { origin: url.origin, always: false });
  assert.deepEqual([way?.label, way?.hallway], ['← Art', false]);
  // The place sends the visitor back by it (common's leaveUrl, the room still on it).
  const back = new URL(way.url);
  assert.equal(back.href, 'https://ariamokr.github.io/art/?from=studio&room=k3vd-q8hn');
  // main.js: from=studio is a piece, and the address says no way back, so the one kept for the tab stays.
  const visit = readVisit(back.search);
  const backFrom = back.searchParams.has('back') ? -1 : PIECES.findIndex((p) => p.id === visit.from);
  assert.equal(backFrom, 1);
  assert.equal(withoutVisit(back.href), '/art/?room=k3vd-q8hn');
});
