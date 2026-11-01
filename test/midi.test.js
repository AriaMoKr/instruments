// Playing from a MIDI device (midi.js): its messages read from their bytes (notes, the sustain
// pedal, the mod wheel, the pitch bend, all notes off), and every input listened to, those plugged in
// later too, on a fake Web MIDI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMidi, listenMidi, midiGranted, readMidi } from '../public/js/midi.js';

/** Puts a navigator with these on globalThis; returns the function that takes it off again. */
function withNavigator(nav) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  return () => {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    else delete globalThis.navigator;
  };
}

test('a note played: its note, its velocity 0…1 and its channel; let go, a note-on at 0 too', () => {
  assert.deepEqual(readMidi([0x90, 36, 127]), { type: 'on', note: 36, velocity: 1, channel: 0 });
  assert.deepEqual(readMidi(new Uint8Array([0x99, 38, 64])), { type: 'on', note: 38, velocity: 64 / 127, channel: 9 });
  assert.deepEqual(readMidi([0x99, 38, 0]), { type: 'off', note: 38, channel: 9 }, 'a note-on at 0 is a note-off');
  assert.deepEqual(readMidi([0x81, 60, 64]), { type: 'off', note: 60, channel: 1 });
});

test('the sustain pedal, the mod wheel, the pitch bend and all notes off; the rest are none', () => {
  assert.deepEqual(readMidi([0xb0, 64, 127]), { type: 'sustain', on: true, channel: 0 });
  assert.deepEqual(readMidi([0xb3, 64, 10]), { type: 'sustain', on: false, channel: 3 });
  assert.deepEqual(readMidi([0xb0, 1, 127]), { type: 'mod', value: 1, channel: 0 });
  assert.deepEqual([[0xe0, 0, 0], [0xe0, 0, 64], [0xe0, 127, 127]].map((d) => readMidi(d)?.type === 'bend' && readMidi(d)?.value), [-1, 0, 1], 'from all the way down to all the way up, the middle none');
  assert.deepEqual(readMidi([0xbf, 123, 0]), { type: 'alloff', channel: 15 });
  assert.deepEqual(readMidi([0xb0, 120, 0]), { type: 'alloff', channel: 0 }, 'all sound off');
  assert.equal(readMidi([0xb0, 7, 100]), null, 'the volume, its own');
  assert.equal(readMidi([0xc0, 5, 0]), null, 'a program change');
  assert.equal(readMidi([0xf8]), null, 'the clock');
  assert.equal(readMidi(null), null);
});

test('every input is listened to, one plugged in later too; its names said as they change', async () => {
  const input = (name, state = 'connected') => ({ name, state, onmidimessage: null });
  const pad = input('MPD218'), keys = input('', 'connected'), gone = input('Old', 'disconnected');
  const access = { inputs: new Map([['a', pad], ['b', keys], ['c', gone]]), onstatechange: null };
  const restore = withNavigator({ requestMIDIAccess: async () => access });
  try {
    assert.equal(hasMidi(), true);
    const heard = [], names = [];
    const got = await listenMidi((m) => heard.push(m), (n) => names.push(n));
    assert.equal(got, access);
    assert.deepEqual(names, [['MPD218', 'a MIDI device']]);
    pad.onmidimessage({ data: new Uint8Array([0x99, 36, 127]) });
    pad.onmidimessage({ data: new Uint8Array([0x89, 36, 0]) });
    keys.onmidimessage({ data: new Uint8Array([0x90, 42, 0]) });
    keys.onmidimessage({ data: new Uint8Array([0xfe]) });
    assert.deepEqual(heard.map((m) => [m.type, m.note]), [['on', 36], ['off', 36], ['off', 42]], 'what it is said, and nothing for the rest');
    // Plugged in later.
    const later = input('Drum pad');
    access.inputs.set('d', later);
    access.onstatechange();
    assert.deepEqual(names.at(-1), ['MPD218', 'a MIDI device', 'Drum pad']);
    later.onmidimessage({ data: [0x90, 38, 100] });
    assert.deepEqual(heard.at(-1), { type: 'on', note: 38, velocity: 100 / 127, channel: 0 });
  } finally {
    restore();
  }
});

test('refused, or no Web MIDI: it says so; the permission asked without asking', async () => {
  let restore = withNavigator({
    requestMIDIAccess: async () => {
      throw new Error('Permission denied');
    },
    permissions: { query: async ({ name }) => ({ state: name === 'midi' ? 'granted' : 'denied' }) },
  });
  try {
    await assert.rejects(listenMidi(() => {}, () => {}), /Permission denied/);
    assert.equal(await midiGranted(), true);
  } finally {
    restore();
  }
  restore = withNavigator({ permissions: { query: async () => { throw new TypeError('midi is not a permission'); } } });
  try {
    assert.equal(hasMidi(), false);
    assert.equal(await midiGranted(), false);
  } finally {
    restore();
  }
});
