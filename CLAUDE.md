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
   e.code rule, extend the newest test harness and keep ALL checks green,
   commit with Co-Authored-By, never commit BUDGET.md/QUESTS.md/
   quest-log.json unless told. Agents verify in real headless Chrome, not
   by inspection (a layout bug shipped when one didn't).
6. Windows console is cp932 — Python on quest-log.json needs
   `encoding='utf-8'` both directions.

## Where the project stands (2026-07-31)

L1 passed. L2 (two voices) in progress: tool built; quests closed —
shadow, ostinato, oil and water, drone, hocket hiccup + snap; latecomer
failed (design ruling in QUESTS.md), chord-that-isnt removed. Open:
torch, hocket handoff, 7 Part II reprises. Economy: quest barter (see
rule 2); balance in BUDGET.md. **Evaluation is now self-administered**
(family-verdict system scrapped 2026-07-31 — never plan around outside
evaluators). Curriculum restructured 2026-07-31: L3 = duration/holds
(phases 3.1 one voice, 3.2 two voices — the pare-down rule), L4 =
harmony/chords, groove/samples/arrangement/endgame shifted to L5–L8.
L2 gate: self-tests in CURRICULUM.md L2. Quest authoring rules:
QUEST-COPY.md.

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
   (L3.2/L4 horizon).
9. Per-quest backgrounds — wire up the untracked `quest-backgrounds/`
   folder (22 PNGs named by quest/drill id, generated by another session;
   nothing references them yet). Needs the scenery scrim treatment
   (header/footer darkening) to keep text legible.
Design against migraine rules; sigil/parchment idiom.
