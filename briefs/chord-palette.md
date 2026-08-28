# Queued feature brief — palette mode for the chord lane

*Authored 2026-08-28 from player direction, the day the chord lane went
live. Small buildout on top of `briefs/chord-lane.md` — read that brief
and THE CODE first (`js/chords.js`, `js/entry.js`); the code is the
source of truth, and a parallel session is mid-flight in those files as
this is written (cells have grown `inversion`/`octave` since the brief).
Read `AGENTS.md` rules 3 (the gamepad is primary) and 4 (relations, never
identities).*

## The ask, in the player's words

> mayhaps in every fragment, we should pre-define a set of chords and
> have markers to play one of the predefined, rather than allowing
> everything?

## What it is

A fragment may own a **palette**: a small named set of chords, defined
once at the top of the fragment. With a palette present, a lane cell
holds a *marker* — "palette slot 2 here" — instead of a full
deg+shape+voicing edit. The two real decisions of song-shaped harmony
become visible and separate: *which chords does this piece own*
(decided once) and *when does each land* (decided per cell).

Palette is a **mode, not a cage**. The same day this was proposed, the
player built a piece that walks every degree of the chord-scale in
order — free per-cell entry earned its keep for that *line* style of
harmony. Palette serves the *places* style (a few rooms, meaning by
return). A fragment with no palette behaves exactly as today, byte for
byte; the field is optional and dropped whole if malformed, like
`mirrors`, `echo`, and `chords` itself.

## Why it pays twice

1. **Composition:** matches how song-shaped pieces behave — three to
   five chords, arranged. Choosing among a few is a real choice;
   constructing from everything in every cell is freedom minus music.
2. **Quests:** a board quest can *ship its palette*. "Triads only" or
   "two roots, a fifth apart" stop being copy rules held in the head
   and become the shape of the room — the constraint is what's on
   offer. This is the Give Way principle applied structurally.

## Mechanics (sketch — settle against the live code)

- Page doc grows an optional `palette: [ {deg, shape, …} , … ]` —
  entries in the same cell vocabulary the lane already stores, capped
  small (8 slots max; see pad note). A palette cell in the lane stores
  a slot index; pitches stay computed, never stored, voicing rules
  unchanged (near-voicing still reads the previous *sounding* chord).
- Editing the palette itself reuses the existing per-cell chord
  controls — nothing is thrown away, the current editor moves up a
  level to the palette definition row.
- Drill seeds may carry a palette in `pattern`. Never deliver the field
  to a tab running code that doesn't know it (the standing schema rule).
- Display in the player's numeral-shape reading (I-135, V-1357): the
  slot is *shown* by relation, never by name.

## The pad (gating open point)

Up to eight slots maps straight onto the crossbar idiom — a face
button per chord: tap to stamp into the standing cell, hold to
audition. **The concrete layout must be agreed with the player before
build** (standing rule: pad UX first, layout agreed before code).
Keyboard bindings by `e.code`, never by produced character.

## Open points

1. Pad layout — see above; this gates the build.
2. Does entering palette mode convert existing free cells, refuse, or
   coexist (marker cells and free cells side by side)? Coexist is the
   guess — palette as an offer, not a lockout — but play it.
3. Where the palette row lives visually (no grid/stripe patterns,
   no extreme contrast).
4. Whether quest seeds that ship a palette also *lock* it for the
   quest, making the constraint structural. Likely yes — that is half
   the point — but it needs the ruling mechanism looked at.

## Rules that bind here as everywhere

Never touch `BUDGET.md`, `QUESTS.md`, `quests/quest-log.json`,
`quests/rulings.json`. The dev server on :4173 is the player's live
instrument — never restart it, never PUT to it. Zero dependencies,
no build step, `file://` must keep working.
