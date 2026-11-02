// The instruments in the card (overlay.js). The drums: every pad a button that plays as it is pressed
// (and once, for a key or a screen reader), in the board's rows; the clock's Start and tempo; the
// steps of the pad last played as toggles, the one playing marked; its knobs and the delay's as
// sliders with their settings in words; the cables as a choice for each input. The synth: its keys,
// each sounding while pressed, one stop among them; its sounds (the presets, Mono, the octave), its
// arpeggiator, its knobs, a section each, and its cables. The rack: its clock (the room's again),
// its sequencer's steps a row each (whether it plays, its note, its accent, its slide), its octave,
// its delay's knobs and its LFO's as sliders, and its cables. The keys: its keys as the synth's, its
// sound (the organ, the electric piano or both, Sustain, the computer's keys' octave), its drawbars in
// eighths, its percussion, its knobs, and its cables. Sound: the volume, Mute, and MIDI where there is
// Web MIDI.
// Playing at the board, the synth, the rack or the keys and stepping away, with its hint; and all
// five kept, open, where there is no 3D view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { KNOBS, PADS, keyLabel, knobText } from '../public/js/drums.js';
import { TEMPO } from '../public/js/clock.js';
import { STEPS } from '../public/js/pattern.js';
import { DELAY_KNOBS, MAX_STEPS, delayText } from '../public/js/delay.js';
import { JACKS, Patch } from '../public/js/patch.js';
import { DEFAULT_SYNTH, KEYS, LOWEST, OCTAVES, PRESETS, SECTIONS, SYNTH_KNOBS, isBlack, noteName, spokenNote, synthText } from '../public/js/synth.js';
import { ARP_MODES, ARP_RANGES } from '../public/js/arp.js';
import { DEFAULT_LINE, SEQ_LOWEST, SEQ_OCTAVES, SEQ_RANGE, Seq } from '../public/js/seq.js';
import { LFO_RATES, LFO_SHAPES } from '../public/js/lfo.js';
import { DEFAULT_KEYS, DEFAULT_SWITCHES, DRAWBARS, KEYS_COUNT, KEYS_KNOBS, KEYS_LOWEST, KEYS_OCTAVES, KEYS_SECTIONS, KEYS_SOUNDS, KEYS_SWITCHES, keysText } from '../public/js/keys.js';
import { installDom } from './helpers/dom.js';

const way = { url: 'https://ariamokr.github.io/hallway/?from=instruments', label: '← Hallway', title: 'Back to the Hallway' };

/** A card in a fake page, and what it calls. */
async function card(options = {}) {
  const { Overlay } = await import('../public/js/overlay.js');
  const o = new Overlay({ ...ROOM, pieces: [] }, way, options);
  const calls = [];
  for (const name of ['onPad', 'onPlay', 'onKnob', 'onResetKnobs', 'onVolume', 'onMute', 'onMidi', 'onRun', 'onTempo', 'onStep', 'onClearSteps', 'onResetPattern', 'onDelay', 'onResetDelay', 'onPlug',
    'onPlaySynth', 'onKeyDown', 'onKeyUp', 'onKeyTap', 'onPreset', 'onMono', 'onOctave', 'onSynthKnob', 'onResetSynth', 'onArp', 'onHold', 'onRange',
    'onPlayRack', 'onSeqKey', 'onSeqNote', 'onSeqOctave', 'onClearSeq', 'onResetSeq', 'onRackDelay', 'onResetRackDelay', 'onLfo', 'onResetLfo',
    'onPlayKeys', 'onKeysDown', 'onKeysUp', 'onKeysTap', 'onKeysSound', 'onSustain', 'onKeysOctave', 'onKeysKnob', 'onKeysSwitch', 'onResetKeys']) o[name] = (...args) => calls.push([name, ...args]);
  return { o, calls };
}

/** The arpeggiator off, as it comes. */
const OFF = { mode: null, range: 1, hold: false };

/** The indices of the buttons with class c. */
const marked = (buttons, c) => buttons.flatMap((b, i) => (b.classList.contains(c) ? [i] : []));

test('Drums opens and closes in the card, beside the session and Settings', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    assert.equal(o.drumsToggle.textContent, 'Drums');
    assert.deepEqual([o.drumsToggle.getAttribute('aria-controls'), o.drums.getAttribute('id')], ['drums', 'drums']);
    assert.equal(o.drumsToggle.parentNode, o.settingsToggle.parentNode);
    assert.equal(o.drums.hidden, true);
    o.drumsToggle.fire('click');
    assert.deepEqual([o.drums.hidden, o.drumsToggle.getAttribute('aria-expanded')], [false, 'true']);
    o.drumsToggle.fire('click');
    assert.deepEqual([o.drums.hidden, o.drumsToggle.getAttribute('aria-expanded')], [true, 'false']);
    o.openDrums(true);
    assert.equal(o.drums.hidden, false);
  } finally {
    remove();
  }
});

test('every pad is a button named by its words, in the board\'s rows (the farthest first), that plays as it is pressed, and once', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    const grid = o.drums.findAll((c) => c.className === 'pads')[0];
    assert.equal(grid.getAttribute('role'), 'group');
    const buttons = grid.children;
    assert.equal(buttons.length, PADS.length);
    assert.deepEqual(buttons.map((b) => keyLabel(PADS[o.pads.indexOf(b)].key)).join(''), '1234QWERASDF');
    for (const [i, p] of PADS.entries()) {
      const b = o.pads[i];
      assert.deepEqual([b.tagName, b.getAttribute('type')], ['BUTTON', 'button']);
      // Its name is its text (WCAG's label in name), ', key ' out of sight between its name and key.
      assert.equal(b.getAttribute('aria-label'), null);
      assert.equal(b.textContent, `${p.name}, key ${keyLabel(p.key)}`);
      assert.deepEqual(b.children.map((c) => [c.tagName, c.className, c.textContent, c.getAttribute('aria-hidden')]),
        [['SPAN', 'pad-name', p.name, null], ['SPAN', 'sr-only', ', key ', null], ['KBD', '', keyLabel(p.key), null]]);
      assert.equal(b.style.cssText, `--pad: ${p.color}`);
    }
    // Pressed: it plays as it goes down; the click that ends the press does not play it again.
    const snare = o.pads[1];
    snare.fire('pointerdown', { button: 0, timeStamp: 1000 });
    snare.fire('click', { timeStamp: 1120 });
    assert.deepEqual(calls, [['onPad', 1, 0.85]]);
    // A key, a screen reader or a TV's OK: the click alone plays it.
    snare.fire('click', { timeStamp: 5000 });
    // Another pad's click after a press on this one plays that one.
    snare.fire('pointerdown', { button: 0, timeStamp: 6000 });
    o.pads[0].fire('click', { timeStamp: 6050 });
    // The right button doesn't play.
    snare.fire('pointerdown', { button: 2, timeStamp: 7000 });
    assert.deepEqual(calls, [['onPad', 1, 0.85], ['onPad', 1, 0.85], ['onPad', 1, 0.85], ['onPad', 0, 0.85]]);
  } finally {
    remove();
  }
});

