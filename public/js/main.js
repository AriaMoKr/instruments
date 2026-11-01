// instruments: a room of instruments to play behind the Hallway's door, made from
// RoomTemplateEmpty (a copy changes config.js). Coming in through the door, the visitor carries on
// from how they went through it (the Hallway's link: where in the doorway, which way they faced);
// behind them the doorway glows and shows the hall, and going back through it leads back to the
// Hallway, in front of this room's door (common's door.js). In the room: a floor, four walls, a
// ceiling, the lamps, a window onto common's afternoon sky, and the control panel by the doorway.
// What hangs on its walls (config.js's pieces) may lead to other places, and back to stand in front
// of it again (common's hallLink). The shared session (layersharedsession's together.js) comes in
// here too, and goes back out. In the Android TV app (common's tv.js) it is the 10-foot view, walked
// with the remote.
// The first instrument is the drum board against the far wall (board.js lays it out, kit.js draws
// it): analog drums, each made as it is played (drums.js, into sound.js's Web Audio), with their
// knobs. One walks up to it to play it with the keys, a click or a tap, a gamepad or the remote;
// in VR with sticks, a forefinger or a ray; from a MIDI device (midi.js); and in the card.
// Outside's main.js, without its garden and its book.
import * as THREE from 'three';
import { ROOM } from './config.js';
import { DOOR, doorCrossed, doorSpawn, layoutRoom, pieceSpawn } from './room.js';
import { buildRoom } from './scene.js';
import { Controls } from './controls.js';
import { Overlay } from './overlay.js';
import { layoutBoard } from './board.js';
import { Kit } from './kit.js';
import { Sound } from './sound.js';
import { Drums, movePad, padForNote } from './drums.js';
import { hasMidi, listenMidi, midiGranted } from './midi.js';
import { APP_ID, noticeText, statusText } from './presence.js';
import { setAnisotropy } from './textures.js';
import { renderPreview, renderSocial, previewView, socialView } from './preview.js';
import { hallLink, hallwayViews, keptWay, leaveUrl, readVisit, wayBack, withoutVisit } from 'common/door.js';
import { Fade } from 'common/fade.js';
import { NAV_KEY, loadNav, saveNav } from 'common/nav.js';
import { ACCESS_KEY, Vignette, eyeLift, loadAccess, motionQuery, reduceMotion, saveAccess, watchMotion } from 'common/access.js';
import { Remote, tvMode } from 'common/tv.js';
import { createTogether } from 'layersharedsession/together.js';
import { roomFromUrl } from 'layersharedsession/room.js';

const params = new URLSearchParams(location.search);
// The TV app's page (?tv=emulate: as if, in any browser).
const tv = tvMode();
document.documentElement.classList.toggle('tv', tv);

// Dev: emulate a Quest 3 with IWER (before anything asks navigator.xr). Chromium has a native
// navigator.xr even without a headset, so it is replaced.
let xrDevice = null;
if (params.get('xr') === 'emulate') {
  try {
    const { XRDevice, metaQuest3 } = await import(new URL('../vendor/iwer/iwer.module.js', import.meta.url).href);
    xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime({ forceInstall: true });
    console.info(`${ROOM.id}: IWER WebXR emulation installed (Meta Quest 3)`);
  } catch (err) {
    console.warn(`${ROOM.id}: no WebXR emulation: ${err.message}`);
  }
}

// ── How the visitor came, and the way back ───────────────────────────────────
// What the door added to the address is read once and taken off it. The way back, and the
// doorway's size and glow, stay for this tab (a reload) in sessionStorage. Back from where a piece
// on the walls leads (?from=<its id>, with no way back of its own), the kept way back stays.

