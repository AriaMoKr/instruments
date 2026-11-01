// Playing from a MIDI device (midi.js): a note-on read from its bytes, and every input listened to,
// those plugged in later too, on a fake Web MIDI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasMidi, listenMidi, midiGranted, noteOn } from '../public/js/midi.js';

/** Puts a navigator with these on globalThis; returns the function that takes it off again. */
function withNavigator(nav) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  return () => {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    else delete globalThis.navigator;
  };
}

test('a note-on: its note, its velocity 0…1 and its channel; a note-off, a note-on at 0 and the rest are none', () => {
  assert.deepEqual(noteOn([0x90, 36, 127]), { note: 36, velocity: 1, channel: 0 });
  assert.deepEqual(noteOn(new Uint8Array([0x99, 38, 64])), { note: 38, velocity: 64 / 127, channel: 9 });
  assert.equal(noteOn([0x99, 38, 0]), null, 'a note-on at 0 is a note-off');
  assert.equal(noteOn([0x89, 38, 64]), null);
  assert.equal(noteOn([0xb0, 7, 100]), null, 'a control change');
  assert.equal(noteOn([0xf8]), null, 'the clock');
  assert.equal(noteOn(null), null);
});

test('every input is listened to, one plugged in later too; its names said as they change', async () => {
  const input = (name, state = 'connected') => ({ name, state, onmidimessage: null });
  const pad = input('MPD218'), keys = input('', 'connected'), gone = input('Old', 'disconnected');
  const access = { inputs: new Map([['a', pad], ['b', keys], ['c', gone]]), onstatechange: null };
  const restore = withNavigator({ requestMIDIAccess: async () => access });
  try {
    assert.equal(hasMidi(), true);
    const notes = [], names = [];
    const got = await listenMidi((note, velocity) => notes.push([note, velocity]), (n) => names.push(n));
    assert.equal(got, access);
    assert.deepEqual(names, [['MPD218', 'a MIDI device']]);
    pad.onmidimessage({ data: new Uint8Array([0x99, 36, 127]) });
    pad.onmidimessage({ data: new Uint8Array([0x89, 36, 0]) });
    keys.onmidimessage({ data: new Uint8Array([0x90, 42, 0]) });
    assert.deepEqual(notes, [[36, 1]]);
    // Plugged in later.
    const later = input('Drum pad');
    access.inputs.set('d', later);
    access.onstatechange();
    assert.deepEqual(names.at(-1), ['MPD218', 'a MIDI device', 'Drum pad']);
    later.onmidimessage({ data: [0x90, 38, 100] });
    assert.deepEqual(notes.at(-1), [38, 100 / 127]);
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
