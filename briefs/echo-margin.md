# The echo's actions on the gamepad, and the right margin that says them

Merged. This file records what was built and where it lives.

Read `folio.html` first — it carries a MAP comment saying what lives where —
then `js/echo.js` for the call and the judgement, `js/entry.js` for what the
pad and the board actually do (THE CODE IS THE SOURCE OF TRUTH; not this
file), and `AGENTS.md` rules 3 (the gamepad is primary), 5 (migraine) and 7
(testing policy).

## What it is

Before this, an echo page could be played and judged from the keyboard (O and
P) and from the pad only by raising a screen — start, then voices, then □ and
△. The two acts a transcription drill is made of were two levels deep on the
primary surface, and there was no way at all to slow the call down, to loop a
few bars of it, or to be told where in the page its notes fall.

Five acts now sit on the page itself, under the triggers, and the right margin
says what each seat does and where it currently stands. They are reachable
only on an echo page — a page carrying an `echo` field (`briefs/echo.md`) —
and everywhere else the same buttons are exactly what they always were.

## The pad — agreed with the player, built exactly this

    L2 + select      plays the call            (echoPlay)
    R2 + select      judges the answer         (echoJudge)
    L2 + L1 · R1     slower · faster           the pace
    L2 + L3          the loop starts here      at the cursor
    R2 + L3          the loop ends here        at the cursor
    L2 + R3          where the notes are       the hint

Bare, all four seats are what they were: select is play/stop, L1 and R1 are
the voice, L3 is the loop length, R3 turns the page over. The bumpers and R3
under R2 are not spoken for.

The triggers are read once at the top of `pollPads`, before anything that
reads them — the transport, the bumpers, the sticks, the face buttons and the
d-pad — so no two parts of one frame can be told a different story about the
hand. They used to be read below the bumpers, which is why the bumper branch
could not see them.

**Keyboard:** O and P are unchanged. The pace, the window and the hint are
pad-only for now; no free key falls out of the board, and nothing here is
worth spending an awkward one on. There is no controls reference and there
will not be one.

## The pace

Three values — whole, half, quarter — multiplying the step, never the page's
own tempo. `stepDur()` carries the multiplier, so the call and the page's own
playback slow together by construction and the header still says 142. The ring
has ends rather than a way round: asking for slower at a quarter stays at a
quarter.

## The window

Two edges, set one at a time at the cursor, in steps of the page. While one
stands it is what the transport runs and what the call keeps to — the call's
events outside it are not played, and the ones inside begin where the window
begins. It outranks the loop rung.

The first edge set brings the other with it (the loop's own end for a start,
the head of the page for an end), so one press already shortens what is heard.
An end before the start is the same window said backwards and the two swap.
Both edges on one step is one step. A run already under way snaps into the
window rather than finishing its lap outside it, exactly as shortening the
loop snaps home.

## The hint

One faint gilt bracket under the drawing's field for each note of the line
being answered — the step it begins on, as long as it rings, and nothing else.
No height, no colour, no name: the rhythm handed over and the pitches kept
back. It reads the judged voice only, never the ground a recorded call carries
under it.

## None of the three is written down

They belong to the page in hand for exactly as long as it is in hand.
`switchWorkspace` puts all three back, because a half pace or a short loop
carried into the next drill is a lie about what the next drill sounds like.
Nothing reaches the page document, the autosave or the log.

## The drawing

- the window is a wash in the roll's field — the page's own `--wash`, full
  height, under the home rules and the music alike, so what is outside reads
  as a page still there and not being played rather than as a page crossed
  out. It is kept lighter than the playhead's wash, which is the same colour,
  so the playhead stays the darker of the two where they meet.
- bars, chords and intervals outside the window fade the way steps past the
  loop already fade. The column says the same thing the drawing says.
- the hint's brackets are three sides of 1px `--gilt`, about 0.5rem tall,
  hung off the foot of the field above the base numbers — 0.75 inside the
  window, 0.3 outside. They stand outside the layout, so raising them shifts
  nothing: the drawing and the column are the same height with them up.

## The right margin

Between the teaching line and the quest's standing, on an echo page only: a
small-caps gilt heading, a hair rule, then a row a seat — the key in ink on
the left, what it does in faded ink on the right — with the state said
directly under the seat that turns it. The pace and the hint are shown by
which word is lit (ink, under a gilt rule) rather than spelled out; the window
is one line, `bars 2 to 3 · steps 5 to 12`, or `the whole page`. Bars are four
steps and both are counted from one, as the page's own numbers are.

The block is rebuilt only when what it says has moved — it is touched on every
autosave, which is on every note.

## The footer

The existing voice, short and lowercase: `half pace`, `the loop starts at 5`,
`the loop ends at 12`, `the notes, shown`. The call's line names the pace when
it is not the whole one.

## Where it lives

    js/echo.js     the pace, the window and the hint, and echoPlay keeping to
                   the window
    js/audio.js    stepDur carries the pace; the scheduler turns round at the
                   window's end rather than the loop's
    js/views.js    the wash, the brackets, and one question about what is
                   outside what is playing
    js/quests.js   the margin block, and the reset on leaving a page
    js/entry.js    the six seats, and the trigger read moved above them
    folio.css      .rollwin, .rollhints/.hintbar, .recho and its rows
    folio.html     one element, #railecho, between the teaching line and the
                   quest's standing

## Out of scope — not built

A controls page of any kind. A pace or window that is written into the page
document. Any hint that says a pitch, a name or a direction. Keyboard seats
for the three new acts. Bumpers or R3 under R2.

## Testing

`npm test --prefix tests` — journey 5c covers the pace scaling the
scheduling, both window edges through the pad including the swap, the hint
toggle and what it draws, the two select acts, the bare seats still meaning
what they meant, the reset on leaving, and the margin block appearing only on
an echo page.
