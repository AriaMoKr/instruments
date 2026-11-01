// Builds the room: the floor, four walls and the ceiling, as a few merged meshes with their light
// baked into the vertices (bake.js: the lamps, the window's daylight and the doorway's glow), the
// wood round them (skirting, the doorway's and the window's casings, the panel's frame), the lamps,
// the window onto common's afternoon sky (sky.js, turned by config.js's skyYaw), the doorway back
// with common's portal in it, the control panel beside it, and what hangs on the walls (config.js's
// pieces: framed pictures, their labels). The doorway shows the view the Hallway publishes out of
// its door to here (common's README, "The view from your door"), or its glow and the name of where
// it leads until that has loaded, or when there is none.
import * as THREE from 'three';
import { Builder } from './builder.js';
import { bake, boxOcclusion, lightAt } from './bake.js';
import { FLOOR_TILE, WALL_TILE, ceilingTexture, floorTexture, labelAtlas, pictureFallback, previewFallback, wallTexture } from './textures.js';
import { ControlPanel } from './panel.js';
import { PIECE } from './room.js';
import { viewParams } from 'common/door.js';
import { openingGeometry, placePortal, portalMaterial, setView } from 'common/portal.js';
import { SUN_DIR, skyColor, skyMaterial, skyTexture } from 'common/sky.js';

const lin = (hex) => {
  const c = new THREE.Color(hex); // three converts sRGB hex to its linear working space
  return [c.r, c.g, c.b];
};

/** The window's daylight: common's sky a little over the horizon, as the hallway's end window has it. */
const DAYLIGHT = (() => {
  const el = (12 * Math.PI) / 180;
  const [r, g, b] = skyColor(el, -Math.cos(el) * SUN_DIR[2] + Math.sin(el) * SUN_DIR[1]);
  const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
})();

/** The picture of its own the doorway shows first, hung as the hallway hangs its doorways' (its hall.js PICTURE). */
const PICTURE = { depth: 2.4, pictureHeight: 3.0, eye: 1.6, horizon: 0.56 };

/**
 * A wall's own frame: `a` along it (world x on the doorway's and the far wall, z on the side
 * walls), y up, `d` out from it into the room. at(a, y, d) is a point in the world, by(da, dy, dd)
 * a direction, and yaw the turn that faces something made facing +z into the room.
 */
function wallFrame(L, wall) {
  const [A, D, base] = {
    near: [[1, 0, 0], [0, 0, -1], [0, 0, 0]],
    far: [[1, 0, 0], [0, 0, 1], [0, 0, L.z1]],
    left: [[0, 0, 1], [1, 0, 0], [L.x0, 0, 0]],
    right: [[0, 0, 1], [-1, 0, 0], [L.x1, 0, 0]],
  }[wall];
  const by = (da, dy, dd) => [A[0] * da + D[0] * dd, dy, A[2] * da + D[2] * dd];
  /** @returns {[number, number, number]} */
  const at = (a, y, d) => {
    const v = by(a, y, d);
    return [base[0] + v[0], v[1], base[2] + v[2]];
  };
  return { at, by, normal: D, yaw: Math.atan2(D[0], D[2]), uv: (p) => [(A[0] ? p[0] : p[2]) / WALL_TILE, p[1] / WALL_TILE] };
}

/**
 * @param {object} L the room's layout (room.js layoutRoom)
 * @param {object} o
 * @param {{ floor: string, walls: string, ceiling: string, trim: string, light: string }} o.colors config.js's
 * @param {number} o.skyYaw how the sky turns outside the window (config.js)
 * @param {string} o.glow the doorway's colour, '#rrggbb'
 * @param {string} o.name where the doorway leads, for its picture until the view has loaded
 * @param {number} [o.anisotropy] the textures' anisotropic filtering, 1 (none) up to the renderer's most
 */
