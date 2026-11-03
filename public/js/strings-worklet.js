// The guitar's strings on the audio thread (strings.js's; guitar.js plays them): what they are told
// comes in through its port, their sound out of its one output.
import { Strings } from './strings.js';

/**
 * The AudioWorklet's scope: its processor's class, its registry, the sample rate and the frame the
 * block starts at.
 * @type {{ AudioWorkletProcessor: new () => { port: MessagePort }, registerProcessor: (name: string, processor: Function) => void, sampleRate: number, currentFrame: number }}
 */
const scope = /** @type {any} */ (globalThis);

class GuitarStrings extends scope.AudioWorkletProcessor {
  /** @param {{ processorOptions?: { tuning?: number[], seed?: number } }} [options] */
  constructor(options) {
    super();
    this.strings = new Strings(scope.sampleRate, options?.processorOptions ?? {});
    this.port.onmessage = (/** @type {MessageEvent} */ e) => this.strings.post(e.data);
  }

  /**
   * @param {Float32Array[][]} inputs
   * @param {Float32Array[][]} outputs
   */
  process(inputs, outputs) {
    const out = outputs[0]?.[0];
    if (out) this.strings.render(out, scope.currentFrame);
    return true;
  }
}

scope.registerProcessor('guitar-strings', GuitarStrings);
