# HUD Budget Ledger — RETIRED 2026-07-31

**The $ ledger is closed.** Tracking statusline deltas became a headache
that competed with composing. New economy, adopted 2026-07-31:

- **2 completed quests = 1 small feature.** A bigger feature costs
  proportionally more quests, judged honestly at request time. The
  temptation to smuggle big asks through small framing is part of the
  design — feel the pull, don't cheat it.
- Still FREE, as always: bug fixes and warranty (anything that never
  worked or shipped broken/mis-designed), music feedback, theory, drills,
  transcription help, infra chores.
- Lesson passes no longer grant $; a lesson pass grants **1 feature of
  any size** (the lesson's own tool build remains part of the curriculum,
  not billed against anything).
- Quest completion still means: constraint met + survived the ten-loop
  test. Honor system, as ever.

Transition settlement (final, player ruling 2026-07-31): the old $31
balance + all unscored agent-delta leftovers collapse into exactly one
funded feature and the books close. Bookings:
- ⚔ ostinato → the scenery feature (1:1 transition pricing)
- ⚔ the shadow → eighth-note auto-advance (1:1 transition pricing)
- old balance + unscored stuff → key-aware home lines in the roll
**Standing balance: 0. Transition fully settled.** Quest completions
from here on add at the 2-per-feature rate.

Post-transition ledger (quests earned → features spent):
| Date | Entry | Balance after |
|------|-------|---------------|
| 2026-07-31 | ⚔ oil and water closed (constraint verified: 9 coincident pairs, zero P1/P8/P15) | 1 quest credit |
| 2026-07-31 | ⚔ the drone closed (contour-density version, 10+ loops; one pitch verified) | 2 quest credits = 1 small feature funded |
| 2026-07-31 | ⚔ hocket: the hiccup closed (strict alternation verified from grid; seam-rest ruling recorded in QUESTS.md) | 3 quest credits = 1 small feature funded, +1 banked |
| 2026-07-31 | ⚔ hocket: the snap closed (A minor; octave-transfer weld at the climb; register gap 15 semitones after lead raised; 2 rests exactly) | 4 quest credits = 2 small features funded |
| 2026-07-31 | **Lesson 2 PASSED** — deliverable *L2 Candidate I* (audits in CURRICULUM.md); pass grants 1 feature of any size | 2 small features + 1 any-size feature banked |
| 2026-07-31 | ⚔ hocket: the handoff closed (G major; 3-3-3-3 grain, 4 rests under the amended letter — ruling in QUESTS.md; ten-loop passed) | 5 quest credits = 2 small features + 1 credit banked, + the any-size |
| 2026-08-01 | **Pre-L3 UX pass merged (decfaf3)** — items 1,2,3,4,5,6,7,9 as ONE feature of size, priced against the L2 any-size grant. Warranty (free): crossfade fix, meta-line diet, solo/mute indicator, Start-mode dead-air, F1 scroll, done marks. L3 holds toolset + housekeeping: curriculum/infra, free. | 2 small features + 1 credit banked |
| 2026-08-01 | **Key overlay merged** — hint strip deleted, F1 raises the crossbar-idiom key drawing; priced 1 credit (player ruling). Free alongside: meta line to tempo·key (warranty), crossbar-chip overlap (warranty), F1-page deletion + pare-down (housekeeping), L3.1 board + Scriptorium toolset (curriculum). | 2 small features banked |
| 2026-08-02 | **Basic Scriptorium merged (7a7005f)** — per-workspace tones (`doc.tones`), crossbar goes modal (L1/R1; scriptorium mode: ↑↓ lead, ←→ bass), 4 baked kits, F4 room demolished. Priced both banked smalls, spent together; demolition warranty. Free alongside: loop-seam crossfade, held-tone settle, piano retune → Salamander recut v1 and v2 (17 roots, denoised; 64KB budget waived by player ruling), zombie-Chrome test flake hunted. | **0 — tapped out** |
| 2026-08-04 | **⚔ the L3.1 holds board closed — all SEVEN** (long note · all ring · ring the seam · two breaths · steal the beat · threes · daylight). Constraints verified against the instrument's own span math (heard length = written, capped by the voice's next note, wrapped at the seam), not by eye; ten-loop test self-administered. Two breaths passed on the corrected page. Apprentice's hand is off this board (deferred to the transcription lesson), so seven IS the board. **Not** a lesson pass — L3.2 is still parked, so no any-size grant yet. | 7 quest credits = **3 small features + 1 credit banked** |
| 2026-08-04 | **Carry the note merged** — both triggers under the d-pad's *time* pair pick the note up and put it down a step over, written length carried, cursor riding along; `moveNote` in edit.js, `padMove` in entry.js, key overlay per view. Priced **1 small feature** (player spent it on request). The pitch pair keeps the chromatic hatch in both views, so nothing was displaced. | 2 small features + 1 credit |

