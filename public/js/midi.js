// Playing from a MIDI device (a drum pad controller, a keyboard with pads): Web MIDI, where the
// browser has it (Chrome, Edge and Firefox on a computer or an Android phone; not Safari, nor the
// Quest's browser). The browser asks the visitor first, so it is asked only when they choose to (the
// card's button), or at once when they have said yes before (the permission is 'granted'). Every
// input is listened to, on any channel, and so is each one plugged in later.

/**
 * A MIDI message's note-on: its note, its velocity (0…1) and its channel (0…15); null for anything
 * else, a note-on at velocity 0 among them (that is a note-off).
 * @param {ArrayLike<number> | null | undefined} data
 */
export function noteOn(data) {
  if (!data || data.length < 3) return null;
  if ((data[0] & 0xf0) !== 0x90 || data[2] === 0) return null;
  return { note: data[1] & 0x7f, velocity: (data[2] & 0x7f) / 127, channel: data[0] & 0x0f };
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
 * Listens to every MIDI input, those there now and those plugged in later: onNote(note, velocity)
 * for each note-on, and onInputs(their names) whenever they change. Resolves once access is given;
 * rejects when it is refused, or there is no Web MIDI.
 * @param {(note: number, velocity: number) => void} onNote
 * @param {(names: string[]) => void} onInputs
 */
export async function listenMidi(onNote, onInputs) {
  const access = await navigator.requestMIDIAccess();
  /** @param {MIDIMessageEvent} e */
  const message = (e) => {
    const n = noteOn(e.data);
    if (n) onNote(n.note, n.velocity);
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
