# Folio — a lesson-gated toy DAW (learning project)

The player is learning music composition (craft layer) through a toy DAW that
grows one primitive per lesson. The tool is the cage; the music is the
point. Read `CURRICULUM.md` (lessons + quest system), `QUESTS.md` (L1
board + rules), `BUDGET.md` (HUD budget ledger) before proposing anything.

## Running

- `folio.cmd` (or `node server.mjs`) → http://localhost:4173 — the synced
  instrument. `server.mjs` is zero-dependency Node.
- `http://localhost:4173/auditor.html` — blind lineup-listening page
  (Italian). NOTE: plays the lead voice only (pre-L2); optional now that
  evaluation is self-administered.
- Deploy: `npm run deploy` (build → Cloudflare Worker, assets-only).
  Live: https://folio.jacopo-sinigaglia.workers.dev (instrument, static
  read-only mode) and `/auditor.html`. The deployed quest-log is a
  snapshot — redeploy after new composing.
- `folio.html` opened via `file://` works offline, no sync.

## Architecture (all zero-dependency)

THE CODE IS THE SOURCE OF TRUTH: many sessions/agents have modified it;
always read it for current bindings — do not trust docs or memory for
keymaps. The F1 key page is DELETED (2026-08-01, "too rot prone"): the
truth about bindings is `js/entry.js`, and the living key help is the
contextual **key overlay** F1 raises — the crossbar's drawing of the
controls, laid over the folio (the hint strip it replaced is gone).

- `folio.html` — the markup and the list of scripts. It
  carries a MAP comment at the head saying what lives where. **Read the map
  and one file**, not everything.
- `folio.css` — every rule the page is drawn by.
- `js/*.js` — the instrument, split 2026-08-01, loaded in this order:
  `state.js` (the page as data, holds arithmetic, key/degrees, the
  validator, the autosave) · `views.js` (column, roll, scenery, renderers,
  the key overlay, `say()`) · `audio.js` (timbres, lookahead scheduler,
  transport) · `edit.js` (writing, length, contour, voices, key, tempo,
  loop, the pages) · `quests.js` (workspaces, drills, the log on disk and
  its sync, tabs, rails) · `entry.js` (keyboard by `e.code`, gamepad) ·
  `boot.js` (the order it happens in, once).
  **Plain `<script src>`, NOT ES modules** — file:// has no CORS for
  classic scripts, so `folio.html` opened straight off the disk still
  works offline with no server and no build step. Keep it that way. The
  files share one scope through ordinary globals; that is deliberate, not
  an accident to be "fixed" with a bundler or a namespace object.
- `server.mjs` — static serve (repo root + `js/` + `quest-backgrounds/`) +
  GET/PUT `/api/quest-log` (ETag, atomic writes, drill-preservation on
  stale PUTs). `FOLIO_LOG` moves the log file and nothing else — that is
  how the harnesses avoid the player's own log.
- `quests/quest-log.json` — all workspaces (v2 schema: free + per-quest
  patterns + `drills` array). The single file to READ to see the player's
  music. **No test may read or write it.**
- `auditor.html` — blind lineup listening; `?ids=a,b,c` picks entries.
- `tests/` — restructured 2026-08-01, pared 2026-08-01. `tier1.js` (247
  checks) is data integrity only: a page out and back, the quest log's v2
  schema, server.mjs driven for real, a boot onto an existing log. **It is
  always-green, no exceptions: run it first and last, every time.** Then
  `reltest.js` (688, the instrument's input semantics, including the
  multi-frame pad section that used to be leaptest.js — that file is gone),
  `bootcheck.js` (197, real-Chrome boot and layout: only what a browser can
  prove), `drilltest.js` (40, live drill delivery), `statictest.js` (44,
  the deploy artifact and the read-only copy). `rig.js` is the shared bench
  for the fake-DOM harnesses and loads the app from whatever `folio.html`
  actually names; `cdp.js` is the one CDP driver. Test LOC 4449 against
  4760 of app. Total test LOC is kept **at or under app LOC** — extend by
  deleting something first.

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
   layout. Gamepad (revised 2026-07-31): contour entry ONLY — the absolute
   trigger crossbar is deleted. Face buttons are the move (△ up, ✕ down,
   ○ again, □ rest); **triggers L2/R2 are the modifiers** (third, fifth,
   both = semitone out of key); **bumpers L1/R1 are the voice**, tapped.
   The base octave is no longer on the pad's shoulders: it is the settings
   crossbar's ←→, and page up/down. Start still raises the settings
   crossbar, which now overlays the folio instead of replacing it.
   Range C2–C6, MIDI 36–84.
4. **Migraine rules (revised):** only grid/stripe patterns and extreme
   contrast are forbidden. Texture/gradients fine. Nothing blinks; calm
   motion. Do not over-apply.
