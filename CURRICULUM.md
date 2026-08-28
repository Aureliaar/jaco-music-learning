# The DAW Curriculum

Craft-layer music education via a toy DAW that grows one primitive at a time.
The tool is the cage; the music is the point. Physics and theory layers are
assumed absorbed by osmosis and are invoked only when a lesson needs them,
never front-loaded.

## Ground rules

1. **Music gates tooling.** Lesson N+1's toolset gets built only after Lesson
   N's deliverable passes. No exceptions, including "but it would be easy to
   add."
2. **Quests are the currency for tool work** (economy revised 2026-07-31,
   see `BUDGET.md`): 2 completed quests = 1 small feature; bigger features
   cost proportionally more, judged honestly; a lesson pass grants 1 feature
   of any size. Free and unlimited: bug fixes/warranty, feedback on the
   music, theory, drills, transcription help, infra. The economy throttles
   *tool-building*, not learning.
3. **Deliverables are finished, not perfect.** "A minimal piece I don't hate"
   means: you would voluntarily listen to it once more, a week later.
4. **Evaluation is self-administered** (revised 2026-07-31; the family-verdict
   system is scrapped as a planning mechanism). Standing gates for every
   deliverable: the *ten-loop test* (played ten times consecutively without
   reaching for stop) and the *week-later test* (rule 3). Each lesson lists
   additional self-tests; where a test names something checkable from the
   grid, the assistant audits it. Outside ears are optional garnish,
   recruited ad hoc if ever — never load-bearing, never scheduled.
5. **QWERTY-native always.** Every feature must be fully operable without a
   mouse before it counts as shipped.
6. **Introduce alone — the pare-down rule** (adopted at L3, running method
   from here on): when a lesson adds a new primitive, other complexity is
   temporarily stripped. Phase **N.1** = the new primitive over basics only
   (usually one voice); phase **N.2** = reintegrate the full prior toolset.
   Same trick as introducing a line alone in a mix, applied to learning.

## The quest system (adopted during L1, permanent)

Alongside each lesson's deliverable, a **quest board** of constraint-études —
each quest is one forced decision, played inside the current toolset, seeded
with a key and tempo per quest. Rules live in `QUESTS.md`; authoring rules in
`QUEST-COPY.md` (constraints not goals; grid-checkable; one rail-line per
bullet). The board is authored when the lesson unlocks; sketches below are
direction, not contract. The noodle rule stands: aimless play inside the
constraint IS the quest. Drills (assistant-delivered études) are free
teaching aids — they install a concept, quests train it.

---

## Lesson 0 — Bootstrap (no music yet) — DONE

**Toolset built:** the minimal core. One monophonic voice, 16-step grid, one
pattern, fixed tempo, fixed velocity, QWERTY note entry, space = play/stop,
save/load. Browser-based (Web Audio).

---

## Lesson 1 — Monophony: phrasing — PASSED 2026-07-29

**Toolset:** Lesson 0 core only. One voice. No chords, no second track, no
velocity, no swing.

**Craft focus:** phrasing. Where a line breathes, where it peaks, what makes
eight notes a *sentence* instead of a sequence. Repetition vs. variation.

**References:** Uematsu — *Prelude*; *Terra's Theme* (melody alone; notice
where it rests); *To Zanarkand* (right hand only; uneven phrase lengths).

**Deliverable:** one original monophonic loop that survives the ten-loop
test. (Historical rubric: hum test, sentence test, ten-loop test.)

---

## Lesson 2 — Two voices: bass and counterpoint — PASSED 2026-07-31

**Toolset:** a second monophonic track (own waveform, bass-shaped). Still no
velocity, no chords-as-object, no swing, no held notes.

**Craft focus:** the bass is not the melody's shadow. Contrary and oblique
motion, call-and-response, ostinato under a moving line. Implied harmony:
two voices are enough to make the ear hear chords that aren't there.

**References:** Uematsu — *The Decisive Battle* (bass ostinato under a free
melody); *Battle Theme* (FFIV — the bassline is a character, not a floor).
Chicane — *Offshore* (a two-voice piece wearing a production costume).

**Deliverable:** one original two-voice loop where the bass line, soloed, is
independently interesting.

