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
// pads are, from a computer's keys and a MIDI keyboard, and in the card. Its patch bay takes cables
// as the board's panel does, from one desk to the other: its sound into the delay, the clock into
// its arpeggiator (arp.js: the keys held played in turn, a step of the clock each; with no clock
// patched in, or the room's stopped, on its own at the room's tempo), and its LFO and filter
// envelope into its pitch, its cutoff and its amp.
// Beside the synth the rack (rackboard.js lays it out, rackkit.js draws it), a case of modules: the
// room's clock again, with its own outs, a sequencer of sixteen steps (seq.js), each a note set by
// its knob, or a rest, with an accent and a slide, stepped by the clock through a cable into its
// clock in, its notes out into the synth's notes in (synth.js seqStep); a delay of its own (delay.js
// again) and an LFO in time with the clock (lfo.js), whose out goes into the synth's pitch, cutoff or
// amp; and in a second row over them a filter (filter.js) any sound can go through instead of
// straight out, its cutoff moved by an LFO or the synth's envelope, and a reverb (reverb.js) any
// sound can go into, as into the delays.
// Left of the board the keyboard (keysboard.js lays it out, keyskit.js draws it): an organ, with its
// drawbars, percussion and rotary speaker, and an electric piano, or both at once (keys.js), played
// with its sixty-one keys on every device as the synth's are, from a computer's keys and a MIDI
// keyboard, and in the card.
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
import { Clock, LOOKAHEAD, TEMPO, clockEvery, stepSeconds } from './clock.js';
import { STEPS, Pattern, stepOf } from './pattern.js';
import { Patch, padForJack } from './patch.js';
import { Delay } from './delay.js';
import { Lfo } from './lfo.js';
import { Filter } from './filter.js';
import { Reverb } from './reverb.js';
import { KEYS, MOD_INPUTS, Synth, noteName, synthText } from './synth.js';
import { arpWords } from './arp.js';
import { SYNTH, layoutSynth } from './synthboard.js';
import { SynthKit } from './synthkit.js';
import { SEQ_GATE, SEQ_RANGE, SEQ_VELOCITY, Seq } from './seq.js';
import { RACK, layoutRack } from './rackboard.js';
import { RackKit } from './rackkit.js';
import { KEYS_COUNT, KEYS_LOWEST, KEYS_SWITCHES, Keys, isDrawbar, keysText, switchWords } from './keys.js';
import { KEYBOARD, layoutKeyboard } from './keysboard.js';
import { KeysKit } from './keyskit.js';
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
const synth = new Synth(sound, { key: `${ROOM.id}.synth` });
const seq = new Seq({ key: `${ROOM.id}.seq` });
const rackDelay = new Delay(sound, { key: `${ROOM.id}.rackdelay`, channel: 'rackdelay' });
rackDelay.setTempo(clock.tempo);
const lfo = new Lfo(sound, { key: `${ROOM.id}.lfo` });
const filter = new Filter(sound, { key: `${ROOM.id}.filter` });
const reverb = new Reverb(sound, { key: `${ROOM.id}.reverb` });
/** The drum board in 3D (kit.js), once the scene is made. @type {Kit | null} */
let kit = null;
/** The rack in 3D (rackkit.js), once the scene is made. @type {RackKit | null} */
let rackKit = null;

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
// output sending it (every pulse, every 2nd, every 4th), whose pads play on that step at its time,
// and likewise on a step of the synth's arpeggiator. While the clock is stopped, or not patched into
// it, the arpeggiator keeps its own, at the clock's tempo. Likewise on a step of the rack's
// sequencer, whose note, with its notes out patched into the synth's notes in, the synth plays at
// that step's time (synth.js seqStep); the keyboard's notes, patched there instead, it plays as they
// are played (keys.js onNoteOut). Each pulse is a step of the rack's LFO too, whose cycles start
// again with the clock; while the clock is stopped it keeps on by itself, at the tempo. What a pulse
// shows (the steps playing, the pads lit, RUN's lights on the beat, the sequencer's note on the
// synth's keys) is queued until it is heard. A sound (a pad's, the synth's, the keyboard's, the
// filter's) patched into a delay's in (the board's, the rack's) or the reverb's is connected to it
// besides its own channel, and into the filter's in instead of its channel (route), once there is
// sound (sound.onReady; the synth's onBuilt); as the rack's LFO is to what it is patched into, and
// the synth's LFO or filter envelope to the keyboard's ROTARY or the filter's CUTOFF.

/**
 * How many of the clock's pulses make a step of the drums, of the arpeggiator and of the sequencer
 * (the output each one's clock in is patched to), else 0; and whether the sequencer's notes go into
 * the synth, or the keyboard's.
 */
let drumsEvery = 0, synthEvery = 0, seqEvery = 0, seqPlays = false, keysPlays = false;
function patchedClock() {
  drumsEvery = clockEvery(patch.source('drums.clock'));
  synthEvery = clockEvery(patch.source('synth.clock'));
  seqEvery = clockEvery(patch.source('seq.clock'));
  seqPlays = patch.source('synth.notes') === 'seq.notes';
  keysPlays = patch.source('synth.notes') === 'keys.notes';
}
patchedClock();
/** How hard the pattern plays a pad: on the beat, and between. */
const ON_BEAT = 0.85, OFF_BEAT = 0.7;
// What each pulse shows once heard, in a ring: when it falls, its number, the drums' step (-1 none)
// and the pads it plays (a bit each), the sequencer's step (-1 none) and the note it plays (-1 none).
const QUEUED = 64;
const shownAt = new Float64Array(QUEUED), shownPulse = new Int32Array(QUEUED), shownStep = new Int8Array(QUEUED), shownPads = new Uint16Array(QUEUED);
const shownSeq = new Int8Array(QUEUED), shownNote = new Int16Array(QUEUED);
let queueHead = 0, queueTail = 0;
let playhead = -1, seqPlayhead = -1;
/** The note the sequencer plays on the synth as heard now, else -1: shown on its keys. */
let seqSounding = -1;