5. **Agent workflow that works:** one Opus agent per feature, prompt
   includes: read folio.html first as source of truth, migraine rules,
   e.code rule, the testing policy below, commit with Co-Authored-By,
   never commit BUDGET.md/QUESTS.md/quest-log.json unless told. Agents
   verify in real headless Chrome, not by inspection (a layout bug
   shipped when one didn't).
6. **Testing policy (2026-07-31, replaces "extend and keep all green"):**
   there is a **complexity budget: total test LOC ≤ app LOC** (folio.html
   + server.mjs), target ~0.5:1 after housekeeping. Agents RUN the fast
   harnesses (green-or-stop for failures they caused; pre-existing
   failures reported verbatim, never fixed, never papered over), WRITE
   new checks only for what must outlive rewrites — data formats
   (save/load, quest-log schema, sync/PUT) and input semantics (bindings
   → model changes); never layout/styling/copy. UI verification =
   real-Chrome screenshots opened and DESCRIBED (the only method that
   has caught layout bugs here). DELETE checks a change obsoletes.
   Reports must quote the literal "N passed, M failed" harness tail
   lines, never totals from memory. Rhythm: feature stages, then a
   periodic **housekeeping two-step** (refactor + test shrink) whenever
   the budget is breached or a lesson passes. Known debt: 7 reltest
   failures pin live quest-log contents — slated for deletion. Future
   idea, parked, skepticism on record (self-use tool, not a 10k-user
   app): 2-agent TDD split — one writes tests, one writes code, minimal
   cross-reading.
7. Windows console is cp932 — Python on quest-log.json needs
   `encoding='utf-8'` both directions.

## Where the project stands (2026-08-01)

L1 and L2 PASSED (records in CURRICULUM.md; keystone ruling: ostinato).
**L3.1 is live and its board is authored**: eight holds quests delivered
as drills with `lesson: 3` (long note, all ring, ring the seam, two
breaths, steal the beat, threes, daylight, apprentice's hand — copy in
QUESTS.md). The suspension, the honest drone and the pedal are parked
for 3.2 (deferral rule). Open L2 side content: pass the torch, Part II
reprises (audit in QUESTS.md; Call and Answer II credit pending the
player's ten-loop call). Economy: quest barter (rule 2); **balance 2
small features + 1 credit** — BUDGET.md. Evaluation is self-administered
(never plan around outside evaluators). Quest authoring rules:
QUEST-COPY.md — including the 2026-08-01 ruling: never specify the goal
in copy; constraints make discovery likely, never guaranteed; Teaches is
a terse name. L4 = harmony/chords, groove/samples/arrangement/endgame
L5–L8.

**Design rulings 2026-08-01 (do not re-litigate):**
- The F1 key page is DELETED (rot-prone). F1 raises the key overlay now,
  and its keydown is still swallowed whatever it does — unhandled, F1
  opens Chrome help, focus is lost, rAF stops, and the playhead and
  gamepad poll die with it.
- Tonic, mode and tempo have NO runtime controls, by design: the header
  shows `tempo · key` and nothing edits them. Tonic is fixed per
  workspace (chromaticism is the spice channel), tempo comes from the
  seed, mode from the contour. Binding ergonomics revisited at L4, not
  before.
- The meta line is tempo and key only.

**Queued builds, in order (briefs in `briefs/`, build serially):**
1. ~~`briefs/key-overlay.md`~~ — BUILT, unmerged, in worktree
   `E:\experiments\daw-overlay` (branch `key-overlay`), 1 feature credit:
   the strip is gone, F1 raises the overlay, top-right mark, and the
   crossbar-chip-overlap warranty rider is in it.
2. `briefs/duplicate-workspace.md` — duplicate/promote a workspace
   (quest → "II", free play → "To Be Named"); 1 small feature.
Player-gated, unscheduled: voice management anticipating 3 voices
(L3.2/L4 horizon — waits on the player's UX direction); the L7
structure-view idea (pattern placement + variation, noted 2026-08-01 —
build at L7, not before). Design against migraine rules;
sigil/parchment idiom.

Housekeeping done (needs no repeating): tests restructured twice —
tier-1 extracted; live-log reads gone (harnesses seed their own log via
`FOLIO_LOG`); leaptest folded into reltest; enumeration cut in favor of
contracts (2026-08-01 pare-down: app 4760, tests 4449 LOC, ratio
0.93:1 — the remaining app fat is prose comments, kept on purpose).
`folio.html` split into `folio.css` + `js/*.js` (see Architecture). Old
worktrees daw-l3 / daw-l3-holds / daw-l3-demo / daw-pare are merged and
removable; the :4179 and :4182 demo servers are STALE — the live
instrument is :4173 only.
