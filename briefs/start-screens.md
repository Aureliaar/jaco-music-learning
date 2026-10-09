# Start is a list of places — the navigation rework

Merged 2026-09-07. This brief is the record of what was agreed with the
player before it was built, and of what was deliberately left open.

## Why

Start raised a **settings crossbar**: eight slots in the FFXIV cross-hotbar
idiom, plus a second hidden drawing (the scriptorium) reached by L1/R1, plus
a chip row to say which drawing was up. Three things were wrong with it, and
the player named all three:

1. **←→ navigated the quest categories** — a thing turned about once a week,
   holding two of the eight seats, while the pad had no way at all into the
   quest log.
2. **The scriptorium was hard to reach and outdated** — a second drawing
   behind a bumper, with two rails for a folio that has three voices, written
   before REAPER existed.
3. **Solo and mute were weird** — two stored arrays saying one thing twice.

The deeper problem, which the player put better than the brief did: an action
bar is a shape with holes asking to be filled, so *everything* starts to look
like it deserves a quick-slot. That pressure produced the hidden drawing, a
slot that answered "nothing on that slot yet", and — in the first draft of
this very rework — a second crossbar under a held trigger.

**The cross-hotbar idiom belongs on the page**, where the triggers, bumpers
and face buttons write notes every few seconds and earn it. Away from the
page it is the wrong shape.

## What start is now

Five places, turned with L1 and R1:

    folio · voices · quests · settings · mirrors

- **folio** — the page, whole. The watermark lifts; the strip is all that
  stands over it. ✕ or ○ and you are writing.
- **voices** — one row a voice: its name, the rail of instruments it can
  wear, whether it is heard. Walking the rows *is* choosing the voice.
- **quests** — the log, in the two margins. The lesson tabs live here and
  only here, which is where turning a lesson stopped being a pad seat.
- **settings** — what is not the music: the background, the drawing, the
  names on it, saving and opening a folio.
- **mirrors** — named before it exists, faded, so the shape of the menu will
  not change on the day the arrangement lesson lands.

The page behind is **never taken away** — the board included, since the
2026-09-08 pass below. It washes out and goes on playing, because turning a
dial and hearing what it did are one movement.

## The one rule

Mechanical, with no per-row exceptions to remember:

| press | means | after it |
| --- | --- | --- |
| ← → | turn a value | the screen is still up |
| ✕ | finish an act | you are on the page |
| ○ | back one step | out of a sub-state, else out |
| start | put it all down | the page, from any depth |

← → is for things you set, hear, and set again — an instrument, a background,
a drawing, the lesson listed. ✕ is for acts that finish: into this quest,
write in this voice, save the folio. Nothing ✕ does leaves you wanting the
screen still standing. □ and △ are per-screen verbs and never close anything,
which is why mute and solo sit on them.

**The one seam**, deliberate and agreed: ○ on the quests screen is still
*complete*, not *back*. Moving that mark would spend the muscle memory of a
whole lesson's board, and completion itself is under review — so start is the
way out of that screen until it is settled. Everywhere else ○ is back.

## The page stays visible (2026-09-08)

The first cut said *not the page* by absence: the drawing was replaced
outright on the quests screen and everything else went to a tenth of its
ink. That is the one thing worth keeping — you are choosing what to write
next while looking at what you wrote — so the cue had to be carried by
something other than taking the page away. Three things carry it now, none
of which costs the folio any legibility:

1. **The desk.** While any screen is up the ground steps down one shade to
   `--desk`, and the folio becomes a lit sheet lying on it with an edge and
   a soft shadow. A whole-field change, no flood fill over the paper, and
   the step is one this palette already takes between `--ground` and
   `--wash`. Paper only: on a scene the ground is a veiled photograph
   already, and a second veil over it is a fog.
2. **The wash.** The drawing, the strip and the margins go to about a third
   of their ink instead of a tenth. The bars and the shape of the phrase are
   still readable; they stop competing. Two exceptions, both deliberate: the
   playhead row's flat wash is deepened by as much as the wash takes away,
   because it is what says the page is still running while you are away from
   it; and the bold on the cursor row — the only bold in the app — goes,
   because it has no business being the loudest thing on a page you cannot
   type into.
3. **The rim.** Whatever is live is lit and rimmed in gilt on the page's own
   parchment: the board in the left margin, and the voices and settings
   panels in the middle. A row of words laid straight on a note was two
   things in one place; the panel fixes that and says which column the caret
   is walking at the same time.

### The board went to the margins

**A quest is a workspace.** The left margin's list and the quest log were
always one list drawn twice, so the board is not a page any more: it is that
margin promoted — the lesson tags, free play, the quests, the caret walking
them — and the right margin reads the one under the caret in full, which is
the job that margin already had. The margins' quiet copies stand down while
it is up; two lists of the same thing is a pinboard.

