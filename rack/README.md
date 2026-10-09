# Folio sound rack

This is the durable contract for Folio's external renderer. Folio is still the
instrument: it owns the document, clock, scheduler, transport, playhead,
progressive disclosure, and every keyboard/gamepad interaction. REAPER is a
stopped, input-monitored sound rack. It neither plays a timeline nor sends
state back to Folio.

## Two modes, never inferred

The mode is a launch promise, not a guess about which ports happen to exist.

**Ordinary Folio** — `file://`, the deployed static build, and a device
reaching the folio over `--lan`. Folio's own tones are the correct sound. An
absent rack is not an error and is never mentioned.

**REAPER Folio** — every page the local server serves on this machine, and any
page opened with `?renderer=reaper` (as `folio-reaper.cmd` opens it). Since
2026-09-11 the server writes `<meta name="folio-renderer" content="reaper">`
into the page it serves, so `folio.cmd`, `node server.mjs` and a link that
leaves the parameter out are all REAPER Folio: on the player's machine there
is no own tone. Only the test suite turns the promise off, with
`FOLIO_RENDERER=none`. In this mode the SINE rack is part of
the launch promise. Playback and audition never fall through to Folio's own
tones; if the renderer is not ready, transport does not start, and if it
disappears mid-loop, Folio stops, clears queued MIDI, sends panic, and stays
stopped behind a calm persistent panel naming the boundary that failed. Own
tones in this mode would require a future explicit player choice, so the panel
has no dismiss, retry, or fallback control.

## Using it

1. Leave the installed MIDI cable running (it starts at login; see below).
2. Run `folio-reaper.cmd`.
3. Leave its console window and the REAPER rack open. On first use, click or
   press a key and allow Chrome's MIDI request; the profile keeps that grant.
   If Chrome or the profile is not found, open the `?renderer=reaper` URL
   manually.
4. Close the REAPER rack when finished.

The launcher deliberately does **not** start, stop, or inspect Folio's server.
A down `:4173` remains a deliberate state until the player says otherwise.

## Signal path

```text
Folio document
  -> Folio lookahead scheduler (`js/audio.js`)
  -> Web MIDI output: "Folio to REAPER"
  -> persistent installed virtual MIDI cable (loopMIDI)
  -> REAPER input: "Folio to REAPER" (All MIDI Inputs, per-channel)
  -> three monitored rack tracks (voice channel filtered, then mapped to 1)
  -> REAPER master / USB Audio CODEC
```

The fixed rack is deliberately smaller than an instrument browser:

- MIDI channel 1 — lead: Ratio piano, velocity 82
- MIDI channel 2 — bass: Crux J-bass, velocity 88
- MIDI channel 3 — chords: Roads Rhodes, velocity 68

Each track filters its Folio channel, then the checked-in `folio-channel-one`
JSFX changes only that channel number before SINE. This is necessary because
the three saved SINE instruments listen on channel 1; without the mapper the
lead works and the channel-2/3 bass and chords remain silent. The launcher
installs the JSFX into REAPER's resource shelf on every start.

The channels are also renderer seats: seat 0 is channels 1–3, seat 1 is 4–6,
and so on through seat 4 on 13–15. `midiSelectInstrument(voice, seat)` is the
Folio seam: it silences the rack and moves that voice's subsequent notes to its
channel in the chosen seat. MIDI 1 provides five complete three-voice seats;
channel 16 remains unused.

Three seats a voice are filled. Seat 0 is the original level-matched lineup;
seats 1 and 2 were added by `scripts/rack-seats.py`, which clones a voice's
seat-0 track and changes four things — its GUIDs, its name, the MIDI channel it
listens on (`4096 + (device << 5) + channel`, so 5088 + channel here), and the
SINE state in its FX chain:

- MIDI 4 — lead, Helix strings          · MIDI 7 — lead, Spindle felt piano
- MIDI 5 — bass, Ratio piano            · MIDI 8 — bass, Clutch organ
- MIDI 6 — chords, Spindle felt piano   · MIDI 9 — chords, Helix strings

Only seat 0 is level-matched; the rest carry their voice's seat-0 fader and
have not been balanced against each other.

