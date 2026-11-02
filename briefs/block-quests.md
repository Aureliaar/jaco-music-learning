# Block quests: three doodles (2026-10-09)

Three drills for the blocks (F4), written for speed rather than pedagogy:
each opens already sounding, and the work is mostly done in the strip. None
of them depends on per-pass marked notes. No seed uses `seat`, because which
instruments the rack offers depends on the rack; the player can still reach
them with R/F.

Status: **not delivered**. The JSON at the bottom is what gets appended to
`drills` in `quests/quest-log.json`. Rule 1 applies: `blocks` is
schema-bearing, so the player's tab has to be running code that has
`js/blocks.js` before these go in. If it isn't, the next autosave adopts the
drills and then writes them back out without their blocks.

---

## ⚔ a bad time

- the riff is sealed
- at least eight blocks
- no two neighbouring blocks alike
- the lead sits out at least once
- the bass sits out at least once

*Teaches: arrangement: the loop is only the brick.*

**Seed:** D minor, 120, page and loop 32. The lead holds the first two bars
of Megalovania's riff, sealed `prl`: the root-root-octave figure, then the
chromatic slide down and the three-note pickup, once from the tonic and once
from a whole step below. The bass lays a plain eighth-note pulse on the
roots, D2 for bar one and C2 for bar two. It isn't sealed, and neither is the
chord lane (which is empty), so there's room for doodling there too. The
seeded blocks are a little arrangement already: riff alone → riff and bass →
riff up an octave → riff and bass. F4 and space plays music straight away.
The constraints push it to eight or more passes, with each voice dropping
out somewhere.

**Checks (page data):** `lock` is unchanged; `blocks.length ≥ 8`; no `i`
where `blocksOut[i]` deep-equals `blocksOut[i+1]` (not counted round the
seam); some block has `lanes[0].off`; some block has `lanes[1].off`.

## ⚔ the prelude

- the figure is sealed
- bass notes eight steps or longer
- the bass sits out block one
- at least six blocks
- no two neighbouring blocks alike

*Teaches: the ground beneath a figure.*

**Seed:** C major, 84, page 64, loop 48. The lead is the Final Fantasy
Prelude arpeggio (1-2-3-5 climbing), sealed `prl`. I compressed it to three
octaves so it fits the writing range: the I chord runs 24 steps up and back
(C3→C6→D3), then the vi chord runs 24 more (A2→A5→B2). That leading-tone
step at the end goes into the seam. The bass and chord lanes are empty, so
the bass is the player's voice. Long held bass notes under a moving figure
recolour it, and the copy leaves the player to discover that. The seeded
blocks are as written, octave −1, as written, octave +1, so the strip
already rises and falls by ear when it's opened.

**Checks:** `basslock`/`lock` unchanged; every bass note has
`basshold[i] ≥ 8`; `blocks[0].lanes[1].off`; `blocks.length ≥ 6`; no equal
neighbours.

## ⚔ five notes

- at most five lead notes
- at least eight blocks
- the lead heard at three octaves
- no two neighbouring blocks alike

*Teaches: a small idea, carried.*

**Seed:** A minor, 104, page and loop 16. The ground is original, not a
quote, and it's already playing. The bass is a 3+3+2 figure on the roots
i · i · i | VI · VI · VII, and the chord lane holds rooted triads under it:
i for 8 steps, VI for 6, VII for 2 (the VII is the pickup back home). The
lead is empty. The seeded blocks are the lead tacet, then three as written,
so the first pass is the ground alone and the player's five notes come in on
the second. A pass lasts about 2.3 s, which makes the loop of writing,
pressing F4 and listening very short.

**Checks:** fewer than six non-null `steps`; `blocks.length ≥ 8`; collect
`lanes[0].oct || 0` over the blocks where `lanes[0]` is not `off`, and there
must be at least 3 distinct values; no equal neighbours.

---

## Validation (2026-10-09)

I loaded the seeds into the real app in headless Chrome, using the
`tests/cdp.js` driver and `server.mjs` against a temp `FOLIO_LOG` /
`FOLIO_RULINGS` / `FOLIO_KITS`. The player's log and rulings were not
touched. For all three, `validate(pattern)` returned non-null, `normDrill`
adopted each with a non-null pattern, and `docOut(validate(p)).blocks`
came back byte-identical to the seeded blocks. Every seal survived (20 / 48
/ 0). In each workspace, `toggleBlocks()` opened the seeded strip of four
blocks and `blockNotes` gave the expected counts per pass: a bad time
20/36/36/36, the prelude 48 ×4, five notes 15 ×4. There were no page
exceptions. I took a screenshot of the prelude with F4 up: the strip draws
four arpeggio cards, the second visibly lower and the fourth higher.