`#quests` and `#qdetail` therefore live outside `<main>`, beside the rails,
so the sheet can be a sheet and these can be furniture on the desk. Under
80rem, where the rails are dropped whole rather than squeezed, the board
comes back to the middle as an overlay — over a washed page, never in place
of it, which is what every other screen does — and the right margin's
reading is dropped with the rails.

The scenery corner goes all the way out while a screen is up rather than
merely dimming: it sits exactly where the right margin now reads, and two
things in one corner reads as a fault. The settings screen says the same
thing in words while any screen is up, so nothing is lost.

**Not done, on purpose:** the page does not step back as well as wash. The
mockup had it scaled a little for depth, and a transform on `<main>` would
make it the containing block for everything `position:fixed` inside it — the
margins included. Two cues out of three carry it; the sheet's shadow is
doing the depth.

## Solo collapsed into mute

`solo` is gone from the document. Mute is the whole of it: what is heard is
what is not muted, and `audible(v)` is `!flag("mute", v)`. **Solo is a verb**
that mutes the others, and pressing it on a voice that is already alone gives
them all back. Muting the last audible voice is refused — silence is what
stop is for.

An old page carrying a `solo` array is read forward into the mutes it meant
(`readMutes` in `state.js`), so it sounds exactly as it did. The voice strip
now has one word to say, `muted`, or none; the third word, `silent`, is gone
with the state that needed it.

## The controls reference is cut

The key overlay (F1) is **deleted, not moved** — player ruling the same day.
A screen that has to explain the controls is an admission the controls
failed. What a control does is said on the screen the control lives on, in
its footer legend. F1 is still swallowed (unhandled it opens Chrome's help
and kills the animation frame with the playhead in it) but does nothing.

Do not propose reviving one in any shape.

## What moved where

| was | is |
| --- | --- |
| crossbar ↑↓ · the workspace rail | quests screen, ↑↓ |
| crossbar ←→ · the lesson | quests screen, ←→ |
| crossbar □ △ · solo, mute | voices screen, □ △ |
| crossbar □ △ · the echo's call and judgement | voices screen, □ △ (unchanged loan) |
| crossbar ✕ · the background | settings screen, "the background" |
| scriptorium drawing (L1/R1) | voices screen, ←→ per row |
| F3 · the quest log | F3 still, straight to the quests screen |
| F1 · the key overlay | deleted |
| ctrl+S, ctrl+O | unchanged on the board; also settings, "the folio" |

## Files

- `js/screens.js` — new. The five screens, the rule, the two lent seats.
- `js/quests.js` — the crossbar section deleted; the tone helpers kept and
  re-headed; `anyPage()` now asks `screenOpen()`.
- `js/state.js` — `solo` dropped from the document; `readMutes` reads an old
  page forward; `audible` simplified.
- `js/edit.js` — `toggleSolo` is a verb; `toggleMute` refuses the last voice;
  `toggleQuests` opens the quests screen.
- `js/views.js` — the key overlay deleted (~280 lines); the voice strip says
  one word; `applyViz` no longer knows about any screen at all, since none of
  them replaces the drawing.
- `js/entry.js` — F1 inert; the crossbar's keyboard and pad blocks replaced
  by the screens' routing.
- `folio.html`, `folio.css` — the crossbar markup and rules replaced by the
  strip, the watermark and the screens' own shapes.
- `scripts/build.mjs` — `js/screens.js` added to the copy list. **The list is
  hardcoded; a new js file must be added here or the deployed copy silently
  loses it.**
- `tests/e2e.js` — journey 3 now asserts the screens, the strip, the
  watermark and that turning enters nothing; journey 1's script count is 12.

## Left open, on purpose

- **Completion**, and therefore ○'s seam on the quests screen.
- **The right margin does two jobs.** It is the standing constraint while
  you write and the quest under the caret while you choose. Today those are
  the same words, so it holds. It stops holding the first time a quest you
  have not entered wants to say something different from the one you are in.
- **Voices and settings have no margin to promote**, so they are still
  centred panels. They want a shape of their own eventually.
- **The chord lane has no instrument rail of its own.** It is played by the
  lead's own tone (`TONE[v] || TONE[0]` in `audio.js`, and `doc.tones` is
  only `VOICES` long). The voices screen says so in words rather than drawing
  seats with nothing behind them.
- **The rack's five seats are not exposed.** `midiSelectInstrument(voice,
  seat)` is still the hidden seam and only seat 0 has instruments behind it;
  drawing four empty seats would be the same slots-asking-to-be-filled
  mistake this rework exists to undo. Adding real rack instruments stays
  quest-budgeted per the 2026-08-29 ruling.
- **The scenery corner control** now says the same thing as the settings
  screen's first row. It is dimmed while a screen is up and otherwise left
  alone; whether to delete it is the player's call.
- **`briefs/chord-palette.md` and `briefs/duplicate-workspace.md`** both name
  a crossbar seat as their pad home. Those homes no longer exist and must be
  re-agreed with the player before either is built.
