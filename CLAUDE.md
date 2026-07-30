# Folio — a lesson-gated toy DAW (learning project)

The player is learning music composition (craft layer) through a toy DAW that
grows one primitive per lesson. The tool is the cage; the music is the
point. Read `CURRICULUM.md` (lessons + quest system), `QUESTS.md` (L1
board + rules), `BUDGET.md` (HUD budget ledger) before proposing anything.

## Running

- `folio.cmd` (or `node server.mjs`) → http://localhost:4173 — the synced
  instrument. `server.mjs` is zero-dependency Node.
- `http://localhost:4173/auditor.html` — blind family-evaluation page
  (Italian).
- Deploy: `npm run deploy` (build → Cloudflare Worker, assets-only).
  Live: https://folio.jacopo-sinigaglia.workers.dev (instrument, static
  read-only mode) and `/auditor.html`. The deployed quest-log is a
  snapshot — redeploy after new composing.
- `folio.html` opened via `file://` works offline, no sync.

## Architecture (all zero-dependency)

- `folio.html` — the entire instrument, single file, inline CSS/JS. THE
  SOURCE OF TRUTH: many sessions/agents have modified it; always read the
  code (and its F1 key page) for current bindings — do not trust docs or
  memory for keymaps.
- `server.mjs` — static serve (repo root only) + GET/PUT `/api/quest-log`
  (ETag, atomic writes, drill-preservation on stale PUTs).
- `quests/quest-log.json` — all workspaces (v2 schema: free + per-quest
  patterns + `drills` array). The single file to READ to see the player's music.
- `auditor.html` — blind lineup listening; `?ids=a,b,c` picks entries.
- `tests/` — harnesses rescued from session scratchpads (reltest.js was
  ~833 checks; drilltest/statictest/bootcheck/leaptest drive headless
  Chrome via cdp.mjs). They assume scratchpad paths — expect to patch
  paths before running; treat as reference corpus, extend rather than
  rewrite.

## Critical rules learned the hard way

1. **The sync race:** the open tab autosaves (debounced PUT of full
   state) and CLOBBERS any on-disk edit to quest-log.json — except drill
   definitions, which server+client merge non-destructively. To deliver a
   drill: append to `drills` in the file; the app adopts it within ~10 s,
   no reload. To edit anything ELSE on disk: tell the player to reload the tab
   FIRST (server wins on boot). To REMOVE a drill: edit file, then tab
   reload (client re-donates known defs otherwise).
2. **Feature work is quest-metered** (BUDGET.md, revised 2026-07-31 —
   the $ ledger is retired): 2 completed quests = 1 small feature; bigger
   features cost proportionally more, judged honestly; a lesson pass
   grants 1 feature of any size. Bug fixes, warranty, music feedback,
   theory, drills: free. Never build features unprompted.
3. **Keyboard = physical position only** (`KeyboardEvent.code`) — IT
   layout. Gamepad: FFXIV crossbar (triggers) for absolute, contour mode
   (face buttons, bumper leaps) for relative. Range C2–C6, MIDI 36–84.
4. **Migraine rules (revised):** only grid/stripe patterns and extreme
   contrast are forbidden. Texture/gradients fine. Nothing blinks; calm
   motion. Do not over-apply.
5. **Agent workflow that works:** one Opus agent per feature, prompt
   includes: read folio.html first as source of truth, migraine rules,
   e.code rule, extend the newest test harness and keep ALL checks green,
   commit with Co-Authored-By, never commit BUDGET.md/QUESTS.md/
   quest-log.json unless told. Agents verify in real headless Chrome, not
   by inspection (a layout bug shipped when one didn't).
6. Windows console is cp932 — Python on quest-log.json needs
   `encoding='utf-8'` both directions.

## Where the project stands (2026-07-29)

Lesson 1 (monophony/phrasing) effectively complete: 7 of 8 quests done
(Apprentice's Hand deferred to L3 — transcription needs note durations).
Awaiting: family verdict via the auditor lineup (stray + 2 shuffled
decoys) → L1 pass → +$20 → build Lesson 2 (second voice). Balance $11.
Next tool build after L2 unlock: a second monophonic track (see
CURRICULUM.md L2 + its quest board sketch).
