# Folio ↔ REAPER hardening

**Status:** implemented and accepted, except the reboot cycle  
**Recorded:** 2026-09-05  
**Built:** 2026-09-06  
**Accepted:** 2026-09-07

All five migration steps are done. The launcher, status service,
`/api/renderer` proxy, required-renderer browser behavior, and the strengthened
keyboard journey are in place, and the persistent cable is real and proved. The
transient bridge, its launcher (`scripts/folio-reaper-bridge.ps1`), the C++
helper, and the build script are retained unused as the rollback path.

**What step 1 actually took.** The 2026-09-06 work mistook two ports named
`Folio to REAPER` and `REAPER from Folio` for an installed loopMIDI cable,
because loopMIDI was running and one name matched exactly. They were the
stranded Windows MIDI 2 software devices left by the very bridge this document
retires, and while they held those names loopMIDI published nothing at all. A
MidiSrv restart on 2026-09-07 cleared them; loopMIDI's own `Folio to REAPER`
then appeared, its counters accounted for every message sent, and a winmm
loopback returned all 100. A port of the right name is not evidence of the right
cable.

**Acceptance run 2026-09-07, over the real cable.** Ten consecutive
launch → ready → stop → close cycles, every one reaching `ready`, closing only
its own REAPER and leaving an unrelated instance untouched (items 1, 7);
all three track meters and the master responding with REAPER stopped
(`tests/rack-meters.png`); force-closing REAPER giving `renderer-lost` (item 2);
force-closing the status service leaving the rack orphaned with the status
correctly gone, and a fresh launch recovering to `ready` (item 3); a wrong cable
name giving `port-missing` with no REAPER started and no port touched (item 5);
ordinary Folio unaffected (item 6, via the suite).

**Item 4, the reboot cycle, is still outstanding.** The stranded pair was
cleared with a MidiSrv restart rather than a restart of the machine, so the
cable's survival across logon has not been shown. Until it is, the bridge files
stay.

**A caveat behind `ready`.** REAPER reports ready as soon as its process
survives startup, but SINE takes several more seconds to load its instruments,
and notes sent into that window are dropped with the meters at `-inf`. This is
the gap `ready` was already documented as unable to close, not a fault in the
pipe — but it cost an hour of misdiagnosis, so it is written down here.

## Decision

Keep REAPER as Folio's native SINE host. Replace the app-owned transient MIDI
endpoint pair with one persistent virtual MIDI cable, and make a promised
external renderer fail visibly instead of silently changing Folio's sound.

Installation purity is not a project goal. The current bridge's lack of an
installer, driver, registry change, or reboot was an implementation property,
not a player ruling. It does not justify retaining a lifecycle that has failed
in three out of three ordinary attempts to open Folio with its intended sound.

Direct VST hosting remains a possible later architecture, but it is not the
next move. It would make Folio responsible for real-time audio-device handling,
VST lifecycle and state, block processing, event scheduling, crash recovery,
and mixing. Hardening one MIDI boundary is the smaller and more legible bet.

This work is external-renderer infrastructure under `BUDGET.md`, not a new
instrument choice.

## Player contract

There are two explicit modes. They must never be inferred from whether a port
happens to exist.

### Ordinary Folio

`file://` and the deployed static build use Folio's own tones normally. An
absent rack is not an error.

**Amended 2026-09-11.** `folio.cmd` and `node server.mjs` were ordinary Folio
too, until a `?quest=` link that left out `?renderer=reaper` put the own tone
back on the player's machine with the rack running. The player's ruling: never
own tone on this machine. The local server now writes the promise into every
page it serves; only the test suite's `FOLIO_RENDERER=none` turns it off.

### REAPER Folio

`folio-reaper.cmd` opens the local instrument with explicit renderer intent,
provisionally `http://localhost:4173/?renderer=reaper`. In this mode REAPER's
SINE rack is part of the launch promise.

- Playback and audition must not fall through to own tones when the rack is
  unavailable.
