// Playing from a MIDI device (a drum pad controller, a keyboard, a keyboard with pads): Web MIDI,
// where the browser has it (Chrome, Edge and Firefox on a computer or an Android phone; not Safari,
// nor the Quest's browser). The browser asks the visitor first, so it is asked only when they choose
// to (the card's button), or at once when they have said yes before (the permission is 'granted').
// Every input is listened to, on any channel, and so is each one plugged in later: its notes, its
// sustain pedal, its mod wheel and its pitch bend.

/**
 * A MIDI message, read: a note played (`on`, its velocity 0…1) or let go (`off`; a note-on at
 * velocity 0 is one), the sustain pedal down or up (`sustain`), the mod wheel (`mod`, 0…1), the pitch
 * bend (`bend`, -1…1), or every note let go (`alloff`: all notes off, all sound off), each with its
 * channel (0…15).
 * @typedef {{ type: 'on', note: number, velocity: number, channel: number }
 *   | { type: 'off', note: number, channel: number }
 *   | { type: 'sustain', on: boolean, channel: number }
 *   | { type: 'mod', value: number, channel: number }
 *   | { type: 'bend', value: number, channel: number }
 *   | { type: 'alloff', channel: number }} MidiMessage
 */

/**
 * A MIDI message read from its bytes (MidiMessage); null for anything else.
 * @param {ArrayLike<number> | null | undefined} data
 * @returns {MidiMessage | null}
 */
export function readMidi(data) {
  if (!data || data.length < 3) return null;
  const status = data[0] & 0xf0, channel = data[0] & 0x0f, a = data[1] & 0x7f, b = data[2] & 0x7f;
  if (status === 0x90 && b > 0) return { type: 'on', note: a, velocity: b / 127, channel };
  if (status === 0x90 || status === 0x80) return { type: 'off', note: a, channel };
  if (status === 0xe0) {
    const v = (b << 7) | a; // 14 bits, the middle 8192
    return { type: 'bend', value: (v - 8192) / (v >= 8192 ? 8191 : 8192), channel };
  }
  if (status !== 0xb0) return null;
  if (a === 64) return { type: 'sustain', on: b >= 64, channel };
  if (a === 1) return { type: 'mod', value: b / 127, channel };
  if (a === 120 || a === 123) return { type: 'alloff', channel };
  return null;
}

/** Whether this browser has Web MIDI. */
export const hasMidi = () => typeof globalThis.navigator?.requestMIDIAccess === 'function';

/** Whether the visitor has already let this site use MIDI, so asking again shows them nothing. */
export async function midiGranted() {
  try {
    const status = await navigator.permissions.query({ name: /** @type {PermissionName} */ ('midi') });
    return status.state === 'granted';
  } catch {
    return false; // no Permissions API, or it doesn't know MIDI
  }
}

/**
 * Listens to every MIDI input, those there now and those plugged in later: onMessage(message) for
 * each one read (readMidi), and onInputs(their names) whenever they change. Resolves once access is
 * given; rejects when it is refused, or there is no Web MIDI.
 * @param {(message: MidiMessage) => void} onMessage
 * @param {(names: string[]) => void} onInputs
 */
export async function listenMidi(onMessage, onInputs) {
  const access = await navigator.requestMIDIAccess();
  /** @param {MIDIMessageEvent} e */
  const message = (e) => {
    const m = readMidi(e.data);
    if (m) onMessage(m);
  };
  const attach = () => {
    /** @type {string[]} */
    const names = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = message;
      if (input.state === 'connected') names.push(input.name || 'a MIDI device');
    });
    onInputs(names);
  };
  access.onstatechange = attach;
  attach();
  return access;
}