**Self-tests (plus the standing gates):**
- *Solo test:* each voice played alone stands up as a line.
- *Implied-harmony test:* you can hear a progression happening — the
  vertical implies chords nobody is playing.
- *Motion test:* at least one moment of contrary motion or genuine
  call-and-response, not parallel shadowing throughout. (Grid-checkable;
  assistant audits on request.)

**Quest board:** see `QUESTS.md` (shadow, ostinato, torch, drone, three
hockets, oil and water; latecomer failed by design, chord-that-isnt
removed — both rulings recorded there).

**Pass record (2026-07-31):** deliverable = *L2 Candidate I* (C major,
112 — contrappunto wedge opening, bare-tritone implied G7, stray D♯,
bass with its own V–i cadence; grid audits: motion ✓, implied harmony ✓,
zero perfect intervals). Week-later test waived by honest player ruling
(material a day old; the calendar is not the point). Keystone ruling:
⚔ ostinato is the keystone track of L2; Candidate II and the shadow are
#2/#3. The stated learning: letting go of "every line must be good
alone" — skill is hearing whether a part does the job the whole needs,
even where that runs counter to the letter of the passing grade.

---

## Interlude — The Scriptorium (repeatable)

*Available any time after Lesson 2 passes. Each pass produces one kit.*

A curation lesson. The SNES sound was a compression aesthetic — real
instruments truncated, loop-spliced, crammed into 64KB of sample RAM.
Curating a kit under that constraint *reproduces the cause* of the sound.
Ear training disguised as librarianship.

**Toolset (first pass only):** a minimal sampled voice — one track type
playing a single WAV per note, pitched via playback rate, from the active
kit. Full sampler arrives with the samples lesson.

**Per pass:** pick one target texture; source recordings (provenance out of
scope); truncate/downsample/loop-splice into a **64KB budget** (honor
system until tool-enforced); one manifest line per sample in
`kits/<name>/manifest.md`.

**Self-test:** play your kit next to the reference console texture. Too
clean, too long, too hi-fi = fail — too *good* is the characteristic
failure mode. Budget check: 64KB, no exceptions.

---

## Lesson 3 — Duration: the held note — PASSED 2026-08-09

**Toolset:** notes can sustain past one step (variable note length). That's
the entire unlock. Entry/edit UX designed at build time, QWERTY-native.

**Phases (pare-down rule, first application):**
- **3.1 — holds alone:** ONE voice. The L1 cage plus duration, nothing
  else. Re-learn phrasing where sound can ring.
- **3.2 — holds with two voices:** the L2 toolset returns. Suspensions
  become honest; sustained notes against moving ones.

**Craft focus:** the difference between a rest, a breath, and a hold. Note
*endings* as decisions — release is an event, not an absence. Tension by
sustain (a note that won't quit is withholding in another channel). Legato
phrase arcs. The seam when something rings across it. In 3.2: oblique
motion with actual sustain (the drone quest, now honest), and the
suspension — prepare, hold into the clash, resolve down — finally hearable
as you do it.

**References:** Uematsu — *To Zanarkand* (right hand — the held-note melody
that was explicitly out of reach in L1); *Terra's Theme* (melody: where
holds do the breathing rests used to do); *Aerith's Theme* (melody line
only — sustain as emotional load-bearing). Toby Fox — *Undertale* (the
title track: a held-note melody carrying a whole scene by itself); *Home*
(holds and releases as the entire affect — player-added reference,
2026-08-01).

**Deliverables:**
- **3.1:** one original one-voice loop whose phrasing depends on holds —
  self-test: the *cut test* — the same loop with every hold chopped back to
  a 16th must be audibly worse. Plus standing gates.
- **3.2:** one original two-voice loop containing at least one deliberate
  suspension (held into the clash, resolved by step — grid-checkable,
  assistant audits). Plus standing gates.