test('the knobs of the pad last played: sliders named for them, set in words, turned and reset', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    const cowbell = PADS.findIndex((p) => p.id === 'cowbell');
    const knobs = { pitch: 0.75, decay: 0.2, tone: 0.5 };
    o.setKnobs(cowbell, knobs);
    assert.equal(o.knobsBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Knobs: Cowbell');
    for (const name of KNOBS) {
      const { input, out } = o.knobInputs.get(name);
      assert.deepEqual([input.getAttribute('type'), input.getAttribute('min'), input.getAttribute('max')], ['range', '0', '100']);
      assert.equal(input.parentNode.children[0].textContent, name[0].toUpperCase() + name.slice(1), 'its label');
      assert.equal(input.value, String(Math.round(knobs[name] * 100)));
      assert.equal(out.textContent, knobText(cowbell, name, knobs[name]));
      assert.equal(input.getAttribute('aria-valuetext'), out.textContent);
      assert.equal(out.getAttribute('aria-hidden'), 'true', 'said once, as the slider\'s value');
    }
    assert.equal(o.knobInputs.get('pitch').out.textContent, '+6 semitones');
    const decay = o.knobInputs.get('decay').input;
    decay.value = '30';
    decay.fire('input');
    o.resetKnobs.fire('click');
    assert.deepEqual(calls, [['onKnob', 'decay', 0.3], ['onResetKnobs']]);
  } finally {
    remove();
  }
});

test('the clock: Start or Stop, and its tempo a slider in beats a minute', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.clockBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Clock');
    assert.equal(o.run.textContent, 'Start');
    o.run.fire('click');
    o.setRunning(true);
    assert.equal(o.run.textContent, 'Stop');
    assert.deepEqual([o.tempo.getAttribute('min'), o.tempo.getAttribute('max'), o.tempo.getAttribute('step')], [String(TEMPO.min), String(TEMPO.max), '1']);
    o.setTempo(126);
    assert.deepEqual([o.tempo.value, o.tempoOut.textContent, o.tempo.getAttribute('aria-valuetext')], ['126', '126 BPM', '126 beats a minute']);
    o.tempo.value = '90';
    o.tempo.fire('input');
    assert.deepEqual(calls, [['onRun'], ['onTempo', 90]]);
  } finally {
    remove();
  }
});

test('the steps of the pad last played: sixteen toggles, pressed where it plays, the one playing marked', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.steps.length, STEPS);
    assert.equal(o.stepsBox.tagName, 'FIELDSET');
    const snare = PADS.findIndex((p) => p.id === 'snare');
    const steps = Array.from({ length: STEPS }, (_, s) => s === 4 || s === 12);
    o.setSteps(snare, steps);
    assert.equal(o.stepsBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Steps: Snare');
    assert.equal(o.stepGrid.style.cssText, `--pad: ${PADS[snare].color}`, 'in its colour');
    for (const [s, b] of o.steps.entries()) {
      assert.deepEqual([b.tagName, b.getAttribute('type'), b.textContent], ['BUTTON', 'button', String(s + 1)]);
      assert.equal(b.getAttribute('aria-pressed'), String(steps[s]));
      assert.equal(b.classList.contains('beat'), s % 4 === 0, 'a beat\'s first step');
    }
    o.steps[7].fire('click');
    o.clearSteps.fire('click');
    o.resetPattern.fire('click');
    assert.deepEqual(calls, [['onStep', 7], ['onClearSteps'], ['onResetPattern']]);
    o.setPlayhead(3);
    o.setPlayhead(4);
    assert.deepEqual(marked(o.steps, 'now'), [4]);
    o.setRunning(false);
    assert.ok(o.steps.every((b) => !b.classList.contains('now')), 'stopped, none');
  } finally {
    remove();
  }
});

test('the delay: its time a slider in steps, its feedback and level in percent, set in words and reset', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.setDelay({ time: 2 / 7, feedback: 0.45, level: 0.6 });
    assert.equal(o.delayBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Delay');
    const time = o.delayInputs.get('time');
    assert.deepEqual([time.input.getAttribute('min'), time.input.getAttribute('max'), time.input.value], ['1', String(MAX_STEPS), '3']);
    assert.equal(time.out.textContent, '3 steps, a dotted 8th');
    for (const name of DELAY_KNOBS) {
      const { input, out } = o.delayInputs.get(name);
      assert.equal(input.getAttribute('aria-valuetext'), out.textContent, name);
    }
    assert.equal(o.delayInputs.get('feedback').out.textContent, delayText('feedback', 0.45));
    time.input.value = '8';
    time.input.fire('input');
    const level = o.delayInputs.get('level').input;
    level.value = '25';
    level.fire('input');
    o.resetDelay.fire('click');
    assert.deepEqual(calls, [['onDelay', 'time', 1], ['onDelay', 'level', 0.25], ['onResetDelay']]);
  } finally {
    remove();
  }
});

test("the rack's delay, as the board's but its own, and its LFO: its rate and shape each a slider along their places, its depth in percent; set in words and reset", async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.deepEqual([o.rackDelayBox, o.lfoBox].map((box) => box.findAll((c) => c.tagName === 'LEGEND')[0].textContent), ['Delay', 'LFO']);
    o.setRackDelay({ time: 1, feedback: 0.2, level: 0.3 });
    assert.deepEqual(DELAY_KNOBS.map((name) => o.rackDelayInputs.get(name).out.textContent), [delayText('time', 1), '20%', '30%']);
    assert.notEqual(o.delayInputs.get('time').out.textContent, delayText('time', 1), "the board's delay left as it was");
    o.rackDelayInputs.get('feedback').input.value = '60';
    o.rackDelayInputs.get('feedback').input.fire('input');
    o.resetRackDelay.fire('click');
    assert.equal(o.resetRackDelay.textContent, 'Delay as it comes');
    o.setLfo({ rate: 4 / 6, shape: 0.75, depth: 0.4 });
    const rate = o.lfoInputs.get('rate'), shape = o.lfoInputs.get('shape'), depth = o.lfoInputs.get('depth');
    assert.deepEqual([rate.input.getAttribute('min'), rate.input.getAttribute('max'), rate.input.value, rate.out.textContent], ['1', String(LFO_RATES.length), '5', 'a quarter note']);
    assert.deepEqual([shape.input.getAttribute('min'), shape.input.getAttribute('max'), shape.input.value, shape.out.textContent], ['1', String(LFO_SHAPES.length), '4', 'Square']);
    assert.deepEqual([depth.input.value, depth.out.textContent], ['40', '40%']);
    for (const [name, { input, out }] of o.lfoInputs) assert.equal(input.getAttribute('aria-valuetext'), out.textContent, name);
    rate.input.value = '1';
    rate.input.fire('input');
    shape.input.value = String(LFO_SHAPES.length);
    shape.input.fire('input');
    depth.input.value = '25';
    depth.input.fire('input');
    o.resetLfo.fire('click');
    assert.equal(o.resetLfo.textContent, 'LFO as it comes');
    assert.deepEqual(calls, [['onRackDelay', 'feedback', 0.6], ['onResetRackDelay'], ['onLfo', 'rate', 0], ['onLfo', 'shape', 1], ['onLfo', 'depth', 0.25], ['onResetLfo']]);
  } finally {
    remove();
  }
});

