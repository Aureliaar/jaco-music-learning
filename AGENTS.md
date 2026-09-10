# Folio — a lesson-gated toy DAW (learning project)

The player is learning music composition (craft layer) through a toy DAW that
grows one primitive per lesson. The tool is the cage; the music is the
point. Read `CURRICULUM.md` (lessons + quest system), `QUESTS.md` (L1
board + rules), `BUDGET.md` (HUD budget ledger) before proposing anything.

## How we work together

- Be warm, candid, and conversational. This is a long-running creative
  collaboration, so write like a thoughtful studio partner rather than a terse
  build bot.
- Lead with the useful result, then explain the reasoning in plain language.
  Keep routine updates compact, but give design and music questions room to
  breathe.
- Surface uncertainty and disagreements directly, with concrete evidence. Ask
  before making a choice that would change the player's creative direction.
- Preserve the project's vocabulary and slightly storybook tone where it helps;
  don't force whimsy into logs, commands, test output, or bug reports.
- Never confuse friendliness with cheerleading. Honest critique is more useful
  here than automatic agreement.

### When we're talking about music

- Meet the player at the ear, not at the textbook. Start with what can be heard,
  felt, compared, or tried; introduce a theory name afterward only when it makes
  the next conversation easier.
- Treat the player's own descriptions—weight, pull, color, distance, weather,
  or anything else—as useful musical evidence. Translate them when helpful;
  never correct them merely for being nonstandard.
- Prefer one small, playable experiment over a lecture or a pile of exercises.
  Say what to listen for without promising what the player must hear.
- For composition feedback, a good natural shape is: what is already audible,
  where the interesting choice or tension lives, then one possible experiment.
  Use that shape when it fits, not as a mandatory template.
- Praise specifically and sparingly: name the musical decision or newly heard
  distinction that earned it. Avoid generic encouragement and teacherly grading.
- Distinguish observation, interpretation, and taste. The player should be able
  to tell whether something is in the notes, inferred from them, or simply one
  artistic preference.
- Keep the exchange alive and human. Ask a focused question when the answer will
  genuinely shape the next thought; don't tack a question onto every response.

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
- `folio-reaper.cmd` starts the optional native-MIDI/REAPER renderer without
  touching the Folio server. Folio remains the sole UI, clock, and transport;
  closing the stopped rack restores own-tone fallback. The complete contract,
  fixed channel/patch map, lifecycle, rebuild path, and diagnosis are in
  `rack/README.md`; read that before changing either side of the bridge.
- **Seeing what the player sees:** the `experiments-hub` MCP server (user
  scope for Claude Code, `~/.codex/config.toml` for Codex) has
  `list_browser_tabs`, `read_console`, `screenshot_tab` and `evaluate_in_tab`
  over the Hub window (`browser: "hub"`) and each managed profile, plus
  `get_logs` (a server the Hub started) and `hub_log` (hubd itself). Over
  HTTP the same views are at `http://localhost:7777/api/inspect/*`; the route
  list is in the header of `aureontools/hub/hub-inspect.mjs`. Inspect, don't
  restart: never close or restart the player's browser to look at it.

## Architecture (all zero-dependency)

THE CODE IS THE SOURCE OF TRUTH: many sessions/agents have modified it;
always read it for current bindings — do not trust docs or memory for
keymaps. **There is no controls reference of any kind, by ruling** — the
F1 key page (2026-08-01, "too rot prone"), the hint strip, and the key
overlay that replaced them (2026-09-07) are all DELETED. A screen that has
to explain the controls is an admission the controls failed: what a control
does is said on the screen the control lives on, in its own legend. Do not
propose reviving one. The truth about bindings is `js/entry.js`.

- `folio.html` — the markup and the list of scripts. It
  carries a MAP comment at the head saying what lives where. **Read the map
  and one file**, not everything.
- `folio.css` — every rule the page is drawn by.
- `js/*.js` — the instrument, split 2026-08-01, loaded in this order:
  `state.js` (the page as data, holds arithmetic, key/degrees, the
  validator, the autosave) · `views.js` (column, roll, scenery, renderers,
  `say()`) · `audio.js` (timbres, lookahead scheduler,
  transport) · `edit.js` (writing, length, contour, voices, key, tempo,
  loop, the pages) · `chords.js` (**the chord lane, L5**: the `chords` field
  read strictly, the shapes, the near/rooted voicing arithmetic, and the
  lane's own writing — the lane is the third stop on the voice ring,
  `CHORD_LANE`, and inherits the holds arithmetic whole because state.js
  asks only whether something is written at a step) · `quiz.js` (the
  up-or-down ear quiz: the TOOLS rail
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
  whole and its notes left alone) and `chords` (the L5 chord lane:
  `[{deg, shape, voicing}|null, …]`, one cell a step, with `chordhold`
  beside it — a degree of the key and a shape, never a chord name; the
  pitches are computed from the cell before it and never stored. Read
  strictly, dropped whole, and written only where a page has one). The single file to READ to see the player's
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
- `tests/` — replaced 2026-08-28 with one real-Chrome suite: `e2e.js`, seven
  user journeys covering boot/render, keyboard composition, gamepad
  composition, autosave/reload, live drill+ruling sync, the sample shelf, and
  the static read-only build. `cdp.js` is its zero-dependency Chrome driver.
  Run `npm test --prefix tests`. The harness uses only temp logs, rulings,
  kits, build inputs, and browser profiles; it never reads or writes the
  player's `quests/quest-log.json` or `quests/rulings.json`.

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
   The base octave is page up/down on the board and has no pad seat.
   Range C2–C6, MIDI 36–84.
   **The cross-hotbar idiom lives on the PAGE, never behind start**
   (2026-09-07): the triggers, bumpers and face buttons are the hotbar
   because they write notes every few seconds. Start is a *list of
   places* — folio · voices · quests · settings · mirrors, turned with
   L1/R1 — because an action bar away from the page is a shape with
   holes asking to be filled, which is how the folio grew a hidden
   second drawing and a slot that answered "nothing on that slot yet".
   Inside a screen the rule is mechanical and has no per-row
   exceptions: **←→ turns a value and you stay; ✕ finishes an act and
   you are back on the page; ○ is back; start puts it all down from any
   depth.** The one seam is ○ on the quests screen, which is still
   "complete" pending a ruling on completion itself.
   **No screen ever replaces the drawing** (2026-09-08): the folio stays
   visible under every one of them. The ground steps down a shade to a
   desk and the folio becomes a lit sheet on it; the page washes to about
   a third of its ink, keeping the playhead row legible; whatever is live
   is lit and rimmed in gilt. The quest log lives in the two margins,
   because **a quest IS a workspace** — the left margin's list and the
   log were always one list drawn twice. Do not propose a centred board,
   a full-screen mode, or a darker watermark. See
   `briefs/start-screens.md` and `js/screens.js`.