Those states are **lifted, never built**. SINE's saved plugin state carries
what the library database does not — an instrument's internals come out of
encrypted `.otmeta` sample metadata — so a state assembled by hand loads
nothing and renders silence however correct its instrument, articulation and
mic ids are, and that was measured: the piano control renders at rms 144861
where six hand-built variants of Violins a8 render at exactly zero, with the
tempo envelope, the key range, the dynamic layers, the articulation list and
the cold-load window each eliminated in turn. A state SINE itself wrote moves
to any track and any channel and plays. So the script harvests states out of
projects that once held them, and the three extra instruments come from
`tmp/reaper-audition/03-wide-field-sine-lineup.rpp`.

To put an instrument here that no project has ever held, load it once in SINE's
own UI, save that project, and add it to `SOURCES` in the script. To add one by
hand instead, duplicate its voice's monitored track, set its input to the
channel for that voice and seat, and name it in the same three parts the
existing tracks use — `LEAD — Ratio piano — MIDI 1`. That name is the whole of
the declaration: the status service reads this project file, takes the channel
off the end of each track name and the instrument out of the middle, and
reports the result beside the health as `voices` — one list a voice, each entry
`{ seat, name }`, in seat order. `server.mjs` passes it through untouched and
`js/audio.js` reads it into `midiRack`.

So the catalogue is the rack itself and never a list kept in the page. The
voices screen draws the rack's instruments while the rack is playing — that is
the chord lane's first rail of its own, since the rack has always had a track
for it — and the folio's own kits otherwise. A voice with one instrument in the
rack shows one seat and walking it changes nothing, which is the truth; there
is no way to draw a seat that has nothing behind it, because nothing declares a
seat except a track that exists. A rack that is not up sends no catalogue at
all, and the rails are the kits again.

The seat is runtime state and is never saved: page documents still store no
DAW, patch, channel, or renderer choice.

Adding real rack instruments remains quest-budgeted per the 2026-08-29 ruling.
What is free is this pipe: reading the rack's own tracks and putting them under
the hands.

Those velocities and the rack faders are one level-matched lineup. They are
rendering calibration, not composition data. Page documents do not store a
DAW, patch, channel, or renderer choice. Additional selectable instruments are
quest-budgeted features; maintaining this pipe and its fixed defaults is free
architecture by the 2026-08-29 ruling in `BUDGET.md`.

## The persistent cable

One installed virtual MIDI cable, published under exactly one name,
`Folio to REAPER`. It is a replaceable system dependency, not a component Folio
owns. Windows MIDI Services' machine-persistent loopbacks are the preferred
eventual facility, but their consumer release is documented for November 2026;
moving to them is a later deliberate migration after verification, not an
automatic upgrade.

Until 2026-09-07 this machine had no such cable, though it looked as if it did.
The retired transient bridge had left stranded Windows MIDI 2 software devices
named `Folio to REAPER` and `REAPER from Folio`, and while they held those names
loopMIDI could publish nothing at all — not even its own default port. A MidiSrv
restart cleared them, after which loopMIDI's configured `Folio to REAPER`
appeared and carried traffic (its own counter reads the exact byte and message
totals sent), and a winmm loopback test returned all 100 messages sent.

The lesson worth keeping: a port of the right name is not evidence of the right
cable. Check that loopMIDI's own port list and counters account for it.

The launcher treats the cable as installed infrastructure. It checks that the
exact output and input are visible and does nothing else to it: it never
creates, adopts, removes, or repairs endpoints, never restarts the Windows MIDI
service, and never manufactures a substitute name. A missing cable is a precise
startup failure with recovery guidance.

Installation purity is not a project goal. The previous app-owned transient
endpoint pair needed no installer or reboot, but that was an implementation
property rather than a player ruling, and it failed three of three ordinary
attempts to open Folio with its intended sound.

## Observable renderer state

`scripts/folio-reaper-service.mjs` opens its status port immediately, in
`starting`, rather than only after readiness, and the launcher names one state
on a single machine-readable line. `server.mjs` proxies it at `/api/renderer`;
nothing answering there means no renderer was requested of this machine.