- If the renderer is not ready when Play is pressed, transport does not start.
- If the renderer disappears during playback, Folio stops, clears queued MIDI,
  sends panic where possible, and remains stopped.
- A persistent, high-contrast error says which boundary failed and that the
  music is safe.
- The error clears automatically when the polled renderer state becomes ready.
- Own tones in this mode require a future explicit player choice. No override
  control belongs in this hardening until its gamepad home is agreed; the first
  version therefore has no dismiss, retry, or fallback button.

The current footer-only `playing · own tone` report is not an acceptable error.
It makes a renderer failure sound like a functioning but mysteriously worse
instrument.

## Target signal path

```text
Folio document
  -> Folio lookahead scheduler (`js/audio.js`)
  -> Web MIDI output: `Folio to REAPER`
  -> persistent installed virtual MIDI cable
  -> REAPER input: `Folio to REAPER`
  -> stopped, input-monitored SINE rack
  -> REAPER master / configured audio device
```

REAPER remains a renderer only. It does not own Folio's document, timeline,
transport, playhead, progressive disclosure, or controls.

The fixed rack remains:

- MIDI channel 1 — lead: Ratio piano, velocity 82
- MIDI channel 2 — bass: Crux J-bass, velocity 88
- MIDI channel 3 — chords: Roads Rhodes, velocity 68

The existing renderer-seat channel arithmetic remains unchanged. Instrument
selection and additional rack seats remain outside this hardening.

## Persistent cable

The first practical candidate is loopMIDI, configured with one port named
exactly `Folio to REAPER` and enabled at login. It is a replaceable system
dependency, not a component Folio owns or tears down.

Windows MIDI Services' machine-persistent loopbacks are the preferred eventual
system facility, but their consumer release is documented for November 2026
and is not the basis of this September build. Moving to them later is a
deliberate migration after verification, not an automatic upgrade.

The launcher must treat the cable as installed infrastructure:

- It checks that the exact output and input are visible.
- It never creates, adopts, removes, or repairs endpoint pairs.
- It never restarts the Windows MIDI service automatically.
- A missing cable is a precise startup failure with installation/recovery
  guidance, not a reason to create a temporary substitute.
- REAPER is configured to use the persistent input without disabling or
  rewriting unrelated MIDI devices.

Once the persistent path passes acceptance, retire the transient bridge,
copied Windows MIDI runtime, ready/stop events, mutex, stale-pair adoption, and
endpoint cleanup. Keep them available during migration so rollback is possible;
do not delete them in the first change that introduces the persistent path.

## REAPER lifecycle

`folio-reaper.cmd` remains the one player-facing launch action.

1. Start the renderer status service immediately in `starting` state.
2. Verify the persistent MIDI cable.
3. Verify REAPER and the rack project exist.
4. Preserve the known audio-device setup unless a later ruling changes it.
5. Start a new REAPER instance with `Folio Sound Rack.rpp` minimized or hidden.
6. Verify that the process survives startup before reporting `ready`.
7. Open Folio in its dedicated profile with `?renderer=reaper`.
8. While open, watch the REAPER process and the persistent port.
9. On graceful stop, close only the owned REAPER instance and status service.
   Leave the MIDI cable alone.

The player should not need to touch REAPER during a normal session. Hiding or
minimizing its window is presentation, not headless operation: REAPER is still
the running host.

Do not start, stop, or inspect Folio's `:4173` server. Its being down may still
be deliberate.

## Observable renderer state

The status service should listen throughout startup, rather than appearing
only after readiness, and expose structured state through the existing
`/api/renderer` proxy. A small vocabulary is enough:

| State | Meaning |
| --- | --- |
| `not-requested` | Ordinary Folio; own tones are correct. |
| `starting` | Renderer launch is still in progress. |
| `port-missing` | The persistent `Folio to REAPER` cable is absent. |
| `reaper-missing` | The expected REAPER executable is absent. |
| `rack-missing` | The fixed rack project is absent. |
| `reaper-failed` | REAPER exited or failed during startup. |
| `ready` | Port exists and the owned REAPER rack process is alive. |
| `renderer-lost` | A formerly ready port or rack process disappeared. |

