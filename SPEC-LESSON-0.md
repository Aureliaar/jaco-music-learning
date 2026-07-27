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
pattern chaining (L6). No tempo UI: tempo lives in the save file only;
editing it there is permitted and costs nothing but shame.

## Technical shape

- **One file:** `folio.html`. Inline CSS + JS, zero dependencies, zero
  network requests, zero build step. Opens from `file://`.
- **Audio:** Web Audio API. One oscillator voice.
- **Persistence:** autosave to `localStorage` on every edit; `Ctrl+S`
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
  the column view, vertical now; cursor is the `‸` caret under its column
  plus a thin ink ring on its bar (the roll's answer to bold). Steps
  beyond the loop fade. Beats 1/5/9/13 are numbered in faded ink along
  the base.
- Migraine rules hold: no grids, no stripes, no flashing, nothing moves
  faster than the step rate, all washes flat.
- Pad navigation grew with it (2026-07-28): the bare d-pad moves the
  cursor in any direction, and the right stick strides by fours, beat to
  beat, on either axis.

### Save format, version 1

```json
{
  "version": 1,
  "title": "untitled folio",
  "tempo": 112,
  "loop": 16,
  "steps": [ "C4", null, "E4", null, ... ]   // exactly 16 entries
}
```

A step entry is a note string or `null` (empty).

- Export and autosave always write version 1.
- Import accepts version 0 files unchanged and upgrades them in place. The
  validator also accepts `"x"` for backward compatibility and stores it as
  `null`; anything else that is not a parseable note is rejected.
- Autosave lives at the localStorage key `folio.v1`; a pre-existing
  `folio.v0` autosave is still read as a fallback, so no work is lost.

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
