# Quest Copy — the style guide

How to write quest text for the Folio boards. Distilled from the L2
design mess (the latecomer failure, the chord-that-isnt removal, the
hocket rework — all 2026-07-31). Read this before authoring any board.
This is a reference card, not an essay; the rulings in `QUESTS.md` are
the case law.

## Voice and register

Matter-of-fact, second person, a little dry. No hype, no exclamation
marks in the bullets, no praise baked into the copy. The bullets are
law; the *Teaches:* line is the one place poetry is allowed. See the L1
board for the register — "Coverage disguised as melody" is the ceiling
for flourish inside a constraint.

**Never use absolute note names in copy aimed at the player** (permanent
rule). Relative language only:

- step positions + voice ("bass, step 9")
- relative motion with explicit units ("down one scale step")
- scale-degree / function words (home, leading tone, mediant)
- interval chip names (P5, m7, TT — the chips make these self-checking)

## Anatomy of a quest entry

1. **Title** — short, evocative, ⚔ sigil; lowercase in-app. The title
   may be a metaphor but must not mislead: "the latecomer" told the player
   nothing about prep/re-strike/resolve, and that vagueness was cited in
   the failure ruling.
2. **Constraints** — en-dash bullets, each one grid-checkable (format
   spec below).
3. ***Teaches:*** — italic line naming the concept, AFTER the
   constraints. The player derives concepts empirically and wants the name
   afterward. This line carries the poetry; it is not part of the rules.

## The constraint rule

**Quests are constraints, not goals** (player ruling, 2026-07-31).
Simple, prescriptive "do X / don't do X", checkable from the grid.
"Did you know you can make that happen? Make it happen!" needs an
in-person instructor and can't be scored — that's why The Chord That
Isn't was removed, not fixed.

The satisfiability test: **can the quest be found by constrained
noodling?** The noodle rule says aimless play inside the constraint IS
the quest. The Latecomer failed this — its device (prepare → re-strike
into clash → resolve down) required multi-event choreography across
both voices and procedural priors nothing had installed. Attempts kept
landing on adjacent consonant devices that sounded good, which the
quest then ruled wrong. **A drill that punishes the ear for liking
things is a badly built drill.**

Good (Oil and Water — a pure prohibition, chip-checkable):

> No perfect unisons or octaves between the voices on any coincident
> step (the interval chips make this self-checking: no P1, P8, P15
> anywhere).

Bad (The Latecomer — a device disguised as a constraint):

> At least two suspensions: on a step where one voice moves, the other
> re-strikes its OLD note so it now clashes — then steps down to make
> peace on the next sounding step.

"At least two" sounds countable, but the thing being counted is a
three-event choreography no one had taught. Counting a device is not
the same as constraining the grid.

**One constraint space per quest.** Hocket started as one quest hiding
three; it became hiccup / handoff / snap. If bullets pull toward
different skills, split the quest.

## Bullet format spec

- En-dash bullets ("- text"), separated by `\n`. Rendered via
  `textContent` under `white-space:pre-line` (`.qdtext` in the detail
  view, `.rail .rtext` in the side rails) — no markdown, no HTML.
- The rail is narrow: roughly 5–7 words per line. **One rail-line per
  bullet** (~5–6 words). If a bullet wraps, it's too long.
- **Logically separate constraints get separate bullets.** No run-on
  prose gluing two rules into one sentence.
- **Terseness must not create vagueness.** The hocket rework in one
  line: "never the same step" was ruled vague and became "the voices
  never share a step" — same length class, no ambiguity about what
  never shares what. Precision beats brevity beats completeness.

The house pattern (Hocket: the Hiccup, post-rework):

> - the voices never share a step
> - at most two silent steps
> - no voice twice in a row
> - both voices inside one octave

## The perception gate

Perceptual win-conditions are acceptable ONLY when the player's own ear is
the judge and the target is a feeling he already recognizes — the
ten-loop test is the only perception gate. "Stopping playback must feel
like an interruption" (Ouroboros) is fine: his ear, a feeling he knows.
Never "make a listener perceive Y" verified by someone else — that's a
lesson rubric's job, not a quest's.

## The deferral rule

A device that needs a missing primitive gets **deferred, not
goal-ified**. The Apprentice's Hand and the suspension both wait for
held notes. If honest scoring of a quest requires a tool that doesn't
exist yet, park it on a future board with a note saying why — do not
paper over the gap with wishful wording.

## Visuals

If quest delivery ever touches UI: no grid/stripe patterns, no extreme
contrast, nothing blinks. Texture and gradients are fine. (Migraine
rules — see `CLAUDE.md`.)

## Pre-flight checklist

Before a quest ships to a board or the rail:

- Can it be found by noodling, or does it demand an untaught device?
- Is every bullet checkable from the grid (or the interval chips)?
- One rail-line per bullet? One constraint per bullet?
- Any vague shorthand a terser draft smuggled in?
- Any absolute note names? (Rewrite in relative language.)
- Does the title mislead about what's being asked?
- Is the win condition the player's own ear, or someone else's perception?
- Is it one constraint space, or a bundle wanting a split?
- Does the concept name live in *Teaches:*, after the law?