const VISIT_KEY = `${ROOM.id}.visit`;
const visit = readVisit(location.search);
const backFrom = params.has('back') ? -1 : ROOM.pieces.findIndex((p) => p.id === visit.from);
const cameThrough = (visit.from !== null && backFrom < 0) || params.has('back');
function kept() {
  try {
    const k = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? 'null');
    const way = k && keptWay(JSON.stringify(k.way));
    return way ? { way, glow: /^#[0-9a-f]{6}$/.test(k.glow) ? k.glow : null, dw: k.dw ?? null, dh: k.dh ?? null } : null;
  } catch {
    return null; // no storage (a private window, blocked site data): the way back lasts this page only
  }
}
const before = cameThrough ? null : kept();
const way = before?.way ?? wayBack(location.search, ROOM.id, { origin: location.origin });
const glow = visit.glow ?? before?.glow ?? ROOM.glow;
const doorWidth = visit.dw ?? before?.dw ?? DOOR.width;
const doorHeight = visit.dh ?? before?.dh ?? DOOR.height;
try {
  sessionStorage.setItem(VISIT_KEY, JSON.stringify({ way, glow, dw: doorWidth, dh: doorHeight }));
} catch {
  // As above.
}
const unvisited = withoutVisit(location.href);
if (unvisited !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', unvisited);
// Where the doorway leads, as short as on the way's label: the Hallway, or the place's own name.
const leadsTo = way.hallway ? 'Hallway' : way.label.replace(/^← /, '');

/**
 * Where piece i on the walls leads, with the way back to this room (common's hallLink: back in
 * front of it, ?from=<its id>), named by its title, and the shared session's room.
 */
function pieceUrl(i) {
  const p = ROOM.pieces[i];
  return hallLink({ id: p.id, url: p.link }, { here: location.href, name: ROOM.title, room: together?.room ?? null });
}

let together = null; // the shared session, made once the scene is (below)
let leftBy = -1; // the piece the visitor went by, else -1 (the doorway)
const overlay = new Overlay(ROOM, way, {
  href: () => leaveUrl(way, together?.room ?? null),
  pieceHref: pieceUrl,
  onLeave: (i) => {
    leftBy = i;
    together?.pause();
  },
  tv,
});

// ── The sound, and the drums in the card ─────────────────────────────────────
// One Web Audio context for every instrument (sound.js), the volume and mute kept for the next
// visit, as each pad's knobs are (drums.js). Browsers let a page sound only once the visitor has
// pressed something on it: the context is made at the first pad played (a walk up to the board
// began with a press), and a press after the page was put away wakes it again (an iPhone wants the
// end of a tap). The drums play from the card, and from a MIDI device, even with no 3D view.

const sound = new Sound({ key: `${ROOM.id}.sound` });
const drums = new Drums(sound, { key: `${ROOM.id}.drums` });
/** The drum board in 3D (kit.js), once the scene is made. @type {Kit | null} */
let kit = null;

/** Pad i is the one the knobs turn: on the board and in the card. */
function select(i) {
  drums.selected = i;
  kit?.select(i, drums.knobs[i]);
  overlay.setKnobs(i, drums.knobs[i]);
}
/** Plays pad i, `velocity` 0…1 loud: heard, lit up on the board, and the one the knobs turn. */
function play(i, velocity) {
  drums.hit(i, velocity);
  if (kit) kit.flash(i, velocity, reduce);
  if (i !== drums.selected) select(i);
}
/** A knob of the pad the knobs turn, set 0…1: heard from its next note on. */
function setKnob(name, value) {
  const i = drums.selected;
  drums.setKnob(i, name, value);
  kit?.setKnobs(drums.knobs[i]);
  overlay.setKnobs(i, drums.knobs[i]);
}
overlay.onPad = play;
overlay.onKnob = setKnob;
overlay.onResetKnobs = () => {
  drums.reset(drums.selected);
  select(drums.selected);
};
overlay.onVolume = (volume) => {
  sound.setVolume(volume);
  overlay.setSound(sound);
};
overlay.onMute = (muted) => {
  sound.setMuted(muted);
  overlay.setSound(sound);
};
overlay.setSound(sound);
select(drums.selected);
for (const type of ['pointerup', 'touchend', 'keydown']) {
  addEventListener(type, () => {
    if (sound.ctx) sound.wake();
  }, { capture: true, passive: true });
}
addEventListener('pagehide', () => sound.sleep());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) sound.sleep();
});

