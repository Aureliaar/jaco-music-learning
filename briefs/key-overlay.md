# Queued feature brief — the key overlay (replaces the hint strip)

*Authored 2026-08-01 from player direction. QUEUED: do not build until the
pare-down branch has merged (it touches the same files: views, entry,
css, CLAUDE.md). Pricing judged at build time (likely 1 small feature —
the hint strip it replaces was item 6 of the UX pass and shipped working,
so this is a redesign, not warranty).*

## The ask

Delete the bottom hint strip (the centered interpunct lines: "z…m q…i
notes · △ ✕ ○ □ the shape · L2 R2 third, fifth · …"). Replace it with a
key-help **overlay shaped like the settings crossbar overlay**: controls
arranged by physical position, each as a label with its meaning beneath
it, grouped in clusters — not a run-on line of prose. Togglable from an
affordance in the **top-right corner**.

## Shape (the crossbar overlay is the reference)

- Clusters by physical group, mirroring the crossbar idiom:
  d-pad/arrows as a compass (↑ ↓ ← →, each with its action under it),
  face buttons (△ ✕ ○ □) as their own cluster, shoulders/triggers
  (L1 R1 L2 R2) named where they sit, keyboard-only commands (note keys,
  space, period, tab, F2, F3…) in their own group.
- Label over value/action, calm type, scrim/parchment idiom — exactly the
  register of the crossbar overlay. Migraine rules: no grids/stripes, no
  extreme contrast, nothing blinks; texture and gradients fine.
- **Contextual**: shows the bindings of the mode you are in (column,
  roll, quest log, crossbar), as the strip did. One overlay, its content
  swaps; no per-mode bespoke panels.
- Overlays the page like the crossbar does — the folio stays visible
  behind it. Toggling it must not steal note-entry keys while closed.

## Open points (settle with the player at build time, not before)

1. **Keyboard toggle.** QWERTY-native rule: the top-right corner
   affordance cannot be mouse-only. F1 is freed by the key-page deletion
   — default proposal is F1 toggles the overlay; confirm with the player.
2. **The status line.** The strip also carried transient/contextual
   status ("C♯4 at step 2 · F1 for the key") — likely where `say()`
   renders. The overlay does not replace that job. Decide: does status
   text survive somewhere minimal, or die with the strip? Ask.
3. Gamepad toggle: should some pad chord open it too? Ask.

## Constraints (house law — the brief-reader reads CLAUDE.md first)

- Read folio.html's MAP comment, then only the files named there.
- Classic scripts, shared globals, no modules, file:// must keep working.
- Bindings by KeyboardEvent.code (IT layout). Do not change any existing
  binding's behavior; the overlay only *describes* them.
- Tests: per CLAUDE.md rule 6 — this is UI; verify with real-Chrome
  screenshots opened and described. No new layout tests. Delete any strip
  checks a harness still carries.
- Never commit BUDGET.md, QUESTS.md, quests/quest-log.json.
