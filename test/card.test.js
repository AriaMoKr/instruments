// The instruments in the card (overlay.js). The drums: every pad a button that plays as it is pressed
// (and once, for a key or a screen reader), in the board's rows; the clock's Start and tempo; the
// steps of the pad last played as toggles, the one playing marked; its knobs and the delay's as
// sliders with their settings in words; the cables as a choice for each input. The synth: its keys,
// each sounding while pressed, one stop among them; its sounds (the presets, Mono, the octave), its
// arpeggiator, its knobs, a section each, and its cables. Sound: the volume, Mute, and MIDI where
// there is Web MIDI. Playing at the board or the synth and stepping away, with its hint; and all
// three kept, open, where there is no 3D view.
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
import { installDom } from './helpers/dom.js';

const way = { url: 'https://ariamokr.github.io/hallway/?from=instruments', label: '← Hallway', title: 'Back to the Hallway' };

/** A card in a fake page, and what it calls. */
async function card(options = {}) {
  const { Overlay } = await import('../public/js/overlay.js');
  const o = new Overlay({ ...ROOM, pieces: [] }, way, options);
  const calls = [];
  for (const name of ['onPad', 'onPlay', 'onKnob', 'onResetKnobs', 'onVolume', 'onMute', 'onMidi', 'onRun', 'onTempo', 'onStep', 'onClearSteps', 'onResetPattern', 'onDelay', 'onResetDelay', 'onPlug',
    'onPlaySynth', 'onKeyDown', 'onKeyUp', 'onKeyTap', 'onPreset', 'onMono', 'onOctave', 'onSynthKnob', 'onResetSynth', 'onArp', 'onHold', 'onRange']) o[name] = (...args) => calls.push([name, ...args]);
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

test('every pad is a button, in the board\'s rows (the farthest first), that plays as it is pressed, and once', async () => {
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
      assert.equal(b.getAttribute('aria-label'), `${p.name}, key ${keyLabel(p.key)}`);
      assert.match(b.textContent, new RegExp(`^${p.name}${keyLabel(p.key)}$`));
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

test('the cables: each input a choice of the outputs of its kind, or nothing, as the patch is; the board\'s with the drums, the synth\'s with it', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    const ins = JACKS.filter((j) => j.dir === 'in');
    assert.deepEqual([...o.plugs.keys()], ins.map((j) => j.id));
    for (const j of ins) {
      const select = o.plugs.get(j.id);
      assert.equal(select.parentNode.children[0].textContent, j.name, 'its label');
      const options = select.children.map((c) => [c.getAttribute('value'), c.textContent]);
      assert.deepEqual(options, [['', 'Nothing'], ...JACKS.filter((x) => x.dir === 'out' && x.kind === j.kind).map((x) => [x.id, x.name])]);
      const [here, there] = j.module === 'synth' ? [o.synthCablesBox, o.cablesBox] : [o.cablesBox, o.synthCablesBox];
      assert.deepEqual([here.findAll((c) => c === select).length, there.findAll((c) => c === select).length], [1, 0], j.id);
    }
    assert.ok(o.plugs.get('delay.in').children.some((c) => c.getAttribute('value') === 'synth.out'), 'the synth\'s sound into the delay too');
    assert.deepEqual(o.plugs.get('synth.pitch').children.map((c) => c.textContent), ['Nothing', 'LFO out', 'Filter envelope out']);
    const patch = new Patch({ storage: null });
    patch.plug('pad.snare', 'delay.in');
    patch.plug('synth.lfo', 'synth.cutoff');
    o.setPatch(patch);
    assert.deepEqual(['drums.clock', 'delay.in', 'synth.clock', 'synth.pitch', 'synth.cutoff'].map((id) => o.plugs.get(id).value), ['clock.x1', 'pad.snare', 'clock.x1', '', 'synth.lfo']);
    o.plugs.get('drums.clock').value = 'clock.d4';
    o.plugs.get('drums.clock').fire('change');
    o.plugs.get('delay.in').value = '';
    o.plugs.get('delay.in').fire('change');
    o.plugs.get('synth.amp').value = 'synth.env';
    o.plugs.get('synth.amp').fire('change');
    assert.deepEqual(calls, [['onPlug', 'drums.clock', 'clock.d4'], ['onPlug', 'delay.in', null], ['onPlug', 'synth.amp', 'synth.env']]);
  } finally {
    remove();
  }
});

test('Synth and Sound open and close in the card, beside Drums', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    assert.deepEqual(o.drumsToggle.parentNode.children.map((c) => c.textContent), ['Start shared session', 'Drums', 'Synth', 'Sound', 'Settings']);
    for (const [toggle, part, id, open] of [[o.synthToggle, o.synth, 'synth', 'openSynth'], [o.soundToggle, o.sound, 'sound', 'openSound']]) {
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

test('the synth\'s keys: a button each, named for its note, the Cs written on them, sounding while pressed, and a moment for a key or a screen reader', async () => {
  const remove = installDom();
  try {
    const { o, calls } = await card();
    assert.equal(o.keys.length, KEYS);
    assert.deepEqual([o.keyboard.getAttribute('role'), o.keyboard.getAttribute('aria-label')], ['group', 'Keys']);
    for (const [k, b] of o.keys.entries()) {
      const n = LOWEST + k;
      assert.deepEqual([b.tagName, b.getAttribute('type'), b.getAttribute('aria-label')], ['BUTTON', 'button', spokenNote(n)]);
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
    assert.deepEqual([o.keys[0].textContent, o.keys[0].getAttribute('aria-label')], [noteName(LOWEST - 12), spokenNote(LOWEST - 12)], 'the keys named an octave down');
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
    assert.equal(o.keys[0].getAttribute('aria-label'), spokenNote(LOWEST));
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

test('with no 3D view, the drums, the synth and the sound stay in the card, open, each under its name, with nothing to go to', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    o.noWebGL('This browser cannot show the room in 3D, but its drums and its synth play here in the card.');
    assert.equal(o.inRoom.parentNode, null, 'the session and the settings are gone');
    for (const [name, part] of [['Drums', o.drums], ['Synth', o.synth], ['Sound', o.sound]]) {
      assert.equal(part.hidden, false, name);
      assert.equal(o.card.findAll((c) => c === part).length, 1, name);
      const title = part.parentNode.children[0];
      assert.deepEqual([title.tagName, title.textContent], ['H2', name], 'under its name');
    }
    assert.equal(o.drums.findAll((c) => c === o.play).length, 0);
    assert.equal(o.synth.findAll((c) => c === o.playSynth).length, 0);
    assert.equal(o.drums.findAll((c) => c.className === 'pad').length, PADS.length);
    for (const box of [o.clockBox, o.stepsBox, o.knobsBox, o.delayBox, o.cablesBox]) assert.equal(o.drums.findAll((c) => c === box).length, 1, 'the clock, the steps, the knobs, the delay and the cables too');
    for (const box of [o.keyboard, o.presetsBox, o.arpBox, ...o.sectionBoxes, o.synthCablesBox]) assert.equal(o.synth.findAll((c) => c === box).length, 1, 'the keys, the sounds, the arpeggiator, the knobs and the cables');
  } finally {
    remove();
  }
});
