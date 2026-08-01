# Queued feature brief — duplicate / promote a workspace

*Authored 2026-08-01 from player direction. QUEUED behind the pare-down
merge (touches js/quests.js, which pare-down is rewriting). Priced as
1 small feature; judged honestly at build time.*

## The ask

A "duplicate" on the current workspace, everywhere:

- **On a quest workspace:** creates a new workspace named after the
  source with a numeral — "keep the stray" → "keep the stray II" (then
  III, IV… on further dups). Copy of the pattern; `done` starts false.
- **On free play:** creates a workspace named "To Be Named" (then
  "To Be Named II"…). Free play itself is left as it was — this is the
  promote/spin-off gesture, so the player can keep noodling in free play
  without overwriting what was just kept.

This replaces the by-hand spin-off ritual (l2-candidate-1/2,
ostinato-variant were all made by the assistant editing the log file).

## Mechanics (read js/quests.js first — this must fit its model)

- A workspace with no drill definition renders as a *ghost* (bare id, no
  text). So a duplicate must create BOTH: a drill definition (id, name,
  empty summary/teaches — or "duplicated from <source>" as the summary —
  plus `lesson` copied from the source's tab) AND the workspace holding
  the copied pattern. Client-created defs already travel out with every
  PUT, so sync is free.
- Id scheme: derive from the source id (`stray-ii`, `tbn`, `tbn-ii`…);
  collision = bump the numeral. Never shadow a built-in id.
- The duplicate lands on the same lesson tab as its source; free-play
  dups land on the drills tab.
- The title inside the pattern gets the new name too.

## Open points (settle with the player at build time)

1. The binding. Keyboard first (QWERTY-native), pad optional. Candidate:
   a command on the settings crossbar (it has room) — confirm.
2. Should a dup of a dup count its numerals from the root ("stray III",
   not "stray II II")? Proposed: yes, root + next numeral.

## House law

- Read folio.html's MAP comment; classic scripts, no modules, file://
  keeps working; e.code bindings; migraine rules.
- Tests: this is a data-format change (new defs/workspaces written into
  the v2 log) — per CLAUDE.md rule 6 it warrants real checks for the
  dup's data shape and sync round-trip, in tier1's style; UI verified by
  real-Chrome screenshots described, never layout tests.
- Never commit BUDGET.md, QUESTS.md, quests/quest-log.json.