// From a MIDI device (midi.js): asked for with the card's button, or at once when the visitor has
// let this site use MIDI before. Its notes are the General MIDI drums' (drums.js padForNote), on any
// channel. A note isn't a press: until the page has had one, the browser keeps it quiet, and says so.
let midi = null;
let toldQuiet = false;
async function listen() {
  if (midi) return;
  overlay.setMidi('Asking the browser…');
  try {
    midi = await listenMidi((note, velocity) => {
      const i = padForNote(note);
      if (i < 0) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
        if (!toldQuiet) overlay.toast('Click or tap the page once, and the drums are heard', 5);
        toldQuiet = true;
        return;
      }
      play(i, velocity);
    }, (names) => overlay.setMidi(names.length ? `Playing from ${names.join(', ')}` : 'No MIDI device is plugged in: plug one in to play from it'));
  } catch (err) {
    overlay.setMidi(`No MIDI: the browser said ${err instanceof Error ? err.message : err}`);
  }
}
if (hasMidi()) {
  overlay.showMidi();
  overlay.onMidi = listen;
  midiGranted().then((granted) => {
    if (granted) listen();
  });
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (err) {
  overlay.noWebGL('This browser cannot show the room in 3D, but its drums play here in the card. The way back to the Hallway is above.');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// The view, to a screen reader: a picture of the room (what can be done in it is in the card).
renderer.domElement.setAttribute('role', 'img');
const onWalls = ROOM.pieces.map((p) => p.title).join(', ');
renderer.domElement.setAttribute('aria-label', `${ROOM.title}: a floor, four walls and a ceiling, a window onto the afternoon sky, a drum board of twelve pads against the far wall, ${onWalls ? '' : 'and '}the doorway back to the ${leadsTo}${onWalls ? `, and on the walls: ${onWalls}` : ''}`);
document.getElementById('app').append(renderer.domElement);
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
setAnisotropy(anisotropy);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0907');
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 150);
/** A tall screen (a phone held upright) gets a taller view, as in the hallway. */
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  const wide = (2 * Math.atan(Math.tan((60 / 2) * THREE.MathUtils.DEG2RAD) / camera.aspect)) * THREE.MathUtils.RAD2DEG;
  camera.fov = Math.min(100, Math.max(70, wide));
  camera.updateProjectionMatrix();
}
fitCamera();
const rig = new THREE.Group();
rig.name = 'rig';
rig.add(camera);
scene.add(rig);

const L = layoutRoom(ROOM, { doorWidth, doorHeight });
const room = buildRoom(L, { colors: ROOM.colors, skyYaw: ROOM.skyYaw, glow, name: leadsTo, anisotropy });
scene.add(room.group);
// The drum board against the far wall, in the room's light.
const board = layoutBoard(L);
kit = new Kit(board, { lit: room.lit, lightColor: room.lightColor, anisotropy });
scene.add(kit.group);
select(drums.selected);
// Through the doorway, the view the Hallway publishes from its door to here (its views.json); until
// it has loaded, or when there is none (a Hallway without this door yet), its glow and name.
const views = hallwayViews(way, ROOM.id);
if (views) room.loadView([views]);
// The pictures on the walls (their titles until they have loaded): the room is ready with them.
let pictured = false;
room.loadPictures().then(() => {
  pictured = true;
});

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L, board });
// In VR: a stick in each hand that holds a controller, and the hands' joints, for a forefinger to
// play with (kit.js), moving with the rig as the controllers do.
kit.holdSticks(controls.hands);
const fingers = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
rig.add(...fingers);
const nav = loadNav();
controls.setNav(nav);
// The accessibility settings every site on the origin shares (common/access.js, hallway.access):
// less motion (the system's, or the visitor's own), the comfort vignette, seated mode. Applied
// below (applyAccess), once everything they touch is made.
let access = loadAccess();
const motion = motionQuery();
let reduce = reduceMotion(access, motion);
/** With less motion, a fade of a few tenths of a second is a blink. */
const blink = (seconds) => (reduce ? 0.08 : seconds);
const fade = new Fade(camera, 1);
const vignette = new Vignette(camera, access.vignette);

// In through the door: where the visitor went through, turned as they were (and looking as high).
// Back from where a piece leads: in front of it, facing into the room.
{
  const s = backFrom >= 0 ? pieceSpawn(L, backFrom) : doorSpawn(L, visit.dx ?? 0, visit.yaw ?? 0);
  controls.setPose(s.x, s.z, s.yaw, backFrom >= 0 ? 0 : visit.pitch ?? 0);
}

