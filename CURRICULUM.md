# The DAW Curriculum

Craft-layer music education via a toy DAW that grows one primitive at a time.
The tool is the cage; the music is the point. Physics and theory layers are
assumed absorbed by osmosis (family) and are invoked only when a lesson needs
them, never front-loaded.

## Ground rules

1. **Music gates tooling.** Lesson N+1's toolset gets built only after Lesson
   N's deliverable passes evaluation. No exceptions, including "but it would
   be easy to add."
2. **The HUD budget is the only currency for tool work.** See ledger rules
   below. Composition help, listening feedback, theory questions, and
   transcription help are free and unlimited — the budget throttles
   *tool-building*, not learning.
3. **Deliverables are finished, not perfect.** "A minimal piece I don't hate"
   means: you would voluntarily listen to it once more, a week later.
4. **Family evaluation is binding.** A lesson passes when the assigned
   evaluator says it passes against the rubric — not when you're tired of it.
   Evaluators judge the rubric only; "I'd have done it differently" is not a
   fail condition.
5. **QWERTY-native always.** Every feature must be fully operable without a
   mouse before it counts as shipped.

## HUD budget ledger

- **Unit: $ API-equivalent** (the statusline cost number). Wall-time is
  gameable by parallel agents; raw token counts are muddied by cache
  write/read asymmetry; the $ figure already weights all of that correctly
  and is visible at all times. Honor system, tracked in `BUDGET.md` (one
  line per session: date, lesson, $ spent, what was built). Record the
  statusline delta from session start to session end.
- **What counts against budget:** new features, UI/ergonomics changes,
  refactors, keybinding work, visualizations, "while you're in there" asks.
- **What's free:** bug fixes for shipped features (broken ≠ new), feedback on
  your music, theory/craft discussion, rubric arbitration.
- **Carryover:** unspent budget rolls forward. Overdraft: not allowed — if
  the tank is dry, you compose with what you have, which is the entire point.
- **Grants** are listed per lesson and unlock **on pass**, not on start.

Bootstrap grant (Lesson 0): **$50**. Typical per-lesson grant: $20–30. A
focused feature session runs roughly $10–20 of API-equivalent, so each grant
is 1–2 real sessions of tool work. Scarcity is a feature. (If the first few
ledger lines show these estimates are badly calibrated, rescale all
remaining grants once, by one agreed factor — not per-lesson haggling.)

---

## Lesson 0 — Bootstrap (no music yet)

**Toolset built:** the minimal core. One monophonic voice (single waveform),
16-step grid, one pattern, fixed tempo, fixed velocity, QWERTY note entry
(tracker-style: `Z`-row = octave 1, `Q`-row = octave 2), space = play/stop,
save/load. Browser-based (Web Audio).

**Goal:** the tool exists, boots in under a second, and you can enter and
play back a scale without touching the mouse.

**Budget:** $50 bootstrap grant. This is the only lesson where tool work
*is* the deliverable.

---

## Lesson 1 — Monophony: phrasing

**Toolset:** Lesson 0 core only. One voice. No chords, no second track, no
velocity, no swing. Pattern length may be extended to 32/64 steps (this is
the one freebie — melody needs room to breathe).

**Craft focus:** phrasing. Where a line breathes, where it peaks, what makes
eight notes a *sentence* instead of a sequence. Repetition vs. variation:
the AABA-shaped instinct.

**References:**
- Uematsu — *Prelude* (FF crystal theme): a monophonic arpeggio that has
  carried an entire franchise. Proof that one voice is enough.
- Uematsu — *Terra's Theme* (FFVI): the melody line alone, ignore the
  accompaniment. Notice where it rests.
- Uematsu — *To Zanarkand* (FFX): right hand only. Phrase lengths are uneven
  and it's better for it.
- Exercise before composing: transcribe one of the above (melody only) by
  ear into the tool. Transcription help is free.

**Deliverable:** one original monophonic loop, 16–64 steps, that survives ten
consecutive repetitions without you reaching for the stop button.