test('the cables: each input a choice of the outputs of its kind, or nothing, as the patch is; the board\'s with the drums, the synth\'s with it, the rack\'s with it, the keyboard\'s with it', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    const ins = JACKS.filter((j) => j.dir === 'in');
    assert.deepEqual([...o.plugs.keys()], ins.map((j) => j.id));
    const boxes = [o.cablesBox, o.synthCablesBox, o.rackCablesBox, o.keysCablesBox];
    for (const j of ins) {
      const select = o.plugs.get(j.id);
      assert.equal(select.parentNode.children[0].textContent, j.name, 'its label');
      const options = select.children.map((c) => [c.getAttribute('value'), c.textContent]);
      assert.deepEqual(options, [['', 'Nothing'], ...JACKS.filter((x) => x.dir === 'out' && x.kind === j.kind).map((x) => [x.id, x.name])]);
      const here = j.module === 'synth' ? o.synthCablesBox : j.module === 'seq' || j.module === 'rackdelay' ? o.rackCablesBox : j.module === 'keys' ? o.keysCablesBox : o.cablesBox;
      assert.deepEqual(boxes.map((box) => box.findAll((c) => c === select).length), boxes.map((box) => (box === here ? 1 : 0)), j.id);
    }
    assert.deepEqual(o.rackCablesBox.findAll((c) => c.tagName === 'SELECT').map((s) => s.getAttribute('name')), ['seq.clock', 'rackdelay.in'], "the sequencer's clock in and the delay's in, the rack's");
    assert.deepEqual(o.keysCablesBox.findAll((c) => c.tagName === 'SELECT').map((s) => s.getAttribute('name')), ['keys.rotary'], "the rotary speaker's speed in, the keyboard's");
    assert.equal(o.keysPart.children.at(-1), o.keysCablesBox, 'last in Keys');
    for (const id of ['delay.in', 'rackdelay.in']) {
      const outs = o.plugs.get(id).children.map((c) => c.getAttribute('value'));
      assert.ok(outs.includes('synth.out') && outs.includes('keys.out'), `the synth's sound and the keyboard's into ${id} too`);
    }
    assert.deepEqual(o.plugs.get('rackdelay.in').parentNode.children[0].textContent, 'Rack delay in');
    const mods = ['Nothing', 'Synth LFO out', 'Synth filter envelope out', 'Rack LFO out'];
    assert.deepEqual(o.plugs.get('synth.pitch').children.map((c) => c.textContent), mods);
    assert.deepEqual(o.plugs.get('keys.rotary').children.map((c) => c.textContent), mods, 'whose each is, said');
    assert.deepEqual(o.plugs.get('keys.rotary').parentNode.children[0].textContent, 'Rotary speed in');
    assert.deepEqual(o.plugs.get('synth.notes').children.map((c) => c.textContent), ['Nothing', 'Sequencer notes out', 'Keyboard notes out']);
    assert.deepEqual(o.plugs.get('seq.clock').children.map((c) => c.getAttribute('value')), ['', 'clock.x1', 'clock.d2', 'clock.d4', 'rack.x1', 'rack.d2', 'rack.d4'], "the board's clock or the rack's");
    const patch = new Patch({ storage: null });
    patch.plug('pad.snare', 'delay.in');
    patch.plug('synth.lfo', 'synth.cutoff');
    patch.plug('lfo.out', 'keys.rotary');
    o.setPatch(patch);
    assert.deepEqual(['drums.clock', 'delay.in', 'synth.clock', 'synth.pitch', 'synth.cutoff', 'synth.notes', 'seq.clock', 'rackdelay.in', 'keys.rotary'].map((id) => o.plugs.get(id).value),
      ['clock.x1', 'pad.snare', 'clock.x1', '', 'synth.lfo', 'seq.notes', 'rack.x1', '', 'lfo.out']);
    o.plugs.get('drums.clock').value = 'clock.d4';
    o.plugs.get('drums.clock').fire('change');
    o.plugs.get('delay.in').value = '';
    o.plugs.get('delay.in').fire('change');
    o.plugs.get('synth.amp').value = 'synth.env';
    o.plugs.get('synth.amp').fire('change');
    o.plugs.get('seq.clock').value = 'clock.d2';
    o.plugs.get('seq.clock').fire('change');
    o.plugs.get('rackdelay.in').value = 'synth.out';
    o.plugs.get('rackdelay.in').fire('change');
    o.plugs.get('synth.cutoff').value = 'lfo.out';
    o.plugs.get('synth.cutoff').fire('change');
    o.plugs.get('keys.rotary').value = 'synth.env';
    o.plugs.get('keys.rotary').fire('change');
    o.plugs.get('synth.notes').value = 'keys.notes';
    o.plugs.get('synth.notes').fire('change');
    assert.deepEqual(calls, [['onPlug', 'drums.clock', 'clock.d4'], ['onPlug', 'delay.in', null], ['onPlug', 'synth.amp', 'synth.env'], ['onPlug', 'seq.clock', 'clock.d2'],
      ['onPlug', 'rackdelay.in', 'synth.out'], ['onPlug', 'synth.cutoff', 'lfo.out'], ['onPlug', 'keys.rotary', 'synth.env'], ['onPlug', 'synth.notes', 'keys.notes']]);
  } finally {
    remove();
  }
});

test('Synth, Rack, Keys and Sound open and close in the card, beside Drums', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    assert.deepEqual(o.drumsToggle.parentNode.children.map((c) => c.textContent), ['Start shared session', 'Drums', 'Synth', 'Rack', 'Keys', 'Sound', 'Settings']);
    for (const [toggle, part, id, open] of [[o.synthToggle, o.synth, 'synth', 'openSynth'], [o.rackToggle, o.rack, 'rack', 'openRack'], [o.keysToggle, o.keysPart, 'keys', 'openKeys'], [o.soundToggle, o.sound, 'sound', 'openSound']]) {
      assert.deepEqual([toggle.getAttribute('aria-controls'), part.getAttribute('id'), part.hidden], [id, id, true]);
      toggle.fire('click');
      assert.deepEqual([part.hidden, toggle.getAttribute('aria-expanded')], [false, 'true']);
      toggle.fire('click');
      assert.deepEqual([part.hidden, toggle.getAttribute('aria-expanded')], [true, 'false']);
      o[open](true);
      assert.equal(part.hidden, false);
    }
    assert.equal(o.sound.findAll((c) => c === o.volume || c === o.mute || c === o.midiBox).length, 3, 'the volume, Mute and MIDI are Sound\'s');
    assert.equal(o.drums.findAll((c) => c === o.volume).length, 0);
  } finally {
    remove();
  }
});