The closed ledger below stands as history.

---

Append-only. One line per tool-work session. $ = API-equivalent cost from
the statusline (delta from session start to session end), honor-system,
rounded up to $0.50.

**Balance at retirement: $31.00** (bootstrap $50 − $67 spent + $28 quest rewards + $20 L1 grant; Apprentice's Hand deferred to L3)

Lesson 0 was ruled **free** (2026-07-27): the bootstrap was always meant to
be gratis, and subagent usage isn't visible in the statusline anyway.
Open problem for a future session: how to extract $-equivalent usage from
background agents so agent-built features can be metered. Until solved,
agent work is metered by the orchestrating session's statusline delta.

| Date | Lesson | $ spent | Balance | What was built |
|------|--------|---------|---------|----------------|
| 2026-07-27 | L0 | free | 50.00 | Folio v1: spec + build (ruled free, see above) |
| 2026-07-27 | HUD | 5.00 | 45.00 | Gamepad layer: FFXIV cross-hotbar note entry (first metered spend) |
| 2026-07-28 | HUD | 3.00 | 42.00 | Two-pass entry: note/rhythm/pitch modes, save format v1 |
| 2026-07-28 | HUD | 2.00 | 40.00 | Removed entry modes after trial ("baggage"); marks convert to null on import |
| 2026-07-28 | HUD | 5.00 | 35.00 | Audio unlock fix, 4/8/16 loop length (L / L3), pad relayout: L1/R1 octave, bare face buttons FFXIV-style, audition over playback |
| 2026-07-28 | HUD | 5.00 | 30.00 | Quest tracker: in-app quest log, motif binding, objective display, quests/quest-log.json |
| 2026-07-28 | HUD | 14.00 | 16.00 | The roll: F2/R3 alternate view — time horizontal, pitch as height, colour by pitch class; arrows/d-pad 4-way nav, right stick by beats; quest log rebound to F3/select |
| 2026-07-28 | HUD | 8.00 | 8.00 | Relative (contour) entry: scale-step face buttons, bumper leaps, key concept, F4/hold-Select toggle |
| 2026-07-28 | reward | +4.00 | 12.00 | Quest complete: ⚔ The Summit (honor system — bind UX failure ate the evidence; melody verified via roll screenshot) |
| 2026-07-28 | HUD | 7.00 | 5.00 | Quest workspaces: per-quest autosaved patterns, side rails, K-link disk sync, no bind step |
| 2026-07-28 | reward | +4.00 | 9.00 | Quest complete: ⚔ Three Stones (step-16 anacrusis; verified via roll screenshot) |
| 2026-07-28 | reward | +4.00 | 13.00 | Quest complete: ⚔ White Space (5 rests, none adjacent; palindromic arch; verified via roll screenshot) |
| 2026-07-28 | HUD | 6.00 | 7.00 | Tempo control (F1 page, live-safe), seeded per-quest keys/tempos (rite built then withdrawn mid-flight) |
| 2026-07-28 | HUD | 5.00 | 2.00 | Drill quests: assistant-deliverable études, live poll/merge delivery |
| 2026-07-29 | reward | +4.00 | 6.00 | Quest complete: ⚔ Call and Answer (rising Q / falling A, one-note pivot) |
| 2026-07-29 | reward | +4.00 | 10.00 | Quest complete: ⚔ Keep the Stray (E minor, two strays, chromatic descent) |
| 2026-07-29 | reward | +4.00 | 14.00 | Quest complete: ⚔ Ouroboros (D minor, chromatic crawl at the seam) |
| 2026-07-29 | reward | +4.00 | 18.00 | Quest complete: ⚔ The Ladder (all 7 of G major, hidden) |
| 2026-07-29 | HUD | 7.00 | 11.00 | Auditor page: blind lineup listening, IT translation, deploy |
| 2026-07-29 | grant | +20.00 | 31.00 | **Lesson 1 PASSED** — family verdict via the auditor lineup (grudging but real) |