| State | Meaning |
| --- | --- |
| `not-requested` | Ordinary Folio; own tones are correct. |
| `starting` | Renderer launch is still in progress. |
| `port-missing` | The persistent `Folio to REAPER` cable is absent. |
| `reaper-missing` | The expected REAPER executable is absent. |
| `rack-missing` | The fixed rack project is absent. |
| `reaper-failed` | REAPER exited or failed during startup. |
| `ready` | Cable exists and the owned REAPER rack process is alive. |
| `renderer-lost` | A formerly ready cable or rack process disappeared. |

Each state carries a short stable `detail` for diagnosis. The browser owns all
player-facing copy; arbitrary launcher output never reaches the page.

`ready` cannot prove that the plug-in produced audible samples or that the
physical output is turned on. The hard boundary this can honestly certify is:
the persistent cable exists, the known rack was launched, and its process
remains alive. Everything past that is a named diagnostic case below, not a
detected fact.

## Connection, timing, and fallback

`js/audio.js` attempts Web MIDI only on a local HTTP origin (`localhost`,
`127.0.0.1`, or `[::1]`) and only for the exact output name above. A page that
was promised the rack asks for permission at once; otherwise the first real
pointer/key gesture requests it, and a successful grant is remembered in local
storage as `folio-midi-permission`.

Folio schedules timestamped note-on/off messages from the same audio clock and
lookahead window that drive its own tones. A silent AudioWorklet pulse wakes the
scheduler from that rendering clock while Chrome hides the tab; the ordinary
page timer is only its fallback. External note-offs leave 24 ms before the next
step, separate from the own tones' 6 ms envelope tail, because the Windows MIDI
path delivers smaller boundaries inconsistently. REAPER remains stopped.
Transport stop clears queued MIDI and sends all-notes-off plus all-sound-off on
all three channels. Optional visual compensation is a local-only number of
milliseconds in `folio-midi-latency-ms` (clamped to 0–500); it delays the drawn
playhead, not the music or stored page.

The renderer is exclusive, never layered over Folio's synth. A usable renderer
requires both the exact MIDI output and a `ready` status. In ordinary Folio, an
absent or failed renderer simply takes the sample/own-tone path and the footer
says `own tone`. In required-REAPER Folio there is no such path: the same
absence raises the panel and refuses playback. `file://` and the deployed
static instrument always use Folio's own sound.

## What the launcher owns

`scripts/folio-reaper.ps1` performs the whole lifecycle:

- verifies the persistent cable on both sides, and stops there if it is absent;
- verifies REAPER and the rack project;
- ORs the cable's input into REAPER's enabled-input and All MIDI Inputs masks,
  preserving other enabled MIDI devices;
- restores the known working REAPER device setup: WASAPI shared,
  `Speakers (USB Audio CODEC )`, 48 kHz, 256 samples, two outputs;
- opens `Folio Sound Rack.rpp` in a new REAPER instance and waits for it;
- watches both the rack process and the cable while the rack is open;
- accepts Hub's named graceful-stop signal and closes only the instance it
  started, leaving the cable and any other REAPER alone.

Reasserting the REAPER settings on every launch is intentional: other open
REAPER instances may later write older global preferences. If the physical
output device changes, update the `wasapi_*` values in this launcher and test
the rack; do not add a Folio UI setting for it.

The launcher asks Hub to restart Folio's managed browser
(`.experiments-hub/browser-profiles/<first 16 hex of sha256("daw")>`, the
profile holding the MIDI grant) rather than opening one itself. A restart,
because Chrome lists MIDI ports once per browser process: a browser that was
open before the cable appeared, or across a Windows MIDI service restart,
never sees `Folio to REAPER` however healthy the rack is. Hub brings it back
on the page it was showing. Only when Hub is down does the launcher start
Chrome on that profile directly.