test('the synth\'s keys: a button each, named for its note, the Cs by the note written on them, sounding while pressed, and a moment for a key or a screen reader', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.keys.length, KEYS);
    assert.deepEqual([o.keyboard.getAttribute('role'), o.keyboard.getAttribute('aria-label')], ['group', 'Keys']);
    for (const [k, b] of o.keys.entries()) {
      const n = LOWEST + k;
      // A C's name is its text (WCAG's label in name), the rest's as said.
      assert.deepEqual([b.tagName, b.getAttribute('type'), b.getAttribute('aria-label')], ['BUTTON', 'button', n % 12 ? spokenNote(n) : null]);
      assert.equal(b.classList.contains('black'), isBlack(n));
      assert.equal(b.textContent, n % 12 ? '' : noteName(n));
      assert.equal(b.getAttribute('tabindex'), k ? '-1' : '0', 'one stop among them');
    }
    // Pressed: it sounds from the press until it is let go; the click that ends the press adds nothing,
    // nor does the capture lost after it.
    const c4 = o.keys[12];
    c4.fire('pointerdown', { button: 0, pointerId: 1 });
    c4.fire('pointerup', { pointerId: 1 });
    c4.fire('lostpointercapture', { pointerId: 1 });
    c4.fire('click');
    // Two fingers at once, one taken away by the browser (a swipe that scrolls the keys).
    o.keys[16].fire('pointerdown', { button: 0, pointerId: 2 });
    o.keys[19].fire('pointerdown', { button: 0, pointerId: 3 });
    o.keys[19].fire('pointercancel', { pointerId: 3 });
    o.keys[16].fire('pointerup', { pointerId: 2 });
    o.keys[16].fire('click');
    // A key's Enter or Space, or a screen reader: the click alone, a moment.
    o.keys[0].fire('click');
    // The right button, nothing.
    o.keys[1].fire('pointerdown', { button: 2, pointerId: 4 });
    assert.deepEqual(calls, [['onKeyDown', 12, 0.85], ['onKeyUp', 12], ['onKeyDown', 16, 0.85], ['onKeyDown', 19, 0.85], ['onKeyUp', 19], ['onKeyUp', 16], ['onKeyTap', 0]]);
    // The notes down marked on their keys, the octave as it is.
    o.setNotes(new Set([LOWEST + 12, LOWEST + 16]), LOWEST);
    assert.deepEqual(marked(o.keys, 'down'), [12, 16]);
    o.setNotes(new Set([LOWEST + 12]), LOWEST - 12);
    assert.deepEqual(marked(o.keys, 'down'), [24], 'an octave down, middle C is higher on the keys');
  } finally {
    remove();
  }
});

test('the synth\'s keys are one stop: the arrows, Home and End go along them, the stop with the focus', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    const key = (name, from) => {
      const did = [];
      o.keyboard.fire('keydown', { key: name, target: o.keys[from], preventDefault: () => did.push('default'), stopPropagation: () => did.push('stop') });
      return did;
    };
    const stop = () => o.keys.findIndex((b) => b.getAttribute('tabindex') === '0');
    assert.deepEqual(key('ArrowRight', 0), ['default', 'stop'], 'the arrows its own, not walking\'s');
    assert.deepEqual([o.keys.indexOf(document.activeElement), stop()], [1, 1]);
    key('End', 1);
    assert.deepEqual([o.keys.indexOf(document.activeElement), stop()], [KEYS - 1, KEYS - 1]);
    key('ArrowRight', KEYS - 1);
    assert.equal(o.keys.indexOf(document.activeElement), KEYS - 1, 'not past the last');
    key('Home', KEYS - 1);
    key('ArrowLeft', 0);
    assert.deepEqual([o.keys.indexOf(document.activeElement), stop()], [0, 0]);
    assert.deepEqual(key('a', 0), [], 'another key is the page\'s');
    assert.deepEqual(key('ArrowUp', 0), []);
  } finally {
    remove();
  }
});

test('the synth\'s sounds: the presets a choice (poly, then mono), Mono, As it comes and the octave, as the synth is', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.presetsBox.tagName, 'FIELDSET');
    assert.deepEqual([...o.presetInputs.keys()], PRESETS.map((p) => p.id));
    assert.deepEqual(PRESETS.map((p) => p.mono), [false, false, false, false, true, true, true, true], 'poly, then mono');
    for (const p of PRESETS) {
      const input = o.presetInputs.get(p.id);
      assert.deepEqual([input.getAttribute('type'), input.getAttribute('name')], ['radio', 'synth-preset']);
      assert.equal(input.parentNode.textContent, p.mono ? `${p.name} (mono)` : p.name);
    }
    o.setSynth({ name: 'Acid', preset: 'acid', mono: true, octave: -1, lowest: LOWEST - 12, arp: OFF });
    assert.equal(o.presetsBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Sound: Acid');
    assert.deepEqual(PRESETS.filter((p) => o.presetInputs.get(p.id).checked).map((p) => p.id), ['acid']);
    assert.equal(o.monoInput.checked, true);
    assert.deepEqual([o.octave.getAttribute('min'), o.octave.getAttribute('max'), o.octave.value], [String(OCTAVES.min), String(OCTAVES.max), '-1']);
    assert.equal(o.octaveOut.textContent, `${noteName(LOWEST - 12)}–${noteName(LOWEST - 13 + KEYS)}`);
    assert.equal(o.octave.getAttribute('aria-valuetext'), `Keys ${spokenNote(LOWEST - 12)} to ${spokenNote(LOWEST - 13 + KEYS)}`);
    assert.deepEqual(o.keys.slice(0, 2).map((b) => [b.textContent, b.getAttribute('aria-label')]),
      [[noteName(LOWEST - 12), null], ['', spokenNote(LOWEST - 11)]], 'the keys named an octave down');
    // Chosen: a preset; the one chosen, again (back to it as it comes); Mono; the octave; As it comes.
    const pad = o.presetInputs.get('pad');
    pad.fire('click');
    pad.checked = true;
    pad.fire('change');
    o.presetInputs.get('acid').fire('click');
    o.monoInput.checked = false;
    o.monoInput.fire('change');
    o.octave.value = '1';
    o.octave.fire('input');
    o.resetSynth.fire('click');
    assert.deepEqual(calls, [['onPreset', 'pad'], ['onPreset', 'acid'], ['onMono', false], ['onOctave', 1], ['onResetSynth']]);
    // Changed since: none chosen.
    o.setSynth({ name: 'Acid, changed', preset: null, mono: true, octave: 0, lowest: LOWEST, arp: OFF });
    assert.ok(PRESETS.every((p) => !o.presetInputs.get(p.id).checked));
    assert.deepEqual(o.keys.slice(0, 2).map((b) => [b.textContent, b.getAttribute('aria-label')]), [[noteName(LOWEST), null], ['', spokenNote(LOWEST + 1)]]);
  } finally {
    remove();
  }
});

