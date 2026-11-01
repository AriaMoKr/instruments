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
// in VR with sticks, a forefinger or a ray; from a MIDI device (midi.js); and in the card. Its
// panel is a little modular: a clock (clock.js) whose pulses, through a cable into the drums' clock
// in, step a pattern of sixteen steps for each pad (pattern.js), set on the step keys; and a delay
// (delay.js) any pad's sound can be patched into. The cables (patch.js) are taken from a jack and
// plugged into another, or chosen in the card.
// Beside it the synth (synthboard.js lays it out, synthkit.js draws it): six analog voices, poly or
// mono (synth.js), its knobs and its presets, played with its keys on every device as the board's
// pads are, from a computer's keys and a MIDI keyboard, and in the card.
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
import { Drums, PADS, movePad, padForNote } from './drums.js';
import { CLOCK_OUTS, Clock, TEMPO } from './clock.js';
import { Pattern, stepOf } from './pattern.js';
import { Patch, padForJack } from './patch.js';
import { Delay } from './delay.js';
import { KEYS, Synth, noteName, synthText } from './synth.js';
import { layoutSynth } from './synthboard.js';
import { SynthKit } from './synthkit.js';
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
const clock = new Clock({ key: `${ROOM.id}.clock` });
const pattern = new Pattern({ key: `${ROOM.id}.pattern` });
const patch = new Patch({ key: `${ROOM.id}.patch` });
const delay = new Delay(sound, { key: `${ROOM.id}.delay` });
delay.setTempo(clock.tempo);
/** The drum board in 3D (kit.js), once the scene is made. @type {Kit | null} */
let kit = null;