// ── Going back out, or on ────────────────────────────────────────────────────

let leaving = false;
let leaveTimer = 0;
/** Out: back through the doorway, or with a piece's index, where it leads. */
function go(piece = -1) {
  if (leaving) return;
  leaving = true;
  leftBy = piece;
  const url = piece >= 0 ? pieceUrl(piece) : leaveUrl(way, together.room);
  // Leave the shared session now, so the others see the visitor go at once (the link carries its
  // room on): the fade, and then until it is left (half a second at most), give the leaving message
  // time to go out.
  const left = Promise.race([together.pause(), new Promise((r) => setTimeout(r, 500))]);
  fade.to(1, blink(renderer.xr.isPresenting ? 0.3 : 0.4), () => left.then(() => location.assign(url)));
  // Still here a while later (the navigation was stopped or failed): come back in.
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(arrive, 12000);
}

/** In here again (from the back/forward cache, or after a navigation that did not happen): at the doorway, or the piece gone by. */
function arrive() {
  leaving = false;
  clearTimeout(leaveTimer);
  const s = leftBy >= 0 ? pieceSpawn(L, leftBy) : doorSpawn(L);
  controls.setPose(s.x, s.z, s.yaw);
  together.resume();
  fade.to(0, blink(0.6));
}

window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  rereadSettings(); // changed elsewhere on the origin while this page was away
  arrive();
});
// Leaving the page another way (a link, the address bar, closing it): leave the session too.
window.addEventListener('pagehide', () => together.pause());

// On a screen, choosing the doorway walks up to it and through; with less motion, straight through.
controls.onDoor = (how) => {
  if (how === 'xr' || reduce) go();
  else controls.walkInto();
};
// Choosing something on a wall walks up to it (in VR, a step there); one that leads somewhere, then
// on through it, or straight away in VR or with less motion. In the card, its link goes at once.
controls.onPiece = (i, how) => {
  if (!L.pieces[i].link) controls.walkUpTo(i);
  else if (how === 'xr' || reduce) go(i);
  else controls.walkUpTo(i, () => go(i));
};
overlay.onPiece = (i) => controls.walkUpTo(i);

let active = false;
controls.onActivity = () => {
  if (active) return;
  active = true;
  overlay.hideHint();
};
overlay.setHint(tv ? 'tv' : matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');

// ── On a TV, the remote ──────────────────────────────────────────────────────
// common's tv.js: walking, the view holds the focus, the arrows walk and turn (controls.js's keys)
// and OK uses the middle of the view, where the dot is; Menu moves the focus into the card. The app
// asks window.hallwayTV what Back and Menu do (answerApp): Back leaves the card, else it is the
// room's own step back (stepBack), else the app goes back a page, to this room's door in the hallway.

/**
 * Back on a TV while walking: the room's own step back, true when it took one: playing at the drum
 * board, a step away from it. (A step the page's history has an entry for is the app's back, not
 * one of these: common's README, "The TV app".)
 */
function stepBack() {
  if (!controls.playing) return false;
  controls.leaveBoard();
  return true;
}

let remote = null;
if (tv) {
  controls.aimMiddle = true;
  renderer.domElement.setAttribute('aria-describedby', overlay.hint.id);
  // Playing at the board, OK plays the pad the arrows chose, and Menu goes to its knobs.
  remote = new Remote({
    root: overlay.root,
    view: renderer.domElement,
    use: () => (controls.playing ? play(drums.selected, 0.85) : controls.useMiddle()),
    step: stepBack,
    first: () => (controls.playing ? overlay.knobsBox : null),
  });
  remote.onMode = (inCard) => overlay.setHint(inCard ? 'tv-card' : 'tv');
  remote.answerApp(tv);
}

// ── The drum board ───────────────────────────────────────────────────────────
// A pad played: a press on it, its key, a trigger, A or OK on it, and in VR a stick or a forefinger
// coming down on it (which the controller feels). A knob turned: a drag, the wheel, a stick. On a
// TV a pad chosen with the arrows. Walking up to the board to play it, and stepping away.

controls.onPad = play;
controls.onKnob = (k, by) => {
  const name = board.knobs[k].name;
  setKnob(name, drums.knobs[drums.selected][name] + by);
};
controls.onPick = (dc, dr) => select(movePad(drums.selected, dc, dr));
controls.arrowsPick = tv;
// Played clear of what the page shows over the view: the card as it is with nothing open in it (a
// panel opened can be closed again), and the buttons at its foot. On a TV the card down to the
// screen's foot, as the remote opens the drums in it to play.
controls.over = () => {
  const w = innerWidth, h = innerHeight;
  const rect = (r) => ({ x0: (r.left / w) * 2 - 1, x1: (r.right / w) * 2 - 1, y0: 1 - (r.bottom / h) * 2, y1: 1 - (r.top / h) * 2 });
  const card = overlay.card.getBoundingClientRect();
  const bottom = tv ? h : Math.min(card.bottom, overlay.inRoom.querySelector('.actions').getBoundingClientRect().bottom + 12);
  const rects = [rect({ left: card.left, right: card.right, top: card.top, bottom })];
  for (const b of overlay.buttons.children) if (!b.hidden) rects.push(rect(b.getBoundingClientRect()));
  return rects;
};
controls.onPlaying = (on) => {
  overlay.setPlaying(on);
  if (on) sound.wake(); // ready for the first pad: the walk here began with a press
  if (on && remote) {
    overlay.openDrums(true);
    remote.forget(); // Menu goes to the knobs now
  }
};
overlay.onPlay = () => {
  if (controls.playing) controls.leaveBoard();
  else {
    controls.walkToBoard();
    remote?.walk(); // on a TV the arrows choose the pads there, and OK plays them
  }
};
kit.onStrike = (i, velocity, source) => {
  play(i, velocity);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.2 + 0.6 * velocity, 18);
};