test('the synth\'s arpeggiator: off or one of its ways, Hold and the octaves it plays over, as the synth is', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.deepEqual([o.arpBox.tagName, o.arpBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent], ['FIELDSET', 'Arpeggiator']);
    assert.equal(o.synth.children.indexOf(o.arpBox), o.synth.children.indexOf(o.presetsBox) + 1, 'after its sounds');
    assert.deepEqual([...o.arpInputs.keys()], ['', ...ARP_MODES.map((m) => m.id)]);
    assert.deepEqual([...o.arpInputs.values()].map((i) => [i.getAttribute('type'), i.getAttribute('name'), i.parentNode.textContent]), [
      ['radio', 'synth-arp', 'Off'], ['radio', 'synth-arp', 'Up'], ['radio', 'synth-arp', 'Down'], ['radio', 'synth-arp', 'Up and down'], ['radio', 'synth-arp', 'Random'],
    ]);
    const way = () => [...o.arpInputs].filter(([, i]) => i.checked).map(([id]) => id);
    const synth = { name: 'Brass', preset: 'brass', mono: false, octave: 0, lowest: LOWEST };
    o.setSynth({ ...synth, arp: { mode: 'updown', range: 2, hold: true } });
    assert.deepEqual([way(), o.holdInput.checked], [['updown'], true]);
    assert.deepEqual([o.arpRange.getAttribute('min'), o.arpRange.getAttribute('max'), o.arpRange.value], [String(ARP_RANGES[0]), String(ARP_RANGES.at(-1)), '2']);
    assert.deepEqual([o.arpRangeOut.textContent, o.arpRange.getAttribute('aria-valuetext')], ['2 octaves', '2 octaves']);
    o.setSynth({ ...synth, arp: OFF });
    assert.deepEqual([way(), o.holdInput.checked, o.arpRangeOut.textContent], [[''], false, '1 octave']);
    // Chosen: a way, off, Hold, the octaves.
    for (const id of ['up', '']) {
      o.arpInputs.get(id).checked = true;
      o.arpInputs.get(id).fire('change');
    }
    o.holdInput.checked = true;
    o.holdInput.fire('change');
    o.arpRange.value = '3';
    o.arpRange.fire('input');
    assert.deepEqual(calls, [['onArp', 'up'], ['onArp', null], ['onHold', true], ['onRange', 3]]);
  } finally {
    remove();
  }
});

test('the synth\'s knobs: a section each, as on its top, sliders set in words, and turned', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.deepEqual(o.sectionBoxes.map((b) => b.findAll((c) => c.tagName === 'LEGEND')[0].textContent), SECTIONS.map((s) => s.name));
    assert.deepEqual([...o.synthInputs.keys()], SYNTH_KNOBS.map((k) => k.id));
    for (const [i, s] of SECTIONS.entries()) {
      const inputs = o.sectionBoxes[i].findAll((c) => c.tagName === 'INPUT');
      assert.deepEqual(inputs, SYNTH_KNOBS.filter((k) => k.section === s.id).map((k) => o.synthInputs.get(k.id).input), s.name);
    }
    o.setSynthKnobs(DEFAULT_SYNTH);
    for (const k of SYNTH_KNOBS) {
      const { input, out } = o.synthInputs.get(k.id);
      assert.equal(input.parentNode.children[0].textContent, k.name, 'its label');
      assert.equal(input.value, String(Math.round(DEFAULT_SYNTH[k.id] * 100)));
      assert.equal(out.textContent, synthText(k.id, DEFAULT_SYNTH[k.id]));
      assert.equal(input.getAttribute('aria-valuetext'), out.textContent);
    }
    const cutoff = o.synthInputs.get('cutoff').input;
    cutoff.value = '70';
    cutoff.fire('input');
    assert.deepEqual(calls, [['onSynthKnob', 'cutoff', 0.7]]);
  } finally {
    remove();
  }
});

test('playing at the synth: its button steps away, the board\'s goes there, and the hint says how to play it', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.playSynth.fire('click');
    assert.deepEqual(calls, [['onPlaySynth']]);
    assert.equal(o.playSynth.textContent, 'Play at the synth');
    o.setHint('mouse', 0);
    o.hideHint();
    o.setPlaying('synth');
    assert.deepEqual([o.playSynth.textContent, o.play.textContent], ['Step away from the synth', 'Play at the board']);
    assert.match(o.hint.textContent, /^Play the keys from A \(white\) and W \(black\), Shift harder, or click them · Z, X: an octave down, up/);
    assert.ok(!o.hint.classList.contains('gone'), 'shown again');
    for (const [how, words] of [['touch', /^Touch the keys.* slide along them/], ['gamepad', /A plays the key in the middle, presses a button/], ['tv', /^Arrows: choose a key, up and down an octave · OK: play it · Back: step away · Menu: its sounds/]]) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, words, how);
    }
    o.setPlaying('board');
    assert.deepEqual([o.playSynth.textContent, o.play.textContent], ['Play at the synth', 'Step away from the board']);
    assert.match(o.hint.textContent, /^Arrows: choose a pad/);
    o.setPlaying(null);
    assert.deepEqual([o.playSynth.textContent, o.play.textContent], ['Play at the synth', 'Play at the board']);
    assert.match(o.hint.textContent, /^Arrows: walk and turn/);
  } finally {
    remove();
  }
});

test('the sound: the volume a slider in percent, Mute a checkbox', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.setSound({ volume: 0.8, muted: false });
    assert.deepEqual([o.volume.value, o.volumeOut.textContent, o.volume.getAttribute('aria-valuetext'), o.mute.checked], ['80', '80%', '80%', false]);
    o.setSound({ volume: 0.35, muted: true });
    assert.deepEqual([o.volume.value, o.volumeOut.textContent, o.mute.checked], ['35', '35%', true]);
    o.volume.value = '60';
    o.volume.fire('input');
    o.mute.checked = false;
    o.mute.fire('change');
    assert.deepEqual(calls, [['onVolume', 0.6], ['onMute', false]]);
  } finally {
    remove();
  }
});

test('MIDI only where the browser has it: its button, and what it hears said as it changes', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.midiBox.hidden, true);
    o.showMidi();
    assert.equal(o.midiBox.hidden, false);
    o.midi.fire('click');
    assert.deepEqual(calls, [['onMidi']]);
    assert.equal(o.midiStatus.getAttribute('role'), 'status');
    o.setMidi('Playing from MPD218');
    assert.equal(o.midiStatus.textContent, 'Playing from MPD218');
  } finally {
    remove();
  }
});

test('playing at the board: the button steps away, and the hint says how to play, on each device', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.play.fire('click');
    assert.deepEqual(calls, [['onPlay']]);
    assert.equal(o.play.textContent, 'Play at the board');
    const walking = {};
    for (const how of ['mouse', 'touch', 'gamepad', 'tv']) {
      o.setHint(how, 0);
      walking[how] = o.hint.textContent;
      assert.match(walking[how], /the drums/, how);
    }
    o.setHint('mouse', 0);
    o.hideHint();
    o.setPlaying('board');
    assert.equal(o.play.textContent, 'Step away from the board');
    assert.match(o.hint.textContent, /^Click the pads, or press 1–4, Q–R and A–F/);
    assert.ok(!o.hint.classList.contains('gone'), 'shown again');
    assert.match(o.hint.textContent, /click the step keys · Space: the clock · .* click two jacks to patch · Esc steps away$/);
    for (const [how, words] of [['touch', /^Tap the pads.* the step keys .* tap two jacks to patch/],['gamepad', /A plays the pad in the middle, sets a step, takes or plugs in a cable/], ['tv', /^Arrows: choose a pad · OK: play it · Play\/pause: the clock · Back: step away · Menu: its steps/]]) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, words, how);
    }
    // In the card on a TV, the card's own hint.
    o.setHint('tv-card', 0);
    assert.match(o.hint.textContent, /Back: walk again$/);
    o.setHint('touch', 0);
    o.setPlaying(null);
    assert.equal(o.hint.textContent, walking.touch);
    assert.equal(o.play.textContent, 'Play at the board');
  } finally {
    remove();
  }
});

