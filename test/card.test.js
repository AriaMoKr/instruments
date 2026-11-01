// The drums in the card (overlay.js): every pad a button that plays as it is pressed (and once, for a
// key or a screen reader), in the board's rows; the clock's Start and tempo; the steps of the pad
// last played as toggles, the one playing marked; its knobs, the delay's and the volume as sliders
// with their settings in words; the cables as a choice for each input; Mute; MIDI where there is Web
// MIDI; playing at the board and stepping away, with its hint; and the drums kept, open, where there
// is no 3D view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { KNOBS, PADS, keyLabel, knobText } from '../public/js/drums.js';
import { TEMPO } from '../public/js/clock.js';
import { STEPS } from '../public/js/pattern.js';
import { DELAY_KNOBS, MAX_STEPS, delayText } from '../public/js/delay.js';
import { JACKS, Patch } from '../public/js/patch.js';
import { installDom } from './helpers/dom.js';

const way = { url: 'https://ariamokr.github.io/hallway/?from=instruments', label: '← Hallway', title: 'Back to the Hallway' };

/** A card in a fake page, and what it calls. */
async function card(options = {}) {
  const { Overlay } = await import('../public/js/overlay.js');
  const o = new Overlay({ ...ROOM, pieces: [] }, way, options);
  const calls = [];
  for (const name of ['onPad', 'onPlay', 'onKnob', 'onResetKnobs', 'onVolume', 'onMute', 'onMidi', 'onRun', 'onTempo', 'onStep', 'onClearSteps', 'onResetPattern', 'onDelay', 'onResetDelay', 'onPlug']) o[name] = (...args) => calls.push([name, ...args]);
  return { o, calls };
}

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
    assert.deepEqual(o.steps.map((b) => b.classList.contains('now')).flatMap((on, s) => (on ? [s] : [])), [4]);
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

test('the cables: each input a choice of the outputs of its kind, or nothing, as the patch is', async () => {
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
    }
    const patch = new Patch({ storage: null });
    patch.plug('pad.snare', 'delay.in');
    o.setPatch(patch);
    assert.deepEqual([o.plugs.get('drums.clock').value, o.plugs.get('delay.in').value], ['clock.x1', 'pad.snare']);
    o.plugs.get('drums.clock').value = 'clock.d4';
    o.plugs.get('drums.clock').fire('change');
    o.plugs.get('delay.in').value = '';
    o.plugs.get('delay.in').fire('change');
    assert.deepEqual(calls, [['onPlug', 'drums.clock', 'clock.d4'], ['onPlug', 'delay.in', null]]);
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
    o.setPlaying(true);
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
    o.setPlaying(false);
    assert.equal(o.hint.textContent, walking.touch);
    assert.equal(o.play.textContent, 'Play at the board');
  } finally {
    remove();
  }
});

test('with no 3D view, the drums stay in the card, open, with no board to go to', async () => {
  const remove = installDom();
  try {
    const { o } = await card();
    o.noWebGL('This browser cannot show the room in 3D, but its drums play here in the card.');
    assert.equal(o.inRoom.parentNode, null, 'the session and the settings are gone');
    assert.equal(o.drums.hidden, false);
    assert.ok(o.card.findAll((c) => c === o.drums).length === 1);
    assert.equal(o.drums.findAll((c) => c === o.play).length, 0);
    assert.equal(o.drums.findAll((c) => c.className === 'pad').length, PADS.length);
    for (const box of [o.clockBox, o.stepsBox, o.knobsBox, o.delayBox, o.cablesBox]) assert.equal(o.drums.findAll((c) => c === box).length, 1, 'the clock, the steps, the knobs, the delay and the cables too');
  } finally {
    remove();
  }
});