**Quest board (sketch — authored at unlock, per QUEST-COPY.md):**
⚔ *The Long Note* — exactly one note of four-plus steps. ⚔ *All Ring* —
no rests at all; only holds may breathe. ⚔ *The Suspension* (3.2, the
latecomer's rematch with real scaffolding). ⚔ *The Apprentice's Hand*
(3.1, returns from L1 — transcription with the recording playing, now that
holds make it honest — **deferred again 2026-08-04 to Lesson 4, whose
capstone it now is; the 3.1 pass does not wait on it**). ⚔ *Ring the
Seam* — one note sounds across the loop point.

**On pass (3.2 complete):** 1 feature of any size.

**Pass record (2026-08-09):** deliverable = *The Return* (F major, 92,
32 steps — a 3.3 board page, seeded with nothing but key and tempo).
Grid audit ran the instrument's own span math over every two-voice page
and found not one suspension but a **chain of two**, in the bass: D4
prepared as a third under the lead's F, held into the lead's move to G
(a fourth against the bass — the clash), resolved down by step to C4
(a fifth); that C immediately preparing the next — held under the
lead's move to F, resolved down to B♭3. Each resolution is the next
preparation. Audit convention on record: the fourth-against-the-bass
read as dissonant (common practice); it is the hinge both clashes turn
on. Corroborating: *the elder's heir* carries one more fully
player-written suspension in its free half (A#2 held under the lead's
move to C3, resolved to A2). **Deliberateness ruled by the player**:
the figure was written by ear before it was named — the player called
the chain "the keystone of the piece" on hearing it explained, on one
of his favourite pages. Recognition before names; the creed held. The
stated learning, in the player's own frame: a suspension is not merely
voices moving at different times (oblique motion — the elder's line
has that without one) but the three-legged event — consonant arrival,
clash created by the *other* voice's move, resolution down by step.
Consonance identification beyond "3/5/8 good, TT beware" is noted as
an open gap, deferred to L5 by player ruling. Hand-me-down stays open
as side content; the board missed the suspension, the free writing
didn't. Pass grants the any-size feature (BUDGET.md).

---

## Lesson 4 — Transcription: the ear writes *(injected 2026-08-04)*

*Injected by player ruling after the apprentice's hand stalled twice.
Every lesson so far trains one direction only — self → instrument: write
under constraints, listen, judge, revise. Transcription runs the other
way — ear → instrument — and that is a separate skill (dictation) the
curriculum had presumed instead of taught. Standing ruling, effective
immediately: **no transcription quests on any board until this lesson is
done.** Slotting ruled as the new L4 (harmony and everything after slide
down one); the player reserved the option to slide it later still — if it
moves, renumber again, this note travels with it.*

**Toolset:** the echo — the folio plays a short *hidden* fragment and the
player answers it back on the grid; hit or miss is grid-checkable, so the
drill corrects without explaining. The first tooling in the curriculum
whose job is listening rather than writing. Built gradual, per the
pare-down instinct: contour before intervals, intervals before rhythm,
never all three at once until the end.

**Phases:**
- **4.1 — the echo alone:** answer what was played. Two notes, then
  three, then a phrase. Contour first (up, down, again — the instrument's
  native language since L1), then degrees within the seeded key, then
  rhythm tapped onto a single pitch. No recordings yet: the folio itself
  is the caller, so the answer is always checkable.
- **4.2 — the recording:** real music, by ear, at the grid. Short lines
  from pieces the player can already sing. Ends at the capstone: ⚔ *The
  Apprentice's Hand*, exactly as authored in `QUESTS.md` — transcribe 16
  steps of a Uematsu line, change four steps until it is yours.

**Craft focus:** audiation — holding a line in the head long enough to
find it with the hands. The discovery that singing along is already
transcription's first half; that contour narrows a note to two or three
candidates before the ear has to decide anything; that rhythm and pitch
are separable problems pretending to be one.

**References:** the *Saria's Song* trick — a game teaching melodies by
echo-play is this exact tooling wearing a costume, and it worked on
children by the million. Uematsu — any melody the player can hum
end-to-end (that hum is the source material; the lesson is writing down
what is already known). *To Zanarkand*, right hand — the transcription
the player already wants, waiting at the finish line.

**Deliverable:** the apprentice's hand, passed — both versions kept,
played back to back. Self-test: the *cover test* — play the transcribed
half against the recording; where they differ, the ear must be able to
say which is which and why. Standing gates apply to the four-step
variation as a composition.

**Quest board (sketch — authored at unlock):** ⚔ *Echo Ladder* — the
fragment grows one note per rung; fall off, start over · ⚔ *Which Way* —
contour only, long fragments, no pitches asked · ⚔ *One Note Drum* — the
rhythm of a heard phrase, tapped onto a single pitch · ⚔ *The
Apprentice's Hand* (capstone, from L1 via L3 — third scheduling, this
time behind its prerequisite).