test('with no 3D view, the drums, the synth, the rack, the keys and the sound stay in the card, open, each under its name, with nothing to go to', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    o.noWebGL('This browser cannot show the room in 3D, but its drums, its synth, its sequencer and its keys play here in the card.');
    assert.equal(o.inRoom.parentNode, null, 'the session and the settings are gone');
    for (const [name, part] of [['Drums', o.drums], ['Synth', o.synth], ['Rack', o.rack], ['Keys', o.keysPart], ['Sound', o.sound]]) {
      assert.equal(part.hidden, false, name);
      assert.equal(o.card.findAll((c) => c === part).length, 1, name);
      const title = part.parentNode.children[0];
      assert.deepEqual([title.tagName, title.textContent], ['H2', name], 'under its name');
    }
    assert.equal(o.drums.findAll((c) => c === o.play).length, 0);
    assert.equal(o.synth.findAll((c) => c === o.playSynth).length, 0);
    assert.equal(o.rack.findAll((c) => c === o.playRack).length, 0);
    assert.equal(o.drums.findAll((c) => c.className === 'pad').length, PADS.length);
    for (const box of [o.clockBox, o.stepsBox, o.knobsBox, o.delayBox, o.cablesBox]) assert.equal(o.drums.findAll((c) => c === box).length, 1, 'the clock, the steps, the knobs, the delay and the cables too');
    for (const box of [o.keyboard, o.presetsBox, o.arpBox, ...o.sectionBoxes, o.synthCablesBox]) assert.equal(o.synth.findAll((c) => c === box).length, 1, 'the keys, the sounds, the arpeggiator, the knobs and the cables');
    for (const box of [o.rackClockBox, o.seqBox, o.rackDelayBox, o.lfoBox, o.rackCablesBox]) assert.equal(o.rack.findAll((c) => c === box).length, 1, 'its clock, the sequencer, the delay, the LFO and the cables');
    assert.equal(o.keysPart.findAll((c) => c === o.playKeys).length, 0);
    for (const box of [o.keysRow, o.keysSoundBox, o.percBox, ...o.keysSectionBoxes, o.keysCablesBox]) assert.equal(o.keysPart.findAll((c) => c === box).length, 1, 'the keys, the sound, the percussion, the drawbars, the knobs and the cables');
  } finally {
    remove();
  }
});

test('the keyboard\'s keys: sixty-one from C2, as the synth\'s, sounding while pressed, those down marked', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.keysKeys.length, KEYS_COUNT);
    assert.deepEqual([o.keysRow.getAttribute('role'), o.keysRow.getAttribute('aria-label'), o.keysRow.className], ['group', 'Keys', 'keyboard']);
    assert.equal(o.keysPart.children.indexOf(o.keysRow), 1, 'after going to play at it');
    for (const [k, b] of o.keysKeys.entries()) {
      const n = KEYS_LOWEST + k;
      assert.deepEqual([b.getAttribute('aria-label'), b.textContent], n % 12 ? [spokenNote(n), ''] : [null, noteName(n)]);
      assert.equal(b.classList.contains('black'), isBlack(n));
      assert.equal(b.getAttribute('tabindex'), k ? '-1' : '0', 'one stop among them');
    }
    assert.deepEqual([o.keysKeys[0].textContent, o.keysKeys[KEYS_COUNT - 1].textContent], ['C2', 'C7']);
    const c4 = o.keysKeys[24];
    c4.fire('pointerdown', { button: 0, pointerId: 1 });
    c4.fire('pointerup', { pointerId: 1 });
    c4.fire('click');
    o.keysKeys[60].fire('click');
    assert.deepEqual(calls, [['onKeysDown', 24, 0.85], ['onKeysUp', 24], ['onKeysTap', 60]]);
    // Their own stop: the arrows go along them, not the synth's.
    o.keysRow.fire('keydown', { key: 'End', target: o.keysKeys[0], preventDefault() {}, stopPropagation() {} });
    assert.equal(o.keysKeys.indexOf(document.activeElement), KEYS_COUNT - 1);
    assert.equal(o.keys.findIndex((b) => b.getAttribute('tabindex') === '0'), 0, 'the synth\'s stop where it was');
    o.setKeysNotes(new Set([60, 64, 67, 20]));
    assert.deepEqual(marked(o.keysKeys, 'down'), [24, 28, 31], 'a note off the keyboard marks nothing');
    o.setKeysNotes(new Set());
    assert.deepEqual(marked(o.keysKeys, 'down'), []);
  } finally {
    remove();
  }
});

test('the keyboard\'s sound: the organ, the electric piano or both, Sustain, As it comes, and the octave the computer\'s keys play in', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.keysSoundBox.tagName, 'FIELDSET');
    assert.deepEqual([...o.keysSoundInputs.keys()], KEYS_SOUNDS.map((s) => s.id));
    assert.deepEqual([...o.keysSoundInputs.values()].map((i) => [i.getAttribute('type'), i.getAttribute('name'), i.parentNode.textContent]),
      [['radio', 'keys-sound', 'Organ'], ['radio', 'keys-sound', 'Electric piano'], ['radio', 'keys-sound', 'Both']]);
    const state = { name: 'Organ and electric piano', choice: 'both', sustain: true, switches: DEFAULT_SWITCHES, octave: -1 };
    o.setKeys(state);
    assert.equal(o.keysSoundBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Sound: Organ and electric piano');
    assert.deepEqual([...o.keysSoundInputs].filter(([, i]) => i.checked).map(([id]) => id), ['both']);
    assert.equal(o.sustainInput.checked, true);
    assert.equal(o.sustainInput.parentNode.textContent, 'Sustain');
    assert.deepEqual([o.keysOctave.getAttribute('min'), o.keysOctave.getAttribute('max'), o.keysOctave.value], [String(KEYS_OCTAVES.min), String(KEYS_OCTAVES.max), '-1']);
    assert.deepEqual([o.keysOctaveOut.textContent, o.keysOctave.getAttribute('aria-valuetext')], ['C3–F4', "Computer's keys C 3 to F 4"]);
    o.setKeys({ ...state, name: 'Organ', choice: 'organ', sustain: false, octave: 0 });
    assert.deepEqual([[...o.keysSoundInputs].filter(([, i]) => i.checked).map(([id]) => id), o.sustainInput.checked, o.keysOctaveOut.textContent], [['organ'], false, 'C4–F5']);
    const piano = o.keysSoundInputs.get('epiano');
    piano.checked = true;
    piano.fire('change');
    o.sustainInput.checked = true;
    o.sustainInput.fire('change');
    o.keysOctave.value = '1';
    o.keysOctave.fire('input');
    o.resetKeys.fire('click');
    assert.deepEqual(calls, [['onKeysSound', 'epiano'], ['onSustain', true], ['onKeysOctave', 1], ['onResetKeys']]);
  } finally {
    remove();
  }
});