export function buildRoom(L, { colors, skyYaw, glow, name, anisotropy = 1 }) {
  const group = new THREE.Group();
  group.name = 'room';
  const { width: W, depth: Dp, height: H, x0, x1, z1 } = L;
  const dw = L.door.width, dh = L.door.height, R = L.door.reveal;
  const TRIM = lin(colors.trim);
  const DARK = TRIM.map((c) => c * 0.55);

  // Light, baked into every vertex below.
  const light = lin(colors.light);
  const lights = L.lamps.map((l) => ({ p: [l.x, H - 0.3, l.z], c: light, i: 1.3, r: 2.6, wrap: 0.2 }));
  const win = L.window, wf = wallFrame(L, win.wall);
  lights.push({ p: wf.at(win.along, (win.bottom + win.top) / 2, 0.35), c: DAYLIGHT, i: 1.3, r: 1.9, wrap: 0.25 });
  lights.push({ p: [0, 1.15, 0.35], c: lin(glow), i: 1.4, r: 0.9, wrap: 0.3 });
  const lighting = { lights, sky: lin('#b3aea2'), ground: lin('#7d7466') };
  const occlusion = boxOcclusion({ x0, x1, y0: 0, y1: H, z0: z1, z1: 0 });
  const lit = (builder) => bake(builder, lighting, occlusion).toGeometry();
  const lightColor = (p, n) => {
    const c = lightAt(p, n, lighting);
    return new THREE.Color(c[0], c[1], c[2]);
  };
  const add = (geometry, material, meshName) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = meshName;
    group.add(mesh);
    return mesh;
  };

  // The floor, and the threshold in the doorway's reveal.
  const floor = new Builder();
  floor.quad([x0, 0, 0], [W, 0, 0], [0, 0, z1], { normal: [0, 1, 0], seg: 0.3, uv: (p) => [p[0] / FLOOR_TILE, p[2] / FLOOR_TILE], albedo: lin(colors.floor) });
  add(lit(floor), new THREE.MeshBasicMaterial({ map: floorTexture(), vertexColors: true }), 'floor');

  // The walls, floor to ceiling, with the doorway and the window cut out of theirs.
  const walls = new Builder();
  const wallAlbedo = lin(colors.walls);
  const holes = { near: [{ a0: -dw / 2, a1: dw / 2, y0: 0, y1: dh }], far: [], left: [], right: [] };
  holes[win.wall].push({ a0: win.along - win.width / 2, a1: win.along + win.width / 2, y0: win.bottom, y1: win.top });
  const spans = { near: [x0, x1], far: [x0, x1], left: [z1, 0], right: [z1, 0] };
  for (const wall of ['near', 'far', 'left', 'right']) {
    const f = wallFrame(L, wall);
    const [a0, a1] = spans[wall];
    const cuts = [...new Set([a0, a1, ...holes[wall].flatMap((h) => [h.a0, h.a1])])].sort((p, q) => p - q);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const aa = cuts[i], ab = cuts[i + 1];
      const over = holes[wall].filter((h) => h.a0 <= aa + 1e-6 && h.a1 >= ab - 1e-6).sort((p, q) => p.y0 - q.y0);
      let y = 0;
      for (const h of [...over, { y0: H, y1: H }]) {
        if (h.y0 > y + 1e-6) walls.quad(f.at(aa, y, 0), f.by(ab - aa, 0, 0), [0, h.y0 - y, 0], { normal: f.normal, uv: f.uv, seg: 0.3, albedo: wallAlbedo });
        y = Math.max(y, h.y1);
      }
    }
  }
  add(lit(walls), new THREE.MeshBasicMaterial({ map: wallTexture(), vertexColors: true }), 'walls');

  // The ceiling.
  const ceiling = new Builder();
  ceiling.quad([x0, H, z1], [W, 0, 0], [0, 0, Dp], { normal: [0, -1, 0], seg: 0.3, uv: (p) => [p[0] / WALL_TILE, p[2] / WALL_TILE], albedo: lin(colors.ceiling) });
  add(lit(ceiling), new THREE.MeshBasicMaterial({ map: ceilingTexture(), vertexColors: true }), 'ceiling');

  // The wood: everything untextured, one mesh. A box given in a wall's frame (a, y, d) goes into the world's.
  const trim = new Builder();
  const box = (f, lo, hi, albedo = TRIM, skip = []) => {
    const p = f.at(...lo), q = f.at(...hi);
    trim.box([Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], { albedo, skip });
  };
  const near = wallFrame(L, 'near');
  // The skirting, round the walls but the doorway.
  const SKIRT = 0.12, CASING = 0.1;
  for (const wall of ['near', 'far', 'left', 'right']) {
    const f = wallFrame(L, wall);
    const [a0, a1] = spans[wall];
    const runs = wall === 'near' ? [[a0, -dw / 2 - CASING], [dw / 2 + CASING, a1]] : [[a0, a1]];
    for (const [ra, rb] of runs) box(f, [ra, 0, 0], [rb, SKIRT, 0.02], TRIM, ['-y']);
  }
  // The doorway: its lining as deep as the wall, a threshold, and the casing round it.
  trim.quad([-dw / 2, 0, 0], [0, 0, R], [0, dh, 0], { normal: [1, 0, 0], albedo: TRIM });
  trim.quad([dw / 2, 0, 0], [0, 0, R], [0, dh, 0], { normal: [-1, 0, 0], albedo: TRIM });
  trim.quad([-dw / 2, dh, 0], [dw, 0, 0], [0, 0, R], { normal: [0, -1, 0], albedo: TRIM });
  trim.quad([-dw / 2, 0.004, 0], [dw, 0, 0], [0, 0, R], { normal: [0, 1, 0], albedo: DARK });
  box(near, [-dw / 2 - CASING, 0, 0], [-dw / 2, dh + CASING, 0.03]);
  box(near, [dw / 2, 0, 0], [dw / 2 + CASING, dh + CASING, 0.03]);
  box(near, [-dw / 2 - CASING - 0.02, dh, 0], [dw / 2 + CASING + 0.02, dh + CASING + 0.03, 0.04]);
  // The window: its reveals back to the glass, a sill, the casing round it and its glazing bars.
  {
    const f = wf, a0 = win.along - win.width / 2, a1 = win.along + win.width / 2, D = win.reveal, h = win.top - win.bottom;
    trim.quad(f.at(a0, win.bottom, 0), f.by(0, 0, -D), [0, h, 0], { normal: f.by(1, 0, 0), albedo: wallAlbedo });
    trim.quad(f.at(a1, win.bottom, 0), f.by(0, 0, -D), [0, h, 0], { normal: f.by(-1, 0, 0), albedo: wallAlbedo });
    trim.quad(f.at(a0, win.top, 0), f.by(win.width, 0, 0), f.by(0, 0, -D), { normal: [0, -1, 0], albedo: wallAlbedo });
    trim.quad(f.at(a0, win.bottom, 0), f.by(win.width, 0, 0), f.by(0, 0, -D), { normal: [0, 1, 0], albedo: TRIM });
    box(f, [a0 - CASING, win.bottom - 0.02, 0], [a0, win.top + CASING, 0.03]);
    box(f, [a1, win.bottom - 0.02, 0], [a1 + CASING, win.top + CASING, 0.03]);
    box(f, [a0 - CASING - 0.02, win.top, 0], [a1 + CASING + 0.02, win.top + CASING + 0.03, 0.04]);
    box(f, [a0 - CASING - 0.04, win.bottom - 0.06, 0], [a1 + CASING + 0.04, win.bottom + 0.02, 0.09]);
    const bar = 0.022, back = -D + 0.03;
    box(f, [win.along - bar, win.bottom, back], [win.along + bar, win.top, back + 0.04], DARK);
    box(f, [a0, win.bottom + h * 0.62 - bar, back], [a1, win.bottom + h * 0.62 + bar, back + 0.04], DARK);
  }
  // The lamps' roses on the ceiling.
  for (const l of L.lamps) trim.box([l.x - 0.13, H - 0.025, l.z - 0.13], [l.x + 0.13, H, l.z + 0.13], { albedo: lin(colors.ceiling), skip: ['+y'] });
  // The panel's frame.
  const P = L.panel;
  box(near, [P.x - P.width / 2 - 0.025, P.y - P.height / 2 - 0.025, 0], [P.x + P.width / 2 + 0.025, P.y + P.height / 2 + 0.025, P.depth - 0.004], DARK);
  // What hangs on the walls (room.js placePiece): each picture's frame, and its label's back.
  const PF = PIECE.frame, PD = PIECE.depth, LABEL_D = 0.012;
  for (const p of L.pieces) {
    const f = wallFrame(L, p.wall);
    const a0 = p.along - p.width / 2, a1 = p.along + p.width / 2, y0 = p.y - p.height / 2, y1 = p.y + p.height / 2;
    box(f, [a0 - PF, y0 - PF, 0], [a0, y1 + PF, PD]);
    box(f, [a1, y0 - PF, 0], [a1 + PF, y1 + PF, PD]);
    box(f, [a0, y0 - PF, 0], [a1, y0, PD]);
    box(f, [a0, y1, 0], [a1, y1 + PF, PD]);
    box(f, [p.along - p.label.width / 2, p.label.y0, 0], [p.along + p.label.width / 2, p.label.y1, LABEL_D - 0.001], DARK);
  }
  add(lit(trim), new THREE.MeshBasicMaterial({ vertexColors: true }), 'trim');

  // The lamps: glowing domes under their roses.
  const globe = new THREE.Color(colors.light).lerp(new THREE.Color('#ffffff'), 0.65);
  const domes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: globe }), L.lamps.length);
  domes.name = 'lamps';
  const m = new THREE.Matrix4();
  L.lamps.forEach((l, i) => domes.setMatrixAt(i, m.makeTranslation(l.x, H - 0.025, l.z)));
  group.add(domes);

  // The window's glass: common's sky, at infinity, turned by the room's yaw.
  const glass = new THREE.Mesh(openingGeometry(win.width, win.top - win.bottom), skyMaterial(skyTexture(), { yaw: skyYaw }));
  glass.name = 'window';
  glass.position.set(...wf.at(win.along, win.bottom, -win.reveal));
  glass.rotation.y = wf.yaw;
  group.add(glass);

  // The control panel.
  const panel = new ControlPanel({ panel: P, anisotropy, color: lightColor([P.x, P.y, -0.05], [0, 0, -1]) });
  group.add(panel.mesh);

  // The pictures, a mesh each (an image each), lit as the wall round them is: their titles until
  // their images have loaded (loadPictures), or when they cannot be.
  const pictures = L.pieces.map((p) => {
    const at = [p.x + p.nx * PIECE.picture, p.y, p.z + p.nz * PIECE.picture];
    const material = new THREE.MeshBasicMaterial({ map: pictureFallback(p.title, p.width / p.height), color: lightColor(at, [p.nx, 0, p.nz]) });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.width, p.height), material);
    mesh.name = `piece ${p.id}`;
    mesh.position.set(at[0], at[1], at[2]);
    mesh.rotation.y = Math.atan2(p.nx, p.nz);
    group.add(mesh);
    return { mesh, material };
  });
  // Their labels, all on one canvas, one mesh: the title, and an arrow on one that leads somewhere.
  if (L.pieces.length) {
    const atlas = labelAtlas(L.pieces.map((p) => ({ text: p.link ? `${p.title} →` : p.title, width: p.label.width, height: p.label.y1 - p.label.y0 })));
    atlas.texture.anisotropy = anisotropy;
    const labels = new Builder();
    L.pieces.forEach((p, i) => {
      const w = p.label.width, first = labels.uvs.length;
      // From its left end, facing the wall, to its right, so it faces into the room.
      labels.quad([p.x + p.nx * LABEL_D - (p.rx * w) / 2, p.label.y0, p.z + p.nz * LABEL_D - (p.rz * w) / 2], [p.rx * w, 0, p.rz * w], [0, p.label.y1 - p.label.y0, 0]);
      const [u0, v0, u1, v1] = atlas.rects[i];
      for (let k = first; k < labels.uvs.length; k += 2) {
        labels.uvs[k] = u0 + labels.uvs[k] * (u1 - u0);
        labels.uvs[k + 1] = v0 + labels.uvs[k + 1] * (v1 - v0);
      }
    });
    add(lit(labels), new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }), 'labels');
  }

  /**
   * Loads each piece's picture, by its address relative to the page, cropped from its middle to
   * its frame's shape. Resolves, once each has loaded or failed, to how many loaded.
   */
  async function loadPictures() {
    const loader = new THREE.TextureLoader();
    const done = await Promise.all(L.pieces.map(async (p, i) => {
      try {
        const map = await loader.loadAsync(new URL(p.image, document.baseURI).href);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = anisotropy;
        const k = map.image.width / map.image.height / (p.width / p.height);
        if (k > 1) {
          map.repeat.set(1 / k, 1);
          map.offset.set((1 - 1 / k) / 2, 0);
        } else {
          map.repeat.set(1, k);
          map.offset.set(0, (1 - k) / 2);
        }
        const { material } = pictures[i];
        material.map?.dispose();
        material.map = map;
        return true;
      } catch (err) {
        console.info(`room: no picture for ${p.id} at ${p.image} (${err?.message ?? 'it did not load'})`);
        return false;
      }
    }));
    return done.filter(Boolean).length;
  }

  // The portal in the doorway, at the back of its lining, facing into the room.
  const fallback = previewFallback(name, glow);
  fallback.anisotropy = anisotropy;
  const material = portalMaterial({ map: fallback, width: dw, height: dh, ...PICTURE, color: glow });
  const portal = new THREE.Mesh(openingGeometry(dw, dh), material);
  portal.name = 'portal';
  portal.position.set(0, 0, R);
  portal.rotation.y = Math.PI;
  group.add(portal);
  placePortal(portal);
  let glowing = 0;

  /**
   * Shows the Hallway's view out of its door to here through the doorway: the first of `sources`
   * ({ views: views.json's address, id }) that can be read and checked, in place of the glow and the
   * name. Resolves to which, or null.
   */
  async function loadView(sources) {
    for (const source of sources) {
      try {
        const res = await fetch(source.views, { cache: 'no-cache' });
        const v = res.ok ? viewParams((await res.json())?.views?.[source.id]) : null;
        if (!v) {
          console.info(`room: no view of the door ${source.id} in ${source.views}`);
          continue;
        }
        const map = await new THREE.TextureLoader().loadAsync(new URL(v.image, res.url).href);
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = anisotropy;
        setView(material, map, v);
        fallback.dispose();
        return source;
      } catch (err) {
        console.info(`room: no view through the doorway from ${source.views} (${err.message})`);
      }
    }
    return null;
  }

  return {
    group, portal, panel, glass, pictures, loadView, loadPictures,
    /** The room's light, for what stands in it (kit.js's drum board): baked into a builder's colours, and at a point. */
    lit, lightColor,
    /** Per frame: the veil drifts, and the doorway brightens when pointed at or stood near. */
    update(time, dt, head, hover) {
      const near = head.z > -1.6 && Math.abs(head.x) < 1.4;
      const target = hover ? 1 : near ? 0.45 : 0;
      glowing += (target - glowing) * (1 - Math.exp(-dt * 7));
      material.uniforms.uGlow.value = glowing;
      material.uniforms.uTime.value = time;
    },
  };
}