/** Pulse n of the clock, falling at `time` on the audio clock: the drums' step, the arpeggiator's, the sequencer's, the LFO's, and queued to be seen. */
function pulse(n, time) {
  let step = -1, pads = 0, seqStep = -1, note = -1;
  lfo.step(n, time, stepSeconds(clock.tempo));
  if (drumsEvery && n % drumsEvery === 0) {
    step = stepOf(n / drumsEvery);
    for (let i = 0; i < PADS.length; i++) {
      if (!pattern.has(i, step)) continue;
      drums.play(i, step % 4 ? OFF_BEAT : ON_BEAT, time);
      pads |= 1 << i;
    }
  }
  if (synthEvery && n % synthEvery === 0) synth.arpStep(time, synthEvery * stepSeconds(clock.tempo));
  if (seqEvery && n % seqEvery === 0) {
    seqStep = stepOf(n / seqEvery);
    if (seqPlays) {
      // Its note as long as the gate, or (a slide) on into the next step, where it glides.
      const p = seq.play(seqStep), length = seqEvery * stepSeconds(clock.tempo);
      if (synth.seqStep(p ? p.note : -1, p?.velocity ?? 0, time, p?.slide ? Infinity : time + SEQ_GATE * length) && p) note = p.note;
    }
  }
  if ((queueTail + 1) % QUEUED === queueHead) queueHead = (queueHead + 1) % QUEUED; // full: the oldest goes
  shownAt[queueTail] = time;
  shownPulse[queueTail] = n;
  shownStep[queueTail] = step;
  shownPads[queueTail] = pads;
  shownSeq[queueTail] = seqStep;
  shownNote[queueTail] = note;
  queueTail = (queueTail + 1) % QUEUED;
}
/**
 * The pulses due soon handed out (while the clock is stopped, the LFO's steps by itself instead); and
 * the arpeggiator's steps on its own clock, while the room's isn't patched into it or is stopped.
 */
function schedule() {
  const ctx = sound.ctx;
  if (!ctx) return;
  if (clock.running) clock.advance(ctx.currentTime, pulse);
  else lfo.run(ctx.currentTime, ctx.currentTime + LOOKAHEAD, stepSeconds(clock.tempo));
  if (synth.arp.on && !(clock.running && synthEvery)) synth.arpRun(ctx.currentTime, ctx.currentTime + LOOKAHEAD, stepSeconds(clock.tempo));
}
// A chord just started on the arpeggiator: its first note now, on its own clock.
synth.onArp = schedule;
/** What the pulses heard by now show: the steps playing, the pads played lit, RUN's lights on the beat, the sequencer's note. */
function showPulses() {
  const ctx = sound.ctx;
  if (!ctx) return;
  const heard = ctx.currentTime - (ctx.outputLatency || 0);
  while (queueHead !== queueTail && shownAt[queueHead] <= heard) {
    const s = shownStep[queueHead], pads = shownPads[queueHead], q = shownSeq[queueHead];
    if (shownPulse[queueHead] % 4 === 0) {
      kit?.beat(reduce);
      rackKit?.beat(reduce);
    }
    if (s >= 0) {
      setPlayhead(s);
      for (let i = 0; i < PADS.length; i++) if (pads & (1 << i)) kit?.flash(i, s % 4 ? OFF_BEAT : ON_BEAT, reduce);
    }
    if (q >= 0) {
      setSeqPlayhead(q);
      setSeqSounding(shownNote[queueHead]);
    }
    queueHead = (queueHead + 1) % QUEUED;
  }
  if (queueHead === queueTail) {
    if (!clock.running) setPlayhead(-1);
    if (!clock.running || !seqEvery) {
      setSeqPlayhead(-1);
      setSeqSounding(-1);
    }
  }
}
/** The step playing (-1 none), on the step keys and in the card. */
function setPlayhead(s) {
  if (s === playhead) return;
  playhead = s;
  if (kit) kit.playhead = s;
  overlay.setPlayhead(s);
}
/** The sequencer's step playing (-1 none), on its keys and in the card. */
function setSeqPlayhead(s) {
  if (s === seqPlayhead) return;
  seqPlayhead = s;
  if (rackKit) rackKit.playhead = s;
  overlay.setSeqPlayhead(s);
}
/** The note the sequencer plays as heard (-1 none), on the synth's keys. */
function setSeqSounding(note) {
  if (note === seqSounding) return;
  seqSounding = note;
  showNotes();
}
setInterval(() => {
  schedule();
  showPulses();
}, 25);

