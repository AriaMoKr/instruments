// The room's two pictures, which tools/preview.mjs writes to public/:
//   hallway-preview.jpg, the picture the hallway's doorway to here shows (its README, "Adding a
//     door": 2:1, the room seen through the doorway, taken at eye height looking straight ahead,
//     its horizon a little above the middle): the room as one sees it coming in, from where the
//     visitor arrives (room.js layout's spawn), projected onto a picture hung as the hallway hangs
//     its doorways' pictures (its hall.js PICTURE: 2.4 m behind the opening, 3 m high, the horizon
//     at eye height and 56 % up), so through the doorway it looks like the room with some parallax.
//     Outside's preview.js.
//   social.jpg, 1280 × 640, for the link-preview tags (index.html og:image): the band (bandView),
//     from a little over eye height in front of the instruments, all of them in it. An empty room's
//     (socialView) is from the corner across from the doorway, so the doorway and the window are both
//     in it.
import * as THREE from 'three';
import { EYE, MARGIN } from './room.js';
import { boardOutline } from './board.js';

export const PREVIEW = { width: 2048, height: 1024, depth: 2.4, pictureHeight: 3.0, eye: 1.6, horizon: 0.56 };
export const SOCIAL = { width: 1280, height: 640, fov: 60 };
/**
 * The social picture of the band (bandView): how high it is taken from (a little over a visitor's
 * eyes, so that the desks' tops show), how high it looks (degrees) and how near its edges what is in
 * it may come (−1…1 across and up).
 */
export const BAND = { eye: 2.2, fov: 50, fill: 0.9 };

/** Where the hallway's picture is taken from and how wide it looks (the frustum at 1 m), and how it is hung. Pure. */
export function previewView(p = PREVIEW, from = { x: 0, y: 0, z: -0.6 }) {
  const half = (p.pictureHeight * (p.width / p.height)) / 2;
  return {
    eye: { x: from.x, y: from.y + p.eye, z: from.z },
    frustum: { left: -half / p.depth, right: half / p.depth, top: (p.pictureHeight * (1 - p.horizon)) / p.depth, bottom: -(p.pictureHeight * p.horizon) / p.depth },
    params: { depth: p.depth, pictureHeight: p.pictureHeight, eye: p.eye, horizon: p.horizon, aspect: p.width / p.height },
  };
}

/**
 * Where the social picture is taken from, and what it looks at: from near the far wall, off to one
 * side (not so far that the doorway's picture is seen edge on), looking back across the room to the
 * doorway's wall. With the window in a side wall, the side across from it, so the window is in view
 * along with the doorway; with the window in the far wall, from beside the doorway, looking at it.
 * Pure.
 * @param {object} L the room's layout (room.js layoutRoom)
 */
export function socialView(L) {
  const inset = 0.55;
  const side = L.window.wall === 'right' ? -1 : 1; // the camera's side: across from a side window
  if (L.window.wall === 'far') {
    return {
      eye: { x: L.x1 - inset, y: EYE, z: -inset - 0.2 },
      target: { x: L.window.along - L.width * 0.12, y: (L.window.bottom + L.window.top) / 2 - 0.25, z: L.z1 },
    };
  }
  const x = side * Math.min(L.width / 2 - inset, Math.max(L.door.width * 0.8, L.width * 0.15));
  return {
    eye: { x, y: EYE, z: L.z1 + inset },
    target: { x: -side * L.door.width * 0.9, y: L.door.height * 0.55, z: 0 },
  };
}

/**
 * What of a desk the band's picture keeps in it, in the room: its outline (board.js boardOutline: the
 * top and the panel), its front feet and its sign. `turn` takes a point in its own frame into the
 * room's, for a desk laid out as if against the far wall and turned (the guitar's: guitarboard.js
 * roomXZ). Pure.
 * @param {import('./board.js').Desk} D
 * @param {(x: number, z: number) => [number, number]} [turn]
 * @returns {[number, number, number][]}
 */
export function deskPoints(D, turn = (x, z) => [x, z]) {
  const s = D.sign;
  /** @type {[number, number, number][]} */
  const own = [...boardOutline(D, 4), [D.x0, 0, D.zFront], [D.x1, 0, D.zFront], [s.x0, s.y0, s.z], [s.x1, s.y0, s.z], [s.x0, s.y1, s.z], [s.x1, s.y1, s.z]];
  return own.map(([x, y, z]) => {
    const [rx, rz] = turn(x, z);
    return [rx, y, rz];
  });
}

/**
 * The view from (x, y, z) at `points`, turned to the middle of the angles they take up across it and
 * then up it, and whether all of them are within BAND.fill of its edges (`tx`, `ty` the tangents of
 * its half-widths).
 * @param {readonly (readonly number[])[]} points
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} tx
 * @param {number} ty
 */