**On pass:** 1 feature of any size.

---

## Lesson 5 — Harmony: progressions and voice leading

**Toolset:** a chord-capable track (3–4 simultaneous notes). Biggest single
unlock in the curriculum.

**Phases** (re-sequenced 2026-08-28, player direction: triads and line
integration before any further shape): **5.1** — chord track + one
melodic voice only (the L2/L3 bass rests), **triads (135) only**;
progressions as loops, the four-chord engine and how to make it not
sound like one. **5.2** — full stack: chords + bass + melody, all prior
skills in one piece, still 135 only. **5.3** — the other shapes (145,
125, 1357), each met in isolation, only after two-voice writing over
triads is comfortable. The sus pair on the live 5.1 board
(lean-and-land, held-breath) is re-homed to 5.3; the-wheel needs no sus
and moves up to close 5.1.

**Craft focus:** voice leading by ear — smallest movement between chords,
common tones (notes that keep ringing through a change — L3 made this
audible), why inversions exist. The loop-specific skill: a progression
that *cycles*, where bar 4 wants bar 1 back.

**References:** Uematsu — *Aerith's Theme* (progression under the melody;
the bass walks between chords); *Searching for Friends* (loop-native
progression that never fatigues). Chicane — *Sunstroke* / *Poppiholla*
(diatonic loops with suspensions and pedal tones doing the lifting).

**Deliverable (5.2):** one original loop — chords + bass + melody, 8+ bars,
cycling seamlessly.

**Self-tests:** *voice-leading test* — solo the chord track; any change
that jumps gratuitously gets rewritten (assistant audits movement per
change on request). *Cycle test* — stop the loop at the end: do you feel
the cut? Standing gates as ever.

**Quest board (sketch):** ⚔ *Two-Chord World* · ⚔ *Common Tone* — every
adjacent chord pair shares a note · ⚔ *Bassline First* — write the bass,
find the chords it implies · ⚔ *Nine Lives* seed: same progression,
recolored.

**On pass:** 1 feature of any size.

---

## Lesson 6 — Velocity and swing: groove

**Toolset:** per-note velocity (keyboard-entered accents), global swing,
per-track humanize.

**Craft focus:** grid vs. groove. Accent patterns; ghost notes; why uniform
velocity sounds like a doorbell. Swing as a spectrum.

**References:** Uematsu — *Vamo' alla Flamenco* (sequenced music that
grooves — the accent pattern, not the notes). Fox Capture Plan — anything
off *trinity* (the same figure hit five ways in eight bars). Any FFVI
battle track at low volume: which notes poke out — velocity doing
arrangement's job.

**Deliverable:** the Lesson 5 loop in two versions — dead (uniform) and
alive (velocity + swing), same notes. Self-test: a week later, blind-ish
shuffle; if you can't instantly tell which is which, the treatment did
nothing.

**Quest board (sketch):** ⚔ *Ghost Town* — same notes, three accent maps,
three pieces · ⚔ *The Whisper* — one barely-audible note that must still
matter · ⚔ *Drunk Grid* — swing extremes A/B'd until you can name your
taste.

**On pass:** 1 feature of any size.

---

## Lesson 7 — Samples: drums and SNES parity

**Toolset:** full sample playback (multi-sample kits, drum lanes), 8-voice
polyphony cap **enforced by the tool** (voices steal, SNES-style),
tool-enforced 64KB kit budget. Instruments come from Scriptorium kits — at
least one is a prerequisite.

**Craft focus:** drum programming (kick/snare/hat grammar); texture;
arranging *within* a hard voice budget — which forces every Uematsu trick
(drop the pad when the melody peaks; bass and kick share a register, so
they take turns).

