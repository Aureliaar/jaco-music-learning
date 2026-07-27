# HUD Budget Ledger

Append-only. One line per tool-work session. $ = API-equivalent cost from
the statusline (delta from session start to session end), honor-system,
rounded up to $0.50.

**Balance: $42.00** (bootstrap $50 − $5 gamepad − $3 entry modes)

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
| 2026-07-28 | HUD | $TBD | | The roll: F2/R3 alternate view — time horizontal, pitch as height, colour by pitch class (fill in statusline delta) |
| 2026-07-28 | HUD | _fill from statusline_ | — | Removed entry modes after trial ("baggage"); marks convert to null on import |