function aimed(points, x, y, z, tx, ty) {
  let a0 = Infinity, a1 = -Infinity, e0 = Infinity, e1 = -Infinity;
  for (const [px, , pz] of points) {
    const a = Math.atan2(px - x, z - pz); // to the right of straight ahead (−z)
    a0 = Math.min(a0, a);
    a1 = Math.max(a1, a);
  }
  const yaw = (a0 + a1) / 2, sy = Math.sin(yaw), cy = Math.cos(yaw);
  for (const [px, py, pz] of points) {
    const e = Math.atan2(py - y, (px - x) * sy - (pz - z) * cy);
    e0 = Math.min(e0, e);
    e1 = Math.max(e1, e);
  }
  const pitch = (e0 + e1) / 2, sp = Math.sin(pitch), cp = Math.cos(pitch);
  // Ahead, to the right and up, as three's lookAt turns a camera.
  const f = [sy * cp, sp, -cy * cp], r = [cy, 0, sy], u = [-sp * sy, cp, sp * cy];
  const fits = points.every(([px, py, pz]) => {
    const dx = px - x, dy = py - y, dz = pz - z;
    const ahead = dx * f[0] + dy * f[1] + dz * f[2];
    const across = (dx * r[0] + dz * r[2]) / (ahead * tx), up = (dx * u[0] + dy * u[1] + dz * u[2]) / (ahead * ty);
    return ahead > 0 && Math.abs(across) <= BAND.fill && Math.abs(up) <= BAND.fill;
  });
  return { eye: { x, y, z }, target: { x: x + f[0], y: y + f[1], z: z + f[2] }, fits };
}

/**
 * Where the social picture is taken from in a room with instruments in it (`points`, in the room: each
 * desk's deskPoints): from BAND.eye high, in front of the middle of them across the room, as near as
 * keeps all of them in it within BAND.fill of its edges (stepping back towards the doorway's wall, no
 * nearer it than MARGIN), looking at the middle of them. Pure.
 * @param {readonly (readonly number[])[]} points
 * @param {{ fov?: number, aspect?: number }} [o] how high it looks (degrees), and how wide for 1 high
 */
export function bandView(points, { fov = BAND.fov, aspect = SOCIAL.width / SOCIAL.height } = {}) {
  const ty = Math.tan((fov * Math.PI) / 360), tx = ty * aspect;
  let x0 = Infinity, x1 = -Infinity, front = -Infinity;
  for (const [px, , pz] of points) {
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    front = Math.max(front, pz);
  }
  for (let z = front + 0.5; ; z += 0.05) {
    const view = aimed(points, (x0 + x1) / 2, BAND.eye, Math.min(z, -MARGIN), tx, ty);
    if (view.fits || z >= -MARGIN) return { eye: view.eye, target: view.target, fov };
  }
}

/**
 * Renders the scene from `shot` (a camera) into a canvas of its own, as the screen would show it
 * (tone mapped, sRGB): the renderer is resized for it, drawn, read at once, then put back. `hide`
 * is what the viewer has in front of their eyes (the fade, the vignette).
 * @returns {HTMLCanvasElement}
 */
function renderShot(renderer, scene, camera, shot, width, height, hide) {
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
  const shown = hide.map((o) => o.visible);
  for (const o of hide) o.visible = false;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.render(scene, shot);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    return out;
  } finally {
    hide.forEach((o, i) => {
      o.visible = shown[i];
    });
    renderer.setPixelRatio(ratio);
    renderer.setSize(size.x, size.y, false);
    renderer.render(scene, camera);
  }
}

/**
 * The hallway's picture of the room, in a canvas.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {{ hide?: THREE.Object3D[], from?: { x: number, y: number, z: number }, view?: typeof PREVIEW }} [o] what to leave out (as renderShot's), where it is taken from (previewView's), and its size and hanging
 */
export function renderPreview(renderer, scene, camera, { hide = [], from, view = PREVIEW } = {}) {
  const f = previewView(view, from);
  const near = 0.05;
  const shot = new THREE.PerspectiveCamera();
  shot.position.set(f.eye.x, f.eye.y, f.eye.z);
  shot.updateMatrixWorld(true);
  const { left, right, top, bottom } = f.frustum;
  shot.projectionMatrix.makePerspective(left * near, right * near, top * near, bottom * near, near, 150);
  shot.projectionMatrixInverse.copy(shot.projectionMatrix).invert();
  return renderShot(renderer, scene, camera, shot, view.width, view.height, hide);
}

/**
 * The social picture of the room, in a canvas: from `from` (where it is taken from, what it looks at
 * and how high, in degrees: bandView's; an empty room's socialView, as high as `view`'s), `view` its
 * size.
 */
export function renderSocial(renderer, scene, camera, L, { hide = [], view = SOCIAL, from = socialView(L) } = {}) {
  const shot = new THREE.PerspectiveCamera(from.fov ?? view.fov, view.width / view.height, 0.05, 150);
  shot.position.set(from.eye.x, from.eye.y, from.eye.z);
  shot.lookAt(from.target.x, from.target.y, from.target.z);
  shot.updateMatrixWorld(true);
  return renderShot(renderer, scene, camera, shot, view.width, view.height, hide);
}
