// config.js, the one module a room made from this template changes (README, "Making a room from
// this template"): every field in its form, and the page, the package and the door saying the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEX, ID, ROOM, WINDOW_WALLS, hallwayDoor } from '../public/js/config.js';
import { MAX_SIZE, MIN_SIZE, pieceProblems } from '../public/js/room.js';
import { LINK_PARAMS, VISIT_PARAMS, hallwayUrl } from 'common/door.js';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(here, 'public', 'index.html'), 'utf8');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const meta = (p) => html.match(new RegExp(`<meta (?:property|name)="${p}" content="([^"]*)">`))?.[1];
/** Text as it is written in the HTML: & < > and " escaped. */
const asHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('its id is a door id and a page id in a shared session: 1–32 of a–z, 0–9 and -', () => {
  assert.match(ROOM.id, ID);
  assert.notEqual(ROOM.id, 'hallway');
});

test('its name, description and sign are there, on one line each', () => {
  for (const k of ['title', 'description', 'sign']) {
    assert.equal(typeof ROOM[k], 'string', k);
    assert.ok(ROOM[k].trim() && !/\n/.test(ROOM[k]), k);
  }
});

test('it is published at an https address ending in /, which no door parameter is in', () => {
  const u = new URL(ROOM.url);
  assert.equal(u.protocol, 'https:');
  assert.ok(u.pathname.endsWith('/'));
  assert.equal(u.search + u.hash, '');
  for (const k of new Set([...LINK_PARAMS, ...VISIT_PARAMS])) assert.ok(!u.searchParams.has(k));
});

test('its size is in metres, within what the layout takes', () => {
  for (const k of ['width', 'depth', 'height']) {
    assert.ok(Number.isFinite(ROOM.size[k]), k);
    assert.ok(ROOM.size[k] >= MIN_SIZE[k] && ROOM.size[k] <= MAX_SIZE[k], `${k} ${ROOM.size[k]} outside ${MIN_SIZE[k]}…${MAX_SIZE[k]}`);
  }
});

test('its colours and its glow are #rrggbb', () => {
  assert.deepEqual(Object.keys(ROOM.colors).sort(), ['ceiling', 'floor', 'light', 'trim', 'walls']);
  for (const [k, c] of Object.entries(ROOM.colors)) assert.match(c, HEX, k);
  assert.match(ROOM.glow, HEX);
});

test('its window is in a wall a window can be in, and the sky outside it is turned by a yaw in radians', () => {
  assert.ok(WINDOW_WALLS.includes(ROOM.window));
  assert.ok(Number.isFinite(ROOM.skyYaw) && Math.abs(ROOM.skyYaw) <= 2 * Math.PI);
});

test('what hangs on its walls fits there, each with its picture in public/ (none in an empty room)', () => {
  assert.ok(Array.isArray(ROOM.pieces));
  assert.deepEqual(pieceProblems(ROOM), []);
  for (const p of ROOM.pieces) assert.ok(existsSync(join(here, 'public', decodeURIComponent(p.image.split(/[?#]/)[0]))), `${p.id}: ${p.image} is not in public/`);
});

test("its dev server's port is its own: clear of the hallway's, outside's, the shared session's, music's, the template's, art's, video's and arcade's", () => {
  assert.ok(Number.isInteger(ROOM.port) && ROOM.port >= 1024 && ROOM.port <= 65535);
  assert.ok(![8088, 8089, 8090, 8091, 8092, 8093, 8094, 8096, 8098, 8099, 8102].includes(ROOM.port), `${ROOM.port} is another site's`);
});

test('the page says what config.js says: its title, its description and its address, for link previews too', () => {
  assert.equal(html.match(/<title>([^<]*)<\/title>/)[1], asHtml(ROOM.title));
  assert.equal(meta('description'), asHtml(ROOM.description));
  assert.equal(meta('og:title'), asHtml(ROOM.title));
  assert.equal(meta('og:site_name'), asHtml(ROOM.title));
  assert.equal(meta('og:description'), asHtml(ROOM.description));
  assert.equal(meta('twitter:title'), asHtml(ROOM.title));
  assert.equal(meta('twitter:description'), asHtml(ROOM.description));
  assert.equal(meta('og:url'), ROOM.url);
  // Without JavaScript, the way back is to the Hallway, in front of this room's door.
  const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
  assert.ok(noscript.includes(`href="${hallwayUrl(ROOM.id)}"`));
  assert.ok(noscript.includes(`<h1>${asHtml(ROOM.title)}</h1>`));
});

test('the package is named for the room and points at its page', () => {
  assert.equal(pkg.name, ROOM.id);
  assert.equal(pkg.homepage, ROOM.url);
});

test("its door in the Hallway is a complete entry of the Hallway's environments.js", () => {
  const e = hallwayDoor();
  assert.equal(e.id, ROOM.id);
  assert.equal(e.title, new URL(ROOM.url).pathname.split('/')[1]); // the repository's name
  assert.equal(e.subtitle, ROOM.description); // the plaque by the door: the page's description, word for word
  assert.equal(e.sign, ROOM.sign);
  assert.equal(e.url, ROOM.url);
  assert.equal(e.preview, `${ROOM.url}hallway-preview.jpg`);
  assert.equal(e.color, ROOM.glow);
});
