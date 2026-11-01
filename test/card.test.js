// The drums in the card (overlay.js): every pad a button that plays as it is pressed (and once, for a
// key or a screen reader), in the board's rows; the knobs of the pad last played and the volume as
// sliders with their settings in words; Mute; MIDI where there is Web MIDI; playing at the board and
// stepping away, with its hint; and the drums kept, open, where there is no 3D view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOM } from '../public/js/config.js';
import { KNOBS, PADS, keyLabel, knobText } from '../public/js/drums.js';
import { installDom } from './helpers/dom.js';

const way = { url: 'https://ariamokr.github.io/hallway/?from=instruments', label: '← Hallway', title: 'Back to the Hallway' };

/** A card in a fake page, and what it calls. */
async function card(options = {}) {
  const { Overlay } = await import('../public/js/overlay.js');
  const o = new Overlay({ ...ROOM, pieces: [] }, way, options);
  const calls = [];
  for (const name of ['onPad', 'onPlay', 'onKnob', 'onResetKnobs', 'onVolume', 'onMute', 'onMidi']) o[name] = (...args) => calls.push([name, ...args]);
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
    for (const [how, words] of [['touch', /^Tap the pads/], ['gamepad', /A plays the pad in the middle/], ['tv', /^Arrows: choose a pad · OK: play it · Back: step away/]]) {
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
  } finally {
    remove();
  }
});
