# Quest Skeleton — the batch spec

Structural ground rules for authoring quest batches. QUEST-COPY.md covers
voice, register, and copy; this covers counts, seeds, lengths, and the
mechanical skeleton a batch must satisfy before any creative work begins.
Read both before authoring any board.

## Batch minimums (hard rules)

Every authored batch must satisfy all of these:

- **At least 7 quests.**
- **At least 2 quests at len 32.**
- **At least 2 quests using mirrors.**
- **If there is a capstone, it must be len 64.**

These are minimums, not targets. A 10-quest batch with three 32s and
three mirrored quests is fine. A 6-quest batch is not.

## Board sizing

A board is one sub-tier of a lesson (e.g. 3.1, 3.2, 3.3). A lesson
may have several boards — L3's 26 quests across three boards is fine;
the problem is when a single board overstays its idea.

Stop adding quests to a board once the idea has audibly landed.

- Prefer a short gating board plus optional non-gating room (3.3-style)
  over a long gating wall.
- One new primitive per quest. A shape, a control, a tool that hasn't
  appeared before gets one quest where it is the only new thing (the L5.1
  failure: four roots + an unexplained shape by quest two).

## Drill data shape

Every drill in `quest-log.json` has exactly these fields:

```
{
  "id":       "kebab-case-slug",
  "name":     "lowercase display name",
  "summary":  "- bullet one\n- bullet two",
  "teaches":  "terse concept name, full stop.",
  "pattern":  { ... page document ... },
  "lesson":   <int>
}
```

- `id` — unique, kebab-case slug. No capitals, no spaces.
- `name` — lowercase, evocative, concise. No sigils.
- `summary` — the constraint copy. En-dash bullets separated by `\n`.
  See QUEST-COPY.md for copy rules.
- `teaches` — italic concept name, one sentence fragment, ends with a
  full stop. No mechanism, no explanation.
- `pattern` — the seed workspace (see Seed shape below).
- `lesson` — integer tab number. Every drill in a batch shares the same
  lesson number.

## Constraint copy — structural limits

QUEST-COPY.md covers voice and format. These are the structural limits:

- **2–5 bullets per quest.** Two is a focused constraint; five is a
  ceiling. If you need six, the quest is two quests.