// ── Fullscreen, and the gamepad ──────────────────────────────────────────────

const root = document.documentElement;
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function toggleFullscreen() {
  const request = fullscreenElement()
    ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    : (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  Promise.resolve(request).catch((err) => overlay.toast(`Could not change fullscreen: ${err.message}`, 5));
}
function onFullscreenChange() {
  const on = !!fullscreenElement();
  overlay.setFullscreen(on);
  if (on) overlay.toast(controls.hasPad ? 'Esc or B leaves fullscreen' : 'Esc leaves fullscreen', 4);
}
// Browsers that cannot (an iPhone's) do not get the button, nor does the TV app, which is full screen.
if (!tv && (document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
  overlay.showFullscreen(toggleFullscreen);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}
// As in the hallway: the gamepad takes over when used (its hint, and a dot in the middle of the
// view to aim with), and the mouse takes it back. B or Back leaves fullscreen; on a TV, it is the
// remote's Back.
controls.onPadActive = (on) => {
  if (on) overlay.setHint('gamepad');
};
controls.onPadBack = () => {
  if (remote) remote.padBack();
  else if (controls.playing) controls.leaveBoard();
  else if (fullscreenElement()) toggleFullscreen();
};

// ── VR ───────────────────────────────────────────────────────────────────────

const SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
let entering = false;
async function enterVR() {
  if (renderer.xr.isPresenting) {
    await renderer.xr.getSession().end();
    return;
  }
  if (entering || !navigator.xr) return;
  entering = true;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', SESSION_INIT);
    await renderer.xr.setSession(session);
  } catch (err) {
    console.error(err);
    overlay.toast(`Could not start VR: ${err.message}`, 6);
  } finally {
    entering = false;
  }
}
let vrSupported = false;
renderer.xr.addEventListener('sessionstart', () => {
  overlay.setVR(true);
  showPanel();
  sound.wake(); // ready for the drums: entering VR was a press
});
renderer.xr.addEventListener('sessionend', () => {
  overlay.setVR(false);
  showPanel();
  kit.endXR();
});
// Not on a TV, which has no headset (nor, so far, a WebXR in its WebView): the panel says so.
if (!tv) navigator.xr?.isSessionSupported?.('immersive-vr').then((ok) => {
  vrSupported = ok;
  showPanel();
  if (ok) overlay.showVR(enterVR);
}, () => {});
// Walking in from the Hallway's VR (Quest Browser): the browser grants this page a session without
// a click, for about 5 s and only within one origin (the hallway's README, "Linking back"). The
// inline script in index.html notes a grant made before this module ran.
const takeGranted = () => {
  if (!renderer.xr.isPresenting) enterVR();
};
if (!tv) {
  if (window.roomXrGranted) takeGranted();
  navigator.xr?.addEventListener?.('sessiongranted', takeGranted);
}

// ── The control panel on the wall (and the same choices in the card) ─────────

function showPanel() {
  room.panel.set({
    vr: renderer.xr.isPresenting ? 'exit' : vrSupported ? 'enter' : 'none',
    move: nav.move,
    turn: nav.turn,
    motion: access.motion,
    vignette: access.vignette,
    seated: access.seated,
    room: together?.room ?? null,
    link: together?.inviteLink.replace(/^https?:\/\//, '') ?? '',
    status: together?.active ? statusText(together.company(), together.condition()) : '',
  });
  overlay.setChoices(nav, access);
  overlay.setSession(!!together?.room);
}
showPanel();
/** Starts a shared session, or leaves the one this is in. */
function toggleSession() {
  if (together.room) {
    together.stop();
    overlay.toast('You left the shared session');
  } else {
    together.start();
    overlay.toast(tv ? 'Shared session started: the card (Menu) shows the link that brings others in here' : 'Shared session started: Copy invite link to bring others in here', 5);
  }
}
/** A VR movement choice ('move' or 'turn'), kept for here and the hallway (common/nav.js). */
function choose(key, value) {
  nav[key] = value;
  controls.setNav(nav);
  saveNav(nav);
  showPanel();
}
controls.onPanel = (id) => {
  if (id === 'vr') {
    if (renderer.xr.isPresenting || vrSupported) enterVR(); // enters, or exits when in VR
    return;
  }
  if (id === 'session') {
    toggleSession();
    return;
  }
  const [key, value] = id.split(':');
  if (key === 'motion') setAccess({ motion: value });
  else if (key === 'vignette' || key === 'seated') setAccess({ [key]: value === 'on' });
  else choose(key, value);
};
overlay.onSession = toggleSession;
overlay.onNav = choose;
overlay.onAccess = (change) => setAccess(change);
// A teleport in VR blinks: a moment of black hides the jump.
controls.onTeleport = (move) => {
  if (leaving || !renderer.xr.isPresenting) {
    move();
    return;
  }
  fade.to(1, 0.08, () => {
    move();
    fade.to(0, blink(0.2));
  });
};

// ── The shared session ───────────────────────────────────────────────────────
// layersharedsession's together.js: peer to peer over WebRTC (Trystero, loaded only when a session
// starts). Its room is in the address (?room=), so the address is the invitation; the Hallway's
// door carries it in and the doorway back carries it out (leaveUrl), so the visitor stays in it.
// This page is ROOM.id in the session; the others in here are drawn by the layer's avatars.js.

together = createTogether({ appId: APP_ID, page: ROOM.id, camera, renderer, hands: () => controls.hands, avatars: { parent: scene } });
together.on('change', () => {
  showPanel();
  overlay.setInvite(together.active ? together.inviteLink : '');
  overlay.setTogether(together.active, together.active ? statusText(together.company(), together.condition()) : '', together.self);
  overlay.refreshLinks();
});
overlay.onName = (name) => together.setName(name);
// The session's notices (someone joined, came in, left, waved), in the room's words.
together.on('notice', (notice) => {
  const text = noticeText(notice, ROOM.id);
  if (text) overlay.toast(text, 4);
});
// A wave: the Wave button, or a controller's grip in VR (which pulses, so the waver feels it go).
overlay.onWave = () => {
  if (together.wave()) overlay.toast('You waved', 2);
};
controls.onSqueeze = (hand) => {
  if (together.wave()) hand.source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.6, 60);
};
// An invite link, or the Hallway's door, names the room: join it.
const invitedRoom = roomFromUrl(location.href);
if (invitedRoom) together.start(invitedRoom);

// ── Accessibility (common/access.js) ─────────────────────────────────────────

/**
 * The settings as they are now: with less motion the walks jump (controls), the fades blink
 * (blink), a wave doesn't bob, the doorway's veil holds still (the frame loop's time) and the page's
 * own transitions stop (style.css .reduce-motion); the vignette as the visitor wants it; seated
 * mode's lift in VR.
 */
function applyAccess() {
  reduce = reduceMotion(access, motion);
  controls.reduceMotion = together.reduceMotion = reduce;
  document.documentElement.classList.toggle('reduce-motion', reduce);
  vignette.enabled = access.vignette;
  controls.setEyeLift(eyeLift(access));
  showPanel();
}
/** A setting changed, on the panel or in the card: applied, and kept for every site on the origin. */
function setAccess(change) {
  access = { ...access, ...change };
  saveAccess(access); // false when storage is blocked: they then last this visit
  applyAccess();
}
/** The settings and the movement choice again, as another page on the origin (the hallway) left them. */
function rereadSettings() {
  access = loadAccess();
  Object.assign(nav, loadNav());
  controls.setNav(nav);
  applyAccess();
}
applyAccess();
watchMotion(applyAccess, motion); // the system's setting, followed with motion 'system'
addEventListener('storage', (e) => {
  if (e.key === ACCESS_KEY || e.key === NAV_KEY || e.key === null) rereadSettings();
});

// ── The frame loop ───────────────────────────────────────────────────────────

const head = new THREE.Vector3();
let last = performance.now();
let time = 0; // what moves on its own (the doorway's veil) goes by this

function step(dt) {
  if (!reduce) time += dt;
  controls.update(dt);
  vignette.update(dt, controls.moveSpeed, controls.turnRate, renderer.xr.isPresenting);
  camera.getWorldPosition(head);
  room.update(time, dt, head, controls.hoverDoor);
  together.update(performance.now());
  room.panel.setHover(controls.hoverPanel);
  // The board: in VR its sticks and the forefingers (after the controls, which moved the hands),
  // the pad pointed at, and the pads' glow.
  if (renderer.xr.isPresenting) kit.updateXR(controls.hands, fingers, dt);
  kit.hover(controls.hoverPad);
  kit.update(dt);
  // The dot: a gamepad's aim, or on a TV the remote's OK while walking (playing, the arrows choose a pad).
  overlay.setAim((controls.padActive || (remote !== null && !remote.inCard && !controls.playing)) && !renderer.xr.isPresenting, !!controls.hover);
  // On a TV, walking, the hint says what OK does with the dot on something on the walls.
  if (remote) overlay.setAimed(remote.inCard ? -1 : controls.hoverPiece);
  if (!leaving && doorCrossed(L, head.x, head.z)) go();
  fade.update(dt);
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  step(Math.min(0.1, (now - last) / 1000));
  last = now;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

fade.to(0, blink(0.8));

// For scripted testing, and tools/preview.mjs. A hidden page gets no animation frames: drive it with tick().
window.__room = {
  THREE, renderer, scene, camera, rig, room, layout: L, controls, overlay, fade, vignette, xrDevice, go, enterVR, together, remote, tv, way, visit, setAccess,
  sound, drums, board, kit, play, select, setKnob,
  /** The accessibility settings now, and whether motion is reduced. */
  get access() {
    return { ...access, reduce };
  },
  /** The picture the hallway's doorway to here shows (preview.js), as a data: URL, with how it is hung. */
  preview(quality = 0.9) {
    return { jpeg: renderPreview(renderer, scene, camera, { hide: [fade.mesh, vignette.mesh] }).toDataURL('image/jpeg', quality), params: previewView().params };
  },
  /** The picture for link previews (preview.js), as a data: URL, with where it is taken from. */
  social(quality = 0.88) {
    return { jpeg: renderSocial(renderer, scene, camera, L, { hide: [fade.mesh, vignette.mesh] }).toDataURL('image/jpeg', quality), view: socialView(L) };
  },
  tick(dt = 1 / 60, n = 1) {
    for (let i = 0; i < n; i++) step(dt);
    renderer.render(scene, camera);
  },
  /** Built, with the pictures on the walls loaded (or given up on). */
  get ready() {
    return pictured;
  },
};
