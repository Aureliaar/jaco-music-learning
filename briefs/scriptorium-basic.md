# The basic Scriptorium — tones per voice, chosen per workspace

Priced and authorized 2026-08-02: the 2 banked small features, spent together.
The demolition of the F4 room is warranty (shipped UX contradicted the
project's gamepad-first law).

## What it is

Every workspace chooses what its two voices sound like. A *tone* is either
the voice's own synth sound or a named sample kit off the shelf. The choice
is made on the crossbar's scriptorium mode (the modal crossbar spike is
already on main — chips, L1/R1, `wearStep` — reshape it freely), and it is
part of the page: switch workspace, the tones switch with it.

- **Lead rail** (3–4 options): `own tone · piano · music box · pluck`
- **Bass rail** (2–3 options): `own tone · pluck bass · sub`

`piano` is the existing `kits/piano/`. The others are BAKED, not fetched:
write `kits/bake.mjs` (zero-dependency Node, checked in — it documents
provenance) that synthesizes each kit from primitives — the arithmetic in
`js/scriptorium.js` (Karplus-Strong, sine/FM partials, encodeWAV) is the
reference; port what you need into the bake script. Each kit: 2–3 samples
at spread roots, 11025 Hz mono PCM16, loop + decay where a hold needs to
ring, `manifest.md` in the established format, comfortably under the 64KB
budget. Bass kits need low roots (E1–A2 region). Check the kits in.

## The data

The page doc (version:1) gains one optional field:

    tones: [null, null]        // [lead, bass]; null = own tone, else kit name

- `state.js` validator: optional, array of VOICES entries, each null or a
  short string; absent → all-null. Never reject an old page for lacking it.
- It rides the autosave and the quest-log v2 pattern embeds untouched — no
  schema version bump.
- Unknown kit name at load (shelf missing it, file://) → play own tone,
  never error.

## Playback

Generalize the sampled voice: today's hook covers the lead only, driven by
global `kitWorn`/`kitName` + localStorage. Replace with per-voice: when the
current doc's `tones[v]` names a kit, that voice plays nearest-root samples
(playbackRate, loop + imposed decay for holds — the machinery exists); null
plays the synth as ever. Drop KIT_KEY/WEAR_KEY localStorage and the global
wear entirely. Preload the option kits once at boot when served (they are
small); on file:// everything is own tone and the rails say so.

## The crossbar mode

Scriptorium mode slots: ↑/↓ walk the lead rail, ←/→ walk the bass rail —
walking is arriving (applies to the current workspace, autosaves), values
show the current tone names, head styling on all four. □ △ ✕ empty, ○ close
as in the spike. Chips/L1/R1 unchanged. Update the key overlay's settings
cluster description accordingly.

## The demolition (warranty)

- The F4 room dies: `renderScript`, the foundry, bench, mic, drop, dials,
  waveform, shelf-row UI, the `#scriptorium` section and `#wavpicker` in
  folio.html, their CSS, the F4 and in-room W bindings, the room's entries
  on the key overlay (F4 line; scriptOn mentions in anyPage/pollPads).
- KEEP: WAV decode, kit fetch/load (`/api/kits` client), nearest-root
  playback, server.mjs untouched, tier1's WAV/kit-API checks.
- What survives of scriptorium.js is the tone/kit playback layer — rename
  or fold as reads best; folio.html's MAP comment and script list stay
  truthful.

## Tests (policy: total test LOC ≤ app LOC — this build must shrink it)

- DELETE the room's reltest section and any bootcheck room checks.
- reltest: scriptorium-mode semantics — mode flip, four-direction rails,
  wrap, per-workspace persistence (switch workspace → tones follow).
- tier1: doc round-trip with `tones` (and without — default), quest-log
  embed.
- bootcheck: crossbar scriptorium mode drawn in real Chrome; a workspace
  with a kit tone boots and plays it (buffer source, not oscillator).
- statictest/deploy list: new kit dirs included.

## Laws (non-negotiable)

- Read `folio.html` (the MAP comment) first; the code is the source of
  truth, not this brief's memory of it.
- Keyboard by `e.code` only (IT layout). Gamepad: contour entry + the
  crossbar; do not invent chords.
- Migraine rules: no grids/stripes, no extreme contrast, nothing blinks.
- Sigil/parchment idiom; copy in the project's plain lowercase voice.
- Verify in real headless Chrome (cdp.js) with screenshots you open and
  DESCRIBE — a layout bug shipped here when an agent verified by
  inspection.
- Run tier1 first and last (always-green), then reltest, bootcheck,
  drilltest, statictest; quote the literal "N passed, M failed" tails.
  Pre-existing failures: report verbatim, never fix, never paper over.
- NEVER read or write `quests/quest-log.json`; harnesses seed their own
  log via FOLIO_LOG.
- Never commit BUDGET.md, QUESTS.md, quest-log.json. Commit with
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>.
