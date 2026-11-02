# Reference tracks for the blocks — one loop, transformed per pass

Research note, 2026-10-09. Not a build brief: nothing here is agreed, priced
(BUDGET.md) or given a pad home (rule 3 — the pad layout is agreed with the
player before any brief is written). It answers one question: which
well-known tracks are substantially *one short loop + something done to it on
each repeat*, what those somethings are called, and which of them the blocks
can already say.

Blocks today (`js/blocks.js`): per block, per lane (0 lead, 1 bass, 2 chord
lane): `oct` (−3…3), `seat` (a rack instrument), `off` (tacet). Loop lengths
are the rungs 4/8/16/32/64 steps of a sixteenth. Writing range is C2–C6, but
a block's `oct` already moves heard pitches past it (only MIDI 0–127 bounds
them).

Confidence key used below: **verified** (a source says so), **likely**
(consistent with sources plus my own memory of the track), **unverified**
(memory only — check by ear before relying on it).

---

## 1. Toby Fox — *Megalovania* (Undertale, 2015)

Yes, it is the right first track — with one honest caveat at the end of this
section.

### The loop

- **One bar (16 steps), one lead voice, over a bass.** Hooktheory: D minor,
  120 BPM, 4/4 (verified). At 120 BPM a bar is two seconds.
- Shape, in relations: two quick *repeated* low notes; a leap up to the
  tonic high above; then a long fall — down a fourth, then a slide down by
  semitones (three notes, each a half-step lower), on down to the bottom of
  the figure; and finally three quick notes climbing back up, which act as a
  pickup into the next bar.
- Rhythm (likely): 1+1+2 | 3+2+2+2 | 1+1+1 steps — short-short-long, then a
  long-ish note and three even ones, then three short notes. The rhythm is
  identical in every bar.
- **Everything after the first two notes is fixed.** Only the two opening
  repeated notes change from bar to bar.

### The transformations