/** Starts the clock (waking the sound: this is a press), or stops it (the sequencer's note slid on let go). */
function toggleClock() {
  if (clock.running) {
    clock.stop();
    synth.seqEnd();
  } else {
    const ctx = sound.wake();
    if (!ctx) {
      overlay.toast('This browser makes no sound', 4);
      return;
    }
    clock.start(ctx.currentTime);
    schedule();
  }
  kit?.setRunning(clock.running);
  rackKit?.setRunning(clock.running);
  overlay.setRunning(clock.running);
}
/** Where the tempo's knob is turned to, 0…1: a turn smaller than a beat a minute adds up. */
let tempoTurn = 0;
/** The tempo, in beats per minute (`turn`: the knob's place, when it was turned): on the board's knob and the rack's. */
function setTempo(bpm, turn = (bpm - TEMPO.min) / (TEMPO.max - TEMPO.min)) {
  tempoTurn = Math.min(1, Math.max(0, turn));
  clock.setTempo(bpm);
  delay.setTempo(clock.tempo);
  rackDelay.setTempo(clock.tempo);
  kit?.setTempo(clock.tempo);
  rackKit?.setTempo(clock.tempo);
  overlay.setTempo(clock.tempo);
}
/** The tempo's knob, the board's or the rack's, turned by this much of its whole turn. */
function turnTempo(by) {
  const turn = Math.min(1, Math.max(0, tempoTurn + by));
  setTempo(TEMPO.min + turn * (TEMPO.max - TEMPO.min), turn);
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
/** A knob of the rack's delay, set 0…1. */
function setRackDelayKnob(name, value) {
  rackDelay.setKnob(name, value);
  showRackDelay();
}
function showRackDelay() {
  rackKit?.setDelay(rackDelay.knobs);
  overlay.setRackDelay(rackDelay.knobs);
}
showRackDelay();
overlay.onRackDelay = setRackDelayKnob;
overlay.onResetRackDelay = () => {
  rackDelay.reset();
  showRackDelay();
};
/** A knob of the rack's LFO, set 0…1. */
function setLfoKnob(name, value) {
  lfo.setKnob(name, value);
  showLfo();
}
function showLfo() {
  rackKit?.setLfo(lfo.knobs);
  overlay.setLfo(lfo.knobs);
}
showLfo();
overlay.onLfo = setLfoKnob;
overlay.onResetLfo = () => {
  lfo.reset();
  showLfo();
};
/** A knob of the rack's filter, set 0…1. */
function setFilterKnob(name, value) {
  filter.setKnob(name, value);
  showFilter();
}
function showFilter() {
  rackKit?.setFilter(filter.knobs);
  overlay.setFilter(filter.knobs);
}
showFilter();
overlay.onFilter = setFilterKnob;
overlay.onResetFilter = () => {
  filter.reset();
  showFilter();
};
/** A knob of the rack's reverb, set 0…1. */
function setReverbKnob(name, value) {
  reverb.setKnob(name, value);
  showReverb();
}
function showReverb() {
  rackKit?.setReverb(reverb.knobs);
  overlay.setReverb(reverb.knobs);
}
showReverb();
overlay.onReverb = setReverbKnob;
overlay.onResetReverb = () => {
  reverb.reset();
  showReverb();
};

/**
 * The sound out of output jack `id` (a pad's, the synth's, the keyboard's, the filter's), made once
 * there is sound (the synth's once its voices are); else null. Each goes into its own channel as it
 * is made (home), until route says otherwise.
 */
function soundOut(id) {
  const i = padForJack(id);
  return i >= 0 ? drums.out(i) : id === 'synth.out' ? synth.output : id === 'keys.out' ? keys.output() : id === 'filter.out' ? filter.output() : null;
}
/** The channel output `id`'s sound goes into as it is made (sound.js), else null. */
function home(id) {
  const name = padForJack(id) >= 0 ? 'drums' : id === 'synth.out' ? 'synth' : id === 'keys.out' ? 'keys' : id === 'filter.out' ? filter.channel : null;
  return name ? sound.channel(name) : null;
}
/** The sound into input jack `id`: a delay's, the reverb's, the filter's, once there is sound; else null. */
function soundIn(id) {
  return id === 'delay.in' ? delay.input() : id === 'rackdelay.in' ? rackDelay.input() : id === 'reverb.in' ? reverb.input() : id === 'filter.in' ? filter.input() : null;
}
/** The inputs a sound goes through instead of on into its channel: the filter's. The rest add to it (the delays', the reverb's). */
const THROUGH = new Set(['filter.in']);
/** Each output routed: its node, and what it is connected to now (its channel, inputs). @type {Map<string, { out: AudioNode, to: AudioNode[] }>} */
const routed = new Map();
/**
 * Output `id`'s sound to where its cables go, once there is sound (else, when there is: onReady, and
 * the synth's once its voices are made): into each input patched, and into its own channel unless
 * one of them is one it goes through instead (the filter's), as each cable changes.
 */
function route(id) {
  if (!id) return;
  const targets = patch.targets(id), was = routed.get(id);
  if (!was && !targets.length) return; // as it is made: into its channel
  const out = was?.out ?? soundOut(id);
  if (!out) return;
  const channel = home(id), now = was?.to ?? (channel ? [channel] : []);
  /** @type {AudioNode[]} */
  const to = [];
  for (const t of targets) {
    const input = soundIn(t);
    if (input) to.push(input);
  }
  if (channel && !targets.some((t) => THROUGH.has(t))) to.push(channel);
  for (const n of now) if (!to.includes(n)) out.disconnect(n);
  for (const n of to) if (!now.includes(n)) out.connect(n);
  routed.set(id, { out, to });
}
sound.onReady = () => {
  for (const j of patch.jacks) if (j.dir === 'out' && j.kind === 'audio') route(j.id);
  lfo.output(); // its wave written from now on
  for (const m of MOD_INPUTS) if (patch.source(`synth.${m}`) === 'lfo.out') synth.setInput(m, lfo.output());
  keys.setInput(modNode(patch.source('keys.rotary')));
  filter.setCutoffIn(modNode(patch.source('filter.cutoff')));
};
synth.onBuilt = () => route('synth.out');
/** The cables' colours: the clock's amber, a pad's sound in the pad's colour, the synth's blue, the keyboard's red, the filter's violet, a modulation's pink, notes green. */
const CLOCK_CABLE = '#e8a33c', SOUND_CABLE = '#cfc6b8', SYNTH_CABLE = '#5aa2f0', KEYS_CABLE = '#d8434d', FILTER_CABLE = '#8f7cff', MOD_CABLE = '#e8609a', NOTES_CABLE = '#62c87a';
const cableColor = (id) => {
  const i = padForJack(id), kind = patch.jack(id)?.kind;
  if (i >= 0) return PADS[i].color;
  if (id === 'synth.out') return SYNTH_CABLE;
  if (id === 'keys.out') return KEYS_CABLE;
  if (id === 'filter.out') return FILTER_CABLE;
  return kind === 'audio' ? SOUND_CABLE : kind === 'mod' ? MOD_CABLE : kind === 'notes' ? NOTES_CABLE : CLOCK_CABLE;
};
/** Jack `id`'s place in the room's list of them (the board's, then the synth's, the rack's and the keyboard's: kit.js), else -1. */
function jackIndex(id) {
  const k = board.panel.jacks.findIndex((j) => j.id === id);
  if (k >= 0) return k;
  for (const D of [synthDesk, rackDesk, keysDesk]) {
    const s = D.panel.jacks.findIndex((j) => j.id === id);
    if (s >= 0) return D.panel.jackBase + s;
  }
  return -1;
}
/** The id (patch.js) of the jack at place k in that list, else undefined. */
function jackId(k) {
  if (k < synthDesk.panel.jackBase) return board.panel.jacks[k]?.id;
  if (k < rackDesk.panel.jackBase) return synthDesk.panel.jacks[k - synthDesk.panel.jackBase]?.id;
  if (k < keysDesk.panel.jackBase) return rackDesk.panel.jacks[k - rackDesk.panel.jackBase]?.id;
  return keysDesk.panel.jacks[k - keysDesk.panel.jackBase]?.id;
}
/** The cables on the board, the synth, the rack and the keyboard, and in the card. */
function showPatch() {
  if (kit) kit.setCables(patch.cables().map((c) => ({ from: jackIndex(c.from), to: jackIndex(c.to), color: cableColor(c.from) })));
  overlay.setPatch(patch);
}
/**
 * What goes into one of the synth's modulation inputs from output `id`: its LFO, its filter envelope,
 * the rack's LFO (once there is sound: until then nothing, and then it, sound.onReady), else nothing.
 */
const modSource = (id) => (id === 'synth.lfo' ? 'lfo' : id === 'synth.env' ? 'env' : id === 'lfo.out' ? lfo.output() : null);
/**
 * What goes into a modulation input outside the synth (the keyboard's ROTARY, the filter's CUTOFF)
 * from output `id`: the synth's LFO or its filter envelope (its voices made for them), the rack's
 * LFO; each once there is sound (until then nothing, and then it, sound.onReady), else nothing.
 */
const modNode = (id) => (id === 'synth.lfo' ? synth.modOutput('lfo') : id === 'synth.env' ? synth.modOutput('env') : id === 'lfo.out' ? lfo.output() : null);
patch.onChange = (to, from, was) => {
  if (patch.jack(to)?.kind === 'audio') {
    route(was);
    route(from);
  }
  if (to === 'drums.clock' || to === 'synth.clock' || to === 'seq.clock' || to === 'synth.notes') patchedClock();
  // The sequencer's clock or its notes unplugged: a note it slid on, let go.
  if ((to === 'seq.clock' || to === 'synth.notes') && !(seqEvery && seqPlays)) synth.seqEnd();
  // The keyboard's notes unplugged: those it was playing on the synth, let go.
  if (to === 'synth.notes' && was === 'keys.notes') keysOffSynth();
  const input = MOD_INPUTS.find((m) => to === `synth.${m}`);
  if (input) synth.setInput(input, modSource(from));
  if (to === 'keys.rotary') keys.setInput(modNode(from));
  if (to === 'filter.cutoff') filter.setCutoffIn(modNode(from));
  showPatch();
};
for (const m of MOD_INPUTS) synth.setInput(m, modSource(patch.source(`synth.${m}`)));
showPatch();
overlay.onPlug = (input, output) => {
  if (!output) patch.unplug(input);
  else if (!patch.plug(output, input) && patch.source(input) !== output) {
    // Refused (it would bring a sound back round): the choice as it was, and why.
    overlay.setPatch(patch);
    const a = patch.jack(output), b = patch.jack(input);
    if (a && b) overlay.toast(whyNot(a, b), 4);
  }
};
// ── The synth ────────────────────────────────────────────────────────────────
// Six voices into the same sound, its knobs, its preset, Mono, its octave and its arpeggiator kept
// for the next visit (synth.js). A key held sounds until it is let go: a press on it (on the synth,
// in the card), a computer's key, a MIDI keyboard's, in VR a stick or a forefinger down in it. A
// click, OK, A or a trigger on one plays it a moment. With the arpeggiator on, the keys held make
// the chord it plays (with HOLD, kept; a click brings a note into it, or takes it out). The keys down
// show on the synth and in the card, and what it plays on its display.

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
/** What the synth plays, on it (its display, its lights) and in the card: its sound, its preset, Mono, its octave and its arpeggiator. */
function showSynth() {
  const arp = { mode: synth.arp.mode, range: synth.arp.range, hold: synth.arp.hold };
  synthKit?.setState({ name: synth.name, mono: synth.mono, preset: synth.preset, lowest: synth.lowest, arp });
  overlay.setSynth({ name: synth.name, preset: synth.preset, mono: synth.mono, octave: synth.octave, lowest: synth.lowest, arp });
}
/** Every knob at once (a preset, as it comes): on the synth's dials and the card's sliders. */
function showSynthKnobs() {
  synthKit?.setKnobs(synth.knobs);
  overlay.setSynthKnobs(synth.knobs);
}
/** The keys down (and the arpeggiator's chord), on the synth and in the card; on the synth, the sequencer's note too. */
function showNotes() {
  const held = synth.held;
  synthKit?.setDown(seqSounding >= 0 ? new Set(held).add(seqSounding) : held, synth.lowest);
  overlay.setNotes(held, synth.lowest);
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
/** The arpeggiator on, playing one of its ways (arp.js ARP_MODES), or off (null): every note let go as it goes on or off. */
function setArp(mode) {
  synth.setArp(mode);
  showSynth();
  showNotes();
}
/** The arpeggiator's HOLD, on or off. */
function setHold(on) {
  synth.setHold(on);
  showSynth();
  showNotes();
}
/** The octaves the arpeggiator plays over (none given: the next, round them). */
function setRange(n) {
  synth.setRange(n);
  showSynth();
}
/** The synth's keys' notes, in words (for a toast). */
const synthKeysText = () => `Keys ${noteName(synth.lowest)} to ${noteName(synth.lowest + KEYS - 1)}`;
overlay.onKeyDown = keyDown;
overlay.onKeyUp = keyUp;
overlay.onKeyTap = (k) => tapNote(synth.lowest + k);
overlay.onPreset = chooseSound;
overlay.onMono = setMono;
overlay.onOctave = setOctave;
overlay.onSynthKnob = setSynthKnob;
overlay.onResetSynth = resetSynth;
overlay.onArp = setArp;
overlay.onHold = setHold;
overlay.onRange = setRange;
showSynth();
showSynthKnobs();

// ── The rack's sequencer ─────────────────────────────────────────────────────
// Its sixteen steps and its octave, kept for the next visit (seq.js). A step's key pressed (on the
// rack, in the card, its key at the rack: 1–8, then Q–I), its accent's (Shift) or its slide's; its
// note set by its knob (a drag, the wheel, a stick; in the card a choice of notes), a semitone at a
// time, heard on the synth while the clock is stopped; the octave (its buttons, Z and X at the rack).
// What is set shows on the rack (its keys, its knobs, the notes' names, its display) and in the card.

/** Where each step's knob is turned to, 0…1: a turn smaller than a semitone adds up. */
const noteTurn = new Float32Array(STEPS);
/** A whole turn of a step's knob is two octaves: dragged (the wheel, a stick), half as quick as the other knobs. */
const NOTE_TURN = 0.5;
/** Each step's knob where its note is (as the line comes, or cleared). */
function syncNoteTurns() {
  for (let s = 0; s < STEPS; s++) noteTurn[s] = seq.steps[s].note / SEQ_RANGE;
}
syncNoteTurns();
/** The line, on the rack and in the card. */
function showSeq() {
  rackKit?.setLine(seq.steps, seq.lowest, seq.octave);
  overlay.setSeq(seq.steps, seq.lowest, seq.octave);
}
/** Step s's key in a row (rackboard.js SEQ_ROWS) pressed: it plays or rests, its accent, its slide; said on the display. */
function toggleSeqKey(row, s) {
  if (!(s >= 0 && s < STEPS)) return;
  const on = row === 'accent' ? seq.toggleAccent(s) : row === 'slide' ? seq.toggleSlide(s) : seq.toggle(s);
  rackKit?.setLast(`STEP ${s + 1}  ${row === 'seq' ? (on ? noteName(seq.noteOf(s)) : 'REST') : `${row.toUpperCase()} ${on ? 'ON' : 'OFF'}`}`);
  showSeq();
}
/**
 * Step s's note, semitones up from the line's lowest (`turn`: its knob's place, when it was turned):
 * heard a moment on the synth while the clock is stopped and the sequencer's notes go into it.
 */
function setSeqNote(s, n, turn = n / SEQ_RANGE) {
  if (!(s >= 0 && s < STEPS)) return;
  noteTurn[s] = Math.min(1, Math.max(0, turn));
  if (!seq.setNote(s, n)) return;
  rackKit?.setLast(`STEP ${s + 1}  ${noteName(seq.noteOf(s))}`);
  showSeq();
  const ctx = !clock.running && seqPlays ? sound.wake() : null;
  if (ctx) synth.seqStep(seq.noteOf(s), SEQ_VELOCITY.normal, ctx.currentTime, ctx.currentTime + 0.18);
}
/** Step s's knob turned by this much of its whole turn. */
function turnSeqNote(s, by) {
  const turn = Math.min(1, Math.max(0, noteTurn[s] + by * NOTE_TURN));
  setSeqNote(s, Math.round(turn * SEQ_RANGE), turn);
}
/** The octave the line plays in (seq.js SEQ_OCTAVES). */
function setSeqOctave(octave) {
  seq.setOctave(octave);
  showSeq();
}
/** The sequencer's octave, in words (for a toast). */
const seqText = () => `Sequencer octave ${seq.octave > 0 ? '+' : ''}${seq.octave}: notes ${noteName(seq.lowest)} to ${noteName(seq.lowest + SEQ_RANGE)}`;
/** Every step a rest; or the line as it comes. */
function clearSeq() {
  seq.clear();
  syncNoteTurns();
  rackKit?.setLast('CLEARED');
  showSeq();
}
function resetSeq() {
  seq.reset();
  syncNoteTurns();
  rackKit?.setLast('LINE AS IT COMES');
  showSeq();
}
overlay.onSeqKey = toggleSeqKey;
overlay.onSeqNote = (s, n) => setSeqNote(s, n);
overlay.onSeqOctave = setSeqOctave;
overlay.onClearSeq = clearSeq;
overlay.onResetSeq = resetSeq;
showSeq();

// ── The keyboard ─────────────────────────────────────────────────────────────
// Its organ and its electric piano into the same sound, its drawbars, knobs and switches, the sound
// chosen and the octave the computer's keys play in kept for the next visit (keys.js). A key held
// sounds until it is let go: a press on it (on the keyboard, in the card), a computer's key at it, a
// MIDI keyboard's while playing at it, in VR a stick or a forefinger down in it; a click, OK, A or a
// trigger plays one a moment. SUSTAIN (its button, the card's, a MIDI keyboard's pedal while playing
// at it) holds the notes let go. What it plays shows on it (its keys, its display, its lights) and in
// the card. Its jacks: its sound out into a delay, the reverb or the filter (route), its notes out
// into the synth (played there too, onNoteOut), and ROTARY in, a modulation into its rotary
// speaker's speed (modNode).

const keys = new Keys(sound, { key: `${ROOM.id}.keys` });
/** The keyboard in 3D (keyskit.js), once the scene is made. @type {KeysKit | null} */
let keysKit = null;
/** Where each knob of the keyboard's was turned to, 0…1, a drawbar's before it settled on its eighth: a turn smaller than an eighth (the wheel, a stick) adds up. */
const pulls = { ...keys.knobs };
/** A note of the keyboard's played until it is let go (keysOff), `velocity` 0…1 (the organ's as loud however hard). */
function keysOn(note, velocity) {
  if (!keys.noteOn(note, velocity)) noSound();
}
/** A note of the keyboard's let go. */
function keysOff(note) {
  keys.noteOff(note);
}
/** A note of the keyboard's played for a moment (a click, OK, A, a trigger). */
function tapKeys(note, velocity = 0.85) {
  if (!keys.tap(note, velocity)) noSound();
}
/** The keyboard as it is, on it (its display, its lights) and in the card. */
function showKeys() {
  const state = { name: keys.name, choice: keys.choice, knobs: keys.knobs, switches: keys.switches, octave: keys.octave, sustain: keys.sustain };
  keysKit?.setState(state);
  overlay.setKeys(state);
}
/** Every drawbar and knob at once (as it comes): on the keyboard and in the card. */
function showKeysKnobs() {
  keysKit?.setKnobs(keys.knobs);
  overlay.setKeysKnobs(keys.knobs);
}
/** The keys down, on the keyboard and in the card. */
function showKeysNotes() {
  keysKit?.setDown(keys.down);
  overlay.setKeysNotes(keys.down);
}
keys.onNotes = showKeysNotes;
/** The keyboard's notes the synth is playing (its NOTES out patched into the synth's NOTES in). */
const keysOnSynth = new Set();
// Its notes out: into the synth, while patched there, each as it goes down and as it ends (the
// keyboard's pedal holding it till then), as though played on the synth's own keys; a tap as the
// synth's own is, into the arpeggiator's chord or out of it while HOLD keeps it.
keys.onNoteOut = (note, velocity, tap) => {
  if (velocity === null) {
    if (keysOnSynth.delete(note)) synth.noteOff(note);
  } else if (keysPlays) {
    if (tap && synth.arp.on && synth.arp.hold) {
      synth.tap(note, velocity);
      return;
    }
    keysOnSynth.add(note);
    synth.noteOn(note, velocity);
  }
};
/** The keyboard's notes on the synth let go (its NOTES out unplugged from it). */
function keysOffSynth() {
  for (const note of keysOnSynth) synth.noteOff(note);
  keysOnSynth.clear();
}
/** A drawbar (to its nearest eighth) or a knob of the keyboard's set 0…1: heard at once (or from the next note), on it and its display, and in the card. */
function setKeysKnob(id, value) {
  if (!Number.isFinite(value)) return;
  pulls[id] = Math.min(1, Math.max(0, value));
  keys.setKnob(id, value);
  const v = keys.knobs[id];
  keysKit?.setKnob(id, v, keysText(id, v));
  overlay.setKeysKnobs(keys.knobs);
  if (isDrawbar(id)) showKeys(); // the drawbars as an organist writes them, on its display
}
/** A drawbar or a knob of the keyboard's turned by this much of its whole turn. */
const turnKeysKnob = (id, by) => setKeysKnob(id, pulls[id] + by);
/** What the keys play (keys.js KEYS_SOUNDS): every note let go first. */
function chooseKeys(id) {
  if (!keys.choose(id)) return;
  showKeys();
}
/** SUSTAIN down, or let go (the notes it held let go too). */
function setSustain(on) {
  keys.setSustain(on);
  showKeys();
}
/** A switch of the keyboard's (keys.js KEYS_SWITCHES): the percussion's, the rotary speaker's. */
function setKeysSwitch(id, on) {
  keys.setSwitch(id, on);
  showKeys();
}
/** The octave the computer's keys play in at the keyboard (keys.js KEYS_OCTAVES). */
function setKeysOctave(octave) {
  keys.setOctave(octave);
  showKeys();
}
/** The keyboard as it comes. */
function resetKeys() {
  keys.reset();
  Object.assign(pulls, keys.knobs);
  showKeysKnobs();
  showKeys();
}
/** The computer's keys' notes at the keyboard, in words (for a toast). */
const keysOctaveText = () => `Computer's keys ${noteName(60 + 12 * keys.octave)} to ${noteName(77 + 12 * keys.octave)}`;
overlay.onKeysDown = (k, v) => keysOn(KEYS_LOWEST + k, v);
overlay.onKeysUp = (k) => keysOff(KEYS_LOWEST + k);
overlay.onKeysTap = (k) => tapKeys(KEYS_LOWEST + k);
overlay.onKeysSound = chooseKeys;
overlay.onSustain = setSustain;
overlay.onKeysOctave = setKeysOctave;
overlay.onKeysKnob = setKeysKnob;
overlay.onKeysSwitch = setKeysSwitch;
overlay.onResetKeys = resetKeys;
showKeys();
showKeysKnobs();

for (const type of ['pointerup', 'touchend', 'keydown']) {
  addEventListener(type, () => {
    if (sound.ctx) sound.wake();
  }, { capture: true, passive: true });
}
// Put away: every note let go (none kept sounding, nor waiting to), and the sound asleep.
addEventListener('pagehide', () => {
  keys.allOff();
  synth.allOff();
  sound.sleep();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  keys.allOff();
  synth.allOff();
  sound.sleep();
});

// From a MIDI device (midi.js): asked for with the card's button, or at once when the visitor has
// let this site use MIDI before. Its notes on channel 10 are the General MIDI drums' (drums.js
// padForNote); on another they are the synth's, or the drums' while the visitor plays at the board,
// or the keyboard's while at it (each let go where it was played); its sustain pedal the synth's, or
// the keyboard's while at it (let go where it went down); its mod wheel and pitch bend the synth's. A
// note isn't a press: until the page has had one, the browser keeps it quiet, and says so.
let midi = null;
let toldQuiet = false;
/** Where the visitor plays (controls.js at): at the board a MIDI keyboard's notes are the drums', at the keyboard its. @type {'board' | 'synth' | 'rack' | 'keys' | null} */
let playingAt = null;
/** The MIDI notes held on the keyboard (the rest held are the synth's). */
const midiKeys = new Set();
/** Where a MIDI keyboard's sustain pedal went down: on the keyboard, else on the synth. */
let pedalOnKeys = false;
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
        } else if (playingAt === 'keys') {
          midiKeys.add(m.note);
          keysOn(m.note, m.velocity);
        } else noteOn(m.note, m.velocity);
      } else if (m.type === 'off') {
        if (midiKeys.delete(m.note)) keysOff(m.note);
        else noteOff(m.note);
      } else if (m.type === 'sustain') {
        if (m.on) pedalOnKeys = playingAt === 'keys';
        if (pedalOnKeys) setSustain(m.on);
        else synth.setSustain(m.on);
      } else if (m.type === 'mod') synth.setMod(m.value);
      else if (m.type === 'bend') synth.setBend(m.value);
      else {
        keys.allOff();
        synth.allOff();
        midiKeys.clear();
      }
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
  overlay.noWebGL('This browser cannot show the room in 3D, but its drums, its synth, its sequencer and its keys play here in the card. The way back to the Hallway is above.');
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// The view, to a screen reader: a picture of the room (what can be done in it is in the card).
renderer.domElement.setAttribute('role', 'img');
const onWalls = ROOM.pieces.map((p) => p.title).join(', ');
renderer.domElement.setAttribute('aria-label', `${ROOM.title}: a floor, four walls and a ceiling, a window onto the afternoon sky, a drum board against the far wall (twelve pads, sixteen step keys, and a panel of jacks and cables), a keyboard to its left (sixty-one keys, nine drawbars, and the knobs and buttons of an organ and an electric piano), a synth to its right (thirty-seven keys, its knobs, and a panel of sounds, jacks and an arpeggiator), a rack beside that (a clock, a sequencer of sixteen steps with a knob for each note, a delay and an LFO), ${onWalls ? '' : 'and '}the doorway back to the ${leadsTo}${onWalls ? `, and on the walls: ${onWalls}` : ''}`);
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
// The drum board against the far wall, in the room's light, and the synth beside it, likewise, and
// the rack beside that; the keyboard on the board's other side; the cables between their jacks, the
// board's kit's (its own, then the synth's, the rack's and the keyboard's).
const board = layoutBoard(L);
const synthDesk = layoutSynth(L, board);
const rackDesk = layoutRack(L, synthDesk);
const keysDesk = layoutKeyboard(L, board, rackDesk);
kit = new Kit(board, { lit: room.lit, lightColor: room.lightColor, anisotropy });
kit.addJacks(synthDesk, Math.max(SYNTH.dial.h, SYNTH.key.rise + SYNTH.key.blackRise));
kit.addJacks(rackDesk, RACK.knob.h);
kit.addJacks(keysDesk, Math.max(SYNTH.dial.h, SYNTH.key.rise + SYNTH.key.blackRise, KEYBOARD.drawbar.h));
scene.add(kit.group);
select(drums.selected);
kit.setTempo(clock.tempo);
showDelay();
synthKit = new SynthKit(synthDesk, { lit: room.lit, lightColor: room.lightColor, anisotropy });
scene.add(synthKit.group);
rackKit = new RackKit(rackDesk, { lit: room.lit, lightColor: room.lightColor, anisotropy });
rackKit.setTempo(clock.tempo);
showRackDelay();
showLfo();
showFilter();
showReverb();
scene.add(rackKit.group);
keysKit = new KeysKit(keysDesk, { lit: room.lit, lightColor: room.lightColor, anisotropy });
scene.add(keysKit.group);
showPatch();
showSynth();
showSynthKnobs();
showNotes();
showSeq();
showKeys();
showKeysKnobs();
showKeysNotes();
// Through the doorway, the view the Hallway publishes from its door to here (its views.json); until
// it has loaded, or when there is none (a Hallway without this door yet), its glow and name.
const views = hallwayViews(way, ROOM.id);
if (views) room.loadView([views]);
// The pictures on the walls (their titles until they have loaded): the room is ready with them.
let pictured = false;
room.loadPictures().then(() => {
  pictured = true;
});