The same failure can happen with the rack already running, and the page deals
with it: when the rack reports `ready` but the browser has had no port by that
name for three seconds, the page asks its server (`POST /api/recover`), which
asks Hub (`/api/browser/recover`). If the page is in a browser Hub owns (the
Hub window, or Folio's managed browser), Hub restarts that browser with all its
tabs, at most once every ninety seconds each. If it is anywhere else, Hub opens
the page in the Hub window instead, and the old window says where the music
went. Links to Folio go through Hub too —
`http://localhost:7777/go/daw/?quest=<id>` — so they land on the Folio tab
already open in the right browser, not in whatever browser the link was
clicked in.

Because the launcher must not start or inspect Folio's `:4173` server, a launch
made while that server is deliberately down lands on the browser's own
connection error. That is the 2026-09-05 ruling working as written, not a
renderer fault: start Folio's server first when you want both.

`FOLIO_RACK_NO_BROWSER=1` skips opening the browser entirely. It exists for the
installed acceptance runs, which must not close a browser the player is using.

## Files and rebuilding

- `Folio Sound Rack.rpp` — the stopped, armed, monitor-only REAPER project.
- `../folio-reaper.cmd` — player-facing entry point.
- `../scripts/folio-reaper-service.mjs` — status service and launcher owner.
- `../scripts/folio-reaper.ps1` — the persistent-cable launcher.

The previous transient-endpoint path is retained, unused, as the explicit
rollback for this migration:

- `../scripts/folio-reaper-bridge.ps1` — the former launcher.
- `bridge/` — checked-in app-local executable and Windows MIDI runtime.
- `../scripts/folio-midi-bridge/` — C++ source and MSBuild project.
- `../scripts/build-midi-bridge.ps1` — downloads the pinned Microsoft/NuGet
  packages into ignored `tmp/`, builds x64 Release, and refreshes `bridge/`.

To roll back, point `folio-reaper-service.mjs` at `folio-reaper-bridge.ps1`.
Delete none of the above until the installed acceptance in
`reaper_hardening.md` is complete.

## Verification and diagnosis

The keyboard journey in `tests/e2e.js` establishes both halves of the player
contract without an eighth journey: ordinary Folio plays its own tone with no
renderer; required-REAPER Folio refuses playback when its promised renderer is
absent and never reaches the sample or synth path; editing continues under the
panel; a rack that becomes healthy clears the error without reloading the
music; and a rack lost mid-playback stops the transport and silences the
channels. `tests/e2e-rack.png` is the panel as the player sees it.

On 2026-09-06 the launcher, status service, and signal path were proved end to
end: notes on channels 1–3 reached the launched rack, all three track meters
and the master responded with REAPER stopped, graceful stop closed only the
owned instance, a deliberately wrong cable name produced `port-missing` without
starting REAPER or touching any port, and Chrome opened the Hub profile
directly at `http://localhost:4173/?renderer=reaper`.

Those runs carried their MIDI over the stranded transient pair, not over a
persistent cable, so they were re-run on 2026-09-07 over the real one. Then:
ten consecutive launch → ready → stop → close cycles, each closing only its own
REAPER and leaving an unrelated instance alone; all three track meters and the
master responding with REAPER stopped (`tests/rack-meters.png`); force-closing
REAPER giving `renderer-lost`; force-closing the status service leaving the rack
orphaned but the status correctly gone, and a fresh launch recovering to
`ready`. What is still unproven is a reboot: the stranded pair was cleared with
a MidiSrv restart, so "the cable is there after logon" has not yet been shown.

One honest caveat behind `ready`: REAPER answers ready as soon as its process
survives startup, but SINE needs several more seconds to load its instruments.
Notes sent into that window are silently dropped by the plug-in, and the meters
stay at `-inf`. This is exactly the gap `ready` was documented as unable to
close; it is not a fault in the pipe.

Useful distinctions when diagnosing:

- Panel says the rack did not answer, and no launcher window is open: the
  renderer was never started, or its status service exited. Run
  `folio-reaper.cmd` and read its console.
- Panel names the missing `Folio to REAPER` port: loopMIDI is not running, or
  its port has been renamed. Neither Folio nor the launcher will recreate it.
- Panel says the browser is refusing MIDI: inspect Chrome's MIDI permission for
  this page in site settings.
- Footer says `playing · reaper`, but no REAPER meter moves: inspect the cable's
  input and REAPER's enabled/All MIDI Inputs masks.
- A track meter moves, but master does not: inspect that track's plug-in,
  fader, mute, and master send.
- Master moves, but nothing is heard: inspect the WASAPI device and the
  physical USB output, not Folio's notes or scheduler.
- Hanging notes: stop in Folio first. Closing the rack is the second hard
  boundary because the status endpoint immediately raises the panel.
