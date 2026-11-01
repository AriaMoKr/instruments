# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

`instruments`: a WebXR room of instruments behind the Hallway's door (three.js 0.186, plain ES
modules, no bundler or build step). Its room is what AriaMoKr/RoomTemplateEmpty makes (a checkout at
`../RoomTemplateEmpty`): a floor, four walls, a ceiling with lamps, a window onto common's afternoon
sky, the doorway back to the Hallway, and the control panel beside it. Its first instrument is the
drum board: twelve analog drums synthesized with Web Audio (no samples), played on every device,
with its clock, a 16-step pattern per pad and the first jacks and cables (the clock into the
pattern, any pad into the delay). Beside it the synth: six analog voices, poly with a mono switch,
twenty-five knobs and eight presets, played live on every device; its patch bay comes next (its
sound into the delay, the clock into an arpeggiator, modulation cables). The plan the user agreed
to ("patch the whole band"): the synth semi-modular (a rack later), then a keyboard and an electric
guitar, all patchable. Add an instrument only once the user has agreed to it. What makes it this room is
`config.js` (id `instruments`, sign Band Room, 7 × 8 × 3.2 m, a dark wooden floor and clay walls,
the window in the left wall, port 8100, glow `#5cc8a8`), and `index.html`, `package.json`,
`.claude/launch.json` and the pictures to match. Like the template it follows the Hallway
(https://ariamokr.github.io/hallway/, AriaMoKr/hallway, a checkout at `../hallway`) and outside
(AriaMoKr/outside, `../outside`): much of the code here is outside's or the hallway's, said so at
the top of each such file. `public/` is the whole site. The user asked for the hallway to be left
alone, so change `../hallway` only when asked; its door to here (README, "The Hallway's door") is
the hallway's to add, through pv. Common and the template change in their own sessions too: if the
room needs something there, tell the user.

Published at https://ariamokr.github.io/instruments/ from `main` of AriaMoKr/instruments by
`.github/workflows/pages.yml`. Its history starts at the template's first commit, and the template
is the remote `template` (push disabled), merged for its fixes (README, "Made from the template").

## Commands

```bash
npm install          # postinstall: common's tools/vendor.mjs copies what vendor.json lists into public/vendor/ (gitignored)
npm start            # tools/serve.mjs (common's) on config.js's port, 8100
npm test             # node --test "test/*.test.js", tsc's check among them (test/types.test.js)
npm run types        # tsc -p tsconfig.json, then -p tsconfig.strict.json, alone
npm run preview      # tools/preview.mjs: public/hallway-preview.jpg and public/social.jpg (headless Chrome)
```

Node 22 or newer; CI runs Node 24 (common's Pages workflow). It runs under MSYS2 UCRT64 here
(`MSYSTEM=UCRT64 /c/msys64/usr/bin/bash -lc 'cd /c/git/my/claude/instruments && …'`).

## Layout

- `config.js`: the one module a copy changes (`ROOM`: id, title, description, sign, url, size,
  colors, window, skyYaw, port, glow, pieces, none here, each a `Piece`) and `hallwayDoor()`, the
  Hallway's door entry it implies.
  `index.html` and `package.json` repeat some of it; `test/config.test.js` keeps them the same.
  The `@satisfies` line above `ROOM` (outside it, so a copy's merges leave it be) checks the
  window's wall for tsc.
- `room.js`: pure (no three, tested in Node). The layout from the config (`layoutRoom`: the doorway,
  shrunk to fit the link's size, the window, the panel, the lamps, the spawn), `doorSpawn`,
  `clampWalk` (the walls, `MARGIN` from them; the doorway between its jambs to its back),
  `doorCrossed`, `standable`, `castRay` (the box's planes: door, panel with u/v, a piece with
  `piece` and u/v on its picture, window, wall, floor with `walkable`, ceiling), and the panel's
  buttons (`PANEL_BUTTONS`, `panelButtonAt`). What hangs on the walls: `PIECE` (frame, label),
  `PIECE_WALLS`, the layout's `pieces` (each where it hangs: `along`, its middle, the wall's normal
  `nx`/`nz`, its right `rx`/`rz`, its label), `pieceFront` (where to stand to look),
  `pieceSpawn` (back from its link) and `pieceProblems` (what is wrong, in words). Its types:
  `Layout` (layoutRoom's, which the rest take) and `RoomHit` (what castRay writes: common's `Hit`
  with `u`, `v` and `piece`).
  Coordinates: metres, the doorway's wall at z = 0, the room along -z, the doorway at x = 0, yaw 0
  faces -z, left is -x.
- `scene.js` builds the room as a few merged meshes with light baked into vertex colours (`bake.js`
  and `builder.js`, the hallway's): the lamps, the window's daylight and the doorway's glow. The
  window's glass is common's `sky.js` (`skyMaterial`, turned by `skyYaw`); the doorway is common's
  `portal.js`, showing the Hallway's view of this door from its views.json (`loadView`), else
  `textures.js` `previewFallback`. The pieces: their frames in the trim, a mesh per picture
  (`loadPictures`, its title from `pictureFallback` until loaded), and the labels as one mesh on
  `labelAtlas`. `textures.js`: canvas textures, seeded, nearly white so the config's colours are
  the room's.
- `controls.js`: a subclass of common's `Controls` (`common/controls.js`) for a `RoomHit`. Common's
  is the walking on every device: drag to look, keys through `tv.js` `keyOf` (a TV remote's come
  with no `code`; a key a page control has used, or one in a form control or a `data-own-keys`
  element, is the page's), click or tap (two fingers neither look nor tap), a gamepad
  (`gamepad.js`), and in VR the trigger, a grip (`onSqueeze`) and the sticks per `nav.js` (move
  smooth/teleport, turn snap/smooth); `walkTo(x, z, { face, then })` on the floor,
  `onDoor(how, hit)` on the doorway, `reduceMotion` (a walk jumps to its end), `setEyeLift`
  (seated), `moveSpeed`/`turnRate` (the vignette), `aimMiddle` and `useMiddle()` (a gamepad's A,
  the remote's OK); nothing allocated per frame. The room's: `layout` (set after `super()`),
  `castRay` and `clampWalk` (room.js's on it; the hit's `u`, `v` and `piece` through the `hit`
  option), the panel (`onPanel`, `hoverPanel`, `_press`) and the pieces (`onPiece`, `hoverPiece`,
  a reticle at 1.3) in `usable`, `use`, `_setHover` and `reticleScale`, then `super`'s; `walkInto`
  (`_startWalk` with `turn` false: facing the doorway from the first step) and `walkUpTo(i, done)`
  (a teleport in VR). The board: `castRay` adds board.js `hitBoard` (a `BandHit`: `pad`, `step`,
  `knob`, `jack`; kinds pad, step, knob, jack, run and board), `clampWalk` walks round it,
  `walkToBoard` (`_walkTo`: on a screen to `boardFront`, clear of `over()`, the page's rects over
  the view, and of the other desk (`free`), looking down, or a little up on a phone, then `at`
  'board' and `playing`; in VR a teleport to `boardStand`), `stepAway`, `onPad(i, velocity)`,
  `onStep(s)`, `onKnob(k, by)` (the strip's and the panel's), `onJack(j)`, `onRun()`, `onDrop()`
  (while `carrying`, choosing anything but one of the board's controls), `onPick(dc, dr)` (a TV's
  arrows, `arrowsPick`), `onPlaying(at)` ('board', 'synth' or null),
  `hoverPad`/`hoverStep`/`hoverKnob`/`hoverJack`, `aim` (the pointer's hit, for a cable carried)
  and `selectHand` (in VR, the hand that last chose: `_xrSelect`). The synth likewise: `castRay`
  adds synthboard.js `hitSynth` (`key`, `dial`, `button`; kinds key, dial, button and synth, the
  nearer of the two desks), `clampWalk` round it too, `walkToSynth` (`at` 'synth'; in VR
  `boardStand(synth, 0.3)`), `onNoteOn(note, velocity)` and `onNoteOff(note)` (a key held: a
  press, each pointer its own (`_fingers`, sliding from key to key), a computer key by `code`
  (`_keysDown`), the notes as they were when it went down), `onNoteTap(note, velocity)` (a click,
  A, OK, a trigger), `onDial(d, by)`, `onButton(i)`, `onOctave(by)` (Z, X), `onKeyPick(by)` (a
  TV's arrows), `lowest()` (main.js's, the keys' lowest note), `hoverKey`/`hoverDial`/
  `hoverButton`. Common's hooks: `takeKey` (playing: the pads' keys or the synth's, Space for RUN,
  Escape a cable carried, else away), `takeWheel` and `takeHand` (a knob or a dial, eased, the
  tempo more slowly), and presses on pads, step keys, jacks, RUN, keys, dials and buttons as they
  go down (`_bindBoard`); keys held let go on keyup, blur, VR and stepping away (`_letGo`).
- The drums: `sound.js` (one AudioContext, `latencyHint: 'interactive'`, made or woken only in a
  press's event, `onReady` once its graph is; a channel per instrument, volume and mute, a
  WaveShaper soft clipper; a note set for a time (`start`), `add(note, group)` cuts a group's last
  note when the next starts and the oldest past `MAX_NOTES`; volume and mute in `localStorage`
  `instruments.sound`), `drums.js` (`PADS`: row, column, key by `code`, General MIDI notes, decay,
  colour, choke; `KNOBS` pitch/decay/tone 0…1, 0.5 as it comes; `playDrum`'s recipes, sines, noise
  and the 808's six squares; `Drums` keeps the knobs, `instruments.drums`, a GainNode out per pad
  into the drums' channel, `out(i)`, its jack, `hit(i, v)` now and `play(i, v, when)` set for a
  time), `clock.js` (`Clock`: the tempo, `instruments.clock`, never running on load; `advance(now,
  onPulse)` hands out pulses `LOOKAHEAD` ahead by the audio clock, counting but skipping those
  `LATE` behind; `CLOCK_OUTS` ×1, ÷2, ÷4), `pattern.js` (`Pattern`: 16 steps per pad, `steps[i]`
  arrays that stay the same, `DEFAULT_PATTERN`, `stepOf`, kept as x/. text, `instruments.pattern`),
  `patch.js` (`JACKS`: id, module, name, label, dir, kind clock or audio; `Patch`: an input takes
  one cable, `plug`, `unplug`, `canPlug`, `source`, `cables()`, `onChange(to, from, was)`,
  `instruments.patch`; `DEFAULT_PATCH` the clock's ×1 into the drums), `delay.js` (`Delay`: a
  tape-style loop in steps of the clock into the 'delay' channel, `input()` once there is sound,
  `setTempo`, knobs time/feedback/level, `instruments.delay`), `board.js` (pure: `layoutBoard`, its
  step keys, pads, knobs (`part` drum, clock or delay; `on` the top or the panel), strip, the panel
  leaning back from the top's back edge (CLOCK, DRUMS and DELAY; its jacks, RUN, the display) and
  sign at eye height; `panelPoint`, `hitBoard`, `boardBlocks`, `clampBoard`, `boardOutline`,
  `boardFront` and `inView`, `boardStand`, `strikeAt` (a pad or a step key) and
  `strikeVelocity`), `kit.js` (the board in 3D, lit as the room is: the pads' glow and the step keys
  in vertex colours (`setSteps`, `playhead`, `hoveredStep`), the strip's canvas, the panel's face
  and values, RUN's light (`setRunning`, `beat`), the knobs instanced, the cables (`setCables`, and
  the one carried: `carry`, `aimAt`, `hoverJack`), the sign, the sticks and fingertips in VR
  (`onStrike`, `onStep`; `updateXR`'s `nearAlso`, the synth's keys, shows the sticks there too); it
  imports builder.js and textures.js, so it is not in strict).
- The synth: `synth.js` (`SECTIONS`; `SYNTH_KNOBS`, 25 knobs 0…1, `DEFAULT_SYNTH`, and their
  curves (`cutoffHz`, `glideSeconds`, …), `synthText` in words, `knobName`; `PRESETS`, four poly
  then four mono; `KEYS` 37 from `LOWEST` 48, `OCTAVES`, `noteName`, `spokenNote`, `isBlack`,
  `NOTE_KEYS` by `code` from middle C and `noteForKey`, `OCTAVE_KEYS` Z and X; `Envelope` and
  `Glide`, where a param is worked out in JS, as `cancelAndHoldAtTime` isn't in every browser;
  `Synth`: six voices (saw, pulse
  from the saw by a comparator, sub, noise, two k-rate low-pass biquads in series, two envelopes)
  made with the first note, then a drive, a chorus and its level into the 'synth' channel; poly (a
  voice a note: the one let go longest ago, else the one held longest) or mono (all six on one note
  spread by DETUNE, legato, GLIDE); `noteOn` (whether
  heard), `noteOff`, `tap`, `allOff`, `setSustain`, `setBend` (±200 cents), `setMod` (vibrato),
  `setKnob`, `setMono`, `setOctave`, `choose(preset)`, `reset`, `down` and `onNotes`, `lowest`,
  `name` and `title`; kept in `instruments.synth`), `synthboard.js` (pure: `SYNTH`'s measures,
  `layoutSynth` right of the board, a Desk as board.js's functions take: its keys (`whites`,
  `blacks`, `bed`), dials in two rows of sections, `deck`, the panel's display and buttons
  (`preset.<id>`, `mono`, `octave.down`, `octave.up`), sign; `keyAt`, `blackKeyAt`, `dialAt`,
  `buttonAt`, `hitSynth`, `keyUnder` (a tip in a key: `key`, `over`, `h`, `top`) and
  `keyVelocity`), and `synthkit.js` (the synth in 3D: the stand, and one canvas atlas for all that
  is written on it; the keys instanced (down, hovered), the dials, the display's canvas (redrawn
  at most ten times a second), the lit buttons, the sign; `setKnobs`, `setKnob`, `setState`,
  `setDown`, `hovered`, `update`; in VR `updateXR(hands, fingers, sticks, dt)`: a stick's tip or a
  forefinger down into a key plays it as hard as it went, held till `LIFT` over its top, sliding on
  at `GLISS`; `endXR`; `onKeyDown(k, velocity, source)`, `onKeyUp(k)`; not in strict).
- `midi.js` (Web MIDI: `readMidi`, a message from its bytes (on, off, sustain, mod, bend, alloff,
  with its channel), `listenMidi`, asked for only from the card's button, at once when `granted`).
- `panel.js`: the control panel on the wall (outside's), redrawn only on a change. `overlay.js`: the
  card (the page's `<nav>`: the title, ← Hallway, the description, On the walls (a link to where
  each piece leads, `pieceHref`, else a button, `onPiece`), Start / Leave shared session, in
  a session its status and the visitor's name (`onName`), and Settings with the panel's choices as
  radio buttons and checkboxes; Drums: Clock (Start or Stop, the tempo), the pads as buttons,
  Steps (the selected pad's sixteen as `aria-pressed` toggles, the step playing marked, Clear, Beat
  as it comes), its knobs as sliders, As it comes, Delay, Cables (a `<select>` for each input);
  Synth: its keys as buttons (`onKeyDown`/`onKeyUp` while pressed, `onKeyTap` for a click alone; one
  stop, a roving tabindex, the arrows, Home and End; hidden on a TV), the presets as a choice
  (chosen again, `onPreset` anyway), Mono, As it comes, the octave, and its knobs as sliders in a
  fieldset per section (`setSynth`, `setSynthKnobs`, `setNotes`); and Sound: the volume and Mute,
  and Play from a MIDI device), the hint (`#hint`, kept clear of
  the buttons, `_placeHint`; at the board `BOARD_HINTS`, at the synth `SYNTH_HINTS`,
  `setPlaying(at)`), Wave,
  Copy invite link, Fullscreen, Enter VR, the aiming dot, and toasts (`role="status"`, polite). With
  `tv`, Wave is in the card and the invite is text there (`inviteText`), and the hints are the
  remote's (`tv`, `tv-card`). With pieces, the hints name the pictures (`PIECE_HINTS`, else an
  empty room's `HINTS`), and on a TV `setAimed(i)` (main.js's frame loop, the piece under the dot)
  makes the hint's OK say what OK does there, as music's does on the gramophone. On a TV, a faded
  hint is `aria-hidden` (out of TalkBack's reading order) but stays the canvas's description
  (`aria-describedby`). `presence.js`: the session's status and notices in words.
- `preview.js`: the two pictures (`renderPreview`, hung as the hallway hangs its doorways', and
  `renderSocial`, from `socialView`).
- `main.js`: the visit and the way back (common's `door.js`; `<id>.visit` in sessionStorage),
  arrival (at the doorway, or back from a piece's link, `?from=<piece id>` with no `back`, in front
  of it with the kept way back), `go(piece)` (fade, then `location.assign`: the way back, or the
  piece's link, `pieceUrl`, common's `hallLink`), `leftBy` (where `pageshow` arrives), fullscreen, VR (`sessiongranted`, noted as
  `window.roomXrGranted` by the inline script in index.html), the panel, the shared session
  (layersharedsession's `createTogether`, page `ROOM.id`), the accessibility settings (common's
  `access.js`: `applyAccess`, `setAccess`, re-read on `storage` and `pageshow`; the `reduce-motion`
  class on `<html>`), the TV (common's `tv.js`: `tvMode()`, the `tv` class on `<html>`, a `Remote`
  over the card and the canvas with `use` = `controls.useMiddle()`, or the selected pad, or the
  chosen key (`chosenKey`, from the arrows) while playing, `step` = `stepBack`, the room's own step
  back for Back (away from an instrument), and `first`, the steps or the synth's sounds while
  playing; the card's play buttons leave the card before walking, so arriving (at once with less
  motion) forgets it; `answerApp`; no fullscreen or XR), the drums (`play(i,
  velocity)`, `select(i)`, `setKnob`, the overlay's and the controls' callbacks, the kit's strikes
  with a haptic pulse, MIDI, the sound woken by presses and put to sleep on `pagehide` or when
  hidden), the clock (`toggleClock`, also a play/pause key anywhere; `setTempo`; `schedule` from the
  frame loop and a 25 ms timer: `clock.advance` by the audio clock, a pulse a step of the drums when
  the output in their clock in sends it, `drums.play` set for its time, and a ring of what each
  pulse shows once heard, `showPulses`), the pattern (`toggleStep`), the delay (`setDelayKnob`; the
  pad patched into it connected to `delay.input()` on `patch.onChange` and `sound.onReady`), the
  cables (`showPatch`; carrying one: `pickUp`, `putDown`, `controls.onJack`, in VR where the hand
  that took it points), the synth (`noteOn`, `noteOff`, `tapNote`, `keyDown(k, v)`/`keyUp(k)` by
  key, its note kept in `keyNotes` while held; `chooseSound`, `resetSynth`, `setSynthKnob`,
  `setMono`, `setOctave`, shown on the synth and in the card; the controls', the card's and the
  synth kit's callbacks, the panel's buttons said in a toast), MIDI (channel 10 the drums', the
  others the synth's, or the drums' while `playingAt` the board; sustain, mod, bend and all off the
  synth's), and the frame loop.
- `style.css`: the page over the view, and the 10-foot view under `html.tv` (the hallway's: 960 × 540
  at a pixel ratio of 2, 18 px text, 4 px focus rings, the TV's safe margins, the hint and toasts
  beside the card).

## Conventions

- Client URLs stay relative (tested). Quest 3 is the target: few draw calls, light baked,
  `MeshBasicMaterial`, nothing allocated per frame.
- Types, with no build: `tsconfig.json` checks `public/js/` from its JSDoc (`allowJs`, `checkJs`,
  `noEmit`, bundler resolution: three's types from `@types/three`, common's and
  layersharedsession's from their `.d.ts`), and the page is served as it is, the import map
  unchanged. `test/types.test.js` runs tsc, so `npm test` and the Pages workflow do, and fails
  rather than skips without TypeScript. What TypeScript's DOM library leaves out (WebKit's
  fullscreen names, `window.__room`, `window.roomXrGranted`) is in `types/globals.d.ts`, never
  served. `strict` comes a file at a time: `tsconfig.strict.json` (it, with `strict` on) includes
  only the files that pass it, `config.js`, `presence.js`, `room.js`, `controls.js`, `sound.js`,
  `drums.js`, `clock.js`, `pattern.js`, `patch.js`, `delay.js`, `board.js`, `midi.js`, `synth.js`
  and `synthboard.js` so far, and
  `test/types.test.js` runs it too. A file joins its `include` when a change makes it pass; what an
  included file imports is checked strictly with it. The rest has a few hundred errors with it,
  mostly untyped parameters and values that may be null (a canvas's 2D context). `tools/` and
  `test/` wait for `@types/node`.
- Scripted testing: `window.__room` (THREE, renderer, scene, camera, rig, room, layout, controls,
  overlay, fade, vignette, xrDevice, go, enterVR, together, remote, tv, way, visit, setAccess,
  sound, drums, board, kit, `play(i, velocity)`, `select(i)`, `setKnob(name, value)`, clock,
  pattern, patch, delay, `toggleClock()`, `setTempo(bpm)`, `toggleStep(s)`, `setDelayKnob(name,
  value)`, `schedule()`, synth, synthDesk, synthKit, `noteOn(note, v)`, `noteOff(note)`,
  `tapNote(note, v)`, `keyDown(k, v)`, `keyUp(k)`, `chooseSound(id)`, `resetSynth()`,
  `setSynthKnob(id, value)`, `setMono(on)`, `setOctave(o)`, `chosenKey`, `carried`, access,
  `preview()`, `social()`, `tick(dt, n)`, `ready`, true once the pieces' pictures have loaded or
  failed). Tests fake Web Audio with
  `test/helpers/audio.js` (`FakeContext`, whose params refuse what a browser's would) and the page
  with `test/helpers/dom.js`. A hidden browser pane gets no animation frames: drive it with
  `tick()` (the clock's timer runs without them). A pane loaded while hidden may have a 0 × 0 view
  (a NaN camera): set its size, then load it. XR frames under `?xr=emulate` need frames too;
  headless Chrome (below) has them.
- Headless Chrome is common's `tools/chrome.mjs` (`launchChrome`): it writes the fresh profile's
  `Local State` first, so Windows sees no failed logon. Start Chrome for a tool through it, never by
  hand on a new profile.
- Accessibility, as the other sites pass it: every 3D control also on the page, 2 px focus rings,
  targets at least 24 px, text over the view at 4.5:1 (the card and pills nearly opaque), the card
  scrolling at 320×568 and 667×375, state shown under forced colours, and less motion stilling the
  page's transitions. Check with axe (wcag2a/aa, wcag21aa, wcag22aa, best-practice) at a desktop
  size and at 320×568, and with `?tv=emulate` at 960×540.
- The TV (README, "On a TV"; common's README, "The TV app"): test with `?tv=emulate` and real key
  presses (OK is Enter with no `code`; `hallwayTV.menu()` / `.back()` for Menu and Back; Escape is
  Back in the card). On the TV, HallwayApp's `tools/tv-check.mjs --url <url>` needs its debug build
  (a localhost URL goes over adb reverse); the empty room holds 60 fps at 1080p at a pixel ratio of
  2, the budget a room's contents can spend. Other sessions may use the same TV: don't restart its
  app under them.
- Shared packages, pinned by tag in package.json: AriaMoKr/common (`v0.7.1`: the door contract,
  nav, access with the vignette, fade, gamepad, portal, sky, tv, controls, and the tools
  `serve.mjs`, `vendor.mjs`, `chrome.mjs`, and the Pages workflow) and AriaMoKr/layersharedsession
  (`v0.3.0`). Change them there, then move the tag here and `npm install`.
- `.claude/launch.json`: `room` (8100) and `hallway` (`../hallway/public` on 8088).