const controls = new Controls({ renderer, camera, rig, scene, dom: renderer.domElement, layout: L, board, synth: synthDesk, rack: rackDesk, keyboard: keysDesk });
controls.lowest = () => synth.lowest;
controls.keysOctave = () => keys.octave;
controls.pulled = (id) => keys.knobs[id];
// In VR: a stick in each hand that holds a controller, and the hands' joints, for a forefinger to
// play with (kit.js, and the synth's keys: synthkit.js, the rack's: rackkit.js, and the keyboard's:
// keyskit.js), moving with the rig as the controllers do.
kit.holdSticks(controls.hands);
const fingers = [renderer.xr.getHand(0), renderer.xr.getHand(1)];
rig.add(...fingers);
/** In VR, whether a hand at (x, y, z) is near the synth's keys or the rack's, or the keyboard's, for its stick to show there too. */
const nearKeys = (x, y, z) => y > 0.3 && ((x > synthDesk.x0 - 0.5 && x < rackDesk.x1 + 0.5 && z > synthDesk.zBack - 0.2 && z < synthDesk.zFront + 0.9)
  || (x > keysDesk.x0 - 0.5 && x < keysDesk.x1 + 0.5 && z > keysDesk.zBack - 0.2 && z < keysDesk.zFront + 0.9));
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
 * Back on a TV while walking: the room's own step back, true when it took one: playing at one of the
 * instruments, a step away from it. (A step the page's history has an entry for is the app's
 * back, not one of these: common's README, "The TV app".)
 */
function stepBack() {
  if (!controls.at) return false;
  controls.stepAway();
  return true;
}

/** On a TV at the synth, the key the arrows chose (from the lowest), which OK plays: middle C to start with. */
let chosenKey = 12;
/** On a TV at the rack, the step the arrows chose, which OK plays or rests (and up and down turn its note). */
let chosenStep = 0;
/** On a TV at the keyboard, the note of the key the arrows chose, which OK plays: middle C to start with. */
let chosenNote = 60;
let remote = null;
if (tv) {
  controls.aimMiddle = true;
  renderer.domElement.setAttribute('aria-describedby', overlay.hint.id);
  // Playing at the board, OK plays the pad the arrows chose, and Menu goes to its steps; at the
  // synth, the key they chose, and Menu goes to its sounds; at the rack, OK plays or rests the step
  // they chose, and Menu goes to the sequencer's steps; at the keyboard, the key they chose, and Menu
  // goes to its sound.
  remote = new Remote({
    root: overlay.root,
    view: renderer.domElement,
    use: () => {
      if (controls.at === 'board') play(drums.selected, 0.85);
      else if (controls.at === 'synth') tapNote(synth.lowest + chosenKey);
      else if (controls.at === 'rack') toggleSeqKey('seq', chosenStep);
      else if (controls.at === 'keys') tapKeys(chosenNote);
      else controls.useMiddle();
    },
    step: stepBack,
    first: () => (controls.at === 'board' ? overlay.stepsBox : controls.at === 'synth' ? overlay.presetsBox : controls.at === 'rack' ? overlay.seqBox : controls.at === 'keys' ? overlay.keysSoundBox : null),
  });
  remote.onMode = (inCard) => overlay.setHint(inCard ? 'tv-card' : 'tv');
  remote.answerApp(tv);
}

// ── The drum board ───────────────────────────────────────────────────────────
// A pad played: a press on it, its key, a trigger, A or OK on it, and in VR a stick or a forefinger
// coming down on it (which the controller feels); a step key likewise. A knob turned: a drag, the
// wheel, a stick. RUN pressed, or Space. On a TV a pad chosen with the arrows. Walking up to the
// board to play it, and stepping away. A cable: taken from a jack, on any desk (out of an input, the
// one plugged in there), carried to where it is pointed (to another desk too), and plugged into
// another, or put away.

controls.onPad = play;
controls.onStep = toggleStep;
controls.onRun = toggleClock;
controls.onKnob = (k, by) => {
  const knob = board.knobs[k];
  if (knob.part === 'clock') turnTempo(by);
  else if (knob.part === 'delay') setDelayKnob(knob.name, delay.knobs[knob.name] + by);
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
  const loose = jack?.kind === 'audio' ? SOUND_CABLE : jack?.kind === 'mod' ? MOD_CABLE : jack?.kind === 'notes' ? NOTES_CABLE : CLOCK_CABLE;
  kit.carry(jackIndex(id), jack?.dir === 'out' ? cableColor(id) : loose);
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
/** What each kind of jack carries, in words. */
const CARRIES = { clock: "the clock's pulses", audio: 'sound', mod: 'an LFO or the envelope', notes: 'notes to play' };
/** Why the cable carried, from jack a, can't go into jack b. */
function whyNot(a, b) {
  if (a.dir === b.dir) return a.dir === 'out' ? 'Both are outs: an out goes into an in' : 'Both are ins: an in takes an out';
  const into = a.dir === 'in' ? a : b, from = a.dir === 'in' ? b : a;
  if (into.kind === from.kind) return `${from.name} into ${into.name} would bring its sound back round into itself`;
  return `${into.name} takes ${CARRIES[into.kind]}, not ${CARRIES[from.kind]}`;
}
controls.onJack = (k) => {
  const id = jackId(k), jack = id ? patch.jack(id) : undefined;
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
  if (!at && !controls.goingTo) putDown(); // stepped away; walking to another desk, it comes too
  if (at) sound.wake(); // ready for the first pad or key: the walk here began with a press
  if (at && remote) {
    if (at === 'board') overlay.openDrums(true);
    else if (at === 'synth') overlay.openSynth(true);
    else if (at === 'rack') overlay.openRack(true);
    else overlay.openKeys(true);
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
// drag, the wheel, a stick. Its panel's buttons: a preset, Mono, the octave (Z and X too), the
// arpeggiator's ways (the one lit again: off), HOLD and RANGE, said. Its jacks are the board's
// (controls.onJack, above). Walking up to it to play it, and stepping away; on a TV the arrows
// choose a key.

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
    overlay.toast(synthKeysText(), 2);
    return;
  } else if (id.startsWith('arp.')) {
    const what = id.slice('arp.'.length);
    if (what === 'hold') setHold(!synth.arp.hold);
    else if (what === 'range') setRange();
    else setArp(synth.arp.mode === what ? null : what);
    overlay.toast(`Arpeggiator: ${arpWords(synth.arp)}`, 2);
    return;
  } else chooseSound(id.slice('preset.'.length));
  overlay.toast(synth.title, 2);
};
controls.onOctave = (by) => {
  setOctave(synth.octave + by);
  overlay.toast(synthKeysText(), 2);
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

// ── The rack's keys, knobs and buttons ───────────────────────────────────────
// A step's key, its accent's or its slide's pressed: a press on it, a trigger, A or OK, in VR a stick
// or a forefinger coming down on it (which the controller feels); at the rack the keys 1–8 and Q–I
// (Shift: the accent's). A knob turned (a step's note, the tempo, the delay's, the LFO's, the
// filter's, the reverb's): a drag, the wheel, a stick. Its panel's buttons: RUN, the octave (Z and X
// too), said. Its jacks are the board's (controls.onJack, above). Walking up to it to play it, and
// stepping away; on a TV the arrows choose a step (left and right) and turn its note (up and down),
// and OK plays or rests it.

controls.onSeqKey = toggleSeqKey;
controls.onRackKnob = (k, by) => {
  const knob = rackDesk.knobs[k];
  if (knob?.part === 'tempo') turnTempo(by);
  else if (knob?.part === 'delay') setRackDelayKnob(knob.name, rackDelay.knobs[knob.name] + by);
  else if (knob?.part === 'lfo') setLfoKnob(knob.name, lfo.knobs[knob.name] + by);
  else if (knob?.part === 'filter') setFilterKnob(knob.name, filter.knobs[knob.name] + by);
  else if (knob?.part === 'reverb') setReverbKnob(knob.name, reverb.knobs[knob.name] + by);
  else if (knob) turnSeqNote(knob.step, by);
};
controls.onRackButton = (i) => {
  const id = rackDesk.panel.buttons[i]?.id;
  if (id === 'run') toggleClock();
  else if (id === 'octave.down' || id === 'octave.up') {
    setSeqOctave(seq.octave + (id === 'octave.up' ? 1 : -1));
    overlay.toast(seqText(), 2);
  }
};
controls.onSeqOctave = (by) => {
  setSeqOctave(seq.octave + by);
  overlay.toast(seqText(), 2);
};
controls.onSeqPick = (steps, semitones) => {
  if (steps) chosenStep = (chosenStep + steps + STEPS) % STEPS;
  else setSeqNote(chosenStep, seq.steps[chosenStep].note + semitones);
};
overlay.onPlayRack = () => {
  if (controls.at === 'rack') controls.stepAway();
  else {
    remote?.walk(); // as the board's: the arrows choose a step there, OK plays it, Menu goes to its steps
    controls.walkToRack();
  }
};
rackKit.onKey = (row, s, source) => {
  toggleSeqKey(row, s);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.35, 14);
};

// ── The keyboard's keys, drawbars, knobs and buttons ─────────────────────────
// A key held down: a press on it, a computer's key at the keyboard, in VR a stick or a forefinger in
// it (which the controller feels); a click, A, OK or a trigger plays one a moment. A drawbar pulled
// out or pushed in: a press in its lane, its tab dragged, a trigger, A or OK there, the wheel, a
// stick; a knob turned: a drag, the wheel, a stick. Its panel's buttons: the sound, the percussion's
// switches and the rotary speaker's, SUSTAIN, the octave (Z and X too), said. Walking up to it to
// play it, and stepping away; on a TV the arrows choose a key.

controls.onKeysOn = keysOn;
controls.onKeysOff = keysOff;
controls.onKeysTap = tapKeys;
controls.onDrawbar = setKeysKnob;
controls.onKeysKnob = turnKeysKnob;
controls.onKeysButton = (i) => {
  const id = keysDesk.panel.buttons[i]?.id;
  if (!id) return;
  if (id === 'sustain') {
    setSustain(!keys.sustain);
    overlay.toast(keys.sustain ? 'Sustain on: the notes let go ring on' : 'Sustain off', 2);
  } else if (id.startsWith('octave.')) {
    setKeysOctave(keys.octave + (id === 'octave.up' ? 1 : -1));
    overlay.toast(keysOctaveText(), 2);
  } else if (id.startsWith('switch.')) {
    const s = KEYS_SWITCHES.find((w) => `switch.${w.id}` === id);
    if (!s) return;
    setKeysSwitch(s.id, !keys.switches[s.id]);
    overlay.toast(switchWords(s.id, keys.switches[s.id]), 2);
  } else if (id.startsWith('sound.')) {
    chooseKeys(id.slice('sound.'.length));
    overlay.toast(keys.name, 2);
  }
};
controls.onKeysOctave = (by) => {
  setKeysOctave(keys.octave + by);
  overlay.toast(keysOctaveText(), 2);
};
controls.onKeysPick = (by) => {
  chosenNote = Math.min(KEYS_LOWEST + KEYS_COUNT - 1, Math.max(KEYS_LOWEST, chosenNote + by));
};
overlay.onPlayKeys = () => {
  if (controls.at === 'keys') controls.stepAway();
  else {
    remote?.walk(); // as the synth's: the arrows choose a key there, OK plays it, Menu goes to its sound
    controls.walkToKeys();
  }
};
keysKit.onKeyDown = (k, velocity, source) => {
  keysOn(KEYS_LOWEST + k, velocity);
  source?.gamepad?.hapticActuators?.[0]?.pulse?.(0.15 + 0.5 * velocity, 14);
};
keysKit.onKeyUp = (k) => keysOff(KEYS_LOWEST + k);

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
  rackKit.endXR();
  keysKit.endXR();
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
    kit.updateXR(controls.hands, fingers, dt, nearKeys);
    synthKit.updateXR(controls.hands, fingers, kit.sticks, dt);
    rackKit.updateXR(controls.hands, fingers, kit.sticks);
    keysKit.updateXR(controls.hands, fingers, kit.sticks, dt);
  }
  kit.hover(controls.hoverPad);
  kit.hoveredStep = controls.hoverStep;
  const held = carried && xr ? controls.hands[controls.selectHand]?.last ?? null : null;
  const ring = carried && xr ? (held?.kind === 'jack' ? held.jack : -1) : controls.hoverJack;
  if (ring !== ringed) {
    ringed = ring;
    const id = jackId(ring);
    kit.hoverJack(ring, !carried || !id || id === carried.id || patch.canPlug(carried.id, id));
  }
  if (carried) kit.aimAt(xr ? (held && held.kind !== 'ceiling' ? held : null) : controls.aim.has ? controls.aim : null);
  kit.update(dt);
  // The synth: its keys down and the one pointed at (on a TV at it, the one the arrows chose).
  synthKit.hovered = remote && controls.at === 'synth' && !remote.inCard ? chosenKey : controls.hoverKey;
  synthKit.update(dt);
  // The rack: its keys, the one pointed at (on a TV at it, the step the arrows chose); the LFO's
  // light as its wave is heard (with less motion, steady).
  rackKit.hovered = remote && controls.at === 'rack' && !remote.inCard ? chosenStep : controls.hoverSeqKey;
  const ctx = sound.ctx;
  rackKit.lfo = !ctx ? NaN : reduce ? 0 : lfo.valueAt(ctx.currentTime - (ctx.outputLatency || 0));
  rackKit.update(dt);
  // The keyboard: its keys down and the one pointed at (on a TV at it, the one the arrows chose).
  keysKit.hovered = remote && controls.at === 'keys' && !remote.inCard ? chosenNote - KEYS_LOWEST : controls.hoverNote;
  keysKit.update(dt);
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
  synth, synthDesk, synthKit, noteOn, noteOff, tapNote, keyDown, keyUp, chooseSound, resetSynth, setSynthKnob, setMono, setOctave, setArp, setHold, setRange,
  seq, rackDesk, rackKit, toggleSeqKey, setSeqNote, setSeqOctave, clearSeq, resetSeq, rackDelay, setRackDelayKnob, lfo, setLfoKnob,
  filter, setFilterKnob, reverb, setReverbKnob, route,
  keys, keysDesk, keysKit, keysOn, keysOff, tapKeys, chooseKeys, setKeysKnob, setKeysSwitch, setSustain, setKeysOctave, resetKeys,
  /** On a TV at the synth, the key the arrows chose. */
  get chosenKey() {
    return chosenKey;
  },
  /** On a TV at the rack, the step the arrows chose. */
  get chosenStep() {
    return chosenStep;
  },
  /** On a TV at the keyboard, the note of the key the arrows chose. */
  get chosenNote() {
    return chosenNote;
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