**Evaluation rubric (any one family member):**
- *Hum test:* after two listens, can they hum it back? (Memorability.)
- *Sentence test:* can they point to where the phrase "breathes"? If they
  can't find a single resting point, fail.
- *Ten-loop test:* played ten times in a row — do they ask you to stop it
  before it ends? Asking = fail.

**Grant on pass:** +$20.

---

## Lesson 2 — Two voices: bass and counterpoint

**Toolset:** a second monophonic track (independent pattern, own waveform —
give it something bass-shaped). Still no velocity, no chords-as-object, no
swing.

**Craft focus:** the bass is not the melody's shadow. Contrary and oblique
motion, call-and-response, ostinato under a moving line. Implied harmony:
two voices are enough to make the ear hear chords that aren't there.

**References:**
- Uematsu — *The Decisive Battle* (FFVI): bass ostinato doing relentless
  work under a free melody.
- Uematsu — *Battle Theme* (FFIV): the bassline is a character, not a floor.
- Chicane — *Offshore*: listen to just the bass + lead relationship in the
  main section; it's a two-voice piece wearing a production costume.

**Deliverable:** one original two-voice loop where the bass line, soloed, is
independently interesting.

**Evaluation rubric (a brother — electronic composition degree makes this
their home turf):**
- *Solo test:* each voice played alone must stand up as a line. A bass that
  only makes sense with the melody on top = fail.
- *Implied-harmony test:* evaluator names the chords they *hear*. If they
  hear a progression (any progression) from two monophonic lines, pass this
  criterion — you've made the ear do the harmonic work.
- *Motion test:* evaluator identifies at least one moment of contrary motion
  or genuine call-and-response, not parallel shadowing throughout.

**Grant on pass:** +$20.

---

## Interlude — The Scriptorium (repeatable)

*Available any time after Lesson 2 passes. May be taken as many times as
you like; each pass produces one kit.*

**What it is:** a curation lesson. The SNES sound was not a synth aesthetic
but a compression one — real instruments recorded, truncated, loop-spliced,
and crammed into 64KB of sample RAM. Curating a kit under that constraint
*reproduces the cause* of the sound instead of imitating the effect. This
is ear training disguised as librarianship.

**Toolset (first pass only):** a minimal sampled voice — one track type
that plays a single WAV per note, pitched via playback rate, chosen from
the active kit. Full sampler (multi-sample kits, drum lanes, voice
stealing) still arrives at Lesson 5.

**The work, per pass:**
1. Pick a target texture (e.g. "FFVI strings," "FFVII electric piano,"
   "Decisive Battle bass"). One texture per pass.
2. Source candidate recordings from anywhere — provenance is explicitly out
   of scope for this self-learning project; the archive you don't have to
   go digging in is the best archive.
3. Truncate, downsample, and loop-splice until the whole kit fits a
   **64KB budget** (hard cap, tool-enforced once L5 exists; honor system
   before that). The mangling is the craft: where you cut the sustain loop
   *is* the timbre.
4. Write one manifest line per sample in `kits/<name>/manifest.md`: source,
   root pitch, loop points, what you sacrificed to fit.

**Evaluation rubric (a brother, blind):**
- *Texture test:* your kit plays a passage next to the reference console
  texture it targets. Evaluator says whether the kit "belongs on the
  console." Close-but-wrong (too clean, too long, too hi-fi) = fail —
  too *good* is the characteristic failure mode here.
- *Budget check:* 64KB, no exceptions. An over-budget kit isn't a kit,
  it's a folder.

**Grant on pass:** +$10 per pass, capped at three granted passes (curation
is a rabbit hole; the cap is the rope).

---

## Lesson 3 — Polyphony: progressions and voice leading

**Toolset:** a chord-capable track (3–4 simultaneous notes), variable note
lengths (sustain beyond one step). This is the biggest single unlock in the
curriculum; expect it to eat the full grant.