/** Pad i is the one the knobs turn and the step keys set: on the board and in the card. */
function select(i) {
  drums.selected = i;
  kit?.select(i, drums.knobs[i]);
  overlay.setKnobs(i, drums.knobs[i]);
  showSteps();
}
/** The selected pad's steps, on the step keys and in the card. */
function showSteps() {
  const i = drums.selected;
  kit?.setSteps(pattern.steps[i]);
  overlay.setSteps(i, pattern.steps[i]);
}
/** Step s of the selected pad: it plays there now, or no longer. */
function toggleStep(s) {
  pattern.toggle(drums.selected, s);
  showSteps();
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
overlay.onStep = toggleStep;
overlay.onClearSteps = () => {
  pattern.clear(drums.selected);
  showSteps();
};
overlay.onResetPattern = () => {
  pattern.reset();
  showSteps();
};
select(drums.selected);

// ── The clock, the pattern, the delay and the cables ─────────────────────────
// The clock runs only once started (RUN, Space at the board, a remote's play/pause, Start in the
// card), which wakes the sound. Its pulses are handed out a little ahead by the audio clock
// (clock.js advance), from the frame loop and a timer (a frame may be slow, or not come at all: no
// 3D view, a hidden pane), each falling on a step of the drums if their clock in is patched to an
// output sending it (every pulse, every 2nd, every 4th), whose pads play on that step at its time.
// What a pulse shows (the step playing, the pads lit, RUN's light on the beat) is queued until it is
// heard. A pad patched into the delay's in is connected to it once there is sound (sound.onReady).

/** How many of the clock's pulses make a step of the drums (the output their clock in is patched to), else 0. */
let drumsEvery = 0;
function patchedClock() {
  drumsEvery = CLOCK_OUTS.find((o) => o.id === patch.source('drums.clock'))?.every ?? 0;
}
patchedClock();
/** How hard the pattern plays a pad: on the beat, and between. */
const ON_BEAT = 0.85, OFF_BEAT = 0.7;
// What each pulse shows once heard, in a ring: when it falls, its number, the drums' step (-1 none)
// and the pads it plays (a bit each).
const QUEUED = 64;
const shownAt = new Float64Array(QUEUED), shownPulse = new Int32Array(QUEUED), shownStep = new Int8Array(QUEUED), shownPads = new Uint16Array(QUEUED);
let queueHead = 0, queueTail = 0;
let playhead = -1;

/** Pulse n of the clock, falling at `time` on the audio clock: the drums' step, and queued to be seen. */
function pulse(n, time) {
  let step = -1, pads = 0;
  if (drumsEvery && n % drumsEvery === 0) {
    step = stepOf(n / drumsEvery);
    for (let i = 0; i < PADS.length; i++) {
      if (!pattern.has(i, step)) continue;
      drums.play(i, step % 4 ? OFF_BEAT : ON_BEAT, time);
      pads |= 1 << i;
    }
  }
  if ((queueTail + 1) % QUEUED === queueHead) queueHead = (queueHead + 1) % QUEUED; // full: the oldest goes
  shownAt[queueTail] = time;
  shownPulse[queueTail] = n;
  shownStep[queueTail] = step;
  shownPads[queueTail] = pads;
  queueTail = (queueTail + 1) % QUEUED;
}
/** The pulses due soon handed out (none while the clock is stopped). */
function schedule() {
  const ctx = sound.ctx;
  if (ctx && clock.running) clock.advance(ctx.currentTime, pulse);
}
/** What the pulses heard by now show: the step playing, the pads it played lit, RUN's light on the beat. */
function showPulses() {
  const ctx = sound.ctx;
  if (!ctx) return;
  const heard = ctx.currentTime - (ctx.outputLatency || 0);
  while (queueHead !== queueTail && shownAt[queueHead] <= heard) {
    const s = shownStep[queueHead], pads = shownPads[queueHead];
    if (kit && shownPulse[queueHead] % 4 === 0) kit.beat(reduce);
    if (s >= 0) {
      setPlayhead(s);
      for (let i = 0; i < PADS.length; i++) if (pads & (1 << i)) kit?.flash(i, s % 4 ? OFF_BEAT : ON_BEAT, reduce);
    }
    queueHead = (queueHead + 1) % QUEUED;
  }
  if (!clock.running && queueHead === queueTail) setPlayhead(-1);
}
/** The step playing (-1 none), on the step keys and in the card. */
function setPlayhead(s) {
  if (s === playhead) return;
  playhead = s;
  if (kit) kit.playhead = s;
  overlay.setPlayhead(s);
}
setInterval(() => {
  schedule();
  showPulses();
}, 25);

/** Starts the clock (waking the sound: this is a press), or stops it. */
function toggleClock() {
  if (clock.running) clock.stop();
  else {
    const ctx = sound.wake();
    if (!ctx) {
      overlay.toast('This browser makes no sound', 4);
      return;
    }
    clock.start(ctx.currentTime);
    schedule();
  }
  kit?.setRunning(clock.running);
  overlay.setRunning(clock.running);
}
/** Where the tempo's knob is turned to, 0…1: a turn smaller than a beat a minute adds up. */
let tempoTurn = 0;
/** The tempo, in beats per minute (`turn`: the knob's place, when it was turned). */
function setTempo(bpm, turn = (bpm - TEMPO.min) / (TEMPO.max - TEMPO.min)) {
  tempoTurn = Math.min(1, Math.max(0, turn));
  clock.setTempo(bpm);
  delay.setTempo(clock.tempo);
  kit?.setTempo(clock.tempo);
  overlay.setTempo(clock.tempo);
}
setTempo(clock.tempo);
/** A knob of the delay, set 0…1. */
function setDelayKnob(name, value) {
  delay.setKnob(name, value);
  showDelay();
}
function showDelay() {
  kit?.setDelay(delay.knobs);
  overlay.setDelay(delay.knobs);
}
showDelay();
overlay.onRun = toggleClock;
// A remote's (or a keyboard's) play/pause starts and stops it, wherever the focus is.
addEventListener('keydown', (e) => {
  if (e.key !== 'MediaPlayPause' && e.code !== 'MediaPlayPause') return;
  e.preventDefault();
  if (!e.repeat) toggleClock();
});
overlay.onTempo = (bpm) => setTempo(bpm);
overlay.onDelay = setDelayKnob;
overlay.onResetDelay = () => {
  delay.reset();
  showDelay();
};

/** Pad i's sound into the delay (`on`), or out of it, once there is sound (else, when there is, onReady). */
function feedDelay(i, on) {
  const out = drums.out(i), input = delay.input();
  if (!out || !input) return;
  if (on) out.connect(input);
  else {
    try {
      out.disconnect(input);
    } catch {
      // it wasn't
    }
  }
}
sound.onReady = () => feedDelay(padForJack(patch.source('delay.in')), true);
/** The cables' colours: the clock's amber, and a pad's sound in the pad's colour. */
const CLOCK_CABLE = '#e8a33c', SOUND_CABLE = '#cfc6b8';
const cableColor = (id) => {
  const i = padForJack(id);
  return i >= 0 ? PADS[i].color : patch.jack(id)?.kind === 'audio' ? SOUND_CABLE : CLOCK_CABLE;
};
/** The cables on the board, and in the card. */
function showPatch() {
  if (kit) {
    const jacks = kit.board.panel.jacks, at = (id) => jacks.findIndex((j) => j.id === id);
    kit.setCables(patch.cables().map((c) => ({ from: at(c.from), to: at(c.to), color: cableColor(c.from) })));
  }
  overlay.setPatch(patch);
}
patch.onChange = (to, from, was) => {
  if (to === 'delay.in') {
    feedDelay(padForJack(was), false);
    feedDelay(padForJack(from), true);
  }
  if (to === 'drums.clock') patchedClock();
  showPatch();
};
showPatch();
overlay.onPlug = (input, output) => {
  if (output) patch.plug(output, input);
  else patch.unplug(input);
};
// ── The synth ────────────────────────────────────────────────────────────────
// Six voices into the same sound, its knobs, its preset, Mono and its octave kept for the next visit
// (synth.js). A key held sounds until it is let go: a press on it (on the synth, in the card), a
// computer's key, a MIDI keyboard's, in VR a stick or a forefinger down in it. A click, OK, A or a
// trigger on one plays it a moment. The keys down show on the synth and in the card, and what it
// plays on its display.

const synth = new Synth(sound, { key: `${ROOM.id}.synth` });
/** The synth in 3D (synthkit.js), once the scene is made. @type {SynthKit | null} */
let synthKit = null;
/** The note each key of the synth (from the lowest) sounds while held there, -1 none: the octave may change before it is let go. */
const keyNotes = new Int16Array(KEYS).fill(-1);
let toldNoSound = false;
/** No Web Audio: said once. */
function noSound() {
  if (!toldNoSound) overlay.toast('This browser makes no sound', 4);
  toldNoSound = true;
}
/** A note played until it is let go (noteOff), `velocity` 0…1. */
function noteOn(note, velocity) {
  if (!synth.noteOn(note, velocity)) noSound();
}
/** A note let go. */
function noteOff(note) {
  synth.noteOff(note);
}
/** A note played for a moment (a click, OK, A, a trigger). */
function tapNote(note, velocity = 0.85) {
  if (!synth.tap(note, velocity)) noSound();
}
/** Key k of the synth (from the lowest) held down, as hard as `velocity`, until keyUp(k). */
function keyDown(k, velocity) {
  if (keyNotes[k] >= 0) noteOff(keyNotes[k]);
  keyNotes[k] = synth.lowest + k;
  noteOn(keyNotes[k], velocity);
}
/** Key k let go. */
function keyUp(k) {
  if (keyNotes[k] >= 0) noteOff(keyNotes[k]);
  keyNotes[k] = -1;
}
/** What the synth plays, on it (its display, its lights) and in the card: its sound, its preset, Mono and its octave. */
function showSynth() {
  synthKit?.setState({ name: synth.name, mono: synth.mono, preset: synth.preset, lowest: synth.lowest });
  overlay.setSynth({ name: synth.name, preset: synth.preset, mono: synth.mono, octave: synth.octave, lowest: synth.lowest });
}
/** Every knob at once (a preset, as it comes): on the synth's dials and the card's sliders. */
function showSynthKnobs() {
  synthKit?.setKnobs(synth.knobs);
  overlay.setSynthKnobs(synth.knobs);
}
/** The keys down, on the synth and in the card. */
function showNotes() {
  synthKit?.setDown(synth.down, synth.lowest);
  overlay.setNotes(synth.down, synth.lowest);
}
synth.onNotes = showNotes;
/** A knob of the synth set 0…1: heard at once (or from the next note), on its dial and the display, and in the card. */
function setSynthKnob(id, value) {
  synth.setKnob(id, value);
  const v = synth.knobs[id];
  synthKit?.setKnob(id, v, synthText(id, v));
  overlay.setSynthKnobs(synth.knobs);
  showSynth();
}
/** A preset (synth.js PRESETS), its knobs and Mono. */
function chooseSound(id) {
  if (!synth.choose(id)) return;
  showSynthKnobs();
  showSynth();
}
/** The synth as it comes. */
function resetSynth() {
  synth.reset();
  showSynthKnobs();
  showSynth();
}
/** Mono, or poly (every note let go first). */
function setMono(on) {
  synth.setMono(on);
  showSynth();
}
/** The octave the keys play in (synth.js OCTAVES). */
function setOctave(octave) {
  synth.setOctave(octave);
  showSynth();
  showNotes();
}
/** The keys' notes, in words (for a toast). */
const keysText = () => `Keys ${noteName(synth.lowest)} to ${noteName(synth.lowest + KEYS - 1)}`;
overlay.onKeyDown = keyDown;
overlay.onKeyUp = keyUp;
overlay.onKeyTap = (k) => tapNote(synth.lowest + k);
overlay.onPreset = chooseSound;
overlay.onMono = setMono;
overlay.onOctave = setOctave;
overlay.onSynthKnob = setSynthKnob;
overlay.onResetSynth = resetSynth;
showSynth();
showSynthKnobs();

for (const type of ['pointerup', 'touchend', 'keydown']) {
  addEventListener(type, () => {
    if (sound.ctx) sound.wake();
  }, { capture: true, passive: true });
}
// Put away: every note let go (none kept sounding, nor waiting to), and the sound asleep.
addEventListener('pagehide', () => {
  synth.allOff();
  sound.sleep();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  synth.allOff();
  sound.sleep();
});

// From a MIDI device (midi.js): asked for with the card's button, or at once when the visitor has
// let this site use MIDI before. Its notes on channel 10 are the General MIDI drums' (drums.js
// padForNote); on another they are the synth's, or the drums' while the visitor plays at the board;
// its sustain pedal, mod wheel and pitch bend the synth's. A note isn't a press: until the page has
// had one, the browser keeps it quiet, and says so.
let midi = null;
let toldQuiet = false;
/** Where the visitor plays (controls.js at): at the board a MIDI keyboard's notes are the drums'. @type {'board' | 'synth' | null} */
let playingAt = null;
async function listen() {
  if (midi) return;
  overlay.setMidi('Asking the browser…');
  try {
    midi = await listenMidi((m) => {
      if (m.type === 'on') {
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
          if (!toldQuiet) overlay.toast('Click or tap the page once, and the instruments are heard', 5);
          toldQuiet = true;
          return;
        }
        if (m.channel === 9 || playingAt === 'board') {
          const i = padForNote(m.note);
          if (i >= 0) play(i, m.velocity);
        } else noteOn(m.note, m.velocity);
      } else if (m.type === 'off') noteOff(m.note);
      else if (m.type === 'sustain') synth.setSustain(m.on);
      else if (m.type === 'mod') synth.setMod(m.value);
      else if (m.type === 'bend') synth.setBend(m.value);
      else synth.allOff();
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
  overlay.noWebGL('This browser cannot show the room in 3D, but its drums and its synth play here in the card. The way back to the Hallway is above.');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// The view, to a screen reader: a picture of the room (what can be done in it is in the card).
renderer.domElement.setAttribute('role', 'img');
const onWalls = ROOM.pieces.map((p) => p.title).join(', ');
renderer.domElement.setAttribute('aria-label', `${ROOM.title}: a floor, four walls and a ceiling, a window onto the afternoon sky, a drum board against the far wall (twelve pads, sixteen step keys, and a panel of jacks and cables), a synth beside it (thirty-seven keys, its knobs, and a panel of sounds), ${onWalls ? '' : 'and '}the doorway back to the ${leadsTo}${onWalls ? `, and on the walls: ${onWalls}` : ''}`);
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
kit.setTempo(clock.tempo);
showDelay();
showPatch();
// The synth beside it, likewise.
const synthDesk = layoutSynth(L, board);
synthKit = new SynthKit(synthDesk, { lit: room.lit, lightColor: room.lightColor, anisotropy });
scene.add(synthKit.group);
showSynth();
showSynthKnobs();
showNotes();
// Through the doorway, the view the Hallway publishes from its door to here (its views.json); until
// it has loaded, or when there is none (a Hallway without this door yet), its glow and name.
const views = hallwayViews(way, ROOM.id);
if (views) room.loadView([views]);
// The pictures on the walls (their titles until they have loaded): the room is ready with them.
let pictured = false;
room.loadPictures().then(() => {
  pictured = true;
});

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L, board, synth: synthDesk });
controls.lowest = () => synth.lowest;
// In VR: a stick in each hand that holds a controller, and the hands' joints, for a forefinger to
// play with (kit.js, and the synth's keys: synthkit.js), moving with the rig as the controllers do.
kit.holdSticks(controls.hands);
const fingers = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
rig.add(...fingers);
/** In VR, whether a hand at (x, y, z) is near the synth's keys, for its stick to show there too. */
const nearSynth = (x, y, z) => x > synthDesk.x0 - 0.5 && x < synthDesk.x1 + 0.5 && z > synthDesk.zBack - 0.2 && z < synthDesk.zFront + 0.9 && y > 0.3;
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
 * board or the synth, a step away from it. (A step the page's history has an entry for is the app's
 * back, not one of these: common's README, "The TV app".)
 */
function stepBack() {
  if (!controls.at) return false;
  controls.stepAway();
  return true;
}

/** On a TV at the synth, the key the arrows chose (from the lowest), which OK plays: middle C to start with. */
let chosenKey = 12;
let remote = null;
if (tv) {
  controls.aimMiddle = true;
  renderer.domElement.setAttribute('aria-describedby', overlay.hint.id);
  // Playing at the board, OK plays the pad the arrows chose, and Menu goes to its steps; at the
  // synth, the key they chose, and Menu goes to its sounds.
  remote = new Remote({
    root: overlay.root,
    view: renderer.domElement,
    use: () => (controls.at === 'board' ? play(drums.selected, 0.85) : controls.at === 'synth' ? tapNote(synth.lowest + chosenKey) : controls.useMiddle()),
    step: stepBack,
    first: () => (controls.at === 'board' ? overlay.stepsBox : controls.at === 'synth' ? overlay.presetsBox : null),
  });
  remote.onMode = (inCard) => overlay.setHint(inCard ? 'tv-card' : 'tv');
  remote.answerApp(tv);
}

// ── The drum board ───────────────────────────────────────────────────────────
// A pad played: a press on it, its key, a trigger, A or OK on it, and in VR a stick or a forefinger
// coming down on it (which the controller feels); a step key likewise. A knob turned: a drag, the
// wheel, a stick. RUN pressed, or Space. On a TV a pad chosen with the arrows. Walking up to the
// board to play it, and stepping away. A cable: taken from a jack (out of an input, the one plugged
// in there), carried to where it is pointed, and plugged into another, or put away.

controls.onPad = play;
controls.onStep = toggleStep;
controls.onRun = toggleClock;
controls.onKnob = (k, by) => {
  const knob = board.knobs[k];
  if (knob.part === 'clock') {
    const turn = Math.min(1, Math.max(0, tempoTurn + by));
    setTempo(TEMPO.min + turn * (TEMPO.max - TEMPO.min), turn);
  } else if (knob.part === 'delay') setDelayKnob(knob.name, delay.knobs[knob.name] + by);
  else setKnob(knob.name, drums.knobs[drums.selected][knob.name] + by);
};
kit.onStep = (s, source) => {
  toggleStep(s);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 14);
};

/** The cable being carried: the jack it hangs from (patch.js's id). @type {{ id: string } | null} */
let carried = null;
/** The jack ringed (-2: to ring again). */
let ringed = -2;
/** Carries a cable from jack `id`, saying so. */
function pickUp(id, words) {
  const jack = patch.jack(id);
  carried = { id };
  controls.carrying = true;
  ringed = -2;
  kit.carry(board.panel.jacks.findIndex((j) => j.id === id), jack?.dir === 'out' ? cableColor(id) : jack?.kind === 'audio' ? SOUND_CABLE : CLOCK_CABLE);
  overlay.toast(words);
}
/** The cable carried put away (`plugged`: in, so nothing more is said). */
function putDown(plugged = false) {
  if (!carried) return;
  carried = null;
  controls.carrying = false;
  ringed = -2;
  kit.carry(-1);
  if (!plugged) overlay.toast('Cable put away');
}
/** Why the cable carried, from jack a, can't go into jack b. */
function whyNot(a, b) {
  if (a.dir === b.dir) return a.dir === 'out' ? 'Both are outs: an out goes into an in' : 'Both are ins: an in takes an out';
  const into = a.dir === 'in' ? a : b;
  return into.kind === 'clock' ? `${into.name} takes the clock's pulses, not sound` : `${into.name} takes sound, not the clock's pulses`;
}
controls.onJack = (k) => {
  const id = board.panel.jacks[k]?.id, jack = id ? patch.jack(id) : undefined;
  if (!id || !jack) return;
  if (!carried) {
    // Out of an input, the cable in it, still in its output; else a new one, from this jack.
    const from = jack.dir === 'in' ? patch.source(id) : null;
    if (from) {
      patch.unplug(id);
      pickUp(from, `Pulled out of ${jack.name}: choose where it goes`);
    } else pickUp(id, `A cable from ${jack.name}: choose where it goes`);
    return;
  }
  const a = patch.jack(carried.id);
  if (!a || id === carried.id) putDown();
  else if (patch.canPlug(carried.id, id)) {
    patch.plug(carried.id, id);
    putDown(true);
    overlay.toast(a.dir === 'out' ? `${a.name} into ${jack.name}` : `${jack.name} into ${a.name}`);
  } else overlay.toast(whyNot(a, jack), 4);
};
controls.onDrop = () => putDown();
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
controls.onPlaying = (at) => {
  playingAt = at;
  overlay.setPlaying(at);
  if (at !== 'board') putDown();
  if (at) sound.wake(); // ready for the first pad or key: the walk here began with a press
  if (at && remote) {
    if (at === 'board') overlay.openDrums(true);
    else overlay.openSynth(true);
    remote.forget(); // Menu goes to its steps, or its sounds, now
  }
};
// On a TV the remote leaves the card first: the arrows choose the pads there, OK plays them, and
// arriving (at once with less motion) has Menu go to the steps rather than back to this button.
overlay.onPlay = () => {
  if (controls.at === 'board') controls.stepAway();
  else {
    remote?.walk();
    controls.walkToBoard();
  }
};
kit.onStrike = (i, velocity, source) => {
  play(i, velocity);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.2 + 0.6 * velocity, 18);
};

// ── The synth's keys, dials and buttons ──────────────────────────────────────
// A key held down: a press on it, a computer's key at the synth, in VR a stick or a forefinger in it
// (which the controller feels); a click, A, OK or a trigger plays one a moment. A dial turned: a
// drag, the wheel, a stick. Its panel's buttons: a preset, Mono, the octave (Z and X too), said.
// Walking up to it to play it, and stepping away; on a TV the arrows choose a key.

controls.onNoteOn = noteOn;
controls.onNoteOff = noteOff;
controls.onNoteTap = tapNote;
controls.onDial = (d, by) => {
  const id = synthDesk.dials[d]?.id;
  if (id) setSynthKnob(id, synth.knobs[id] + by);
};
controls.onButton = (i) => {
  const id = synthDesk.panel.buttons[i]?.id;
  if (!id) return;
  if (id === 'mono') setMono(!synth.mono);
  else if (id.startsWith('octave.')) {
    setOctave(synth.octave + (id === 'octave.up' ? 1 : -1));
    overlay.toast(keysText(), 2);
    return;
  } else chooseSound(id.slice('preset.'.length));
  overlay.toast(synth.title, 2);
};
controls.onOctave = (by) => {
  setOctave(synth.octave + by);
  overlay.toast(keysText(), 2);
};
controls.onKeyPick = (by) => {
  chosenKey = Math.min(KEYS - 1, Math.max(0, chosenKey + by));
};
overlay.onPlaySynth = () => {
  if (controls.at === 'synth') controls.stepAway();
  else {
    remote?.walk(); // as the board's: the arrows choose a key there, OK plays it, Menu goes to its sounds
    controls.walkToSynth();
  }
};
synthKit.onKeyDown = (k, velocity, source) => {
  keyDown(k, velocity);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.15 + 0.5 * velocity, 14);
};
synthKit.onKeyUp = keyUp;

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
  else if (carried) putDown();
  else if (controls.at) controls.stepAway();
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
  synthKit.endXR();
  putDown();
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
  // The clock's pulses due soon, and what those heard by now show.
  schedule();
  showPulses();
  // The board: in VR its sticks and the forefingers (after the controls, which moved the hands),
  // the pad, the step key and the jack pointed at (ringed grey where the cable carried can't go),
  // the cable carried, its free end where it is pointed, and the pads' glow. In VR a cable goes
  // where the hand that took it points, and so does its ring.
  const xr = renderer.xr.isPresenting;
  if (xr) {
    kit.updateXR(controls.hands, fingers, dt, nearSynth);
    synthKit.updateXR(controls.hands, fingers, kit.sticks, dt);
  }
  kit.hover(controls.hoverPad);
  kit.hoveredStep = controls.hoverStep;
  const held = carried && xr ? controls.hands[controls.selectHand]?.last ?? null : null;
  const ring = carried && xr ? (held?.kind === 'jack' ? held.jack : -1) : controls.hoverJack;
  if (ring !== ringed) {
    ringed = ring;
    const id = board.panel.jacks[ring]?.id;
    kit.hoverJack(ring, !carried || !id || id === carried.id || patch.canPlug(carried.id, id));
  }
  if (carried) kit.aimAt(xr ? (held && held.kind !== 'ceiling' ? held : null) : controls.aim.has ? controls.aim : null);
  kit.update(dt);
  // The synth: its keys down and the one pointed at (on a TV at it, the one the arrows chose).
  synthKit.hovered = remote && controls.at === 'synth' && !remote.inCard ? chosenKey : controls.hoverKey;
  synthKit.update(dt);
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
  sound, drums, board, kit, play, select, setKnob, clock, pattern, patch, delay, toggleClock, setTempo, toggleStep, setDelayKnob, schedule,
  synth, synthDesk, synthKit, noteOn, noteOff, tapNote, keyDown, keyUp, chooseSound, resetSynth, setSynthKnob, setMono, setOctave,
  /** On a TV at the synth, the key the arrows chose. */
  get chosenKey() {
    return chosenKey;
  },
  /** The cable carried (the jack it hangs from), else null. */
  get carried() {
    return carried;
  },
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
