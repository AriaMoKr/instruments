// The dev server (common's tools/serve.mjs) for public/ on the room's port (config.js ROOM.port):
// node tools/serve.mjs [--port 8100] [--host 0.0.0.0]. WebXR needs a secure context:
// http://localhost counts as one. A headset on the LAN can reach it over
// `adb reverse tcp:8100 tcp:8100`. tools/preview.mjs imports serve() and PUBLIC from here, to serve
// public/ on a free port of its own.
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, start } from 'common/tools/serve.mjs';
import { ROOM } from '../public/js/config.js';

export { serve };
export const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  await start(process.argv.slice(2), { root: PUBLIC, port: ROOM.port, name: ROOM.id });
}