- **5–7 words per bullet.** One rail-line. If it wraps, shorten it.
- **Every bullet is one of these types:**
  - Count: "exactly N notes", "at most N rests"
  - Placement: "no strike on steps 5, 9, 13"
  - Range: "inside one octave", "above the sealed note"
  - Length: "every note N steps or more"
  - Relationship: "never share a step", "one step down"
  - Structural: "lead 17–32 repeats lead 1–16"
  - Perception gate: "stopping must feel like an interruption"
    (player's own ear — QUEST-COPY.md §perception gate)
- **No other type.** If a bullet doesn't fit one of these, it's a goal
  disguised as a constraint. Rewrite or split.

## Page length

- **16 steps** — the default. Use for any quest that doesn't need
  repetition, variation across halves, or structural form.
- **32 steps** — when the constraint needs two halves (repeat-and-vary,
  A/B structure, "second half changes one cell"). At least two per
  batch. Never the first quest on a board.
- **64 steps** — capstone only. If a batch has a capstone, it is 64.
  One per board maximum, always last.

The `loop` field in the seed always equals `len` (or 16 when `len` is
absent). Never set `loop` and `len` to different values.

### Page length gates the form arc

Length decides how much of the establish–vary–twist–return arc a quest
may carry (arc vocabulary is authoring-side only — see below):

- **16** — no arc. The loop is the whole idea ("meet the ostinato").
  Establish, or establish-and-vary at most.
- **32** — compressed arc, by halves: establish in the first half,
  vary in the second. (Twist mechanics deferred with break rules.)
- **64 (capstone)** — the full arc, by quarters: the loop stated clean;
  the ground holding exactly while the lead varies; the twist (deferred);
  the exact return — the mirror re-engaged through the final occurrence
  enforces it literally.

**No arc vocabulary in player-facing copy.** No "twist", no "return",
no form terms. The arc expresses only through existing constraint types
(structural, placement, count, perception gate); the player discovers
the form by hearing it.

## Seed shape

The seed is a page document. Its shape depends on what tools the board's
lesson has unlocked.

### Empty seed (player builds from nothing)

All voice arrays (`steps`, `bass`) are all-null. All hold arrays are
all-1. All lock arrays are all-null. Mirrors is `[]`. Chords (if present)
are all-null, chordhold all-1.

Use when: the quest constrains what the player builds. Most quests.

### Sealed seed (pre-placed locked notes)

Some slots in `steps`/`bass` carry pitches. Matching slots in
`lock`/`basslock` are `true`. Unsealed slots are null/null.

Use when: the quest says "work around this" — elder's line, keystone,
stray-planted. The sealed notes ARE the given material; the player fills
the rest.

Rules:
- A sealed note must be mentioned or implied by the constraints ("the
  sealed note", "every sealed note is renamed").
- Never seal more than half the page. The player needs room to noodle.
- Hold values on sealed notes should be set to their intended heard
  length, not left at 1.

### Mirrored seed (structural repetition baked in)

The `mirrors` array carries `{ voice, cell, sites[] }` objects. Writing
at any mirror site writes the cell; all other sites update.

Use when: the quest needs structural repetition the player doesn't
author ("lead 25–32 repeats lead 1–8"). The mirror enforces it; the
constraint copy names it.

**Layer gradient (ruling, 2026-08-29).** The default mirror target on
long pages is a ground layer — bass, chords, or both. Deviation is
relative: the ear needs an unmoving layer to measure breaks against, so
the backing holds the symmetry and the lead spends it. Lead mirrors stay
legal but are the marked case: the loose kind (offset sites, partial
coverage — the before-the-bell early-return trick), surface gestures,
not floors. The two existing lead-mirror quests (before-the-bell,
the-return) are grandfathered.

**Ground mirrors are exact and tiling.** A ground mirror covers the
page: bass at cell 4 or 8, chords at cell 8 or 16, sites tiling every
occurrence. No offset sites on ground layers — offset is a lead trick.
A gap in a ground mirror's coverage must be a deliberate authored break,
never an oversight. (Break authoring rules — placement, pricing,
granularity — are deferred; until they land, ground mirrors tile fully.)

Rules:
- `cell` = number of steps in the mirrored segment.
- `sites` = array of start indices. Each site spans `cell` steps.
- Sites must not overlap.
- `cell × sites.length` must not exceed `len` (or 16).
- `voice` = 0 (lead), 1 (bass), or 2 (chords). A chord mirror binds the
  written cell; the voicing is still computed at each site.
- A quest may mirror several lanes — one mirror object per lane.
- On any board using mirrors, at least one mirrored quest mirrors a
  ground layer.

### Chord seed (L5+)

The `chords` array is length `len` (or 16). Each slot is either null or
`{ deg, shape, inversion, octave }`.

- `deg` — scale degree offset from tonic (0 = I, 1 = ii, ... 6 = vii).
  NOT a semitone count.
- `shape` — `"triad"` only for 5.1/5.2. (`"sus4"`, `"sus2"`, `"seventh"`
  for 5.3+.)
- `inversion` — 0 (root), 1 (first), 2 (second). Default 0.
- `octave` — transposition in octaves. Default 0.
- `chordhold` — parallel array of integers, same as `hold` for notes.

For empty chord seeds: all chords null, all chordhold 1.

### Echo seed (L4)

Echo quests carry an `echo` object instead of mirrors/chords:

```
{
  "stage": <int>,
  "voice": <int>,
  "at": <int>,
  "call": [ { "step": <int>, "note": "<pitch>", "len": <int> }, ... ]
}
```

Echo seeds are structurally different enough that they follow their own
brief (see echo tooling docs). This skeleton does not cover echo
authoring beyond the data shape.

## Batch template

A batch is authored as a single commit adding N drills to the `drills`
array in `quest-log.json`. Before writing any creative content:

1. **Fix the lesson number.** Every drill in the batch shares it.
2. **Fix the board size.** 5–10 quests. Decide before writing any.
3. **Fix the page length arc.** Most quests at 16. At most two at 32,
   at most one at 64, and only at board end.
4. **Fix the seed type.** All seeds in a batch are usually the same type
   (empty, sealed, mirrored). Mixed batches need a reason.
5. **Fix the tool surface.** Which arrays appear in the seed? Only the
   tools the lesson has unlocked. A L3 seed has hold/basshold/lock/
   basslock. A L5 seed has chords/chordhold. Don't include tools from
   future lessons.

Only then write the quests — id, name, summary, teaches, pattern.

## Progression within a board

Quests are ordered easiest-first:

1. **Ground quest** — one new primitive in isolation, minimal bullets
   (2–3). Example: "the ground" (one root, all page).
2. **Pair quest** — the primitive meets one companion. Example:
   "home and away" (two roots, a fifth apart).
3. **Combination quests** — the primitive in richer contexts, more
   bullets (3–4). Constraints reference tools from earlier lessons.
4. **Capstone** — the hardest constraint, len 64, more bullets (4–5).
   Example: "quarters" (64 steps, four structural sections). If the
   board has a capstone, it must be 64.

Not every board needs all four tiers. A 5-quest board might be
ground → pair → combination → combination → capstone.

Mirror-specific ordering:

- The first mirror the board's player touches is the generous kind:
  write here, hear it return. Vise geometry — mirrors used to collapse
  the solution space — comes later in the board or not at all.
- Bass mirror and chord mirror are two primitives. Each gets its
  isolation quest (one mirror, minimal bullets, nothing else new)
  before appearing in combination quests.
- The full form arc is capstone-or-late material only.

## Verification checklist

Before delivering a batch:

- [ ] At least 7 quests?
- [ ] Every drill has id, name, summary, teaches, pattern, lesson?
- [ ] All ids unique, kebab-case?
- [ ] All lesson fields identical?
- [ ] summary bullets: 2–5 per quest, 5–7 words each?
- [ ] Every bullet fits a constraint type (count/placement/range/
      length/relationship/structural/perception)?
- [ ] At least 2 quests at len 32?
- [ ] At least 2 quests using mirrors?
- [ ] Capstone (if any) is len 64?
- [ ] Mirror voice follows the layer gradient (ground default; a lead
      mirror is the loose kind, justified)?
- [ ] At least one mirrored quest mirrors a ground layer?
- [ ] Ground mirrors exact and tiling (no offset sites, no gaps)?
- [ ] Length gates respected (16 = no arc, 32 = halves, 64 = full arc)?
- [ ] First mirror on the board is the generous kind?
- [ ] Bass and chord mirrors each met in isolation before combination?
- [ ] No arc vocabulary in player-facing copy?
- [ ] Seeds match the lesson's tool surface (no future-lesson arrays)?
- [ ] Empty seeds truly empty (all-null, all-1)?
- [ ] Sealed seeds: lock matches placed notes, ≤ half sealed?
- [ ] Mirror sites don't overlap, cell × sites ≤ len?
- [ ] Progression: easiest first, one new primitive per quest?
- [ ] QUEST-COPY.md pre-flight passed for every quest?