**References:** Uematsu — *Terra's Theme* (full arrangement: count voices —
never more than 8; learn what he *leaves out*); *Dancing Mad* (maximalism
inside 8 voices). Chicane — *Saltwater* (how few drum elements actually
play at once).

**Deliverable:** one original loop at full SNES parity — drums, bass,
chords, melody — inside 8 voices.

**Self-tests:** *era test* — could it score a 16-bit RPG scene? Name the
scene. *Subtraction test* — mute any one element; if the loop collapses
entirely, everything was load-bearing melody. Standing gates.

**Quest board (sketch):** ⚔ *64K or Die* · ⚔ *The Thief* — voice-stealing
as an audible feature · ⚔ *Drop Out* — one lane silent each bar, rotating.

**On pass:** 1 feature of any size.

---

## Lesson 8 — Arrangement: patterns into pieces

**Toolset:** pattern chaining / song mode, per-pattern track mutes, one
macro control (filter or volume ramp) for builds.

**Craft focus:** the time dimension. Intro/build/peak/breakdown/outro;
making 6 minutes out of 8 bars via subtraction and addition; transitions
(the fill, the drop-out, the riser). Loops are sentences; this is the
paragraph. (The relentless textures parked during L2 — ostinato and the
relentless drone — cash in here as section devices.)

**References:** Chicane — *Offshore*, full length, with a pen: timestamp
every entrance and exit; the list *is* the lesson. *Saltwater* (the long
build as delayed gratification). Uematsu — *Kids Run Through the City
Corner* (even a 90-second cue has an arc).

**Deliverable:** one original piece, 2.5+ minutes, with a beginning, a
peak, and an ending (real or designed loop point — chosen, not defaulted).

**Self-tests:** sketch your intended energy curve before assembling; a week
later, listen and sketch what you *hear* — the two curves should agree. If
the heard curve is flat, fail.

**Quest board (sketch):** ⚔ *Subtraction* — start with everything; only
removal allowed · ⚔ *The Long Way Up* — ninety seconds of build, no early
peak · ⚔ *Transition Zoo* — the same two patterns joined three ways.

**On pass:** 1 feature of any size.

---

## Lesson 9 — Harmony endgame: the Fox Capture Plan tier

**Toolset:** your call — the graduation project; by now you know what your
workflow is missing.

**Craft focus:** extended harmony (7ths, 9ths, sus voicings) as *color*;
borrowed chords; rhythmic displacement of a progression; the piano-trio
texture translated to your sequenced world.

**References:** Fox Capture Plan — *trinity*: one track, transcribe the
progression (help is free), identify what makes it not-four-chords.
Uematsu — *You're Not Alone* (the bridge does things Lessons 1–8 didn't
teach; find them). Chicane — now listen for the sus chords you couldn't
name in Lesson 5.

**Deliverable:** one original piece, ≥ 2 minutes, using at least one
harmonic device from this lesson *on purpose*, in your own style — not
pastiche. The first deliverable meant to sound like **you**.

**Self-tests:** *device test* — name the device before playback, then
confirm on listening that it does work, not decoration. *Signature test* —
write one true sentence about what "your music" sounds like. If you can,
you have a style. Standing gates, forever.

**Quest board (sketch):** ⚔ *The Borrowed One* — one chord from the
parallel key, placed like a stray: inevitable · ⚔ *Nine Lives* — the same
progression recolored with extensions until it stops being four-chords ·
⚔ *Displacement* — harmony shifted a beat against melody; intentional
seasickness.

**On pass:** the economy retires. You've earned an unmetered tool — or the
right to graduate to a commercial DAW, which will now feel like cheat
codes for a game you already know.

---

## Appendix: rules of arbitration

- Self-evaluation disputes don't exist; be honest. Grid-checkable claims
  (constraints, motion, suspensions) the assistant audits from
  `quests/quest-log.json` on request.
- Re-attempts are immediate, infinite, and cost nothing but pride.
- Economy disputes: what counts as "bug fix" vs "new feature" — if the
  behavior was never demonstrated working, it's warranty. Ledger is
  append-only.
- If outside ears ever get recruited for a listen, that's a bonus data
  point, not a gate — nothing in this file waits on anyone else.