test('the keyboard\'s drawbars in eighths, as an organist writes them; its percussion\'s switches; its knobs a section each, the rotary speaker\'s switch with the organ\'s', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.deepEqual(o.keysSectionBoxes.map((b) => b.findAll((c) => c.tagName === 'LEGEND')[0].textContent), ['Drawbars: 88 8000 000', 'Organ', 'Electric piano']);
    assert.deepEqual([...o.keysInputs.keys()], KEYS_KNOBS.map((k) => k.id));
    for (const [i, s] of KEYS_SECTIONS.entries()) {
      const sliders = o.keysSectionBoxes[i].findAll((c) => c.tagName === 'INPUT' && c.getAttribute('type') === 'range');
      assert.deepEqual(sliders, KEYS_KNOBS.filter((k) => k.section === s.id).map((k) => o.keysInputs.get(k.id).input), s.name);
    }
    // In the part: the drawbars after the sound, the percussion after them, then the organ's and the piano's knobs.
    const order = [o.keysSoundBox, o.keysSectionBoxes[0], o.percBox, o.keysSectionBoxes[1], o.keysSectionBoxes[2]].map((b) => o.keysPart.children.indexOf(b));
    assert.deepEqual(order, [2, 3, 4, 5, 6]);
    for (const id of DRAWBARS) {
      const { input } = o.keysInputs.get(id);
      assert.deepEqual([input.getAttribute('min'), input.getAttribute('max'), input.getAttribute('step')], ['0', '8', '1'], id);
    }
    o.setKeysKnobs({ ...DEFAULT_KEYS, d4: 0.75, chorus: 0 });
    assert.equal(o.registration.textContent, '88 8600 000');
    for (const k of KEYS_KNOBS) {
      const { input, out } = o.keysInputs.get(k.id);
      const v = k.id === 'd4' ? 0.75 : k.id === 'chorus' ? 0 : DEFAULT_KEYS[k.id];
      assert.equal(input.parentNode.children[0].textContent, k.name, 'its label');
      assert.equal(input.value, String(DRAWBARS.includes(k.id) ? Math.round(v * 8) : Math.round(v * 100)), k.id);
      assert.deepEqual([out.textContent, input.getAttribute('aria-valuetext')], [keysText(k.id, v), keysText(k.id, v)], k.id);
    }
    assert.equal(o.keysInputs.get('chorus').out.textContent, 'off');
    // The switches: the percussion's three together, the rotary speaker's with the organ's knobs.
    assert.deepEqual(o.percBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Percussion');
    assert.deepEqual([...o.switchInputs.keys()], ['rotaryFast', 'perc', 'third', 'fast']);
    for (const s of KEYS_SWITCHES) {
      const input = o.switchInputs.get(s.id);
      assert.deepEqual([input.getAttribute('type'), input.parentNode.textContent], ['checkbox', s.name]);
      const box = s.id === 'rotaryFast' ? o.keysSectionBoxes[1] : o.percBox;
      assert.equal(box.findAll((c) => c === input).length, 1, s.id);
    }
    o.setKeys({ name: 'Organ', choice: 'organ', sustain: false, switches: { perc: false, third: true, fast: false, rotaryFast: true }, octave: 0 });
    assert.deepEqual(KEYS_SWITCHES.map((s) => o.switchInputs.get(s.id).checked), [false, true, false, true]);
    // Pulled out, turned, switched.
    const d8 = o.keysInputs.get('d8').input;
    d8.value = '6';
    d8.fire('input');
    const tone = o.keysInputs.get('tone').input;
    tone.value = '30';
    tone.fire('input');
    const third = o.switchInputs.get('third');
    third.checked = false;
    third.fire('change');
    assert.deepEqual(calls, [['onKeysKnob', 'd8', 0.75], ['onKeysKnob', 'tone', 0.3], ['onKeysSwitch', 'third', false]]);
  } finally {
    remove();
  }
});

test('playing at the keys: its button steps away, the others go there, and the hint says how to play them', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.playKeys.fire('click');
    assert.deepEqual(calls, [['onPlayKeys']]);
    assert.equal(o.playKeys.textContent, 'Play at the keys');
    assert.equal(o.keysPart.children.indexOf(o.playKeys.parentNode), 0);
    for (const how of ['mouse', 'touch', 'gamepad', 'tv']) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, /the rack,? or the keys|the rack, the keys/, `${how}: walking, the keys named`);
    }
    o.setHint('mouse', 0);
    o.hideHint();
    o.setPlaying('keys');
    assert.deepEqual([o.playKeys.textContent, o.playSynth.textContent, o.play.textContent, o.playRack.textContent], ['Step away from the keys', 'Play at the synth', 'Play at the board', 'Play at the rack']);
    assert.match(o.hint.textContent, /^Play the keys from A \(white\) and W \(black\), Shift harder, or click them · Z, X: an octave down, up · drag a drawbar, drag or scroll a knob · Esc steps away$/);
    assert.ok(!o.hint.classList.contains('gone'), 'shown again');
    for (const [how, words] of [['touch', /^Touch the keys.* drag a drawbar or a knob/], ['gamepad', /A plays the key in the middle, sets a drawbar, presses a button/],
      ['tv', /^Arrows: choose a key, up and down an octave · OK: play it · Back: step away · Menu: its sounds, drawbars and knobs$/]]) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, words, how);
    }
    o.setPlaying('synth');
    assert.deepEqual([o.playKeys.textContent, o.playSynth.textContent], ['Play at the keys', 'Step away from the synth']);
    o.setPlaying(null);
    assert.equal(o.playKeys.textContent, 'Play at the keys');
  } finally {
    remove();
  }
});

test('the rack\'s clock: the room\'s again, its Start and tempo as the board\'s are', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.rack.children.indexOf(o.rackClockBox), 1, 'after going to play at it');
    assert.equal(o.rackClockBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent, 'Clock');
    o.setRunning(true);
    o.setTempo(132);
    assert.deepEqual([o.run.textContent, o.rackRun.textContent], ['Stop', 'Stop']);
    assert.deepEqual([o.rackTempo.value, o.rackTempoOut.textContent, o.rackTempo.getAttribute('aria-valuetext')], ['132', '132 BPM', '132 beats a minute']);
    assert.deepEqual([o.rackTempo.getAttribute('min'), o.rackTempo.getAttribute('max')], [String(TEMPO.min), String(TEMPO.max)]);
    o.setRunning(false);
    assert.deepEqual([o.run.textContent, o.rackRun.textContent], ['Start', 'Start']);
    o.rackRun.fire('click');
    o.rackTempo.value = '100';
    o.rackTempo.fire('input');
    assert.deepEqual(calls, [['onRun'], ['onTempo', 100]]);
  } finally {
    remove();
  }
});

