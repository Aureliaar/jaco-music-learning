# Folio sound rack

This is the durable contract for Folio's external renderer. Folio is still the
instrument: it owns the document, clock, scheduler, transport, playhead,
progressive disclosure, and every keyboard/gamepad interaction. REAPER is a
stopped, input-monitored sound rack. It neither plays a timeline nor sends
state back to Folio.

## Using it

1. Run `folio-reaper.cmd`.
2. Leave its console window and the REAPER rack open.
3. The launcher asks Experiments Hub to open Folio in `daw`'s dedicated Chrome
   profile after the MIDI endpoint exists. On first use, click or press a
   keyboard key and allow Chrome's MIDI request; the profile keeps that grant.
   If Hub is unavailable, open `http://localhost:4173` manually after the rack
   is ready.
4. Close the REAPER rack when finished. The launcher's health endpoint closes
   and Folio returns to its own tones.

Experiments Hub also registers the rack as the separate `daw-reaper` service
on health port 4174. Starting and stopping that service owns exactly the same
launcher lifecycle, but gives the renderer its own live state and captured
diagnostics without coupling it to Folio's deliberately independent web
server. `scripts/folio-reaper-service.mjs` exposes the port only after the
launcher reports the native bridge ready. Hub Stop first asks this service to
close REAPER and remove the endpoints gracefully; only a failed or timed-out
shutdown falls back to terminating the process tree. If the bridge exits while
REAPER is still open, the launcher and health service fail too, so Hub shows
the renderer as stopped instead of leaving a false-green service behind.

The launcher deliberately does **not** start, stop, or inspect Folio's server.
A down `:4173` remains a deliberate state until the player says otherwise.

## Signal path

```text
Folio document
  -> Folio lookahead scheduler (`js/audio.js`)
  -> Web MIDI output: "Folio to REAPER"
  -> app-local Windows MIDI 2 transient loopback
  -> REAPER input: "REAPER from Folio" (All MIDI Inputs)
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
hidden Folio seam: it silences the rack and moves that voice's subsequent notes
to its channel in the chosen seat.
There is deliberately no player-facing assignment, catalogue, or persistence
yet. To add a later instrument, duplicate its voice's monitored track and set
its input to the channel for that voice and seat. MIDI 1 provides five complete
three-voice seats; channel 16 remains unused.

Those velocities and the rack faders are one level-matched lineup. They are
rendering calibration, not composition data. Page documents do not store a
DAW, patch, channel, or renderer choice. Additional selectable instruments are
quest-budgeted features; maintaining this pipe and its fixed defaults is free
architecture by the 2026-08-29 ruling in `BUDGET.md`.

## Connection, timing, and fallback

`js/audio.js` attempts Web MIDI only on a local HTTP origin (`localhost`,
`127.0.0.1`, or `[::1]`) and only for the exact output name above. The first
real pointer/key gesture requests permission; a successful permission is
remembered in local storage as `folio-midi-permission`.

Folio schedules timestamped note-on/off messages from the same audio clock and
lookahead window that drive its own tones. REAPER remains stopped. Transport
stop clears queued MIDI and sends all-notes-off plus all-sound-off on all three
channels. Optional visual compensation is a local-only number of milliseconds
in `folio-midi-latency-ms` (clamped to 0–500); it delays the drawn playhead, not
the music or stored page.

The renderer is exclusive, never layered over Folio's synth. A usable renderer
requires both the exact MIDI output and the local health endpoint on 4174. If
either is absent, closes, or rejects a send, that note takes the existing
sample/own-tone path. While playing, the footer identifies `reaper` or
`own tone`. Closing the rack removes the transient endpoint and closes the
health endpoint, making fallback automatic. `file://` and the deployed static
instrument always use Folio's own sound.

## What the launcher owns

`scripts/folio-reaper.ps1` performs the whole lifecycle:

- stops a stale Folio bridge left by an interrupted launcher;
- starts `rack/bridge/folio-midi-bridge.exe`, retries bounded startup failures,
  and waits for both exact ports;
- ORs the receive port into REAPER's enabled-input and All MIDI Inputs masks,
  preserving other enabled MIDI devices;
- restores the known working REAPER device setup: WASAPI shared,
  `Speakers (USB Audio CODEC )`, 48 kHz, 256 samples, two outputs;
- opens `Folio Sound Rack.rpp` in a new REAPER instance and waits for it;
- watches the bridge while the rack is open and exits with a visible error if
  the endpoint process dies;
- accepts Hub's named graceful-stop signal, closes REAPER, then signals endpoint
  removal and waits up to five seconds before force-ending a stuck helper.

Reasserting the REAPER settings on every launch is intentional: other open
REAPER instances may later write older global preferences. If the physical
output device changes, update the `wasapi_*` values in this launcher and test
the rack; do not add a Folio UI setting for it.

The native helper uses Microsoft's `Windows.Devices.Midi2` runtime copied
beside the executable. It requires no virtual-MIDI driver, registry change,
system installer, or reboot. The named ready/stop events and mutex make one
launcher the clear owner of the transient endpoints. Its cleanup now waits for
stale names to leave the service before recreating them.

## Files and rebuilding

- `Folio Sound Rack.rpp` — the stopped, armed, monitor-only REAPER project.
- `bridge/` — checked-in app-local executable and Windows MIDI runtime.
- `../folio-reaper.cmd` — player-facing entry point.
- `../scripts/folio-reaper-service.mjs` — Hub health service and launcher owner.
- `../scripts/folio-reaper.ps1` — endpoint, REAPER preferences, and cleanup.
- `../scripts/folio-midi-bridge/` — C++ source and MSBuild project.
- `../scripts/build-midi-bridge.ps1` — downloads the pinned Microsoft/NuGet
  packages into ignored `tmp/`, builds x64 Release, and refreshes `bridge/`.

Rebuild from the repository root with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-midi-bridge.ps1
```

## Verification and diagnosis

The existing keyboard journey in `tests/e2e.js` mocks only the browser port and
protects the three channel/velocity mappings plus stop/panic behavior without
growing an eighth journey. The 2026-08-29 full-path smoke test additionally
proved a real isolated Chrome page -> Windows endpoint -> stopped REAPER rack;
the Ratio and master meters responded. It used temp logs, rulings, kits,
browser profile, and a non-4173 server, so it did not touch player data.

Useful distinctions when diagnosing:

- Hub log says `Service call failed, but did not return an error message` and
  `Get-PnpDevice` still lists `MIDIU_LOOP_A_FOLIOSEND` / `MIDIU_LOOP_B_FOLIORECEIVE`:
  a force-ended preview bridge has left its software devices outside the
  loopback manager. The launcher adopts the pair when both exact WinMM ports
  are still usable; Folio's health gate still restores own-tone fallback when
  the rack closes. A MIDI-service restart is recovery for a dead or partial
  pair, not the first response to a healthy stranded one.
- Footer says `playing · own tone`: check that `daw-reaper` is green in Hub and
  the REAPER rack remains open, then click/key once and inspect Chrome's MIDI
  permission. Hub logs distinguish endpoint startup failure from a rack exit.
- Footer says `playing · reaper`, but no REAPER meter moves: inspect the
  receive endpoint and REAPER's enabled/All MIDI Inputs masks.
- A track meter moves, but master does not: inspect that track's plug-in,
  fader, mute, and master send.
- Master moves, but nothing is heard: inspect the WASAPI device and the
  physical USB output, not Folio's notes or scheduler.
- Hanging notes: stop in Folio first. Closing the rack is the second hard
  boundary because the health endpoint immediately kills the renderer path.
