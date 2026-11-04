// The link-preview picture of the band (preview.js bandView): taken from a little over eye height in
// front of the instruments, as near as keeps all five desks in it (their tops and panels, their front
// feet and their signs: deskPoints, the guitar's turned into the room) within BAND.fill of its edges,
// looking at the middle of them. Checked through three's own camera, as renderSocial takes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROOM } from '../public/js/config.js';
import { MARGIN, layoutRoom } from '../public/js/room.js';
import { layoutBoard } from '../public/js/board.js';
import { layoutSynth } from '../public/js/synthboard.js';
import { layoutRack } from '../public/js/rackboard.js';
import { layoutKeyboard } from '../public/js/keysboard.js';
import { GUITAR, layoutGuitar, roomXZ } from '../public/js/guitarboard.js';
import { BAND, SOCIAL, bandView, deskPoints } from '../public/js/preview.js';

const L = layoutRoom(ROOM);
const B = layoutBoard(L);
const S = layoutSynth(L, B);
const R = layoutRack(L, S);
const K = layoutKeyboard(L, B, R);
const G = layoutGuitar(L, R, K);
const DESKS = { board: deskPoints(B), synth: deskPoints(S), rack: deskPoints(R), keys: deskPoints(K), guitar: deskPoints(G, (x, z) => roomXZ(G, x, z)) };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("a desk's points: its outline, its front feet on the floor and its sign's corners, the guitar's turned to the right wall", () => {
  for (const [name, points] of Object.entries(DESKS)) {
    for (const [x, y, z] of points) {
      assert.ok(x > L.x0 && x < L.x1 && z > L.z1 && z < 0 && y >= 0 && y < L.height, `${name}: [${x}, ${y}, ${z}] in the room`);
    }
    assert.equal(points.filter(([, y]) => y === 0).length, 2, `${name}: two feet`);
  }
  // The far wall's desks' signs are on the far wall; the guitar's on the right wall, over its desk.
  for (const name of ['board', 'synth', 'rack', 'keys']) assert.equal(DESKS[name].filter(([, , z]) => near(z, L.z1 + 0.012)).length, 4, `${name}: its sign`);
  const sign = DESKS.guitar.filter(([x]) => near(x, L.x1 - GUITAR.sign.out));
  assert.equal(sign.length, 4, "the guitar's sign on the right wall");
  for (const [, , z] of sign) assert.ok(z >= R.zFront && z <= R.zFront + 2, 'beside the rack');
});

test("the band's picture: all five desks in it, from a little over eye height in front of them, as near as keeps them so", () => {
  const points = Object.values(DESKS).flat();
  const v = bandView(points);
  assert.equal(v.fov, BAND.fov);
  assert.equal(v.eye.y, BAND.eye);
  // In the room, in front of the band and short of the doorway's wall.
  assert.ok(v.eye.x > L.x0 + MARGIN && v.eye.x < L.x1 - MARGIN, 'between the side walls');
  assert.ok(v.eye.z > Math.max(...points.map((p) => p[2])) && v.eye.z <= -MARGIN, 'in front of them');
  const camera = new THREE.PerspectiveCamera(v.fov, SOCIAL.width / SOCIAL.height, 0.05, 150);
  camera.position.set(v.eye.x, v.eye.y, v.eye.z);
  camera.lookAt(v.target.x, v.target.y, v.target.z);
  camera.updateMatrixWorld(true);
  const seen = {};
  for (const [name, desk] of Object.entries(DESKS)) {
    seen[name] = desk.map((p) => {
      const at = new THREE.Vector3(...p);
      assert.ok(at.clone().applyMatrix4(camera.matrixWorldInverse).z < 0, `${name}: in front of it`);
      at.project(camera);
      assert.ok(Math.abs(at.x) <= BAND.fill + 1e-9 && Math.abs(at.y) <= BAND.fill + 1e-9, `${name}: [${at.x}, ${at.y}] within ${BAND.fill} of its edges`);
      return at;
    });
  }
  // As near as that allows (stepping back 5 cm at a time): the band reaches nearly to its edges, the
  // keyboard at its left and the guitar at its right, as far either side.
  const all = Object.values(seen).flat(), xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  assert.ok(Math.max(...xs.map(Math.abs)) > BAND.fill - 0.05, 'filling it across');
  assert.ok(near(Math.min(...xs), -Math.max(...xs), 0.08), `as far either side: ${Math.min(...xs)}, ${Math.max(...xs)}`);
  assert.ok(near(Math.min(...ys), -Math.max(...ys), 0.12), `as far above as below: ${Math.min(...ys)}, ${Math.max(...ys)}`);
  assert.ok(Math.min(...seen.keys.map((p) => p.x)) < -0.6 && Math.max(...seen.guitar.map((p) => p.x)) > 0.6, 'the keyboard at the left, the guitar at the right');
});
