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
twenty-five knobs and eight presets, played live on every device, and its patch bay, cabled to the
board's (its sound into the delay, the clock into its arpeggiator, the LFO and the filter envelope
into pitch, cutoff and amp, and the keyboard's ROTARY). Beside that its rack, a case of modules in
two rows: the clock again, a 16-step sequencer (a note, an accent and a slide a step) cabled into
the synth's NOTES in, a delay of its own, an LFO in time with the clock (its out into the synth's
pitch, cutoff or amp, the keyboard's ROTARY or the filter's CUTOFF) and an envelope (ADSR and a
depth, started by a clock's pulses or by notes, the sequencer's, the keyboard's or the guitar's; its
out likewise); over them a mixer (four sounds, a level each, into one out), a filter any sound goes
through (low-, band- or high-pass, its CUTOFF in moved by a modulation), a plate reverb and a blank
plate over the envelope. Left of the board the keyboard: sixty-one keys, an organ (nine drawbars, percussion, key click, its scanner's
chorus, a drive and a rotary speaker) and an electric piano (FM tines that bark played harder, and a
tremolo), or both, played live on every device, and its jacks (its sound out into the delays, a
NOTES out into the synth's NOTES in, a ROTARY in for its rotary speaker's speed). Along the right
wall, beside the rack, the electric guitar on a desk turned to face into the room: six strings
modelled as they are plucked (Karplus–Strong as Jaffe and Smith extended it, in an AudioWorklet)
through two pickups (NECK, BOTH, BRIDGE), VOLUME and TONE, a wah and an overdrive, into its amp
(GAIN, BASS, MIDDLE, TREBLE, MASTER and a cabinet), then a chorus and a tremolo (four pedals on its
panel, each on or off by its footswitch, with a knob), played as a guitarist plays on every device:
sixteen chord buttons, a string plucked, a sweep across them strummed, a string pressed at a fret,
slid and bent; and its jacks (its sound out into the delays, the mixer, the filter or the reverb, a
NOTES out into the synth's NOTES in or the envelope's, a WAH in moved by a modulation, a CLOCK in
strumming it). The plan the user agreed to ("patch the whole band"): the synth semi-modular, its
rack (more modules to come), then the keyboard and the electric guitar, all patchable; done to the
guitar's pedals and jacks (6b). Then "play together" (agreed 2026-11-04): in a shared session
everyone in the room plays one band, its settings, cables and clock the session's, the clocks on
one beat (7a, done), and hears what each plays live as it comes, shown in the player's colour (7b,
done). Add an instrument, or a module, only once the user has agreed to it. What makes it this
room is `config.js` (id `instruments`, sign Band Room, 7 × 8 × 3.2 m, a dark wooden floor and clay
walls, the window in the left wall, port 8100, glow `#5cc8a8`), and `index.html`, `package.json`,
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
  `onStep(s)`, `onKnob(k, by)` (the strip's and the panel's), `onJack(j)` (the room's list of jacks,
  the board's, the synth's, the rack's, the keyboard's, then the guitar's: any desk's at once while
  playing at one, or in VR), `onRun()`, `onDrop()` (while `carrying`: Escape, or choosing anything but a
  control of the desk played at or another desk, which `_walkTo`s there with it, `goingTo` set till
  it arrives; a walk taken over drops it), `deskOf(hit)` (a jack's by the desks' `jackBase`),
  `onPick(dc, dr)` (a TV's arrows, `arrowsPick`),
  `onPlaying(at)` ('board', 'synth', 'rack', 'keys', 'guitar' or null),
  `hoverPad`/`hoverStep`/`hoverKnob`/`hoverJack`, `aim` (the pointer's hit, for a cable carried)
  and `selectHand` (in VR, the hand that last chose: `_xrSelect`). The synth likewise: `castRay`
  adds synthboard.js `hitSynth` (`key`, `dial`, `button`, `jack`; kinds key, dial, button, jack and
  synth, the nearest desk's), `clampWalk` round it too, `walkToSynth` (`at` 'synth'; in VR
  `boardStand(synth, 0.3)`), `onNoteOn(note, velocity)` and `onNoteOff(note)` (a key held: a
  press, each pointer its own (`_fingers`, sliding from key to key), a computer key by `code`
  (`_keysDown`), the notes as they were when it went down), `onNoteTap(note, velocity)` (a click,
  A, OK, a trigger), `onDial(d, by)`, `onButton(i)`, `onOctave(by)` (Z, X), `onKeyPick(by)` (a
  TV's arrows), `lowest()` (main.js's, the keys' lowest note), `hoverKey`/`hoverDial`/
  `hoverButton`. The rack likewise: `castRay` adds rackboard.js `hitRack` (`seq`, `rack`; kinds
  seq, accent and slide (`SEQ_ROWS`, a step's keys), rackknob, rackbutton, jack and rack),
  `clampWalk` round it too, `walkToRack` (`at` 'rack'; in VR `boardStand(rack, 0.3)`),
  `onSeqKey(row, s)`, `onRackKnob(k, by)` (a step's note, the tempo, a module's),
  `onRackButton(i)` (RUN, the octave), `onSeqOctave(by)` (Z, X), `onSeqPick(steps, semitones)` (a
  TV's arrows),
  `hoverSeqKey`/`hoverRackKnob`/`hoverRackButton`. The keyboard likewise, its desk `keyboard`
  (common's `Controls` has `keys`): `castRay` adds keysboard.js `hitKeys` (`keys`, the index for
  each kind, and `jack`; kinds note, drawbar (`v` where a press in its lane pulls it to), keysknob,
  keysbutton, jack and keys), `clampWalk` round it too, `walkToKeys` (`at` 'keys'; on a screen narrower than it is
  high framing C3 to C5, `framedKeys`; in VR `boardStand(keyboard, 0.3)`), `onKeysOn(note,
  velocity)` and `onKeysOff(note)` (held as the synth's: each `Held` knows which it went to,
  `_hold`, `_off`), `onKeysTap`, `onDrawbar(id, value)` (a press in its lane; a press on its tab,
  within `GRIP`, keeps where on it; a drag, `_drag`, `drawbarAlong` where the pointer's ray
  meets the tabs' tops), `onKeysKnob(id, by)` (a knob, and the wheel or a stick on a drawbar),
  `onKeysButton(i)`, `onKeysOctave(by)` (Z, X), `onKeysPick(by)` (a TV's arrows), `keysOctave()`
  and `pulled(id)` (main.js's), `hoverNote`/`hoverDrawbar`/`hoverKeysKnob`/`hoverKeysButton`.
  The guitar likewise, its desk `guitar`, turned: `castRay` adds guitarboard.js `hitGuitar`
  (`guitar`, the index for each kind, with `u` and `v`; kinds fret (the string; `u` its fret, `v`
  how far across it, in spacings), strum (the string nearest; `u` where the pick meets it), mute
  (the bridge), chord, guitarknob (its own, its amp's and its pedals'), pickup, pedal (a pedal's
  footswitch), jack and guitar), `clampWalk` round it too, `walkToGuitar`
  (`at` 'guitar'; on a screen `guitarFront`, in VR `guitarStand`, turned to face it (`_turnAboutHead`
  in the teleport's blink); `stepAway` steps back from the
  right wall), `onPluck(s, velocity, pick, delay)` (Z to N, Shift harder; a press over the strings
  between the neck and the bridge, then each string a drag crosses, `_sweep`, `strummed`, as hard
  as it goes fast, `sweepVelocity`, spread over its move), `onStrum(down, velocity)` (the arrows
  down and up), `onMuteStrings()` (M, the bridge), `onFretDown(s, fret, velocity)`,
  `onFretSlide(s, fret)`, `onFretBend(s, semitones)` and `onFretUp(s)` (a press on the neck held,
  each pointer its own, `_fretDown`; dragged, `_overStrings`, where its ray meets the strings'
  plane, `stringsAlong`, along to slide and across to bend, `bendFor`; `_fretUp`), `onFretTap`
  (a click, A, OK, a trigger), `onChord(i)` (a button, 1–8 and Q–I), `onChordPick(by)` (the arrows
  left and right), `onPickup(i)`, `onPedal(i)` (a footswitch stomped), `onGuitarKnob(id, by)`,
  `hoverString`/`hoverFret`/`hoverChord`/`hoverGuitarKnob`/`hoverPickup`/`hoverPedal`.
  Common's hooks: `takeKey` (playing: the pads' keys, the synth's or the keyboard's (`_noteKey`),
  the steps' (1–8, Q–I; Shift an accent), or the guitar's (`_guitarKey`), Space for RUN, Escape a
  cable carried, else away), `takeWheel` and `takeHand` (a knob, a dial, the rack's knob, the
  keyboard's knob or drawbar, the guitar's knob, eased, the tempo more slowly), and presses on
  pads, step keys, jacks, RUN, keys, dials, buttons, the rack's keys, knobs and buttons, the
  keyboard's keys, drawbars, knobs and buttons, and the guitar's strings, bridge, chords, switch,
  knobs and footswitches as they go down (`_bindBoard`); keys held let go on keyup, blur, VR and stepping away, and
  strings pressed likewise (`_letGo`).
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
  `LATE` behind; `CLOCK_OUTS` ×1, ÷2, ÷4, the rack's `RACK_CLOCK_OUTS` likewise, `clockEvery(id)`;
  in a band, `seed` (a run's, new at each `start`, `newSeed`), `nextPulse` and `nextAt`,
  `standBy(seed)` (running on another's run, `nextAt` NaN till placed) and `follow(n, at)` (beat.js
  places it); `dice(seed, k)`, a number 0…1 the same everywhere, lowbias32),
  `pattern.js` (`Pattern`: 16 steps per pad, `steps[i]` arrays that stay the same,
  `DEFAULT_PATTERN`, `stepOf`, kept as x/. text, `instruments.pattern`), `patch.js` (`JACKS`, the
  board's, the synth's, the rack's, the keyboard's, then the guitar's: id, module, name, label, dir, kind clock,
  audio, mod or notes; `Patch`: an input takes one cable, `plug`, `unplug`, `canPlug`, `source`,
  `cables()`, `onChange(to, from, was)`, `instruments.patch`; `loops(from, to)`, a sound cable that
  would bring a sound back round into its module (the filter's out into its in, or into the mixer
  going into it), which `canPlug` and `plug` refuse and a kept patch leaves out; `adopt(desired)`
  (a band's patch at once: each input's as asked, else its own, in the inputs' order, one that
  can't join or would loop with those before it empty, so all given the same agree); `DEFAULT_PATCH`
  the clock's ×1 into the drums and into the synth's arpeggiator, the rack's ×1 into the sequencer,
  and its notes into the synth; nothing into the rack's delay, `rackdelay.in`, out of its LFO,
  `lfo.out`, into or out of its envelope, `env.clock`, `env.notes` and `env.out`, or its mixer,
  `mixer.in1`…`mixer.in4` and `mixer.out`, or its filter, `filter.in`, `filter.cutoff` and
  `filter.out`, into its reverb, `reverb.in`, or to or from the keyboard's, `keys.out`,
  `keys.notes` and `keys.rotary`, or the guitar's, `guitar.out`, `guitar.notes`, `guitar.wah` and
  `guitar.clock`), `delay.js`
  (`Delay`: a tape-style loop in steps of the clock into its channel, 'delay' (the rack's,
  `channel` 'rackdelay', `instruments.rackdelay`), `input()` once there is sound, `setTempo`, knobs
  time/feedback/level, `instruments.delay`), `board.js` (pure: `layoutBoard`, its
  step keys, pads, knobs (`part` drum, clock or delay; `on` the top or the panel), strip, the panel
  leaning back from the top's back edge (CLOCK, DRUMS and DELAY; its jacks, RUN, the display) and
  sign at eye height; `panelPoint`, `jackAt`, `areaAt`, `hitBoard`, `boardBlocks`, `clampBoard`,
  `boardOutline`, `boardFront` and `inView`, `boardStand`, `strikeAt` (a pad or a step key) and
  `strikeVelocity`), `kit.js` (the board in 3D, lit as the room is: the pads' glow and the step keys
  in vertex colours (`flash(i, velocity, reduce, tint)`, a pad struck lit, in the colour of another
  who struck it, `tint`, linear, else its own; `setSteps`, `playhead`, `hoveredStep`), the strip's
  canvas, the panel's face (`drawJack`, `drawPlate`, the synth's, the rack's, the keyboard's and the
  guitar's too) and
  values, RUN's light (`setRunning`, `beat`), the knobs instanced, the cables between the desks'
  jacks (`addJacks(desk, rise)`, the synth's, the rack's, the keyboard's, then the guitar's after
  the board's; a desk turned by its `place` (the guitar's) as well as those against the far wall:
  `cableDesk` (its turn, its panel's normal and up in the room), `toRoom`, `_jackPoint`; `hang`
  keeps them off each desk's top and in front of its panel, worked out in each desk's own frame;
  `setCables`, and the one carried, reaching as far as the farthest two jacks are apart and
  `CABLE.slack` more (`_reaches`) at most: `carry`, `aimAt`, `hoverJack`, its ring on any panel,
  turned with it), the sign, the sticks and fingertips in VR (`onStrike`,
  `onStep`; `updateXR`'s `nearAlso`, the synth's keys, the rack's, the keyboard's or the guitar,
  shows the sticks there too; `AIMED`, the controls whose kinds its reticle sits on, a pedal's
  among them);
  it imports builder.js and textures.js, so it is not in strict).
- The synth: `synth.js` (`SECTIONS`; `SYNTH_KNOBS`, 25 knobs 0…1, `DEFAULT_SYNTH`, and their
  curves (`cutoffHz`, `glideSeconds`, …), `synthText` in words, `knobName`; `PRESETS`, four poly
  then four mono; `KEYS` 37 from `LOWEST` 48, `OCTAVES`, `noteName`, `spokenNote`, `isBlack`,
  `NOTE_KEYS` by `code` from middle C and `noteForKey`, `OCTAVE_KEYS` Z and X; `Envelope` and
  `Glide`, where a param is worked out in JS, as `cancelAndHoldAtTime` isn't in every browser
  (`Envelope`, its curves and `seconds` the rack's envelope's too);
  `Synth`: six voices (saw, pulse
  from the saw by a comparator, sub, noise, two k-rate low-pass biquads in series, two envelopes)
  made with the first note, then a drive, a chorus and its level into the 'synth' channel; poly (a
  voice a note: the one let go longest ago, else the one held longest) or mono (all six on one note
  spread by DETUNE, legato, GLIDE); `noteOn(note, velocity, at)` (whether heard; `at` a time on the
  audio clock, now if sooner: the guitar's notes, set ahead), `noteOff(note, at)` (in mono, only a
  key held there), `tap`, `allOff`, `setSustain`, `setBend` (±200 cents), `setMod` (vibrato),
  `setKnob`, `setMono`, `setOctave`, `choose(preset)`, `setPreset(id, edited)` (what a band's sound
  is called, its knobs set as theirs), `reset`, `down` and `onNotes`, `held` (the
  keys down and the arpeggiator's chord), `lowest`, `name` and `title`; its patch bay: `output`
  (its sound, for the delays, once `onBuilt`), `modOutput('lfo' | 'env')` (for an input outside it,
  the keyboard's ROTARY: its LFO, or `envs`, the env of the voice started last, each voice's
  through its `tap`, all six set at a start's time in `_start` (the first voice's in mono); the
  voices made if they weren't), `setInput(input, source)` (`MOD_INPUTS` pitch,
  cutoff, amp; source 'lfo', 'env', a node from outside (the rack's LFO's out or its envelope's) or
  null) into each voice's `inputs`, `MOD_CENTS` deep, the vca
  at `AMP_MOD` with a cable in AMP (each voice's `env`, a ConstantSource its twin Envelope `envOut`
  drives as the filter's); and its arpeggiator, `arp` (arp.js): `setArp(mode | null)`, `setHold`,
  `setRange(n?)`, `arpStep(t, length, count)` (a step of the room's clock, its number `count`) and
  `arpRun(now, until, step)`
  (its own), `onArp` (a chord begun: main.js's `schedule`); its notes in, `seqStep(note, velocity,
  t, until)` (a step of the sequencer's set for its time, a rest -1; `until` Infinity slides on into
  the next, `_tie`, gliding at least `SLIDE`; in poly the voice let go longest ago) and
  `seqEnd()`; kept in `instruments.synth`), `arp.js`
  (pure, strict: `ARP_MODES` up, down, updown, random, `ARP_RANGES`, `ARP_GATE`, `ARP_LATE`;
  `Arp`: `mode`, `hold`, `range`, `press`/`release` (keys), `toggle` (a tap under HOLD),
  `next(count)` (at random on the room's clock drawn from `dice(seed, count)`, `seed` main.js's,
  the clock's run's; else its own dice), `run` (its own clock), `played` (its own clock's next
  after a step on any clock); `arpWords`),
  `synthboard.js` (pure: `SYNTH`'s measures,
  `layoutSynth(L, board)` right of the board, a Desk as board.js's functions take: its keys
  (`whites`, `blacks`, `bed`), dials in two rows of sections, `deck`, the panel's display, buttons
  (`preset.<id>`, `mono`, `octave.down`, `octave.up`, `arp.<mode>`, `arp.hold`, `arp.range`), jacks
  (`jackBase`, where they start in the room's list) and `titles`, sign; `keyAt`, `blackKeyAt`,
  `dialAt`, `buttonAt`, `hitSynth`, `keyUnder` (a tip in a key: `key`, `over`, `h`, `top`) and
  `keyVelocity`), and `synthkit.js` (the synth in 3D: the stand, and one canvas atlas for all that
  is written on it; the keys instanced (down, hovered), the dials, the display's canvas (redrawn
  at most ten times a second; its arpeggiator's line), the jacks' plate and the titles, the lit
  buttons (the preset, Mono, the arpeggiator's way and HOLD), the sign; `setKnobs`, `setKnob`,
  `setState`, `setDown(notes, lowest, tint)` (a key another holds in their colour, `tint(note)`,
  linear, else the room's glow), `hovered`, `update`; in VR `updateXR(hands, fingers, sticks, dt)`:
  a stick's tip or a forefinger down into a key plays it as hard as it went, held till `LIFT` over
  its top, sliding on at `GLISS`; `endXR`; `onKeyDown(k, velocity, source)`, `onKeyUp(k)`; its
  cables are kit.js's; not in strict).
- The rack: `seq.js` (pure, strict: `SEQ_RANGE` 24 semitones up from the line's lowest,
  `SEQ_LOWEST` 36 moved by `SEQ_OCTAVES` −1…2, `SEQ_GATE`, `SEQ_VELOCITY` normal and accent,
  `DEFAULT_LINE` in C minor; `Seq`: `steps` (each `on`, `note`, `accent`, `slide`; objects that stay
  the same), `toggle`, `toggleAccent`, `toggleSlide`, `setNote`, `setStep(s, on, note, accent,
  slide)` (a band's, at once), `setOctave`, `octave`, `lowest`,
  `play(s)` (note, velocity, slide; null a rest), `noteOf`, `clear`, `reset`, kept as x/. text and
  notes, `instruments.seq`), `lfo.js` (strict: `LFO_KNOBS` rate, shape, depth; `LFO_RATES` 4 bars
  to a 16th in steps of the clock, `LFO_SHAPES` sine, triangle, saw, square, random, `knobPlace`,
  `lfoRate`, `lfoShape`, `depthGain`, `lfoText`, `shapeAt` (its corners, a jump the value after it
  or `before` it); `Lfo`: `output()` (a ConstantSource through its depth, made once there is sound),
  `step(n, t, d)` (the clock's pulse n: that step of the wave written ahead as lines between its
  corners, a jump as a set; a cycle `steps` long counted from the clock's start, so a rate turned to
  falls on the beat; a step not where the last ended taken back from there; random's value for a
  cycle from `dice(seed, cycle)`, `seed` the clock's run's, else its own dice), `run(now, until, d)`
  (on by itself while the clock is stopped), `valueAt(t)` (from a ring of the latest steps, for its
  light), `setKnob`, `reset`, `instruments.lfo`), `envelope.js` (strict: `ENVELOPE_KNOBS` attack,
  decay, sustain, release, depth, `DEFAULT_ENVELOPE`, `ENV_GATE`, `envelopeText` (synth.js's
  curves); `Adsr`: `output()` (a ConstantSource its shape is set on, synth.js's `Envelope`, through
  its depth, lfo.js's `depthGain`; made once there is sound), started as high as `velocityLevel`,
  from where it is, by `trigger(t, step)` (a pulse into CLOCK, let go `ENV_GATE` of its step
  later), `seqStep(note, velocity, t, until)` and `seqEnd()` (the sequencer's notes as the synth
  takes them: a slide carries it on, `_tie`) or `noteOn(note, velocity, at)`, `noteOff(note, at)`
  and `allOff` (the keyboard's, or the guitar's strings, each its own note, held while any key is or
  any string rings, `_keys`); `valueAt(t)` (from a ring of the shapes set last, for its
  light), `setKnob` (DEPTH eased at once, the rest from its next start), `reset`,
  `instruments.envelope`), `mixer.js` (strict: `MIXER_KNOBS` in1…in4, `UNITY` 0.75, `DEFAULT_MIXER`,
  `mixGain` (1 at UNITY, its square either side), `mixerText` (in dB, or off); `Mixer`:
  `input(name)` (a GainNode each, its knob's level) into `output()`, into its channel 'mixer', made
  once there is sound; `setKnob` (eased), `reset`, `instruments.mixer`), `filter.js` (strict:
  `FILTER_KNOBS` mode, cutoff,
  resonance, mod; `FILTER_MODES` lowpass, bandpass, highpass (LP, BP, HP), `DEFAULT_FILTER`,
  `MOD_OCTAVES` 4, `filterMode`, `filterQ` (a low- or high-pass's in dB, a band-pass's as it is),
  `filterTrim` (as loud whatever the resonance), `modCents`, `filterText`; `Filter`: one
  BiquadFilterNode from `input()` through its trim, `output()`, into its channel 'filter', made once
  there is sound; `setCutoffIn(source)` (the CUTOFF in, through MOD into its detune, connected
  once made), `mode`, `setKnob` (its mode and Q at once, the rest eased), `reset`,
  `instruments.filter`), `reverb.js` (strict: `REVERB_KNOBS` size, damp, level, `DEFAULT_REVERB`,
  `BRIGHT`, `reverbSeconds` 0.3…4.8 s, `dampHz`, `reverbText`, `impulse(ctx, seconds, damp,
  random)` (two sides of noise dying 60 dB through a one-pole closing to `dampHz`, as much in it as
  √(seconds / 1.2)); `Reverb`: `input()` (a ConvolverNode, `normalize` false, through a fade and its
  level into its channel 'reverb', made once something is patched in), `setKnob` (the level eased;
  SIZE or DAMP a new response once the knob rests, `respond`, faded over from the one before, which
  is let go; Chrome readies it as the buffer is set, on the main thread, about 28 ms at 4.8 s and 7
  at 1.2 s on a desktop), `reset`, `seconds`, `instruments.reverb`), `rackboard.js` (pure, strict:
  `RACK`'s measures, `layoutRack(L, synth)` right of the synth and as deep, its front in line with
  its, its panel's back at least `RACK.wall` from the wall, as wide as its modules make it (0.91 m,
  the steps spread across it), a Desk as board.js's functions take: its `keys` (`SEQ_ROWS` seq,
  accent, slide; row r's key for step s is r × 16 + s), `numbers`, `names`, `labels`, `knobs`
  (`part` note, a step's on the top, or on the panel tempo, or delay, lfo, envelope, mixer, filter
  or reverb with its `name`, `isModuleKnob`; `knobRadius`), the panel's `modules` in two rows (each
  `b0`…`b1`; up to `RACK.panel.row` clock, seq, delay, lfo, envelope (its depth's knob over the
  other four in a row); over them mixer (a knob over each in, `BOARD.panel.pitch` apart), filter and
  reverb, their knobs in a row), `blanks` (a plate where no module is yet, over the envelope),
  `displays`, `buttons` (run, octave.down, octave.up), jacks (`jackBase`), `settings` (where the
  modules' knobs' settings are written), `lights` (the LFO's and the envelope's) and `titles`,
  sign; `rackKeyAt`, `rackKnobAt`, `rackButtonAt`, `hitRack` and `rackStrike` (the key a tip comes
  down on, slanting from one to the next)), and `rackkit.js` (the rack in 3D: the stand, the keys
  instanced (lit where set, the step playing, hovered), the knobs, one canvas drawn once for what is
  written on it and another, redrawn at most ten times a second, for the notes' names, the two
  displays and the knobs' settings (eight to a row, `_cell`); three lights in one InstancedMesh,
  RUN's, the LFO's (`lfo`, its value, NaN dark) and the envelope's (`env`, likewise); the sign;
  `setLine`, `setLast`, `setTempo`, `setDelay`, `setLfo`, `setEnvelope`, `setMixer`, `setFilter`,
  `setReverb`, `setRunning`, `beat`, `playhead`, `hovered`, `update`; in VR `updateXR(hands,
  fingers, sticks)`, a tip coming down on a key presses it, `endXR`; `onKey(row, s, source)`; its
  cables are kit.js's; not in strict).
- The keyboard: `keys.js` (strict: `KEYS_COUNT` 61 from `KEYS_LOWEST` 36, `KEYS_OCTAVES` −2…1 (the
  computer's keys from middle C + 12 × it, so they stay on it); `KEYS_SOUNDS` organ, epiano, both;
  `KEYS_SECTIONS` drawbars, organ, epiano; `KEYS_KNOBS`, 20 knobs 0…1 (`DRAWBARS`, nine, in
  eighths: `drawbarStep`, `drawbarLevel`, `DRAWBAR_HARMONICS`, `isDrawbar`), `DEFAULT_KEYS` (88
  8000 000), their curves (`scannerDepth`, `toneIndex`, `barkIndex`, `pianoDecay`, `tremoloHz`, …),
  `keysText`, `keysKnobName`, `registration` (the drawbars as an organist writes them),
  `drawbarWave`; `KEYS_SWITCHES` perc, third, fast, rotaryFast, `DEFAULT_SWITCHES`, `switchWords`;
  `KEYS_VOICES` 16 a sound, `PERC`, `ROTORS`, `ORGAN_OUT` (the organ's level made up after its
  drive, as loud as the synth's and the piano's), `PIANO_GAIN` (the piano's, its chord as loud to
  the ear as the rest's by BS.1770's K-weighting, though louder by its rms), `ampAt`; `Keys`: the
  organ (a PeriodicWave a note
  from the drawbars, a click, the percussion on a phrase's first key, the scanner's chorus, a drive,
  a rotary speaker's horn and drum each swaying a delay and a gain either side) and the electric
  piano (FM, its index dying back, more struck harder, a tine at 7×, a damper; the tremolo pans it),
  each graph made with its first note, into the 'keys' channel; `noteOn` (whether heard),
  `noteOff`, `tap`, `allOff`, `setSustain`, `setKnob` (a drawbar to its eighth), `setSwitch`,
  `choose`, `setOctave`, `reset`, `down` and `onNotes`, `name`, `choice`, `switches`, `octave`,
  `sustain`; its jacks: `output()` (OUT, both sounds' way into the channel, for the delays, once
  there is sound), `onNoteOut(note, velocity | null, tap)` (NOTES: a note as its key goes down,
  null as it ends, the key up with no sustain or the sustain let go, `_sent`; `tap` true for
  `tap`'s, `_tapping`; main.js's into the synth) and `setInput(source)` (ROTARY, `input`: into
  `speedIn`, a WaveShaper (`SPEED_CURVE`) holding FAST's `speed` (a ConstantSource, `SLOW_SPEED` or
  1, `_speed`; never 0, as to Chrome a ConstantSource at 0 is silence, and an IIRFilter fed silence
  stops after its tail, holding its state) plus it to 0…1, then for each rotor an IIR one-pole lag
  at its `ROTORS` ramp, FAST's speed when made taken off its input (`from`), and a gain of fast −
  slow onto its frequency, set to that speed: the rotors start there); kept in
  `instruments.keys`), `keysboard.js` (pure, strict: `KEYBOARD`'s measures,
  `layoutKeyboard(L, board, rack)` left of the board, a Desk as board.js's functions take: its keys
  (synthboard.js `layoutKeys`, as the synth's: `whites`, `blacks`, `bed`), `drawbars` (a tab in a
  slot, b0…b1), `dials`, `sections`, `row`, `deck`, the panel's display, `buttons` (`sound.<id>`,
  `switch.<id>`, `sustain`, `octave.down`, `octave.up`), jacks (at its right under PATCH;
  `jackBase`, after the rack's) and `titles`, sign; `drawbarAt`, `drawbarValue`, `tabB`,
  `drawbarAlong` (a ray onto the tabs' tops), `hitKeys` (on the panel, a jack first), `framedKeys(K,
  from, to)` (part of it, to frame on a narrow screen)), and `keyskit.js` (the keyboard in 3D, as
  the synth's: the stand, one canvas atlas for its faces (the jacks' plate and the jacks, kit.js's
  `drawPlate` and `drawJack`), drawn once; the keys, the drawbars' tabs
  (brown, white, black), the knobs and their marks instanced, and the lights (the sound, the
  switches on, SUSTAIN) in one InstancedMesh; the display's canvas (at most ten times a second); the
  sign; `setKnobs`, `setKnob`, `setState`, `setDown(notes, tint)` (as the synth kit's), `hovered`,
  `update`; in VR `updateXR(hands, fingers, sticks, dt)` and `endXR`, as the synth kit's;
  `onKeyDown(k, velocity, source)`, `onKeyUp(k)`; its cables are kit.js's; not in strict).
- The guitar: `strings.js` (pure, strict: the six strings, Karplus–Strong as Jaffe and Smith
  extended it, `TUNING` standard, `PICKUP_PLACES` neck 0.25 and bridge 0.065 of the length from the
  bridge, `BRIDGE_BOOST`, `ringSeconds` (the low E 7 s, an octave up √2 less), `HIGH_RING`, `PLUCK`,
  `pluckHz`, `PICK` (min, max, usual), `loopFilter` (the one-pole loss for a note's ring at it and at
  3 kHz, and its phase delay); a `StringEvent` (pluck, pitch, damp, pickups); `Strings(rate)`:
  `post(events)` kept in time's order, `render(out, frame)` a block: a pluck's push (a period, a
  pulse `pick` of it long and `SCRAPE` of noise, darker softer, its mean out, so that each pluck's
  harmonics are alike) put in as what rang fades out, each loop's Lagrange delay gliding
  to its note, the pickups each the loop now less a part of a period ago, a string died away let
  be, `active`), `strings-worklet.js` (strict: `guitar-strings`, the AudioWorkletProcessor round it, its
  events through its port; Web Audio's delays can't loop shorter than a render quantum, the high E
  at its 15th fret is 61 samples), `guitar.js` (strict: `FRETS` 15, `GUITAR_STRINGS` low E to high
  E, `CHORDS` sixteen (frets from the low E, -1 muted; `chordName`), `CHORD_KEYS` 1–8 and Q–I,
  `STRING_KEYS` Z to N, `MUTE_KEY` M; `GUITAR_SECTIONS` guitar, amp and pedals, `GUITAR_KNOBS`
  volume, tone, gain, bass, middle, treble, master, and the pedals' pedal, drive, rate, speed 0…1,
  `DEFAULT_GUITAR`, their curves (`volumeGain`, `toneHz`, `toneQ`, `ampDrive`, `ampLevel`, `eqDb`
  ±12, `masterGain`, `ampWords` clean, crunch, lead; `wahHz` 350 Hz heel down to 2.4 kHz toe down,
  `WAH_CENTS` its sweep, `overdriveGain` 3…36 dB and `overdriveLevel` (on, about as loud as off:
  less the harder it is driven), `chorusHz`, `chorusSwing` (12 cents at most), `tremoloHz`; the
  tremolo on made up, `TREMOLO_LEVEL`), `ampCurve` (a valve's, the tops clipped sooner,
  `AMP_SLOPE`), `guitarKnobName` ('Overdrive drive', 'Amp gain'), `guitarText`; `PEDALS` wah,
  overdrive, chorus, tremolo (the
  order the sound goes through them, each with its knob), `PICKUPS` neck, both, bridge; `strumGap`,
  `upShare`, `MAX_BEND` 2, `FINGER`, `PALM`, `MUTED`; `Guitar`: its strings in a worklet node
  (`prepare()`, the module loaded once there is sound, on arriving at it or the first pluck; what is
  played meanwhile queued, `WAIT` at most; `broken` without an AudioWorklet), then TONE (a resonant
  low-pass), VOLUME, the wah (a band-pass, `WAH_Q`, beside a little of the guitar, `WAH_DRY`, its
  frequency's detune the WAH in through `cv`), the overdrive (the guitar beside a clipping of all
  of it over `DRIVE_LOW`, at 4× oversampling, rolled off over `DRIVE_HIGH`), the amp (a tight
  high-pass, its drive into a WaveShaper at 4× oversampling, made up after; BASS, MIDDLE, TREBLE a
  shelf, a peak and a shelf; MASTER) and a 12-inch cabinet's filters, the chorus (two delays, a side
  each, swayed opposite ways) and the tremolo into the 'guitar' channel (`_build`); a pedal off,
  the guitar goes by it as it came (its wet at 0, its dry at 1, eased: `_applyPedal`);
  `GuitarGraph`; `pedals` and `setPedal(id, on)`; `chord` (`choose(id | null)`, the strings it
  fingers anew muted), `pressed` and `bends` (a string's fret and bend, -1 none; `onStrings` when
  they change), `fretOf`, `noteOf`, `level(s, t)` (for its look), `pluck(s, velocity, { at, pick
  })` (one the chord mutes a thud), `strum(down, velocity, { at })`, `press`, `tapFret`, `slide`,
  `bend`, `release` (the finger lifting mutes it), `damp(s, ring)` (-1 all: a palm),
  `noteOn`/`noteOff` (MIDI: the free string where it falls lowest, `midiString(note)` which, -1
  none), `allOff`, `setKnob`,
  `setPickup`, `reset` (the pedals off); its jacks: `output()` (OUT, its sound after the amp and the
  pedals, once made), `onNoteOut(s, note, velocity | null, at)` (NOTES: string s's note from its
  pluck as hard, a slide's new note with velocity null, -1 its end, each at its time on the audio
  clock; `_sent`, `_unsend`) with `ringOut(t)` (main.js's timer: a note whose string has died away
  `NOTE_FADE` of its ring, to −30 dB, ended), `setWahIn(source)` (WAH, `wahIn`: a modulation, 1 the
  whole sweep, `WAH_CENTS`); kept in `instruments.guitar` (the knobs, the pedals, the pickup and the
  chord)), `guitarboard.js` (pure, strict: `GUITAR`'s measures (`pedal`, `jacks`), `BODY` (a double
  cutaway's outline), `BEND`; `layoutGuitar(L, rack, keys)`, the first desk that is turned: laid out in a
  frame of its own as if against a far wall and turned by its `place` (by the right wall, `gap` from
  the rack's front, yaw −π/2: own x along it is the room's z, own z out from its wall the room's −x;
  `deskXZ`, `roomXZ`, `guitarPoint`); a Desk as board.js's functions take: the guitar on the top
  (`mid`, `nut`, `bridge`, `frets` spaced as a guitar's, `neckEnd`, `headEnd`, `body`, `pickups`),
  `chords` (two rows of eight behind the neck, 1–8 the far row), `deck`, `dials` (VOLUME and TONE on
  the body, the amp's and the pedals' on the panel, each its `section`, `r` and `h`), `switch`, the
  panel's jacks (two outs over two ins at its left under PATCH; `jackBase`, after the keyboard's),
  display, `amp`, `pedals` (each `a0`…`a1`, `b0`…`b1`, its knob's index in `dials`) and `titles`,
  sign; `spacingAt`, `stringB`, `neckHalf`, `fretAt`, `fretPlace`, `stringAt`, `pickAt`, `bendFor`,
  `strummed` (the strings a move crosses, and when), `onBody`, `partAt` (head, fret, strum, mute,
  body), `switchAt`, `switchA`, `guitarDialAt`, `pedalAt` (anywhere on a pedal under its knob,
  `GUITAR.pedal.press`), `chordAt`, `stringsAlong` (a ray onto the strings' plane, off the guitar
  too), `hitGuitar` (on the panel a jack, a knob, then a pedal), `guitarBlocks`, `clampGuitar`, `guitarFront`,
  `guitarStand`), and `guitarkit.js` (the guitar in 3D, as the keyboard's, its lit parts laid out
  in its own frame and turned before baking, the rest in a group turned as the desk is: the stand,
  the guitar (a sunburst body, its pickguard, pickups and bridge; the neck, its frets and inlays; the
  headstock), the strings one InstancedMesh (lit as each rings, `levels`, in the room's glow or in
  the colour of another who played it, `ringTints`, blurred wider, or not with less motion,
  `still`), dots where they are fretted (the chord's gold, a finger's in the glow or another's
  colour, a cross where muted) and where a press would (`hoverString`, `hoverFret`),
  the chord buttons and the pedals' lights (red while on) in one InstancedMesh, the knobs, the
  switch's lever and the footswitches in another, one canvas drawn once for the top and the panel's
  face (the jacks' plate and the jacks, kit.js's `drawPlate` and `drawJack`; the amp's and the
  pedals' scales; the four pedals, `PEDAL_LOOK`), the display's canvas (at most ten times a second;
  a line of the pedals on), the sign; `setKnobs`, `setKnob`, `setPickup`, `setState` (with `pedals`),
  `setStrings(frets, fingers, bends, tints)` (`tints`, each finger's: another's colour, linear,
  else null), `update`; in VR `updateXR(hands, fingers, sticks, dt)`: a
  tip over the body a pick, plucking each string it crosses as fast as it goes (`onPluck`), on the
  neck a finger (`onPress`, `onSlide`, `onBend`, `onRelease` as it lifts), down on the bridge
  `onMute`, on a chord button `onChord`; `endXR`; not in strict).
- The band, in a shared session: `beat.js` (pure, strict: the clock's value, `ClockValue` `{ on,
  bpm, n, at, of, seed }`, pulse n at `at` ms on the time line of `of`, the member who wrote it;
  `readClock`, `sameClock`, `stepMs`, `pulseAt`, `pulseAfter`; `Offsets`, the last `SAMPLES` pings'
  offsets, the quickest's trusted; `Beat({ origin, clock })`: `now()` (ms, `performance.timeOrigin`
  + `performance.now()`), `attach(send, self)`, `peer(p, here)`, `gone(p)`, `hear(data, p)` (pings
  as NTP's over the session's `instruments:time` channel, `PING_MS` apart, a `BURST` at first),
  `offsetOf(memberId)`, `receive(v)`, `tick()` (pings due; the clock written again when its writer
  has gone, the next in line `REANCHOR_WAIT` after the one before, those measured first),
  `differs(clock)`, `write(clock)`, `follow(clock, ctx)` (the band's pulses on the audio clock as
  heard, `heardAt`/`audioAt` from `getOutputTimestamp` else the latency, eased (`EASE`, `REMAP`);
  the clock placed on them, nudged `NUDGE` a call within `JUMP`, else placed again; untimed
  `MEASURE_WAIT` in, an offset of 0)), `band.js` (strict: `Band({ prefix, settings, parts, clock,
  beat, onClock, onAdopt, onState })`: `attach(session, here, { first })`, `detach()`, `tick()`
  (main.js's 25 ms timer), `state` 'off', 'waiting' or 'playing', `id`; each setting the session's
  value `instruments:<band>:<name>`, its mark `…:band` (`{ since }`) written after them, the band
  played the one begun first (`_first`); a page's own brought in (`_seed`) at once when it began
  the session (`first`), else `SEED_AFTER` after another said who they are with none there,
  `SEED_ALONE` alone, `SEED_LATEST` at the latest; one there taken (`_adopt`, `onAdopt(changed,
  joining)`); what changed here shared every `POLL_MS` (`_poll`, each setting read against what was
  last shared; `share()` at once, before what is played here is sent), what changed elsewhere set
  here (`_reconcile`, each part's `done` once; `catchUp()` at once, before another's playing is
  played); the clock's value its own, set here through `onClock(v, was, who, initial)`),
  `bandparts.js` (strict:
  `bandParts(instruments, shown)`, the settings in parts, each a plain value read and written: the
  drums' knobs, the pattern a pad a 16-step mask, the delay, the synth (its preset's name set at the
  part's end, `setPreset`), the sequencer's steps (`stepCode`) and octave, the rack's delay, LFO,
  envelope, mixer, filter and reverb, the keyboard, the guitar, and the patch (`adopt` at the end);
  `shown(part)` main.js's), and `jam.js` (strict: what each plays live, sent to the others in this
  room as it is played; a `Play` an array: `pad`, `on`, `off` and `tap` (`'s'` the synth's keys,
  `'k'` the keyboard's), `sus`, `bend`, `mod`, the guitar's `pluck`, `strum`, `fret`, `ftap`,
  `slide`, `gbend`, `lift`, `mute`, `gon` and `goff` (a MIDI note on it), and `all` (all let go);
  `readPlay` (what came, checked: whole numbers where they must be, the rest held in their ranges,
  else null), `kindOf` (start, move or end), `instrumentOf`, `moveKey`; `Holds` (who holds each
  note, the latest last: `on`, `off` true once the last lets go, `has`, `of`, `count`, `last`);
  `Jam({ prefix, onPlay, onGone, ready, now })`: `attach(session, here)` (its channel
  `instruments:play`), `detach()`, `send(play)` (while `ready`, what lets go anyway: to those here,
  `_out`, at once, a move at most every `MOVE_MS`, its latest, before what is played after it),
  `tick()` (main.js's 25 ms timer), what comes checked (`_hear`: from one here; a start or a move
  while `ready`, kept to `NOTE_RATE` a second and `NOTE_BURST` at once, `MOVE_RATE` and
  `MOVE_BURST`, by `spend`; what lets go always, from one who played), `onGone(peerId)` when one
  who played leaves the session or this room, or this page detaches; `MAX_HELD` a visitor's notes
  held on an instrument, main.js's; `MAX_DELAY` a pluck's delay).
- `midi.js` (Web MIDI: `readMidi`, a message from its bytes (on, off, sustain, mod, bend, alloff,
  with its channel), `listenMidi`, asked for only from the card's button, at once when `granted`).
- `panel.js`: the control panel on the wall (outside's), redrawn only on a change. `overlay.js`: the
  card (the page's `<nav>`: the title, ← Hallway, the description, On the walls (a link to where
  each piece leads, `pieceHref`, else a button, `onPiece`), Start / Leave shared session, in
  a session its status, the band played (`setBand`) and the visitor's name (`onName`), and
  Settings with the panel's choices as
  radio buttons and checkboxes; Drums: Clock (Start or Stop, the tempo), the pads as buttons,
  Steps (the selected pad's sixteen as `aria-pressed` toggles, the step playing marked, Clear, Beat
  as it comes), its knobs as sliders, As it comes, Delay, Cables (a `<select>` for each of the
  board's inputs, `plugs`, `onPlug`); Synth: its keys as buttons (`onKeyDown`/`onKeyUp` while
  pressed, `onKeyTap` for a click alone; one stop, a roving tabindex, the arrows, Home and End;
  hidden on a TV), the presets as a choice (chosen again, `onPreset` anyway), Mono, As it comes,
  the octave, Arpeggiator (`arpInputs`, Off and its ways, `onArp`; Hold, `onHold`; Range,
  `onRange`), its knobs as sliders in a fieldset per section, and its Cables (`synthCablesBox`)
  (`setSynth`, `setSynthKnobs`, `setNotes(notes, lowest, color)`: a key another holds in a shared
  session ringed in their colour, `color(note)` '#rrggbb' else null, `markBy`, the class `by` and
  `--by`); Rack (`openRack`): Play at the rack, its Clock (the
  room's again), Sequencer (a row a step: its number an `aria-pressed` toggle, its note a
  `<select>`, Accent and Slide; the step playing marked, `setSeqPlayhead`; Octave, Clear, Line as it
  comes; `setSeq`; `onSeqKey(row, s)`, `onSeqNote`, `onSeqOctave`, `onClearSeq`, `onResetSeq`),
  Delay (`rackDelayBox`, as the board's: `delayBox`; `setRackDelay`, `onRackDelay`,
  `onResetRackDelay`), LFO (`lfoBox`: rate and shape sliders along their places, depth; `setLfo`,
  `onLfo`, `onResetLfo`), Envelope (`envelopeBox`: Attack, Decay, Sustain, Release, Depth;
  `setEnvelope`, `onEnvelope`, `onResetEnvelope`), Mixer (`mixerBox`: In 1 to In 4; `setMixer`,
  `onMixer`, `onResetMixer`), Filter (`filterBox`: Mode a slider along its three, Cutoff,
  Resonance, Mod; `setFilter`, `onFilter`, `onResetFilter`), Reverb (`reverbBox`: Size, Damp, Level;
  `setReverb`, `onReverb`, `onResetReverb`; `showKnobs` sets the five modules' sliders) and its
  Cables (`rackCablesBox`; `plugRows` offers no input a sound of its own module's); Keys
  (`openKeys`): Play at the keys, its
  keys as the synth's (`keyRow`, `labelKeys` and `markKeys` serve both; `onKeysDown`/`onKeysUp`/
  `onKeysTap`), Sound (`keysSoundBox`: Organ, Electric piano or Both, `onKeysSound`; Sustain,
  `onSustain`; As it comes, `onResetKeys`; the octave, `onKeysOctave`, its notes in words),
  Drawbars (sliders in eighths, the registration in the legend), Percussion (`percBox`;
  `switchInputs`, `onKeysSwitch`), the organ's knobs (with Rotary speaker fast) and the piano's
  (`keysInputs`, `onKeysKnob`), and its Cables (`keysCablesBox`); `setKeys`, `setKeysKnobs`,
  `setKeysNotes(notes, color)`; Guitar (`openGuitar`): Play at the guitar, Chord (`chordsBox`:
  Open strings and the sixteen as a choice, each with its key, `chordInputs`, `onChord(id | null)`;
  Strum down, Strum up and Mute strings played as they go down, `playButton`: `onStrum(down)`,
  `onMuteStrings`),
  Strings (`fretGrid`: each string's frets 0 to `CARD_FRETS` as buttons, high E first, held while
  pressed, `onFretDown(s, fret, v)`/`onFretUp(s)`, a click alone `onFretTap`; one stop, the arrows
  along and across, Home and End; hidden on a TV), Pickup (`pickupInputs`, `onPickup`), Guitar and
  Amp (`guitarInputs`, sliders, `onGuitarKnob`), Pedals (`pedalsBox`: each pedal's checkbox,
  `pedalInputs`, `onPedal(id, on)`, beside its knob's slider, named by `guitarKnobName`), As it
  comes (`onResetGuitar`) and its Cables (`guitarCablesBox`); `setGuitar` (with `pedals`),
  `setGuitarKnobs`, `setStrings(frets, fingers, colors)` (a fret marked `chord`, `finger` or, open
  where the chord mutes it, `muted`; another's finger ringed in their colour, `colors`, a string's
  '#rrggbb' else null); and Sound: the volume
  and Mute, and Play from a MIDI device), the
  hint (`#hint`, kept clear of the buttons, `_placeHint`; at the board `BOARD_HINTS`, at the synth
  `SYNTH_HINTS`, at the rack `RACK_HINTS`, at the keys `KEYS_HINTS`, at the guitar
  `GUITAR_HINTS`, `setPlaying(at)`), Wave,
  Copy invite link, Fullscreen, Enter VR, the aiming dot, and toasts (`role="status"`, polite). With
  `tv`, Wave is in the card and the invite is text there (`inviteText`), and the hints are the
  remote's (`tv`, `tv-card`). With pieces, the hints name the pictures (`PIECE_HINTS`, else an
  empty room's `HINTS`), and on a TV `setAimed(i)` (main.js's frame loop, the piece under the dot)
  makes the hint's OK say what OK does there, as music's does on the gramophone. On a TV, a faded
  hint is `aria-hidden` (out of TalkBack's reading order) but stays the canvas's description
  (`aria-describedby`). `presence.js`: the session's status and notices in words.
- `preview.js`: the two pictures (`renderPreview`, hung as the hallway hangs its doorways', and
  `renderSocial` from `bandView`: the band from `BAND.eye` high, as near as keeps all five desks'
  `deskPoints` (the guitar's turned by `roomXZ`) within `BAND.fill` of its edges, looking at the
  middle of them (test/preview.test.js); an empty room's `socialView` without).
- `main.js`: the visit and the way back (common's `door.js`; `<id>.visit` in sessionStorage),
  arrival (at the doorway, or back from a piece's link, `?from=<piece id>` with no `back`, in front
  of it with the kept way back), `go(piece)` (fade, then `location.assign`: the way back, or the
  piece's link, `pieceUrl`, common's `hallLink`), `leftBy` (where `pageshow` arrives), fullscreen, VR (`sessiongranted`, noted as
  `window.roomXrGranted` by the inline script in index.html), the panel, the shared session
  (layersharedsession's `createTogether`, page `ROOM.id`), the accessibility settings (common's
  `access.js`: `applyAccess`, `setAccess`, re-read on `storage` and `pageshow`; the `reduce-motion`
  class on `<html>`), the TV (common's `tv.js`: `tvMode()`, the `tv` class on `<html>`, a `Remote`
  over the card and the canvas with `use` = `controls.useMiddle()`, or the selected pad, or the
  chosen key (`chosenKey`, from the arrows), the chosen step (`chosenStep`), the keyboard's chosen
  note (`chosenNote`) or a strum down at the guitar while playing, `step` = `stepBack`, the room's
  own step back for Back (away from an instrument), and `first`, the steps, the synth's sounds, the
  sequencer's steps, the keyboard's sounds or the guitar's chords while playing; the card's play
  buttons leave the card
  before walking, so arriving (at once with less
  motion) forgets it; `answerApp`; no fullscreen or XR), the drums (`play(i,
  velocity)`, `select(i)`, `setKnob`, the overlay's and the controls' callbacks, the kit's strikes
  with a haptic pulse, MIDI, the sound woken by presses, and on `pagehide` or when hidden
  `putAway`: what each in `KEPT_SOON` was to keep a moment later kept at once (`flush`), every note
  let go, here and on the others' pages, the sound asleep), the clock (`toggleClock`, also a
  play/pause key anywhere; `setTempo`; `schedule` from the
  frame loop and a 25 ms timer: `clock.advance` by the audio clock, a pulse a step of the drums when
  the output in their clock in sends it (`drumsEvery`), of the arpeggiator likewise
  (`synthEvery`, `synth.arpStep`), and of the sequencer (`seqEvery`; its step's note
  `synth.seqStep` for its time while its notes go into the synth, `seqPlays`; `synth.seqEnd()` when
  the clock stops or either cable comes out), of the envelope (`envEvery`, `envelope.trigger`; and
  the sequencer's note, `envelope.seqStep`, while its notes go into it, `envSeq`, `seqEnd` likewise),
  of the guitar (`guitarEvery`: a strum, down and up in turn from the clock's start, `STRUM_BEAT` a
  down on the beat, `STRUM_DOWN`, `STRUM_UP`), `drums.play` set for its time, and a ring of what each
  pulse shows once heard (the sequencer's note on the synth's keys too), `showPulses`; the
  arpeggiator on its own clock, `synth.arpRun`, while the room's is stopped or not patched into
  it), the pattern (`toggleStep`), the sequencer (`seq`; `toggleSeqKey(row, s)`, `setSeqNote(s,
  n)`, heard a moment while the clock is stopped, `setSeqOctave`, `clearSeq`, `resetSeq`, shown on
  the rack (`setLast` on its display) and in the card; the controls', the card's and the rack
  kit's callbacks), the LFO (`lfo`: `lfo.step` in each pulse, `lfo.run` from `schedule` while the
  clock is stopped; its output made on `sound.onReady`; `setLfoKnob`, `showLfo`; its light from
  `valueAt` in the frame loop, still under less motion), the envelope (`envelope`; its output made
  on `sound.onReady`; `setEnvelopeKnob`, `showEnvelope`; its light from `valueAt` likewise), the
  delays (`setDelayKnob`, and the rack's `rackDelay`, `setRackDelayKnob`), the mixer (`mixer`,
  `setMixerKnob`, `showMixer`), the filter (`filter`, `setFilterKnob`, `showFilter`) and the
  reverb (`reverb`, `setReverbKnob`, `showReverb`), the sound's ways (`route(id)`: an output's
  sound, `soundOut` (a pad's, the synth's, the keyboard's, the guitar's, the mixer's, the filter's), into each
  input it is patched into, `soundIn`, and into its own channel, `home`, as it was made, unless one
  of them is one it goes through instead, `THROUGH` (the mixer's ins, the filter's in; the delays'
  and the reverb's add to it); `routed`, what each is connected to now; on `patch.onChange`,
  `sound.onReady`, `synth.onBuilt` and `guitar.onBuilt`), the cables
  (`showPatch`, `cableColor`, the filter's violet, the mixer's pale, the guitar's copper,
  `GUITAR_CABLE`; `jackIndex(id)` and `jackId(k)` between patch.js's ids and the room's list of
  jacks; the synth's modulation inputs set on `patch.onChange` and at load, `modSource`; the
  keyboard's ROTARY, the filter's CUTOFF and the guitar's WAH (`guitar.setWahIn`; plugged in with
  the wah off, a toast says so) on `patch.onChange` and `sound.onReady`, `modNode` (the synth's
  `modOutput`, or the rack's LFO or its envelope);
  carrying one: `pickUp`, `putDown` (stepping away, not walking to the other desk), `whyNot` (a
  sound back round into itself too; the card's choice put back, said in a toast),
  `controls.onJack`, in VR where the hand that took it points), the synth (`noteOn`, `noteOff`,
  `tapNote`, `keyDown(k, v)`/`keyUp(k)` by key, its note kept in `keyNotes` while held;
  `chooseSound`, `resetSynth`, `setSynthKnob`, `setMono`, `setOctave`, `setArp`, `setHold`,
  `setRange`, shown on the synth and in the card; the controls', the card's and the synth kit's
  callbacks, the panel's buttons said in a toast), the keyboard (`keys`; `keysOn`, `keysOff`,
  `tapKeys`, `chooseKeys`, `setKeysKnob` (`pulls`, where each was turned to, so turns smaller than
  a drawbar's eighth add up; `turnKeysKnob`), `setKeysSwitch`, `setSustain`, `setKeysOctave`,
  `resetKeys`, shown on the keyboard and in the card (`showKeys`, `showKeysKnobs`,
  `showKeysNotes`); the controls', the card's and the keys kit's callbacks, the panel's buttons said
  in a toast, `switchWords`; its notes into the synth while its NOTES is patched into the synth's
  (`keysPlays`, set in `patchedClock`; `keys.onNoteOut`, the notes kept in `keysOnSynth` and let go
  by `keysOffSynth` when the cable comes out; a tap `synth.tap` while the arpeggiator's HOLD keeps
  its chord), and into the envelope while patched into its NOTES (`envKeys`; `envelope.allOff()`
  when the cable comes out)), the guitar (`guitar`; `pluckString(s, velocity, pick, delay)`,
  `strum`, `pressFret`, `tapFret`, `slideFret`, `bendString`, `releaseString`, `muteStrings`,
  `chooseChord(id | null)`, `pressChord(i)` (its button or key; the chord chosen again, the strings
  open), `pickChord(by)` (the arrows, the open strings among the chords), `setGuitarKnob`,
  `turnGuitarKnob`, `setPickup`, `setPedal(id, on)`, `pressPedal(i)` (a footswitch: on if off,
  said in a toast), `resetGuitar`, shown on the guitar and in the card (`showGuitar`,
  `showGuitarKnobs`, `showStrings` on `guitar.onStrings`); `unheard` (no sound, or no AudioWorklet
  for its strings, said once); `guitar.prepare()` on arriving at it; each string's `level` for its
  look in the frame loop; the controls', the card's and the guitar kit's callbacks, the kit's with
  a haptic pulse; its notes out (`guitar.onNoteOut`) into the synth while its NOTES is patched into
  the synth's (`guitarPlays`; each string's note in `guitarOnSynth`, a note two strings play held
  till both end, `guitarNotes`, `guitarSynthOn`/`guitarSynthOff`, at its time; a slide legato; let
  go by `guitarOffSynth` when the cable comes out) and into the envelope while patched into its
  NOTES (`envGuitar`; each string its own key, `stringKey`), `guitar.ringOut` from `schedule`),
  MIDI (channel 10 the drums', the others the synth's, or the drums' while
  `playingAt` the board, the keyboard's while at the keys (`midiKeys`: a note's off goes where its
  on went) or the guitar's while at it (`midiGuitar`); the sustain pedal where it went down
  (`pedalOnKeys`); mod and bend the synth's; all off all), the band (`band`, a `Band` of
  `bandParts`' settings and parts; `shownBand(part)`; `bandClock` (the band's clock set here: the
  tempo, `clock.standBy` on a run begun elsewhere, `stopClock`, a toast saying who); `showBand`, the
  card's line; attached on together's 'session', `first` when this page began it (`began`, set by
  `toggleSession`), and let be when the session ends; `band.beat.follow` in `schedule`; `lfo.seed`
  and `synth.arp.seed` the clock's run's at each pulse), playing together (`jam`, a `Jam`, attached
  with the band, `ready` while it plays: what is played here sent by `sendPlay` after
  `band.share()`, from `play`, `noteOn`, `noteOff`, `tapNote`, `keysOn`, `keysOff`, `tapKeys`,
  `setSustain`, the guitar's own and MIDI's (`synthSustain`, `pitchBend`, `modWheel`,
  `guitarNoteOn`, `guitarNoteOff`), and `putAway`'s `all`; another's played by `heard(play, p)`
  after `band.catchUp()`, only with the sound awake (else a toast says to press, `toldPress`, and a
  press wakes it), the first time on each instrument said (`heardOn`, `PLAYS`); who holds what,
  `synthHolds`, `keysHolds` and `guitarHolds` (jam.js `Holds`, this visitor `SELF`), a note let go
  when the last of them lets go, `MAX_HELD` each; `stringBy`, whose finger presses each string,
  slid, bent and let go by it alone; `pedalBy` and `wheelBy`, who moved the sustain pedals and the
  wheels; `letGo(who)` (their notes, fingers, pedals and wheels, on `onGone` and `all`) and
  `letGoAll()`; their colour, `colorOf`, `tintOf`, `synthTint`/`synthColor` and
  `keysTint`/`keysColor`, on the kits and in the card), and the frame loop.
- `style.css`: the page over the view (a cable's choice under its input's name where the longest
  wouldn't fit beside it; the sequencer's rows, `.seq-step`; the guitar's chords, `.chords`, and
  its strings' frets, `.fretboard` scrolling across (positioned, so the frets' `.sr-only` notes stay
  in it and the card doesn't scroll across), `.fret-row`, `.fret` marked `.chord`, `.finger`
  or `.muted`, shown under forced colours too; its pedals, `.pedals`, a switch beside each knob; a
  key down or a finger another's in a shared session, `.by`, ringed in their colour, `--by`, a dark
  line inside it, not under forced colours),
  and the 10-foot view under `html.tv`
  (the hallway's: 960 × 540 at a pixel
  ratio of 2, 18 px text, 4 px focus rings, the TV's safe margins, the hint and toasts beside the
  card).

## Conventions

- Client URLs stay relative (tested). Quest 3 is the target: few draw calls, light baked,
  `MeshBasicMaterial`, nothing allocated per frame.
- What is kept for the next visit: each instrument and module writes its `localStorage` entry 0.4 s
  after its last change (`_saveSoon`, a knob turned keeps changing) and `flush()` writes one that
  waits at once, nothing if none does (main.js's `putAway`; so a page left open with nothing changed
  writes nothing over what another tab kept since); `save()` forgets the wait. The patch and the
  sound write at once. test/keep.test.js.
- Loudness: the instruments are balanced by BS.1770's K-weighted loudness at the master (a chord at
  0.85 on the synth, the organ and the piano, a strum on the guitar: within 2 dB), not by
  rms; measure it there with a recording worklet in headless Chrome (with autoplay allowed).
- Types, with no build: `tsconfig.json` checks `public/js/` from its JSDoc (`allowJs`, `checkJs`,
  `noEmit`, bundler resolution: three's types from `@types/three`, common's and
  layersharedsession's from their `.d.ts`), and the page is served as it is, the import map
  unchanged. `test/types.test.js` runs tsc, so `npm test` and the Pages workflow do, and fails
  rather than skips without TypeScript. What TypeScript's DOM library leaves out (WebKit's
  fullscreen names, `window.__room`, `window.roomXrGranted`) is in `types/globals.d.ts`, never
  served. `strict` comes a file at a time: `tsconfig.strict.json` (it, with `strict` on) includes
  only the files that pass it, `config.js`, `presence.js`, `room.js`, `controls.js`, `sound.js`,
  `drums.js`, `clock.js`, `pattern.js`, `patch.js`, `delay.js`, `board.js`, `midi.js`, `synth.js`,
  `synthboard.js`, `arp.js`, `seq.js`, `rackboard.js`, `lfo.js`, `keys.js`, `keysboard.js`,
  `filter.js`, `reverb.js`, `mixer.js`, `envelope.js`, `strings.js`, `strings-worklet.js`,
  `guitar.js`, `guitarboard.js`, `beat.js`, `band.js`, `bandparts.js` and `jam.js` so far, and
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
  `setSynthKnob(id, value)`, `setMono(on)`, `setOctave(o)`, `setArp(mode)`, `setHold(on)`,
  `setRange(n)`, seq, rackDesk, rackKit, `toggleSeqKey(row, s)`, `setSeqNote(s, n)`,
  `setSeqOctave(o)`, `clearSeq()`, `resetSeq()`, rackDelay, `setRackDelayKnob(name, value)`, lfo,
  `setLfoKnob(name, value)`, envelope, `setEnvelopeKnob(name, value)`, mixer, `setMixerKnob(name,
  value)`, filter, `setFilterKnob(name, value)`, reverb, `setReverbKnob(name, value)`, `route(id)`, keys, keysDesk, keysKit, `keysOn(note, v)`, `keysOff(note)`,
  `tapKeys(note, v)`, `chooseKeys(id)`, `setKeysKnob(id, value)`, `setKeysSwitch(id, on)`,
  `setSustain(on)`, `setKeysOctave(o)`, `resetKeys()`, guitar, guitarDesk, guitarKit,
  `pluckString(s, velocity, pick, delay)`, `strum(down, velocity)`, `pressFret(s, fret, velocity)`,
  `tapFret(s, fret, velocity)`, `slideFret(s, fret)`, `bendString(s, semitones)`,
  `releaseString(s)`, `muteStrings()`, `chooseChord(id)`, `pressChord(i)`, `pickChord(by)`,
  `setGuitarKnob(id, value)`, `setPickup(id)`, `setPedal(id, on)`, `pressPedal(i)`,
  `resetGuitar()`, band, jam, holds (`synth`, `keys`, `guitar`), stringBy, `synthSustain(on)`,
  `pitchBend(v)`, `modWheel(v)`, `guitarNoteOn(note, v)`, `guitarNoteOff(note)`, `chosenKey`,
  `chosenStep`, `chosenNote`, `carried`, access,
  `preview()`, `social()`, `tick(dt, n)`, `ready`,
  true once the pieces' pictures have loaded or failed). Tests fake Web Audio with
  `test/helpers/audio.js` (`FakeContext`, whose params, `createIIRFilter`, a convolver's `buffer`
  and `disconnect(node)` refuse what a browser's would, and whose `audioWorklet` loads a module
  only when the test says, `settle()` or `refuse()`; `FakeWorkletNode`, made only once one is,
  keeping what its port is sent) and the page
  with `test/helpers/dom.js`; a shared session with `test/helpers/session.js` (`Net` and
  `FakeSession`, on layersharedsession's shared.js, its channels, and a page moved, `move(page)`),
  and the beat with test/beat.test.js's pages, their clocks
  skewed, drifting and jittered. Two pages in one real session: two `launchChrome`s (each its own
  profile), the second opening the first's invite link, its sound woken (`sound.wake()`) for its
  clock to be placed. A hidden browser pane gets no animation frames: drive it with
  `tick()` (the clock's timer runs without them). A pane loaded while hidden may have a 0 × 0 view
  (a NaN camera): set its size, then load it. XR frames under `?xr=emulate` need frames too;
  headless Chrome (below) has them, but keeps its AudioContext suspended (IWER's select is no
  gesture) unless launched with `--autoplay-policy=no-user-gesture-required`, so nothing set for a
  time plays there without it. Testing leaves its settings in the pane's `localStorage`
  (`instruments.*`): put back what a check changed.
- Headless Chrome is common's `tools/chrome.mjs` (`launchChrome`): it writes the fresh profile's
  `Local State` first, so Windows sees no failed logon. Start Chrome for a tool through it, never by
  hand on a new profile.
- Accessibility, as the other sites pass it: every 3D control also on the page, 2 px focus rings,
  targets at least 24 px, text over the view at 4.5:1 (the card and pills nearly opaque), the card
  scrolling at 320×568 and 667×375, state shown under forced colours, and less motion stilling the
  page's transitions. Check with axe 4.14 or newer (jsDelivr's; in 4.10 label in name was
  experimental, run by no tag), wcag2a/aa, wcag21a/aa, wcag22aa and best-practice, at a desktop
  size and at 320×568, and with `?tv=emulate` at 960×540: each part of the card open, swept a
  screenful at a time and the keyboard across, as axe judges a name only against the text in view.
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
