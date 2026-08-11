# Folio — a lesson-gated toy DAW (learning project)

The player is learning music composition (craft layer) through a toy DAW that
grows one primitive per lesson. The tool is the cage; the music is the
point. Read `CURRICULUM.md` (lessons + quest system), `QUESTS.md` (L1
board + rules), `BUDGET.md` (HUD budget ledger) before proposing anything.

**Second purpose (2026-08-11): this project is also an untrained-ear lab**
for TheoryOfMagic's scored-encounters design — read
`E:\experiments\TheoryOfMagic\Docs\design\wiki\music-mechanics.md`. Part of
all this is sussing out what to ask a real composer for that game's design,
and its doctrine leans on assumptions about what the *untrained* ear can do
(e.g. "same-vs-different recognition is the strongest untrained faculty").
The player's own pre-training ear is the one instrument that can test those
assumptions, and it is being destroyed by the curriculum on purpose — so
**capture untrained-ear findings in `EAR-NOTES.md` the moment they surface**
(dated, with the drill that surfaced them). First finding already logged:
interval *direction* is not natively readable, let alone magnitude.

## Running

- `folio.cmd` (or `node server.mjs`) → http://localhost:4173 — the synced
  instrument. `server.mjs` is zero-dependency Node. `ecosystem.config.cjs`
  runs it under pm2 as `folio-dev` (logs in `tmp/`); pm2 does not survive
  a reboot here unless resurrected. **A down server may be deliberate** —
  disk writes to the log and the rulings migration want the server off and
  the tab closed — so ask before restarting it; never assume it's an
  accident.
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
  loop, the pages) · `quiz.js` (the up-or-down ear quiz: the TOOLS rail
  kind, the ramp, and the `earlog` field — a per-answer record riding the
  autosave, last 500, for the assistant's error-pattern reads; player-
  requested 2026-08-11) · `quests.js` (workspaces, drills, the log on disk and
  its sync, tabs, rails) · `entry.js` (keyboard by `e.code`, gamepad) ·
  `tones.js` (what the voices sound like: the WAV read, the kits off the
  shelf, the sampled voice — no room, no F4) ·
  `boot.js` (the order it happens in, once).
  **Plain `<script src>`, NOT ES modules** — file:// has no CORS for
  classic scripts, so `folio.html` opened straight off the disk still
  works offline with no server and no build step. Keep it that way. The
  files share one scope through ordinary globals; that is deliberate, not
  an accident to be "fixed" with a bundler or a namespace object.
- `server.mjs` — static serve (repo root + `js/` + `quest-backgrounds/`) +
  GET/PUT `/api/quest-log` (ETag, atomic writes, drill-preservation on
  stale PUTs) + GET/PUT `/api/rulings` (ETag, atomic writes, **per-id
  merge**) + `/api/kits` (list, GET/PUT/DELETE per file; whitelisted
  paths, RIFF-checked bodies, 256KB cap). `FOLIO_LOG` moves the log,
  `FOLIO_RULINGS` moves the rulings, `FOLIO_KITS` moves the kit shelf —
  that is how the harnesses avoid the player's own data.
- `kits/<name>/` — sample kits: WAVs + `manifest.md` (one line per
  sample: root, rate, bytes, loop, decay, source). The 64KB honor budget
  is WAIVED by player ruling (2026-08-02) where it costs quality or adds
  complexity. `kits/piano/` is Salamander Grand (9 roots, 5 s, no loops).
  `music-box/`, `pluck/`, `pluck-bass/`, `sub/` are BAKED by the
  checked-in zero-dependency `kits/bake.mjs` — arithmetic only, nothing
  sampled from anywhere; re-bake with `node kits/bake.mjs`.
- `quests/quest-log.json` — all workspaces (v2 schema: free + per-quest
  patterns + `drills` array). A page doc may carry `len` (16/32/64,
  **seeded only** — no control edits it, by ruling) and `mirrors`
  (`[{voice, cell, sites:[…]}]` — one cell of music pointed at from
  several places; a write at any site lands at all of them, written
  lengths and seals travel with the cell, what is *heard* is still
  worked out per site. Field-seeded only: no UI, no bindings until the
  arrangement lesson. Read strictly — a malformed mirror is dropped
  whole and its notes left alone). The single file to READ to see the player's
  music. **No test may read or write it.** It no longer carries `done` —
  an old log that still does is read permissively, as a seed.
- `quests/rulings.json` — **the rulings: which quests are complete**
  (`{folio:"rulings", version:1, complete:{"<id>":true}}`). The
  assistant's to write from a terminal; the app only ever READS it (boot
  + the ten-second poll) and PUTs one id at a time when C / ○ is pressed.
  A tab's autosave can no longer clobber a verdict — that is what it is
  for. **No test may read or write it** either; migrate an old log with
  `node scripts/migrate-rulings.mjs` (tab closed).
