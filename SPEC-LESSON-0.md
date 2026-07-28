# Lesson 0 Spec — "Folio"

The bootstrap instrument: one voice, sixteen steps, no mouse. A single-page
web app styled as an illuminated manuscript page, built to be calm to look
at for hours.

## Scope (from CURRICULUM.md L0)

One monophonic voice, 16-step grid, one pattern, fixed tempo, fixed
velocity, tracker-style QWERTY note entry, space = play/stop, save/load.
Boots in under one second. Fully operable without a mouse.

### Non-goals (locked until their lesson)

No velocity editing (L4). No swing/humanize (L4). No second track (L2). No
chords or note lengths — every note is one step (L3). No samples (L5). No
pattern chaining (L6). ~~No tempo UI: tempo lives in the save file only;
editing it there is permitted and costs nothing but shame.~~
**SUPERSEDED 2026-07-28** — the "No tempo UI" clause is withdrawn at the
user's request. Tempo is now set on the F1 key page, beside the key. The
clause is kept above, struck through, because it is the reason the tempo
control took as long as it did to arrive. See "The tempo".

## Technical shape

- **One file:** `folio.html`. Inline CSS + JS, zero dependencies, zero build
  step. Opens from `file://`, where it makes no network request at all.
  Served over http by `server.mjs` it makes exactly two, both to that
  server, both about the quest log — see "The log on disk".
- **Audio:** Web Audio API. One oscillator voice.
- **Persistence:** autosave to `localStorage` on every edit (into the active
  workspace — see "Quests as workspaces"); `Ctrl+S`
  exports a `.folio.json` file; `Ctrl+O` imports one (file picker is the
  one permitted mouse interaction, and even it should also accept
  drag-and-drop).
- **Targets:** Chrome/Edge on Windows. Nothing exotic.

### Save format

```json
{
  "version": 0,
  "title": "untitled folio",
  "tempo": 112,
  "steps": [ "C4", null, "E4", null, ... ]   // exactly 16 entries
}
```

Superseded by **version 1** — see "Save format, version 1" below. Version 0
files still import unchanged.

## The voice

- Triangle oscillator through a gentle lowpass (~2.5 kHz) — flute-adjacent,
  pleasant at length, kind to ears and to migraine days. No user-facing
  waveform choice in L0.