The response should include a short stable `detail` suitable for diagnosis,
but the browser owns player-facing copy. Do not leak arbitrary process output
into the page.

`ready` cannot prove that the plug-in produced audible samples or that the
physical output is turned on. Without adding cooperation inside REAPER, the
hard boundary we can honestly certify is: the persistent port exists, the
known rack was launched, and its process remains alive. Errors beyond that
remain named diagnostic cases in `rack/README.md`, not falsely detected facts.

## Error behavior in Folio

Renderer intent is parsed once at boot and retained for the page session.

In required-REAPER mode, distinguish at least:

- Web MIDI is unavailable in this browser.
- MIDI permission has not yet been granted.
- MIDI permission was denied.
- The exact output port is missing.
- The renderer service reports a startup failure.
- The renderer was ready and then disappeared.
- A MIDI send threw or the port closed.

The error occupies a persistent calm panel over the folio. It must not blink,
use a grid/stripe texture, or disappear on a timer. It names the failed boundary
and the recovery outside Folio, for example:

> **The sound rack did not answer.**  
> Folio found no `Folio to REAPER` MIDI port. Your music is safe. Start the
> installed MIDI cable, then reopen the Folio sound rack.

While the error is present, editing and autosave remain safe and available,
but Play and audition refuse with the same reason. A failed `midiNote()` must
not reach `samplePlay()` or the oscillator path in required-REAPER mode.

Ordinary Folio retains the existing own-tone behavior. The deployed and
`file://` builds never show a REAPER error merely because no local renderer
exists.

## Recovery policy

Prefer a small deterministic recovery path over automatic machine repair.

- Folio polls and recovers automatically if the same expected port and rack
  become healthy again.
- The launcher may restart only processes it started.
- It does not mutate system MIDI configuration during a normal launch.
- It does not restart Windows services, kill unrelated REAPER instances, or
  manufacture replacement endpoint names.
- Startup failures remain visible in the launcher log and the Folio panel.
- A later one-action repair flow is separate work and requires an agreed
  keyboard/gamepad home before its brief is written.

## Migration order

1. Install and manually prove the persistent cable from Chrome to the existing
   REAPER rack, without changing Folio's music data.
2. Change the launcher to consume that cable while retaining the old bridge as
   an explicit rollback path.
3. Add explicit renderer intent, structured status, and fail-visible browser
   behavior.
4. Run lifecycle acceptance below.
5. Only after acceptance, remove the transient bridge path and update
   `rack/README.md` to the durable contract.

At no point may a test read or write `quests/quest-log.json` or
`quests/rulings.json`.

## Verification

Run `npm test --prefix tests` before and after implementation and report the
literal `N passed, M failed` tail. Strengthen the existing keyboard journey's
renderer coverage; do not add an eighth journey solely for internal states.
The browser test must establish both halves of the player contract:

- ordinary Folio plays its own tone with no renderer;
- required-REAPER Folio refuses playback when its promised renderer is absent;
- required mode never silently reaches the sample/synth fallback;
- loss during playback stops transport and shows the persistent error;
- recovery to `ready` clears the error without reloading the music;
- stop/panic and the fixed channel/velocity mappings remain intact.

Open and describe `tests/e2e.png` after the UI change. Assertions do not replace
the screenshot check.

The installed full-path acceptance is deliberately outside the isolated Chrome
journey. Using no player data, prove:

1. Ten consecutive launch → play → stop → close cycles.
2. Recovery after force-closing the owned REAPER instance.
3. Recovery after force-closing the launcher/status service.
4. One reboot/logon → launch → play cycle.
5. A missing/stopped persistent-cable case producing the precise visible error.
6. Ordinary Folio continuing to use own tones with the rack absent.
7. No manual REAPER or MIDI configuration during successful cycles.

The hardening is not complete merely because one smoke test passes. The launch
contract is that an ordinary requested session either produces the promised
SINE rack or tells the player exactly why it cannot; it never impersonates
success with a different instrument.