**Craft focus:** progressions as loops — the four-chord engine and how to
make it not sound like one. Voice leading by ear: the smallest movement
between chords, common tones, why inversions exist. The loop-specific skill:
a progression that *cycles*, where bar 4 wants bar 1 back.

**References:**
- Uematsu — *Aerith's Theme* (FFVII): the progression under the melody, and
  how the bass walks between chords.
- Uematsu — *Searching for Friends* (FFVI): loop-native progression that
  never fatigues.
- Chicane — *Sunstroke* or *Poppiholla*: diatonic loops with suspensions and
  pedal tones doing the emotional lifting — the exact trick you'll want.

**Deliverable:** one original loop: chord track + bass + melody (all three
prior skills in one piece), 8+ bars, that cycles seamlessly.

**Evaluation rubric (father — this is the composition lesson, bring the
silver lion):**
- *Voice-leading test:* evaluator watches the chord track (or hears it
  soloed) and flags any chord change that "jumps" gratuitously. More than
  one flagged jump = fail.
- *Cycle test:* does the last bar create the want for the first bar? Play
  the loop stopping at the end — does the evaluator feel the cut?
- *Don't-hate test:* the standing criterion — would the evaluator let it
  play again unprompted?

**Grant on pass:** +$30.

---

## Lesson 4 — Velocity and swing: groove

**Toolset:** per-note velocity (entered/edited via keyboard, e.g. hold a
modifier + row for accent levels), global swing amount, per-track humanize
(small random timing/velocity offsets).

**Craft focus:** the difference between a grid and a groove. Accent
patterns; ghost notes; why the same notes at uniform velocity sound like a
doorbell. Swing as a spectrum, not a switch.

**References:**
- Uematsu — *Vamo' alla Flamenco* (FFIX): sequenced music that grooves;
  listen for the accent pattern, not the notes.
- Fox Capture Plan — *疾走する閃光* (or anything off *trinity*): piano-trio
  dynamics — the same figure hit five different ways in eight bars.
- Any FFVI battle track at low volume: notice which notes poke out. That's
  velocity doing arrangement's job.

**Deliverable:** take your Lesson 3 loop and produce two versions: dead
(uniform velocity) and alive (velocity + swing). The alive version must be
the same notes.

**Evaluation rubric (a brother):**
- *Blind A/B:* evaluator hears both versions unlabeled and must (a)
  correctly identify the treated one, (b) describe it with a word like
  "groove," "feel," "human," or equivalent. If they can't tell them apart,
  fail.
- *Accent-map test:* evaluator claps/taps the accent pattern back. If the
  accents are too uniform to find, fail.

**Grant on pass:** +$20.

---

## Lesson 5 — Samples: drums and SNES parity

**Toolset:** the full sample-playback track type (multi-sample kits, drum
lanes, pitch across the QWERTY rows), 8-voice total polyphony cap
**enforced by the tool** (voices steal, SNES-style), and tool-enforced 64KB
kit budget. Instruments come from your Scriptorium kits — by now you should
have at least one; if not, an Interlude pass is the prerequisite.

**Craft focus:** drum programming (kick/snare/hat grammar); texture — what a
sampled instrument does that a raw waveform can't; arranging *within* a hard
voice budget, which forces every Uematsu trick (drop the pad when the melody
peaks; the bass and kick share a register, so they take turns).

**References:**
- Uematsu — *Terra's Theme* (FFVI), full arrangement this time: count the
  simultaneous voices at any moment. It's never more than 8. Learn what he
  *leaves out* at each moment.
- Uematsu — *Dancing Mad* (FFVI): maximalism inside 8 voices.
- Chicane — *Saltwater*: percussion layering — how few drum elements are
  actually playing at once.

**Deliverable:** one original loop at full SNES parity — drums, bass, chords,
melody — inside 8 voices. This is the "real Uematsu-tier" checkpoint.

**Evaluation rubric (whole family, informal listening session):**
- *Era test:* does it sound like it could score a 16-bit RPG scene? Ask them
  to name the scene (menu? town? battle? overworld?). If they can name one,
  the idiom landed.
