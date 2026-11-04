// What each instrument and module keeps for the next visit (its knobs, the tempo, the pattern, the
// line) is written a moment after its last change, as a knob turned keeps changing. Put away (main.js,
// on pagehide and when the page is hidden), what waits is written at once (flush), and nothing is when
// nothing waits, so a page left open with nothing changed writes nothing over what another has kept
// since.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Clock } from '../public/js/clock.js';
import { Delay } from '../public/js/delay.js';
import { Drums } from '../public/js/drums.js';
import { Adsr } from '../public/js/envelope.js';
import { Filter } from '../public/js/filter.js';
import { Guitar } from '../public/js/guitar.js';
import { Keys } from '../public/js/keys.js';
import { Lfo } from '../public/js/lfo.js';
import { Mixer } from '../public/js/mixer.js';
import { Pattern } from '../public/js/pattern.js';
import { Reverb } from '../public/js/reverb.js';
import { Seq } from '../public/js/seq.js';
import { Sound } from '../public/js/sound.js';
import { Synth } from '../public/js/synth.js';
import { memoryStorage } from './helpers/audio.js';

const sound = new Sound({ Context: null, storage: null });
/** Each that keeps a moment later: its name, how it is made on a storage, and a change to it (v 0…1). */
const KEPT = [
  ['drums', (o) => new Drums(sound, o), (x, v) => x.setKnob(0, 'pitch', v)],
  ['clock', (o) => new Clock(o), (x, v) => x.setTempo(100 + 50 * v)],
  ['pattern', (o) => new Pattern(o), (x) => x.toggle(0, 3)],
  ['delay', (o) => new Delay(sound, o), (x, v) => x.setKnob('feedback', v)],
  ['synth', (o) => new Synth(sound, o), (x, v) => x.setKnob('cutoff', v)],
  ['seq', (o) => new Seq(o), (x) => x.toggle(3)],
  ['lfo', (o) => new Lfo(sound, o), (x, v) => x.setKnob('depth', v)],
  ['filter', (o) => new Filter(sound, o), (x, v) => x.setKnob('cutoff', v)],
  ['reverb', (o) => new Reverb(sound, o), (x, v) => x.setKnob('level', v)],
  ['envelope', (o) => new Adsr(sound, o), (x, v) => x.setKnob('attack', v)],
  ['mixer', (o) => new Mixer(sound, o), (x, v) => x.setKnob('in2', v)],
  ['keys', (o) => new Keys(sound, o), (x, v) => x.setKnob('drive', v)],
  ['guitar', (o) => new Guitar(sound, { ...o, Worklet: null }), (x, v) => x.setKnob('tone', v)],
];

test('put away, what each was to keep a moment later is kept at once, and nothing is when nothing waits', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [name, make, change] of KEPT) {
    const storage = memoryStorage(), key = `room.${name}`;
    let writes = 0;
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      writes++;
      setItem(k, v);
    };
    const x = make({ storage, key });
    x.flush();
    assert.equal(writes, 0, `${name}: nothing waits as it comes`);
    // Kept a moment after a change; put away after that, nothing more.
    change(x, 0.3);
    assert.equal(writes, 0, `${name}: not at once`);
    t.mock.timers.tick(400);
    assert.equal(writes, 1, `${name}: kept a moment later`);
    x.flush();
    assert.equal(writes, 1, `${name}: kept already, nothing waits`);
    // Put away before that moment: kept then, as it is, and not again.
    change(x, 0.6);
    x.flush();
    assert.equal(writes, 2, `${name}: kept when put away`);
    const kept = storage.map.get(key);
    t.mock.timers.tick(400);
    x.flush();
    assert.equal(writes, 2, `${name}: not again, a moment later or put away again`);
    x.save();
    assert.equal(storage.map.get(key), kept, `${name}: what it kept is as it is`);
  }
});
