// What a room made from this template changes, in one place (README, "Making a room from this
// template"): its door's id in the Hallway, its name and description, where it is published, its
// size and colours, the wall its window is in and how the sky turns through it, its dev server's
// port, its doorway's glow, and what hangs on its walls. index.html says the title and the
// description again, for link previews (a test keeps them the same). Pure, for the page, the tests
// and the tools.
//
// What else a room adds stays out of here, in the rest of public/js/. One thing to know about: on a TV
// (README, "On a TV"), the remote's Back while walking goes back a page, to the room's door in the
// Hallway, unless the room has a step back of its own first (stand up, put a picture back, close a
// text). An empty room has none; a room with one takes it in main.js's stepBack, which returns true
// when it took one.

/** @satisfies {{ window: 'left' | 'right' | 'far', [key: string]: unknown }} the walls layoutRoom (room.js) takes */
export const ROOM = {
  /** Its door's id in the Hallway (?from=<id> leads back to it) and its page in a shared session: 1–32 of a–z, 0–9 and '-'. */
  id: 'instruments',
  /** Its name: the page's <title> and the card's heading. */
  title: 'instruments',
  /** The page's <meta name="description">, word for word: the Hallway's plaque by its door shows it. */
  description: "A room of instruments behind the Hallway's door: a drum board of twelve analog pads, a six-voice analog synth with a rack of modules, a keyboard with an organ and an electric piano, and an electric guitar with its amp to play. Walk it and play in VR on a Meta Quest, on a desktop or on a phone.",
  /** What kind of place it is, on the sign over its door in the Hallway. */
  sign: 'Band Room',
  /** Where it is published, on GitHub Pages: https://ariamokr.github.io/<repository>/. */
  url: 'https://ariamokr.github.io/instruments/',
  /** The room inside, in metres: across (x), in from the doorway's wall to the far wall (z), and floor to ceiling. Room for four instruments and the players round them. */
  size: { width: 7, depth: 8, height: 3.2 },
  /** Its colours, as #rrggbb: the floor, the walls, the ceiling, the wood (skirting, casings), and the lamps' light. A rehearsal room's: a dark wooden floor and warm clay walls. */
  colors: { floor: '#7a5539', walls: '#c8a891', ceiling: '#ece4d8', trim: '#46301f', light: '#ffe2bd' },
  /** The wall the window is in, facing in from the doorway: 'left', 'right' or 'far'. */
  window: 'left',
  /**
   * How far the sky outside the window is turned (radians, as three.js's rotation.y; common's
   * README, "A room's yaw"). The garden's view down its length through a window that looks toward
   * w is Math.atan2(-w.x, -w.z): a window in the left wall looks toward -x, so π/2; in the right
   * wall -π/2; in the far wall 0.
   */
  skyYaw: Math.PI / 2,
  /** The dev server's port (npm start), clear of the other sites': the hallway 8088–8089, outside 8090–8091, layersharedsession 8092, music 8093, RoomTemplateEmpty 8094, art 8096, video 8098–8099, arcade 8102. */
  port: 8100,
  /** The doorway's glow when the Hallway's link gives none: the colour of this room's door there. */
  glow: '#5cc8a8',
  /**
   * What hangs on its walls (README, "On the walls"), none in an empty room: framed pictures with
   * their titles under them, each perhaps a way to another place and back. A test checks they fit.
   */
  pieces: /** @type {Piece[]} */ ([]),
};

/**
 * Something on a wall: a framed picture, its title on a label under it (over it, hung low), and
 * with a link, a way to another place: choosing it goes there, and the way back (?from=<id>) comes
 * back to stand in front of it.
 * @typedef {object} Piece
 * @property {string} id its own, 1–32 of a–z, 0–9 and '-', not 'hallway'
 * @property {'left'|'right'|'far'} wall the wall it hangs on, facing in from the doorway
 * @property {number} at its middle along the wall, from the wall's middle, to the right facing it (metres)
 * @property {number} y its middle's height over the floor
 * @property {number} width the picture's size, the frame round it: at least 0.1
 * @property {number} height
 * @property {string} image the picture, by an address relative to the page ('gallery/studio.jpg')
 * @property {string} title on its label, and in the card's list
 * @property {string} description what it is, for a screen reader, in the card's list
 * @property {string} [link] where it leads, an http(s) address: given the way back by common's hallLink
 */

/** The colours' form, and the ids'. */
export const HEX = /^#[0-9a-f]{6}$/;
export const ID = /^[a-z0-9-]{1,32}$/;
/** The walls a window can be in. */
export const WINDOW_WALLS = ['left', 'right', 'far'];

/**
 * This room's door in the Hallway: its entry for the Hallway's environments.js (its README, "Adding
 * a door"): the title its repository's name (the url's first path segment, on GitHub Pages), the
 * subtitle the page's description word for word, the preview the picture tools/preview.mjs renders.
 */
export function hallwayDoor(room = ROOM) {
  return {
    id: room.id,
    title: decodeURIComponent(new URL(room.url).pathname.split('/')[1] || room.id),
    subtitle: room.description,
    sign: room.sign,
    url: room.url,
    preview: new URL('hallway-preview.jpg', room.url).href,
    color: room.glow,
  };
}