- *Subtraction test:* evaluator picks one element to mute; if the loop
  collapses entirely, arrangement is too fragile — everything was
  load-bearing melody. One element should be able to drop and leave a
  functioning groove.
- *Don't-hate test*, standing.

**Grant on pass:** +$30.

---

## Lesson 6 — Arrangement: patterns into pieces

**Toolset:** pattern chaining / song mode (sequence patterns into an
arrangement), per-pattern track mutes, and one macro control (e.g. a filter
or volume ramp) for builds.

**Craft focus:** the time dimension. Intro/build/peak/breakdown/outro; the
Chicane skill of making 6 minutes out of 8 bars via subtraction and
addition; transitions (the fill, the drop-out, the riser). Loops are
sentences; this is the paragraph.

**References:**
- Chicane — *Offshore*, full length, with a pen: timestamp every moment
  something enters or leaves. The resulting list *is* the lesson.
- Chicane — *Saltwater*: the long build as delayed gratification.
- Uematsu — *Kids Run Through the City Corner* (FFVII): small-scale
  arrangement — even a 90-second loop-based cue has an arc.

**Deliverable:** one original piece, 2.5+ minutes, built from your patterns,
with a beginning, a peak, and an ending (a real ending or a designed loop
point — your call, but chosen, not defaulted).

**Evaluation rubric (a brother, plus one civilian if available):**
- *Map test:* evaluator sketches the energy curve on paper while listening.
  If the curve is flat, fail. If their curve matches your intended one,
  distinction.
- *Peak test:* evaluator points to the peak. If they point somewhere you
  didn't intend, discuss; if they can't find one, fail.
- *Civilian test:* a non-musician listens to the whole thing without
  checking their phone. Wildly unfair metric. Use it anyway.

**Grant on pass:** +$30.

---

## Lesson 7 — Harmony endgame: the Fox Capture Plan tier

**Toolset:** your call — this is the graduation project, and by now you know
what your workflow is missing. Candidates: chord extensions display,
scale-highlighting in the note rows, audio export, a second macro. Spend the
accumulated carryover.

**Craft focus:** extended harmony (7ths, 9ths, sus voicings) as *color*, not
homework; borrowed chords; rhythmic displacement of a progression; the
piano-trio texture translated to your sequenced world.

**References:**
- Fox Capture Plan — *trinity* (album): pick one track, transcribe the
  progression (help is free), and identify what makes it not-four-chords.
- Uematsu — *You're Not Alone* (FFIX): his own extended-harmony peak;
  the bridge does things Lessons 1–6 didn't teach you. Find them.
- Chicane — anything, but now listen for the sus chords you couldn't name in
  Lesson 3.

**Deliverable:** one original piece, any length ≥ 2 minutes, that uses at
least one harmonic device from this lesson *on purpose*, in your own style —
not pastiche of the references. This is the first deliverable meant to sound
like **you**.

**Evaluation rubric (father, final boss):**
- *Device test:* you name the harmonic device you used, before playback. The
  evaluator confirms they heard it doing work (not decoration).
- *Signature test:* evaluator says one true sentence about what "your music"
  apparently sounds like. If they can — you have a style. Curriculum
  complete.
- *Don't-hate test*, standing, forever.

**Grant on pass:** the budget system retires. You've earned an unmetered
tool — or the right to graduate to a commercial DAW, which will now feel
like unlocking cheat codes for a game you already know how to play.

---

## Appendix: rules of arbitration

- Rubric disputes: the evaluator's reading wins. You may re-attempt a failed
  lesson immediately and infinitely; failing costs nothing but pride.
- If a family member wants to add a rubric criterion, they may — one per
  lesson, agreed before you start composing, not after.
- If two lessons in a row pass on the first attempt, the family is being too
  nice. Tell them the rubric says so. (This clause is the rubric saying so.)
- Budget disputes: what counts as "bug fix" vs "new feature" — if the
  behavior was never demonstrated working, it's a feature. Ledger is
  append-only.
