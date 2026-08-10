# The echo — Lesson 4.1's toolset

The folio plays a short *hidden* fragment (the call); the player answers it
back on the grid with the ordinary writing gestures; the folio judges the
answer against the call when it is asked to. The first tool here whose job is
listening rather than writing.

Echo quests arrive as **drills**. An echo drill's pattern doc carries one more
optional field, `echo`, and everything else about the workspace is exactly a
workspace: its own page, its own key and tempo, its own tones, its own line in
both rails.

## The schema

On a page doc, beside `len`, `tones` and `mirrors`:

```json
"echo": {
  "stage": "contour",
  "voice": 0,
  "at": 0,
  "call": [ { "step": 0, "note": "C4", "len": 1 },
            { "step": 2, "note": "E4", "len": 2 } ]
}
```

- `stage` — `"contour"` · `"degrees"` · `"rhythm"`. Required. One stage per
  drill; never all at once.
- `voice` — which voice answers. Optional, integer, `0 … VOICES-1`, default 0.
- `at` — the step of the page the answer begins on. Optional, integer,
  `0 … N-1`, default 0.
- `call` — the fragment, as a list of events. Required, non-empty.
  - `step` — where the event falls *inside the call*, counted from nought.
    Integers, strictly ascending, no repeats.
  - `note` — an ordinary note string (`"C4"`, `"F#3"`).
  - `len` — how many steps it rings. Optional, integer ≥ 1, default 1.

Read **strictly**, as `mirrors` is: anything that is not exactly this — a
stage nobody offers, a voice that is not a voice, a step out of order, a note
that will not parse, a call that runs off the end of the page from `at` — and
the whole `echo` is dropped and the workspace behaves as an ordinary drill. It
is written out only where it exists, so a page without one is byte for byte
the page it always was, and an older build simply does not see the field.

The call is **hidden**: it is never rendered in the column or the roll, never
written into the page's voices, never named in the footer. It exists to be
heard.

Derived: the **window** is `at … at + span - 1`, where `span` is the furthest
any call event reaches (`max(step + len)`). The answer is whatever is written
in that window, in the echo's voice.

## The controls

In an echo workspace **only**, two seats are lent:

| seat | ordinarily | in an echo workspace |
| --- | --- | --- |
| `O` / crossbar `□` | solo | **play the call** |
| `P` / crossbar `△` | mute | **judge my answer** |

The pad home is the settings crossbar under **start**, where solo and mute
already live: □ plays the call, △ judges. Everywhere outside an echo
workspace both are untouched, and solo and mute are themselves. The key
overlay (F1, and the crossbar's own drawing) says the changed meanings while
you are in one — it is the living key help and it must not lie.

## Playing the call

The call is played one-shot on the page's own tempo, key and tones, through
the same `playNote` the scheduler uses — so it sounds like the instrument and
not like a preview. It may be replayed as often as wanted.

**It stops the loop first.** The call heard against a running loop is two
pieces of music, and the ear cannot hold the one it is being asked to hold.
Simplest correct behaviour: press it while playing and the transport stops,
then the call sounds alone.

## Judging

On demand only — never automatic, never while writing. The verdict is a
`say()` line and a quiet mark on each note of *the player's own answer*: a
gilt underline where it rang true, a faint dotted one where it went astray
(and the same, drawn as a ring, on the bars in the roll). The marks are a
snapshot of the last judgement and are cleared by the next edit.

- **contour** — only the shape. The first answered note is always true (any
  pitch may start a shape); each one after it is true where its direction from
  the note before — up, down, again — is the call's direction at that index.
  Onsets and lengths are ignored.
- **degrees** — the pitches, as degrees of the seeded key. The whole answer
  may sit an octave (or several) out and still be true: the offset is taken
  from the first answered note and must be a whole number of octaves. A note
  outside the key is a miss. Onsets and lengths are ignored.
- **rhythm** — the onsets and the written lengths, on whatever pitch. An
  answered note is true where a call event begins on exactly that step and
  rings exactly as long. Pitch is ignored.

What a miss may say: how many of *your own* notes rang true, and that the
count differs from the call's. Never a note name, never a step, never a
direction — the drill corrects by ear, not by explanation.

## What is built

- `js/echo.js` — the whole of it: the reader, the play, the judge, the marks.
  Loaded after `edit.js`; plain `<script src>` like the rest.
- `js/state.js` — `validate()` reads the field, `docOut()` writes it only
  where it is.
- `js/quests.js` — the two crossbar seats, lent while an echo is in hand.
- `js/entry.js` — `KeyO` and `KeyP`, lent the same way.
- `js/views.js` — the marks on the writing and on the bars; the overlay's copy.
- `folio.css` — two quiet rules for the marks. No grid, no stripe, no blink.