- **The two opening notes move; the rest of the riff does not.** Your
  recollection (D, C, B, B♭ per bar) is consistent with Hooktheory's
  progression for the intro, *i – VII – ♯vi – VI – VII* in D minor = roots
  D, C, B, B♭, C (verified as Roman numerals; the note-level transcription
  isn't on the free page). So: D D | C C | B B | B♭ B♭, with the **bass
  following the same roots**. The trailing *VII* suggests bar 4 splits —
  B♭ for its first half, C for its second, leading back to D (likely, not
  verified: check by ear).
- Standard words for what is happening:
  - a **descending bass line** under an **ostinato** riff (the riff is the
    fixed part; the roots step down beneath it). D–C–B–B♭ is the first four
    notes of the **descending chromatic tetrachord** (the *lament bass* is
    the same line continued to A); here it stops short and turns back.
  - the two opening notes double the bass line: a **partial transposition**
    of the riff — only those notes are transposed, by the same interval as
    the bass.
  - Note the B natural in bar 3: it is *not* in D natural minor. A diatonic
    move would give B♭ there and B♭ again in bar 4. The track's chromatic
    step is what makes bar 3 sting.
- The relation this creates: the high tonic stays put while the opening
  notes sink, so **the leap up gets wider every bar** — an octave, then a
  ninth, then wider. That widening is the tension; the return to D at bar 5
  is the release.
- Across the first minute (unverified — check by ear): the four-bar cycle
  repeats with **layering** (drums/bass in or out) and **octave doubling**
  / instrument change of the riff, before a different melody arrives. The
  new melody is new material — outside what modifiers can make.

### What blocks can say

| Transformation | Today? |
| --- | --- |
| Riff an octave up/down on a pass | yes — `oct` |
| Riff on a different instrument | yes — `seat` |
| Bass sits a pass out (layering) | yes — `off` |
| Bass root moves D→C→B→B♭ per pass | **no — needs transposition** |
| Only the two opening notes move | **no — needs marked notes** |

**The caveat.** Megalovania does not *need* a new modifier: written as a
64-step loop (four bars), it is fully expressible today. What the modifiers
buy is a 16-step loop with the changing part *visible as the only thing that
changes*. That is exactly the didactic point — the player sees and hears
that one bar does four bars' work — but it should be said plainly that it is
a clarity gain, not a capability gain.

### New modifiers it needs

**A. Transposition (chromatic), per lane per block — `tr`**
- Data: `lanes[v].tr` = integer semitones, e.g. −12…+12. `oct` is then
  simply `tr` in steps of 12; keep `oct` as written for old pages, or read
  it as sugar.
- Heard note: `midi + tr` (plus `12*oct`), kept within MIDI as `shiftNote`
  already does. Chord lane: added to each computed pitch, as `oct` is now.
- Card drawing: works unchanged — the shared pitch scale already shows a
  block standing higher or lower.

**B. Marked notes — a transposition that applies only to marked steps**
- Data on the loop (not the block): `marks: [{lane, steps:[0,1]}]` — steps
  of a lane whose notes are "the part that varies". Read strictly, dropped
  whole if malformed (house style).
- Data on the block: `lanes[v].mtr` (semitones) — applied only to notes
  starting on marked steps. Unmarked notes take `tr`/`oct` as normal; marked
  notes take `tr + mtr`. (Equivalently: `mtr` alone, unmarked notes
  untouched.)
- Alternative worth weighing: substitution (`sub: {step: pitch}`) instead of
  transposition. Rejected here because it writes *identities* into the
  block; a transposition keeps the block *relational* (rule 4) and lets the
  card say "same riff, opening notes two semitones lower".

### Recreation recipe (first ~30 s)

1. Page in D minor, tempo 120. Loop = **16 steps**.
2. Lead: the riff, as above, starting on D. Mark lead steps 0 and 1.
3. Bass: one long D (or D on the beats) for the whole bar.
4. Eight blocks:

| Block | lead | bass |
| --- | --- | --- |
| 1 | — | `off` |
| 2 | `mtr −2` | `off` |
| 3 | `mtr −3` | `off` |
| 4 | `mtr −4` | `off` |
| 5 | — | — |
| 6 | `mtr −2` | `tr −2` |
| 7 | `mtr −3` | `tr −3` |
| 8 | `mtr −4` | `tr −4` |

5. Optional third cycle: blocks 9–12 = 5–8 with lead `oct +1` or a new
   `seat` — the octave-doubled restatement.
6. If bar 4 turns out to split B♭→C, that is a **within-pass** change the
   per-block modifier can't express; either accept the simplification or
   go to a 32-step loop (two bars: the riff twice, second copy's last half
   marked separately). Worth an ear check before building anything.

### What to listen for

- Same or different: which part of the riff is *identical in all four
  passes*, and which part isn't? (Expect: almost all of it is the same.)
- Does pass 5 feel like *arriving back*? Compare block 4 → block 5 with
  block 1 → block 2. Is one of those joins a homecoming and the other a
  departure?
- Pass 3 against pass 4: the original has one note there that is out of
  the key. If your recreation puts B♭ in pass 3 instead of B, does pass 3
  lose its sting? (A/B it — it is a one-number change.)
- Leap width: does the jump to the top note feel more strained in later
  passes? That is an interval-size judgment, which EAR-NOTES suggests is
  readable even when direction isn't.

---

## 2. Nobuo Uematsu — *Prelude* (Final Fantasy series, 1987–)

The player's own reference (CURRICULUM L1), and the cleanest example in all
of game music of a loop carried through a chord progression.

### The loop

- **The arpeggio figure: four notes — 1, 2, 3, 5 of the chord (the "add2"
  shape) — stacked octave after octave going up, then back down.** FF1's
  intended figure is B♭–C–D–F (verified, Greengrove, quoting the LilyPond
  in his transcription). In later games it spans **four octaves** (verified:
  the NES could not play the lowest notes, so FF1 jumps instead of rising
  cleanly — Uematsu's own "wrong note").
- **Two bars per chord** (verified, search summary of the Weather Gage FF1
  analysis: "changing harmony every two bars"). Steady sixteenths: 16 notes
  up, 16 down = **32 steps**, one Folio loop rung exactly.
- Key: B♭ major in FF1, **C major from FFII onward** (verified, Dudley).
- One voice. Bass and strings are added later (FFIV onward).

### The transformations

- **Transposition through a progression** — the same figure, moved to each
  chord. FF1 (verified via Greengrove's transcription, in B♭): I – vi – I –
  vi – IV/6 – V/6 – ♭VI(maj7) – ♭VII(maj7). In C: **C – Am – C – Am –
  F/A – G/B – A♭ – B♭**, each two bars, then round again. First half is the
  **'50s progression** family (Dudley; I–vi–IV–V).
  - Bars 1–12 are **diatonic transposition**: C D E G moved along the scale
    becomes A B C E (Am), F G A C (F), G A B D (G) — the shape stays a
    1-2-3-5, and major/minor quality falls out of the scale by itself.
  - The last two chords are **borrowed chords** (♭VI, ♭VII, from the
    parallel minor — Hooktheory flags "borrowed chords", verified) and need
    **chromatic transposition**: A♭ B♭ C E♭ and B♭ C D F. Whether the
    figure keeps its 1-2-3-5 shape there or picks up the major seventh
    (the "maj7" in Greengrove's chart) I could not verify.
  - "/A" and "/B": the bass sits on the chord's third, not its root
    (**first inversion**) — i.e. the bass is transposed by a different
    amount from the arpeggio.
- **Layering / orchestration** (FFIV, verified, Dudley): "one round of the
  harp arpeggio, then on the repeat the orchestra makes its grand
  introduction" — basses on roots, cellos/violas on thirds and fifths, plus
  a woodwind melody (new material, outside the loop).
- **Change of mode** (FFVIII, *The Loser*, verified, Dudley): "on the
  repeat Uematsu changes the opening B♭ major to B♭ minor" — the same loop
  heard in the **parallel minor**. Whether every chord follows I couldn't
  verify.
- **Retrograde** (FFIX, *Crystal World*, verified, Dudley): "the arpeggio
  coming back down on the descent is played in reverse". (My reading: the
  descent is no longer the ascent's mirror image but its exact reversal in
  time; an ear check would settle it.)
- **Instrument change** (FFIX game-over: piano instead of harp, verified).

### What blocks can say

| Transformation | Today? |
| --- | --- |
| Orchestra joins on the repeat (layering) | yes — `off` on bass/chords for the first round |
| Harp → piano | yes — `seat` |
| Figure moved to each chord (I, vi, IV, V) | **no — needs diatonic transposition** |
| ♭VI, ♭VII | **no — needs chromatic transposition (`tr`, above)** |
| Bass on the third (inversion) | yes, *once* transposition exists per lane — bass and lead just take different amounts |
| Parallel minor on the repeat | **no — needs change of mode** |
| Reversed descent | **no — needs retrograde** (low priority) |

### New modifiers it needs

**C. Diatonic transposition, per lane per block — `deg`**
- Data: `lanes[v].deg` = integer scale steps, e.g. −7…+7.
- Heard note: `moveDegrees(midi, deg)` — the helper already in
  `state.js`. Out-of-key notes snap in the direction of travel (existing
  semantics); worth an ear check whether that or "keep the chromatic
  offset" sounds right.
- Chord lane: add `deg` to each cell's degree **before** voicing, so
  I-135 on a `deg −2` block *is* vi-135 — minor by itself, and the near
  voicing still leads from cell to cell. (This is the natural fit with the
  chord lane's existing "degree + shape, never a name" model.)
- Composition with the others: `deg` first, then `tr`, then `oct`.

**D. Change of mode — `mode: "minor"`** (per block, probably whole-block
rather than per lane)
- Heard note: read each note's degree in the page's key, re-sound the same
  degree in the parallel mode (same tonic). Notes out of the key keep their
  offset from the nearest degree below.
- Chord lane: the same degrees, voiced in the parallel mode.
- Lower priority — one track uses it, though it is a famous and
  very audible move.

**E. Retrograde — `retro: true`** (per lane)
- Heard note: a note starting at step `i` with written length `len` sounds
  at step `loop − i − len` with the same length. Holds survive; a note
  ringing across the seam is cut at the seam first (as the card already
  does).
- A variant for *Crystal World* specifically ("reverse the second half
  only") would need a range; not worth it until a second track wants it.

### Recreation recipe (FFIV-style, first ~40–60 s)

1. Page in C major, tempo ~100 (Hooktheory's value; versions differ). Loop
   = **32 steps**, page length 32.
2. Lead: C D E G four times rising from C2 (16 steps, C2→G5), then C6 G5
   E5 D5, C5 G4 E4 D4, C4 G3 E3 D3, C3 G2 E2 D2 (16 steps falling). Exactly
   fills the C2–C6 range.
3. Bass: one long C for the whole loop. Chord lane: I-135, one cell held
   the whole loop.
4. Sixteen blocks — the progression twice:

| Block | all lanes | bass extra | bass/chords |
| --- | --- | --- | --- |
| 1 | — | | `off` |
| 2 | `deg −2` (Am) | | `off` |
| 3 | — | | `off` |
| 4 | `deg −2` | | `off` |
| 5 | `deg +3` (F) | bass `deg +5` (A under F) | `off` |
| 6 | `deg +4` (G) | bass `deg +6` (B under G) | `off` |
| 7 | `tr −4` (A♭) | | `off` |
| 8 | `tr −2` (B♭) | | `off` |
| 9–16 | as 1–8 | as 1–8 | **on** — the orchestra enters |

   (Upward moves may push the top of the arpeggio past C6; the original
   moves several of them *down* instead. Trade with `oct −1` by ear.)
5. FFVIII variant: blocks 9–16 with `mode: minor` instead.
6. Dropped: the woodwind melody (new material), FF1's octave-jump quirk.

### What to listen for

- Block 1 vs block 2: same shape, different colour? Is it the same figure
  to you, or does it feel like a new one? (Recognition of a transposed
  shape as *the same* is a doctrine question — log the answer in
  EAR-NOTES either way.)
- Blocks 7–8 against 5–6: does the ground shift under you — the borrowed
  chords stepping outside the territory the first six claimed? Compare
  your recreation with the original at that seam specifically.
- Block 8 → block 9: does C feel like home after B♭? Is it a stronger or
  weaker homecoming than block 2 → block 3?
- Bass on the third (blocks 5–6) vs bass on the root: A/B one block. Does
  one feel more *settled*, the other more *in motion*?
- Major vs minor repeat (if built): same loop, different weather — which
  passes feel like the same place?

---

## 3. Daft Punk — *Around the World* (1997)

> **Rejected by the player (2026-10-09).** They don't know the track, it has
> no trustworthy transcription to work from, and as a "control case" (a track
> the blocks already cover) it teaches nothing new. Kept here only as a record.
> A reference must be a track the player knows, with a good MIDI or tab
> transcription available.

Chosen as the **control case**: a famous track that is almost pure
**additive arrangement** — layers entering and leaving over unchanging
loops — so it tests whether today's blocks, with no new modifier, already
make a piece. Not game music and not one of the player's listed references;
see "Why not Chicane" below.

### The loop

- E minor, 121.3 BPM (verified, Wikipedia). Gondry, who directed the video:
  "Only five different instruments, with very few patterns, each to create
  numerous possibilities of figures" (verified). The video gives each
  instrument a troupe of dancers; the bass guitar is the tall athletes
  walking *up and down stairs* (verified) — the bass line climbs and falls
  by step, in the manner of Chic's *Good Times* (verified: Gondry's
  comparison).
- The vocoded vocal, a short three-syllable-ish phrase on the title,
  repeated **144 times** in the album version (verified). Colin Morris's
  compression study ranked it the most repetitive of 15,000 Hot 100 hits
  (verified).
- Five layers: vocal, bass, high keyboard, guitar, drum machine
  (verified, the video mapping). Lengths of the individual patterns: one
  or two bars each (likely — check by ear).

### The transformations

- **Layering** — layers enter and drop out on pass boundaries ("additive /
  subtractive arrangement"). This is the whole track's form.
- **Breakdown** — the drums drop out for a stretch (likely).
- **Filtering** (likely — opening/closing a low-pass filter on loops):
  production, not composition. Out of scope for blocks; noted only because
  the ear will hear it as a big difference.
- Whether the vocal phrase is ever **sung at another pitch** across
  repeats I could not verify.

### What blocks can say

Almost everything compositional, today: `off` (layering), `seat` (the
keyboard vs guitar timbre), `oct`. **What's missing is not a modifier but a
lane**: Folio has no drums (that is the samples lesson, L7) and only three
lanes for five layers. Filtering is a production move with no place in the
model.

### Recreation recipe (first ~60 s, with the order found *by ear*)

1. Page in E minor, tempo 121. Loop = **32 steps** (two bars).
2. Bass: a stepwise climb and fall — the "stairs". Chord lane: a short
   repeated keyboard stab figure. Lead: the vocal phrase as a monophonic
   line, repeated to fill the loop.
3. Sixteen blocks (≈ 32 s at two bars each; 32 blocks ≈ 64 s).
4. **Don't copy an entry order from this file** — I couldn't verify one.
   Instead, listen to the first minute and, for each two-bar stretch, write
   down only *which layers are there*. Then set `off` on the blocks to
   match. That is a same-vs-different task the ear is good at, and it is
   the whole recreation.

### What to listen for

- Pass to pass: did something *arrive*, *leave*, or *nothing change*? Mark
  each seam with one of the three. Then compare your block strip to that
  list.
- Where does the original feel longest without change — and does your
  recreation feel equally long there, or longer (the missing drums carry a
  lot of the patience)?
- Does the vocal ever stop feeling like a phrase and start feeling like a
  texture? Roughly which pass? (Repetition changing how a fragment is
  heard is an ear finding worth logging.)

### Why not Chicane

*Offshore* (1996) is the obvious Chicane pick — it is built as a loop with
the beat dropping out into soft breaks (verified, a 1997 review quoted on
Wikipedia) and its synth hook is based on Don Henley's *The Boys of Summer*
(verified). But I found no source for its pattern lengths, progression or
section order, and I won't build a recipe on memory. If the player wants
the Chicane version, the *Around the World* method transfers exactly:
listen, mark each seam as arrive / leave / same, set the tacets.

---

## 3 (replacement). Nobuo Uematsu — *Those Who Fight Further* (FFVII boss battle, 1997)

Proposed by the player, 2026-10-09. MIDI: VGMusic lists 9+ fan sequences under
"Boss Battle – Still More Fighting" (PS1 section). Analysed:
`FF7StillMoreFighting.mid` (17 tracks, 167 BPM, 4/4), bar by bar on a 16th grid.
This is a single fan transcription, so check it against the recording.

What the bars show (bass = track "Electric Bass", melody = "Electric Piano 1"):
- **Intro, bars 1–7.** A two-bar bass call, then the same call **three semitones
  higher** (bar 1 E–G becomes bar 5 G–B♭; bar 2 G♯–A becomes bar 6 B–C).
- **Bars 9–15.** A three-bar ostinato on A (two identical bars plus a variant),
  a chromatic run, then **the same three bars three semitones higher, on C**.
  This is block transposition exactly.
- **Bars 16–27.** A six-bar arpeggio passage (melody and bass), played **twice
  identically**: copy a block.
- **Bars 36–43.** A two-bar arpeggio figure, then the same figure **a whole step
  higher**: a sequence.
- **Bars 44–59.** A four-bar melodic phrase, then the same phrase **a fourth
  lower** (shape-identical bar for bar), then both again: a sequence by a
  fourth, alternating.
- **Bars 28–35.** A one-bar bass riff under a held texture, with a two-bar
  variant: ostinato.

Why it fits: almost every section is "state a figure, then state it again
transposed". The intervals are a minor third, a whole step and a fourth, and
several are chromatic, so the semitone `tr` modifier covers all of them. It
needs no drum lane to be recognisable (the bass ostinato carries it), and the
player knows it. It's a better third reference than *Around the World* on
every count.

## The minimal new modifier set, ranked by what each unlocks

1. **Transposition per lane per block** — diatonic (`deg`) and chromatic
   (`tr`) as two units of one modifier. This is the big one: it turns a
   one-chord loop into a progression (Prelude's I–vi–IV–V; any "the loop
   walks through the chords" piece), handles inversions for free (lanes
   take different amounts), carries Megalovania's bass, and makes `oct` a
   special case. Diatonic is the curriculum-native unit (the chord lane
   already thinks in degrees); chromatic is needed for borrowed chords and
   Megalovania's B natural. If only one can be built first: **`deg`**,
   with the chord lane shifting cell degrees before voicing.
2. **Marked notes** (a step set on the loop + a transposition on the block
   that applies only to it) — Megalovania, and every riff where "the
   first note changes, the rest is fixed". Depends on 1. Its value is
   clarity over a long loop, not new capability.
3. **Change of mode** (parallel minor/major per block) — Prelude in FFVIII;
   a large, very audible move for little arithmetic.
4. **Retrograde** per lane — Crystal World only; cheap to compute, low
   demand. Hold until a second track wants it.

Around the World needs none of them — useful evidence that the existing
three already cover additive arrangement, and that the next real gap for
that genre is a drum lane, not a modifier.

Not proposed: a pad layout for any of these (rule 3 — agreed with the
player first), prices (BUDGET.md), or quest copy.

---

## Sources

- Hooktheory — *Megalovania*: https://www.hooktheory.com/theorytab/view/toby-fox/megalovania
- Hooktheory — *Final Fantasy – Prelude*: https://www.hooktheory.com/theorytab/view/nobuo-uematsu/final-fantasy---prelude
- Sam Dudley, "Evolution of a Theme: Final Fantasy's Prelude", The Sound Architect: https://www.thesoundarchitect.co.uk/evolution-theme-final-fantasys-prelude/
- A. J. Greengrove, "The 'Wrong-Note' Prelude of Final Fantasy I": https://www.ajgreengrove.com/posts/2025/08-30-prelude-nes-ver-final-fantasy-i/
- Weather Gage Workshop, "The Music of Final Fantasy (An Analysis)" (seen via search summary only; site unreachable): https://www.weathergageworkshop.com/articles/2017/2/5/analysis-of-ffi-music-4S8Yn
- Wikipedia — *Around the World* (Daft Punk song): https://en.wikipedia.org/wiki/Around_the_World_(Daft_Punk_song)
- Wikipedia — *Offshore* (song): https://en.wikipedia.org/wiki/Offshore_(song)
