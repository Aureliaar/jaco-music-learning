# Brief — the chord lane (Lesson 5's toolset)

Read `folio.html` first: it carries a MAP comment saying what lives where.
THE CODE IS THE SOURCE OF TRUTH — read `js/entry.js` for what the pad and the
board actually do today, not this brief and not any other document. Read
`js/echo.js` and `js/quiz.js` as the two most recent additions: they are the
house style for a new file. Read `CURRICULUM.md` §Lesson 5 for what the
lesson teaches, and `CLAUDE.md` rules 3 (the gamepad is primary), 4 (build on
relations, never on identities) and 6 (testing policy).

## What it is

The third voice, and the biggest single unlock in the curriculum. Today a page
has a lead and a bass, one note per step each. Lesson 5 needs harmony, and the
player has ruled the shape of it: **a chord lane** — one lane whose cell holds
a chord as an *object*, not three coincident notes in three lanes.

A chord is written as a **scale degree plus a shape**. It is never named, never
spelled, never entered as "F major seventh". This is rule 4 and it is not
negotiable: the player has strong relational hearing and genuine difficulty
binding a name to a sound, so every control here asks how one chord sits
against the one before it.

## The page doc

A new optional field, read strictly and dropped whole if malformed, exactly as
`mirrors` and `echo` are — a page with no chord lane must be byte for byte the
page it always was, and an older build must never see the field:

    chords: [ {deg, shape, voicing} | null, … ]   /* one cell per step */

- `deg` — the root as a **scale degree** of the page's own key, the same
  integer vocabulary `js/echo.js` and the material files already use (0 the
  tonic, 1..6 the steps above, 7 the octave, negatives below).
- `shape` — one of a small closed set of literal strings. Start with
  `"triad"`, `"seventh"`, `"sus"`, and a borrowed/out-of-key variant; pick
  the spelling and document it. An unknown string means the whole field is
  dropped, so the set must be a constant in one place.
- `voicing` — `"near"` (default, omitted when default) or `"root"`.
- Length rides the existing hold mechanism the note lanes use — read how
  `hold`/`basshold` work and follow it rather than inventing a parallel.

Write the field only where a page has chords (see how `docOut` already deletes
`tones`, `mirrors`, `echo` and `len` when they are absent or default).

## Voicing — what "near" means

The chord's actual pitches are **computed, never stored**: from `deg`, `shape`,
the page's key, and the pitches of the previous chord in the lane, choose the
arrangement with the smallest total movement from that previous chord. Common
tones must actually stay on the same pitch — that is the whole point, it is
what the lesson teaches, and it is what the player will hear.

`"root"` means the plain rooted arrangement instead, ignoring what came before.
The pair exists so the player can flip one chord between the two and hear the
difference. Keep the first chord of a lane rooted; there is nothing to be near.

Range C2–C6 as everywhere else. Voice count is 3 for a triad, 4 for a seventh,
2 for the dyad the thin end of the shape dial gives.

## The pad — AGREED WITH THE PLAYER, build exactly this

Do not redesign it, do not add to it, do not move anything to make room.

    CHORD LANE — the third stop on the bumper ring (L1/R1 tap, as today)

    writing      △ root up a scale step    ○ the same chord again
                 ✕ root down               □ rest
                 hold the button and the chord rings on
                 (the same growStart contract the note lanes use)

    shape, at write time — the triggers, mirroring how they already widen a
    move into a third or a fifth:
                 L2   the seventh
                 R2   sus, no third
                 both borrowed, out of the key

    editing the chord under the cursor, on the d-pad's PITCH pair:
                 bare          move its root a scale step
                 one trigger   thicker / thinner (dyad · triad · seventh)
                 both          the voicing: nearest ↔ rooted

    time — unchanged from the note lanes: the time pair strides, one trigger
    with ← and → moves the chord's start and end, both triggers carry it.

Which d-pad pair is "pitch" and which is "time" trades with the view exactly as
it does today — read `pollPads`, do not reimplement the rule.

The three-rung ladder (bare = move, one trigger = shape, both = voicing) is the
agreed idiom. The existing bumper comment in `entry.js` already anticipates a
third voice; make that true.

**Keyboard is derived from the pad, mechanically** — `KeyboardEvent.code`,
physical position, IT layout. Voice cycling already has a board binding: find
it and let the chord lane join the same ring. Derive the rest from the pad
seats above; do not invent a parallel keyboard grammar and do not leave the
lane keyboard-unreachable.

**The F1 key overlay must say all of this while the chord lane is in hand** —
see how `views.js` `keysNow()` already branches for the echo and the quiz.

## Drawing it

Both views must show the lane. Migraine rules bind: no grid or stripe
patterns, no extreme contrast, nothing blinks, calm motion only. A chord is one
object — draw it as one mark carrying its own ring/length, not as three
stacked note heads that read as a grid. In the roll, where height is pitch, the
computed pitches may be drawn, but the object must still read as one thing.

Sigil/parchment idiom, as everything here.

## Out of scope — do not build

Chord *names* anywhere in the UI or the copy. Inversion controls beyond the
near/root flip. A chord palette, picker, or menu. Anything that asks the player
to identify a chord. Progression templates. Bass auto-generation.

## Testing (binding — CLAUDE.md rule 6)

Total test LOC ≤ app LOC; check before you start and after you finish.

Run before and after: `node tests/tier1.js` (**green first and last, always,
no exceptions**), then `reltest.js`, `drilltest.js`, `statictest.js`,
`bootcheck.js`. Bootcheck has two known timing-flaky clusters — a clean re-run
after `rm -rf tests/prof-boot` is the check — and **one known pre-existing
failure**: `and L1 turns the crossbar back to the settings -> {"got":
"scriptorium","want":"settings"}`. Report it verbatim; never fix it, never
paper over it. Quote the literal "N passed, M failed" tail lines in your
report; never totals from memory.

Write new checks only for what must outlive rewrites:
- the data format — `chords` through save/load/`docOut`, absent when empty,
  a malformed field dropped whole with the rest of the page untouched;
- the voicing arithmetic — common tones actually held across a change, and
  `"root"` giving the plain arrangement;
- input semantics — each pad seat above producing the model change it should,
  including the three rungs of the pitch-pair ladder.

Never test layout, styling or copy. Delete checks this change obsoletes.

UI verification is real headless Chrome via `tests/cdp.js`: screenshot the
chord lane in both views and the F1 overlay over it, then **open and describe
the screenshots**. Inspection-only verification has shipped layout bugs here.

Note `folio.css` and `js/views.js` were reworked in `37b02e3` (main is
height-capped, `.field` flexes, the footer is always in view) — do not undo it.

## House rules

Zero dependency, plain `<script src>` globals in the order `folio.html` lists,
no modules, no bundler, no build step; `file://` must keep working. Update
`folio.html`'s MAP comment and `CLAUDE.md`'s architecture list if you add a
file. Commit in the style of recent history, ending with
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Never touch** `BUDGET.md`, `QUESTS.md`, `quests/quest-log.json`,
`quests/rulings.json`. The dev server on :4173 is the player's live instrument
with an open tab: never restart it, never PUT to it. Harnesses seed their own
data through `FOLIO_LOG` / `FOLIO_RULINGS` / `FOLIO_KITS` and start their own
server instances.