4. **Build on relations, never on identities** (player ruling 2026-08-11).
   Relational hearing here is strong — tension, territory, sameness,
   interval character — while putting a *name* on a single sound is a
   genuine and probably permanent weakness. So: no note-naming tasks, no
   recall-the-label drills, no "which note was that". Quests and tools ask
   how one thing sits against another, never what a thing is called.
   Transcription is the one skill that only answers to volume, and volume
   is not to be prescribed here — L4's remaining rungs are optional and
   the lesson does not gate on them. Also: **find the feeling first, name
   it second** — reach for a theory term only when the name saves work,
   never teach the term and ask for the feeling it labels. Findings from
   the listening sessions live in `EAR-NOTES.md`.
5. **Migraine rules (revised):** only grid/stripe patterns and extreme
   contrast are forbidden. Texture/gradients fine. Nothing blinks; calm
   motion. Do not over-apply.
6. **Implementation workflow that works:** keep one feature per task. Start by
   reading folio.html as the source of truth, then carry the migraine rules,
   e.code rule, and testing policy below through the change. Never commit
   BUDGET.md, QUESTS.md, quest-log.json, or rulings.json unless told. Verify UI
   work in real headless Chrome, not by inspection (a layout bug shipped when
   that check was skipped).
7. **Testing policy (2026-08-28, replaces the complexity ledger):** there are
   seven end-to-end journeys and no unit suite. Run `npm test --prefix tests`
   before and after a change. A new test must protect a distinct player
   journey whose loss would plausibly destroy work or make the instrument
   unusable; do not add assertions for helper branches, permutations,
   styling, copy, exact DOM structure, or bugs already obvious in an existing
   journey. Keep the public count in single digits: strengthen or replace a
   journey instead of growing a second suite. UI verification still includes
   opening and describing `tests/e2e.png`, because screenshots have caught
   failures assertions missed. Report the literal `N passed, M failed` tail.
8. Windows console is cp932 — Python on quest-log.json needs
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
- The F1 key page is DELETED (rot-prone), and so is the key overlay that
  replaced it (2026-09-07). F1 now does nothing, but its keydown is still
  swallowed — unhandled, F1 opens Chrome help, focus is lost, rAF stops,
  and the playhead and gamepad poll die with it.
- Tonic, mode and tempo have NO runtime controls, by design: the header
  shows `tempo · key` and nothing edits them. Tonic is fixed per
  workspace (chromaticism is the spice channel), tempo comes from the
  seed, mode from the contour. Binding ergonomics revisited at the
  harmony lesson (L5 after the 2026-08-04 renumbering), not before.
- The meta line is tempo and key only.

**Queued builds, in order (briefs in `briefs/`, build serially):**
1. ~~`briefs/key-overlay.md`~~ — merged 2026-08-01, then **DELETED
   2026-09-07** with the whole idea of a controls reference. The brief
   is gone; do not revive it.
2. `briefs/duplicate-workspace.md` — duplicate/promote a workspace
   (quest → "II", free play → "To Be Named"); 1 small feature.
The **basic Scriptorium is MERGED** (2026-08-02, the 2 banked small
features spent together; the F4 room's demolition was warranty). Every
workspace says what its two voices sound like: the page doc carries an
optional `tones:[lead,bass]` (null = the voice's own synth tone, else a
kit name), read permissively and written only where a voice wears one.
The **voices screen** (start → voices) walks the rails — one row a
voice, ← and → along its rail — and walking is arriving, autosaved
with the page. It replaced the crossbar's scriptorium drawing on
2026-09-07. Lead rail: own tone · piano · music box
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

Housekeeping done (needs no repeating): the former 1,300+-assertion mixed
unit/fake-DOM/browser suite was removed 2026-08-28. Seven isolated real-user
journeys are the suite now; do not rebuild the test matrix or its LOC ledger.
`folio.html` split into `folio.css` + `js/*.js` (see Architecture). Old
worktrees daw-l3 / daw-l3-holds / daw-l3-demo / daw-pare are merged and
removable; the :4179 and :4182 demo servers are STALE — the live
instrument is :4173 only.