- Envelope: 8 ms attack, sustain at fixed level, 40 ms release ending
  before the next step. No clicks, ever — a click at loop point after ten
  repetitions is a **spec violation**, not a nitpick (the ten-loop test is
  L1's rubric).
- Monophonic by construction: one note per step, each note gates for its
  step and stops.
- Fixed tempo default **112 BPM**, steps are 16th notes (pattern = 1 bar of
  4/4... or one breath of 16 pulses; the tool does not editorialize).

## Input (keyboard-native, FastTracker lineage)

**Layout-independence rule:** the user's keyboard is Italian (IT/IT). All
note and command bindings MUST use physical key position
(`KeyboardEvent.code`: `KeyZ`, `Digit2`, `Comma`, …), never the produced
character — the tracker layout is spatial, so it then works identically on
IT, US, or any layout. The F1 reference panel describes keys by position
("the row starting at Z"), not by US-specific punctuation.

**Note entry** — two physical rows as two octaves, the 35-year-old standard
(shown here with US labels; positions are what count):

```
low octave:   Z S X D C V G B H N J M ,     (C  C# D  D# E  F  F# G  G# A  A# B  C+1)
high octave:  Q 2 W 3 E R 5 T 6 Y 7 U I     (same shape, one octave up)
```

- Entering a note writes it at the cursor and **auto-advances** one step
  (the tracker flow that makes entry feel like typing).
- `Period` (physical) or `Delete` clears the step (also auto-advances).
- `PageUp` / `PageDown` shift the base octave up/down (range C2–C6); they
  exist identically on every layout, unlike `[`/`]`, which IT keyboards
  lack as plain keys. Current base octave shown in the header. (Octave
  lived on `←`/`→` until 2026-07-28, when the arrows became navigation.)

**Navigation & transport:**

- All four arrows move the cursor: `↑`/`←` back, `↓`/`→` forward — the
  column reads down, the roll reads right, the hands need not care.
  `Home`/`End` jump to step 1/16. Cursor wraps. (No hjkl — those keys are
  notes.)
- `Space` play/stop. Playback always loops the pattern.
- `Ctrl+S` export, `Ctrl+O` import, `F1` toggles an in-page key reference
  panel (same manuscript styling, no browser dialogs).
- `Tab` does nothing (default-prevented so focus never leaves the page).
- Every keystroke that does something gives visible feedback in ≤ 1 frame.

## Entry modes (added 2026-07-27, removed 2026-07-28)

A two-pass entry system — three modes (note / rhythm / pitch), a rhythm mark
`"x"`, `Tab` and gamepad **R3** to cycle — was added on 2026-07-27 and
removed on 2026-07-28 at the user's request after trial: "we don't need the
baggage." Note entry is plain and always on again, and there is no mode
state anywhere in the app.

The only surviving trace is backward compatibility: `"x"` entries in an old
file or autosave are **converted to `null` on load**, and the footer says
"marks from an older file were dropped" once when that happens.

## The roll (added 2026-07-28)

An alternate view of the same document, for eyes that read shape and colour
rather than note names. `F2` (keyboard) or `R3` (pad) toggles between "the
column" (the tracker list) and "the roll"; the choice persists in
`localStorage` (`folio.viz`) and is a preference, not part of the save file.

- Time runs left to right: sixteen columns, one per step. Pitch is height.
  No note names appear anywhere in the roll.
- Each note is a rounded bar coloured by pitch class. Hues follow the
  circle of fifths, so harmonically neighbouring notes sit next to each
  other in hue; octave-equivalents share a colour and height tells them
  apart. Colours are muted (HSL 42% sat / 40% light) — visible on
  parchment, never harsh.
- The pitch window auto-fits the notes on the page (± 3 semitones, never
  tighter than two octaves) and is recomputed only on edits.
- The only lines are one low-contrast hairline per C — a sparse octave
  ruling, spartito-like — and one upright hairline per beat (steps 1, 5,
  9, 13), equally quiet: a ruling, never a grid. Playhead is the same
  flat wash as
  the column view, vertical now; the cursor column is bracketed by two
  full-height ink hairlines (half-strength ink — strong enough to find at
  a glance, steady, never filled), with the `‸` caret beneath and a thin
  ink ring on the bar itself. Steps
  beyond the loop fade. Beats 1/5/9/13 are numbered in faded ink along
  the base.
- Migraine rules hold: no grids, no stripes, no flashing, nothing moves
  faster than the step rate, all washes flat.
- Pad navigation grew with it (2026-07-28): the bare d-pad moves the
  cursor in any direction, and the right stick strides by fours, beat to
  beat, on either axis.
- While the roll is open (2026-07-28, later the same day) the pairs
  **trade places** to match the drawing — time runs right, height is
  pitch — in **either entry method**: ←/→ walk the cursor and ↑/↓ nudge
  the note under it up/down a step of the key. The left stick follows
  the d-pad on **both axes** there, not just up/down.

### Save format, version 1

```json
{
  "version": 1,
  "title": "untitled folio",
  "tempo": 112,
  "loop": 16,
  "key": "C major",
  "steps": [ "C4", null, "E4", null, ... ]   // exactly 16 entries
}
```

A step entry is a note string or `null` (empty).

- `"key"` (added 2026-07-28 with relative entry) is **optional on import**:
  a file without it, or with an unreadable one, is C major. Export and
  autosave always write it. See "Relative entry (contour mode)".

- Export and autosave always write version 1.
- Import accepts version 0 files unchanged and upgrades them in place. The
  validator also accepts `"x"` for backward compatibility and stores it as
  `null`; anything else that is not a parseable note is rejected.
- Autosave lives at the localStorage key `folio.v1`; a pre-existing
  `folio.v0` autosave is still read as a fallback, so no work is lost.

## Relative entry (contour mode) (added 2026-07-28)

A second way to write notes with the pad: instead of naming a pitch, you name
a **move** — up, down, again, rest — and the app works out the pitch. It is
an **input method, not a data model**. Steps remain absolute note strings in
memory, in the save file, in the autosave and in every quest workspace; nothing about
the format changes at all. The mode exists only between the button press and
the note that gets written.

The unit is **one step of the key**, not a semitone. That requires a key.

### The key of the piece

- A key is a tonic and a mode: `major` (`0 2 4 5 7 9 11`) or natural `minor`
  (`0 2 3 5 7 8 10`). Default **C major**.
- Persisted as an **optional `"key"` field** in the save file, e.g.
  `"key": "E minor"`. A file without one, or with one that cannot be read,
  loads as C major — old files stay valid and the validator stays permissive.
  Export and autosave always write the field, normalised to a sharp spelling
  and a lower-case mode (`"F# minor"`).
- Shown on the header meta line in the existing quiet style:
  `untitled folio · 112 · octave 4 · E minor`.
- **Set on the F1 key page**, which is where it is also explained — no
  modifier chords to remember, and reachable from either input:

  | | keyboard | gamepad |
  |---|---|---|
  | move the tonic a semitone | `←` / `→` | d-pad ← / → |
  | major or minor | `↑` / `↓` | △ (Y) or ✕ (A) |

  The tonic wraps through the twelve pitch classes. Setting the key
  autosaves; it changes no note already on the page.

### Switching methods

| | keyboard | gamepad |
|---|---|---|
| relative or absolute entry | `F4` | **hold select** for ½ s |

Select still walks the pages (key → quest log → closed) on a **tap**; the page
cycle simply fires on release now, so a held select can mean something else.
The method persists in `localStorage` under `folio.entry` — a preference, not
part of the document — and shows on the meta line as a quiet `· relative`
when it is on (absolute is the default and says nothing).

Keyboard note entry is **absolute in both methods** and completely unchanged;
there is no keyboard mirror of the relative moves. Relative entry is a pad
feature.

### The mapping (bare face buttons, relative entry)

| button | move |
|---|---|
| △ (Y) | up one step of the key |
| ✕ (A) | down one step of the key |
| ○ (B) | the previous note again, exactly |
| □ (X) | a rest (writes `null`) |

All four write at the cursor and **advance**, and a note is auditioned as it
is written, exactly as absolute entry does.

Modifiers — the bumpers, not the triggers:

| held | △ / ✕ becomes |
|---|---|
| L1 (LB) | a leap of a third — 2 steps of the key |
| R1 (RB) | a leap of a fifth — 4 steps of the key |
| L1 + R1 | a **semitone**, ignoring the key — the out-of-key escape hatch |

○ and □ ignore the bumpers. **The crossbar is untouched**: hold L2/R2/both in
either method and the eight slots are the same twenty-four absolute
semitones, with the d-pad given over to them as always. That is the whole
reason the leaps live on the bumpers.

L1/R1 are the base octave elsewhere. In relative entry they act **on release,
and only if they were not used as a modifier while down** — so a tap still
shifts the octave and a hold-and-△ does not. In absolute entry they are
unchanged (they fire on press).

Nudge — change a note without advancing:

| | relative entry |
|---|---|
| d-pad ← / → | the note under the cursor, down / up one step of the key |

Up and down (d-pad, left stick) remain time, the right stick still strides by
fours, and an empty step says so rather than writing anything.

While the roll is open the pairs trade places to match the drawing, in
either entry method: ← / → (d-pad and left stick alike) walk the cursor,
↑ / ↓ nudge the note under it up / down a step of the key. See "The roll".

### The anchor rule

A relative move needs a previous note to move *from*.

1. Scan **backwards from the cursor**, step by step. The first sounding step
   found is the anchor — **rests do not break the chain**.
2. The scan **wraps**: around the loop while the cursor is inside it (the
   loop is what the ear actually repeats), around the whole page otherwise.
   A full wrap ends on the cursor's own step, which therefore anchors as a
   last resort.
3. If the page holds no note at all, △/✕/○ all write the **tonic in the base
   octave** — the seed a contour needs.

The anchor is the *previous sounding note*, never the previous button press,
so mixing crossbar entry, keyboard entry and relative moves works: whatever
is on the page is what the next move counts from.

### The snap rule (out-of-key anchors)

If the anchor is not in the key, it is first moved to the **nearest note of
the key in the direction of travel**, and *that counts as the first step*.
In C major:

- △ from F♯4 → **G4** (nearest scale tone above; the step is spent snapping).
- ✕ from F♯4 → **F4**.
- L1 + △ from F♯4 → **A4** (snap to G, then one more step).
- ○ from F♯4 → **F♯4** — a repeat is literal and never snaps, so a
  deliberate chromatic note can be held.

So a note written with the L1+R1 escape hatch rejoins the key on the next
plain move, which is the behaviour "Keep the Stray" wants.

### Range

Every relative result — moves and nudges alike — is clamped to **C2…C6**
(MIDI 36…84), the range the base octave already implies, and the footer says
"the end of the range" when a move is clamped. The anchor is clamped into the
same range before the move is computed.

## The tempo (added 2026-07-28; supersedes the "no tempo UI" non-goal)

Tempo was always in the save file — `"tempo": 112`, version 0 onward — and
was always read by the scheduler. What changes is that it is now **settable
from the app**, on the F1 key page, beside the key. Nothing about the file
format changes, and no new field appears anywhere.

- **Range 60–180 BPM**, clamped at both ends; the footer says "the end of the
  range" when a press is clamped, in the same words the octave and the
  relative moves already use.
- **Coarse step 4 BPM, fine step 1 BPM.** Four is the useful unit — a few
  presses move the feel of the piece; one is for settling.
- **Per workspace, like the rest of the document.** Each quest holds its own
  tempo, free play holds its own, and changing one changes nothing anywhere
  else. It travels in the workspace's pattern in `quest-log.json` and in the
  `.folio.json` export, exactly as it always did.
- **Live.** The lookahead scheduler reads the step duration at the top of
  every window (25 ms), so a change made during playback takes effect on the
  next step scheduled: no restart, no re-scheduling of a step already
  promised, no click. A step already committed keeps the spacing it was
  given, which is why one step-length of the old tempo survives a change —
  that is correct, and it is what keeps the audio clean.
- The header meta line already showed the tempo and keeps doing so:
  `untitled folio · 120 · octave 4 · G major`.

### Bindings

The arrows on the key page were already the key, so the tempo takes the two
keys immediately left of backspace — free on that page, and adjacent by
**position** on any layout, per the layout-independence rule (`Minus` and
`Equal`; the numpad's `-`/`+` do the same).

| | keyboard | gamepad |
|---|---|---|
| tempo down / up, by 4 | **the two keys left of backspace** (`Minus` / `Equal`), or numpad `-` / `+` | d-pad ↓ / ↑ |
| … by 1 (fine) | the same, with `Shift` | the same, holding L1 **or** R1 |

Nothing already bound on that page moves: `←`/`→` and d-pad ←/→ are still
the tonic, `↑`/`↓` and △/✕ are still major/minor, `Escape` still closes it.
The bumpers are only a modifier here — they are not the base octave on this
page, because the page swallows everything else already.

## Quests as workspaces (added 2026-07-28; replaces the quest tracker)

The eight Lesson 1 constraint études from `QUESTS.md` are embedded in
`folio.html` as a static array (no fetch — the app must keep working from
`file://`). Each quest is a **workspace**: a whole page of its own — steps,
title, tempo, loop and key. One more workspace, **free play**, belongs to no
quest. The active workspace is the page in front of you.

### Why the bind/load model was removed

The first version (the morning of 2026-07-28) gave each quest one *motif*,
bound with `B`/□ and loaded back with `L`/△ behind a two-press confirm. It
produced a data-loss-shaped failure the same day: a piece was composed under
a quest, believed to be attached to it, exported — and the log was empty,
because the bind key was never pressed. Explicit bind and load are therefore
**dead**. Nothing in the app now asks the user to remember to save.

### The model

1. Every quest holds its own full pattern document. So does free play.
2. The page autosaves into the active workspace on **every modification** —
   the same autosave mechanism as before, extended to write the workspace
   set instead of one document.
3. Choosing a quest on the quest page **switches workspaces**. Because the
   page is already saved where it lives, the switch is instant and lossless
   in both directions. No confirm, no bind, no load.
4. Choosing the quest you are already in returns to **free play**.
5. Nothing is ever copied between workspaces, so nothing can be overwritten:
   each workspace is its own document.

Switching resets the cursor to step 1 and stops playback. The base octave and
the entry method are preferences and do not belong to a workspace.

### Bindings

| | keyboard | gamepad |
|---|---|---|
| open / close the quest log | `F3` (also `Escape`) | select (cycles the pages), or R3 |
| move the selection (wraps) | all four arrows | d-pad up / down, left stick |
| switch to that quest's workspace | `Enter` | ✕ (A) |
| … the quest you are in: back to free play | `Enter` again | ✕ (A) again |
| toggle complete | `KeyC` | ○ (B) |
| export the whole state | `Ctrl+S` while the log is open | — |
| import it | `Ctrl+O`, or drop the file anywhere | — |

△ (Y) and □ (X) do nothing on the quest page — there is nothing left to bind
or to load. All bindings are by `KeyboardEvent.code`, per the
layout-independence rule; while the log is open, note keys and the gamepad
crossbar are swallowed and cannot reach the pattern.

### Seeded quest keys and tempos (added 2026-07-28)

Choosing a key and a tempo is not a Lesson 0 decision — at L0 the user is
learning to place notes, and being asked "what key? how fast?" before the
first note is a toll, not a lesson. So **the app decides, once, per quest**.

A quest's workspace is created the first time that quest is entered. At that
moment, and only then, it is seeded with a key and a tempo chosen to suit its
constraint, instead of the C-major/112 default. The user then simply writes;
the header meta line says what they are in. Over eight quests they meet eight
different colours without ever having been asked to pick one.

| quest | key | tempo | why |
|---|---|---|---|
| `ladder` | G major | 120 | bright and neutral — a scale is easy to hide in it |
| `whitespace` | A minor | 88 | slow enough that the silences breathe |
| `summit` | D major | 112 | open, climbing |
| `stones` | A minor | 100 | sparse and steady |
| `ouroboros` | D minor | 100 | circular, brooding — the seam quest |
| `callanswer` | F major | 104 | conversational warmth |
| `stray` | E minor | 96 | E minor plus a stray F♮ is the sound the quest is about |
| `hand` | C major | 128 | neutral and brisk, for transcription |

Rules, all of them:

- **Seed on creation only.** `workspaceDoc(id)` seeds when it makes the page.
  A workspace that already exists — from storage, from `quest-log.json`, from
  an imported log, from a log written before the seeds existed — is never
  touched.
- **Free play is never seeded.** It is C major at 112, as it always was.
- **The seed is a starting value, not a rule.** The F1 page changes both, the
  change is autosaved into that workspace like any other edit, and it
  survives switching away and reloading. There is no "reset to seed".
- **Nothing is blocked and nothing is confirmed.** No prompt, no modal, no
  flag; note entry works from the first keystroke in a fresh quest.
- **The pattern format gains no field.** The seed is not recorded as a seed —
  it is simply what `key` and `tempo` happen to be in that workspace's
  ordinary version-1 pattern.
- The seeded key is a real key: relative entry counts its steps in it, and an
  empty page anchors on its tonic. The seeded tempo is a real tempo: it is
  what the scheduler plays.

> An earlier design for this slot — a "pre-flight rite" that held note entry
> in an empty quest until a key and a tempo had been chosen or confirmed —
> was specified and then withdrawn by the user before it shipped, on the
> grounds that it made the user do the work the app should be doing. Recorded
> here so the seeds are not mistaken for a simplification of something that
> once existed: they replaced it before it existed.

### The quest page

The quest log is a **page**, exactly like the F1 key reference — it replaces
the column, no overlay, no dimming, no dialogs. The two pages are mutually
exclusive.

- A **free-play line** sits above the list, marked `⚔` when it is where you
  are. It is not navigated to directly: the active quest, chosen again, is
  the way back.
- The list is names and status glyphs only: `‸` selection caret, `⚔` gilt
  sigil on the active workspace, `❧` gilt for complete, `•` faded when the
  workspace has something written in it, nothing when untouched. The
  selected row takes the same flat `--wash` as the playhead row.
- Below the list, the **selected quest in full**: its constraint verbatim
  from `QUESTS.md` and its *teaches* line, then a line saying whether you
  are working there, whether it is complete, and whether anything is
  written yet.
- A **contour preview** of that workspace's saved pattern, drawn in the
  roll's visual language: one rounded dab per sounding step, coloured by
  pitch class on the circle of fifths, height is pitch, time runs right,
  steps beyond the loop faded. **No gridlines, no beat rules, no numbers,
  no stripes** — it is there to be recognised, not read. An empty workspace
  draws nothing and the state line says "nothing written yet".

### The side rails

The page has always had wide parchment margins. They now carry the two
things worth having in view while composing, and nothing else:

- **Right rail** — the active workspace: its name, its constraint in full,
  its *teaches* line, and whether it is marked complete. This is the point
  of the whole rework: the constraint is visible while you noodle. In free
  play it says so and explains what free play is.
- **Left rail** — every workspace: free play and the eight quests by their
  short names, each with its status glyph, the active one in ink and the
  rest in faded ink. Switching context is visible without opening a page.

Both rails are `position:fixed` in the margins (they never touch the
column's layout), faded ink, generously spaced, one hairline under each
heading and no border heavier than that, no grid, no wash, no motion,
`pointer-events:none`. At **≤ 80 rem** of window width they collapse away
whole (`display:none`) rather than squeeze the column.

### Storage

Quest state lives **outside the pattern file** — the save format is
unchanged and gains no fields.

- `quests/quest-log.json` holds the same document on disk whenever the app
  is served by `server.mjs`, and is the authority at boot there.
- `localStorage["folio.quests.v2"]` holds everything: the free-play page,
  every quest workspace that exists, the done flags and the active id.
- `localStorage["folio.v1"]` keeps a copy of the **active** page, so an
  older build or anything else reading the browser's storage still finds a
  pattern where it always was. It is read only at boot, as a migration
  source; `folio.quests.v2` is the authority.
- Each workspace page is an ordinary version-1 pattern object and is read
  back through the same validator as an imported file; an unreadable page
  is dropped and the rest of the state still loads.

```json
{
  "folio": "quest-log",
  "version": 2,
  "active": "summit",
  "free": { "version": 1, "title": "untitled folio", "tempo": 112,
            "loop": 16, "key": "C major", "steps": [ "C4", null, … ] },
  "quests": {
    "summit": { "done": true,
                "pattern": { "version": 1, "title": "…", "tempo": 112,
                             "loop": 16, "key": "C major",
                             "steps": [ "C4", null, … ] } }
  }
}
```

Only quests that have been entered or completed are written. `"active"` is
`null` in free play. Quest ids: `ladder`, `whitespace`, `summit`, `stones`,
`ouroboros`, `callanswer`, `stray`, `hand`.

### Migration (v1 → v2)

At boot: read `folio.v1` (or `folio.v0`) as before; that page becomes the
**free-play** workspace. Then read `folio.quests.v2`. If it is absent, read
`folio.quests.v1` and migrate:

- each quest's bound **`motif` becomes that quest's workspace page**,
- `done` flags carry over unchanged,
- the old "standing objective" becomes the active workspace,
- the result is written forward as `folio.quests.v2` immediately; the v1
  key is left in place, untouched.

No user data is lost, in either direction. The version-1 shape is also
accepted on **import**, so an old `quest-log.json` on disk still opens and
migrates the same way (`"motif"` is read wherever `"pattern"` is expected).

### The log on disk — the local server (REPLACED the disk link, 2026-07-28)

`localStorage` is invisible from outside the browser, so the state also goes
to a real file — the one place a collaborator, or an agent reading the
repository, can see the whole picture.

The first attempt at this (the same day) was a File System Access "disk
link" on `K`: the save-file picker plus a handle kept in IndexedDB. It was
verified only in a probe and **did nothing on the user's real Chrome from
`file://`**. It is gone — code, binding and documentation — and is replaced
by a proper backend, small enough to read in one sitting.

**`server.mjs`** — Node, zero npm dependencies (`node:http`,
`node:fs/promises`, `node:path`, plus `node:os` for the LAN URL only). Start
it by double-clicking **`folio.cmd`** (which is just
`@node "%~dp0server.mjs" %*`) or with `node server.mjs`, then open
**http://localhost:4173**.

| route | behaviour |
|---|---|
| `GET /` | `folio.html` |
| `GET /<name>.{html,js,mjs,css,json,svg,png,ico}` | that file, from the repo root only |
| `GET /api/quest-log` | `quests/quest-log.json`, or **404** if there is none yet |
| `PUT /api/quest-log` | validates JSON with `"folio": "quest-log"`, writes a temp file and renames it over the real one (atomic — a reader never sees half a log), **204**. `400` on anything else |

- Binds **127.0.0.1:4173**. `PORT` overrides the port. `--lan` binds
  `0.0.0.0` instead and prints the LAN URL, for sharing with the family
  later; the default stays localhost-only.
- Static serving is **repo root only**: no subdirectories, no `..`, no
  backslashes, and only the extensions above — so `GET /../BUDGET.md` and
  `GET /BUDGET.md` are both refused (403 / 404). The pattern files under
  `quests/` are reachable only through the API.
- One quiet log line per request; `EADDRINUSE` prints what to do and exits 1.

**In the app.** The mode is decided once at boot by
`location.protocol`.

- Over **http(s)**: at boot the app `GET`s the log and, if there is one,
  **the server is the authority** — its state replaces whatever
  `localStorage` had just loaded, the cursor returns to step 1, and the
  footer says "restored from the server". A **404 is not a failure** (there
  is simply no log yet; the first push creates it) and an unreachable or
  unreadable server falls back to the localStorage state — never to an empty
  page.
- Every autosave also `PUT`s the whole version-2 state, debounced **2 s**
  and fire-and-forget, so a burst of note entry writes once.
- `localStorage` keeps working underneath in both modes, as cache and
  offline layer; it is written first and always.
- Failure is quiet and never blocks: the footer, only while the quest log is
  open, says `· synced` or `· sync failed — working locally`, and the next
  change retries.
- From **`file://`** none of this happens and nothing else changes.

**By hand (both modes, unchanged).** `Ctrl+S` with the quest log open writes
the same JSON as `quest-log.json`, to be kept at `quests/quest-log.json`;
`Ctrl+O` or a drag-and-drop reads it back. A quest log is recognised by its
`"folio": "quest-log"` marker and opens as a quest log wherever it is
dropped, without being mistaken for a pattern.

The convention from `QUESTS.md` stands alongside all of this: finished
pieces are still saved as `quests/<quest-name>.folio.json`, and `Ctrl+S` on
the pattern page exports the **active workspace** as an ordinary
`.folio.json`, format unchanged.

## Drill quests and live delivery (added 2026-07-28)

The eight quests are the standing curriculum and live in `folio.html`. A
**drill** is a short étude written into the quest log *from outside* — by a
collaborator, or by the assistant working in the repository — so that new
practice can be handed to the user without touching the app, and **without
the open tab either missing it or writing it away**.

### The schema

`quests/quest-log.json` gains one optional top-level key:

```json
"drills": [
  {
    "id": "drill-itch",
    "name": "the itch drill",
    "summary": "one line: the constraint",
    "teaches": "one line: what it is for",
    "pattern": { "version":1, "title":"…", "tempo":104, "loop":8,
                 "key":"F major", "steps":[ … 16 … ] }
  }
]
```

- `pattern` is an ordinary page — the same shape a `.folio.json` has, read by
  the same validator — and it is the workspace's **seed**: what the page
  arrives holding the first time that drill is entered, exactly as the
  built-in seeded keys and tempos are. A drill with no readable pattern
  simply starts on an empty page in C major at 112.
- Everything else about a drill is a quest: it is listed, selected, entered
  and left with the same keys; its workspace lives in `quests/<id>` in the
  log like any other, with `done` beside it; both rails carry it; `C` marks
  it complete.
- `id` is trimmed and must not be a built-in quest's id — a drill can never
  shadow `ladder`, `summit` and the rest.
- Drills render **below the eight**, under a quiet hairline labelled
  *drills*, in the order the file lists them — in the quest page and in the
  left rail alike. With no drills, no divider is drawn.
- The right rail and the quest detail show `name`, `summary` and `teaches`.

**Missing definitions.** A workspace in storage whose id has no definition
(the drill was deleted from the file, or the log arrived from elsewhere) is
never dropped: it keeps a **ghost** definition — rendered by its id, with no
summary and no teaches — so the work is still listed and still enterable. A
ghost is never written back out as a definition, and it is replaced the
moment a real definition for that id arrives.

### Delivery: poll and merge, without a reload

In **server mode only** (never `file://`, never the static copy):

- The app re-reads `GET /api/quest-log` about every **10 s**. It sends
  `If-None-Match` with the tag it was last given, so an unchanged file costs
  one **304** and no body.
- The poll **stands aside** while a push is pending (the 2 s autosave
  debounce is armed) or in flight, so the two never cross.
- `server.mjs` answers `GET` with an **ETag** — the SHA-1 of the file's
  bytes, so identical content is an identical tag whatever the mtime says —
  and honours `If-None-Match` with **304**. The **204** of a `PUT` also
  carries the tag of what was just written, so the next poll is a 304.

**The merge rule is deliberately as narrow as it can be.** From a polled
file the app adopts:

> a drill **definition** whose id this session has never seen (or holds only
> as a ghost) — **and nothing else, ever.**

Not workspaces, not `free`, not `done`, not `active`, not the built-in
quests. Nothing is ever removed, and a definition that is already known is
never overwritten — so editing a drill on disk does not reach into a
workspace someone is working in, and deleting one from the file does not
take it off the page. An adopted drill is saved into `localStorage` without
scheduling a push (it is an arrival, not a change), and announces itself once
in the footer, quietly: `· a drill arrived: <name>`. The next thing the page
says clears the notice.

**PUTs round-trip drills.** `stateToJSON()` includes every definition the
session knows (ghosts excepted) as `drills`, so an ordinary autosave keeps
them in the file rather than erasing them. The key is omitted entirely when
there are none.

### Race hardening on the server

Cheap insurance for a stale tab that has not polled since a delivery: before
`PUT` overwrites the file, `server.mjs` reads what is on disk and **keeps any
drill whose id the incoming body does not mention**, appending it to what is
written. Only `drills` is preserved this way — a workspace, a `done` flag and
`active` all belong to the page and are written as sent.

### Modes

| mode | drills |
|---|---|
| `file://` | whatever a log carries when it is imported; no polling |
| server (`http://localhost:4173`) | listed, delivered live, round-tripped on every push |
| static copy | listed read-only-style like everything else, from the committed seed; **no polling, nothing sent** |

## Appearance — manuscript, not skeuomorphism

The reference points are FF menu calm, Granblue's gilt-on-cream warmth, and
renaissance manuscript ruling. The governing principle, above the aesthetic
one: **low visual noise is a hard requirement** (migraine trigger). Where
ornament and calm conflict, calm wins.

### Migraine rules (REVISED 2026-07-27 — v1 overshot)

> **Correction from the user after v1 shipped:** the actual triggers are
> **grid/stripe patterns** and **extreme contrast** — that's the whole
> constraint. Texture is fine; the v1 rules below banned far more than
> needed (no-texture, no-gradient, luminance-band limits were overcautious
> inferences, not requirements). For the next visual pass: keep the
> no-grids / no-harsh-contrast rules, relax the rest, and take design
> sense from `E:\experiments\skyhearth` (reference project for the user's
> taste). Rules 2 (no flashing) and 5 (calm motion) also stay — they're
> good defaults, just not medical requirements.

### v1 rules as shipped (historical)

1. **No texture tiles, no grain, no noise overlays.** Parchment is evoked
   by *color*, not by high-frequency texture. At most one large, very
   low-contrast radial vignette (≤ 3% luminance delta) to soften the page.
2. **No flashing or blinking.** Nothing on screen changes faster than the
   step rate, and the only thing that changes at step rate is the playhead.
   Cursor indicator is steady, not blinking.
3. **Low-contrast structure.** Grid rules, borders, and beat markers stay
   within a narrow luminance band around the ground color. The only
   high-contrast elements are the note glyphs themselves (ink on
   parchment — that contrast is the *point* and is confined to text).
4. **No stripes.** Row separators are single hairlines at low contrast,
   generously spaced (rows ≥ 2.2 em tall). No alternating row tints.
5. **Motion:** the playhead *steps* (discrete position change, no strobe,
   no trailing glow). Any easing anywhere is ≥ 150 ms and only on
   user-initiated changes. `prefers-reduced-motion` removes even that.
6. **No pure white, no pure black** anywhere.

### Palette (flat colors, no gradients except the vignette)

| Role | Color | Note |
|------|-------|------|
| Ground (parchment) | `#EAE0CC` | warm, mid-light, flat |
| Ink (notes, primary text) | `#3B2F1E` | dark umber, not black |
| Faded ink (empty steps `·`, labels) | `#A99C82` | low contrast vs. ground |
| Rule lines / borders | `#C9BCA0` | hairlines only |
| Gilt (accents, playhead marker) | `#9C7A28` | muted gold, used sparingly |
| Playhead row wash | `#E0D2B4` | ≈ 5% darker than ground, flat |

### Typography

System serif stack, no webfonts: `"Iowan Old Style", "Palatino Linotype",
Palatino, Georgia, serif`. Notes render as `C‑4`, `F♯3` (real sharp glyph)
in the ink color. Header title in small caps (`font-variant: small-caps`),
letter-spaced slightly. No bold anywhere except the note under the cursor.

### Layout (single screen, centered, no scrolling)

```
┌─────────────────────────────────────────────┐
│            F  O  L  I  O                    │   header: title, small caps,
│      untitled folio · 112 · octave 4        │   one hairline rule below
├─────────────────────────────────────────────┤
│                                             │
│         1   C-4                             │   the column: 16 rows,
│         2    ·                              │   step number in faded ink,
│         3   E-4                             │   note in ink, generous
│         4    ·                              │   leading; beats 1/5/9/13
│      ❧  5   G-4        ← playhead fleuron   │   get a slightly firmer
│         6    ·                              │   hairline above, nothing
│        ...                                  │   more
│        16    ·                              │
│                                             │
├─────────────────────────────────────────────┤
│   ‸ cursor row · F1 for the key            │   footer: one quiet status
└─────────────────────────────────────────────┘   line, faded ink
```

- The column sits centered with wide parchment margins (the margins are the
  ornament — negative space instead of decoration).
- Cursor row: note glyph in bold + a small steady marginal mark (`‸`).
  Playhead row: the flat wash + a gilt fleuron (`❧`) in the left margin.
  When cursor and playhead coincide, both marks show; no color blending
  tricks.
- Exactly one decorative flourish is permitted in the whole app: a thin
  gilt hairline ornament under the title. Nothing repeats, nothing tiles.
- F1 key-reference panel: same palette, replaces the column (no overlay
  dimming, no modal animation).

## Acceptance checklist

- [ ] Opens from `file://` and is interactive in < 1 s.
- [ ] A C-major scale can be entered, played, corrected, exported,
      re-imported, and replayed without touching the mouse.
- [ ] Ten consecutive loops: no clicks, no pops, no drift.
- [ ] Closing the tab and reopening restores the pattern (autosave).
- [ ] Every migraine rule above verified by inspection; reduced-motion
      honored.
- [ ] Nothing on the page blinks, pulses, scrolls, or tiles. Screenshot at
      rest could be mistaken for a page from a quiet book.

## Budget note

This spec + the build session that implements it are Lesson 0 work, drawn
from the $50 bootstrap grant. Log the statusline delta in `BUDGET.md` when
the session ends.