test('the sequencer: a row for each step, its number pressed where it plays, its note a choice, its accent and its slide toggles, each named by its words', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.deepEqual([o.seqBox.tagName, o.seqBox.findAll((c) => c.tagName === 'LEGEND')[0].textContent], ['FIELDSET', 'Sequencer']);
    assert.equal(o.seqSteps.length, STEPS);
    const seq = new Seq({ storage: null });
    o.setSeq(seq.steps, seq.lowest, seq.octave);
    for (const [s, { row, on, note, accent, slide }] of o.seqSteps.entries()) {
      const n = s + 1;
      assert.deepEqual(row.children, [on, note, accent, slide], 'a row: the step, its note, its accent, its slide');
      assert.equal(row.classList.contains('beat'), s % 4 === 0, "a beat's first step");
      // Each named by its words, the step's out of sight (WCAG's label in name).
      for (const [b, name, hidden] of [[on, `Step ${n}`, 'Step '], [accent, `Accent, step ${n}`, `, step ${n}`], [slide, `Slide, step ${n}`, `, step ${n}`]]) {
        assert.deepEqual([b.tagName, b.getAttribute('type'), b.getAttribute('aria-label'), b.textContent], ['BUTTON', 'button', null, name]);
        assert.deepEqual(b.findAll((c) => c.className === 'sr-only').map((c) => c.textContent), [hidden], 'the step out of sight, the rest its words');
      }
      assert.deepEqual([note.tagName, note.getAttribute('aria-label')], ['SELECT', `Note, step ${n}`]);
      assert.deepEqual(note.children.map((c) => [c.getAttribute('value'), c.textContent]), Array.from({ length: SEQ_RANGE + 1 }, (_, i) => [String(i), noteName(SEQ_LOWEST + i)]));
      // As the line is.
      assert.deepEqual([on, accent, slide].map((b) => b.getAttribute('aria-pressed')), [DEFAULT_LINE.on[s], DEFAULT_LINE.accent[s], DEFAULT_LINE.slide[s]].map((c) => String(c === 'x')));
      assert.equal(note.value, String(DEFAULT_LINE.notes[s]));
    }
    // Pressed: a step's number, its accent, its slide; a note chosen; Clear and the line as it comes.
    o.seqSteps[4].on.fire('click');
    o.seqSteps[0].accent.fire('click');
    o.seqSteps[15].slide.fire('click');
    o.seqSteps[2].note.value = '19';
    o.seqSteps[2].note.fire('change');
    o.clearSeq.fire('click');
    o.resetSeq.fire('click');
    assert.deepEqual(calls, [['onSeqKey', 'seq', 4], ['onSeqKey', 'accent', 0], ['onSeqKey', 'slide', 15], ['onSeqNote', 2, 19], ['onClearSeq'], ['onResetSeq']]);
    // Changed: as it is now.
    seq.toggle(4);
    seq.toggleSlide(15);
    seq.setNote(2, 19);
    o.setSeq(seq.steps, seq.lowest, seq.octave);
    assert.deepEqual([o.seqSteps[4].on.getAttribute('aria-pressed'), o.seqSteps[15].slide.getAttribute('aria-pressed'), o.seqSteps[2].note.value], ['true', 'true', '19']);
    // The step playing marked, on its row; seen, not said.
    o.setSeqPlayhead(3);
    o.setSeqPlayhead(6);
    assert.deepEqual(marked(o.seqSteps.map((r) => r.row), 'now'), [6]);
    o.setSeqPlayhead(-1);
    assert.deepEqual(marked(o.seqSteps.map((r) => r.row), 'now'), []);
  } finally {
    remove();
  }
});

test('the sequencer\'s octave: a slider, the notes it reaches in words, the choices named from them', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    const seq = new Seq({ storage: null });
    o.setSeq(seq.steps, seq.lowest, seq.octave);
    assert.deepEqual([o.seqOctave.getAttribute('min'), o.seqOctave.getAttribute('max'), o.seqOctave.value], [String(SEQ_OCTAVES.min), String(SEQ_OCTAVES.max), '0']);
    assert.deepEqual([o.seqOctaveOut.textContent, o.seqOctave.getAttribute('aria-valuetext')], ['C2–C4', 'Notes C 2 to C 4']);
    seq.setOctave(1);
    o.setSeq(seq.steps, seq.lowest, seq.octave);
    assert.deepEqual([o.seqOctave.value, o.seqOctaveOut.textContent, o.seqOctave.getAttribute('aria-valuetext')], ['1', 'C3–C5', 'Notes C 3 to C 5']);
    assert.deepEqual(o.seqSteps[0].note.children.slice(0, 2).map((c) => c.textContent), ['C3', noteName(49)], 'the choices an octave up');
    o.seqOctave.value = '-1';
    o.seqOctave.fire('input');
    assert.deepEqual(calls, [['onSeqOctave', -1]]);
    assert.equal(o.seqBox.children.indexOf(o.seqOctave.parentNode), 2, 'under the steps');
  } finally {
    remove();
  }
});

test('playing at the rack: its button steps away, the others go there, and the hint says how to play its sequencer', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    o.playRack.fire('click');
    assert.deepEqual(calls, [['onPlayRack']]);
    assert.equal(o.playRack.textContent, 'Play at the rack');
    o.setHint('mouse', 0);
    for (const how of ['mouse', 'touch', 'gamepad', 'tv']) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, /the rack/, `${how}: walking, the rack named`);
    }
    o.setHint('mouse', 0);
    o.hideHint();
    o.setPlaying('rack');
    assert.deepEqual([o.playRack.textContent, o.playSynth.textContent, o.play.textContent], ['Step away from the rack', 'Play at the synth', 'Play at the board']);
    assert.match(o.hint.textContent, /^Click the keys, or press 1–8 and Q–I \(Shift: its accent\) · .* Z, X: an octave down, up · Space: the clock · Esc steps away$/);
    assert.ok(!o.hint.classList.contains('gone'), 'shown again');
    for (const [how, words] of [['touch', /^Tap a step's key, its accent's or its slide's · drag a step's knob: its note/], ['gamepad', /A sets the key in the middle, presses a button, takes or plugs in a cable/],
      ['tv', /^Left, right: choose a step · up, down: its note · OK: it plays, or rests · Play\/pause: the clock · Back: step away · Menu: its steps/]]) {
      o.setHint(how, 0);
      assert.match(o.hint.textContent, words, how);
    }
    o.setPlaying('synth');
    assert.deepEqual([o.playRack.textContent, o.playSynth.textContent], ['Play at the rack', 'Step away from the synth']);
    o.setPlaying(null);
    assert.equal(o.playRack.textContent, 'Play at the rack');
    assert.match(o.hint.textContent, /^Arrows: walk and turn · OK: the drums, the synth, the rack/);
  } finally {
    remove();
  }
});
