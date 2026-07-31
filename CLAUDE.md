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
always read it (and the F1 key page) for current bindings — do not trust
docs or memory for keymaps.

- `folio.html` — the markup, the F1 key page, and the list of scripts. It
  carries a MAP comment at the head saying what lives where. **Read the map
  and one file**, not everything.
- `folio.css` — every rule the page is drawn by.
- `js/*.js` — the instrument, split 2026-08-01, loaded in this order:
  `state.js` (the page as data, holds arithmetic, key/degrees, the
  validator, the autosave) · `views.js` (column, roll, scenery, renderers,
  hint strip, `say()`) · `audio.js` (timbres, lookahead scheduler,
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
- `tests/` — restructured 2026-08-01. `tier1.js` (247 checks) is data
  integrity only: a page out and back, the quest log's v2 schema,
  server.mjs driven for real, a boot onto an existing log. **It is
  always-green, no exceptions: run it first and last, every time.** Then
  `reltest.js` (759, the instrument's input semantics), `leaptest.js`
  (105, multi-frame pad leaps), `bootcheck.js` (255, real-Chrome boot,
  layout and data flows), `drilltest.js` (40, live drill delivery),
  `statictest.js` (44, the deploy artifact and the read-only copy).
  `rig.js` is the shared bench for the fake-DOM harnesses and loads the
  app from whatever `folio.html` actually names; `cdp.js` is the one CDP
  driver. Total test LOC is kept **at or under app LOC** — extend by
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

## Where the project stands (2026-07-31, evening)

L1 and L2 PASSED (L2 2026-07-31; deliverable *L2 Candidate I*, pass
record in CURRICULUM.md; keystone ruling: ostinato). Open L2 side
content: torch, hocket handoff, Part II reprises (audit in QUESTS.md —
only Call and Answer II currently meets its constraint, credit pending
ten-loop). Deliverable candidates + Ostinato Variant motif shelved as
drill-channel workspaces in the quest log. Economy: quest barter (see
rule 2); balance 2 small features + 1 any-size (L2 grant) — BUDGET.md.
**Evaluation is self-administered** (family-verdict system scrapped
2026-07-31 — never plan around outside evaluators). L3 = duration/holds
(3.1 one voice, 3.2 two voices — pare-down rule), L4 = harmony/chords,
groove/samples/arrangement/endgame L5–L8. Quest authoring rules:
QUEST-COPY.md. L3 quest board: to be authored at unlock.

**In flight:** the pre-L3 UX pass runs in worktree `E:\experiments\daw-l3`
(branch `l3-buildout`): stage 1 quest-board UX landed (f5a27be, demo on
:4179 from `E:\experiments\daw-l3-demo`), stage 2 gamepad/input running.
L3 holds runs in parallel in `E:\experiments\daw-l3-holds` (branch
`l3-holds`, based on f5a27be). Per-stage player approval gates each next
stage. Queued, in order: (a) stage-1 warranty batch — bg crossfade not
flash; tabs need a real tab affordance; gamepad drives the EXISTING left
rail, not a bespoke log UI ("less is more"), fix Start-mode gamepad
dead-air; verify built-in quest text; surface done state; (b) housekeeping
two-step after all in-flight agents land — refactor + test shrink to the
budget (extract a tier-1 data-integrity harness ~150-200 checks, weed
reltest of quest-log-content pins, move bootcheck/drilltest off the live
quest-log onto temp copies) AND split folio.html (~60k tokens
post-merge) into ~5 plain <script src> subsystem files + CSS — no ES
modules (file:// CORS), no build step; ORDER MATTERS: reconcile
l3-buildout+l3-holds monolith-to-monolith FIRST, split second.
**Player authorization 2026-08-01: reconciliation → housekeeping →
merge to main run WITHOUT per-step player checks** once the warranty
batch lands (harness gates still apply; live tab reloads on player's
own time); (c) stage 3 voice management (player gate).
Merge to main only after review; pricing judged at merge.

Backlog — pre-L3 UX pass (player's list, 2026-07-31; scope/pricing judged
at build time, some items warranty):
1. ~~Tabs for quests~~ — done, stage 1.
2. ~~Reorder / favorite system for quests~~ — done, stage 1.
3. ~~DELETE absolute mode on gamepad entirely~~ — done, stage 2.
4. ~~Easier voice switch~~ — done, stage 2: tab / shift+tab, and L1/R1.
5. ~~Rework L2/R2 usage~~ — done, stage 2. They were the absolute crossbar
   and nothing else; they are the leap modifiers now, and every shoulder is
   named in the hint strip.
6. ~~Key help more contextually visible~~ — done, stage 1 (hint strip).
7. ~~Don't hide the main folio during crossbar (Start) mode~~ — done,
   stage 2: the crossbar overlays the head of the page.
8. Better voice management — UX to be defined, must anticipate 3 voices
   (L3.2/L4 horizon). **Still open** — the one item of the punch list that
   is not built, and it waits on the player saying what they want.
9. ~~Per-quest backgrounds~~ — done: `quest-backgrounds/<id>.png`, probed
   per workspace, fetched and decoded before the ground changes, with the
   scrim treatment on the title, the footer and both margins.
Design against migraine rules; sigil/parchment idiom.

Housekeeping done 2026-08-01 (needs no repeating):
- Tests restructured: tier-1 extracted, the harnesses weeded of live-log
  reads, of what tier-1 owns, of what the real browser already measures,
  and of prose scans; `cdp.mjs` gone; test LOC 6269 → 5017 against 5027 of
  app.
- `folio.html` split into `folio.css` + `js/*.js` (see Architecture).
- The F1 key page scrolls (page up/down, home/end) — it was ~5900px in a
  905px window with no way to reach any of it.
- The harnesses no longer touch `quests/quest-log.json`: they seed their
  own log in a temp dir via `FOLIO_LOG`.
