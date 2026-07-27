# HUD Budget Ledger

Append-only. One line per tool-work session. $ = API-equivalent cost from
the statusline (delta from session start to session end), honor-system,
rounded up to $0.50.

**Balance: $35.00** (bootstrap $50 − $5 gamepad − $3 entry modes − $2 removal − $5 audio unlock + loop + pad layout)

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
| 2026-07-28 | HUD | _pre 20.76, post pending_ | — | Quest tracker: in-app quest log, motif binding, objective display, quests/quest-log.json |