## The drills, as appended to `drills`

```json
[
  {
    "id": "bad-time",
    "name": "a bad time",
    "summary": "- the riff is sealed\n- at least eight blocks\n- no two neighbouring blocks alike\n- the lead sits out at least once\n- the bass sits out at least once",
    "teaches": "arrangement: the loop is only the brick.",
    "pattern": {
      "version": 1,
      "title": "a bad time",
      "tempo": 120,
      "loop": 32,
      "key": "D minor",
      "steps": ["D4", "D4", "D5", null, "A4", null, null, "G#4", null, "G4", null, "F4", null, "D4", "F4", "G4", "C4", "C4", "D5", null, "A4", null, null, "G#4", null, "G4", null, "F4", null, "D4", "F4", "G4"],
      "bass": ["D2", null, "D2", null, "D2", null, "D2", null, "D2", null, "D2", null, "D2", null, "D2", null, "C2", null, "C2", null, "C2", null, "C2", null, "C2", null, "C2", null, "C2", null, "C2", null],
      "hold": [1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1],
      "basshold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "lock": ["prl", "prl", "prl", null, "prl", null, null, "prl", null, "prl", null, "prl", null, "prl", "prl", "prl", "prl", "prl", "prl", null, "prl", null, null, "prl", null, "prl", null, "prl", null, "prl", "prl", "prl"],
      "basslock": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "tones": [null, null],
      "mirrors": [],
      "mute": [false, false, false],
      "chords": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "chordhold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "len": 32,
      "blocks": [
        {
          "lanes": [
            null,
            {
              "off": true
            }
          ]
        },
        {},
        {
          "lanes": [
            {
              "oct": 1
            }
          ]
        },
        {}
      ]
    }
  },
  {
    "id": "the-prelude",
    "name": "the prelude",
    "summary": "- the figure is sealed\n- bass notes eight steps or longer\n- the bass sits out block one\n- at least six blocks\n- no two neighbouring blocks alike",
    "teaches": "the ground beneath a figure.",
    "pattern": {
      "version": 1,
      "title": "the prelude",
      "tempo": 84,
      "loop": 48,
      "key": "C major",
      "steps": ["C3", "D3", "E3", "G3", "C4", "D4", "E4", "G4", "C5", "D5", "E5", "G5", "C6", "G5", "E5", "D5", "C5", "G4", "E4", "D4", "C4", "G3", "E3", "D3", "A2", "B2", "C3", "E3", "A3", "B3", "C4", "E4", "A4", "B4", "C5", "E5", "A5", "E5", "C5", "B4", "A4", "E4", "C4", "B3", "A3", "E3", "C3", "B2", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "bass": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "hold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "basshold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "lock": ["prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", "prl", null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "basslock": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "tones": [null, null],
      "mirrors": [],
      "mute": [false, false, false],
      "chords": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "chordhold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "len": 64,
      "blocks": [
        {},
        {
          "lanes": [
            {
              "oct": -1
            }
          ]
        },
        {},
        {
          "lanes": [
            {
              "oct": 1
            }
          ]
        }
      ]
    }
  },
  {
    "id": "five-notes",
    "name": "five notes",
    "summary": "- at most five lead notes\n- at least eight blocks\n- the lead heard at three octaves\n- no two neighbouring blocks alike",
    "teaches": "a small idea, carried.",
    "pattern": {
      "version": 1,
      "title": "five notes",
      "tempo": 104,
      "loop": 16,
      "key": "A minor",
      "steps": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "bass": ["A2", null, null, "A2", null, null, "A2", null, "F2", null, null, "F2", null, null, "G2", null],
      "hold": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      "basshold": [3, 1, 1, 3, 1, 1, 2, 1, 3, 1, 1, 3, 1, 1, 2, 1],
      "lock": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "basslock": [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      "tones": [null, null],
      "mirrors": [],
      "mute": [false, false, false],
      "chords": [
        {
          "deg": 0,
          "shape": "triad",
          "voicing": "root"
        },
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        {
          "deg": 5,
          "shape": "triad",
          "voicing": "root"
        },
        null,
        null,
        null,
        null,
        null,
        {
          "deg": 6,
          "shape": "triad",
          "voicing": "root"
        },
        null
      ],
      "chordhold": [8, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 1, 1, 2, 1],
      "blocks": [
        {
          "lanes": [
            {
              "off": true
            }
          ]
        },
        {},
        {},
        {}
      ]
    }
  }
]
```