- `auditor.html` — blind lineup listening; `?ids=a,b,c` picks entries.
- `tests/` — restructured 2026-08-01, pared 2026-08-01. `tier1.js` (342
  checks) is data integrity only: a page out and back (including `tones`),
  the quest log's v2 schema, the WAV round-trip, the checked-in kits read
  as the page reads them, the kit API, server.mjs driven for real, a boot
  onto an existing log. **It is
  always-green, no exceptions: run it first and last, every time.** Then
  `reltest.js` (726, the instrument's input semantics, including the
  multi-frame pad section that used to be leaptest.js — that file is gone),
  `bootcheck.js` (207, real-Chrome boot and layout: only what a browser can
  prove), `drilltest.js` (40, live drill delivery), `statictest.js` (50,
  the deploy artifact and the read-only copy). `rig.js` is the shared bench
  for the fake-DOM harnesses and loads the app from whatever `folio.html`
  actually names; `cdp.js` is the one CDP driver. Test LOC 4876 against
  5779 of app (folio.html + folio.css + js/*.js + server.mjs). Total test
  LOC is kept **at or under app LOC** — extend by deleting something first.
  NOTE: bootcheck has two timing-sensitive clusters (the pitch guide's
  1300 ms fade, and pad taps that need the animation frame) that flake on a
  loaded machine; a clean re-run with `rm -rf tests/prof-boot` first is the
  check, and the profile is NOT wiped between runs by the harness itself.

## Critical rules learned the hard way

1. **The sync race:** the open tab autosaves (debounced PUT of full
   state) and CLOBBERS any on-disk edit to quest-log.json — except drill
   definitions, which server+client merge non-destructively, and the
   completions, which are not in that file at all any more (2026-08-05):
   they live in `quests/rulings.json`, are merged per id by the server,
   and are read by the app on the same poll the drills ride — so a
   ruling written on disk shows in the rail within ~10 s, no reload, and
   nothing the tab saves can take it back. To deliver a
   drill: append to `drills` in the file; the app adopts it within ~10 s,
   no reload. To edit anything ELSE on disk: tell the player to reload the tab
   FIRST (server wins on boot). To REMOVE a drill: edit file, then tab
   reload (client re-donates known defs otherwise). AND (learned
   2026-08-04, the seals strip): a drill whose pattern carries fields the
   RUNNING client predates is adopted, then re-donated WITHOUT those
   fields by the next autosave — never deliver schema-bearing drills
   until the tab has reloaded onto the code that knows the schema.
2. **Feature work is quest-metered** (BUDGET.md, revised 2026-07-31 —
   the $ ledger is retired): 2 completed quests = 1 small feature; bigger
   features cost proportionally more, judged honestly; a lesson pass
   grants 1 feature of any size. Bug fixes, warranty, music feedback,
   theory, drills: free. Never build features unprompted.
3. **The gamepad is the primary surface** (player ruling 2026-08-04),
   and it stays in the **FFXIV cross-hotbar idiom**. Every feature has a
   pad home, and **that layout is agreed with the player BEFORE the
   brief is written** — never delegated to the building agent, never
   deferred because the seats look full. Keyboard bindings are derived
   from the agreed pad layout, not the other way round. A feature that
   only the keyboard can reach is not finished.
   **Keyboard = physical position only** (`KeyboardEvent.code`) — IT
   layout. Gamepad (revised 2026-07-31): contour entry ONLY — the absolute
   trigger crossbar is deleted. Face buttons are the move (△ up, ✕ down,
   ○ again, □ rest); **triggers L2/R2 are the modifiers** (third, fifth,
   both = semitone out of key); **bumpers L1/R1 are the voice**, tapped.
   Both triggers under the d-pad split by axis (2026-08-04): the *pitch*
   pair is the semitone hatch, the *time* pair **carries the note** one
   step, its written length with it — so ↑↓ in the column, ←→ in the
   roll, trading places exactly as the bare d-pad's pairs do.
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
**L3.1 is live and its board is authored**: seven holds quests since
2026-08-04 (long note, all ring, ring the seam, two breaths, steal the
beat, threes, daylight — copy in QUESTS.md; apprentice's hand was the
eighth, delivered as a drill but deferred to the new L4 and off the
pass). **All seven are CLOSED 2026-08-04** — constraints verified against
the instrument's own span math, not by eye; **their done flags were NOT
set** (2026-08-04: the claim that they were is false in every commit —
the flag is only ever set in-app, C on the row with the quest log up;
the rail is the truth, not these documents)
(closure rulings: daylight spirit-passed; steal the beat passed pre-edit
— the post-hoc change doesn't unring it). **The L3.2 board is authored
and delivered 2026-08-04** (six quests, copy in QUESTS.md: give way,
the drone II, the ceiling, dovetail, ring the seam II, the glacier —
the suspension cornered by grid law, never named in copy), then REVISED
the same day: dovetail and ring the seam II withdrawn, four sealed-note
quests in their place (elder's line, hand-me-down, keystone, stray
planted). **Four are CLOSED 2026-08-04** — give way, the drone II, the
elder's line, the stray planted (span math again, ten loops
self-administered). Open: hand-me-down and the keystone miss their
letter by one edit each; the ceiling and the glacier are unwritten. The
lesson pass waits on the 3.2 deliverable, so no any-size grant yet. Open L2 side content: pass the torch,
Part II reprises (audit in QUESTS.md; Call and Answer II credit pending
the player's ten-loop call). Economy: quest barter (rule 2); **balance 0** —
BUDGET.md (the four 3.2 closures banked 2 smalls; both spent the same
day on long pages, priced medium). Evaluation is self-administered
(never plan around outside evaluators). Quest authoring rules:
QUEST-COPY.md — including the 2026-08-01 ruling: never specify the goal
in copy; constraints make discovery likely, never guaranteed; Teaches is
a terse name. Lessons renumbered 2026-08-04 (player ruling): **L4 =
transcription/ear, injected** — echo tooling (the folio plays a hidden
fragment, the player answers; contour → degrees → rhythm), apprentice's
hand as its capstone, and a standing ban: **no transcription quests
anywhere until L4 is done**. The 3.1 board is therefore SEVEN quests;
its pass does not wait on apprentice's hand. L5 = harmony/chords,
groove/samples/arrangement/endgame L6–L9. Same ruling: the lead
**pluck kit is retired from the rail** (a bodiless string reads as a
koto, not the guitar that was wanted; the kit stays on disk so old
pages still play it; a future guitar takes the seat).

**Design rulings 2026-08-01 (do not re-litigate):**
- The F1 key page is DELETED (rot-prone). F1 raises the key overlay now,
  and its keydown is still swallowed whatever it does — unhandled, F1
  opens Chrome help, focus is lost, rAF stops, and the playhead and
  gamepad poll die with it.
- Tonic, mode and tempo have NO runtime controls, by design: the header
  shows `tempo · key` and nothing edits them. Tonic is fixed per
  workspace (chromaticism is the spice channel), tempo comes from the
  seed, mode from the contour. Binding ergonomics revisited at the
  harmony lesson (L5 after the 2026-08-04 renumbering), not before.
- The meta line is tempo and key only.

**Queued builds, in order (briefs in `briefs/`, build serially):**
1. ~~`briefs/key-overlay.md`~~ — MERGED 2026-08-01, 1 feature credit
   spent: the strip is gone, F1 raises the overlay, top-right mark,
   crossbar-chip overlap fixed (warranty).
2. `briefs/duplicate-workspace.md` — duplicate/promote a workspace
   (quest → "II", free play → "To Be Named"); 1 small feature.
The **basic Scriptorium is MERGED** (2026-08-02, the 2 banked small
features spent together; the F4 room's demolition was warranty). Every
workspace says what its two voices sound like: the page doc carries an
optional `tones:[lead,bass]` (null = the voice's own synth tone, else a
kit name), read permissively and written only where a voice wears one.
The crossbar's **scriptorium** drawing (L1/R1 turn to it) walks two
rails — d-pad ↑↓ the lead, ←→ the bass — and walking is arriving,
autosaved with the page. Lead rail: own tone · piano · music box
(pluck retired 2026-08-04). Bass rail: own tone · pluck bass · sub.
Kits are fetched on
demand (never at boot — the piano is 2 MB), over `/api/kits` where
there is one and off plain `kits/<name>/manifest.md` where there is not,
which is how the deployed static copy gets them. **The F4 room, the
foundry, the bench, the mic and the shelf UI are DELETED** — do not
rebuild them; the kits are baked by `kits/bake.mjs`. Left for the
samples lesson (L7 after renumbering): multi-sample zones, drum lanes,
the 8-voice steal cap.
Player-gated, unscheduled: voice management anticipating 3 voices
(L3.2/harmony horizon — waits on the player's UX direction); the
structure-view idea (pattern placement + variation, noted 2026-08-01 —
build at the arrangement lesson, L8 after renumbering, not before). Design against migraine rules;
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
